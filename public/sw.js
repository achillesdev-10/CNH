/* ── CNH Service — Service Worker ──────────────────────────────
 * Stratégies :
 *  - Navigations (pages HTML) : network-first, repli cache, puis /offline.html
 *  - Assets statiques (icônes, manifest, CSS/JS CDN, fonts, images) :
 *    stale-while-revalidate
 *  - /api/*, requêtes non-GET, requêtes cross-origin de données : JAMAIS
 *    mises en cache (réservations, admin, sessions, stats restent en direct)
 * ════════════════════════════════════════════════════════════ */
var CACHE_NAME = 'cnh-static-v1';
var OFFLINE_URL = '/offline.html';

// Assets pré-cachés au démarrage : uniquement du statique sans risque.
var PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png'
];

// Installation : pré-cache du minimum vital, ne bloque pas si un fichier manque.
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(PRECACHE_URLS.map(function(url) {
        return cache.add(new Request(url, { cache: 'reload' }));
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activation : nettoyage des anciens caches + prise de contrôle immédiate.
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.filter(function(n) { return n !== CACHE_NAME; })
        .map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

function isStaticAsset(request) {
  if (request.method !== 'GET') return false;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // CDNs statiques uniquement (fonts Google, Font Awesome, images Unsplash) :
    // les réponses cross-origin de données ne sont pas concernées (API jamais fetchée cross-origin ici).
    return /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|images\.unsplash\.com/.test(url.hostname);
  }
  if (url.pathname.startsWith('/api/')) return false; // données dynamiques : jamais cachées
  return /\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?|webmanifest)$/.test(url.pathname) ||
         url.pathname.startsWith('/icons/');
}

// Stale-while-revalidate : réponse rapide depuis le cache, mise à jour en arrière-plan.
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var network = fetch(request).then(function(response) {
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone()).catch(function() {});
        }
        return response;
      }).catch(function() { return undefined; });
      return cached || network.then(function(res) {
        return res || new Response('', { status: 504, statusText: 'Hors connexion' });
      });
    });
  });
}

// Network-first avec repli offline pour les navigations (HTML).
function networkFirstNavigation(request) {
  return fetch(request).then(function(response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(request, copy).catch(function() {}); });
    }
    return response;
  }).catch(function() {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      return caches.match(OFFLINE_URL).then(function(offline) {
        return offline || new Response(
          '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Hors connexion — CNH Service</title>' +
          '<body style="font-family:sans-serif;text-align:center;padding:48px">' +
          '<h1>Vous êtes hors connexion</h1><p>Vérifiez votre connexion puis réessayez.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      });
    });
  });
}

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') return;               // POST/PUT/PATCH/DELETE : réseau direct
  var url = new URL(request.url);
  if (url.origin !== self.location.origin && !isStaticAsset(request)) return; // données cross-origin : réseau direct

  if (request.mode === 'navigate' ||
      (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Tout le reste (API, autres) : pas d'interception → réseau direct, jamais de cache obsolète.
});
