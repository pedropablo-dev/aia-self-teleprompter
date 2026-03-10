const CACHE_NAME = 'aia-prompter-v1';
const ASSETS = [
    './',
    './index.html',
    './css/prompter.css',
    './js/app.js',
    './js/state.js',
    './js/ui.js',
    './js/engine.js',
    './js/storage.js',
    './js/history-manager.js',
    './img/favicon.ico',
    'https://cdn.jsdelivr.net/npm/drag-drop-touch@1.3.1/DragDropTouch.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
