// Push notifications of the moves (GitHub Action "Sincronizza risultati", after the sync): who
// switched them on from the Partite tab gets one notification per run, with the moves made and the
// games ended since the run before.
// - who: tournaments/<id>/pushSubscriptions, written by the public page (src/lib/push.ts), never
//   readable from the site; subscriptions the push service calls gone are deleted here
// - what was already told: tournaments/<id>/private/push, the plies and the end of every game. With
//   no such document (the first run) nothing is sent: the state is only recorded, so switching the
//   notifications on does not send the whole season
// - how: Web Push (RFC 8291 encryption, RFC 8292 VAPID), with node:crypto and no library. The private
//   key is the secret VAPID_PRIVATE_KEY; its public half is in push.json, for the page
import crypto from 'node:crypto';

const isFinal = (s) => Boolean(s && s.status && s.status !== 'created' && s.status !== 'started');
// Games that ended without being played are not news
const UNPLAYED = new Set(['aborted', 'noStart']);
export const pliesOf = (s) => (s?.moves ? s.moves.trim().split(/\s+/).filter(Boolean).length : 0);

// The push services of the browsers: the only addresses the run sends to (firestore.rules checks the
// same when a subscription is written)
export const PUSH_ENDPOINT = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\/\S+$/;

// What to tell since the last run, and the state to keep. games: the season's games with their
// Lichess id (id, white, black); states: their state from Lichess, by id (missing: not read now);
// prev: the state kept by the run before, null on the first run.
export function movesNews(games, states, prev) {
  const next = {};
  const news = [];
  games.forEach((g) => {
    const before = prev?.games?.[g.id];
    const s = states[g.id];
    if (!s) {
      if (before) next[g.id] = before;
      return;
    }
    const plies = pliesOf(s);
    const final = isFinal(s);
    next[g.id] = { plies, final };
    if (!prev) return;
    const was = before ?? { plies: 0, final: false };
    const ended = final && !was.final && !UNPLAYED.has(s.status);
    if (plies > was.plies || ended) {
      const sans = s.moves ? s.moves.trim().split(/\s+/) : [];
      news.push({
        id: g.id,
        white: g.white,
        black: g.black,
        newPlies: Math.max(0, plies - was.plies),
        plies,
        lastSan: sans[sans.length - 1],
        ended,
        status: s.status,
        winner: s.winner,
      });
    }
  });
  return { news, state: { games: next } };
}

// Whether the state to keep is the one already kept (then it is not written again)
export const sameState = (prev, next) => Boolean(prev) && JSON.stringify(prev.games ?? {}) === JSON.stringify(next.games);

// "23. Cf3" or "23… Cf6": the move number of a ply, as the site writes it
export function moveText(plies, san) {
  if (!san || plies < 1) return '';
  const n = Math.ceil(plies / 2);
  return `${n}${plies % 2 === 1 ? '.' : '…'} ${san}`;
}

function resultText(item, nameOf) {
  if (item.winner) return `vince ${nameOf(item.winner === 'white' ? item.white : item.black)} (${item.winner === 'white' ? '1-0' : '0-1'})`;
  return 'patta (½-½)';
}

function lineOf(item, nameOf) {
  if (item.ended) return `finita, ${resultText(item, nameOf)}`;
  const last = moveText(item.plies, item.lastSan);
  return item.newPlies > 1 ? `${item.newPlies} mosse, l'ultima ${last}` : last;
}

const MAX_LINES = 6;

// The notification for one subscriber: null when nothing is left once their own games are skipped
// (skip: their Lichess handle, they get their own moves from Lichess already)
export function notificationFor(news, nameOf, skip) {
  const k = skip?.toLowerCase();
  const mine = news.filter((n) => !k || (n.white.toLowerCase() !== k && n.black.toLowerCase() !== k));
  if (mine.length === 0) return null;
  const pair = (n) => `${nameOf(n.white)} – ${nameOf(n.black)}`;
  if (mine.length === 1) {
    const n = mine[0];
    return { title: pair(n), body: n.ended ? `Finita: ${resultText(n, nameOf)}` : n.newPlies > 1 ? `${n.newPlies} mosse nuove, l'ultima ${moveText(n.plies, n.lastSan)}` : `Nuova mossa: ${moveText(n.plies, n.lastSan)}`, hash: '#/partite' };
  }
  const lines = mine.slice(0, MAX_LINES).map((n) => `${pair(n)}: ${lineOf(n, nameOf)}`);
  if (mine.length > MAX_LINES) lines.push(`e altre ${mine.length - MAX_LINES}`);
  const ended = mine.filter((n) => n.ended).length;
  return { title: ended === mine.length ? `${mine.length} partite finite` : `Mosse nuove in ${mine.length} partite`, body: lines.join('\n'), hash: '#/partite' };
}

// ---- Web Push ----

const b64u = (b) => Buffer.from(b).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// The VAPID key pair from the private key (32 bytes, base64url, as `web-push generate-vapid-keys`)
export function vapidKeys(privateB64) {
  const d = unb64u(privateB64.trim());
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.concat([Buffer.alloc(Math.max(0, 32 - d.length)), d]));
  const pub = ecdh.getPublicKey();
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: b64u(ecdh.getPrivateKey()), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  return { publicKey: b64u(pub), key };
}

// RFC 8292: the Authorization header, a JWT signed for the push service's origin
export function vapidHeader(endpoint, vapid, subject, now = Date.now()) {
  const enc = (o) => b64u(JSON.stringify(o));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key: vapid.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// RFC 8291 (aes128gcm): the payload as only that browser can read it. salt and the sender's key pair
// can be given, for the tests.
export function encryptPayload(text, p256dhB64, authB64, { salt = crypto.randomBytes(16), ecdh } = {}) {
  const uaPublic = unb64u(p256dhB64);
  const authSecret = unb64u(authB64);
  const as = ecdh ?? crypto.createECDH('prime256v1');
  if (!ecdh) as.generateKeys();
  const asPublic = as.getPublicKey();
  const shared = as.computeSecret(uaPublic);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

// Sends one notification. 'gone' when the push service says the subscription no longer exists
export async function sendPush(sub, payload, vapid, subject) {
  if (!PUSH_ENDPOINT.test(sub.endpoint)) return 'gone';
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(sub.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(6 * 3600),
      Urgency: 'normal',
    },
    body: encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 404 || res.status === 410) return 'gone';
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return 'sent';
}
