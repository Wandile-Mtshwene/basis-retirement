"use client";
import { useState } from "react";
import type { RetirementProjection } from "../lib/api";

// Three lines on one shared Rand axis: amount invested (the pot), contributions
// paid in, and withdrawals taken out. Monte Carlo mode adds the pot's p5-p95 fan.
export function FanChart({ proj, retirementAge }: { proj: RetirementProjection; retirementAge: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 780, H = 340, padL = 76, padR = 20, padT = 18, padB = 52;
  const ages = proj.ages;
  const p = proj.percentiles;

  const cf = proj.cashflows ?? [];
  const contributions = ages.map((_, i) => Math.max(cf[i] ?? 0, 0));
  const withdrawals = ages.map((_, i) => Math.max(-(cf[i] ?? 0), 0));

  const maxY = Math.max(1, ...p.p95, ...contributions, ...withdrawals);
  const x = (i: number) => padL + (i / (ages.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const band = (hi: number[], lo: number[]) => {
    const top = hi.map((v, i) => `${x(i)},${y(v)}`).join(" L");
    const bot = lo.map((v, i) => `${x(i)},${y(v)}`).reverse().join(" L");
    return `M${top} L${bot} Z`;
  };
  const line = (arr: number[]) => "M" + arr.map((v, i) => `${x(i)},${y(v)}`).join(" L");

  const retIdx = ages.indexOf(retirementAge);
  const fmt = (v: number) =>
    v >= 1e6 ? `R${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `R${Math.round(v / 1e3)}k` : `R${Math.round(v)}`;
  const yticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  const POT = "var(--accent)", CONTRIB = "var(--positive)", DRAW = "#f87171";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
      {/* y grid + ticks */}
      {yticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{fmt(v)}</text>
        </g>
      ))}

      {/* axis labels */}
      <text transform={`translate(16 ${(H - padB + padT) / 2}) rotate(-90)`} textAnchor="middle"
        fontSize={12} fill="var(--muted)">Rand (today&apos;s money)</text>
      <text x={(padL + W - padR) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--muted)">Age</text>

      {/* retirement marker */}
      {retIdx >= 0 && (
        <g>
          <line x1={x(retIdx)} x2={x(retIdx)} y1={padT} y2={H - padB} stroke="var(--warn)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={x(retIdx) + 4} y={padT + 12} fontSize={11} fill="var(--warn)">retire @ {retirementAge}</text>
        </g>
      )}

      {/* pot fan (Monte Carlo only) */}
      {!proj.deterministic && <path d={band(p.p95, p.p5)} fill={POT} opacity={0.12} />}
      {!proj.deterministic && <path d={band(p.p75, p.p25)} fill={POT} opacity={0.18} />}

      {/* the three lines */}
      <path d={line(p.p50)} fill="none" stroke={POT} strokeWidth={2.4} />
      <path d={line(contributions)} fill="none" stroke={CONTRIB} strokeWidth={2} />
      <path d={line(withdrawals)} fill="none" stroke={DRAW} strokeWidth={2} />

      {/* legend */}
      {[["Amount invested", POT], ["Contributions", CONTRIB], ["Withdrawals", DRAW]].map(([label, c], i) => (
        <g key={label} transform={`translate(${padL + 6 + i * 150} ${padT + 2})`}>
          <line x1={0} x2={16} y1={0} y2={0} stroke={c} strokeWidth={2.4} />
          <text x={21} y={4} fontSize={11} fill="var(--muted)">{label}</text>
        </g>
      ))}

      {/* x axis labels */}
      {ages.filter((_, i) => i % 10 === 0 || i === ages.length - 1).map((a) => (
        <text key={a} x={x(ages.indexOf(a))} y={H - padB + 18} textAnchor="middle" fontSize={11} fill="var(--muted)">{a}</text>
      ))}

      {/* hover tooltip */}
      {hover !== null && (() => {
        const i = hover;
        const lines: { t: string; c: string }[] = [
          { t: `Age ${ages[i]}`, c: "var(--foreground)" },
          { t: `Amount invested ${fmt(p.p50[i])}`, c: POT },
        ];
        if (!proj.deterministic) lines.push({ t: `Range ${fmt(p.p5[i])} to ${fmt(p.p95[i])}`, c: "var(--muted)" });
        lines.push({ t: `Contribution ${fmt(contributions[i])}`, c: CONTRIB });
        lines.push({ t: `Withdrawal ${fmt(withdrawals[i])}`, c: DRAW });
        const bw = 180, bh = 16 * lines.length + 12;
        const bx = Math.min(Math.max(x(i) + 10, padL), W - padR - bw);
        return (
          <g>
            <line x1={x(i)} x2={x(i)} y1={padT} y2={H - padB} stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
            <circle cx={x(i)} cy={y(p.p50[i])} r={3.5} fill={POT} />
            <circle cx={x(i)} cy={y(contributions[i])} r={3} fill={CONTRIB} />
            <circle cx={x(i)} cy={y(withdrawals[i])} r={3} fill={DRAW} />
            <rect x={bx} y={padT} width={bw} height={bh} rx={8} fill="var(--surface-2)" stroke="var(--border)" />
            {lines.map((l, k) => (
              <text key={k} x={bx + 10} y={padT + 18 + k * 16} fontSize={11} fill={l.c}>{l.t}</text>
            ))}
          </g>
        );
      })()}

      {/* invisible columns for hover detection */}
      {ages.map((_, i) => (
        <rect key={i} x={x(i) - (W - padL - padR) / ages.length / 2} y={padT}
          width={(W - padL - padR) / ages.length} height={H - padB - padT}
          fill="transparent" onMouseEnter={() => setHover(i)} />
      ))}
    </svg>
  );
}
