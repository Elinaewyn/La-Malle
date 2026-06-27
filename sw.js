/* En Valise — service worker (mise à jour automatique)
   Stratégie « réseau d'abord » : en ligne, l'app sert toujours la dernière
   version et rafraîchit le cache au passage ; hors-ligne, elle sert la copie
   en cache. Aucun numéro de version à incrémenter lors des mises à jour :
   il suffit de remplacer index.html sur l'hébergeur. */

const CACHE = "en-valise";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon-180.png",
  "./favicon-64.png"
];

// Pré-cache résilient : un fichier manquant ne bloque pas l'installation.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((u) => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Les ressources d'autres domaines (ex. Google Fonts) passent au réseau.
  if (url.origin !== self.location.origin) return;

  // Page / navigation : réseau d'abord, cache en secours hors-ligne.
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(req).then((hit) => hit || caches.match("./index.html"))
      )
    );
    return;
  }

  // Autres ressources même domaine : cache immédiat + rafraîchissement en fond.
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
