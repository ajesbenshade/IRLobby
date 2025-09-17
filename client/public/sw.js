// Service Worker for IRLobby PWA
const CACHE_NAME = 'irlobby-v1';
const STATIC_CACHE = 'irlobby-static-v1';
const API_CACHE = 'irlobby-api-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/manifest.json'
  // Removed icon files as they're now inline SVG
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_FILES))
      .catch((error) => {
        console.error('Failed to cache static files:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for non-HTTP/HTTPS requests (chrome-extension, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Skip caching for external domains (only cache our own domain)
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Only cache successful GET requests
            if (request.method === 'GET' && response.status === 200) {
              try {
                cache.put(request, response.clone());
              } catch (error) {
                console.warn('Failed to cache API response:', error);
              }
            }
            return response;
          })
          .catch((error) => {
            console.log('API request failed, trying cache:', error);
            // Return cached version if available
            return cache.match(request);
          });
      })
    );
    return;
  }

  // Handle static files
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request)
          .then((response) => {
            // Cache static files
            if (response.status === 200 && request.method === 'GET' && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE)
                .then((cache) => {
                  try {
                    return cache.put(request, responseClone);
                  } catch (error) {
                    console.warn('Failed to cache static file:', error);
                  }
                });
            }
            return response;
          });
      })
      .catch((error) => {
        console.log('Fetch failed:', error);
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Running background sync...');
  try {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();

    for (const request of keys) {
      try {
        await fetch(request);
        await cache.delete(request);
      } catch (error) {
        console.log('Background sync failed for request:', error);
      }
    }
  } catch (error) {
    console.error('Background sync error:', error);
  }
}