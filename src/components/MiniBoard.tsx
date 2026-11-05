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

// Staunton pieces of the "cburnett" set (the Lichess default), by Colin Burnett,
// BSD licence (https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces). 45×45 square.
const STAUNTON: Record<'p' | 'n' | 'k', React.ReactNode> = {
  p: (
    <path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" />
  ),
  n: (
    <>
      <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
      <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
      <path className="pt-ink" d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" />
      <path
        className="pt-ink"
        d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z"
        transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"
      />
    </>
  ),
  k: (
    <>
      <path d="M 22.5,11.63 V 6 M 20,8 H 25" fill="none" />
      <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
      <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" />
      <path d="M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37" fill="none" />
    </>
  ),
};
const PHASE_PIECE: Record<GamePhase, 'p' | 'n' | 'k'> = { opening: 'p', middlegame: 'n', endgame: 'k' };

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
      <g className="pt-piece" transform={`translate(400 ${phase ? 320 : 390}) scale(8.2) translate(-22.5 -22.5)`}>
        {STAUNTON[phase ? PHASE_PIECE[phase] : 'n']}
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
