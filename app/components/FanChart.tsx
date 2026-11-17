"use client";
import type { RetirementProjection } from "../lib/api";

// Dependency-free SVG fan chart: outer band p5-p95, inner band p25-p75, median line.
export function FanChart({ proj, retirementAge }: { proj: RetirementProjection; retirementAge: number }) {
  const W = 760, H = 320, padL = 64, padR = 16, padT = 16, padB = 34;
  const cfH = 46;                 // height of the cashflow strip at the bottom
  const ages = proj.ages;
  const p = proj.percentiles;
  const maxY = Math.max(...p.p95) || 1;

  const x = (i: number) => padL + (i / (ages.length - 1)) * (W - padL - padR);
  const potBottom = H - padB - cfH;
  const y = (v: number) => padT + (1 - v / maxY) * (potBottom - padT);

  // cashflow strip: contributions up (green), drawdowns down (red), around a zero line
  const cf = proj.cashflows ?? [];
  const cfMax = Math.max(1, ...cf.map((c) => Math.abs(c)));
  const cfZero = potBottom + cfH / 2;
  const barW = Math.max(1.5, (W - padL - padR) / ages.length - 1.5);
  const cfBar = (c: number) => (c / cfMax) * (cfH / 2 - 2);

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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{fmt(v)}</text>
        </g>
      ))}

      {/* retirement marker */}
      {retIdx >= 0 && (
        <g>
          <line x1={x(retIdx)} x2={x(retIdx)} y1={padT} y2={H - padB}
            stroke="var(--warn)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={x(retIdx) + 4} y={padT + 12} fontSize={11} fill="var(--warn)">retire @ {retirementAge}</text>
        </g>
      )}

      <path d={band(p.p95, p.p5)} fill="var(--accent)" opacity={0.14} />
      <path d={band(p.p75, p.p25)} fill="var(--accent)" opacity={0.22} />
      <path d={line(p.p50)} fill="none" stroke="var(--accent)" strokeWidth={2.2} />

      {/* cashflow strip: contributions (green, up) and drawdowns (red, down) */}
      <line x1={padL} x2={W - padR} y1={cfZero} y2={cfZero} stroke="var(--border)" strokeWidth={1} />
      {cf.map((c, i) => {
        if (!c) return null;
        const h = Math.abs(cfBar(c));
        return (
          <rect key={i} x={x(i) - barW / 2} width={barW}
            y={c > 0 ? cfZero - h : cfZero} height={h}
            fill={c > 0 ? "var(--positive)" : "#f87171"} opacity={0.85} />
        );
      })}
      <text x={padL} y={potBottom + 11} fontSize={10} fill="var(--positive)">contributions in</text>
      <text x={W - padR} y={H - padB - 2} fontSize={10} fill="#f87171" textAnchor="end">drawdowns out</text>

      {/* x axis labels */}
      {ages.filter((_, i) => i % 10 === 0 || i === ages.length - 1).map((a) => (
        <text key={a} x={x(ages.indexOf(a))} y={H - padB + 20} textAnchor="middle"
          fontSize={11} fill="var(--muted)">{a}</text>
      ))}
    </svg>
  );
}
