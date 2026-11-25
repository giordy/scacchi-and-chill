import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeyMoments } from '../KeyMoments';
import { GameAnalysis } from '../../types';

const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const analysis: GameAnalysis = {
  v: 2,
  id: 'AbCd1234',
  curve: [...Array(21).fill(50), ...Array(20).fill(75), ...Array(20).fill(100)],
  turns: [{ ply: 25, color: 'black', san: 'Nxe5', uci: 'f6e4', fen, bestSan: 'Qf3', bestUci: 'd8f6', before: 50, after: 20 }],
  best: [{ ply: 9, color: 'white', san: 'Nc3', uci: 'b1c3', fen, after: 50, gap: 12 }],
  swings: 1,
  phases: { middle: 20, end: 45 },
};

describe('KeyMoments', () => {
  const html = renderToStaticMarkup(<KeyMoments analysis={analysis} names={{ white: 'Anna', black: 'Bruno' }} state={{ status: 'resign', winner: 'white' }} />);

  it('tells the whole game phase by phase, then how it ended', () => {
    expect(html).toContain("<p>Si esce dall&#x27;apertura in equilibrio.</p><p>Nel mediogioco Anna prende il vantaggio.</p><p>Nel finale Anna conserva il vantaggio.</p>");
    expect(html).toContain('Bruno abbandona alla mossa 30.');
  });

  it('shows one moment at a time on a big board, the first one first', () => {
    expect(html).toContain('<span>1 di 2</span>');
    expect(html).toContain('5. Cc3 · La mossa di Anna');
    expect(html).not.toContain('La svolta</strong>');
    expect(html.match(/class="mini-board/g)).toHaveLength(1);
    // with the files and ranks, each in the colour of the other square
    expect(html).toContain('<text x="94" y="792" text-anchor="end" class="on-dark">a</text>');
    expect(html).toContain('<text x="6" y="26" class="on-light">8</text>');
    expect(html).toContain('<text x="6" y="726" class="on-dark">1</text>');
    // one dot per moment to jump to it, the arrows to go back and forth
    expect(html.match(/class="km-nav-dot /g)).toHaveLength(2);
    expect(html).toContain('disabled="" aria-label="Momento precedente"');
  });
});
