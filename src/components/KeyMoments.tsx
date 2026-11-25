import React from 'react';
import { GameAnalysis } from '../types';
import { MomentText, squaresOf, storyOf } from '../lib/analysis';
import { BoardArrow, MiniBoard } from './MiniBoard';

type Mark = { ply: number; kind: MomentText['kind'] };

// How the game went: White's chances along the game, the light part, against Black's, the dark one,
// with a dot on each key moment and a thin line where the middlegame and the endgame begin
function Curve({ curve, marks, phases }: { curve: number[]; marks: Mark[]; phases: number[] }) {
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
      {marks.map((m) => (
        <circle key={`${m.kind}${m.ply}`} cx={x(m.ply)} cy={y(curve[m.ply] ?? 50)} r="3.5" className={`km-dot is-${m.kind}`} />
      ))}
    </svg>
  );
}

function Moment({ m }: { m: MomentText }) {
  const played = squaresOf(m.moment.uci);
  const best = squaresOf(m.moment.bestUci);
  // Green for a move as good as the engine's, brass for a turn, with the engine's move in green
  const arrows: BoardArrow[] = [
    ...(played ? [{ ...played, kind: m.kind === 'turn' ? ('played' as const) : ('best' as const) }] : []),
    ...(m.kind === 'turn' && best ? [{ ...best, kind: 'best' as const }] : []),
  ];
  return (
    <li className={`km-item is-${m.kind}`}>
      <MiniBoard fen={m.moment.fen} label={`Posizione prima di ${m.title}`} arrows={arrows} />
      <div className="km-text">
        <strong>{m.title}</strong>
        <span>{m.text}</span>
      </div>
    </li>
  );
}

// The whole game told phase by phase, with its key moments (lib/analysis.ts)
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
  const marks = story.phases.flatMap((p) => p.moments.map((m) => ({ ply: m.moment.ply, kind: m.kind })));
  const phaseLines = [analysis.phases?.middle, analysis.phases?.end].filter((p): p is number => !!p && p < (analysis.curve?.length ?? 0) - 1);
  const hasTurn = marks.some((m) => m.kind === 'turn');
  return (
    <section className="key-moments" aria-label="I momenti chiave">
      <h3 className="km-title">I momenti chiave</h3>
      {analysis.curve && <Curve curve={analysis.curve} marks={marks} phases={phaseLines} />}
      {story.intro && <p className="km-story">{story.intro}</p>}
      {story.phases.map((p) => (
        <div key={p.key} className="km-phase-block">
          {p.title && <h4 className="km-phase-title">{p.title}</h4>}
          {p.text && <p className="km-story">{p.text}</p>}
          {p.moments.length > 0 && (
            <ol className="km-list">
              {p.moments.map((m) => (
                <Moment key={m.key} m={m} />
              ))}
            </ol>
          )}
        </div>
      ))}
      {story.ending && <p className="km-ending">{story.ending}</p>}
      {hasTurn && (
        <p className="km-note">
          <span className="km-key is-played" aria-hidden="true" /> la mossa giocata · <span className="km-key is-best" aria-hidden="true" /> quella che consigliava il computer
        </p>
      )}
    </section>
  );
}
