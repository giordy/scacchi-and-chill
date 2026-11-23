// Push notifications of the moves (GitHub Action "Sincronizza risultati", after the sync): who
// switched them on from the Partite tab gets one notification per run, with the moves made and the
// games ended since the run before.
// - who: tournaments/<id>/pushSubscriptions, written by the public page (src/lib/push.ts), never
//   readable from the site; subscriptions the push service calls gone are deleted here
// - what was already told: tournaments/<id>/private/push, the last move's time and the end of every game. With
//   no such document (the first run) nothing is sent: the state is only recorded, so switching the
//   notifications on does not send the whole season
// - how: Web Push (RFC 8291 encryption, RFC 8292 VAPID), with node:crypto and no library. The private
//   key is the secret VAPID_PRIVATE_KEY; its public half is in push.json, for the page
import crypto from 'node:crypto';

const isFinal = (s) => Boolean(s && s.status && s.status !== 'created' && s.status !== 'started');
// Games that ended without being played are not news
const UNPLAYED = new Set(['aborted', 'noStart']);

// The push services of the browsers: the only addresses the run sends to (firestore.rules checks the
// same when a subscription is written)
export const PUSH_ENDPOINT = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\/\S+$/;

// What to tell since the last run, and the state to keep. games: the season's games with their
// Lichess id (id, white, black, round); states: their state from Lichess, by id (missing: not read
// now); prev: the state kept by the run before, null on the first run.
// Lichess hides the last 3 half-moves of an ongoing game (anti-cheat, src/lib/utils.ts HIDDEN_PLIES):
// the moves it lists are old ones, so a notification never names them. What Lichess gives right is
// the time of the last move: a later one means somebody moved.
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
    const at = typeof s.lastMoveAt === 'number' ? s.lastMoveAt : 0;
    const final = isFinal(s);
    next[g.id] = { at, final };
    if (!prev) return;
    // A game kept before the time was (plies only): recorded now, told from the next move
    const was = before ?? { at: 0, final: false };
    const ended = final && !was.final && !UNPLAYED.has(s.status);
    const moved = !final && s.status === 'started' && was.at !== undefined && at > was.at;
    if (moved || ended) news.push({ id: g.id, white: g.white, black: g.black, round: g.round, ended, winner: s.winner, at });
  });
  return { news, state: { games: next } };
}

// Whether the state to keep is the one already kept (then it is not written again)
export const sameState = (prev, next) => Boolean(prev) && JSON.stringify(prev.games ?? {}) === JSON.stringify(next.games);

function resultText(item, nameOf) {
  if (item.winner) return `vince ${nameOf(item.winner === 'white' ? item.white : item.black)} (${item.winner === 'white' ? '1-0' : '0-1'})`;
  return 'patta (½-½)';
}

const MAX_LINES = 6;

// The notification for one subscriber: null when nothing is left once their own games are skipped
// (skip: their Lichess handle, they get their own moves from Lichess already) and the moves they have
// already seen on the Partite tab (seen: the last move seen of each game, written by the page, see
// src/lib/push.ts reportSeenMoves). The end of a game is told anyway: the page does not record it.
export function notificationFor(news, nameOf, skip, seen) {
  const k = skip?.toLowerCase();
  const seenAt = (id) => (seen && typeof seen === 'object' ? Number(seen[id]) || 0 : 0);
  const mine = news.filter((n) => (!k || (n.white.toLowerCase() !== k && n.black.toLowerCase() !== k)) && (n.ended || !(n.at > 0 && seenAt(n.id) >= n.at)));
  if (mine.length === 0) return null;
  const pair = (n) => `${nameOf(n.white)} – ${nameOf(n.black)}`;
  const round = (n) => (n.round ? `Turno ${n.round}: ` : '');
  if (mine.length === 1) {
    const n = mine[0];
    return { title: pair(n), body: round(n) + (n.ended ? `finita, ${resultText(n, nameOf)}` : 'nuova mossa'), hash: '#/partite' };
  }
  const lines = mine.slice(0, MAX_LINES).map((n) => (n.ended ? `${pair(n)}: finita, ${resultText(n, nameOf)}` : pair(n)));
  if (mine.length > MAX_LINES) lines.push(`e altre ${mine.length - MAX_LINES}`);
  const ended = mine.filter((n) => n.ended).length;
  return { title: ended === mine.length ? `${mine.length} partite finite` : `Si muove in ${mine.length} partite`, body: lines.join('\n'), hash: '#/partite' };
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

// ---- Turni con scadenza: the organizer's notification ----
// When the round in progress is past its end (src/lib/roundDeadline.ts), the organizer gets one
// notification on the devices switched on from the organizer area (tournaments/<id>/private/
// organizerPush, readable only by the organizer and by this run): the next round can be created.

const byRound = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// The same rule as src/lib/roundDeadline.ts expiredRound (a test checks they agree): the round with
// the highest number that has a challenge is past its end, and a round after it has none yet. The
// tournament as read from Firestore; games: its game documents; states: fresh from Lichess, by id.
export function expiredRoundOf(tournament, games, states, now, idOf) {
  if (!(typeof tournament?.roundDays === 'number' && tournament.roundDays > 0)) return null;
  const names = new Set([...(tournament.schedule ?? []).map((m) => String(m.round)), ...games.map((g) => String(g.round))]);
  const rounds = [...names].sort(byRound).map((round) => ({ round, created: games.filter((g) => String(g.round) === round && g.url).length }));
  const started = rounds.filter((r) => r.created > 0);
  const current = started[started.length - 1];
  if (!current) return null;
  const end = (tournament.roundEnds ?? []).find((e) => e && e.round === current.round)?.at;
  if (typeof end !== 'number' || now < end) return null;
  const next = rounds.find((r) => byRound(r.round, current.round) > 0 && r.created === 0);
  if (!next) return null;
  const isOpen = (g) => {
    if (!g.url) return false;
    const id = idOf(g.url);
    return !isFinal((id && states[id]) || g.lichess);
  };
  const pair = (g) => ({ white: g.white, black: g.black });
  // Ultime giornate: the last rounds of the calendar wait for every game of the rounds before them
  const finalRounds = typeof tournament.finalRoundsWait === 'number' && tournament.finalRoundsWait > 0 ? Math.floor(tournament.finalRoundsWait) : 0;
  const waits = finalRounds > 0 && rounds.slice(-finalRounds).some((r) => r.round === next.round);
  const waitFor = waits ? games.filter((g) => byRound(g.round, next.round) < 0 && isOpen(g)).sort((a, b) => byRound(a.round, b.round)) : [];
  return {
    key: `${tournament.season ?? ''}|${current.round}|${end}`,
    round: current.round,
    next: next.round,
    end,
    open: games.filter((g) => String(g.round) === current.round && isOpen(g)).map(pair),
    waitFor: waitFor.map(pair),
  };
}

// What to tell the organizer, from the round past its end and the keys already told (each sent once):
// - the next round can start: `key`; after a wait for the last games, said as the round being over
// - Ultime giornate, the next round waits: `key|attesa`, once
// null when it was all told already
export function organizerNews(item, told) {
  if (!item) return null;
  if (item.waitFor.length > 0) {
    const key = `${item.key}|attesa`;
    return told.includes(key) ? null : { key, kind: 'wait' };
  }
  if (told.includes(item.key)) return null;
  return { key: item.key, kind: told.includes(`${item.key}|attesa`) ? 'over' : 'expired' };
}

// "lunedì 7 dicembre": the last day of the round, as src/lib/roundDeadline.ts formatRoundEnd
export const formatRoundEnd = (end) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(end - 1));

// The notification: it opens the organizer area, and does not replace the one of the moves
export function deadlineNotification(item, nameOf, kind = 'expired') {
  const names = (list) => list.map((g) => `${nameOf(g.white)} – ${nameOf(g.black)}`).join(', ');
  const base = { hash: '#admin', tag: 'turni' };
  if (kind === 'wait') {
    return {
      ...base,
      title: `Turno ${item.round} chiuso`,
      body: `Si è chiuso ${formatRoundEnd(item.end)}. Ultime giornate: il Turno ${item.next} parte con calma, quando ${
        item.waitFor.length === 1 ? "finisce l'ultima partita ancora in corso" : `finiscono le ${item.waitFor.length} partite ancora in corso`
      }.`,
    };
  }
  if (kind === 'over') {
    return { ...base, title: `Tocca al Turno ${item.next}`, body: `Le partite dei turni prima sono tutte finite: puoi creare il Turno ${item.next}.` };
  }
  const open = item.open.length === 0 ? 'Le sue partite sono tutte concluse.' : `${item.open.length === 1 ? 'Continua' : 'Continuano'}: ${names(item.open)}.`;
  return {
    ...base,
    title: `Turno ${item.round} scaduto`,
    body: `Si è chiuso ${formatRoundEnd(item.end)}: puoi creare il Turno ${item.next}. ${open}`,
  };
}
