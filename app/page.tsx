"use client";

import { useEffect, useState } from "react";
import { FanChart } from "./components/FanChart";
import { projectRetirement, zar, type RetirementRequest, type RetirementProjection } from "./lib/api";

const DEFAULTS: RetirementRequest = {
  current_age: 40, retirement_age: 65, end_age: 95,
  current_savings: 500_000, annual_contribution: 120_000, contribution_escalation: 0.05,
  expected_return: 0.10, return_volatility: 0.12, inflation: 0.05,
  target_income: 300_000, n_sims: 10_000,
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

  // Re-run the simulation automatically whenever an input changes (debounced).
  useEffect(() => {
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(req)]);

  const success = proj ? Math.round(proj.success_probability * 100) : 0;
  const successColor = success >= 80 ? "var(--positive)" : success >= 50 ? "var(--warn)" : "#f87171";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-2xl font-semibold">Retirement outcome illustrator</h1>
      <p className="text-muted mt-1 max-w-3xl text-sm">
        A Monte Carlo engine runs thousands of market paths through your accumulation and drawdown
        years. The shaded fan shows the range of outcomes; the headline is the probability your money
        lasts to {req.end_age}.
      </p>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 mt-6">
        <div className="card p-5 h-fit grid grid-cols-2 gap-3">
          <F label="Current age"><input type="number" value={req.current_age} onChange={set("current_age")} /></F>
          <F label="Retirement age"><input type="number" value={req.retirement_age} onChange={set("retirement_age")} /></F>
          <F label="Plan to age"><input type="number" value={req.end_age} onChange={set("end_age")} /></F>
          <F label="Simulations"><input type="number" step={1000} value={req.n_sims} onChange={set("n_sims")} /></F>
          <F label="Current savings (R)" full><input type="number" step={50000} value={req.current_savings} onChange={set("current_savings")} /></F>
          <F label="Annual contribution (R)" full><input type="number" step={10000} value={req.annual_contribution} onChange={set("annual_contribution")} /></F>
          <F label="Target income /yr, today's R" full><input type="number" step={25000} value={req.target_income} onChange={set("target_income")} /></F>
          <F label="Expected return"><PctInput v={req.expected_return} on={setPct("expected_return")} /></F>
          <F label="Return volatility"><PctInput v={req.return_volatility} on={setPct("return_volatility")} /></F>
          <F label="Contribution escalation"><PctInput v={req.contribution_escalation} on={setPct("contribution_escalation")} /></F>
          <F label="Inflation"><PctInput v={req.inflation} on={setPct("inflation")} /></F>

          <p className="col-span-2 mt-2 text-xs text-muted flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${loading ? "bg-warn" : "bg-positive"}`} />
            {loading ? "Simulating…" : "Updates live as you type"}
          </p>
          {error && <p className="col-span-2 text-warn text-xs">{error}</p>}
        </div>

        <div className="space-y-5">
          {!proj && (
            <div className="card p-10 text-center text-muted">
              Set your plan and run the projection to see the distribution of outcomes.
            </div>
          )}
          {proj && (
            <>
              <div className="card p-5 flex flex-wrap items-center gap-x-10 gap-y-3">
                <div>
                  <div className="field-label">Probability money lasts to {req.end_age}</div>
                  <div className="text-4xl font-semibold" style={{ color: successColor }}>{success}%</div>
                </div>
                <Stat label="Median pot at retirement" value={zar(proj.capital_at_retirement.p50)} />
                <Stat label="Range at retirement (p5–p95)"
                  value={`${zar(proj.capital_at_retirement.p5)} – ${zar(proj.capital_at_retirement.p95)}`} />
                <Stat label="First-year income (nominal)" value={zar(proj.target_income_first_year)} />
                {proj.median_depletion_age && (
                  <Stat label="Median depletion age (failed paths)" value={`${proj.median_depletion_age}`} />
                )}
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Projected wealth ({proj.n_sims.toLocaleString()} simulations)</h2>
                  <Legend />
                </div>
                <FanChart proj={proj} retirementAge={req.retirement_age} />
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
  // value held as a decimal, edited as a percentage
  return <input type="number" step={0.5} value={+(v * 100).toFixed(2)}
    onChange={(e) => on(+e.target.value)} />;
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
