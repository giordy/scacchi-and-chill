import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXPIRING_DAYS, tokenCheck, tokenInfoOf, tokenWarning } from '../tokenCheck';
import { testToken } from '../lichess';
import { TokenStatus } from '../../tabs/settings/TokenSection';

const NOW = Date.UTC(2026, 10, 24, 12);
const DAY = 86400000;

describe('the Lichess token', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the answer of Lichess for the token asked', () => {
    const body = { lip_abc: { scopes: 'challenge:read,challenge:write', userId: 'giordy', expires: NOW + 90 * DAY } };
    expect(tokenInfoOf(body, 'lip_abc')).toEqual({ userId: 'giordy', scopes: ['challenge:read', 'challenge:write'], expires: NOW + 90 * DAY });
    expect(tokenInfoOf({ lip_abc: { scopes: '', userId: 'giordy', expires: null } }, 'lip_abc')).toEqual({ userId: 'giordy', scopes: [] });
    expect(tokenInfoOf({ lip_abc: null }, 'lip_abc')).toBeNull();
    expect(tokenInfoOf({}, 'lip_abc')).toBeNull();
    expect(tokenInfoOf(null, 'lip_abc')).toBeNull();
  });

  it('asks Lichess with the token in the body, and throws when Lichess cannot answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lip_abc: { scopes: 'challenge:write', userId: 'giordy' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await testToken('lip_abc')).toEqual({ userId: 'giordy', scopes: ['challenge:write'] });
    expect(fetchMock).toHaveBeenCalledWith('https://lichess.org/api/token/test', expect.objectContaining({ method: 'POST', body: 'lip_abc' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(testToken('lip_abc')).rejects.toThrow('HTTP 503');
  });

  it('tells a token that works from one that does not, or soon will not', () => {
    const info = (scopes: string[], expires?: number) => ({ userId: 'giordy', scopes, ...(expires ? { expires } : {}) });
    expect(tokenCheck(null, NOW)).toEqual({ kind: 'invalid' });
    expect(tokenCheck(info(['challenge:write'], NOW - 1), NOW)).toEqual({ kind: 'invalid' });
    expect(tokenCheck(info(['challenge:read']), NOW)).toEqual({ kind: 'noChallenge', userId: 'giordy' });
    expect(tokenCheck(info(['challenge:write'], NOW + 3 * DAY), NOW)).toEqual({ kind: 'expiring', userId: 'giordy', expires: NOW + 3 * DAY });
    expect(tokenCheck(info(['challenge:write'], NOW + EXPIRING_DAYS * DAY), NOW).kind).toBe('ok');
    expect(tokenCheck(info(['challenge:write']), NOW)).toEqual({ kind: 'ok', userId: 'giordy' });
  });

  it('warns at the top only when something is wrong', () => {
    expect(tokenWarning(null)).toBeNull();
    expect(tokenWarning({ kind: 'ok' })).toBeNull();
    expect(tokenWarning({ kind: 'invalid' })).toContain('non vale più');
    expect(tokenWarning({ kind: 'noChallenge' })).toContain('permesso Challenge');
    expect(tokenWarning({ kind: 'expiring', expires: Date.UTC(2026, 11, 8, 12) })).toBe('Il token Lichess scade martedì 8 dicembre: creane uno nuovo prima del prossimo turno.');
  });

  it('says in Impostazioni what Lichess said', () => {
    const html = (check: Parameters<typeof TokenStatus>[0]['check']) => renderToStaticMarkup(React.createElement(TokenStatus, { check }));
    expect(html(null)).toBe('');
    expect(html({ kind: 'ok', userId: 'giordy' })).toContain('Valido, dell&#x27;account @giordy, con il permesso Challenge, senza scadenza.');
    expect(html({ kind: 'ok', userId: 'giordy', expires: Date.UTC(2027, 5, 1, 12) })).toContain('scade martedì 1 giugno');
    expect(html({ kind: 'invalid' })).toContain('non vale più');
  });
});
