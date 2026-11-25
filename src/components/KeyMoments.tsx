import React from 'react';
import { GameAnalysis } from '../types';
import { momentsOf, squaresOf, storyLine } from '../lib/analysis';
import { BoardArrow, MiniBoard } from './MiniBoard';

// How the game went: White's chances along the game, the light part, against Black's, the dark one,
// with a dot on each key moment
function Curve({ curve, marks }: { curve: number[]; marks: { ply: number; kind: 'turn' | 'best' }[] }) {
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
      {marks.map((m) => (
        <circle key={`${m.kind}${m.ply}`} cx={x(m.ply)} cy={y(curve[m.ply] ?? 50)} r="3.5" className={`km-dot is-${m.kind}`} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

// The key moments of a finished game, in the order they were played (lib/analysis.ts)
export function KeyMoments({ analysis, names }: { analysis: GameAnalysis; names: { white: string; black: string } }) {
  const moments = momentsOf(analysis, names);
  const story = storyLine(analysis);
  return (
    <section className="key-moments" aria-label="I momenti chiave">
      <h3 className="km-title">I momenti chiave</h3>
      {analysis.curve && <Curve curve={analysis.curve} marks={moments.map((m) => ({ ply: m.moment.ply, kind: m.kind }))} />}
      {story && <p className="km-story">{story}</p>}
      <ol className="km-list">
        {moments.map((m) => {
          const played = squaresOf(m.moment.uci);
          const best = squaresOf(m.moment.bestUci);
          const arrows: BoardArrow[] = [
            ...(played ? [{ ...played, kind: m.kind === 'best' ? ('best' as const) : ('played' as const) }] : []),
            ...(m.kind === 'turn' && best ? [{ ...best, kind: 'best' as const }] : []),
          ];
          return (
            <li key={m.key} className={`km-item is-${m.kind}`}>
              <MiniBoard fen={m.moment.fen} label={`Posizione prima di ${m.title}`} arrows={arrows} />
              <div className="km-text">
                <strong>{m.title}</strong>
                <span>{m.text}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="km-note">
        <span className="km-key is-played" aria-hidden="true" /> la mossa giocata · <span className="km-key is-best" aria-hidden="true" /> quella che consigliava il computer
      </p>
    </section>
  );
}
