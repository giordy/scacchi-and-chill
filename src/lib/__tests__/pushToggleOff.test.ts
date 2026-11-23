import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disablePush, ORGANIZER_PUSH_KEY } from '../push';

// Switching off the moves (Partite tab) must not take away the organizer's notices on the same browser:
// they share its push subscription (lib/organizerPush.ts)
const memory = (init: Record<string, string>) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const unsubscribe = vi.fn(async () => true);

beforeEach(() => {
  unsubscribe.mockClear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({ unsubscribe }) } }) } });
});
afterEach(() => vi.unstubAllGlobals());

const moves = { 'scacchi-notifiche-mosse': JSON.stringify({ id: 'x'.repeat(32), endpoint: 'https://fcm.googleapis.com/fcm/send/a', skip: '' }) };

describe('switching off the notifications of the moves', () => {
  it('unsubscribes the browser when nothing else uses it', async () => {
    vi.stubGlobal('localStorage', memory(moves));
    await disablePush();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('pushSubscriptions/' + 'x'.repeat(32)), expect.objectContaining({ method: 'DELETE' }));
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("keeps the browser's subscription while it gets the organizer's notices", async () => {
    vi.stubGlobal('localStorage', memory({ ...moves, [ORGANIZER_PUSH_KEY]: 'https://fcm.googleapis.com/fcm/send/a' }));
    await disablePush();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('pushSubscriptions/'), expect.objectContaining({ method: 'DELETE' }));
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});
