import React from 'react';
import { parseFenBoard } from '../lib/fen';
import { GamePhase } from '../lib/phase';
import { StauntonPiece } from './StauntonPiece';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// faded: a picture rather than a real result (the starting position of a game still to play)
export function MiniBoard({ fen, label, faded = false }: { fen: string; label: string; faded?: boolean }) {
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
