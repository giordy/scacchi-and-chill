import { AnalysisMoment, GameAnalysis, HistoryGame } from '../types';
import { extractGameId } from './utils';

// The key moments of a finished game, as the replay tells them. The GitHub Action analyses each
// game once with Stockfish (scripts/analyse-games.mjs, scripts/analysis.mjs); here the moments become
// words. In the spirit of the site: the moves where the game turned and each player's best move,
// told kindly, with no list of mistakes and no accuracy figures.

// The version of scripts/analysis.mjs (ANALYSIS_VERSION) whose moments this page knows how to tell
const VERSION = 1;

// The analysis of the game behind the current link; none for an old link, a skipped game or a
// version this page does not know
export function analysisOf(game: Pick<HistoryGame, 'url' | 'analysis'>): GameAnalysis | undefined {
  const a = game.analysis;
  if (!a || a.v !== VERSION || a.skipped || !Array.isArray(a.curve)) return undefined;
  const id = extractGameId(game.url);
  return id && a.id !== id ? undefined : a;
}

// Something to tell: a turn or a best move
export const hasMoments = (a?: GameAnalysis) => !!a && ((a.turns?.length ?? 0) + (a.best?.length ?? 0) > 0);

// Italian piece letters: Re, Donna, Torre, Alfiere, Cavallo (squares and castling stay as they are)
const PIECES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
export const italianSan = (san: string) => san.replace(/[KQRBN]/g, (p) => PIECES[p]);

// "23. Cxe5" for White, "23... Cxe5" for Black
export function moveLabel(ply: number, san: string): string {
  const n = Math.ceil(ply / 2);
  return `${n}${ply % 2 === 1 ? '.' : '...'} ${italianSan(san)}`;
}

// How a player stands from their own chances: ahead, level, behind (the same lines as the script)
type Standing = 'ahead' | 'level' | 'behind';
const standing = (p: number): Standing => (p >= 70 ? 'ahead' : p > 30 ? 'level' : 'behind');

export interface MomentText {
  key: string;
  kind: 'turn' | 'best';
  title: string;
  text: string;
  moment: AnalysisMoment;
}

type Names = { white: string; black: string };

export function turnText(t: AnalysisMoment, names: Names): string {
  const mover = names[t.color];
  const other = names[t.color === 'white' ? 'black' : 'white'];
  const played = italianSan(t.san);
  const best = italianSan(t.bestSan ?? '');
  const from = standing(t.before ?? 50);
  const to = standing(t.after);
  if (from === 'ahead' && to === 'level') return `Con ${played} il vantaggio di ${mover} sfuma: con ${best} restava dalla sua parte.`;
  if (from === 'ahead') return `Con ${played} la partita si capovolge a favore di ${other}: con ${best} ${mover} restava avanti.`;
  return `Con ${played} la partita gira a favore di ${other}: ${best} teneva l'equilibrio.`;
}

export function bestText(b: AnalysisMoment, names: Names): string {
  const mover = names[b.color];
  // How much worse the next best was: the only move, a clear one, or just the most precise
  const gap = b.gap ?? 0;
  const which = gap >= 20 ? "l'unica mossa che" : gap >= 10 ? 'la mossa che' : 'la mossa giusta, che';
  const keeps = { ahead: 'tiene il vantaggio', level: "tiene l'equilibrio", behind: 'tiene aperta la partita' }[standing(b.after)];
  return `${mover} trova ${italianSan(b.san)}, ${which} ${keeps}.`;
}

// The moments in the order they were played: the story of the game
export function momentsOf(a: GameAnalysis, names: Names): MomentText[] {
  const turns = (a.turns ?? []).map((t) => ({ key: `t${t.ply}`, kind: 'turn' as const, title: `${moveLabel(t.ply, t.san)} · La svolta`, text: turnText(t, names), moment: t }));
  const best = (a.best ?? []).map((b) => ({
    key: `b${b.ply}`,
    kind: 'best' as const,
    title: `${moveLabel(b.ply, b.san)} · La mossa di ${names[b.color]}`,
    text: bestText(b, names),
    moment: b,
  }));
  return [...turns, ...best].sort((x, y) => x.moment.ply - y.moment.ply);
}

// One line over the moments: a game with no sudden turn, or one that went back and forth
export function storyLine(a: GameAnalysis): string | undefined {
  const swings = a.swings ?? a.turns?.length ?? 0;
  if (swings === 0) return 'Nessuna svolta improvvisa: la partita è cambiata poco a poco.';
  if (swings > (a.turns?.length ?? 0)) return `Una partita sulle montagne russe: ${swings} svolte, ecco le più grandi.`;
  return undefined;
}

// The squares of a move in UCI ("e2e4", "e7e8q")
export function squaresOf(uci?: string): { from: string; to: string } | undefined {
  const m = uci?.match(/^([a-h][1-8])([a-h][1-8])/);
  return m ? { from: m[1], to: m[2] } : undefined;
}
