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

// Something to tell: a moment, or at least the phases of the game
export const hasMoments = (a?: GameAnalysis) => !!a && ((a.turns?.length ?? 0) + (a.best?.length ?? 0) > 0 || !!a.finish || !!a.phases?.middle);

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
  kind: 'turn' | 'best' | 'finish';
  title: string;
  text: string;
  moment: AnalysisMoment;
}

type Names = { white: string; black: string };
type Color = 'white' | 'black';
const otherOf = (c: Color): Color => (c === 'white' ? 'black' : 'white');

export function turnText(t: AnalysisMoment, names: Names): string {
  const mover = names[t.color];
  const other = names[otherOf(t.color)];
  const played = italianSan(t.san);
  const best = italianSan(t.bestSan ?? '');
  const from = standing(t.before ?? 50);
  const to = standing(t.after ?? 50);
  if (from === 'ahead' && to === 'level') return `Con ${played} il vantaggio di ${mover} sfuma: con ${best} restava dalla sua parte.`;
  if (from === 'ahead') return `Con ${played} la partita si capovolge a favore di ${other}: con ${best} ${mover} restava avanti.`;
  return `Con ${played} la partita gira a favore di ${other}: ${best} teneva l'equilibrio.`;
}

export function bestText(b: AnalysisMoment, names: Names): string {
  const mover = names[b.color];
  // How much worse the next best was: the only move, a clear one, or just the most precise
  const gap = b.gap ?? 0;
  const which = gap >= 20 ? "l'unica mossa che" : gap >= 10 ? 'la mossa che' : 'la mossa giusta, che';
  const keeps = { ahead: 'tiene il vantaggio', level: "tiene l'equilibrio", behind: 'tiene aperta la partita' }[standing(b.after ?? 50)];
  return `${mover} trova ${italianSan(b.san)}, ${which} ${keeps}.`;
}

// The moments in the order they were played: the turns, the best moves and the final blow
export function momentsOf(a: GameAnalysis, names: Names): MomentText[] {
  const turns = (a.turns ?? []).map((t) => ({ key: `t${t.ply}`, kind: 'turn' as const, title: `${moveLabel(t.ply, t.san)} · La svolta`, text: turnText(t, names), moment: t }));
  const finish = a.finish
    ? [{ key: `f${a.finish.ply}`, kind: 'finish' as const, title: `${moveLabel(a.finish.ply, a.finish.san)} · Scacco matto`, text: `${names[a.finish.color]} chiude la partita con ${italianSan(a.finish.san)}.`, moment: a.finish }]
    : [];
  const best = (a.best ?? [])
    // The checkmate is told as the final blow
    .filter((b) => b.ply !== a.finish?.ply)
    .map((b) => ({ key: `b${b.ply}`, kind: 'best' as const, title: `${moveLabel(b.ply, b.san)} · La mossa di ${names[b.color]}`, text: bestText(b, names), moment: b }));
  return [...turns, ...best, ...finish].sort((x, y) => x.moment.ply - y.moment.ply);
}

// Who is better from White's chances, in five steps: clearly, a little, or nobody
type Lead = { who?: Color; size: 0 | 1 | 2 };
function leadOf(white: number): Lead {
  if (white >= 70) return { who: 'white', size: 2 };
  if (white >= 58) return { who: 'white', size: 1 };
  if (white > 42) return { size: 0 };
  if (white > 30) return { who: 'black', size: 1 };
  return { who: 'black', size: 2 };
}

// How the game went over a phase, from how it stood at its start to how it stood at its end: told by
// who gained, never by who lost ground
export function phaseText(phase: string, from: number, to: number, names: Names): string {
  const a = leadOf(from);
  const b = leadOf(to);
  if (!b.who) {
    if (!a.who) return `${phase} la partita resta in equilibrio.`;
    return `${phase} ${names[otherOf(a.who)]} rimette la partita in equilibrio.`;
  }
  const x = names[b.who];
  if (!a.who) return b.size === 2 ? `${phase} ${x} prende il vantaggio.` : `${phase} ${x} si porta un po' avanti.`;
  if (a.who !== b.who) return `${phase} ${x} ribalta la partita.`;
  if (b.size > a.size) return `${phase} ${x} allunga.`;
  if (b.size < a.size) return `${phase} ${names[otherOf(b.who)]} accorcia le distanze.`;
  return b.size === 2 ? `${phase} ${x} conserva il vantaggio.` : `${phase} ${x} conserva un piccolo vantaggio.`;
}

export function openingText(white: number, names: Names): string {
  const l = leadOf(white);
  if (!l.who) return "Si esce dall'apertura in equilibrio.";
  return l.size === 2 ? `${names[l.who]} esce dall'apertura in vantaggio.` : `${names[l.who]} esce dall'apertura un po' meglio.`;
}

// How the game ended, from Lichess' status
export function endingText(status: string | undefined, winner: Color | undefined, plies: number, names: Names): string | undefined {
  const n = Math.ceil(plies / 2);
  const loser = winner ? names[otherOf(winner)] : undefined;
  if (status === 'mate') return `Scacco matto alla mossa ${n}.`;
  if (status === 'resign' && loser) return `${loser} abbandona alla mossa ${n}.`;
  if ((status === 'outoftime' || status === 'timeout') && loser) return `Alla mossa ${n} scade il tempo di ${loser}.`;
  if (status === 'stalemate') return `Stallo alla mossa ${n}: patta.`;
  if (status === 'draw') return `Patta alla mossa ${n}.`;
  return undefined;
}

export interface PhaseStory {
  key: 'opening' | 'middlegame' | 'endgame' | 'game';
  title?: string;
  text?: string;
  moments: MomentText[];
}

export interface GameStory {
  intro?: string;
  phases: PhaseStory[];
  ending?: string;
}

// The whole game told phase by phase: how each phase went and its moments, then how it ended.
// Without the phases (none reached, or an analysis without them) the moments in one list.
export function storyOf(a: GameAnalysis, names: Names, state?: { status?: string; winner?: Color }): GameStory {
  const curve = a.curve ?? [];
  const last = curve.length - 1;
  const moments = momentsOf(a, names);
  const swings = a.swings ?? a.turns?.length ?? 0;
  const intro =
    swings === 0
      ? 'Nessuna svolta improvvisa: la partita è cambiata poco a poco.'
      : swings >= 4
        ? `Una partita sulle montagne russe: ${swings} svolte.`
        : undefined;
  // A checkmate is told by the final blow
  const ending = a.finish ? undefined : endingText(state?.status, state?.winner, last, names);
  const middle = a.phases?.middle;
  const end = a.phases?.end;
  if (!middle || middle >= last || last < 1) return { intro, phases: [{ key: 'game', moments }], ending };
  const within = (from: number, to: number) => moments.filter((m) => m.moment.ply > from && m.moment.ply <= to);
  const phases: PhaseStory[] = [{ key: 'opening', title: "L'apertura", text: openingText(curve[middle], names), moments: within(0, middle) }];
  const middleEnd = end && end > middle && end < last ? end : last;
  phases.push({ key: 'middlegame', title: 'Il mediogioco', text: phaseText('Nel mediogioco', curve[middle], curve[middleEnd], names), moments: within(middle, middleEnd) });
  if (middleEnd < last) {
    phases.push({ key: 'endgame', title: 'Il finale', text: phaseText('Nel finale', curve[middleEnd], curve[last], names), moments: within(middleEnd, last) });
  }
  return { intro, phases, ending };
}

// The squares of a move in UCI ("e2e4", "e7e8q")
export function squaresOf(uci?: string): { from: string; to: string } | undefined {
  const m = uci?.match(/^([a-h][1-8])([a-h][1-8])/);
  return m ? { from: m[1], to: m[2] } : undefined;
}
