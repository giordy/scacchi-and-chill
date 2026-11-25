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
    expect(html).toContain('5. \u2658\uFE0Ec3 · La mossa di Anna');
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

  it('tells an older analysis, without the facts, in plain words', () => {
    const v1 = renderToStaticMarkup(<KeyMoments analysis={{ ...analysis, v: 1, phases: undefined }} names={{ white: 'Anna', black: 'Bruno' }} />);
    expect(v1).toContain('Anna trova \u2658\uFE0Ec3, la mossa che tiene l&#x27;equilibrio.');
    // no phases: no story by phase, the moments still on the board
    expect(v1).not.toContain('Nel mediogioco');
    expect(v1).toContain('<span>1 di 2</span>');
  });

  it('with no moment to show, tells the phases only and shows no board', () => {
    const quiet = renderToStaticMarkup(
      <KeyMoments analysis={{ ...analysis, turns: [], best: [], swings: 0 }} names={{ white: 'Anna', black: 'Bruno' }} state={{ status: 'draw' }} />
    );
    expect(quiet).toContain('Nessuna svolta improvvisa');
    // the curve ends with White far ahead: a draw agreed all the same, said
    expect(quiet).toContain('Patta alla mossa 30, anche se Anna era in vantaggio.');
    expect(quiet).not.toContain('km-viewer');
    expect(quiet).not.toContain('mini-board');
  });

  it('tells the streaks, and shows promotions and mates missed on the board', () => {
    const more: GameAnalysis = {
      ...analysis,
      streaks: [{ color: 'black', from: 30, to: 50, moves: 11 }],
      promotions: [{ ply: 55, color: 'white', san: 'e8=Q', uci: 'e7e8q', fen }],
      missed: [{ ply: 57, color: 'white', san: 'Qg8+', uci: 'e8g8', bestSan: 'Qf7#', bestUci: 'e8f7', fen, mate: 1 }],
    };
    const html = renderToStaticMarkup(<KeyMoments analysis={more} names={{ white: 'Anna', black: 'Bruno' }} />);
    expect(html).toContain('<p>Bruno gioca 11 mosse di fila come il motore, dalla mossa 15 alla 25.</p>');
    expect(html).toContain('<span>1 di 4</span>');
    expect(html).toContain('aria-label="28. e8=\u2655\uFE0E · La promozione"');
    expect(html).toContain('class="km-nav-dot is-missed"');
  });
});
