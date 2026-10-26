// ════════════════════════════════════════════════════════
//  Permite instalar la app y abrirla SIN INTERNET.
//  Siempre intenta descargar la versión más reciente; si no hay
//  conexión (o tarda más de 4 s) usa la copia guardada en el ordenador.
// ════════════════════════════════════════════════════════
const CACHE = 'albaranes-v2';
const ARCHIVOS = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/config.js', 'js/imagenes.js', 'js/semilla.js', 'js/util.js', 'js/datos.js', 'js/archivos.js', 'js/pdf.js', 'js/app.js',
  'vendor/supabase.js', 'vendor/jspdf.umd.min.js', 'vendor/xlsx.full.min.js',
  'iconos/icono-192.png', 'iconos/icono-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ARCHIVOS).then(() => c.add('prueba.html').catch(() => {})))   // prueba.html solo existe en la copia de pruebas
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // Supabase y demás: no se tocan
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const red = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
    const espera = new Promise(res => setTimeout(res, 4000, null));
    try {
      const r = await Promise.race([red, espera]);
      if (r) return r;
    } catch (err) { /* sin conexión */ }
    const guardada = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    if (guardada) return guardada;
    return red;                                         // no hay copia: esperar a la red
  })());
});
