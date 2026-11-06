import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RankCell } from '../RankCell';
import { SeasonsHistory } from '../SeasonsHistory';
import { SeasonArchive } from '../../types';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('RankCell', () => {
  it('shows a dash before the first game', () => {
    const out = html(<RankCell rank={null} points={0} tied={false} />);
    expect(out).toContain('>–<');
    expect(out).not.toContain('podium-');
  });

  it('shows the place with its medal colour on the podium', () => {
    expect(html(<RankCell rank={2} points={3} tied={false} />)).toContain('class="rank podium-2"');
    expect(html(<RankCell rank={4} points={3} tied={false} />)).toContain('class="rank"');
  });

  it('gives no medal colour without points or when medals are off', () => {
    expect(html(<RankCell rank={1} points={0} tied={false} />)).toContain('class="rank"');
    expect(html(<RankCell rank={1} points={3} tied={false} medals={false} />)).toContain('class="rank"');
  });

  it('says a shared place is a tie', () => {
    const out = html(<RankCell rank={2} points={3} tied />);
    expect(out).toContain('>2<');
    expect(out).toContain('aria-label="2° a pari merito"');
    expect(out).toContain('title="2° posto a pari merito"');
  });
});

describe('SeasonsHistory', () => {
  const row = (handle: string, points: number, sb: number, won: number) => ({
    handle,
    name: handle.toUpperCase(),
    played: 3,
    won,
    drawn: 0,
    lost: 3 - won,
    points,
    sb,
  });
  const archive = {
    id: 'stagione-1',
    season: 'Stagione 1',
    title: 'Scacchi & Chill',
    archivedAt: '2026-01-01T00:00:00.000Z',
    gamesPlayed: 6,
    standings: [row('anna', 3, 4, 3), row('bruno', 2, 2, 2), row('carla', 2, 2, 2), row('dario', 0, 0, 0)],
  } as unknown as SeasonArchive;

  it('shares the place of tied players in an archived table', () => {
    const ranks = [...html(<SeasonsHistory seasons={[archive]} />).matchAll(/class="rank[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(ranks).toEqual(['1', '2', '2', '4']);
  });

  it('says when each season was played, as corrected in the hall of fame', () => {
    const plain = html(<SeasonsHistory seasons={[{ ...archive, start: '2025-11', end: '2026-03' } as SeasonArchive]} />);
    expect(plain).toContain('nov 2025 – mar 2026');
    expect(plain).not.toContain('archiviata');
    const corrected = html(
      <SeasonsHistory
        seasons={[archive]}
        winners={[{ season: 'Stagione 1', name: 'Anna', handle: 'anna', start: '2025-10', end: '2025-12' }]}
      />
    );
    expect(corrected).toContain('ott 2025 – dic 2025');
  });
});

