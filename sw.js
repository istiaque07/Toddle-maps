var CACHE_NAME = 'offline-map-v3';
var ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './maplibre-gl.js',
    './maplibre-gl.css'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        }).catch(function(err) {
            console.error('SW install cache failed:', err);
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) { return key !== CACHE_NAME; })
                    .map(function(key) { return caches.delete(key); })
            );
        })
    );
});

self.addEventListener('fetch', function(event) {
    var url = event.request.url;
    var isOSMToken = url.indexOf('tile.openstreetmap.org') !== -1;
    var isOSMSubdomain = /^(https?:\/\/)?([a-z]\.)?tile\.openstreetmap\.org\//.test(url);

    if (isOSMSubdomain) {
        event.respondWith(
            caches.match(event.request).then(function(cachedResponse) {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(function(response) {
                    if (response && response.status === 200) {
                        var responseClone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                }).catch(function() {
                    return new Response('Tile unavailable offline', { status: 404 });
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(cachedResponse) {
            return cachedResponse || fetch(event.request);
        })
    );
});