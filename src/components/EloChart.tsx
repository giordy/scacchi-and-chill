import React, { useState } from 'react';
import { EloPath, EloStep } from '../lib/eloPath';

const OUTCOME_WORD = ['sconfitta', 'patta', 'vittoria'] as const;
const OUTCOME_CLASS = ['loss', 'draw', 'win'] as const;

const W = 340;
const H = 160;
const PAD = { top: 14, right: 12, bottom: 26, left: 40 };

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

// The same markers as PointsChart: filled = win, diamond = draw, ring = loss
function Marker({ outcome, cx, cy, r }: { outcome: 'win' | 'draw' | 'loss'; cx: number; cy: number; r: number }) {
  if (outcome === 'draw') {
    const d = r * 1.3;
    return <path className="pc-dot draw" d={`M${cx} ${cy - d} L${cx + d} ${cy} L${cx} ${cy + d} L${cx - d} ${cy} Z`} />;
  }
  return <circle className={`pc-dot ${outcome}`} cx={cx} cy={cy} r={r} />;
}

// «La stagione in breve»: the Elo del torneo after each game of the season, from where it started
// (the dashed line). A point per game, in the order the ratings moved; tap one for the game and the sum
export function EloChart({ path, nameOf }: { path: EloPath; nameOf: (handle: string) => string }) {
  const [active, setActive] = useState<number | null>(null);
  const { steps } = path;
  // The points of the line: the start, then the rating after each game, then the performance
  const values = [path.start, ...steps.map((s) => s.after), ...(path.performance ? [path.end] : [])];
  const count = values.length - 1;
  const lo = Math.floor((Math.min(...values) - 10) / 25) * 25;
  const hi = Math.max(lo + 50, Math.ceil((Math.max(...values) + 10) / 25) * 25);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (plotW * i) / count;
  const y = (v: number) => PAD.top + plotH - (plotH * (v - lo)) / (hi - lo);
  const tickStep = [25, 50, 100, 200].find((t) => (hi - lo) / t <= 4) ?? 400;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / tickStep) * tickStep; t <= hi; t += tickStep) ticks.push(t);
  const labelEvery = Math.max(1, Math.ceil(steps.length / 7));

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(v)}`).join(' ');
  const describe = (s: EloStep, i: number) => {
    const before = Math.round(s.before);
    const after = Math.round(s.after);
    return (
      `Partita ${i + 1}${s.round ? ` (turno ${s.round})` : ''}: ${OUTCOME_WORD[s.score * 2]} con ${nameOf(s.opponent)} (${Math.round(s.opponentElo)}) · ` +
      (s.still ? `${before}, contro un esordiente l'Elo non si muove` : `${before} → ${after} (${signed(after - before)})`)
    );
  };
  const total = Math.round(path.end) - Math.round(path.start);

  return (
    <figure className="points-chart elo-chart">
      <div className="points-chart-tip" aria-live="polite">
        {active !== null
          ? describe(steps[active], active)
          : `Elo del torneo partita per partita: da ${Math.round(path.start)} a ${Math.round(path.end)} (${signed(total)}). Tocca un punto per i dettagli.`}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elo del torneo dopo ogni partita: ${values.map((v) => Math.round(v)).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="pc-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="pc-axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <line className="pc-base" x1={PAD.left} x2={W - PAD.right} y1={y(path.start)} y2={y(path.start)} />
        <text className="pc-axis" x={x(0)} y={H - 8} textAnchor="middle">Inizio</text>
        {steps.map((_, i) =>
          (i + 1) % labelEvery === 0 || i === steps.length - 1 ? (
            <text key={i} className="pc-axis" x={x(i + 1)} y={H - 8} textAnchor="middle">{i + 1}</text>
          ) : null
        )}
        {path.performance && <text className="pc-axis" x={x(count)} y={H - 8} textAnchor="middle">Fine</text>}
        <path className="pc-line" d={line} />
        <circle className="pc-start" cx={x(0)} cy={y(path.start)} r={4} />
        {path.performance && <circle className="pc-start" cx={x(count)} cy={y(path.end)} r={4} />}
        {steps.map((s, i) => (
          <g
            key={i}
            tabIndex={0}
            role="button"
            aria-label={describe(s, i)}
            className={`pc-point ${active === i ? 'is-active' : ''}`}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive((a) => (a === i ? null : a))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            onClick={() => setActive(i)}
          >
            {active === i && <line className="pc-cross" x1={x(i + 1)} x2={x(i + 1)} y1={PAD.top} y2={PAD.top + plotH} />}
            <circle className="pc-hit" cx={x(i + 1)} cy={y(s.after)} r={12} />
            <Marker outcome={OUTCOME_CLASS[s.score * 2]} cx={x(i + 1)} cy={y(s.after)} r={active === i ? 6 : 4.5} />
          </g>
        ))}
      </svg>
      {path.firstSeason && (
        <figcaption className="note note-sm">
          {path.performance
            ? `Prima stagione: a fine stagione l'Elo diventa la performance della stagione, ${Math.round(path.end)}.`
            : "Prima stagione: a fine stagione l'Elo diventa la performance della stagione."}
        </figcaption>
      )}
    </figure>
  );
}
