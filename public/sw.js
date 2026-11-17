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
      icon: new URL('icon-192.png', base).href,
      badge: BADGE,
      tag: 'mosse',
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
