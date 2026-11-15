import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a Node script without types
import { encryptPayload, moveText, movesNews, notificationFor, PUSH_ENDPOINT, sameState, vapidHeader, vapidKeys } from '../../../scripts/push.mjs';

const games = [
  { id: 'aaaaaaaa', white: 'anna', black: 'bruno' },
  { id: 'bbbbbbbb', white: 'carla', black: 'dario' },
];
const names: Record<string, string> = { anna: 'Anna', bruno: 'Bruno', carla: 'Carla', dario: 'Dario' };
const nameOf = (h: string) => names[h] ?? h;

describe('push of the moves: what to tell', () => {
  it('records the state on the first run without telling anything', () => {
    const { news, state } = movesNews(games, { aaaaaaaa: { status: 'started', moves: 'e4 e5' } }, null);
    expect(news).toEqual([]);
    expect(state).toEqual({ games: { aaaaaaaa: { plies: 2, final: false } } });
  });

  it('tells the new moves and the ends, and keeps the games not read now', () => {
    const prev = { games: { aaaaaaaa: { plies: 2, final: false }, bbbbbbbb: { plies: 10, final: false } } };
    const { news, state } = movesNews(games, { aaaaaaaa: { status: 'started', moves: 'e4 e5 Nf3 Nc6 Bb5' } }, prev);
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ id: 'aaaaaaaa', newPlies: 3, plies: 5, lastSan: 'Bb5', ended: false });
    expect(state.games.bbbbbbbb).toEqual({ plies: 10, final: false });

    const end = movesNews(games, { bbbbbbbb: { status: 'resign', winner: 'black', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7' } }, prev);
    expect(end.news[0]).toMatchObject({ ended: true, newPlies: 0, winner: 'black' });
  });

  it('tells nothing for a game that did not change, nor for one never played', () => {
    const prev = { games: { aaaaaaaa: { plies: 2, final: false } } };
    expect(movesNews(games, { aaaaaaaa: { status: 'started', moves: 'e4 e5' } }, prev).news).toEqual([]);
    expect(movesNews(games, { bbbbbbbb: { status: 'aborted' } }, prev).news).toEqual([]);
    expect(movesNews(games, { bbbbbbbb: { status: 'created' } }, prev).news).toEqual([]);
  });

  it('a game of a new round with moves already made is news', () => {
    const { news } = movesNews(games, { bbbbbbbb: { status: 'started', moves: 'd4' } }, { games: {} });
    expect(news[0]).toMatchObject({ id: 'bbbbbbbb', newPlies: 1, lastSan: 'd4' });
  });

  it('writes the state again only when it changed', () => {
    expect(sameState(null, { games: {} })).toBe(false);
    expect(sameState({ games: { a: { plies: 1, final: false } } }, { games: { a: { plies: 1, final: false } } })).toBe(true);
    expect(sameState({ games: { a: { plies: 1, final: false } } }, { games: { a: { plies: 2, final: false } } })).toBe(false);
  });
});

describe('push of the moves: the notification', () => {
  const one = { id: 'aaaaaaaa', white: 'anna', black: 'bruno', newPlies: 1, plies: 5, lastSan: 'Bb5', ended: false, status: 'started' };
  const two = { id: 'bbbbbbbb', white: 'carla', black: 'dario', newPlies: 0, plies: 40, lastSan: 'Qh7#', ended: true, status: 'mate', winner: 'white' };

  it('numbers the moves', () => {
    expect(moveText(5, 'Bb5')).toBe('3. Bb5');
    expect(moveText(6, 'Nf6')).toBe('3… Nf6');
  });

  it('for one game, its players and the move', () => {
    expect(notificationFor([one], nameOf, '')).toEqual({ title: 'Anna – Bruno', body: 'Nuova mossa: 3. Bb5', hash: '#/partite' });
    expect(notificationFor([{ ...one, newPlies: 3 }], nameOf, '').body).toBe("3 mosse nuove, l'ultima 3. Bb5");
    expect(notificationFor([two], nameOf, '').body).toBe('Finita: vince Carla (1-0)');
    expect(notificationFor([{ ...two, winner: undefined, status: 'draw' }], nameOf, '').body).toBe('Finita: patta (½-½)');
  });

  it('for several games, one line each', () => {
    const n = notificationFor([one, two], nameOf, '');
    expect(n.title).toBe('Mosse nuove in 2 partite');
    expect(n.body).toBe('Anna – Bruno: 3. Bb5\nCarla – Dario: finita, vince Carla (1-0)');
  });

  it("skips the subscriber's own games, and says nothing when only those moved", () => {
    expect(notificationFor([one, two], nameOf, 'Bruno').title).toBe('Carla – Dario');
    expect(notificationFor([one], nameOf, 'anna')).toBeNull();
  });
});

describe('push of the moves: Web Push', () => {
  it('only the push services of the browsers', () => {
    expect(PUSH_ENDPOINT.test('https://fcm.googleapis.com/fcm/send/abc:def')).toBe(true);
    expect(PUSH_ENDPOINT.test('https://web.push.apple.com/QAbc')).toBe(true);
    expect(PUSH_ENDPOINT.test('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(PUSH_ENDPOINT.test('https://wns2-db5p.notify.windows.com/w/?token=x')).toBe(true);
    expect(PUSH_ENDPOINT.test('https://example.com/fcm.googleapis.com/x')).toBe(false);
    expect(PUSH_ENDPOINT.test('http://fcm.googleapis.com/x')).toBe(false);
  });

  it('the public key of push.json is a valid P-256 key', () => {
    const { vapidPublicKey } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../push.json'), 'utf8'));
    const raw = Buffer.from(vapidPublicKey, 'base64url');
    expect(raw.length).toBe(65);
    expect(() => crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' })).not.toThrow();
  });

  it('signs a VAPID token the push service can check', () => {
    const k = crypto.createECDH('prime256v1');
    k.generateKeys();
    const vapid = vapidKeys(k.getPrivateKey().toString('base64url'));
    expect(vapid.publicKey).toBe(k.getPublicKey().toString('base64url'));
    const header = vapidHeader('https://fcm.googleapis.com/fcm/send/x', vapid, 'https://example.com', 1_700_000_000_000);
    const [, jwt, pub] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_700_000_000 + 12 * 3600, sub: 'https://example.com' });
    const raw = Buffer.from(pub, 'base64url');
    const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true);
  });

  // The browser's side of RFC 8291 (checked once against the http_ece library as well)
  it('encrypts a payload only the browser can read', () => {
    const ua = crypto.createECDH('prime256v1');
    ua.generateKeys();
    const auth = crypto.randomBytes(16);
    const body: Buffer = encryptPayload('{"title":"Anna – Bruno ½"}', ua.getPublicKey().toString('base64url'), auth.toString('base64url'));
    const salt = body.subarray(0, 16);
    expect(body.readUInt32BE(16)).toBe(4096);
    const idlen = body[20];
    const asPublic = body.subarray(21, 21 + idlen);
    const hmac = (key: Buffer, data: Buffer) => crypto.createHmac('sha256', key).update(data).digest();
    const shared = ua.computeSecret(asPublic);
    const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic, Buffer.from([1])]));
    const prk = hmac(salt, ikm);
    const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
    const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
    const data = body.subarray(21 + idlen);
    const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(data.subarray(data.length - 16));
    const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
    expect(plain[plain.length - 1]).toBe(2);
    expect(plain.subarray(0, -1).toString('utf8')).toBe('{"title":"Anna – Bruno ½"}');
  });
});
