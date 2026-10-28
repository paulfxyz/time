const CACHE_NAME = 'time-2.0.0';
const BASE = new URL('./', self.location).href;
const assetURL = path => {
  const url = new URL(path, BASE);
  if (/\.(js|css)$/.test(url.pathname)) url.searchParams.set('v', '2.0.0');
  return url.href;
};
const SHELL = [
  './', './index.html', './style.css', './scenes.css', './scenes.js', './ambient.js', './app.js', './picture.js', './themes.js',
  './earth.js', './solar.js', './icons.js', './manifest.webmanifest', './favicon.svg',
  './assets/earth-day.webp', './assets/earth-night.webp', './assets/earth-specular.webp',
  './assets/earth-clouds.webp', './assets/satoshi-light.woff2', './assets/satoshi-regular.woff2',
  './assets/satoshi-medium.woff2', './assets/satoshi-bold.woff2',
  './assets/jetbrains-mono.ttf', './assets/instrument-serif.ttf',
  './assets/app-icon-192.png', './assets/app-icon-512.png', './assets/app-icon-maskable.png',
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(SHELL.map(assetURL))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('time-') && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(BASE)) return;
  // Network first prevents an old release from masking a fresh FTP deployment.
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' });
    if (cached) return cached;
    if (event.request.mode === 'navigate') {
      return await caches.match(new URL('./index.html', BASE).href)
        || new Response('Time is not cached yet. Connect once, then try again.', { status: 503 });
    }
    return new Response('', { status: 503 });
  }));
});
