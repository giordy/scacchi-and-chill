import { describe, expect, it } from 'vitest';
// @ts-expect-error a Node script without types
import { ANALYSIS_VERSION, keyMoments, needsAnalysis, phasesOf, winPercent } from '../../../scripts/analysis.mjs';
// @ts-expect-error a Node script without types
import { parseSearch } from '../../../scripts/analyse-games.mjs';
// @ts-expect-error a Node script without types
import { gameIdOf } from '../../../scripts/sync-results.mjs';
import { analysisOf, bestText, endingText, finishText, figurineSan, hasMoments, materialText, momentsOf, moveLabel, openingText, phaseText, squaresOf, storyOf, StoryContext, turnText } from '../analysis';
import { AnalysisMoment, GameAnalysis } from '../../types';

const moves20 = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7';
const finished = (extra = {}) => ({
  url: 'https://lichess.org/AbCd1234',
  lichess: { id: 'AbCd1234', status: 'resign', winner: 'white', moves: moves20, variant: 'standard' },
  ...extra,
});

// A ply for keyMoments: White's chances after the engine's best move here, and after its second
type Ply = { san: string; uci: string; color: 'white' | 'black'; fen: string; best: { uci: string; san: string; white: number }; second?: { white: number } };
function plies(curve: number[], extra: Record<number, Partial<Ply>> = {}): Ply[] {
  return curve.map((w, i) => ({
    san: `m${i + 1}`,
    uci: `a2a${(i % 6) + 3}`,
    color: i % 2 === 0 ? 'white' : 'black',
    fen: `fen${i}`,
    best: { uci: `h2h${(i % 6) + 3}`, san: `b${i + 1}`, white: w },
    ...extra[i],
  }));
}

describe('which games wait for their analysis', () => {
  it('analyses a finished standard game once, for the current link', () => {
    expect(needsAnalysis(finished(), gameIdOf)).toBe(true);
    expect(needsAnalysis(finished({ analysis: { v: ANALYSIS_VERSION, id: 'AbCd1234' } }), gameIdOf)).toBe(false);
    // a new link, or a new way of choosing the moments: analysed again
    expect(needsAnalysis(finished({ analysis: { v: ANALYSIS_VERSION, id: 'Zzzz9999' } }), gameIdOf)).toBe(true);
    expect(needsAnalysis(finished({ analysis: { v: ANALYSIS_VERSION - 1, id: 'AbCd1234' } }), gameIdOf)).toBe(true);
  });

  it('leaves out games with nothing to tell', () => {
    const state = finished().lichess;
    expect(needsAnalysis(finished({ lichess: { ...state, status: 'started' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, status: 'cheat' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, status: 'aborted' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, variant: 'chess960' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, moves: 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ decision: { result: '1-0' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis({ url: '', lichess: undefined }, gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, status: 'noStart' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, status: 'unknownFinish' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, variant: 'fromPosition' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ lichess: { ...state, moves: '' } }), gameIdOf)).toBe(false);
  });

  it('analyses every other way a game can end, and a game with no variant written', () => {
    const state = finished().lichess;
    for (const status of ['mate', 'resign', 'outoftime', 'timeout', 'draw', 'stalemate']) {
      expect(needsAnalysis(finished({ lichess: { ...state, status } }), gameIdOf)).toBe(true);
    }
    expect(needsAnalysis(finished({ lichess: { ...state, variant: undefined } }), gameIdOf)).toBe(true);
    // exactly the shortest game told, and one move short of it
    const plies = moves20.split(' ');
    expect(needsAnalysis(finished({ lichess: { ...state, moves: plies.slice(0, 16).join(' ') } }), gameIdOf)).toBe(true);
    expect(needsAnalysis(finished({ lichess: { ...state, moves: plies.slice(0, 15).join(' ') } }), gameIdOf)).toBe(false);
  });

  it('does not try again moves that made no game, until the next version; a game with no link goes by its Lichess id', () => {
    expect(needsAnalysis(finished({ analysis: { v: ANALYSIS_VERSION, id: 'AbCd1234', skipped: 'moves' } }), gameIdOf)).toBe(false);
    expect(needsAnalysis(finished({ analysis: { v: ANALYSIS_VERSION - 1, id: 'AbCd1234', skipped: 'moves' } }), gameIdOf)).toBe(true);
    expect(needsAnalysis(finished({ url: '', analysis: { v: ANALYSIS_VERSION, id: 'AbCd1234' } }), gameIdOf)).toBe(false);
  });
});

describe('the engine', () => {
  it('turns scores into winning chances as Lichess does', () => {
    expect(winPercent({ cp: 0 })).toBe(50);
    expect(winPercent({ cp: 300 })).toBeCloseTo(75, 0);
    expect(winPercent({ cp: 5000 })).toBe(winPercent({ cp: 1000 }));
    expect(winPercent({ mate: 3 })).toBe(100);
    expect(winPercent({ mate: -2 })).toBe(0);
  });

  it("reads the two best lines from White's side", () => {
    const out = [
      'info depth 10 seldepth 12 multipv 1 score cp 40 nodes 100 pv e2e4 e7e5',
      'info depth 10 seldepth 12 multipv 2 score cp 10 nodes 100 pv d2d4',
      'info depth 11 seldepth 14 multipv 1 score cp -35 lowerbound nodes 900 pv g8f6 b1c3',
      'info depth 11 seldepth 14 multipv 2 score mate -4 nodes 900 pv f7f6',
      'bestmove g8f6 ponder b1c3',
    ];
    expect(parseSearch(out, false)).toEqual([
      { score: { cp: 35 }, uci: 'g8f6', pv: ['g8f6', 'b1c3'] },
      { score: { mate: 4 }, uci: 'f7f6', pv: ['f7f6'] },
    ]);
    expect(parseSearch(out.slice(0, 1), true)).toEqual([{ score: { cp: 40 }, uci: 'e2e4', pv: ['e2e4', 'e7e5'] }]);
  });
});

describe('the key moments', () => {
  it('finds the moves where a player goes from level to behind, or from ahead to level', () => {
    // A White move drops White from level to behind; later a Black move throws away Black's lead
    const curve = [50, 50, 50, 50, 50, 20, 20, 20, 20, 20, 50, 50];
    const a = keyMoments(plies(curve.slice(0, -1)), curve[curve.length - 1]);
    expect(a.curve).toEqual(curve);
    expect(a.turns.map((t: AnalysisMoment) => [t.ply, t.color, t.before, t.after, t.bestSan])).toEqual([
      [5, 'white', 50, 20, 'b5'],
      [10, 'black', 80, 50, 'b10'],
    ]);
    expect(a.swings).toBe(2);
  });

  it('does not count a small step across the line, nor a move in a lost game', () => {
    // 72 -> 66 is a step across the line; 66 -> 5 a turn; 5 -> 0 a move in a lost game
    const curve = [50, 50, 50, 50, 50, 72, 72, 66, 66, 5, 5, 0];
    const a = keyMoments(plies(curve.slice(0, -1)), curve[curve.length - 1]);
    expect(a.turns.map((t: AnalysisMoment) => t.ply)).toEqual([9]);
  });

  it('tells two turns of the same player close together as one, and every other turn', () => {
    // White from ahead to level at ply 5, then from level to behind at ply 7: one moment, the bigger
    const curve = [80, 80, 80, 80, 80, 50, 50, 25, 25, 25];
    const a = keyMoments(plies(curve.slice(0, -1)), curve[curve.length - 1]);
    expect(a.turns.map((t: AnalysisMoment) => [t.ply, t.color])).toEqual([[5, 'white']]);
    expect(a.swings).toBe(1);
    // A game back and forth: every turn, in the order played
    const many = [50, 50, 50, 50, 50, 20, 20, 20, 20, 20, 50, 50, 50, 50, 50, 50, 50, 15, 15, 15, 15, 15, 50, 50, 50, 50, 50, 50, 50, 10, 10];
    const b = keyMoments(plies(many.slice(0, -1)), many[many.length - 1]);
    expect(b.swings).toBe(5);
    expect(b.turns.map((t: AnalysisMoment) => [t.ply, t.color, t.after])).toEqual([
      [5, 'white', 20],
      [10, 'black', 50],
      [17, 'white', 15],
      [22, 'black', 50],
      [29, 'white', 10],
    ]);
  });

  it("picks each player's best move: the engine's, where the next best was much worse, past the opening", () => {
    const curve = Array(14).fill(50);
    const extra = {
      // the opening: not counted however big the gap
      2: { second: { white: 10 } },
      // White plays as well as the engine, the next best loses a lot
      8: { second: { white: 30 } },
      // a smaller gap: not chosen over the bigger
      10: { second: { white: 42 } },
      // Black plays as well as the engine, the next best gives White 60
      11: { second: { white: 60 } },
    };
    const a = keyMoments(plies(curve, extra), 50);
    expect(a.best.map((b: AnalysisMoment) => [b.ply, b.color, b.gap])).toEqual([
      [9, 'white', 20],
      [12, 'black', 10],
    ]);
    // A second best move of the same player, far from the first, when it clearly mattered
    const long = Array(30).fill(50);
    const two = keyMoments(plies(long, { 8: { second: { white: 30 } }, 12: { second: { white: 44 } }, 24: { second: { white: 38 } } }), 50);
    expect(two.best.map((b: AnalysisMoment) => [b.ply, b.gap])).toEqual([
      [9, 20],
      [25, 12],
    ]);
    // A move worse than the engine's is no best move, however bad the next best
    const worse = plies([...curve.slice(0, 9), 40, ...curve.slice(10)], { 8: { second: { white: 0 } } });
    expect(keyMoments(worse, 50).best.map((b: AnalysisMoment) => b.ply)).not.toContain(9);
  });

  it('picks no best move where only one move was legal, nor in the opening, nor a second one too close', () => {
    const curve = Array(30).fill(50);
    // no second line: one legal move only
    expect(keyMoments(plies(curve, { 9: { second: undefined } }).map((p, i) => (i === 9 ? p : { ...p, second: undefined })), 50).best).toEqual([]);
    // the last ply of the opening is not counted, the first after it is
    expect(keyMoments(plies(curve, { 7: { second: { white: 10 } } }), 50).best).toEqual([]);
    expect(keyMoments(plies(curve, { 8: { second: { white: 10 } } }), 50).best.map((b: AnalysisMoment) => b.ply)).toEqual([9]);
    // two good moves of White eight plies apart: only the better is told
    const close = keyMoments(plies(curve, { 8: { second: { white: 20 } }, 16: { second: { white: 30 } } }), 50);
    expect(close.best.map((b: AnalysisMoment) => b.ply)).toEqual([9]);
  });

  it('caps the turns of a wild game, keeping the biggest and counting them all', () => {
    // Ten times White loses the balance and Black then throws the lead away, five plies apart
    const curve: number[] = [];
    for (let k = 0; k < 10; k++) curve.push(50, 50, 50, 50, 50, 20, 20, 20, 20, 20);
    curve.push(50);
    const a = keyMoments(plies(curve.slice(0, -1)), curve[curve.length - 1]);
    expect(a.swings).toBe(20);
    expect(a.turns.length).toBe(8);
    expect(new Set(a.turns.map((t: AnalysisMoment) => t.color))).toEqual(new Set(['white', 'black']));
    expect(a.turns.map((t: AnalysisMoment) => t.ply)).toEqual([...a.turns.map((t: AnalysisMoment) => t.ply)].sort((x, y) => x - y));
  });

  it('keeps the checkmate as the final blow', () => {
    const curve = Array(20).fill(50);
    const a = keyMoments(plies(curve, { 19: { san: 'Qxf7#', uci: 'd5f7' } }), 0, { mate: true });
    expect(a.finish).toEqual({ ply: 20, color: 'black', san: 'Qxf7#', uci: 'd5f7', fen: 'fen19' });
    expect(keyMoments(plies(curve), 50).finish).toBeUndefined();
  });

  it("finds the phases: Lichess' own, or from the pieces left", () => {
    expect(phasesOf({ middle: 18, end: 60 }, [])).toEqual({ middle: 18, end: 60 });
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    // White's back rank thins out: the middlegame; six pieces left: the endgame
    const developed = 'r1bqkb1r/pppppppp/2n2n2/8/2B1Q3/2N2N2/PPPPPPPP/R4RK1';
    const endgame = '4k3/pp3ppp/2n5/8/8/2N5/PP3PPP/2R1R1K1';
    expect(phasesOf(undefined, [start, start, developed, developed, endgame])).toEqual({ middle: 2, end: 4 });
    expect(phasesOf(undefined, [start, start])).toEqual({});
    // a long opening ends by move 15 at the latest
    expect(phasesOf(undefined, Array(40).fill(start))).toEqual({ middle: 30 });
    // Lichess' division with the endgame only: the middlegame starts there too
    expect(phasesOf({ end: 50 }, [])).toEqual({ middle: 50, end: 50 });
    expect(phasesOf({ middle: 20 }, [])).toEqual({ middle: 20 });
    // an empty division: from the pieces
    expect(phasesOf({}, [start, start])).toEqual({});
  });

  it('leaves out recaptures and games already decided', () => {
    const curve = Array(14).fill(50);
    const recapture = {
      8: { san: 'Nxe5', uci: 'f3e5' },
      9: { san: 'dxe5', uci: 'd6e5', best: { uci: 'd6e5', san: 'dxe5', white: 50 }, second: { white: 90 } },
    };
    expect(keyMoments(plies(curve, recapture), 50).best).toEqual([]);
    // nor taking a piece just moved there, a queen offered for a trade
    const trade = { 8: { san: 'Qf3', uci: 'd1f3' }, 9: { san: 'Qxf3', uci: 'g4f3', best: { uci: 'g4f3', san: 'Qxf3', white: 50 }, second: { white: 90 } } };
    expect(keyMoments(plies(curve, trade), 50).best).toEqual([]);
    const won = Array(14).fill(99);
    expect(keyMoments(plies(won, { 8: { second: { white: 50 } } }), 99).best).toEqual([]);
  });
});

describe('the key moments on the page', () => {
  const names = { white: 'Anna', black: 'Bruno' };
  const turn = (before: number, after: number): AnalysisMoment => ({ ply: 45, color: 'white', san: 'Nxe5', uci: 'f3e5', fen: 'x', bestSan: 'Qf3', bestUci: 'd1f3', before, after });

  it('writes the pieces as figurines, as Lichess does', () => {
    expect(figurineSan('Nxe5+')).toBe('\u2658\uFE0Exe5+');
    expect(figurineSan('Bb5')).toBe('\u2657\uFE0Eb5');
    expect(figurineSan('Rxe8#')).toBe('\u2656\uFE0Exe8#');
    expect(figurineSan('Kf1')).toBe('\u2654\uFE0Ef1');
    expect(figurineSan('Qh5')).toBe('\u2655\uFE0Eh5');
    expect(figurineSan('e8=Q')).toBe('e8=\u2655\uFE0E');
    // pawns, squares and castling as they are
    expect(figurineSan('exd5')).toBe('exd5');
    expect(figurineSan('O-O-O')).toBe('O-O-O');
    expect(moveLabel(45, 'Nxe5')).toBe('23. \u2658\uFE0Exe5');
    expect(moveLabel(46, 'Qf3')).toBe('23... \u2655\uFE0Ef3');
    expect(squaresOf('e7e8q')).toEqual({ from: 'e7', to: 'e8' });
  });

  it('tells a turn kindly, by how the player stood', () => {
    expect(turnText(turn(50, 20), names)).toBe("Con \u2658\uFE0Exe5 la partita gira a favore di Bruno: \u2655\uFE0Ef3 teneva l'equilibrio.");
    expect(turnText(turn(80, 50), names)).toBe('Con \u2658\uFE0Exe5 il vantaggio di Anna sfuma: con \u2655\uFE0Ef3 restava dalla sua parte.');
    expect(turnText(turn(85, 10), names)).toBe('Con \u2658\uFE0Exe5 la partita si capovolge a favore di Bruno: con \u2655\uFE0Ef3 Anna restava avanti.');
  });

  it("tells a player's best move by how much it mattered", () => {
    const best = (gap: number, after: number): AnalysisMoment => ({ ply: 20, color: 'black', san: 'Rxd4', uci: 'd8d4', fen: 'x', after, gap });
    expect(bestText(best(25, 50), names)).toBe("Bruno trova \u2656\uFE0Exd4, l'unica mossa che tiene l'equilibrio.");
    expect(bestText(best(12, 80), names)).toBe('Bruno trova \u2656\uFE0Exd4, la mossa che tiene il vantaggio.');
    expect(bestText(best(6, 20), names)).toBe('Bruno trova \u2656\uFE0Exd4, la mossa giusta, che tiene aperta la partita.');
  });

  // seed 0: the first wording of each list
  const level = (plies: number): StoryContext => ({ seed: 0, curve: Array(plies + 1).fill(50), turns: [] });

  it('tells a turn by its facts: the answer that punished it, what it won, a mate', () => {
    const facts = { ...turn(50, 20), move: { piece: 'n', to: 'e5', capture: 'p' }, bestMove: { piece: 'q', to: 'f3' } };
    const ctx = level(60);
    // seed 0 + ply 45: the first wording of three, the second of two; after 22 moves of balance
    expect(turnText({ ...facts, reply: { san: 'Rxd1', piece: 'r', to: 'd1', capture: 'r' }, gain: 5 }, names, ctx)).toBe(
      "Dopo 22 mosse di equilibrio, con \u2658\uFE0Exe5 la partita gira a favore di Bruno: arriva \u2656\uFE0Exd1, e Bruno prende la torre in d1. \u2655\uFE0Ef3 teneva l'equilibrio."
    );
    // seed 1: the second wordings
    expect(turnText({ ...facts, reply: { san: 'Qh4', piece: 'q', to: 'h4' }, mate: 3 }, names, { ...ctx, seed: 1, curve: [] })).toBe(
      'La mossa \u2658\uFE0Exe5 apre la porta a Bruno: Bruno ha un matto in 3, a cominciare da \u2655\uFE0Eh4. Con \u2655\uFE0Ef3 la partita restava in equilibrio.'
    );
    expect(turnText({ ...facts, reply: { san: 'Bd6', piece: 'b', to: 'd6' } }, names, { ...ctx, seed: 2, curve: [] })).toBe(
      "Con \u2658\uFE0Exe5 la bilancia pende verso Bruno: dopo \u2657\uFE0Ed6 la posizione di Bruno è migliore. Meglio era \u2655\uFE0Ef3, che teneva la posizione."
    );
    // From ahead: what the player lost, never a harsh word
    expect(turnText({ ...turn(85, 50), move: { piece: 'n', to: 'e5' }, reply: { san: 'd5', piece: 'p', to: 'd5' }, gain: 3 }, names, { ...ctx, seed: 1 })).toBe(
      'Con \u2658\uFE0Exe5 il vantaggio di Anna sfuma: Bruno risponde d5 e guadagna un pezzo. Con \u2655\uFE0Ef3 il vantaggio restava ad Anna.'
    );
    expect(materialText(1)).toBe('un pedone');
    expect(materialText(2)).toBe('due pedoni');
    expect(materialText(4)).toBe('un pezzo');
    expect(materialText(9)).toBe('molto materiale');
  });

  it("tells a best move by its facts: what it is, what it wins, what the others cost", () => {
    const best = (extra: Partial<AnalysisMoment>, ply = 20): AnalysisMoment => ({ ply, color: 'black', san: 'Rxd4', uci: 'd8d4', fen: 'x', after: 50, gap: 25, move: { piece: 'r', to: 'd4' }, ...extra });
    const ctx = level(60);
    expect(bestText(best({ sacrifice: true }), names, ctx)).toBe("Bruno sacrifica materiale con \u2656\uFE0Exd4, l'unica mossa che tiene l'equilibrio.");
    expect(bestText(best({ move: { piece: 'q', to: 'h4', check: true }, mate: 4 }, 21), names, ctx)).toBe('Bruno dà scacco con \u2656\uFE0Exd4 e avvia un matto in 4.');
    expect(bestText(best({ move: { piece: 'r', to: 'd4', capture: 'n' }, alt: { gain: 5 } }), names, ctx)).toBe('Bruno prende il cavallo con \u2656\uFE0Exd4: ogni altra mossa costava molto materiale.');
    // the mate in so many moves is the next best's only: no number for every other move
    expect(bestText(best({ alt: { mate: 2 } }, 23), names, ctx)).toBe('Bruno gioca \u2656\uFE0Exd4: ogni altra mossa lasciava ad Anna il matto.');
    // Right after the opponent's turn: the chance taken
    const punish = { ...ctx, turns: [{ ...turn(50, 20), ply: 19 }] };
    expect(bestText(best({ move: { piece: 'r', to: 'd4', capture: 'q', check: true } }), names, punish)).toBe(
      "Bruno non perdona: prende la donna con scacco, \u2656\uFE0Exd4, l'unica mossa che tiene l'equilibrio."
    );
    // Back from a lost position
    const back = { ...ctx, curve: [50, 90, 90, ...Array(60).fill(50)] };
    expect(bestText(best({}), names, back)).toBe("Senza mollare, Bruno trova \u2656\uFE0Exd4, l'unica mossa che tiene l'equilibrio.");
    // An older analysis, without the facts
    expect(bestText({ ...best({}), move: undefined }, names, ctx)).toBe("Bruno trova \u2656\uFE0Exd4, l'unica mossa che tiene l'equilibrio.");
  });

  it('tells the final blow by the piece that gives it', () => {
    const f: AnalysisMoment = { ply: 60, color: 'white', san: 'Qh7#', uci: 'd3h7', fen: 'x', move: { piece: 'q', to: 'h7', check: true } };
    expect(finishText(f, names, level(60))).toBe('La donna di Anna arriva in h7 e chiude la partita.');
    expect(finishText(f, names, { ...level(60), seed: 1 })).toBe('Anna chiude la partita con la donna in h7.');
    expect(finishText({ ...f, move: undefined }, names)).toBe('Anna chiude la partita con \u2655\uFE0Eh7#.');
    // castling or a promotion: the piece that mates is not the one that moved
    expect(finishText({ ...f, san: 'O-O#', uci: 'e1g1', move: { piece: 'k', to: 'g1', castle: true, check: true } }, names, level(60))).toBe('Anna arrocca e chiude la partita: O-O#.');
    expect(finishText({ ...f, san: 'e8=Q#', uci: 'e7e8q', move: { piece: 'p', to: 'e8', promotion: 'q', check: true } }, names, level(60))).toBe('Anna promuove in e8 e chiude la partita: e8=\u2655\uFE0E#.');
  });

  it('tells the moments in the order they were played', () => {
    const a: GameAnalysis = {
      v: 1,
      id: 'AbCd1234',
      curve: [50, 50],
      turns: [turn(50, 20)],
      best: [{ ply: 20, color: 'black', san: 'Rxd4', uci: 'd8d4', fen: 'x', after: 50, gap: 25 }],
      swings: 1,
    };
    expect(momentsOf(a, names).map((m) => [m.kind, m.title])).toEqual([
      ['best', '10... \u2656\uFE0Exd4 · La mossa di Bruno'],
      ['turn', '23. \u2658\uFE0Exe5 · La svolta'],
    ]);
    // The checkmate is told once, as the final blow
    const mate = { ply: 20, color: 'black' as const, san: 'Rxd4#', uci: 'd8d4', fen: 'x' };
    expect(momentsOf({ ...a, finish: mate }, names).map((m) => [m.kind, m.title, m.text])).toEqual([
      ['finish', '10... \u2656\uFE0Exd4# · Scacco matto', 'Bruno chiude la partita con \u2656\uFE0Exd4#.'],
      ['turn', '23. \u2658\uFE0Exe5 · La svolta', "Con \u2658\uFE0Exe5 la partita gira a favore di Bruno: \u2655\uFE0Ef3 teneva l'equilibrio."],
    ]);
  });

  it('tells each phase by who gained, never by who lost ground', () => {
    expect(openingText(50, names)).toBe("Si esce dall'apertura in equilibrio.");
    expect(openingText(62, names)).toBe("Anna esce dall'apertura un po' meglio.");
    expect(openingText(20, names)).toBe("Bruno esce dall'apertura in vantaggio.");
    const p = 'Nel mediogioco';
    expect(phaseText(p, 50, 52, names)).toBe('Nel mediogioco la partita resta in equilibrio.');
    expect(phaseText(p, 50, 80, names)).toBe('Nel mediogioco Anna prende il vantaggio.');
    expect(phaseText(p, 50, 35, names)).toBe("Nel mediogioco Bruno si porta un po' avanti.");
    expect(phaseText(p, 75, 50, names)).toBe('Nel mediogioco Bruno rimette la partita in equilibrio.');
    expect(phaseText(p, 75, 20, names)).toBe('Nel mediogioco Bruno ribalta la partita.');
    expect(phaseText(p, 62, 90, names)).toBe('Nel mediogioco Anna allunga.');
    expect(phaseText(p, 90, 62, names)).toBe('Nel mediogioco Bruno accorcia le distanze.');
    expect(phaseText(p, 90, 99, names)).toBe('Nel mediogioco Anna conserva il vantaggio.');
    expect(phaseText(p, 38, 35, names)).toBe('Nel mediogioco Bruno conserva un piccolo vantaggio.');
  });

  it('tells how the game ended', () => {
    expect(endingText('mate', 'white', 61, names)).toBe('Scacco matto alla mossa 31.');
    expect(endingText('resign', 'white', 74, names)).toBe('Bruno abbandona alla mossa 37.');
    expect(endingText('outoftime', 'black', 40, names)).toBe('Alla mossa 20 scade il tempo di Anna.');
    expect(endingText('draw', undefined, 100, names)).toBe('Patta alla mossa 50.');
    expect(endingText('stalemate', undefined, 99, names)).toBe('Stallo alla mossa 50: patta.');
    expect(endingText('cheat', 'white', 40, names)).toBeUndefined();
    // out of time with no winner (the other side could not mate): no line
    expect(endingText('outoftime', undefined, 40, names)).toBeUndefined();
    expect(endingText(undefined, undefined, 40, names)).toBeUndefined();
  });

  it('tells the whole game phase by phase, each with its moments', () => {
    const curve = [...Array(21).fill(50), ...Array(20).fill(75), ...Array(20).fill(100)];
    const a: GameAnalysis = {
      v: 1,
      id: 'AbCd1234',
      curve,
      turns: [{ ...turn(50, 20), ply: 25, color: 'black' }],
      best: [{ ply: 9, color: 'white', san: 'Nc3', uci: 'b1c3', fen: 'x', after: 50, gap: 12 }],
      finish: { ply: 60, color: 'white', san: 'Qh7#', uci: 'd3h7', fen: 'x' },
      swings: 1,
      phases: { middle: 20, end: 45 },
    };
    const story = storyOf(a, names, { status: 'mate', winner: 'white' });
    expect(story.intro).toBeUndefined();
    expect(story.phases.map((p) => [p.title, p.text, p.moments.map((m) => m.moment.ply)])).toEqual([
      ["L'apertura", "Si esce dall'apertura in equilibrio.", [9]],
      ['Il mediogioco', 'Nel mediogioco Anna prende il vantaggio.', [25]],
      ['Il finale', 'Nel finale Anna conserva il vantaggio.', [60]],
    ]);
    // The checkmate is told by the final blow; a resignation in the last line
    expect(story.ending).toBeUndefined();
    expect(storyOf({ ...a, finish: undefined }, names, { status: 'resign', winner: 'white' }).ending).toBe('Bruno abbandona alla mossa 30.');
    // No phases: the moments in one list; no turn at all, or many, said first
    const flat = storyOf({ ...a, phases: undefined, turns: [], swings: 0 }, names);
    expect(flat.phases.map((p) => [p.key, p.title, p.moments.length])).toEqual([['game', undefined, 2]]);
    expect(flat.intro).toBe('Nessuna svolta improvvisa: la partita è cambiata poco a poco.');
    expect(storyOf({ ...a, swings: 5 }, names).intro).toBe('Una partita sulle montagne russe: 5 svolte.');
    // no endgame reached, or the endgame starting where the game ends: opening and middlegame only
    expect(storyOf({ ...a, phases: { middle: 20 } }, names).phases.map((p) => [p.key, p.moments.map((m) => m.moment.ply)])).toEqual([
      ['opening', [9]],
      ['middlegame', [25, 60]],
    ]);
    expect(storyOf({ ...a, phases: { middle: 20, end: 60 } }, names).phases.map((p) => p.key)).toEqual(['opening', 'middlegame']);
    // a middlegame starting at the very end, or a curve too short: one list
    expect(storyOf({ ...a, phases: { middle: 60 } }, names).phases.map((p) => p.key)).toEqual(['game']);
    expect(storyOf({ ...a, curve: [50], phases: { middle: 20 } }, names).phases.map((p) => p.key)).toEqual(['game']);
  });

  it('uses only the analysis of the game behind the current link', () => {
    const analysis: GameAnalysis = { v: 1, id: 'AbCd1234', curve: [50], turns: [], best: [] };
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis })).toBe(analysis);
    expect(analysisOf({ url: 'https://lichess.org/Zzzz9999', analysis })).toBeUndefined();
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis: { ...analysis, skipped: 'moves' } })).toBeUndefined();
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis: { ...analysis, v: 99 } })).toBeUndefined();
    // an older version stays on the page until the game is analysed again
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis: { ...analysis, v: 2 } })).toBeDefined();
    // a result decided by the organizer: the story would tell another end
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis, decision: { result: '0-1', at: 1 } })).toBeUndefined();
    // no link: whatever game it was
    expect(analysisOf({ url: '', analysis })).toBe(analysis);
    expect(hasMoments(analysis)).toBe(false);
    expect(hasMoments({ ...analysis, phases: { middle: 20 } })).toBe(true);
  });
});
