// Ongeza namba hii kila unapofanya deploy mpya (hiari - husaidia kusafisha
// cache za zamani, lakini si lazima tena kwa sababu fetch sasa ni "network-first").
const CACHE_VERSION = 'results-v2';
const CACHE = CACHE_VERSION;
const OFFLINE = '/offline.html';
const PRECACHE_URLS = ['/', OFFLINE];

// INSTALL: hifadhi ukurasa wa offline, kisha "skipWaiting" ili service
// worker mpya isubiri kutumika mara moja badala ya kungoja tabs zote zifungwe.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ACTIVATE: futa cache za zamani (matoleo ya nyuma) na chukua udhibiti wa
// tabs zote zilizo wazi mara moja, bila kusubiri reload.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// FETCH: NETWORK-FIRST. Jaribu kupata toleo jipya kutoka kwenye server
// KILA WAKATI mtumiaji akiwa na mtandao (hii ndiyo inayohakikisha kila
// update unayofanya inafika kwa watumiaji moja kwa moja). Tumia cache
// PEKEE endapo mtandao haupatikani (offline mode).
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Hifadhi nakala mpya kwenye cache kwa matumizi ya offline baadaye
        const responseClone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() =>
        // Hakuna mtandao: tumia cache iliyopo, au ukurasa wa offline
        caches.match(event.request).then((cached) => cached || caches.match(OFFLINE))
      )
  );
});
