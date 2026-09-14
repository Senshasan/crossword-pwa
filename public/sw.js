const CACHE = 'across-along-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const shellResponse = await fetch('/');
      await cache.put('/', shellResponse.clone());
      const shell = await shellResponse.text();
      const assets = [...shell.matchAll(/(?:src|href)="(\/[^\"]+)"/g)]
        .map((match) => match[1])
        .filter((asset) => asset.startsWith('/_next/static/'));
      await cache.addAll(['/manifest.json', '/icon.svg', '/apple-icon.png', ...assets]);
    }),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin && (url.pathname === '/' || url.pathname === '/manifest.json' || url.pathname === '/icon.svg' || url.pathname === '/apple-icon.png' || url.pathname.startsWith('/_next/static/'));
  if (event.request.method !== 'GET' || !cacheable) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match('/'))),
  );
});
