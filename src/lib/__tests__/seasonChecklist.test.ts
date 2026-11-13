import { describe, expect, it } from 'vitest';
import { closeReminders, ChecklistInput, photoSearchUrl, seasonChecklist, toggleTick } from '../seasonChecklist';
import { pledgeStatus } from '../pledges';
import { HistoryGame, TournamentMeta } from '../../types';

const players = [
  { handle: 'anna', name: 'Anna' },
  { handle: 'bruno', name: 'Bruno' },
];
const meta: TournamentMeta = { title: 'Scacchi & Chill', season: 'Stagione 3 - Fischer', description: '', masterName: 'Bobby Fischer' };
const done = (round: string, white: string, black: string): HistoryGame => ({ round, white, black, url: '', lichess: { id: '', status: 'mate', winner: 'white' } });
const open = (round: string, white: string, black: string): HistoryGame => ({ round, white, black, url: '' });
const input = (patch: Partial<ChecklistInput> = {}): ChecklistInput => ({ meta, players, schedule: [], history: [], gameStates: {}, ticks: {}, ...patch });
const step = (c: ReturnType<typeof seasonChecklist>, key: string) => c!.steps.find((s) => s.key === key)!;

describe('the checklist between two seasons', () => {
  it('is not shown while the season is being played', () => {
    expect(seasonChecklist(input({ history: [done('1', 'anna', 'bruno'), open('2', 'bruno', 'anna')] }))).toBeNull();
    expect(seasonChecklist(input({ meta: undefined }))).toBeNull();
  });

  it('once the last game is over, lists what closes the season, with the ticks of that season', () => {
    const c = seasonChecklist(input({ history: [done('1', 'anna', 'bruno')], ticks: { 'stagione-3-fischer': ['review'], other: ['awards'] } }))!;
    expect(c.phase).toBe('end');
    expect(c.steps.map((s) => [s.key, s.done])).toEqual([
      ['games', true],
      ['review', true],
      ['awards', false],
      ['backup', false],
      ['close', false],
    ]);
    expect(step(c, 'close')).toMatchObject({ tab: 'seasons', section: 'fine-stagione' });
  });

  it('after closing, follows the new season from the data until its games are created', () => {
    const bare = seasonChecklist(input())!;
    expect(bare.phase).toBe('prepare');
    expect(bare.steps.filter((s) => s.done)).toEqual([]);
    expect(step(bare, 'photo').link?.href).toBe(photoSearchUrl('Bobby Fischer'));

    const ready = seasonChecklist(
      input({
        meta: {
          ...meta,
          subtitle: 'Il genio solitario',
          masterAnecdotes: [{ title: 'a', text: 'b' }],
          famousGame: { url: 'https://lichess.org/abcdefgh', title: 'Byrne – Fischer' },
          imageUrl: 'media:stagione-3-fischer',
        },
        schedule: [{ round: '1', white: 'anna', black: 'bruno' }, { round: '2', white: 'bruno', black: 'anna' }],
        pledges: pledgeStatus([{ handle: 'anna', season: meta.season, at: 1, rules: 'x' }, { handle: 'bruno', season: meta.season, at: 2, rules: 'x' }], meta.season, players, 'x'),
        ticks: { 'stagione-3-fischer': ['players', 'rules'] },
      })
    )!;
    expect(ready.steps.filter((s) => !s.done).map((s) => s.key)).toEqual(['round1']);
    expect(step(ready, 'calendar').detail).toBe('2 turni');
    expect(step(ready, 'photo').link).toBeUndefined();
    expect(step(ready, 'pledges').detail).toMatch(/^2 su 2/);
  });
});

describe('before closing', () => {
  it('says the games still open and the final messages not ticked', () => {
    const history = [done('1', 'anna', 'bruno'), open('2', 'bruno', 'anna')];
    expect(closeReminders(input({ history }))).toEqual(['1 partita non ancora conclusa', 'il racconto finale non risulta mandato', 'i premi non risultano mandati']);
    expect(closeReminders(input({ history: [done('1', 'anna', 'bruno')], ticks: { 'stagione-3-fischer': ['review', 'awards'] } }))).toEqual([]);
  });
});

describe('toggleTick', () => {
  it('ticks and unticks a step of a season', () => {
    const once = toggleTick({}, 's3', 'review');
    expect(once).toEqual({ s3: ['review'] });
    expect(toggleTick(once, 's3', 'review')).toEqual({ s3: [] });
  });
});
