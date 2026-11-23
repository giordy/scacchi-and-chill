import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The organizer's devices (lib/organizerPush.ts), with Firestore and the browser's push service faked
const store = vi.hoisted(() => ({ devices: [] as { endpoint: string; p256dh: string; auth: string; at: number }[], saves: 0 }));
const browser = vi.hoisted(() => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/new' as string | null }));

vi.mock('../../firebaseService', () => ({
  readOrganizerPush: vi.fn(async () => store.devices),
  saveOrganizerPush: vi.fn(async (list: typeof store.devices) => {
    store.devices = list;
    store.saves++;
  }),
}));
vi.mock('../push', () => {
  const sub = () => ({ endpoint: browser.endpoint });
  return {
    ORGANIZER_PUSH_KEY: 'scacchi-avvisi-organizzatore',
    browserSubscription: vi.fn(async () => {
      if (!browser.endpoint) throw new Error('Serve il permesso per le notifiche.');
      return sub();
    }),
    currentSubscription: vi.fn(async () => (browser.endpoint ? sub() : null)),
    subscriptionKeys: (s: { endpoint: string }) => ({ endpoint: s.endpoint, p256dh: 'p', auth: 'a' }),
  };
});

import { disableOrganizerPush, enableOrganizerPush, refreshOrganizerPush, savedOrganizerEndpoint } from '../organizerPush';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const device = (endpoint: string) => ({ endpoint, p256dh: 'p', auth: 'a', at: 1 });

beforeEach(() => {
  vi.stubGlobal('localStorage', memory());
  vi.stubGlobal('Notification', { permission: 'granted' });
  store.devices = [];
  store.saves = 0;
  browser.endpoint = 'https://fcm.googleapis.com/fcm/send/new';
});
afterEach(() => vi.unstubAllGlobals());

describe("the organizer's notice of a round past its end", () => {
  it('switches on: this device joins the list, the others stay', async () => {
    store.devices = [device('https://fcm.googleapis.com/fcm/send/laptop')];
    await enableOrganizerPush();
    expect(store.devices.map((d) => d.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/laptop', 'https://fcm.googleapis.com/fcm/send/new']);
    expect(savedOrganizerEndpoint()).toBe('https://fcm.googleapis.com/fcm/send/new');
    // switched on twice: still one entry for this device
    await enableOrganizerPush();
    expect(store.devices).toHaveLength(2);
  });

  it('stays off when the permission is refused', async () => {
    browser.endpoint = null;
    await expect(enableOrganizerPush()).rejects.toThrow('permesso');
    expect(store.devices).toEqual([]);
    expect(savedOrganizerEndpoint()).toBeNull();
  });

  it('switches off: only this device leaves the list', async () => {
    store.devices = [device('https://fcm.googleapis.com/fcm/send/laptop')];
    await enableOrganizerPush();
    await disableOrganizerPush();
    expect(store.devices.map((d) => d.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/laptop']);
    expect(savedOrganizerEndpoint()).toBeNull();
    // already off: nothing written
    const saves = store.saves;
    await disableOrganizerPush();
    expect(store.saves).toBe(saves);
  });

  it('follows a subscription renewed by the browser, and forgets a lost one', async () => {
    await enableOrganizerPush();
    browser.endpoint = 'https://fcm.googleapis.com/fcm/send/renewed';
    expect(await refreshOrganizerPush()).toBe('https://fcm.googleapis.com/fcm/send/renewed');
    expect(store.devices.map((d) => d.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/renewed']);
    // the same again: nothing written
    const saves = store.saves;
    await refreshOrganizerPush();
    expect(store.saves).toBe(saves);
    // permission taken back: the switch shows off (the device goes from the list at the next send, as gone)
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(await refreshOrganizerPush()).toBeNull();
    expect(savedOrganizerEndpoint()).toBeNull();
    // never switched on here: nothing to do
    expect(await refreshOrganizerPush()).toBeNull();
  });
});
