// Piece placement of a FEN as 8 rows (rank 8 first) of 8 squares: a piece letter or null.
// Returns null when the placement is not a valid 8×8 board.
export function parseFenBoard(fen: string): (string | null)[][] | null {
  const placement = fen.trim().split(/\s+/)[0] ?? '';
  const ranks = placement.split('/');
  if (ranks.length !== 8) return null;
  const board: (string | null)[][] = [];
  for (const rank of ranks) {
    const row: (string | null)[] = [];
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) row.push(...Array<null>(Number(ch)).fill(null));
      else if (/[prnbqk]/i.test(ch)) row.push(ch);
      else return null;
    }
    if (row.length !== 8) return null;
    board.push(row);
  }
  return board;
}
