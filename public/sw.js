// Service worker of the public site: the pages open without network too (the installed app above
// all). It only keeps the site's own files; the tournament data is kept by the page itself
// (src/lib/publicCache.ts), which says of when it is.
// - the files under assets/ have their content in the name: taken from the cache when there
// - everything else of the site (the page, config.json, icons): from the network, the cache only
//   when the network does not answer, so a new deploy is seen at once
const CACHE = 'scacchi-and-chill-v1';
const MAX_ASSETS = 120;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function keep(request, response) {
  if (!response.ok) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  // Files of old deploys go, oldest first
  const keys = await cache.keys();
  const assets = keys.filter((k) => new URL(k.url).pathname.includes('/assets/'));
  await Promise.all(assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

async function fromCacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  keep(request, response.clone());
  return response;
}

async function fromNetworkFirst(request) {
  try {
    const response = await fetch(request);
    keep(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate', ignoreVary: true });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.includes('/assets/') ? fromCacheFirst(request) : fromNetworkFirst(request));
});

// The first visit loaded its files before this worker was there: the page then lists them, to keep
// them from that visit already
self.addEventListener('message', (event) => {
  const urls = Array.isArray(event.data?.keep) ? event.data.keep : [];
  const own = urls.filter((u) => typeof u === 'string' && new URL(u, self.location.href).origin === self.location.origin);
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(own.map(async (u) => (await cache.match(u)) || fetch(u).then((r) => keep(new Request(u), r)).catch(() => {})))
    )
  );
});

// Android draws the status bar icon of a notification from its alpha only: a white knight on
// transparent (public/badge-96.png, from the Staunty knight of src/components/pieces, CC BY-NC-SA
// 4.0). Inline, because Chrome downloads a notification's images itself, without this worker's
// cache: with a weak signal the download failed and Android showed its generic bell instead.
const BADGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAFTklEQVR4nOydW6hVVRSG/2NBlKWWD2KmUBkVSjdKs8uJCimKHooKKotCesgIK4oIIbDC5x4iISK6HbrQQ3S3SIkky6SC7p1UwpDofodM2P3DPTeeBy97e8aYY8zJ/OBnbs7Ze6+5xr/GmnPNNefaE9BwZQIarjQDnGkGONMMcKYZ4EwzwJlmgDPNAGeaAc40A5xpBjjTDHAmtAGdTmceNR0VE9YABn45i/eprXz9O7WWups6EhUROQMOHfN6EnUmtYLaRBPeoU5GBUQ24Lc9/O8s6kOacD8Kp1QDeiyjCR9Qh6NQIhvwc5/vO5XaQBNOQ4GUngE9pKe0PjXU11EHohAiG7AfBkca6sepH2jCSup4BGcIAWHg5rN4i5qI8fMm9cDQ0NCrCEg4Axj8BSxWUYdAly+pJTRiDQIRygAGXxpUCdDBsOMx6nYa8SsCEMaATMHv8SO1lCY8DWdCGJA5+GN5glpMI7bDCXcD0jn/DeQPfo+11CU0YZBurxquBqTgS2/Hq9/eQTcGX1DDNOEnZMbNAAZ/GotR6Pd29pVPqXNowi/IiMuFGIM/GTZdzfEwl1rNuh2GjGQ3gDsoF1dyzj8R8ZA6PYOMZDWAwZftvUjNQ0ykTVjIei5FJrK2AdyxJ1ksQhnMYXvwOYzJlgEM/rMoJ/jCQ8hAlgxg8F9mcTHK4zzrsSPzDGDwn0eZwRfugzFmGcDAy3c/R12OnRc8JdGr8ynMgo9ghEkGpOBLg1tq8IVena+CISaBoQGPsFiMOtjCDJgFI9QzIE0VqSX4wkzu00kwQtUAVvRKFstQH2aTwPaHEgz+ceiOr9eIWQaoGJCmgbxEHYA6OQFGaGXADdRs1IvZwKFKL4gZ8DFijm5qMpG9oX+gjJYBHdTPVIubNVq9oFXw4wXqXdhzEAzQMuBG6m/k4ztKFnDM4FF5KctpsMfkvrVKI8wgbOFZ6A6+XAn9oYe/KBmL2TBGo9zmjtMet3sri6NhP+RhkgGqFWYwnmJxDcaP3LJcTa1hoNdj99ubwmIzNQX2zGVdPoMyahdiieupo6gFA3xme6rHNmqEWsEd/WZvH0rBfx15gi/8AQPUU5aBkbVd66hjB/iYHPE3MfCb+nkztyHf/Qq6p55cTGL9/oQy6oNxadKrrOHqp2ck/epF/MwFAwT/ZnRnOucMPiyCL5jcD5AZZtSFfLmE2t1sMzHqfL5vBH3AwM+ipF14EPkxm7ZoekuSwZVekbQJ91Ib05/lqJd++9n8/3v9fA8Dfy26M9fOhQ9mBoS+U5XaE7m5cxl8+YQHi8mAnHYvSA0Gfw6L16iZ8GcrjAi5SI/BvwjdxxRECL7wNYwIZwCDL0PbMo9IY4GeFnu9LtlXQhmQHtDxKOK1TaMwIkwbwODfwuIexMQsA6KsERtm8TaCwh6QWZyiZMDDiIvZ0S+4G8Cj/04MNm6Um3oNSOvEliM2Zg2w4J0Bt8FvhWS/fAVDvA24GvExNcDtOiCtjo9ypbsrejM9qs2AhYiNdD07cr8bhrgYwKNfbnBfgfh8D2M81gnLKKekdQmPnZzO+pq2U7nXCZ+B7s2YI1AOI2nqiwm51wnLsO4xKA+ZuTGb7cG3UCbnOmFZL1Zi8AVpK++CATlPQaaL3TJg0hbkNGA+ymZymo+kShYDWPGpLGagfE6HMrkyYBh1oG5ArguxWn6EQX0/chmwDXWgvh+5DPgPdaC+Hy0DBqPYDNiMOtgIZbINRbArKnMrsz6RUJl/ORSxDsqU+BiZqmg/5OZMM8CZZoAzzQBnmgHONAOcaQY40wxwphngTDPAmWaAM/8DAAD//w889DoAAAAGSURBVAMAl4qS3LZFWkIAAAAASUVORK5CYII=';

// The large icon of a notification, the app icon (public/notification-icon-144.png, from
// icon-512.png at 144 px and 128 colours). Inline for the same reason as the badge: when Chrome
// could not download icon-192.png it drew a grey circle with the G of giordy.github.io instead.
const ICON = 'data:image/png;base64,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';

// Push notifications of the moves (scripts/push.mjs sends them, src/lib/push.ts subscribes): one
// at a time, the newer in place of the older, so a phone left aside does not fill up
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const base = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Scacchi & Chill', {
      body: data.body || 'Mosse nuove nelle partite del torneo',
      icon: ICON,
      badge: BADGE,
      // The organizer's notification of a round past its end has its own (scripts/push.mjs)
      tag: data.tag || 'mosse',
      renotify: true,
      data: { url: new URL(data.hash || '#/partite', base).href },
    })
  );
});

// A tap opens the Partite tab: in the site's window when there is one, otherwise in a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const own = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (own) return own.navigate(url).then((w) => (w || own).focus()).catch(() => own.focus());
      return self.clients.openWindow(url);
    })
  );
});
