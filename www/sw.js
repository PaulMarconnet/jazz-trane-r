const CACHE_NAME = 'jazz-traner-v51';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './i18n.js',
    './modules/library-domain.js',
    './modules/session-timer.js',
    './modules/history-analytics.js',
    './modules/score-navigation.js',
    './modules/storage-repo.js',
    './modules/system-host.js',
    './script.js',
    './libs/jszip.min.js',
    './libs/pdf.min.js',
    './libs/pdf.worker.min.js',
    './libs/Sortable.min.js',
    './libs/chart.min.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './jazz-trane-r-icon.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Exclure strictement les appels API du cache
    if (event.request.url.includes('/api')) {
        return; 
    }

    // Stratégie Network-First pour les scripts et pages principales pour garantir la fraîcheur du code
    const isAppCode = event.request.mode === 'navigate' || 
                      event.request.url.includes('script.js') || 
                      event.request.url.includes('i18n.js') ||
                      event.request.url.includes('/modules/') ||
                      event.request.url.includes('index.html') ||
                      event.request.url.includes('style.css');

    if (isAppCode) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Stratégie Cache-First pour les assets statiques (images, libs, polices)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});