import { describe, expect, it, vi } from 'vitest';
import { closeSeason, SeasonCloseInput, SeasonCloseIO } from '../seasonClose';
import { HistoryGame, LichessExportGame, ScheduledMatch, SeasonArchive, TournamentMeta } from '../../types';

const game = (id: string, white: string, black: string): HistoryGame => ({ round: '1', white, black, url: `https://lichess.org/${id}` });
const history = [game('aaaaaaaa', 'anna', 'bruno'), game('bbbbbbbb', 'carla', 'anna')];
const gameStates: Record<string, LichessExportGame> = {
  aaaaaaaa: { id: 'aaaaaaaa', status: 'mate', winner: 'white' },
  bbbbbbbb: { id: 'bbbbbbbb', status: 'draw' },
};
const input = (patch: Partial<SeasonCloseInput> = {}): SeasonCloseInput => ({
  meta: {
    title: 'Scacchi & Chill',
    season: 'Stagione 2 - Capablanca',
    description: '',
    masterName: 'Capablanca',
    imageUrl: 'media:stagione-2-capablanca',
    subtitle: 'La macchina degli scacchi',
    winners: [{ season: 'Stagione 1', name: 'Bruno', handle: 'bruno' }],
    withdrawals: [{ handle: 'dario', round: '3' } as never],
    masterAnecdotes: [{ title: 'Un aneddoto', text: '…' }],
  },
  players: [
    { handle: 'anna', name: 'Anna' },
    { handle: 'bruno', name: 'Bruno' },
    { handle: 'carla', name: 'Carla' },
  ],
  history,
  gameStates,
  seasons: [],
  nextSeason: '  Stagione 3 - Fischer ',
  nextMaster: ' Bobby Fischer ',
  clearSchedule: true,
  ...patch,
});

// Every step is recorded in one list, so the tests can check the order
function fakeIO(fail: { archive?: boolean; delete?: boolean } = {}) {
  const steps: string[] = [];
  const archives: SeasonArchive[] = [];
  const io = {
    saveSeasonArchive: vi.fn(async (a: SeasonArchive) => {
      steps.push('archive');
      if (fail.archive) throw new Error('rete assente');
      archives.push(a);
    }),
    deleteAllGames: vi.fn(async () => {
      steps.push('delete');
      if (fail.delete) throw new Error('permesso negato');
      return history.length;
    }),
    clearHistory: vi.fn(() => steps.push('clearHistory')),
    onSeasonReset: vi.fn(() => steps.push('reset')),
    onUpdateTournamentMeta: vi.fn((_patch: Partial<TournamentMeta>) => steps.push('meta')),
    onUpdateSchedule: vi.fn((_schedule: ScheduledMatch[]) => steps.push('schedule')),
  } satisfies SeasonCloseIO;
  return { io, steps, archives };
}

describe('closeSeason', () => {
  it('archives the season before deleting its games, then starts the next one', async () => {
    const { io, steps, archives } = fakeIO();
    const saved = await closeSeason(input(), io);
    expect(steps).toEqual(['archive', 'delete', 'clearHistory', 'reset', 'meta', 'schedule']);
    expect(archives).toEqual([saved]);
    expect(saved.id).toBe('stagione-2-capablanca');
    expect(saved.champion).toMatchObject({ handle: 'anna', points: 1.5 });
    expect(saved.gamesPlayed).toBe(2);
    expect(saved.games).toHaveLength(2); // the results go to the archive before the games are deleted
  });

  it('starts the next season clean, with the champion in the hall of fame', async () => {
    const { io } = fakeIO();
    await closeSeason(input(), io);
    const patch = io.onUpdateTournamentMeta.mock.calls[0]![0];
    expect(patch).toMatchObject({
      season: 'Stagione 3 - Fischer',
      masterName: 'Bobby Fischer',
      imageUrl: '',
      subtitle: '',
      withdrawals: [],
      masterAnecdotes: [],
    });
    expect(patch.winners?.map((w: { season: string; handle?: string }) => [w.season, w.handle])).toEqual([
      ['Stagione 1', 'bruno'],
      ['Stagione 2 - Capablanca', 'anna'],
    ]);
    expect(io.onUpdateSchedule).toHaveBeenCalledWith([]);
  });

  it('keeps the schedule when asked to', async () => {
    const { io, steps } = fakeIO();
    await closeSeason(input({ clearSchedule: false }), io);
    expect(io.onUpdateSchedule).not.toHaveBeenCalled();
    expect(steps).not.toContain('schedule');
  });

  it('deletes nothing when the archive cannot be saved', async () => {
    const { io, steps } = fakeIO({ archive: true });
    await expect(closeSeason(input(), io)).rejects.toThrow('rete assente');
    expect(steps).toEqual(['archive']);
    expect(io.deleteAllGames).not.toHaveBeenCalled();
    expect(io.clearHistory).not.toHaveBeenCalled();
    expect(io.onUpdateTournamentMeta).not.toHaveBeenCalled();
  });

  it('leaves the season as it is when the games cannot be deleted (the archive is already safe)', async () => {
    const { io, steps, archives } = fakeIO({ delete: true });
    await expect(closeSeason(input(), io)).rejects.toThrow('permesso negato');
    expect(steps).toEqual(['archive', 'delete']);
    expect(archives).toHaveLength(1);
    expect(io.clearHistory).not.toHaveBeenCalled();
    expect(io.onUpdateTournamentMeta).not.toHaveBeenCalled();
    expect(io.onUpdateSchedule).not.toHaveBeenCalled();
  });

  it('replaces the archive of a season closed again, and does not add its champion twice', async () => {
    const first = fakeIO();
    const archived = await closeSeason(input(), first.io);
    const winners = first.io.onUpdateTournamentMeta.mock.calls[0]![0].winners!;
    const again = fakeIO();
    await closeSeason(input({ seasons: [archived], meta: { ...input().meta, winners } }), again.io);
    expect(again.archives[0]!.id).toBe(archived.id);
    expect(again.io.onUpdateTournamentMeta.mock.calls[0]![0].winners).toHaveLength(2);
  });
});
