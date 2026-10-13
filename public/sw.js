// Service Worker — bikin client bel bisa jalan OFFLINE penuh.
// PENTING (perbaikan v4): pencocokan cache HARUS di dalam cache versi ini saja,
// bukan caches.match global — cache lama (v2/v3) berisi index.html lama dan akan
// selalu menang kalau dicari global, bikin update tidak pernah tampil.
const CACHE = 'bel-v5';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'bel-audio').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return; // API: network saja, fallback ditangani aplikasi (localStorage)
  if (u.pathname.startsWith('/audio/')) {
    e.respondWith(caches.open('bel-audio').then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const res = await fetch(e.request); c.put(e.request, res.clone()); return res;
    }));
    return;
  }
  // Shell: network-first agar update selalu masuk, cache versi ini hanya untuk offline.
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(async () => {
    const c = await caches.open(CACHE);
    return (await c.match(e.request)) || (await c.match('/index.html'));
  }));
});
