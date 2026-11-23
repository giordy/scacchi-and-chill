// The organizer's notice of a round past its end (Turni con scadenza, lib/roundDeadline.ts): sent by
// the GitHub Action "Sincronizza risultati" (scripts/push.mjs deadlineNotification) to the devices
// switched on here, kept in the private document tournaments/<id>/private/organizerPush. The browser's
// subscription is the same as for the moves of the Partite tab (lib/push.ts); this browser remembers
// its own endpoint, to show the switch and to keep the list right when the subscription changes.
import { OrganizerPushDevice, readOrganizerPush, saveOrganizerPush } from '../firebaseService';
import { browserSubscription, currentSubscription, ORGANIZER_PUSH_KEY, subscriptionKeys } from './push';

// At most this many devices: the oldest go
const MAX_DEVICES = 5;

export function savedOrganizerEndpoint(): string | null {
  try {
    return localStorage.getItem(ORGANIZER_PUSH_KEY);
  } catch {
    return null;
  }
}

function keep(endpoint: string | null) {
  try {
    if (endpoint) localStorage.setItem(ORGANIZER_PUSH_KEY, endpoint);
    else localStorage.removeItem(ORGANIZER_PUSH_KEY);
  } catch {
    // the switch then shows off at the next visit; the device stays on the list
  }
}

// The list with this device in place of `old` (its previous endpoint), newest last
export function withDevice(list: OrganizerPushDevice[], device: OrganizerPushDevice, old?: string | null): OrganizerPushDevice[] {
  return [...list.filter((d) => d.endpoint !== device.endpoint && d.endpoint !== old), device].slice(-MAX_DEVICES);
}

export async function enableOrganizerPush(): Promise<string> {
  const sub = await browserSubscription();
  const device = { ...subscriptionKeys(sub), at: Date.now() };
  await saveOrganizerPush(withDevice(await readOrganizerPush(), device, savedOrganizerEndpoint()));
  keep(device.endpoint);
  return device.endpoint;
}

export async function disableOrganizerPush(): Promise<void> {
  const saved = savedOrganizerEndpoint();
  const now = (await currentSubscription())?.endpoint;
  const list = await readOrganizerPush();
  const next = list.filter((d) => d.endpoint !== saved && d.endpoint !== now);
  if (next.length !== list.length) await saveOrganizerPush(next);
  keep(null);
}

// At every visit: the browser may have renewed its subscription (the list gets the new one) or lost it
// (permission taken back: the switch shows off). Resolves to the endpoint in force, null when off.
export async function refreshOrganizerPush(): Promise<string | null> {
  const saved = savedOrganizerEndpoint();
  if (!saved) return null;
  const sub = await currentSubscription();
  if (!sub || (typeof Notification !== 'undefined' && Notification.permission !== 'granted')) {
    keep(null);
    return null;
  }
  if (sub.endpoint !== saved) {
    await saveOrganizerPush(withDevice(await readOrganizerPush(), { ...subscriptionKeys(sub), at: Date.now() }, saved));
    keep(sub.endpoint);
  }
  return sub.endpoint;
}
