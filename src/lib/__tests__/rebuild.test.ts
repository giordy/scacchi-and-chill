import { describe, expect, it } from 'vitest';
import { isCurrentSeasonGame, isTournamentCandidate, lastMoveOf, lichessIdsFromText, playersOfGames, rebuildArchive, rebuiltHistory } from '../rebuild';
import { LichessExportGame } from '../../types';

const game = (id: string, white: string, black: string, extra: Partial<LichessExportGame> = {}): LichessExportGame => ({
  id,
  status: 'resign',
  winner: 'white',
  speed: 'correspondence',
  createdAt: 100,
  players: { white: { user: { name: white } }, black: { user: { name: black } } },
  ...extra,
});

describe('lichessIdsFromText', () => {
  it('finds game ids in a WhatsApp export, once each', () => {
    const chat = [
      '12/09/25, 21:14 - Fabio: finita! https://lichess.org/AbCd1234',
      '13/09/25, 08:02 - Matteo: https://lichess.org/AbCd1234wXyZ ahah',
      '14/09/25, 10:00 - Giordano: lichess.org/game/ZzZz9999 e https://lichess.org/@/fsgach',
      '15/09/25, 10:00 - Luca: https://lichess.org/study/abcdefgh https://lichess.org/tournament',
      '16/09/25, 10:00 - Luca: https://lichess.org/Qwer5678/black#40',
    ].join('\n');
    expect(lichessIdsFromText(chat)).toEqual(['AbCd1234', 'ZzZz9999', 'Qwer5678']);
  });
});

describe('isTournamentCandidate', () => {
  it('keeps correspondence games between two accounts', () => {
    expect(isTournamentCandidate(game('a', 'x', 'y'))).toBe(true);
    expect(isTournamentCandidate(game('a', 'x', 'y', { speed: 'blitz' }))).toBe(false);
    expect(isTournamentCandidate(game('a', 'x', 'y', { players: { white: { user: { name: 'x' } }, black: {} } }))).toBe(false);
  });
});

describe('playersOfGames', () => {
  it('counts games per player, whatever the case', () => {
    expect(playersOfGames([game('a', 'Fabio', 'matteo'), game('b', 'fabio', 'Luca')])).toEqual([
      { handle: 'Fabio', games: 2 }, // the first spelling met
      { handle: 'Luca', games: 1 },
      { handle: 'matteo', games: 1 },
    ]);
  });
});

describe('rebuiltHistory', () => {
  it('keeps games among the chosen players, oldest first, then the forfeits', () => {
    const players = [
      { handle: 'Fabio', name: 'Fabio' },
      { handle: 'matteo', name: 'Matteo' },
    ];
    const history = rebuiltHistory(
      [game('bbbbbbbb', 'fabio', 'Matteo', { createdAt: 200 }), game('aaaaaaaa', 'matteo', 'fabio', { createdAt: 100 }), game('cccccccc', 'fabio', 'stranger')],
      players,
      [{ white: 'Fabio', black: 'matteo', winner: 'black' }]
    );
    expect(history.map((h) => [h.white, h.black, h.url, h.round])).toEqual([
      ['matteo', 'Fabio', 'https://lichess.org/aaaaaaaa', '–'],
      ['Fabio', 'matteo', 'https://lichess.org/bbbbbbbb', '–'],
      ['Fabio', 'matteo', '', '–'],
    ]);
    expect(history[2].lichess).toEqual({ id: '', status: 'forfeit', winner: 'black' });
  });
});

describe('rebuiltHistory with a substitute', () => {
  const players = [
    { handle: 'fsgach', name: 'Fabio' },
    { handle: 'matepaco', name: 'Paco' },
  ];
  const games = [game('aaaaaaaa', 'gredip', 'fsgach'), game('bbbbbbbb', 'fsgach', 'matepaco'), game('cccccccc', 'gredip', 'matepaco')];

  it('hands the games of who left to the substitute', () => {
    const history = rebuiltHistory(games, players, [], { gredip: 'matepaco' });
    // gredip vs matepaco would be the substitute against themselves: dropped
    expect(history.map((h) => [h.white, h.black])).toEqual([
      ['matepaco', 'fsgach'],
      ['fsgach', 'matepaco'],
    ]);
  });

  it('drops them without a substitute', () => {
    expect(rebuiltHistory(games, players).map((h) => h.url)).toEqual(['https://lichess.org/bbbbbbbb']);
  });
});

describe('isCurrentSeasonGame', () => {
  const current = [{ round: '1', white: 'a', black: 'b', url: 'https://lichess.org/zzzzzzzz', createdAt: 1000 }];

  it('leaves out the games the site has and those created since', () => {
    expect(isCurrentSeasonGame(game('zzzzzzzz', 'a', 'b', { createdAt: 10 }), current)).toBe(true);
    expect(isCurrentSeasonGame(game('yyyyyyyy', 'a', 'b', { createdAt: 1000 }), current)).toBe(true);
    expect(isCurrentSeasonGame(game('xxxxxxxx', 'a', 'b', { createdAt: 999 }), current)).toBe(false);
    expect(isCurrentSeasonGame(game('xxxxxxxx', 'a', 'b'), [])).toBe(false);
  });
});

describe('lastMoveOf', () => {
  it('is the latest move of the games', () => {
    expect(lastMoveOf([game('a', 'x', 'y', { lastMoveAt: 500 }), game('b', 'x', 'y', { lastMoveAt: 900 })])?.getTime()).toBe(900);
    expect(lastMoveOf([])).toBeUndefined();
  });
});

describe('rebuildArchive, from the chat to the archive', () => {
  // Greta (gredip) leaves after two games and matepaco takes over; a friendly game and a blitz
  // game were shared in the chat too, and a forfeit was given by hand
  const at = (day: number) => Date.UTC(2025, 8, day);
  const lichess = [
    game('aaaaaaa1', 'fsgach', 'gredip', { winner: 'white', createdAt: at(1), lastMoveAt: at(10) }),
    game('aaaaaaa2', 'gredip', 'battimat', { winner: 'black', createdAt: at(2), lastMoveAt: at(11) }),
    game('aaaaaaa3', 'matepaco', 'fsgach', { status: 'draw', winner: undefined, createdAt: at(20), lastMoveAt: at(30) }),
    game('aaaaaaa4', 'battimat', 'fsgach', { winner: 'black', createdAt: at(21), lastMoveAt: Date.UTC(2025, 10, 5) }),
    game('aaaaaaa5', 'fsgach', 'amico', { createdAt: at(22) }),
    game('aaaaaaa6', 'fsgach', 'battimat', { speed: 'blitz', createdAt: at(23) }),
  ];
  const chat = lichess.map((g) => `1/9/25, 10:00 - X: finita https://lichess.org/${g.id}`).join('\n');

  const ids = lichessIdsFromText(chat);
  const candidates = lichess.filter((g) => ids.includes(g.id)).filter(isTournamentCandidate);
  const players = [
    { handle: 'fsgach', name: 'Fabio' },
    { handle: 'battimat', name: 'Matteo' },
    { handle: 'matepaco', name: 'Paco' },
  ];
  const archive = rebuildArchive({
    title: 'Scacchi & Chill',
    season: 'Scacchi & Chill - Stagione 1',
    master: 'Tal',
    games: candidates,
    players,
    manual: [{ white: 'matepaco', black: 'battimat', winner: 'black' }],
    replaced: [{ handle: 'gredip', name: 'Greta', by: 'matepaco' }],
  });

  it('counts only the tournament games, with the substitute in place of who left', () => {
    expect(candidates).toHaveLength(5);
    expect(archive.standings.map((s) => [s.handle, s.points, s.played])).toEqual([
      ['fsgach', 2.5, 3], // beat Greta (now Paco), drew Paco, beat Matteo
      ['battimat', 2, 3], // beat Greta (now Paco), lost to Fabio, won the forfeit
      ['matepaco', 0.5, 4], // Greta's two games, the draw with Fabio, the forfeit
    ]);
    expect(archive.champion).toEqual({ handle: 'fsgach', name: 'Fabio', points: 2.5 });
    // The game with an outsider is left out, the blitz one never got in
    expect(archive.gamesPlayed).toBe(5);
  });

  it('keeps the games, the note on who left, the period and the master', () => {
    // Rounds are unknown: by date, the forfeit (no date) first
    expect(archive.games?.map((g) => [g.white, g.black, g.result])).toEqual([
      ['matepaco', 'battimat', '0-1'],
      ['fsgach', 'matepaco', '1-0'],
      ['matepaco', 'battimat', '0-1'],
      ['matepaco', 'fsgach', '½-½'],
      ['battimat', 'fsgach', '0-1'],
    ]);
    expect(archive.departures).toEqual([
      { handle: 'gredip', name: 'Greta', mode: 'replaced', replacedBy: { handle: 'matepaco', name: 'Paco' } },
    ]);
    expect([archive.start, archive.end]).toEqual(['2025-09', '2025-11']);
    expect(archive.archivedAt).toBe(new Date(Date.UTC(2025, 10, 5)).toISOString());
    expect(archive.masterName).toBe('Tal');
    expect(archive.id).toBe('scacchi-chill-stagione-1');
  });

  it('ignores a replacement by someone who is not a player', () => {
    const a = rebuildArchive({
      title: 'T',
      season: 'S',
      games: candidates,
      players,
      replaced: [{ handle: 'gredip', name: 'Greta', by: 'nessuno' }],
    });
    expect(a).not.toHaveProperty('departures');
    expect(a.games?.some((g) => g.white === 'gredip' || g.black === 'gredip')).toBe(false);
  });
});
