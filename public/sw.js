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
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => { if (event.request.method === 'GET') event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match('/')))); });
