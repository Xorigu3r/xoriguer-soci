// Funcionament sense connexió (només a la versió web; l'APK porta els fitxers a dins).
const CACHE = 'xoriguer-soci-v1';
const FITXERS = ['./', 'index.html', 'style.css', 'i18n.js', 'traduccions.js', 'interpret.js', 'app.js', 'manifest.webmanifest', 'fonts/Montserrat-ExtraBold.ttf',
  'icons/simbol.png', 'icons/favicon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FITXERS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((r) => {
    const xarxa = fetch(e.request).then((resp) => {
      if (resp.ok) caches.open(CACHE).then((c) => c.put(e.request, resp.clone()));
      return resp;
    }).catch(() => r);
    return r || xarxa;
  }));
});
