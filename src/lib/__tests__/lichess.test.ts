import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChallenge, fetchGameStates, fetchUsers } from '../lichess';
import { Settings } from '../../types';

afterEach(() => vi.unstubAllGlobals());

const settings: Settings = { token: 'lip_x', days: 2, expiry: 2, rated: true, rules: { noRematch: true, noGiveTime: false } } as Settings;

describe('fetchGameStates', () => {
  it('asks for the games with opening and phase, and reads the NDJSON answer', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"aaaaaaaa","status":"mate"}\n\nnot json\n{"id":"bbbbbbbb","status":"started"}\n'));
    vi.stubGlobal('fetch', fetchMock);
    const states = await fetchGameStates(['aaaaaaaa', 'bbbbbbbb']);
    expect(Object.keys(states)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('opening=true');
    expect(url).toContain('division=true');
    expect(init.body).toBe('aaaaaaaa,bbbbbbbb');
  });
  it('does not call Lichess without games', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchGameStates([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('fails on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    await expect(fetchGameStates(['aaaaaaaa'])).rejects.toThrow('HTTP 429');
  });
});

describe('createChallenge', () => {
  it('opens a challenge for the two players with the round in its name', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: 'https://lichess.org/abcdefgh' })));
    vi.stubGlobal('fetch', fetchMock);
    const url = await createChallenge({ white: 'anna', black: 'bruno', url: '' }, { round: '3', settings, challengeName: 'Turno {round}' });
    expect(url).toBe('https://lichess.org/abcdefgh');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(body.get('users')).toBe('anna,bruno');
    expect(body.get('name')).toBe('Turno 3');
    expect(body.get('days')).toBe('2');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer lip_x');
  });
  it('explains an expired token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 401 })));
    await expect(createChallenge({ white: 'a', black: 'b', url: '' }, { round: '1', settings, challengeName: 'T' })).rejects.toThrow(
      /Token non valido/
    );
  });
});

describe('fetchUsers', () => {
  it('asks for all the players in one call', async () => {
    const fetchMock = vi.fn(async () => new Response('[{"id":"anna"},{"id":"bruno"}]'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchUsers(['Anna', 'bruno'])).toEqual([{ id: 'anna' }, { id: 'bruno' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://lichess.org/api/users');
    expect(init.body).toBe('Anna,bruno');
  });
  it('splits beyond the 300 names Lichess takes per call', async () => {
    const fetchMock = vi.fn(async () => new Response('[]'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchUsers(Array.from({ length: 301 }, (_, i) => `p${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('fails on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    await expect(fetchUsers(['anna'])).rejects.toThrow('429');
  });
});
