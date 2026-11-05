import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChallenge, fetchGameStates } from '../lichess';
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
