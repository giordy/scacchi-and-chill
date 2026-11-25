import { describe, expect, it } from 'vitest';
// @ts-expect-error a Node script without types
import { ANALYSIS_VERSION, keyMoments, needsAnalysis, winPercent } from '../../../scripts/analysis.mjs';
// @ts-expect-error a Node script without types
import { parseSearch } from '../../../scripts/analyse-games.mjs';
// @ts-expect-error a Node script without types
import { gameIdOf } from '../../../scripts/sync-results.mjs';
import { analysisOf, bestText, hasMoments, italianSan, momentsOf, moveLabel, squaresOf, storyLine, turnText } from '../analysis';
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
      { score: { cp: 35 }, uci: 'g8f6' },
      { score: { mate: 4 }, uci: 'f7f6' },
    ]);
    expect(parseSearch(out.slice(0, 1), true)).toEqual([{ score: { cp: 40 }, uci: 'e2e4' }]);
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

  it('tells two turns of the same player close together as one, at most three in all', () => {
    // White from ahead to level at ply 5, then from level to behind at ply 7: one moment, the bigger
    const curve = [80, 80, 80, 80, 80, 50, 50, 25, 25, 25];
    const a = keyMoments(plies(curve.slice(0, -1)), curve[curve.length - 1]);
    expect(a.turns.map((t: AnalysisMoment) => [t.ply, t.color])).toEqual([[5, 'white']]);
    expect(a.swings).toBe(1);
    // A game back and forth: the three biggest, in the order played
    const many = [50, 50, 50, 50, 50, 20, 20, 20, 20, 20, 50, 50, 50, 50, 50, 50, 50, 15, 15, 15, 15, 15, 50, 50, 50, 50, 50, 50, 50, 10, 10];
    const b = keyMoments(plies(many.slice(0, -1)), many[many.length - 1]);
    expect(b.swings).toBe(5);
    expect(b.turns.map((t: AnalysisMoment) => [t.ply, t.after])).toEqual([
      [17, 15],
      [22, 50],
      [29, 10],
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
    // A move worse than the engine's is no best move, however bad the next best
    const worse = plies([...curve.slice(0, 9), 40, ...curve.slice(10)], { 8: { second: { white: 0 } } });
    expect(keyMoments(worse, 50).best.map((b: AnalysisMoment) => b.ply)).not.toContain(9);
  });

  it('leaves out recaptures and games already decided', () => {
    const curve = Array(14).fill(50);
    const recapture = {
      8: { san: 'Nxe5', uci: 'f3e5' },
      9: { san: 'dxe5', uci: 'd6e5', best: { uci: 'd6e5', san: 'dxe5', white: 50 }, second: { white: 90 } },
    };
    expect(keyMoments(plies(curve, recapture), 50).best).toEqual([]);
    const won = Array(14).fill(99);
    expect(keyMoments(plies(won, { 8: { second: { white: 50 } } }), 99).best).toEqual([]);
  });
});

describe('the key moments on the page', () => {
  const names = { white: 'Anna', black: 'Bruno' };
  const turn = (before: number, after: number): AnalysisMoment => ({ ply: 45, color: 'white', san: 'Nxe5', uci: 'f3e5', fen: 'x', bestSan: 'Qf3', bestUci: 'd1f3', before, after });

  it('writes the moves the Italian way', () => {
    expect(italianSan('Nxe5+')).toBe('Cxe5+');
    expect(italianSan('Bb5')).toBe('Ab5');
    expect(italianSan('Rxe8#')).toBe('Txe8#');
    expect(italianSan('Kf1')).toBe('Rf1');
    expect(italianSan('e8=Q')).toBe('e8=D');
    expect(italianSan('O-O-O')).toBe('O-O-O');
    expect(moveLabel(45, 'Nxe5')).toBe('23. Cxe5');
    expect(moveLabel(46, 'Qf3')).toBe('23... Df3');
    expect(squaresOf('e7e8q')).toEqual({ from: 'e7', to: 'e8' });
  });

  it('tells a turn kindly, by how the player stood', () => {
    expect(turnText(turn(50, 20), names)).toBe("Con Cxe5 la partita gira a favore di Bruno: Df3 teneva l'equilibrio.");
    expect(turnText(turn(80, 50), names)).toBe('Con Cxe5 il vantaggio di Anna sfuma: con Df3 restava dalla sua parte.');
    expect(turnText(turn(85, 10), names)).toBe('Con Cxe5 la partita si capovolge a favore di Bruno: con Df3 Anna restava avanti.');
  });

  it("tells a player's best move by how much it mattered", () => {
    const best = (gap: number, after: number): AnalysisMoment => ({ ply: 20, color: 'black', san: 'Rxd4', uci: 'd8d4', fen: 'x', after, gap });
    expect(bestText(best(25, 50), names)).toBe("Bruno trova Txd4, l'unica mossa che tiene l'equilibrio.");
    expect(bestText(best(12, 80), names)).toBe('Bruno trova Txd4, la mossa che tiene il vantaggio.');
    expect(bestText(best(6, 20), names)).toBe('Bruno trova Txd4, la mossa giusta, che tiene aperta la partita.');
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
      ['best', '10... Txd4 · La mossa di Bruno'],
      ['turn', '23. Cxe5 · La svolta'],
    ]);
    expect(storyLine(a)).toBeUndefined();
    expect(storyLine({ ...a, turns: [], swings: 0 })).toBe('Nessuna svolta improvvisa: la partita è cambiata poco a poco.');
    expect(storyLine({ ...a, swings: 5 })).toBe('Una partita sulle montagne russe: 5 svolte, ecco le più grandi.');
  });

  it('uses only the analysis of the game behind the current link', () => {
    const analysis: GameAnalysis = { v: 1, id: 'AbCd1234', curve: [50], turns: [], best: [] };
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis })).toBe(analysis);
    expect(analysisOf({ url: 'https://lichess.org/Zzzz9999', analysis })).toBeUndefined();
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis: { ...analysis, skipped: 'moves' } })).toBeUndefined();
    expect(analysisOf({ url: 'https://lichess.org/AbCd1234', analysis: { ...analysis, v: 99 } })).toBeUndefined();
    expect(hasMoments(analysis)).toBe(false);
  });
});
