// Ongeza namba hii kila unapofanya deploy mpya (hiari - husaidia kusafisha
// cache za zamani, lakini si lazima tena kwa sababu fetch sasa ni "network-first").
const CACHE_VERSION = 'results-v4';
const CACHE = CACHE_VERSION;
const OFFLINE = '/offline.html';

// MUHIMU: Maktaba hizi za nje (Notiflix, SweetAlert2, FontAwesome) ndizo
// zinazotumika kuonyesha KILA ujumbe/loading kwenye app (hata ujumbe wa
// "hakuna mtandao"). Kabla, hazikuwa zime-cache kabisa - kwa hivyo mtumiaji
// akiwa offline, maktaba hizi zilikosekana, na app "iliganda" (button
// zikakosa kufanya kazi kimya kimya) kila zilipoitwa. Sasa zinahifadhiwa
// tangu mwanzo ili zipatikane hata bila mtandao.
const PRECACHE_URLS = [
  '/',
  OFFLINE,
  'https://cdn.jsdelivr.net/npm/notiflix@3.2.6/dist/notiflix-3.2.6.min.css',
  'https://cdn.jsdelivr.net/npm/notiflix@3.2.6/dist/notiflix-aio-3.2.6.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// INSTALL: hifadhi ukurasa muhimu + maktaba za nje. Kila URL inajaribiwa
// KIVYAKE (si kwa pamoja) - ikiwa moja itashindikana (mfano mtandao mbovu
// wakati wa install), zingine zote bado zitahifadhiwa kikamilifu.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('Imeshindikana kuhifadhi mapema:', url, err);
          })
        )
      )
    )
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
        // Cache API inaruhusu kuhifadhi maombi ya GET pekee (siyo POST,
        // kama yale yanayotumwa kwa Google Apps Script backend).
        if (event.request.method === 'GET' && response && response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Hakuna mtandao. Tumia cache iliyopo ikiwepo.
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Onyesha ukurasa wa "offline" KWA UFUNGUZI WA UKURASA PEKEE
          // (siyo kwa POST/API calls - hizo ziache kushindwa kwa kawaida
          // ili app ionyeshe ujumbe sahihi wa "hakuna mtandao" badala ya
          // kujaribu ku-parse HTML kama JSON).
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE);
          }
          return Response.error();
        });
      })
  );
});
