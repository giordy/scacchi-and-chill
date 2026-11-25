import React from 'react';
import { parseFenBoard } from '../lib/fen';
import { GamePhase } from '../lib/phase';
import { StauntonPiece } from './StauntonPiece';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// An arrow on the board, from square to square ("e2", "e4"): the move played or the engine's
export interface BoardArrow {
  from: string;
  to: string;
  kind: 'played' | 'best';
}

const centre = (sq: string) => ({ x: (sq.charCodeAt(0) - 97) * 100 + 50, y: (56 - sq.charCodeAt(1)) * 100 + 50 });

// A straight arrow with its head drawn as a triangle (no <marker>: its id would clash between boards)
function Arrow({ from, to, kind }: BoardArrow) {
  const a = centre(from);
  const b = centre(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (!len) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const head = 34;
  const end = { x: b.x - ux * head, y: b.y - uy * head };
  const side = { x: -uy * 26, y: ux * 26 };
  return (
    <g className={`mb-arrow is-${kind}`}>
      <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} strokeWidth="16" strokeLinecap="round" />
      <polygon points={`${b.x},${b.y} ${end.x + side.x},${end.y + side.y} ${end.x - side.x},${end.y - side.y}`} />
    </g>
  );
}

// faded: a picture rather than a real result (the starting position of a game still to play)
export function MiniBoard({ fen, label, faded = false, arrows = [] }: { fen: string; label: string; faded?: boolean; arrows?: BoardArrow[] }) {
  const board = parseFenBoard(fen);
  if (!board) return null;
  return (
    <svg className={`mini-board${faded ? ' is-faded' : ''}`} viewBox="0 0 800 800" role="img" aria-label={label}>
      {board.map((row, r) =>
        row.map((piece, c) => (
          <g key={`${r}-${c}`} transform={`translate(${c * 100} ${r * 100})`}>
            <rect width="100" height="100" className={(r + c) % 2 === 0 ? 'mb-light' : 'mb-dark'} />
            {piece && (
              <StauntonPiece piece={piece} size={100} />
            )}
          </g>
        ))
      )}
      {arrows.map((ar) => (
        <Arrow key={`${ar.kind}-${ar.from}${ar.to}`} {...ar} />
      ))}
    </svg>
  );
}

const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame'];

const PHASE_PIECE: Record<GamePhase, string> = { opening: 'P', middlegame: 'N', endgame: 'K' };

// Ongoing game: never the real position (Lichess shows it a few plies late), only an empty faded
// board with a big piece for the phase and three segments with the current one lit.
// Without a phase from Lichess it shows a knight and no segments.
export function PhaseTile({ phase, label }: { phase?: GamePhase; label: string }) {
  return (
    <svg className="mini-board phase-tile" viewBox="0 0 800 800" role="img" aria-label={label}>
      {Array.from({ length: 64 }, (_, i) => {
        const r = Math.floor(i / 8);
        const c = i % 8;
        return <rect key={i} x={c * 100} y={r * 100} width="100" height="100" className={(r + c) % 2 === 0 ? 'mb-light' : 'mb-dark'} />;
      })}
      <rect width="800" height="800" className="pt-veil" />
      <StauntonPiece piece={phase ? PHASE_PIECE[phase] : 'N'} x={160} y={phase ? 70 : 150} size={480} />
      {phase &&
        PHASES.map((p, i) => (
          <rect
            key={p}
            x={130 + i * 190}
            y="660"
            width="160"
            height="44"
            rx="22"
            className={p === phase ? 'pt-seg is-current' : PHASES.indexOf(phase) > i ? 'pt-seg is-done' : 'pt-seg'}
          />
        ))}
    </svg>
  );
}
