/* v12.8.20 · stock type-forms v12.10 */
/* Shoeb Motors v12.8.9 — local-server build.
   Persistent static caching is disabled to prevent stale UI files after upgrades. */
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return /^shoeb-runtime-/i.test(k); }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.registration.unregister(); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function () { /* network handled normally */ });
