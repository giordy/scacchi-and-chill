// The facts behind each key moment (scripts/analysis.mjs chooses the moments), for the page to tell
// why a move mattered (src/lib/analysis.ts): what kind of move it was, the reply that punished a
// turn and what it won, a mate on the board, a sacrifice, what any other move would have lost.
// From Stockfish's lines (scripts/analyse-games.mjs) replayed with chess.js. Only for the analysis
// job: the results sync does not install chess.js.
import { Chess } from 'chess.js';

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Material of a side minus the other's, from a FEN ('w' or 'b')
export function balance(fen, side) {
  let white = 0;
  let black = 0;
  for (const ch of fen.split(' ')[0]) {
    const v = VALUE[ch.toLowerCase()];
    if (v === undefined) continue;
    if (ch === ch.toUpperCase()) white += v;
    else black += v;
  }
  return side === 'w' ? white - black : black - white;
}

const fromUci = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

// A move as the page tells it: the piece, what it takes, a check, castling, a promotion, where to
export function moveInfo(m) {
  return {
    piece: m.piece,
    to: m.to,
    ...(m.captured ? { capture: m.captured } : {}),
    ...(/[+#]/.test(m.san) ? { check: true } : {}),
    ...(m.flags.includes('k') || m.flags.includes('q') ? { castle: true } : {}),
    ...(m.promotion ? { promotion: m.promotion } : {}),
  };
}

// The positions of a line played from a FEN, as far as its moves are legal
function playLine(fen, ucis) {
  const chess = new Chess(fen);
  const moves = [];
  const fens = [fen];
  for (const uci of ucis) {
    try {
      moves.push(chess.move(fromUci(uci)));
    } catch {
      break;
    }
    fens.push(chess.fen());
  }
  return { moves, fens };
}

// How much material a side wins along a line, from the start, counted after a move of the given
// parity (odd: after the side that began the line moved again, so a piece taken can be taken back).
// A line that ends within max (a mate, the engine's whole line), or breaks off on a move that is not
// legal, counts to where it goes.
function gainAlong(fen, ucis, side, parity, max) {
  const { fens } = playLine(fen, ucis.slice(0, max));
  let n = fens.length - 1;
  const whole = ucis.length <= max || n < max;
  while (!whole && n > 0 && n % 2 !== parity) n--;
  if (n === 0) return undefined;
  return balance(fens[n], side) - balance(fen, side);
}

// A mate for a side in a score from White's side ({ mate }): the moves it takes, else undefined
const mateFor = (score, side) => (score?.mate !== undefined && score.mate !== 0 && (score.mate > 0) === (side === 'w') ? Math.abs(score.mate) : undefined);
const other = (side) => (side === 'w' ? 'b' : 'w');

// A turn: the move played, the engine's move in its place, and the line that punished it.
// p: the ply ({ fen, uci, best: { uci } }); after: the engine's line from the position after the
// move ({ pv, score }); next: the move the opponent actually played then (UCI), if any: the
// engine's answer may not be it, and the page tells it as what could have been
export function turnFacts(p, after, next) {
  const side = p.fen.split(' ')[1];
  const { moves, fens } = playLine(p.fen, [p.uci]);
  if (!moves[0]) return {};
  const facts = { move: moveInfo(moves[0]) };
  const best = playLine(p.fen, [p.best.uci]).moves[0];
  if (best) facts.bestMove = moveInfo(best);
  const pv = after?.pv ?? [];
  const reply = playLine(fens[1], pv.slice(0, 1)).moves[0];
  if (reply) facts.reply = { san: reply.san, ...moveInfo(reply), played: next === pv[0] };
  // What the opponent wins: the move played and their line, counted after the mover's next move
  const gain = gainAlong(p.fen, [p.uci, ...pv], other(side), 1, 7);
  if (gain !== undefined && gain > 0) facts.gain = gain;
  const mate = mateFor(after?.score, other(side));
  if (mate) facts.mate = mate;
  return facts;
}

// A best move: what it does along the engine's line (material, a mate, a sacrifice) and what the
// next best move would have cost. p: the ply ({ fen, uci, best: { uci, pv, score }, second: { pv, score } })
export function bestFacts(p) {
  const side = p.fen.split(' ')[1];
  const { moves } = playLine(p.fen, [p.uci]);
  if (!moves[0]) return {};
  const facts = { move: moveInfo(moves[0]) };
  if (p.uci === p.best.uci && p.best.pv?.length) {
    // Counted after the opponent's reply, the line short enough to be the point of the move
    const gain = gainAlong(p.fen, p.best.pv, side, 0, 6);
    if (gain !== undefined && gain >= 1) facts.gain = gain;
    // Material given and not taken back at once: a sacrifice
    const { fens } = playLine(p.fen, p.best.pv.slice(0, 3));
    if (fens.length === 4 && balance(fens[2], side) - balance(p.fen, side) <= -2 && balance(fens[3], side) - balance(p.fen, side) <= -2) facts.sacrifice = true;
    const mate = mateFor(p.best.score, side);
    if (mate) facts.mate = mate;
  }
  // What any other move would have cost: only when the move played is the engine's first choice
  // (a move as good but not the first may be the second line itself)
  if (p.uci === p.best.uci && p.second?.pv?.length) {
    const alt = {};
    const lost = gainAlong(p.fen, p.second.pv, other(side), 1, 7);
    if (lost !== undefined && lost >= 1) alt.gain = lost;
    const mate = mateFor(p.second.score, other(side));
    if (mate) alt.mate = mate;
    if (alt.gain || alt.mate) facts.alt = alt;
  }
  return facts;
}

// The moments chosen by keyMoments with their facts. plies: as evaluated, with the engine's lines;
// final: the engine's line from the final position, if the game did not end on the board
export function withFacts(result, plies, final) {
  const after = (i) => (i + 1 < plies.length ? plies[i + 1].best : final);
  const finish = result.finish && playLine(result.finish.fen, [result.finish.uci]).moves[0];
  return {
    ...result,
    turns: result.turns.map((t) => ({ ...t, ...turnFacts(plies[t.ply - 1], after(t.ply - 1), plies[t.ply]?.uci) })),
    // A chance is told as a turn: the answer that would take it, played or not
    ...(result.chances ? { chances: result.chances.map((c) => ({ ...c, ...turnFacts(plies[c.ply - 1], after(c.ply - 1), plies[c.ply]?.uci) })) } : {}),
    best: result.best.map((b) => ({ ...b, ...bestFacts(plies[b.ply - 1]) })),
    ...(result.finish ? { finish: { ...result.finish, ...(finish ? { move: moveInfo(finish) } : {}) } } : {}),
  };
}
