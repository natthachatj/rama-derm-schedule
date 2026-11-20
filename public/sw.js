// Cache only this explicit public allowlist. Records, schedules, authentication,
// exports and application responses are never persisted by this worker.
const CACHE = 'rama-derm-public-__BUILD_ID__';
// Filled with exact public build paths; no runtime API or private file patterns.
const BUILD_ASSETS = /*BUILD_ASSETS*/ [];
const PUBLIC_FILES = ['/offline.html', '/icons/app-192.png', '/icons/app-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('rama-derm-public-') && key !== CACHE).map(key => caches.delete(key))
  )));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/' || url.pathname === '/login' || url.pathname === '/password') {
    if (event.request.mode === 'navigate') {
      event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
    }
  } else if (BUILD_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && !response.redirected) { try { await cache.put(url.pathname, response.clone()); } catch { /* Storage can be unavailable or full. */ } }
      return response;
    }));
  } else if (PUBLIC_FILES.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
  }
});
