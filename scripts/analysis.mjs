// The key moments of a finished game, from Stockfish's evaluations (scripts/analyse-games.mjs runs
// the engine). Kept light on purpose, in the spirit of the site: no list of mistakes, no accuracy
// figures, only the few moves where the game turned and each player's best move.
// Pure functions, shared by the results sync (which games still wait for their analysis) and tested.

// Bump to analyse every game again (e.g. after changing how the moments are chosen)
export const ANALYSIS_VERSION = 1;

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
const MAX_TURNS = 3;
// Each player's best move: the engine's choice (or as good) where the next best was the most worse,
// at least by a little (the page tells how much: lib/analysis.ts)
const BEST_GAP = 5;
const SAME_AS_BEST = 2;

// Taking back on the square where a piece was just taken: the only move, but no news to anyone
const recapture = (p, prev) => !!prev && p.san.includes('x') && prev.san.includes('x') && p.uci.slice(2, 4) === prev.uci.slice(2, 4);

// plies: one per move, in order: { san, uci, color, fen (before the move), best: { uci, san, white },
// second?: { white } } with `white` White's winning chances after the engine's best (second) move.
// final: White's winning chances in the final position.
// Returns what is saved on the game (field `analysis`) besides the version, id and engine.
export function keyMoments(plies, final) {
  // White's chances in each position, the start included: the engine's best line from there
  const curve = [...plies.map((p) => p.best.white), final];
  const turns = [];
  const best = {};
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
    if (!best[p.color] || gap > best[p.color].gap) {
      best[p.color] = { ply: i + 1, color: p.color, san: p.san, uci: p.uci, fen: p.fen, after: round(after), gap: round(gap) };
    }
  });
  // Two turns of the same player a move or two apart are one moment: the bigger tells it
  const kept = [];
  for (const t of [...turns].sort((a, b) => b.drop - a.drop)) {
    if (!kept.some((k) => k.color === t.color && Math.abs(k.ply - t.ply) <= 4)) kept.push(t);
  }
  const chosen = kept.slice(0, MAX_TURNS).sort((a, b) => a.ply - b.ply);
  return {
    curve: curve.map(round),
    turns: chosen.map(({ drop, ...t }) => t),
    swings: kept.length,
    best: Object.values(best).sort((a, b) => a.ply - b.ply),
  };
}
