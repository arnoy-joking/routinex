// RoutineX — Cache Only PWA (shell cached, data is network-only)
const CACHE_NAME = 'routinex-shell-v1';
const SHELL_ASSETS = [
  './',
  './routine.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-144.png',
  './icon-96.png'
];

// Install — cache shell only (no Supabase, no CDN data)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(()=>{})
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(()=> self.clients.claim())
  );
});

// Fetch — CACHE ONLY for shell, NETWORK ONLY for Supabase, STALE-WHILE for nothing else
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't cache Supabase / API / POST / non-GET
  if (req.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return; // network only — never cache private data
  if (url.hostname.includes('supabase')) return;

  // For navigation (HTML) — Cache First, fallback to network, then cached shell
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return caches.match('./routine.html').then((shell) => {
          return fetch(req)
            .then((res) => {
              // optionally cache new navigation
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(()=>{});
              return res;
            })
            .catch(() => shell || cached);
        });
      })
    );
    return;
  }

  // For same-origin static (icons, manifest, shell) — Cache First (cache only as you asked)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // cache new same-origin GETs
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(()=>{});
          }
          return res;
        }).catch(()=> cached);
      })
    );
    return;
  }

  // For CDN / fonts / external — network only (don't bloat cache, always fresh)
  // If you want them cached too, uncomment below for stale-while-revalidate
  // event.respondWith(fetch(req).catch(()=> caches.match(req)));
  return;
});
