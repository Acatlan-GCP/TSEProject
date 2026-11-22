const version = 'arte-al-oido-1.0.3';
const shell = [
  '/', '/galeria/', '/buscar/', '/ajustes/', '/obra/', '/cuenta/', '/curaduria/',
  '/assets/css/styles.css', '/assets/js/app.js', '/assets/js/works.js', '/assets/js/player.js',
  '/assets/js/account.js', '/assets/manifest.webmanifest',
  '/media/icon-192.png', '/media/icon-512.png'
];
const art = {
  'gran-ola': ['ola', 'fuji', 'barcas'], dormitorio: ['sillas', 'ventana', 'cama'],
  nenufares: ['hojas', 'reflejos', 'flores']
};
const media = [
  '/media/bienvenida.wav',
  ...Object.entries(art).flatMap(([id, zones]) => [
    `/media/${id}.jpg`, ...['intro', 'ficha', ...zones].map(zone => `/media/${id}-${zone}.wav`)
  ]),
  ...['mar', 'cuarto', 'estanque'].flatMap(name => ['', '-0', '-1', '-2', '-3'].map(index => `/media/amb-${name}${index}.wav`))
];

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(version);
  await cache.addAll(shell);
  await Promise.allSettled(media.map(path => cache.add(path)));
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('arte-al-oido-') && key !== version).map(key => caches.delete(key)));
  await self.clients.claim();
})()));

async function ranged(response, range) {
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!match || !match[1] && !match[2] || !Number.isSafeInteger(start) || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': response.headers.get('Content-Type') || 'audio/wav',
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`
  }});
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(version);
    if (request.mode === 'navigate') {
      try { return await fetch(request); } catch { return cache.match('/'); }
    }
    if (url.pathname === '/works.js') {
      try {
        const response = await fetch(request);
        if (response.ok && response.status === 200) {
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        throw error;
      }
    }
    const cached = await cache.match(url.pathname);
    const range = request.headers.get('range');
    if (cached) return range ? ranged(cached, range) : cached;
    const response = await fetch(request);
    if (response.ok && response.status === 200 && media.includes(url.pathname)) {
      await cache.put(url.pathname, response.clone()).catch(() => {});
    }
    return response;
  })());
});
