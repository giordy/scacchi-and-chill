// Push notifications of the moves, from the Partite tab. The browser subscribes to its push service
// with the site's public key (push.json); the subscription goes to Firestore
// (tournaments/<id>/pushSubscriptions/<random id>, see firestore.rules), and the GitHub Action
// "Sincronizza risultati" sends from there (scripts/push.mjs). The service worker shows them
// (public/sw.js). The random id stays in this browser: with it the page writes the subscription again
// or deletes it.
import pushConfig from '../../push.json';
import firebaseConfig from '../../firebase-applet-config.json';
import { TOURNAMENT_DOC_ID } from './firestoreRest';
import { savedSeenMoves, type SeenMoves } from './seenMoves';

const STORE_KEY = 'scacchi-notifiche-mosse';

export interface PushSetting {
  id: string; // the document's id: a random secret
  endpoint: string;
  skip: string; // Lichess handle whose games are not notified ('' = none)
}

export type PushSupport =
  | 'ok'
  | 'ios-browser' // iPhone and iPad: only the app added to the Home screen gets notifications
  | 'denied' // the visitor blocked them for this site
  | 'none'; // the browser cannot

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'none';
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone = nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  if (ios && !standalone) return 'ios-browser';
  if (!('serviceWorker' in nav) || !('PushManager' in window) || !('Notification' in window)) return 'none';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

export function savedSetting(): PushSetting | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    return s && typeof s.id === 'string' && typeof s.endpoint === 'string' ? { id: s.id, endpoint: s.endpoint, skip: typeof s.skip === 'string' ? s.skip : '' } : null;
  } catch {
    return null;
  }
}

function keep(s: PushSetting | null) {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    // the setting then lasts this visit only
  }
}

const b64u = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const randomId = () => b64u(crypto.getRandomValues(new Uint8Array(24)).buffer);

const DATABASE = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}`;
const DOCS = `https://firestore.googleapis.com/v1/${DATABASE}/documents`;
const KEY = `key=${firebaseConfig.apiKey}`;
const docName = (id: string) => `${DATABASE}/documents/tournaments/${TOURNAMENT_DOC_ID}/pushSubscriptions/${id}`;

// The write of a subscription, as firestore.rules expects it. Separate, so the tests can send it to
// the emulator.
export function pushCommit(database: string, id: string, sub: { endpoint: string; p256dh: string; auth: string }, skip: string, seen?: SeenMoves | null) {
  return {
    writes: [
      {
        update: {
          name: `${database}/documents/tournaments/${TOURNAMENT_DOC_ID}/pushSubscriptions/${id}`,
          fields: {
            endpoint: { stringValue: sub.endpoint },
            p256dh: { stringValue: sub.p256dh },
            auth: { stringValue: sub.auth },
            skip: { stringValue: skip.toLowerCase() },
            ...(seen ? { seen: seenValue(seen) } : {}),
          },
        },
        updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  };
}

// The moves seen, as Firestore keeps them: the newest MAX_SEEN games only (firestore.rules caps it)
const MAX_SEEN = 300;
function seenValue(seen: SeenMoves) {
  const entries = Object.entries(seen)
    .filter(([id, at]) => /^[A-Za-z0-9]{8}$/.test(id) && Number.isFinite(at) && at > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SEEN);
  return { mapValue: { fields: Object.fromEntries(entries.map(([id, at]) => [id, { integerValue: String(Math.round(at)) }])) } };
}

// Only the moves seen, on a subscription that exists (one deleted meanwhile is not written again)
export function seenCommit(database: string, id: string, seen: SeenMoves) {
  return {
    writes: [
      {
        update: { name: `${database}/documents/tournaments/${TOURNAMENT_DOC_ID}/pushSubscriptions/${id}`, fields: { seen: seenValue(seen) } },
        updateMask: { fieldPaths: ['seen'] },
        currentDocument: { exists: true },
        updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  };
}

async function write(id: string, sub: PushSubscription, skip: string) {
  const json = sub.toJSON();
  const keys = { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? b64u(sub.getKey('p256dh')), auth: json.keys?.auth ?? b64u(sub.getKey('auth')) };
  const res = await fetch(`${DOCS}:commit?${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pushCommit(DATABASE, id, keys, skip)),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Il sito non ha potuto registrare gli avvisi: riprova più tardi.' : `Firestore: HTTP ${res.status}`);
  // The document was written whole, without the moves seen: they go again (reportSeenMoves)
  lastSeenSent = '';
}

// After a whole write of the subscription: the moves seen again, apart, so the subscription never
// fails for them (firestore.rules not published yet, say)
async function resendSeen() {
  const seen = savedSeenMoves();
  if (seen) await reportSeenMoves(seen).catch(() => {});
}

// The moves seen on the Partite tab, to the subscription of this browser (nothing when the
// notifications are off): the GitHub Action then skips them (scripts/push.mjs notificationFor).
// The same moves are written once per visit at most.
let lastSeenSent = '';
export async function reportSeenMoves(seen: SeenMoves): Promise<void> {
  const saved = savedSetting();
  if (!saved) return;
  const key = `${saved.id}:${JSON.stringify(seen)}`;
  if (key === lastSeenSent) return;
  lastSeenSent = key;
  const res = await fetch(`${DOCS}:commit?${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seenCommit(DATABASE, saved.id, seen)),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    lastSeenSent = '';
    throw new Error(`Firestore: HTTP ${res.status}`);
  }
}

async function remove(id: string) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${docName(id)}?${KEY}`, { method: 'DELETE', signal: AbortSignal.timeout(20000) });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore: HTTP ${res.status}`);
}

// The service worker is registered only on the published site (src/main.tsx)
async function registration() {
  if (!(await navigator.serviceWorker.getRegistration())) throw new Error('Gli avvisi funzionano dal sito pubblicato, non in sviluppo.');
  return navigator.serviceWorker.ready;
}

// Switches the notifications on (or changes whose games to skip): asks the permission, subscribes,
// writes the subscription
export async function enablePush(skip: string): Promise<PushSetting> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifiche bloccate: si riattivano dalle impostazioni del browser per questo sito.' : 'Serve il permesso per le notifiche.');
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(pushConfig.vapidPublicKey) }));
  const setting = { id: savedSetting()?.id ?? randomId(), endpoint: sub.endpoint, skip };
  await write(setting.id, sub, skip);
  keep(setting);
  await resendSeen();
  return setting;
}

export async function disablePush(): Promise<void> {
  const saved = savedSetting();
  if (saved) await remove(saved.id);
  keep(null);
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe().catch(() => {});
}

// At every visit: the browser may have renewed its subscription, or dropped it (permission taken
// back). Then the stored one is written again, or forgotten. Resolves to the setting in force.
export async function refreshPush(): Promise<PushSetting | null> {
  const saved = savedSetting();
  if (!saved) return null;
  const support = pushSupport();
  if (support !== 'ok' && support !== 'denied') return saved;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return saved;
  const sub = await reg.pushManager.getSubscription();
  if (!sub || support === 'denied' || Notification.permission !== 'granted') {
    await remove(saved.id).catch(() => {});
    keep(null);
    return null;
  }
  if (sub.endpoint !== saved.endpoint) {
    await write(saved.id, sub, saved.skip);
    const next = { ...saved, endpoint: sub.endpoint };
    keep(next);
    await resendSeen();
    return next;
  }
  return saved;
}
