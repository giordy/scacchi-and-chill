import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a Node script without types
import { encryptPayload, movesNews, notificationFor, PUSH_ENDPOINT, sameState, vapidHeader, vapidKeys } from '../../../scripts/push.mjs';

const games = [
  { id: 'aaaaaaaa', white: 'anna', black: 'bruno', round: '3' },
  { id: 'bbbbbbbb', white: 'carla', black: 'dario', round: '3' },
];
const names: Record<string, string> = { anna: 'Anna', bruno: 'Bruno', carla: 'Carla', dario: 'Dario' };
const nameOf = (h: string) => names[h] ?? h;

describe('push of the moves: what to tell', () => {
  it('records the state on the first run without telling anything', () => {
    const { news, state } = movesNews(games, { aaaaaaaa: { status: 'started', moves: 'e4 e5', lastMoveAt: 100 } }, null);
    expect(news).toEqual([]);
    expect(state).toEqual({ games: { aaaaaaaa: { at: 100, final: false } } });
  });

  it('tells a move from the time of the last move, not from the moves listed (Lichess hides the latest)', () => {
    const prev = { games: { aaaaaaaa: { at: 100, final: false }, bbbbbbbb: { at: 50, final: false } } };
    // Same moves listed, a later move: somebody moved
    const { news, state } = movesNews(games, { aaaaaaaa: { status: 'started', moves: 'e4 e5', lastMoveAt: 200 } }, prev);
    expect(news).toEqual([{ id: 'aaaaaaaa', white: 'anna', black: 'bruno', round: '3', ended: false, winner: undefined, at: 200 }]);
    // Not read now: kept as it was
    expect(state.games.bbbbbbbb).toEqual({ at: 50, final: false });
  });

  it('tells the first moves of a game, all hidden by Lichess', () => {
    const { news } = movesNews(games, { bbbbbbbb: { status: 'started', lastMoveAt: 300 } }, { games: { bbbbbbbb: { at: 0, final: false } } });
    expect(news.map((n: { id: string }) => n.id)).toEqual(['bbbbbbbb']);
  });

  it('tells the end of a game, not of one never played', () => {
    const prev = { games: { aaaaaaaa: { at: 100, final: false }, bbbbbbbb: { at: 50, final: false } } };
    const end = movesNews(games, { aaaaaaaa: { status: 'resign', winner: 'black', lastMoveAt: 400 }, bbbbbbbb: { status: 'aborted', lastMoveAt: 50 } }, prev);
    expect(end.news).toHaveLength(1);
    expect(end.news[0]).toMatchObject({ id: 'aaaaaaaa', ended: true, winner: 'black' });
  });

  it('tells nothing for a challenge not accepted, nor for an unchanged game', () => {
    const prev = { games: { aaaaaaaa: { at: 100, final: false } } };
    expect(movesNews(games, { aaaaaaaa: { status: 'started', lastMoveAt: 100 } }, prev).news).toEqual([]);
    expect(movesNews(games, { bbbbbbbb: { status: 'created', lastMoveAt: 500 } }, prev).news).toEqual([]);
  });

  it('a game kept before the time was recorded: no notification until its next move', () => {
    const prev = { games: { aaaaaaaa: { plies: 12, final: false } } };
    const first = movesNews(games, { aaaaaaaa: { status: 'started', lastMoveAt: 100 } }, prev);
    expect(first.news).toEqual([]);
    expect(movesNews(games, { aaaaaaaa: { status: 'started', lastMoveAt: 200 } }, first.state).news).toHaveLength(1);
  });

  it('writes the state again only when it changed', () => {
    expect(sameState(null, { games: {} })).toBe(false);
    expect(sameState({ games: { a: { at: 1, final: false } } }, { games: { a: { at: 1, final: false } } })).toBe(true);
    expect(sameState({ games: { a: { at: 1, final: false } } }, { games: { a: { at: 2, final: false } } })).toBe(false);
  });
});

describe('push of the moves: the notification', () => {
  const one = { id: 'aaaaaaaa', white: 'anna', black: 'bruno', round: '3', ended: false };
  const two = { id: 'bbbbbbbb', white: 'carla', black: 'dario', round: '3', ended: true, winner: 'white' };

  it('for one game, its players and round, never a move', () => {
    expect(notificationFor([one], nameOf, '')).toEqual({ title: 'Anna – Bruno', body: 'Turno 3: nuova mossa', hash: '#/partite' });
    expect(notificationFor([two], nameOf, '').body).toBe('Turno 3: finita, vince Carla (1-0)');
    expect(notificationFor([{ ...two, winner: undefined }], nameOf, '').body).toBe('Turno 3: finita, patta (½-½)');
  });

  it('for several games, one line each: the players, and the result when it ended', () => {
    const n = notificationFor([one, two], nameOf, '');
    expect(n.title).toBe('Si muove in 2 partite');
    expect(n.body).toBe('Anna – Bruno\nCarla – Dario: finita, vince Carla (1-0)');
  });

  it("skips the subscriber's own games, and says nothing when only those moved", () => {
    expect(notificationFor([one, two], nameOf, 'Bruno').title).toBe('Carla – Dario');
    expect(notificationFor([one], nameOf, 'anna')).toBeNull();
  });

  it('skips the moves the subscriber has already seen on the Partite tab, not the end of a game', () => {
    const moved = { ...one, at: 500 };
    // Seen that very move, or a later one: nothing to tell
    expect(notificationFor([moved], nameOf, '', { [moved.id]: 500 })).toBeNull();
    expect(notificationFor([moved], nameOf, '', { [moved.id]: 600 })).toBeNull();
    // Seen an earlier move only, or nothing of it: told
    expect(notificationFor([moved], nameOf, '', { [moved.id]: 400 })?.body).toBe('Turno 3: nuova mossa');
    expect(notificationFor([moved], nameOf, '', { other: 900 })?.body).toBe('Turno 3: nuova mossa');
    expect(notificationFor([moved], nameOf, '', undefined)?.body).toBe('Turno 3: nuova mossa');
    // The end is told even with its last move seen
    expect(notificationFor([{ ...two, at: 700 }], nameOf, '', { [two.id]: 700 })?.body).toBe('Turno 3: finita, vince Carla (1-0)');
    // Of two games, only the one not seen is left
    expect(notificationFor([moved, { ...two, ended: false, at: 800 }], nameOf, '', { [moved.id]: 500 })?.title).toBe('Carla – Dario');
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

describe('push of the moves: what the page writes of the moves seen', () => {
  it('only the field seen, on a subscription that exists, newest games first and capped', async () => {
    const { seenCommit, pushCommit } = await import('../push');
    const w = seenCommit('db', 'ID', { aaaaaaaa: 100, bad: 5, bbbbbbbb: 0 }).writes[0];
    expect(w.updateMask).toEqual({ fieldPaths: ['seen'] });
    expect(w.currentDocument).toEqual({ exists: true });
    expect(w.update.fields).toEqual({ seen: { mapValue: { fields: { aaaaaaaa: { integerValue: '100' } } } } });
    const many = Object.fromEntries(Array.from({ length: 310 }, (_, i) => [`g${String(i).padStart(7, '0')}`, i + 1]));
    const kept = Object.keys(seenCommit('db', 'ID', many).writes[0].update.fields.seen.mapValue.fields);
    expect(kept).toHaveLength(300);
    expect(kept).not.toContain('g0000000');
    // The full write keeps the moves seen when given
    const sub = { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'p', auth: 'a' };
    expect(pushCommit('db', 'ID', sub, '', { aaaaaaaa: 1 }).writes[0].update.fields).toHaveProperty('seen');
    expect(pushCommit('db', 'ID', sub, '').writes[0].update.fields).not.toHaveProperty('seen');
  });
});

// @ts-expect-error a Node script without types
import { deadlineNotification, expiredRoundOf } from '../../../scripts/push.mjs';
import { expiredRound } from '../roundDeadline';
import { roundsOf } from '../rounds';
import { extractGameId } from '../utils';
import { withDevice } from '../organizerPush';

describe('push to the organizer: a round past its end (Turni con scadenza)', () => {
  const END = Date.UTC(2026, 11, 7, 23); // the end of Monday 7 December in Italy
  const link = (id: string) => `https://lichess.org/${id}`;
  const all = [
    { round: '1', white: 'anna', black: 'bruno', url: link('aaaaaaaa'), lichess: { status: 'mate' } },
    { round: '2', white: 'carla', black: 'dario', url: link('bbbbbbbb'), lichess: { status: 'started' } },
    { round: '2', white: 'anna', black: 'carla', url: link('cccccccc'), lichess: { status: 'started' } },
  ];
  const schedule = [...all.map(({ round, white, black }) => ({ round, white, black })), { round: '3', white: 'bruno', black: 'anna' }];
  const tournament = { season: 'Stagione 3', schedule, roundDays: 14, roundEnds: [{ round: '2', at: END }] };
  const fresh = { cccccccc: { status: 'resign', winner: 'white' } };

  it('finds the same round as the organizer area', () => {
    const script = expiredRoundOf(tournament, all, fresh, END, extractGameId);
    const site = expiredRound(tournament, roundsOf(schedule, all as any), all as any, fresh as any, END);
    expect(script).toMatchObject({ round: site!.round, next: site!.next, end: site!.end, key: `Stagione 3|2|${END}` });
    expect(script.open).toEqual(site!.open.map(({ white, black }) => ({ white, black })));
    expect(script.open).toEqual([{ white: 'carla', black: 'dario' }]);
  });

  it('says nothing before the end, with the option off, or with no round to start', () => {
    expect(expiredRoundOf(tournament, all, {}, END - 1, extractGameId)).toBeNull();
    expect(expiredRoundOf({ ...tournament, roundDays: 0 }, all, {}, END, extractGameId)).toBeNull();
    expect(expiredRoundOf({ ...tournament, roundEnds: [] }, all, {}, END, extractGameId)).toBeNull();
    expect(expiredRoundOf({ ...tournament, schedule: schedule.slice(0, 3) }, all, {}, END, extractGameId)).toBeNull();
  });

  it('tells which round to create and what goes on, opening the organizer area', () => {
    const item = expiredRoundOf(tournament, all, fresh, END, extractGameId);
    expect(deadlineNotification(item, nameOf)).toEqual({
      title: 'Turno 2 scaduto',
      body: 'Si è chiuso lunedì 7 dicembre: puoi creare il Turno 3. Continua: Carla – Dario.',
      hash: '#admin',
      tag: 'turni',
    });
    expect(deadlineNotification({ ...item, open: [] }, nameOf).body).toMatch(/Le sue partite sono tutte concluse\.$/);
  });

  it('keeps a short list of devices, the renewed one in place of the old', () => {
    const d = (endpoint: string) => ({ endpoint, p256dh: 'p', auth: 'a', at: 1 });
    expect(withDevice([d('x'), d('y')], d('z'), 'x').map((v) => v.endpoint)).toEqual(['y', 'z']);
    expect(withDevice([d('y')], d('y')).map((v) => v.endpoint)).toEqual(['y']);
    expect(withDevice(['1', '2', '3', '4', '5'].map(d), d('6')).map((v) => v.endpoint)).toEqual(['2', '3', '4', '5', '6']);
  });
});
