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
export function syncTargets(games) {
  return games.filter((g) => gameIdOf(g.url) && !isFinal(g.lichess));
}

// A state from Lichess is saved only when it says something new: a game still to accept, or one
// whose moves and status did not change, is not written again
export function changed(saved, next) {
  if (!next) return false;
  if (!saved) return true;
  return saved.status !== next.status || saved.moves !== next.moves || saved.lastMoveAt !== next.lastMoveAt;
}

// An OAuth token for Firestore from the service account key (a signed JWT, no library)
async function accessToken(account) {
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

async function readGames(base, token) {
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

// Only the fields `lichess` and `syncedAt`, and only on a game document that exists
async function saveState(base, token, docId, state) {
  const params = new URLSearchParams([
    ['updateMask.fieldPaths', 'lichess'],
    ['updateMask.fieldPaths', 'syncedAt'],
    ['currentDocument.exists', 'true'],
  ]);
  const res = await fetch(`${base}/games/${encodeURIComponent(docId)}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: { lichess: toValue(JSON.parse(JSON.stringify(state))), syncedAt: toValue(new Date().toISOString()) } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Salvataggio di ${docId}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
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
  const targets = syncTargets(await readGames(base, token));
  if (targets.length === 0) {
    console.log('Tutte le partite con un link hanno già il risultato salvato.');
    return;
  }
  const states = await readLichess([...new Set(targets.map((g) => gameIdOf(g.url)))]);
  let saved = 0;
  for (const g of targets) {
    const next = states[gameIdOf(g.url)];
    if (!changed(g.lichess, next)) continue;
    await saveState(base, token, g.docId, next);
    saved++;
  }
  const finished = targets.filter((g) => isFinal(states[gameIdOf(g.url)])).length;
  console.log(`Partite da controllare: ${targets.length}; aggiornate: ${saved}; concluse ora: ${finished}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
