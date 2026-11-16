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
      // Android draws the status bar icon from the alpha only: a white knight on transparent
      // (from the Staunty knight of src/components/pieces, CC BY-NC-SA 4.0)
      badge: new URL('badge-96.png', base).href,
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
