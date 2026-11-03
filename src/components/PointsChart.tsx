import React, { useState } from 'react';
import { RoundPoints } from '../lib/playerProfile';

const OUTCOME_WORD = { win: "vittoria", draw: "patta", loss: "sconfitta" } as const;

const W = 340;
const H = 160;
const PAD = { top: 14, right: 12, bottom: 26, left: 24 };

// Shape repeats the result for who cannot tell the colors apart: filled = win, diamond = draw, ring = loss
function Marker({ outcome, cx, cy, r }: { outcome: "win" | "draw" | "loss"; cx: number; cy: number; r: number }) {
  if (outcome === "draw") {
    const d = r * 1.3;
    return <path className="pc-dot draw" d={`M${cx} ${cy - d} L${cx + d} ${cy} L${cx} ${cy + d} L${cx - d} ${cy} Z`} />;
  }
  return <circle className={`pc-dot ${outcome}`} cx={cx} cy={cy} r={r} />;
}

const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");

// Cumulative points round by round: one line, one marker per round colored by the result
// (the result is also in the tooltip and in the games list below, never color alone)
export function PointsChart({ data, nameOf }: { data: RoundPoints[]; nameOf: (handle: string) => string }) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const maxY = Math.max(1, Math.ceil(data[data.length - 1].points));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  // x = 0 is the start of the season (0 points), then one step per round played
  const x = (i: number) => PAD.left + (plotW * i) / data.length;
  const y = (v: number) => PAD.top + plotH - (plotH * v) / maxY;
  const step = maxY > 8 ? Math.ceil(maxY / 4) : 1;
  const ticks = Array.from({ length: Math.floor(maxY / step) + 1 }, (_, i) => i * step);

  const points = [{ px: x(0), py: y(0) }, ...data.map((d, i) => ({ px: x(i + 1), py: y(d.points) }))];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.px} ${p.py}`).join(" ");

  const outcomeOf = (d: RoundPoints) =>
    d.games.length === 1 ? d.games[0].outcome : d.games.every((g) => g.outcome === d.games[0].outcome) ? d.games[0].outcome : "draw";
  const describe = (d: RoundPoints) =>
    `Turno ${d.round}: ${d.games.map((g) => `${OUTCOME_WORD[g.outcome]} con ${nameOf(g.opponent)}`).join(", ")} · ${fmt(d.points)} ${d.points === 1 ? "punto" : "punti"}`;

  const current = active !== null ? data[active] : null;

  return (
    <figure className="points-chart">
      <div className="points-chart-tip" aria-live="polite">
        {current ? describe(current) : "● vittoria · ◆ patta · ○ sconfitta. Tocca un punto per i dettagli."}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Punti dopo ogni turno: ${data.map((d) => `turno ${d.round} ${fmt(d.points)}`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="pc-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="pc-axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <text className="pc-axis" x={x(0)} y={H - 8} textAnchor="middle">Inizio</text>
        {data.map((d, i) => (
          <text key={d.round} className="pc-axis" x={x(i + 1)} y={H - 8} textAnchor="middle">T{d.round}</text>
        ))}
        <path className="pc-line" d={line} />
        <circle className="pc-start" cx={x(0)} cy={y(0)} r={4} />
        {data.map((d, i) => (
          <g
            key={d.round}
            tabIndex={0}
            role="button"
            aria-label={describe(d)}
            className={`pc-point ${active === i ? "is-active" : ""}`}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive((a) => (a === i ? null : a))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            onClick={() => setActive(i)}
          >
            {active === i && <line className="pc-cross" x1={x(i + 1)} x2={x(i + 1)} y1={PAD.top} y2={PAD.top + plotH} />}
            <circle className="pc-hit" cx={x(i + 1)} cy={y(d.points)} r={16} />
            <Marker outcome={outcomeOf(d)} cx={x(i + 1)} cy={y(d.points)} r={active === i ? 7 : 5.5} />
          </g>
        ))}
      </svg>
    </figure>
  );
}
