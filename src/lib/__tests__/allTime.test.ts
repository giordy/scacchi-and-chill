import { describe, expect, it } from 'vitest';
import { archivedGames } from '../seasons';
import {
  allTimeHeadToHead,
  allTimeNameOf,
  allTimeRanks,
  allTimeRecords,
  allTimeTable,
  careerOf,
  seasonsWithGames,
  SeasonGames,
} from '../allTime';
import { ArchivedGame, HistoryGame, LichessExportGame, SeasonArchive } from '../../types';

const g = (white: string, black: string, result: ArchivedGame['result'], extra: Partial<ArchivedGame> = {}): ArchivedGame => ({
  round: '1',
  white,
  black,
  result,
  status: result === '½-½' ? 'draw' : 'resign',
  plies: 40,
  ...extra,
});

const row = (handle: string, name: string, points: number, played: number, won: number, drawn: number, lost: number, sb = 0) => ({
  handle,
  name,
  points,
  played,
  won,
  drawn,
  lost,
  sb,
});

const s1: SeasonArchive = {
  id: 'stagione-1',
  season: 'Stagione 1',
  title: 'Scacchi & Chill',
  archivedAt: '2026-01-31T10:00:00Z',
  standings: [row('anna', 'Anna', 2, 2, 2, 0, 0), row('bruno', 'Bruno', 1, 2, 1, 0, 1), row('carla', 'Carla', 0, 2, 0, 0, 2)],
  gamesPlayed: 3,
};
const s2: SeasonArchive = {
  id: 'stagione-2',
  season: 'Stagione 2',
  title: 'Scacchi & Chill',
  archivedAt: '2026-06-30T10:00:00Z',
  standings: [row('Bruno', 'Bruno B.', 1.5, 2, 1, 1, 0), row('anna', 'Anna', 0.5, 2, 0, 1, 1)],
  gamesPlayed: 2,
  games: [g('bruno', 'anna', '1-0', { plies: 90, id: 'longgame' }), g('anna', 'bruno', '½-½', { round: '2' })],
};

describe('archivedGames', () => {
  const history: HistoryGame[] = [
    { round: '2', white: 'anna', black: 'bruno', url: 'https://lichess.org/bbbbbbbb' },
    { round: '1', white: 'bruno', black: 'anna', url: 'https://lichess.org/aaaaaaaa' },
    { round: '3', white: 'anna', black: 'carla', url: 'https://lichess.org/cccccccc' },
  ];
  const states: Record<string, LichessExportGame> = {
    aaaaaaaa: {
      id: 'aaaaaaaa',
      status: 'mate',
      winner: 'white',
      moves: 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7',
      lastMoveAt: 5,
      players: { white: { rating: 1500 }, black: { rating: 1700, provisional: true } },
      opening: { name: 'King Pawn' },
    },
    bbbbbbbb: { id: 'bbbbbbbb', status: 'draw' },
    cccccccc: { id: 'cccccccc', status: 'started' },
  };

  it('keeps only the scored games, compact and in round order', () => {
    expect(archivedGames(history, states)).toEqual([
      {
        round: '1',
        white: 'bruno',
        black: 'anna',
        result: '1-0',
        id: 'aaaaaaaa',
        status: 'mate',
        plies: 7,
        end: 5,
        whiteRating: 1500,
        blackRating: 1700,
        provisional: true,
        opening: 'King Pawn',
      },
      { round: '2', white: 'anna', black: 'bruno', result: '½-½', id: 'bbbbbbbb', status: 'draw' },
    ]);
  });

  it('keeps a forfeit, which has no link', () => {
    const forfeit: HistoryGame = { round: '1', white: 'anna', black: 'bruno', url: '', lichess: { id: '', status: 'forfeit', winner: 'white' } };
    expect(archivedGames([forfeit], {})).toEqual([{ round: '1', white: 'anna', black: 'bruno', result: '1-0', status: 'forfeit' }]);
  });
});

describe('seasonsWithGames', () => {
  const current = {
    season: 'Stagione 3',
    history: [{ round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/dddddddd' }],
    gameStates: { dddddddd: { id: 'dddddddd', status: 'resign', winner: 'white' as const } },
  };

  it('lists the seasons with games, oldest first, the current one last', () => {
    const list = seasonsWithGames([s2, s1], current);
    expect(list.map((s) => [s.season, s.current, s.games.length])).toEqual([
      ['Stagione 2', false, 2],
      ['Stagione 3', true, 1],
    ]);
  });

  it('does not count the current season twice once it is archived', () => {
    expect(seasonsWithGames([s2], { ...current, season: 'Stagione 2' }).map((s) => s.season)).toEqual(['Stagione 2']);
  });
});

describe('allTimeHeadToHead', () => {
  const list: SeasonGames[] = [
    { season: 'Stagione 2', current: false, games: s2.games! },
    { season: 'Stagione 3', current: true, games: [g('Anna', 'bruno', '1-0'), g('carla', 'anna', '0-1')] },
  ];

  it('adds up every meeting, whatever the case of the handle', () => {
    expect(allTimeHeadToHead('anna', list)).toEqual([
      { opponent: 'bruno', won: 1, drawn: 1, lost: 1, scored: 1.5, conceded: 1.5, seasons: 2 },
      { opponent: 'carla', won: 1, drawn: 0, lost: 0, scored: 1, conceded: 0, seasons: 1 },
    ]);
  });
});

describe('careerOf', () => {
  it('lists the current season, then the archived ones, newest first', () => {
    const current = { season: 'Stagione 3', standings: [row('anna', 'Anna', 1, 1, 1, 0, 0), row('bruno', 'Bruno', 0, 1, 0, 0, 1)] };
    const career = careerOf('anna', [s1, s2], current);
    expect(career.map((c) => [c.season, c.place, c.of, c.current])).toEqual([
      ['Stagione 3', 1, 2, true],
      ['Stagione 2', 2, 2, false],
      ['Stagione 1', 1, 3, false],
    ]);
  });

  it('shows no place before the first game, and shares tied places', () => {
    const current = { season: 'Stagione 3', standings: [row('anna', 'Anna', 0, 0, 0, 0, 0), row('bruno', 'Bruno', 0, 0, 0, 0, 0)] };
    expect(careerOf('anna', [], current)[0].place).toBeNull();
    const tied: SeasonArchive = { ...s1, standings: [row('anna', 'Anna', 1, 2, 1, 0, 1, 1), row('bruno', 'Bruno', 1, 2, 1, 0, 1, 1)] };
    expect(careerOf('bruno', [tied])[0]).toMatchObject({ place: 1, tied: true });
  });

  it('skips seasons the player was not in', () => {
    expect(careerOf('carla', [s1, s2]).map((c) => c.season)).toEqual(['Stagione 1']);
  });
});

describe('allTimeTable', () => {
  it('adds up every season, newest name, titles from the hall of fame', () => {
    const rows = allTimeTable([s2, s1], [{ season: 'Stagione 1', name: 'Anna', handle: 'anna' }]);
    expect(rows.map((r) => [r.name, r.points, r.played, r.seasons, r.titles])).toEqual([
      ['Anna', 2.5, 4, 2, 1],
      ['Bruno B.', 2.5, 4, 2, 0],
      ['Carla', 0, 2, 1, 0],
    ]);
    expect(allTimeRanks(rows)).toEqual([1, 1, 3]);
  });

  it('includes the season in progress, skipping who has not played yet', () => {
    const current = { season: 'Stagione 3', standings: [row('dario', 'Dario', 0, 0, 0, 0, 0), row('carla', 'Carla', 1, 1, 1, 0, 0)] };
    const rows = allTimeTable([s1], undefined, current);
    expect(rows.find((r) => r.handle === 'carla')).toMatchObject({ points: 1, played: 3, seasons: 2 });
    expect(rows.find((r) => r.handle === 'dario')).toBeUndefined();
  });
});

describe('allTimeRecords', () => {
  const names: Record<string, string> = { anna: 'Anna', bruno: 'Bruno', carla: 'Carla' };
  const nameOf = (h: string) => names[h.toLowerCase()] ?? h;

  it('finds runs, the longest game, the quickest win and the biggest upset', () => {
    const list: SeasonGames[] = [
      {
        season: 'Stagione 1',
        current: false,
        games: [
          g('anna', 'bruno', '1-0', { plies: 21, id: 'quick001' }),
          g('anna', 'carla', '1-0', { plies: 120, id: 'long0001' }),
          g('bruno', 'carla', '0-1', { whiteRating: 1800, blackRating: 1500, id: 'upset001' }),
        ],
      },
      {
        season: 'Stagione 2',
        current: false,
        games: [g('bruno', 'anna', '0-1'), g('anna', 'carla', '½-½'), g('carla', 'anna', '0-1', { status: 'outoftime', plies: 3 })],
      },
    ];
    const records = allTimeRecords(list, nameOf);
    expect(records.map((r) => r.id)).toEqual(['win-streak', 'unbeaten', 'longest', 'quickest', 'upset']);
    expect(records[0]).toMatchObject({ detail: '3 vittorie consecutive di Anna', season: 'Stagione 1 → Stagione 2' });
    expect(records[1].detail).toBe('5 partite senza perdere di Anna');
    expect(records[2]).toMatchObject({ detail: '60 mosse, Anna – Carla (1-0)', url: 'https://lichess.org/long0001' });
    // A win on time is not a quick win
    expect(records[3].detail).toBe('Anna su Bruno in 11 mosse');
    expect(records[4].detail).toBe('Carla batte Bruno, che aveva 300 punti Elo in più');
  });

  it('gives no record for short runs, forfeits or provisional ratings', () => {
    const list: SeasonGames[] = [
      {
        season: 'Stagione 1',
        current: false,
        games: [
          g('anna', 'bruno', '1-0', { status: 'forfeit', plies: undefined }),
          g('bruno', 'carla', '0-1', { whiteRating: 1800, blackRating: 1500, provisional: true, plies: undefined }),
        ],
      },
    ];
    expect(allTimeRecords(list, nameOf)).toEqual([]);
  });
});

describe('allTimeNameOf', () => {
  it('falls back to the latest archived name for former players', () => {
    const nameOf = allTimeNameOf((h) => (h === 'anna' ? 'Anna' : h), [s1, s2]);
    expect(nameOf('anna')).toBe('Anna');
    expect(nameOf('carla')).toBe('Carla');
    expect(nameOf('Bruno')).toBe('Bruno B.');
    expect(nameOf('zeno')).toBe('zeno');
  });
});
