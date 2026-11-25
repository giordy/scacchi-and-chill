import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
// @ts-expect-error a Node script without types
import { balance, bestFacts, moveInfo, turnFacts, withFacts } from '../../../scripts/moveFacts.mjs';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White's knight on d4 shields the rook on d1: moving it away leaves the back rank to Black's rook
const BACK_RANK = '3r2k1/5ppp/8/8/3N4/8/5PPP/3R2K1 w - - 0 1';
// The Italian game: Bxf7+ gives the bishop for a pawn, the king takes it
const ITALIAN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';

describe('the facts behind a key moment', () => {
  it('counts the material of each side', () => {
    expect(balance(START, 'w')).toBe(0);
    expect(balance('rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w')).toBe(3);
    expect(balance('rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'b')).toBe(-3);
  });

  it('tells what a move is', () => {
    const c = new Chess(ITALIAN);
    expect(moveInfo(c.move('Bxf7+'))).toEqual({ piece: 'b', to: 'f7', capture: 'p', check: true });
    expect(moveInfo(new Chess(ITALIAN).move('O-O'))).toEqual({ piece: 'k', to: 'g1', castle: true });
    expect(moveInfo(new Chess('8/4P2k/8/8/8/8/8/K7 w - - 0 1').move('e8=Q'))).toEqual({ piece: 'p', to: 'e8', promotion: 'q' });
  });

  it("finds the answer that punished a turn, what it won and the mate", () => {
    const p = { fen: BACK_RANK, uci: 'd4b5', best: { uci: 'd4f3' } };
    const facts = turnFacts(p, { pv: ['d8d1'], score: { mate: -1 } });
    expect(facts).toEqual({
      move: { piece: 'n', to: 'b5' },
      bestMove: { piece: 'n', to: 'f3' },
      reply: { san: 'Rxd1#', piece: 'r', to: 'd1', capture: 'r', check: true },
      gain: 5,
      mate: 1,
    });
    // A piece taken and taken back is no gain
    const trade = turnFacts({ fen: ITALIAN, uci: 'c4f7', best: { uci: 'e1g1' } }, { pv: ['e8f7', 'f3g5', 'f7g8'], score: { cp: 0 } });
    expect(trade.gain).toBe(2);
    expect(trade.mate).toBeUndefined();
  });

  it('sees a sacrifice, a mate on the way and what any other move would have cost', () => {
    const sac = bestFacts({
      fen: ITALIAN,
      uci: 'c4f7',
      best: { uci: 'c4f7', pv: ['c4f7', 'e8f7', 'f3g5'], score: { cp: 30 } },
      second: { pv: ['e1g1', 'd7d6'], score: { cp: 20 } },
    });
    expect(sac).toEqual({ move: { piece: 'b', to: 'f7', capture: 'p', check: true }, sacrifice: true });
    // Black to move on the back rank: Rxd1# wins the rook and mates; any other move lets White on
    const BLACK = '3r2k1/5ppp/8/1N6/8/8/5PPP/3R2K1 b - - 0 1';
    const mate = bestFacts({
      fen: BLACK,
      uci: 'd8d1',
      best: { uci: 'd8d1', pv: ['d8d1'], score: { mate: -1 } },
      second: { pv: ['g8f8', 'd1d8', 'f8e7', 'd8d1'], score: { cp: 300 } },
    });
    expect(mate.mate).toBe(1);
    expect(mate.gain).toBe(5);
    expect(mate.move).toEqual({ piece: 'r', to: 'd1', capture: 'r', check: true });
  });

  it("tells what any other move would cost only when the move played was the engine's first choice", () => {
    const BLACK = '3r2k1/5ppp/8/1N6/8/8/5PPP/3R2K1 b - - 0 1';
    const second = { pv: ['g8f8', 'd1d8', 'f8e7', 'd8d1'], score: { mate: 3 } };
    // as good as the engine's move, but not it: it may be the second line itself
    const notFirst = bestFacts({ fen: BLACK, uci: 'g8f8', best: { uci: 'd8d1', pv: ['d8d1'], score: { mate: -1 } }, second });
    expect(notFirst).toEqual({ move: { piece: 'k', to: 'f8' } });
    const first = bestFacts({ fen: BLACK, uci: 'd8d1', best: { uci: 'd8d1', pv: ['d8d1'], score: { mate: -1 } }, second });
    expect(first.alt).toEqual({ gain: 5, mate: 3 });
  });

  it('copes with a turn on the last move, an en passant capture and lines that break off', () => {
    // the last move of a game ended on the board: no line after it
    const last = turnFacts({ fen: BACK_RANK, uci: 'd4b5', best: { uci: 'd4f3' } }, undefined);
    expect(last).toEqual({ move: { piece: 'n', to: 'b5' }, bestMove: { piece: 'n', to: 'f3' } });
    // en passant: a pawn taken on another square than where the capturing pawn lands
    const EP = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
    expect(moveInfo(new Chess(EP).move('exf6'))).toEqual({ piece: 'p', to: 'f6', capture: 'p' });
    // an engine line with an illegal move in it: counted as far as it goes
    const broken = turnFacts({ fen: BACK_RANK, uci: 'd4b5', best: { uci: 'd4f3' } }, { pv: ['d8d1', 'a1a8'], score: { mate: -1 } });
    expect(broken.gain).toBe(5);
    // a move that is not legal in the position: no facts
    expect(turnFacts({ fen: BACK_RANK, uci: 'a1a8', best: { uci: 'd4f3' } }, undefined)).toEqual({});
    expect(bestFacts({ fen: BACK_RANK, uci: 'a1a8', best: { uci: 'a1a8', pv: [] } })).toEqual({});
  });

  it('adds the facts to the chosen moments only', () => {
    const plies = [
      { fen: BACK_RANK, uci: 'd4b5', san: 'Nb5', color: 'white', best: { uci: 'd4f3', pv: ['d4f3'], score: { cp: 0 } } },
      { fen: '3r2k1/5ppp/8/1N6/8/8/5PPP/3R2K1 b - - 1 1', uci: 'd8d1', san: 'Rxd1#', color: 'black', best: { uci: 'd8d1', pv: ['d8d1'], score: { mate: -1 } } },
    ];
    const result = {
      curve: [50, 0, 0],
      turns: [{ ply: 1, color: 'white', san: 'Nb5', uci: 'd4b5', fen: BACK_RANK, bestSan: 'Nf3', bestUci: 'd4f3', before: 50, after: 0 }],
      swings: 1,
      best: [],
      finish: { ply: 2, color: 'black', san: 'Rxd1#', uci: 'd8d1', fen: plies[1].fen },
    };
    const out = withFacts(result, plies, undefined);
    expect(out.turns[0].reply.san).toBe('Rxd1#');
    expect(out.turns[0].gain).toBe(5);
    expect(out.finish.move).toEqual({ piece: 'r', to: 'd1', capture: 'r', check: true });
  });
});
