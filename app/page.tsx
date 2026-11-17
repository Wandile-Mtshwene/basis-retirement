"use client";

import { useEffect, useState } from "react";
import { FanChart } from "./components/FanChart";
import { projectRetirement, zar, type RetirementRequest, type RetirementProjection } from "./lib/api";

const DEFAULTS: RetirementRequest = {
  current_age: 40, retirement_age: 65, end_age: 95,
  current_savings: 500_000, annual_contribution: 120_000, contribution_escalation: 0.0,
  expected_return: 0.10, return_volatility: 0.12, inflation: 0.05,
  withdrawal_type: "amount", withdrawal_value: 400_000, mode: "deterministic", n_sims: 10_000,
};

export default function Retirement() {
  const [req, setReq] = useState<RetirementRequest>(DEFAULTS);
  const [proj, setProj] = useState<RetirementProjection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof RetirementRequest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setReq({ ...req, [k]: +e.target.value });
  const setPct = (k: keyof RetirementRequest) => (pct: number) =>
    setReq({ ...req, [k]: pct / 100 });

  async function run() {
    setLoading(true); setError(null);
    try { setProj(await projectRetirement(req)); }
    catch (e) { setError(e instanceof Error ? e.message : "failed"); setProj(null); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(req)]);

  const isPct = req.withdrawal_type === "percentage";
  const isMC = req.mode === "monte_carlo";
  const success = proj ? Math.round(proj.success_probability * 100) : 0;
  const successColor = success >= 80 ? "var(--positive)" : success >= 50 ? "var(--warn)" : "#f87171";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-2xl font-semibold">Retirement outcome illustrator</h1>
      <p className="text-muted mt-1 max-w-3xl text-sm">
        Projects your savings and drawdown in today&apos;s money, so the pot grows while you save and
        is drawn down in retirement. Run a single expected path, or switch on Monte Carlo to see the
        range of outcomes and the chance the money lasts.
      </p>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 mt-6">
        <div className="card p-5 h-fit grid grid-cols-2 gap-3">
          {/* mode toggle */}
          <div className="col-span-2">
            <span className="field-label">Projection</span>
            <div className="flex gap-1 p-1 rounded-lg bg-surface-2 mt-1">
              {([["deterministic", "Single path"], ["monte_carlo", "Monte Carlo"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => setReq({ ...req, mode: m })}
                  className={`flex-1 py-1.5 rounded-md text-sm ${req.mode === m ? "bg-accent text-[var(--accent-ink)] font-semibold" : "text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <F label="Current age"><input type="number" value={req.current_age} onChange={set("current_age")} /></F>
          <F label="Retirement age"><input type="number" value={req.retirement_age} onChange={set("retirement_age")} /></F>
          <F label="Plan to age"><input type="number" value={req.end_age} onChange={set("end_age")} /></F>
          {isMC
            ? <F label="Simulations"><input type="number" step={1000} value={req.n_sims} onChange={set("n_sims")} /></F>
            : <F label="Expected return"><PctInput v={req.expected_return} on={setPct("expected_return")} /></F>}
          <F label="Current savings (R)" full><input type="number" step={50000} value={req.current_savings} onChange={set("current_savings")} /></F>
          <F label="Annual contribution (today's R)" full><input type="number" step={10000} value={req.annual_contribution} onChange={set("annual_contribution")} /></F>

          {/* withdrawal type toggle */}
          <div className="col-span-2">
            <span className="field-label">Retirement drawdown</span>
            <div className="flex gap-1 p-1 rounded-lg bg-surface-2 mt-1">
              {([["amount", "Fixed income"], ["percentage", "% of balance"]] as const).map(([w, label]) => (
                <button key={w} onClick={() => setReq({ ...req, withdrawal_type: w, withdrawal_value: w === "percentage" ? 0.05 : 400_000 })}
                  className={`flex-1 py-1.5 rounded-md text-sm ${req.withdrawal_type === w ? "bg-accent text-[var(--accent-ink)] font-semibold" : "text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {isPct
            ? <F label="Drawdown rate /yr" full><PctInput v={req.withdrawal_value} on={(p) => setReq({ ...req, withdrawal_value: p / 100 })} /></F>
            : <F label="Income /yr (today's R)" full><input type="number" step={25000} value={req.withdrawal_value} onChange={set("withdrawal_value")} /></F>}

          {isMC && <F label="Return volatility"><PctInput v={req.return_volatility} on={setPct("return_volatility")} /></F>}
          {isMC && <F label="Expected return"><PctInput v={req.expected_return} on={setPct("expected_return")} /></F>}
          <F label="Inflation"><PctInput v={req.inflation} on={setPct("inflation")} /></F>
          <F label="Contribution growth (real)"><PctInput v={req.contribution_escalation} on={setPct("contribution_escalation")} /></F>

          <p className="col-span-2 mt-2 text-xs text-muted flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${loading ? "bg-warn" : "bg-positive"}`} />
            {loading ? "Projecting…" : "Updates live as you type"}
          </p>
          {error && <p className="col-span-2 text-warn text-xs">{error}</p>}
        </div>

        <div className="space-y-5">
          {proj && (
            <>
              <div className="card p-5 flex flex-wrap items-center gap-x-10 gap-y-3">
                {isPct ? (
                  <div>
                    <div className="field-label">First-year income (today&apos;s money)</div>
                    <div className="text-4xl font-semibold text-accent">{zar(proj.first_year_income)}</div>
                  </div>
                ) : (
                  <div>
                    <div className="field-label">{isMC ? `Chance money lasts to ${req.end_age}` : `Money lasts to ${req.end_age}`}</div>
                    <div className="text-4xl font-semibold" style={{ color: isMC ? successColor : (success >= 100 ? "var(--positive)" : "#f87171") }}>
                      {isMC ? `${success}%` : (success >= 100 ? "Yes" : "No")}
                    </div>
                  </div>
                )}
                <Stat label="Pot at retirement (today's money)" value={zar(proj.capital_at_retirement.p50)} />
                {isMC && <Stat label="Range at retirement (p5 to p95)"
                  value={`${zar(proj.capital_at_retirement.p5)} to ${zar(proj.capital_at_retirement.p95)}`} />}
                {isPct && <Stat label="Pot at end of plan" value={zar(proj.percentiles.p50[proj.percentiles.p50.length - 1])} />}
                <Stat label="Real return used" value={`${(proj.real_return * 100).toFixed(1)}%`} />
                {proj.depletion_age && <Stat label="Runs out at age" value={`${proj.depletion_age}`} />}
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">
                    Projected pot in today&apos;s money{isMC ? ` (${proj.n_sims.toLocaleString()} simulations)` : ""}
                  </h2>
                  {isMC && <Legend />}
                </div>
                <FanChart proj={proj} retirementAge={req.retirement_age} />
                <p className="text-muted text-xs mt-2">
                  All figures are in today&apos;s rand. {isPct
                    ? "A percentage of the balance is drawn each year, so the pot is drawn down but never fully runs out."
                    : "A fixed real income is drawn each year, which can run the pot out if it is too high."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`space-y-1 ${full ? "col-span-2" : ""}`}><span className="field-label">{label}</span>{children}</label>;
}
function PctInput({ v, on }: { v: number; on: (pct: number) => void }) {
  return <input type="number" step={0.5} value={+(v * 100).toFixed(2)} onChange={(e) => on(+e.target.value)} />;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="field-label">{label}</div><div className="text-sm font-mono">{value}</div></div>;
}
function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--accent)", opacity: 0.22 }} />50% range</span>
      <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--accent)", opacity: 0.14 }} />90% range</span>
      <span className="inline-flex items-center gap-1"><i className="inline-block w-4 h-0.5" style={{ background: "var(--accent)" }} />median</span>
    </div>
  );
}
