import React from 'react';
import { parseFenBoard } from '../lib/fen';
import { GamePhase } from '../lib/phase';

// Simple geometric piece silhouettes, drawn in a 100×100 square
const PIECES: Record<string, React.ReactNode> = {
  p: (
    <>
      <circle cx="50" cy="34" r="13" />
      <path d="M36 80 Q39 58 45 47 L55 47 Q61 58 64 80 Z" />
    </>
  ),
  r: (
    <>
      <path d="M31 80 L34 46 L66 46 L69 80 Z" />
      <path d="M28 46 L28 22 L38 22 L38 30 L45 30 L45 22 L55 22 L55 30 L62 30 L62 22 L72 22 L72 46 Z" />
    </>
  ),
  n: <path d="M32 80 C32 66 40 60 47 55 C40 56 32 58 25 52 L23 45 L43 27 L45 15 L54 23 C72 27 78 52 71 80 Z" />,
  b: (
    <>
      <circle cx="50" cy="15" r="6" />
      <path d="M50 21 C64 32 67 47 59 60 L41 60 C33 47 36 32 50 21 Z" />
      <path d="M42 60 L37 80 L63 80 L58 60 Z" />
    </>
  ),
  q: (
    <>
      <path d="M28 80 L22 36 L38 55 L42 26 L50 50 L58 26 L62 55 L78 36 L72 80 Z" />
      <circle cx="22" cy="33" r="5" />
      <circle cx="42" cy="23" r="5" />
      <circle cx="58" cy="23" r="5" />
      <circle cx="78" cy="33" r="5" />
    </>
  ),
  k: (
    <>
      <path d="M29 80 C27 60 34 45 50 43 C66 45 73 60 71 80 Z" />
      <path d="M45 12 H55 V22 H63 V31 H55 V43 H45 V31 H37 V22 H45 Z" />
    </>
  ),
};

const BASE = <rect x="22" y="78" width="56" height="11" rx="3" />;

// Final position of a game, white at the bottom. Squares and pieces come from the theme tokens.
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
              <g className={piece === piece.toUpperCase() ? 'mb-white' : 'mb-black'} transform="translate(50 52) scale(1.12) translate(-50 -52)">
                {PIECES[piece.toLowerCase()]}
                {BASE}
              </g>
            )}
          </g>
        ))
      )}
    </svg>
  );
}

const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame'];
const PHASE_PIECE: Record<GamePhase, string> = { opening: 'p', middlegame: 'n', endgame: 'k' };

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
      <g className="mb-white pt-piece" transform={`translate(400 ${phase ? 340 : 400}) scale(4.6) translate(-50 -52)`}>
        {PIECES[phase ? PHASE_PIECE[phase] : 'n']}
        {BASE}
      </g>
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
