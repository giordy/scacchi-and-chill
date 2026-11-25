import { AnalysisMoment, GameAnalysis, HistoryGame } from '../types';
import { extractGameId } from './utils';

// The key moments of a finished game, as the replay tells them. The GitHub Action analyses each
// game once with Stockfish (scripts/analyse-games.mjs, scripts/analysis.mjs); here the moments become
// words. In the spirit of the site: the moves where the game turned and each player's best move,
// told kindly, with no list of mistakes and no accuracy figures.

// The versions of scripts/analysis.mjs (ANALYSIS_VERSION) whose moments this page knows how to tell:
// the same data, analysed again with a newer engine
const VERSIONS = new Set([1, 2, 3, 4, 5]);

// The analysis of the game behind the current link; none for an old link, a skipped game, a version
// this page does not know, or a result decided by the organizer (the story would tell another end)
export function analysisOf(game: Pick<HistoryGame, 'url' | 'analysis' | 'decision'>): GameAnalysis | undefined {
  const a = game.analysis;
  if (!a || game.decision || !VERSIONS.has(a.v) || a.skipped || !Array.isArray(a.curve) || !a.curve.every(isNumber)) return undefined;
  const id = extractGameId(game.url);
  return id && a.id !== id ? undefined : sane(a);
}

// What the page reads from Firestore, kept to what it can tell: a moment missing its move, its
// position or its side (a save cut short, a version to come) is left out, the rest shown
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isMoment = (m: unknown): m is AnalysisMoment => {
  const x = m as AnalysisMoment | null;
  return !!x && isNumber(x.ply) && typeof x.san === 'string' && typeof x.uci === 'string' && typeof x.fen === 'string' && (x.color === 'white' || x.color === 'black');
};
const moments = (list: unknown) => (Array.isArray(list) ? list.filter(isMoment) : []);
function sane(a: GameAnalysis): GameAnalysis {
  const streaks = Array.isArray(a.streaks)
    ? a.streaks.filter((s) => !!s && (s.color === 'white' || s.color === 'black') && isNumber(s.from) && isNumber(s.to) && isNumber(s.moves))
    : [];
  const phases = a.phases && typeof a.phases === 'object' ? { middle: isNumber(a.phases.middle) ? a.phases.middle : undefined, end: isNumber(a.phases.end) ? a.phases.end : undefined } : undefined;
  return {
    ...a,
    turns: moments(a.turns),
    best: moments(a.best),
    chances: moments(a.chances),
    promotions: moments(a.promotions),
    missed: moments(a.missed),
    finish: isMoment(a.finish) ? a.finish : undefined,
    streaks,
    phases,
  };
}

// Something to tell: a moment, or at least the phases of the game
export const hasMoments = (a?: GameAnalysis) =>
  !!a && ((a.turns?.length ?? 0) + (a.best?.length ?? 0) + (a.promotions?.length ?? 0) + (a.missed?.length ?? 0) + (a.chances?.length ?? 0) > 0 || !!a.finish || !!a.phases?.middle);

// The pieces as figurines, as Lichess writes them: ♔ ♕ ♖ ♗ ♘, the same outline for both sides (the
// move number says whose), clear to anyone and free of the Italian letters' trap (R is the king, not
// the rook). Each is followed by U+FE0E, which asks for the plain glyph: some phones draw these
// symbols as coloured emoji otherwise. Squares and castling stay as they are.
const FIGURINES: Record<string, string> = { K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658' };
export const figurineSan = (san: string) => (san ?? '').replace(/[KQRBN]/g, (p) => `${FIGURINES[p]}\uFE0E`);

// "23. Cxe5" for White, "23... Cxe5" for Black
export function moveLabel(ply: number, san: string): string {
  const n = Math.ceil(ply / 2);
  return `${n}${ply % 2 === 1 ? '.' : '...'} ${figurineSan(san)}`;
}

// How a player stands from their own chances: ahead, level, behind (the same lines as the script)
type Standing = 'ahead' | 'level' | 'behind';
const standing = (p: number): Standing => (p >= 70 ? 'ahead' : p > 30 ? 'level' : 'behind');

export interface MomentText {
  key: string;
  kind: 'turn' | 'best' | 'finish' | 'promotion' | 'missed' | 'chance';
  title: string;
  text: string;
  moment: AnalysisMoment;
}

type Names = { white: string; black: string };
type Color = 'white' | 'black';
const otherOf = (c: Color): Color => (c === 'white' ? 'black' : 'white');

// What the page knows of the game around a moment, to tell it in context and in varied words
export interface StoryContext {
  seed: number; // from the game: the same game always reads the same
  curve: number[];
  turns: AnalysisMoment[];
}

const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(list: T[], seed: number): T => list[seed % list.length];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// "a Bruno", "ad Anna"
const toName = (name: string) => (/^a/i.test(name) ? `ad ${name}` : `a ${name}`);

const PIECES_IT: Record<string, { the: string; name: string; value: number }> = {
  p: { the: 'il pedone', name: 'pedone', value: 1 },
  n: { the: 'il cavallo', name: 'cavallo', value: 3 },
  b: { the: "l'alfiere", name: 'alfiere', value: 3 },
  r: { the: 'la torre', name: 'torre', value: 5 },
  q: { the: 'la donna', name: 'donna', value: 9 },
  k: { the: 'il re', name: 're', value: 0 },
};
const the = (piece?: string) => PIECES_IT[piece ?? '']?.the ?? 'il pezzo';

// Material won along a line, in words
export function materialText(gain: number): string {
  if (gain >= 5) return 'molto materiale';
  if (gain >= 3) return 'un pezzo';
  if (gain === 2) return 'due pedoni';
  return 'un pedone';
}

// Full moves of balance right before a ply
function levelMovesBefore(curve: number[], ply: number): number {
  let n = 0;
  for (let i = ply - 1; i >= 0 && curve[i] > 30 && curve[i] < 70; i--) n++;
  return Math.floor(n / 2);
}

const ownChances = (color: Color, white: number) => (color === 'white' ? white : 100 - white);

// A turn: how the game changed with the move played, why (the answer that punished it and what it
// won, or a mate), and the move that held. Without the facts (an older analysis), in plain words.
export function turnText(t: AnalysisMoment, names: Names, ctx?: StoryContext): string {
  const mover = names[t.color];
  const other = names[otherOf(t.color)];
  const played = figurineSan(t.san);
  const best = figurineSan(t.bestSan ?? '');
  const from = standing(t.before ?? 50);
  const to = standing(t.after ?? 50);
  // The point of no return: how the player stands has not changed yet, the game starts turning
  const starts = from === to;
  if (!t.move || !ctx) {
    if (starts) return from === 'ahead' ? `Con ${played} il vantaggio di ${mover} comincia a sfumare: ${best} lo teneva.` : `Con ${played} la partita comincia a girare a favore di ${other}: ${best} teneva l'equilibrio.`;
    if (from === 'ahead' && to === 'level') return `Con ${played} il vantaggio di ${mover} sfuma: con ${best} restava dalla sua parte.`;
    if (from === 'ahead') return `Con ${played} la partita si capovolge a favore di ${other}: con ${best} ${mover} restava avanti.`;
    return `Con ${played} la partita gira a favore di ${other}: ${best} teneva l'equilibrio.`;
  }
  const seed = ctx.seed + t.ply;
  const calm = levelMovesBefore(ctx.curve, t.ply);
  const lead = from === 'level' && calm >= 10 ? `dopo ${calm} mosse di equilibrio, ` : '';
  const head = starts
    ? from === 'ahead'
      ? pick([`con ${played} il vantaggio di ${mover} comincia a sfumare`, `la mossa ${played} rimette in gioco ${other}`], seed)
      : pick([`con ${played} la partita comincia a girare a favore di ${other}`, `la mossa ${played} dà a ${other} la strada giusta`], seed)
    : from === 'ahead' && to === 'level'
      ? pick([`con ${played} il vantaggio di ${mover} sfuma`, `la mossa ${played} lascia sfumare il vantaggio di ${mover}`], seed)
      : from === 'ahead'
        ? pick([`con ${played} la partita si capovolge`, `la mossa ${played} capovolge la partita`], seed)
        : pick([`con ${played} la partita gira a favore di ${other}`, `la mossa ${played} apre la porta ${toName(other)}`, `con ${played} la bilancia pende verso ${other}`], seed);
  let why = '';
  const reply = t.reply ? figurineSan(t.reply.san) : '';
  // The engine's answer, not always the one played: then told as what could have been
  const could = t.reply?.played === false;
  const takesPiece = t.reply?.capture && t.gain && (PIECES_IT[t.reply.capture]?.value ?? 0) >= Math.min(t.gain, 9) - 1;
  if (t.mate && t.mate <= 6) {
    why = could
      ? `${other} aveva un matto in ${t.mate}, a cominciare da ${reply}`
      : reply
        ? `${other} ha un matto in ${t.mate}, a cominciare da ${reply}`
        : `${other} ha un matto in ${t.mate}`;
  } else if (reply && t.gain && t.gain >= 1) {
    if (could) why = `${other} poteva rispondere ${reply} e ${takesPiece ? `prendere ${the(t.reply?.capture)} in ${t.reply?.to}` : `guadagnare ${materialText(t.gain)}`}`;
    else {
      const taken = takesPiece ? `prende ${the(t.reply?.capture)} in ${t.reply?.to}` : `guadagna ${materialText(t.gain)}`;
      why = pick([`${other} risponde ${reply} e ${taken}`, `arriva ${reply}, e ${other} ${taken}`], seed);
    }
  } else if (reply) {
    why = could
      ? pick([`${other} poteva rispondere ${reply} e prendere l'iniziativa`, `con ${reply} la posizione di ${other} sarebbe stata migliore`], seed)
      : pick([`${other} risponde ${reply} e prende l'iniziativa`, `dopo ${reply} la posizione di ${other} è migliore`], seed);
  }
  const hold =
    from === 'ahead' && (to === 'level' || starts)
      ? pick([`Con ${best} il vantaggio restava ${toName(mover)}.`, `${best} avrebbe conservato il vantaggio.`], seed)
      : from === 'ahead'
        ? pick([`Con ${best} ${mover} restava avanti.`, `${best} teneva ${mover} in vantaggio.`], seed)
        : pick([`${best} teneva l'equilibrio.`, `Con ${best} la partita restava in equilibrio.`, `Meglio era ${best}, che teneva la posizione.`], seed);
  // Every head begins with a plain word ("con", "la mossa"), never with a move or a name
  return `${capitalize(lead + head)}${why ? `: ${why}` : ''}. ${hold}`;
}

// A best move: what kind of move it was (a sacrifice, a check, a capture…), what it wins or what
// any other move would have cost, and when it came (right after the opponent's turn, from behind).
// Without the facts (an older analysis), by how much worse the next best was.
export function bestText(b: AnalysisMoment, names: Names, ctx?: StoryContext): string {
  const mover = names[b.color];
  const san = figurineSan(b.san);
  // How much worse the next best was: the only move, a clear one, or just the most precise
  const gap = b.gap ?? 0;
  const which = gap >= 20 ? "l'unica mossa che" : gap >= 10 ? 'la mossa che' : 'la mossa giusta, che';
  const keeps = { ahead: 'tiene il vantaggio', level: "tiene l'equilibrio", behind: 'tiene aperta la partita' }[standing(b.after ?? 50)];
  if (!b.move || !ctx) return `${mover} trova ${san}, ${which} ${keeps}.`;
  const seed = ctx.seed + b.ply;
  const other = names[otherOf(b.color)];
  // Right after the opponent's turn: the chance taken; or a player who was behind and is back
  const punishes = ctx.turns.some((t) => t.ply === b.ply - 1 && t.color !== b.color);
  const back = !punishes && standing(b.after ?? 50) !== 'behind' && ctx.curve.slice(0, b.ply).some((w) => ownChances(b.color, w) <= 30);
  const lead = punishes ? pick([`${mover} non perdona: `, `${mover} coglie l'occasione: `], seed) : back ? 'Senza mollare, ' : '';
  const m = b.move;
  let act: string;
  if (b.sacrifice) act = pick([`sacrifica materiale con ${san}`, `${san}, un sacrificio`], seed);
  else if (m.castle) act = `arrocca al momento giusto, ${san}`;
  else if (m.promotion) act = `promuove: ${san}`;
  else if (m.capture && m.check) act = `prende ${the(m.capture)} con scacco, ${san}`;
  else if (m.capture) act = `prende ${the(m.capture)} con ${san}`;
  else if (m.check) act = `dà scacco con ${san}`;
  else act = pick([`trova ${san}`, `gioca ${san}`], seed);
  let why: string;
  const captured = m.capture ? (PIECES_IT[m.capture]?.value ?? 0) : 0;
  if (b.mate && b.mate <= 8) why = ` e avvia un matto in ${b.mate}`;
  else if (b.gain && b.gain >= 2 && b.gain > captured + 1) why = ` e guadagna ${materialText(b.gain)}`;
  // The mate in so many moves is the next best's only: the others may mate sooner
  else if (b.alt?.mate) why = `: ogni altra mossa lasciava ${toName(other)} il matto`;
  else if (b.alt?.gain && b.alt.gain >= 2) why = `: ogni altra mossa costava ${materialText(b.alt.gain)}`;
  else why = `, ${which} ${keeps}`;
  // After "non perdona:" the player is named already; names are written as they are
  return `${lead}${punishes ? '' : `${mover} `}${act}${why}.`;
}

// The final blow: the checkmate, told by the piece that gives it
export function finishText(f: AnalysisMoment, names: Names, ctx?: StoryContext): string {
  const mover = names[f.color];
  const san = figurineSan(f.san);
  if (!f.move || !ctx) return `${mover} chiude la partita con ${san}.`;
  // Castling or a promotion: the piece that mates is not the one that moved
  if (f.move.castle) return `${mover} arrocca e chiude la partita: ${san}.`;
  if (f.move.promotion) return `${mover} promuove in ${f.move.to} e chiude la partita: ${san}.`;
  // The title says "Scacco matto" already
  return pick([`${capitalize(the(f.move.piece))} di ${mover} arriva in ${f.move.to} e chiude la partita.`, `${mover} chiude la partita con ${the(f.move.piece)} in ${f.move.to}.`], ctx.seed + f.ply);
}

// A promotion: the pawn that becomes a queen (or another piece), told as a milestone
export function promotionText(p: AnalysisMoment, names: Names): string {
  const piece = PIECES_IT[p.uci.charAt(4)]?.name ?? 'donna';
  return `Il pedone di ${names[p.color]} arriva in ${p.uci.slice(2, 4)} e diventa ${piece}.`;
}

// A mate missed, and whether the player won all the same
export function missedText(m: AnalysisMoment, names: Names): string {
  const mover = names[m.color];
  const best = figurineSan(m.bestSan ?? '');
  const mate = m.mate === 1 ? 'un matto in una mossa' : `un matto in ${m.mate}`;
  return `Qui ${mover} aveva ${mate} con ${best}, al posto di ${figurineSan(m.san)}${m.won ? ': ha vinto lo stesso' : ''}.`;
}

// A chance given to the opponent, and whether they took it: with the answer that took it, when it
// was the engine's, and the move that was more solid
export function chanceText(c: AnalysisMoment, names: Names, ctx?: StoryContext): string {
  const mover = names[c.color];
  const other = names[otherOf(c.color)];
  const played = figurineSan(c.san);
  const best = figurineSan(c.bestSan ?? '');
  const reply = c.reply ? figurineSan(c.reply.san) : '';
  const seed = (ctx?.seed ?? 0) + c.ply;
  // Begins with a plain word, never a move or a name
  const head = pick([`con ${played} ${mover} lascia un'occasione ${toName(other)}`, `la mossa ${played} dà un'occasione ${toName(other)}`], seed);
  // No outcome when the game ended right after
  const outcome = c.taken === undefined
    ? ''
    : c.taken
    ? c.reply?.played
      ? `, che la coglie con ${reply}`
      : `, che la sfrutta`
    : reply
      ? `, che però non la sfrutta: la risposta giusta era ${reply}`
      : `, che però non la sfrutta`;
  return `${capitalize(head)}${outcome}. Meglio era ${best}.`;
}

// The moments in the order they were played: the turns, the best moves, the promotions, the mates
// missed and the final blow
export function momentsOf(a: GameAnalysis, names: Names): MomentText[] {
  const ctx: StoryContext = { seed: hashOf(a.id ?? ''), curve: a.curve ?? [], turns: a.turns ?? [] };
  const turns = (a.turns ?? []).map((t) => ({ key: `t${t.ply}`, kind: 'turn' as const, title: `${moveLabel(t.ply, t.san)} · La svolta`, text: turnText(t, names, ctx), moment: t }));
  const finish = a.finish
    ? [{ key: `f${a.finish.ply}`, kind: 'finish' as const, title: `${moveLabel(a.finish.ply, a.finish.san)} · Scacco matto`, text: finishText(a.finish, names, ctx), moment: a.finish }]
    : [];
  const best = (a.best ?? [])
    // The checkmate is told as the final blow
    .filter((b) => b.ply !== a.finish?.ply)
    .map((b) => ({ key: `b${b.ply}`, kind: 'best' as const, title: `${moveLabel(b.ply, b.san)} · La mossa di ${names[b.color]}`, text: bestText(b, names, ctx), moment: b }));
  const chances = (a.chances ?? []).map((c) => ({ key: `c${c.ply}`, kind: 'chance' as const, title: `${moveLabel(c.ply, c.san)} · L'occasione`, text: chanceText(c, names, ctx), moment: c }));
  const taken = new Set([...turns, ...best, ...finish, ...chances].map((m) => m.moment.ply));
  const promotions = (a.promotions ?? [])
    .filter((p) => !taken.has(p.ply))
    .map((p) => ({ key: `p${p.ply}`, kind: 'promotion' as const, title: `${moveLabel(p.ply, p.san)} · La promozione`, text: promotionText(p, names), moment: p }));
  const missed = (a.missed ?? [])
    .filter((m) => !taken.has(m.ply))
    .map((m) => ({ key: `m${m.ply}`, kind: 'missed' as const, title: `${moveLabel(m.ply, m.san)} · Il matto nascosto`, text: missedText(m, names), moment: m }));
  return [...turns, ...best, ...chances, ...promotions, ...missed, ...finish].sort((x, y) => x.moment.ply - y.moment.ply);
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

// How the game ended, from Lichess' status; with White's chances in the final position, an ending
// the board did not ask for is said: a resignation with the game still open, time running out on
// a player who was ahead, a draw agreed by a player ahead
export function endingText(status: string | undefined, winner: Color | undefined, plies: number, names: Names, finalWhite?: number): string | undefined {
  const n = Math.ceil(plies / 2);
  const loserColor = winner ? otherOf(winner) : undefined;
  const loser = loserColor ? names[loserColor] : undefined;
  const loserChances = loserColor && finalWhite !== undefined ? ownChances(loserColor, finalWhite) : undefined;
  if (status === 'mate') return `Scacco matto alla mossa ${n}.`;
  if (status === 'resign' && loser) {
    if (loserChances !== undefined && loserChances >= 40) return `${loser} abbandona alla mossa ${n}, con la partita ancora aperta.`;
    return `${loser} abbandona alla mossa ${n}.`;
  }
  if ((status === 'outoftime' || status === 'timeout') && loser) {
    if (loserChances !== undefined && loserChances >= 70) return `Alla mossa ${n} scade il tempo di ${loser}, che era in vantaggio.`;
    if (loserChances !== undefined && loserChances > 30) return `Alla mossa ${n} scade il tempo di ${loser}, con la partita ancora in equilibrio.`;
    return `Alla mossa ${n} scade il tempo di ${loser}.`;
  }
  if (status === 'stalemate') return `Stallo alla mossa ${n}: patta.`;
  if (status === 'draw') {
    const ahead = finalWhite === undefined ? undefined : finalWhite >= 70 ? 'white' : finalWhite <= 30 ? 'black' : undefined;
    return ahead ? `Patta alla mossa ${n}, anche se ${names[ahead]} era in vantaggio.` : `Patta alla mossa ${n}.`;
  }
  return undefined;
}

// The longest streak of each player: moves in a row as good as the engine's
export function streakText(s: { color: Color; from: number; to: number; moves: number }, names: Names): string {
  return `${names[s.color]} gioca ${s.moves} mosse di fila come il motore, dalla mossa ${Math.ceil(s.from / 2)} alla ${Math.ceil(s.to / 2)}.`;
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
  streaks: string[];
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
  const ending = a.finish ? undefined : endingText(state?.status, state?.winner, last, names, curve[last]);
  const streaks = (a.streaks ?? []).map((s) => streakText(s, names));
  const middle = a.phases?.middle;
  const end = a.phases?.end;
  if (!middle || middle >= last || last < 1) return { intro, phases: [{ key: 'game', moments }], streaks, ending };
  const within = (from: number, to: number) => moments.filter((m) => m.moment.ply > from && m.moment.ply <= to);
  const phases: PhaseStory[] = [{ key: 'opening', title: "L'apertura", text: openingText(curve[middle], names), moments: within(0, middle) }];
  const middleEnd = end && end > middle && end < last ? end : last;
  phases.push({ key: 'middlegame', title: 'Il mediogioco', text: phaseText('Nel mediogioco', curve[middle], curve[middleEnd], names), moments: within(middle, middleEnd) });
  if (middleEnd < last) {
    phases.push({ key: 'endgame', title: 'Il finale', text: phaseText('Nel finale', curve[middleEnd], curve[last], names), moments: within(middleEnd, last) });
  }
  return { intro, phases, streaks, ending };
}

// The squares of a move in UCI ("e2e4", "e7e8q")
export function squaresOf(uci?: string): { from: string; to: string } | undefined {
  const m = uci?.match(/^([a-h][1-8])([a-h][1-8])/);
  return m ? { from: m[1], to: m[2] } : undefined;
}
