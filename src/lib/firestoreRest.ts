// The public page reads Firestore with plain HTTP requests (the REST API), not with the Firebase SDK:
// four public documents do not need its 900 kB of JavaScript, and on a phone opened from a WhatsApp
// link that weighs. The organizer area, loaded on demand, keeps the SDK (sign-in, writes, live updates).
// The same requests as scripts/backup.mjs; the security rules allow them (public reads and queries).
import { HistoryGame, SeasonArchive } from '../types';
import type { TournamentDocData } from '../firebaseService';
import firebaseConfig from '../../firebase-applet-config.json';

export const TOURNAMENT_DOC_ID = 'scacchi-and-chill-official';

type RestValue = Record<string, unknown>;

// Firestore REST values -> plain JSON
export function plain(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const o = v as RestValue;
  if ('stringValue' in o) return o.stringValue;
  if ('integerValue' in o) return Number(o.integerValue);
  if ('doubleValue' in o) return o.doubleValue;
  if ('booleanValue' in o) return o.booleanValue;
  if ('nullValue' in o) return null;
  if ('timestampValue' in o) return o.timestampValue;
  if ('arrayValue' in o) return (((o.arrayValue as RestValue).values as unknown[]) ?? []).map(plain);
  if ('mapValue' in o) return fieldsOf((o.mapValue as RestValue).fields as Record<string, unknown>);
  return undefined;
}

export const fieldsOf = (f: Record<string, unknown> = {}): Record<string, unknown> =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plain(v)]));

// A game document as the site uses it; null for an incomplete one
export function gameFromDoc(data: Record<string, unknown>): HistoryGame | null {
  if (!data.round || !data.white || !data.black) return null;
  return {
    round: String(data.round),
    white: String(data.white),
    black: String(data.black),
    url: String(data.url || ''),
    createdAt: Number(data.createdAt) || undefined,
    lichess: (data.lichess as HistoryGame['lichess']) || undefined,
  };
}

const BASE =
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/` +
  `${encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)')}/documents/tournaments/${TOURNAMENT_DOC_ID}`;
const KEY = `key=${firebaseConfig.apiKey}`;

async function getDocument(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}${path}?${KEY}`, { signal: AbortSignal.timeout(20000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore: HTTP ${res.status}`);
  return fieldsOf((await res.json()).fields);
}

// A query, not a plain listing: the security rules allow queries on the public collections
async function listCollection(collection: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const res = await fetch(`${BASE}:runQuery?${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }] } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Firestore: HTTP ${res.status} leggendo ${collection}`);
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, unknown> } }[];
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document!.name.split('/').pop()!, data: fieldsOf(r.document!.fields) }));
}

export const readTournamentDoc = () => getDocument('') as Promise<TournamentDocData | null>;

export async function readGames(): Promise<HistoryGame[]> {
  return (await listCollection('games')).map((d) => gameFromDoc(d.data)).filter((g): g is HistoryGame => g !== null);
}

export async function readSeasons(): Promise<SeasonArchive[]> {
  return (await listCollection('seasons')).map((d) => ({ ...(d.data as unknown as SeasonArchive), id: d.id }));
}

export async function readMediaImage(id: string): Promise<string | null> {
  const doc = await getDocument(`/media/${encodeURIComponent(id)}`);
  return typeof doc?.dataUrl === 'string' ? doc.dataUrl : null;
}
