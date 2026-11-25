// The key moments of a finished game, from Stockfish's evaluations (scripts/analyse-games.mjs runs
// the engine). The whole game is told, phase by phase (lib/analysis.ts on the site), in the spirit of
// the site: the moves where the game turned, each player's best moves and the final blow, with no
// list of small mistakes and no accuracy figures.
// Pure functions, shared by the results sync (which games still wait for their analysis) and tested.

// Bump to analyse every game again (e.g. after changing how the moments are chosen, or the engine);
// the site shows the analyses of the versions it knows (src/lib/analysis.ts) until the new ones arrive.
// 2: everything again with Stockfish 19 (the first games were analysed by Ubuntu's Stockfish 17)
// 3: the facts of each moment (scripts/moveFacts.mjs), for the page to tell why it mattered
export const ANALYSIS_VERSION = 3;

// Shorter games have no story to tell; the first plies are the opening, where the best move is no news
export const MIN_PLIES = 16;
const OPENING_PLIES = 8;

// Endings that are no game to comment on: aborted, never started, or a player banned for cheating
const NOT_ANALYSED = new Set(['created', 'started', 'aborted', 'noStart', 'cheat', 'unknownFinish']);

// Winning chances of White, 0-100, from a score in centipawns from White's side: the curve Lichess
// uses for its analysis (a mate counts as the edge of the scale)
export function winPercent(score) {
  if (score.mate !== undefined) return score.mate > 0 ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, score.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// The Lichess id of the game whose moves were analysed: the analysis of an old link is no good
export function needsAnalysis(game, gameIdOf) {
  const s = game.lichess;
  if (!s || game.decision || NOT_ANALYSED.has(s.status) || !s.moves) return false;
  if (s.variant && s.variant !== 'standard') return false;
  if (s.moves.split(' ').length < MIN_PLIES) return false;
  const id = gameIdOf(game.url) ?? s.id;
  return !(game.analysis && game.analysis.v === ANALYSIS_VERSION && game.analysis.id === id);
}

// How a player stands, from their own winning chances: 2 ahead, 1 level, 0 behind
const standing = (p) => (p >= 70 ? 2 : p > 30 ? 1 : 0);
const own = (color, white) => (color === 'white' ? white : 100 - white);
const round = (x) => Math.round(x);

// A turn is a move that changes how its player stands (from ahead to level, from level to behind…)
// with a real drop of their chances, not a step across the line
const TURN_DROP = 15;
// A safety cap for a game going back and forth: the biggest are kept
const MAX_TURNS = 8;
// Each player's best moves: the engine's choice (or as good) where the next best was the most worse,
// at least by a little (the page tells how much: lib/analysis.ts); a second one, far from the first,
// when it clearly mattered
const BEST_GAP = 5;
const SECOND_BEST_GAP = 10;
const BEST_APART = 10;
const SAME_AS_BEST = 2;

// Taking the piece the opponent just moved (a recapture, a trade offered, a piece left hanging): the
// only move, but no news to anyone
const recapture = (p, prev) => !!prev && p.san.includes('x') && p.uci.slice(2, 4) === prev.uci.slice(2, 4);

// plies: one per move, in order: { san, uci, color, fen (before the move), best: { uci, san, white },
// second?: { white } } with `white` White's winning chances after the engine's best (second) move.
// final: White's winning chances in the final position; mate: the last move gave checkmate.
// Returns what is saved on the game (field `analysis`) besides the version, id, engine and phases.
export function keyMoments(plies, final, { mate = false } = {}) {
  // White's chances in each position, the start included: the engine's best line from there
  const curve = [...plies.map((p) => p.best.white), final];
  const turns = [];
  const candidates = [];
  plies.forEach((p, i) => {
    const before = own(p.color, curve[i]);
    const after = own(p.color, curve[i + 1]);
    const drop = before - after;
    if (drop >= TURN_DROP && standing(after) < standing(before)) {
      turns.push({ ply: i + 1, color: p.color, san: p.san, uci: p.uci, bestSan: p.best.san, bestUci: p.best.uci, fen: p.fen, before: round(before), after: round(after), drop });
    }
    if (i < OPENING_PLIES || !p.second) return;
    const played = p.uci === p.best.uci || drop <= SAME_AS_BEST;
    const gap = before - own(p.color, p.second.white);
    // Not in a game already decided either way, where every move wins or every move loses
    if (!played || gap < BEST_GAP || before < 5 || before > 97 || recapture(p, plies[i - 1])) return;
    candidates.push({ ply: i + 1, color: p.color, san: p.san, uci: p.uci, fen: p.fen, after: round(after), gap });
  });
  const best = [];
  for (const color of ['white', 'black']) {
    const mine = candidates.filter((c) => c.color === color).sort((a, b) => b.gap - a.gap);
    if (mine[0]) best.push(mine[0]);
    const other = mine.find((c) => c.gap >= SECOND_BEST_GAP && Math.abs(c.ply - mine[0].ply) >= BEST_APART);
    if (other) best.push(other);
  }
  // Two turns of the same player a move or two apart are one moment: the bigger tells it
  const kept = [];
  for (const t of [...turns].sort((a, b) => b.drop - a.drop)) {
    if (!kept.some((k) => k.color === t.color && Math.abs(k.ply - t.ply) <= 4)) kept.push(t);
  }
  const chosen = kept.slice(0, MAX_TURNS).sort((a, b) => a.ply - b.ply);
  const last = plies[plies.length - 1];
  return {
    curve: curve.map(round),
    turns: chosen.map(({ drop, ...t }) => t),
    swings: kept.length,
    best: best.map((b) => ({ ...b, gap: round(b.gap) })).sort((a, b) => a.ply - b.ply),
    // The final blow: the move that gave checkmate
    ...(mate && last ? { finish: { ply: plies.length, color: last.color, san: last.san, uci: last.uci, fen: last.fen } } : {}),
  };
}

// Where the middlegame and the endgame begin (plies; missing when not reached): Lichess' own
// division when the game has it, otherwise from the pieces on the board, as Lichess roughly does.
// boards: the piece placement (first field of the FEN) of each position, the start included.
const LATEST_MIDDLE = 30;
export function phasesOf(division, boards) {
  if (division && (division.middle || division.end)) return { middle: division.middle, end: division.end };
  const pieces = (b) => (b.match(/[nbrqNBRQ]/g) ?? []).length;
  const backRank = (b, white) => (b.split('/')[white ? 7 : 0].match(white ? /[NBRQK]/g : /[nbrqk]/g) ?? []).length;
  // The opening is over by move 15 at the latest (Lichess also looks at how mixed the pawns are)
  const found = boards.findIndex((b) => pieces(b) <= 10 || backRank(b, true) < 4 || backRank(b, false) < 4);
  const middle = found > 0 ? Math.min(found, LATEST_MIDDLE) : boards.length > LATEST_MIDDLE + 1 ? LATEST_MIDDLE : -1;
  const end = boards.findIndex((b) => pieces(b) <= 6);
  const out = {};
  if (middle > 0) out.middle = middle;
  if (end > 0) out.end = end;
  if (out.end && !out.middle) out.middle = out.end;
  return out;
}
