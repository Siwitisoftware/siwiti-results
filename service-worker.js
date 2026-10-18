// Results System Service Worker — offline refresh-safe cache strategy.
// Keep the last working app shell available for browser refreshes and installed PWA launches.
const CACHE_VERSION = 'results-v5-offline-shell';
const CACHE = CACHE_VERSION;
const APP_SHELL_URLS = ['/', '/index.html', '/offline.html'];
const PRECACHE_URLS = [
  ...APP_SHELL_URLS,
  'https://cdn.jsdelivr.net/npm/notiflix@3.2.6/dist/notiflix-3.2.6.min.css',
  'https://cdn.jsdelivr.net/npm/notiflix@3.2.6/dist/notiflix-aio-3.2.6.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache each resource independently so a failed CDN request never blocks the app shell.
    await Promise.allSettled(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (err) {
        // Expected when install occurs on a weak connection or without network.
        console.warn('Precache skipped:', url, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('results-') && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function findCachedAppShell(request) {
  const cache = await caches.open(CACHE);
  // First try the exact request (including its path), then fall back to the app shell.
  let response = await cache.match(request, { ignoreSearch: true });
  if (response) return response;
  response = await cache.match('/');
  if (response) return response;
  response = await cache.match('/index.html');
  if (response) return response;
  return null;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Keep the successful latest app page available for the next offline refresh.
      await cache.put('/', response.clone());
      await cache.put('/index.html', response.clone());
      return response;
    }
    throw new Error('Navigation returned HTTP ' + response.status);
  } catch (err) {
    const cached = await findCachedAppShell(request);
    if (cached) return cached;
    // Only show the offline notice when no saved app shell exists at all.
    return (await cache.match('/offline.html')) || new Response(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Results System</title></head><body><h2>Results System</h2><p>You are offline. Open the app once while connected to the internet to save it for offline use.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // External libraries: use cached copy offline; refresh cache after successful network response.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch (err) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (request.mode === 'navigate') {
    // Key fix: offline refreshes use the saved app shell, not offline.html.
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (err) {
      return (await cache.match(request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
