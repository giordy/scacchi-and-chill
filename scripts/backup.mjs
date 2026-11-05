// Nightly backup (GitHub Action "Backup"): reads the public tournament data from Firestore and
// writes it as one JSON file, in the same format as "Scarica copia JSON" in the organizer area,
// so "Ripristina da file" can restore either. Games still on the board keep only link and status.
// The private organizer document (token, anecdotes, ratings, message texts) is readable only by
// the organizer and is not included.
// Usage: node scripts/backup.mjs <output file>
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOURNAMENT_DOC_ID = 'scacchi-and-chill-official';
const out = process.argv[2];
if (!out) {
  console.error('Uso: node scripts/backup.mjs <file di uscita>');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));
const base =
  `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/` +
  `${encodeURIComponent(cfg.firestoreDatabaseId || '(default)')}/documents/tournaments/${TOURNAMENT_DOC_ID}`;

// Firestore REST values -> plain JSON
function plain(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  if ('mapValue' in v) return fields(v.mapValue.fields);
  return undefined;
}
const fields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plain(v)]));

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url.split('?')[0]}`);
  return res.json();
}

// A query, not a plain listing: the security rules allow queries on the public collections
async function list(collection) {
  const res = await fetch(`${base}:runQuery?key=${cfg.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }] } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} leggendo ${collection}`);
  return (await res.json())
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split('/').pop(), ...fields(r.document.fields) }));
}

// Same key order every time, so an unchanged database gives an identical file
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]));
  return v;
}

const doc = fields((await get(`${base}?key=${cfg.apiKey}`)).fields);
const { players = [], schedule = [], updatedAt: _u, ...tournament } = doc;
// Games still on the board change at every move: only their link and status are kept (the first
// sync after a restore reads the rest from Lichess), so a new version appears only when something
// that counts changes (a game ends, a round starts, the calendar or the rules change)
const ONGOING = new Set(['created', 'started']);
const games = (await list('games'))
  .map(({ id: _id, updatedAt: _gu, syncedAt: _s, ...g }) =>
    g.lichess && ONGOING.has(g.lichess.status) ? { ...g, lichess: { id: g.lichess.id, status: g.lichess.status } } : g
  )
  .sort((a, b) => `${a.round}|${a.white}|${a.black}`.localeCompare(`${b.round}|${b.white}|${b.black}`, undefined, { numeric: true }));
const seasons = (await list('seasons')).sort((a, b) => String(a.archivedAt).localeCompare(String(b.archivedAt)));

const backup = { version: '2.0', source: 'backup automatico', tournament, players, schedule, history: games, seasons };
fs.writeFileSync(out, JSON.stringify(sorted(backup), null, 2) + '\n');
console.log(`backup: ${players.length} giocatori, ${schedule.length} partite in calendario, ${games.length} partite, ${seasons.length} stagioni archiviate`);
