// "Staunty" pieces by sadsnake1 (the Lichess set), CC BY-NC-SA 4.0: see pieces/staunty/LICENSE.md.
// The SVG files are inlined at build time, unmodified.
import wP from './pieces/staunty/wP.svg?raw';
import wN from './pieces/staunty/wN.svg?raw';
import wB from './pieces/staunty/wB.svg?raw';
import wR from './pieces/staunty/wR.svg?raw';
import wQ from './pieces/staunty/wQ.svg?raw';
import wK from './pieces/staunty/wK.svg?raw';
import bP from './pieces/staunty/bP.svg?raw';
import bN from './pieces/staunty/bN.svg?raw';
import bB from './pieces/staunty/bB.svg?raw';
import bR from './pieces/staunty/bR.svg?raw';
import bQ from './pieces/staunty/bQ.svg?raw';
import bK from './pieces/staunty/bK.svg?raw';

const RAW: Record<string, string> = { P: wP, N: wN, B: wB, R: wR, Q: wQ, K: wK, p: bP, n: bN, b: bB, r: bR, q: bQ, k: bK };

// viewBox and inner markup of each file, so a piece can be nested in a board's own <svg>
const PARSED: Record<string, { viewBox: string; inner: string }> = Object.fromEntries(
  Object.entries(RAW).map(([piece, svg]) => [
    piece,
    {
      viewBox: /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 50 50',
      inner: svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
    },
  ])
);

// A piece as a FEN letter (uppercase white, lowercase black), drawn in the given square
export function StauntonPiece({ piece, x = 0, y = 0, size }: { piece: string; x?: number; y?: number; size: number }) {
  const p = PARSED[piece];
  if (!p) return null;
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox={p.viewBox}
      fillRule="evenodd"
      clipRule="evenodd"
      dangerouslySetInnerHTML={{ __html: p.inner }}
    />
  );
}
