const CACHE='choplab-scratch-room-v2';
const FILES=['./','index.html','style.css','app.js','manifest.webmanifest','audio/original-ahh.wav','audio/baby.wav','audio/chirp.wav','audio/transform.wav','audio/examples.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request))));
