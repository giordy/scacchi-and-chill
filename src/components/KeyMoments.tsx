import React, { useRef, useState } from 'react';
import { GameAnalysis } from '../types';
import { MomentText, squaresOf, storyOf } from '../lib/analysis';
import { swipeStep } from '../lib/swipe';
import { BoardArrow, MiniBoard } from './MiniBoard';

type Mark = { ply: number; kind: MomentText['kind'] };

// How the game went: White's chances along the game, the light part, against Black's, the dark one,
// with a dot on each key moment (bigger on the one on the board) and a thin line where the
// middlegame and the endgame begin
function Curve({ curve, marks, phases, current }: { curve: number[]; marks: Mark[]; phases: number[]; current?: number }) {
  const w = 300;
  const h = 48;
  const x = (i: number) => (curve.length > 1 ? (i / (curve.length - 1)) * w : 0);
  const y = (p: number) => h - (p / 100) * h;
  const line = curve.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  return (
    <svg className="km-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="L'andamento della partita: in basso il Bianco, in alto il Nero">
      <rect width={w} height={h} className="km-black" />
      <polygon points={`0,${h} ${line} ${w},${h}`} className="km-white" />
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} className="km-mid" />
      {phases.map((ply) => (
        <line key={ply} x1={x(ply)} x2={x(ply)} y1="0" y2={h} className="km-phase" />
      ))}
      {marks.map((m, i) => (
        <circle key={`${m.kind}${m.ply}`} cx={x(m.ply)} cy={y(curve[m.ply] ?? 50)} r={i === current ? 5.5 : 3.5} className={`km-dot is-${m.kind}${i === current ? ' is-current' : ''}`} />
      ))}
    </svg>
  );
}

// The arrows of a moment: green for a move as good as the engine's; a turn has the move played in
// brass and the engine's in green
// A turn, a chance and a mate missed show the move played and the engine's move in its place
const showsBoth = (m: MomentText) => m.kind === 'turn' || m.kind === 'chance' || m.kind === 'missed';

function arrowsOf(m: MomentText): BoardArrow[] {
  const shows = showsBoth(m);
  const played = squaresOf(m.moment.uci);
  const best = squaresOf(m.moment.bestUci);
  return [
    ...(played ? [{ ...played, kind: shows ? ('played' as const) : ('best' as const) }] : []),
    ...(shows && best ? [{ ...best, kind: 'best' as const }] : []),
  ];
}

// The whole game told phase by phase in a few lines, then its key moments one at a time on a board as
// wide as the screen: arrows, a swipe on the board, or a dot, to go from one to the next (lib/analysis.ts)
export function KeyMoments({
  analysis,
  names,
  state,
}: {
  analysis: GameAnalysis;
  names: { white: string; black: string };
  state?: { status?: string; winner?: 'white' | 'black' };
}) {
  const story = storyOf(analysis, names, state);
  const steps = story.phases.flatMap((p) => p.moments.map((m) => ({ m, phase: p.title })));
  const [chosen, setAt] = useState(0);
  // The analysis may change while the replay is open (analysed again, with fewer moments)
  const at = Math.max(0, Math.min(chosen, steps.length - 1));
  const go = (i: number) => setAt(Math.max(0, Math.min(steps.length - 1, i)));
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const phaseLines = [analysis.phases?.middle, analysis.phases?.end].filter((p): p is number => !!p && p < (analysis.curve?.length ?? 0) - 1);
  const step = steps[at];

  return (
    <section className="key-moments" aria-label="I momenti chiave">
      <h3 className="km-title">I momenti chiave</h3>
      {analysis.curve && <Curve curve={analysis.curve} marks={steps.map((s) => ({ ply: s.m.moment.ply, kind: s.m.kind }))} phases={phaseLines} current={at} />}
      <div className="km-story">
        {story.intro && <p>{story.intro}</p>}
        {story.phases
          .filter((p) => p.text)
          .map((p) => (
            // The sentence names its phase already
            <p key={p.key}>{p.text}</p>
          ))}
        {story.ending && <p className="km-ending">{story.ending}</p>}
      </div>
      {step && (
        <div className={`km-viewer is-${step.m.kind}`}>
          <div className="km-viewer-head">
            <span>{step.phase ?? ''}</span>
            <span>
              {at + 1} di {steps.length}
            </span>
          </div>
          <strong className="km-viewer-title" aria-live="polite">
            {step.m.title}
          </strong>
          <div
            className="km-board"
            onTouchStart={(e) => {
              const t = e.touches[0];
              touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
            }}
            onTouchEnd={(e) => {
              const start = touch.current;
              touch.current = null;
              const t = e.changedTouches[0];
              if (!start || !t) return;
              const s = swipeStep(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t);
              if (s) go(at + s);
            }}
          >
            <MiniBoard fen={step.m.moment.fen} label={`Posizione prima di ${step.m.title}`} arrows={arrowsOf(step.m)} coords />
          </div>
          <p className="km-viewer-text">{step.m.text}</p>
          <div className="km-nav">
            <button type="button" className="km-nav-btn" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Momento precedente">
              ‹
            </button>
            <div className="km-nav-dots">
              {steps.map((s, i) => (
                <button
                  key={s.m.key}
                  type="button"
                  className={`km-nav-dot is-${s.m.kind}${i === at ? ' is-current' : ''}`}
                  onClick={() => go(i)}
                  aria-label={s.m.title}
                  aria-current={i === at ? 'step' : undefined}
                />
              ))}
            </div>
            <button type="button" className="km-nav-btn" onClick={() => go(at + 1)} disabled={at === steps.length - 1} aria-label="Momento successivo">
              ›
            </button>
          </div>
          {showsBoth(step.m) && (
            <p className="km-note">
              <span className="km-key is-played" aria-hidden="true" /> la mossa giocata · <span className="km-key is-best" aria-hidden="true" /> quella che consigliava il computer
            </p>
          )}
        </div>
      )}
    </section>
  );
}
