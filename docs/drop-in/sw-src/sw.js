// Source template. DO NOT edit public/sw.js — it is generated from this file
// by scripts/stamp-sw.mjs on every `dev` / `build`.
const BUILD_ID = '__BUILD_ID__';
const CACHE = `across-along-${BUILD_ID}`;
const STATIC_ASSETS = ['/manifest.json', '/icon.svg', '/apple-icon.png'];
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Bypass the HTTP cache so we precache THIS build's shell, not an old one.
      const res = await fetch('/', { cache: 'reload' });
      if (!res.ok) throw new Error('shell fetch failed'); // keep the old worker if we can't precache
      await cache.put('/', res.clone());
      const html = await res.text();
      const hashed = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]),
        ),
      ];
      await cache.addAll([...STATIC_ASSETS, ...hashed]);
      // NOTE: no skipWaiting() here on purpose. The page decides when to switch
      // (see hooks/useServiceWorker.ts) so an update never reloads mid-puzzle.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('across-along-') && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase etc. never touched
  if (url.pathname === '/sw.js') return;

  // 1) Page loads: NETWORK-FIRST. Fresh HTML whenever online; cached shell only as an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), NAV_TIMEOUT_MS);
          const res = await fetch(request, { signal: ctrl.signal });
          clearTimeout(timer);
          if (res.ok && url.pathname === '/') cache.put('/', res.clone());
          return res;
        } catch {
          return (await cache.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // 2) Content-hashed build files + static icons: CACHE-FIRST (filename changes when content changes).
  if (url.pathname.startsWith('/_next/static/') || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })(),
    );
  }
});
