// Results sync (GitHub Action "Sincronizza risultati"): reads from Lichess the games that Firestore
// does not have as finished yet and saves their state (field `lichess`), as the organizer area does
// when it opens. So the saved results no longer wait for the organizer: the public page, the
// cronaca and the nightly backup find them anyway.
// Writes need a Google service account of the Firebase project, in the GitHub secret
// FIREBASE_SERVICE_ACCOUNT (its JSON key): see the README. Without it the script says so and stops.
// Usage: node scripts/sync-results.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fields } from './backup.mjs';
import { needsAnalysis } from './analysis.mjs';
import { deadlineNotification, deliverOrganizerNotice, expiredRoundOf, expiryDaysOf, movesNews, notificationFor, organizerNews, overdueNotification, overdueOf, sameState, sendPush, staleLinksNotification, staleLinksOf, vapidKeys } from './push.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOURNAMENT_DOC_ID = 'scacchi-and-chill-official';
const LICHESS_EXPORT = 'https://lichess.org/api/games/export/_ids?pgnInJson=false&lastFen=true&opening=true&division=true';

// Plain JSON -> Firestore REST values (the inverse of backup.mjs `plain`)
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    // undefined values are dropped, as the organizer area does with its JSON round trip
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    return { mapValue: { fields: Object.fromEntries(entries.map(([k, x]) => [k, toValue(x)])) } };
  }
  throw new Error(`Valore non supportato: ${typeof v}`);
}

// The Lichess id in a game link: the same rule as src/lib/utils.ts extractGameId (a test checks it)
const LICHESS_PAGES = new Set(['training', 'analysis', 'practice', 'streamer', 'features', 'insights', 'calendar', 'settings', 'tutorial', 'password']);
export function gameIdOf(url) {
  const id = url?.match(/(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:(?:game\/export|game|challenge|embed\/game|embed)\/)?([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?(?=$|[/?#])/i)?.[1];
  return id && !LICHESS_PAGES.has(id.toLowerCase()) ? id : undefined;
}

const isFinal = (s) => Boolean(s && s.status && s.status !== 'created' && s.status !== 'started');

// The games to read again: with a link, and no final result saved (as src/lib/games.ts syncTargets)
// A game with a result decided by the organizer (src/lib/decisions.ts) is not read again either
export function syncTargets(games) {
  return games.filter((g) => gameIdOf(g.url) && !isFinal(g.lichess) && !g.decision);
}

// A state from Lichess is saved only when it says something new: a game still to accept, or one
// whose moves and status did not change, is not written again
export function changed(saved, next) {
  if (!next) return false;
  if (!saved) return true;
  return saved.status !== next.status || saved.moves !== next.moves || saved.lastMoveAt !== next.lastMoveAt;
}

// An OAuth token for Firestore from the service account key (a signed JWT, no library)
export async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: account.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 600,
  })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const res = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Token Google: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

export async function readGames(base, token) {
  const res = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'games' }] } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Lettura partite: HTTP ${res.status}`);
  return (await res.json())
    .filter((r) => r.document)
    .map((r) => ({ docId: r.document.name.split('/').pop(), ...fields(r.document.fields) }));
}

async function readLichess(ids) {
  const states = {};
  for (let i = 0; i < ids.length; i += 300) {
    const res = await fetch(LICHESS_EXPORT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/x-ndjson' },
      body: ids.slice(i, i + 300).join(','),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Lichess: HTTP ${res.status}`);
    (await res.text())
      .split('\n')
      .filter((l) => l.trim())
      .forEach((line) => {
        try {
          const g = JSON.parse(line);
          if (g.id) states[g.id] = g;
        } catch {
          // a broken line: the game is read again next time
        }
      });
  }
  return states;
}

// Only the given fields, and only on a game document that exists (never one the organizer deleted)
export async function saveGameFields(base, token, docId, data) {
  const params = new URLSearchParams([...Object.keys(data).map((k) => ['updateMask.fieldPaths', k]), ['currentDocument.exists', 'true']]);
  const res = await fetch(`${base}/games/${encodeURIComponent(docId)}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Salvataggio di ${docId}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

const saveState = (base, token, docId, state) =>
  saveGameFields(base, token, docId, { lichess: JSON.parse(JSON.stringify(state)), syncedAt: new Date().toISOString() });

async function getDoc(base, token, docPath) {
  const res = await fetch(docPath ? `${base}/${docPath}` : base, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lettura di ${docPath}: HTTP ${res.status}`);
  return fields((await res.json()).fields);
}

async function listDocs(base, token, collectionId) {
  const res = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }] } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Lettura di ${collectionId}: HTTP ${res.status}`);
  return (await res.json()).filter((r) => r.document).map((r) => ({ docId: r.document.name.split('/').pop(), ...fields(r.document.fields) }));
}

async function setDoc(base, token, docPath, data) {
  const res = await fetch(`${base}/${docPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Salvataggio di ${docPath}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// Only the given fields of a document (the others stay as they are)
export async function patchFields(base, token, docPath, data) {
  const params = new URLSearchParams(Object.keys(data).map((k) => ['updateMask.fieldPaths', k]));
  const res = await fetch(`${base}/${docPath}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Salvataggio di ${docPath}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function deleteDoc(base, token, docPath) {
  const res = await fetch(`${base}/${docPath}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok && res.status !== 404) throw new Error(`Cancellazione di ${docPath}: HTTP ${res.status}`);
}

// The days a challenge stays open by default (config.json defaults.expiry)
const defaultExpiry = () => expiryDaysOf({ settings: JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')).defaults }, 2);

// Who gets the notifications may be written by anyone (firestore.rules): never more than these a run
const MAX_SUBSCRIPTIONS = 300;
// The JWT's subject: who sends, for the push services
const PUSH_SUBJECT = 'https://github.com/giordy/scacchi-and-chill';

// The push notifications of the moves (scripts/push.mjs). games: every game of the season, with its
// state from Lichess when read in this run
const namesOf = (tournament) => {
  const names = new Map([...(tournament.roster ?? []), ...(tournament.players ?? [])].map((p) => [String(p.handle).toLowerCase(), p.name || p.handle]));
  return (h) => names.get(String(h).toLowerCase()) ?? h;
};

async function notify(base, token, vapid, tournament, games, states, prev) {
  const nameOf = namesOf(tournament);
  const { news, state } = movesNews(games, states, prev);
  if (news.length > 0) {
    const subs = (await listDocs(base, token, 'pushSubscriptions')).slice(0, MAX_SUBSCRIPTIONS);
    let sent = 0;
    let gone = 0;
    for (const sub of subs) {
      const payload = notificationFor(news, nameOf, sub.skip, sub.seen);
      if (!payload) continue;
      try {
        if ((await sendPush(sub, payload, vapid, PUSH_SUBJECT)) === 'gone') {
          await deleteDoc(base, token, `pushSubscriptions/${encodeURIComponent(sub.docId)}`);
          gone++;
        } else sent++;
      } catch (e) {
        console.warn(`Notifica non inviata: ${e.message}`);
      }
    }
    console.log(`Notifiche: ${news.length} partite con novità, ${sent} inviate, ${gone} iscrizioni scadute tolte.`);
  } else if (!prev) {
    console.log('Notifiche: primo giro, stato delle partite registrato senza inviare nulla.');
  }
  if (!sameState(prev, state)) await setDoc(base, token, 'private/push', state);
}

// The organizer's notifications, to their devices (private/organizerPush, written by the organizer area),
// each told once (the keys in private/deadlinePush); a device the push service calls gone is taken off:
// - Turni con scadenza (scripts/push.mjs expiredRoundOf): a round past its end, the next to create
// - Partite troppo lunghe (overdueOf): the games newly past the days allowed, in one notification
// - Sfide da rifare (staleLinksOf): challenges expired without being accepted, games voided by Lichess
async function notifyOrganizer(base, token, vapid, tournament, games, states) {
  const now = Date.now();
  const item = expiredRoundOf(tournament, games, states, now, gameIdOf);
  const overdue = overdueOf(tournament, games, states, now, gameIdOf);
  // The days a challenge stays open are in the organizer's settings: read only with a challenge still
  // to accept (no state from Lichess yet)
  const awaiting = games.some((g) => g.url && !g.decision && !g.lichess && !states[gameIdOf(g.url)]);
  const expiry = awaiting ? expiryDaysOf(await getDoc(base, token, 'private/organizer'), defaultExpiry()) : 1;
  const stale = staleLinksOf(games, states, expiry, now, gameIdOf);
  if (!item && overdue.length === 0 && stale.length === 0) return;
  let told = (await getDoc(base, token, 'private/deadlinePush'))?.told ?? [];
  const nameOf = namesOf(tournament);
  const deliveries = [];
  const news = organizerNews(item, told);
  if (news) deliveries.push({ news, payload: deadlineNotification(item, nameOf, news.kind), what: `Turno ${item.round}` });
  const fresh = overdue.filter((o) => !told.includes(o.key));
  if (fresh.length > 0) {
    deliveries.push({ news: { keys: fresh.map((o) => o.key) }, payload: overdueNotification(fresh, tournament.overdueDays, nameOf), what: `${fresh.length} partite oltre il limite` });
  }
  const freshLinks = stale.filter((o) => !told.includes(o.key));
  if (freshLinks.length > 0) {
    deliveries.push({ news: { keys: freshLinks.map((o) => o.key) }, payload: staleLinksNotification(freshLinks, nameOf), what: `${freshLinks.length} sfide da rifare` });
  }
  if (deliveries.length === 0) return;
  let subs = (await getDoc(base, token, 'private/organizerPush'))?.subscriptions ?? [];
  if (subs.length === 0) {
    console.log(`${deliveries.map((d) => d.what).join(', ')}: nessun dispositivo dell'organizzatore con gli avvisi accesi.`);
    return;
  }
  let subsChanged = false;
  let toldChanged = false;
  for (const d of deliveries) {
    const out = await deliverOrganizerNotice(d.news, d.payload, told, subs, (sub, p) => sendPush(sub, p, vapid, PUSH_SUBJECT));
    if (out.subs) {
      subs = out.subs;
      subsChanged = true;
    }
    if (out.told) {
      told = out.told;
      toldChanged = true;
    }
    console.log(`${d.what}: avviso all'organizzatore su ${out.sent} dispositivi${out.gone ? `, ${out.gone} non più iscritti tolti` : ''}${out.failed ? `, ${out.failed} non riusciti` : ''}.`);
  }
  if (subsChanged) await patchFields(base, token, 'private/organizerPush', { subscriptions: subs });
  if (toldChanged) await setDoc(base, token, 'private/deadlinePush', { told });
}

async function main() {
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!secret) {
    console.log('Manca il secret FIREBASE_SERVICE_ACCOUNT: nessuna sincronizzazione (vedi il README).');
    return;
  }
  const account = JSON.parse(secret);
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));
  const base =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/` +
    `${encodeURIComponent(cfg.firestoreDatabaseId || '(default)')}/documents/tournaments/${TOURNAMENT_DOC_ID}`;
  const token = await accessToken(account);
  // The organizer area shows when the last run went through, and the error of one that did not
  // (private/syncStatus, src/lib/syncHealth.ts): a sync that stops is seen, not only guessed
  try {
    const games = await run(base, token);
    await patchFields(base, token, 'private/syncStatus', { at: new Date().toISOString() });
    // The analysis job of the workflow (scripts/analyse-games.mjs) runs only when a game waits for it
    const waiting = games.filter((g) => needsAnalysis(g, gameIdOf)).length;
    if (waiting > 0) console.log(`Partite da analizzare: ${waiting}.`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `analyse=${waiting > 0}\n`);
  } catch (e) {
    await patchFields(base, token, 'private/syncStatus', failureOf(e, new Date())).catch(() => {});
    throw e;
  }
}

// What a run that did not go through leaves for the organizer area: when and why, briefly
export function failureOf(e, date) {
  return { errorAt: date.toISOString(), error: String(e?.message ?? e).slice(0, 300) };
}

async function run(base, token) {
  const tournament = (await getDoc(base, token, '')) ?? {};
  const all = await readGames(base, token);
  const targets = syncTargets(all);
  // The notifications need the games that were still open at the last run too: the organizer area
  // may have saved their end in the meantime
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const vapid = privateKey ? vapidKeys(privateKey) : null;
  if (vapid) {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'push.json'), 'utf8'));
    if (cfg.vapidPublicKey !== vapid.publicKey) console.warn('VAPID_PRIVATE_KEY non corrisponde alla chiave pubblica di push.json: le notifiche non arriveranno.');
  }
  // The moves of a game decided by the organizer are no news any more
  const watched = all.map((g) => ({ ...g, id: gameIdOf(g.url) })).filter((g) => g.id && !g.decision);
  const prevPush = vapid ? await getDoc(base, token, 'private/push') : null;
  const pushIds = vapid ? watched.filter((g) => !prevPush?.games?.[g.id]?.final).map((g) => g.id) : [];
  const ids = [...new Set([...targets.map((g) => gameIdOf(g.url)), ...pushIds])];
  if (ids.length === 0) {
    console.log('Tutte le partite con un link hanno già il risultato salvato.');
    // A round can be past its end with every game over
    if (vapid) await notifyOrganizer(base, token, vapid, tournament, all, {});
    return all;
  }
  const states = await readLichess(ids);
  let saved = 0;
  for (const g of targets) {
    const next = states[gameIdOf(g.url)];
    if (!changed(g.lichess, next)) continue;
    await saveState(base, token, g.docId, next);
    saved++;
  }
  const finished = targets.filter((g) => isFinal(states[gameIdOf(g.url)])).length;
  console.log(`Partite da controllare: ${targets.length}; aggiornate: ${saved}; concluse ora: ${finished}.`);
  if (vapid) {
    await notify(base, token, vapid, tournament, watched, states, prevPush);
    await notifyOrganizer(base, token, vapid, tournament, all, states);
  } else console.log('Manca il secret VAPID_PRIVATE_KEY: nessuna notifica (vedi il README).');
  // The games as they are now saved: a game finished in this run waits for its analysis
  return all.map((g) => {
    const next = targets.includes(g) ? states[gameIdOf(g.url)] : undefined;
    return changed(g.lichess, next) ? { ...g, lichess: next } : g;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
