import { describe, expect, it } from 'vitest';
import { googleAuthUrl, parseGoogleAnswer, redirectUri } from '../googleRedirect';

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (nonce: string) => `${b64url({ alg: 'RS256' })}.${b64url({ email: 'a@b.c', nonce })}.sig`;
const request = { state: 's1', nonce: 'n1' };

describe('Google sign-in of the installed app', () => {
  it('sends Google back to the site address, without query or hash', () => {
    expect(redirectUri('https://u.github.io/scacchi-and-chill/?admin#admin')).toBe('https://u.github.io/scacchi-and-chill/');
    expect(redirectUri('http://localhost:3000/#admin')).toBe('http://localhost:3000/');
    expect(redirectUri('https://u.github.io/scacchi-and-chill/index.html')).toBe('https://u.github.io/scacchi-and-chill/');
  });

  it('asks for an ID token with the state and the nonce', () => {
    const url = new URL(googleAuthUrl('cid', 'https://u.github.io/x/', 's1', 'n1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: 'cid', redirect_uri: 'https://u.github.io/x/', response_type: 'id_token', state: 's1', nonce: 'n1' });
  });

  it('accepts the token of its own request', () => {
    const t = token('n1');
    expect(parseGoogleAnswer(`#id_token=${t}&state=s1&authuser=0`, request)).toEqual({ idToken: t });
  });

  it('refuses an answer to another request (state or nonce), or with no request at all', () => {
    expect(parseGoogleAnswer(`#id_token=${token('n1')}&state=other`, request)).toHaveProperty('error');
    expect(parseGoogleAnswer(`#id_token=${token('other')}&state=s1`, request)).toHaveProperty('error');
    expect(parseGoogleAnswer(`#id_token=${token('n1')}&state=s1`, null)).toHaveProperty('error');
    expect(parseGoogleAnswer('#id_token=garbage&state=s1', request)).toHaveProperty('error');
  });

  it('says nothing when the organizer cancels, explains other errors', () => {
    expect(parseGoogleAnswer('#error=access_denied&state=s1', request)).toEqual({ error: '' });
    expect((parseGoogleAnswer('#error=invalid_request&state=s1', request) as { error: string }).error).toContain('invalid_request');
  });

  it('leaves the ordinary addresses of the site alone', () => {
    for (const hash of ['', '#admin', '#/giocatore/anna', '#/classifica']) expect(parseGoogleAnswer(hash, request)).toBeNull();
  });
});
