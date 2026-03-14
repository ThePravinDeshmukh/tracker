/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Take control of all clients immediately on activation
clientsClaim();

// Precache every asset emitted by the build (CRA injects the manifest here)
precacheAndRoute(self.__WB_MANIFEST);

// Serve index.html for all navigation requests (SPA fallback)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Cache Google Fonts with a stale-while-revalidate strategy
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20 })],
  })
);

// Skip waiting so updates take effect without requiring a tab reload
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
