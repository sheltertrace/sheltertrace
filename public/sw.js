// ShelterTrace Service Worker
// Provides offline capability and caching for the officer mobile app.

const CACHE_NAME = "sheltertrace-v1";
const OFFLINE_URL = "/officer-app";

// Core app shell — cached on install for offline access
const APP_SHELL = [
  "/officer-app",
  "/manifest.json",
  "/mcas_logo.png",
  "/logo.jpg",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache the app shell; ignore individual failures
      return Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    })
  );
  // Take control immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Supabase API calls — always require network
  if (url.hostname.includes("supabase") || url.hostname.includes("supabase.co")) {
    return;
  }

  // For navigation requests, try network first then fall back to cached officer-app
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // For static assets, use cache-first strategy
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Everything else: network first, no caching
  // (API routes, dynamic pages, etc.)
});

// ── Background Sync ───────────────────────────────────────────────────────────
// If the browser supports Background Sync, flush queued location pings
// when connectivity is restored after going offline.
self.addEventListener("sync", (event) => {
  if (event.tag === "location-sync") {
    event.waitUntil(flushLocationQueue());
  }
});

async function flushLocationQueue() {
  // The main page stores queued pings in IndexedDB under "location-queue".
  // Here we just signal the page to flush — actual Supabase calls happen there.
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "FLUSH_LOCATION_QUEUE" });
  }
}
