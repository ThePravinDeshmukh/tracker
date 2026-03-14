/**
 * Service worker registration — production only.
 * In development (npm start) the SW is intentionally skipped so HMR works normally.
 * Run `npm run build && npm run serve` for the full offline-capable experience.
 */

export function register(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
    navigator.serviceWorker.register(swUrl).catch(console.error);
  });
}

export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.unregister())
      .catch(console.error);
  }
}
