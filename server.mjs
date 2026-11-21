import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './backend.mjs';
import { cloudEnabled } from './google.mjs';
import { HttpError } from './model.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const staticTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'
};
const security = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'microphone=(self), camera=(), geolocation=()',
  'content-security-policy': "default-src 'self'; img-src 'self' https://storage.googleapis.com; media-src 'self' https://storage.googleapis.com; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};

export function parseRange(range, size) {
  if (!range) return null;
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2]) || size === 0) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end ? { start, end } : false;
}

async function serveFile(request, response, path) {
  if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'Método no admitido.');
  const target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  const type = staticTypes[extname(target)];
  if (!target.startsWith(resolve(root) + sep) || !type) throw new HttpError(404, 'No se encontró el recurso.');
  const file = await stat(target).catch(() => null);
  if (!file?.isFile()) throw new HttpError(404, 'No se encontró el recurso.');
  const range = parseRange(request.headers.range, file.size);
  const headers = { 'content-type': type, 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
  if (range === false) {
    response.writeHead(416, { ...headers, 'content-range': `bytes */${file.size}` });
    return response.end();
  }
  headers['content-length'] = range ? range.end - range.start + 1 : file.size;
  if (range) headers['content-range'] = `bytes ${range.start}-${range.end}/${file.size}`;
  response.writeHead(range ? 206 : 200, headers);
  if (request.method === 'HEAD') return response.end();
  const stream = createReadStream(target, range || undefined);
  response.on('close', () => stream.destroy());
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

function send(response, { status, data, headers }) {
  const body = data ? JSON.stringify(data) : '';
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body), ...headers
  });
  response.end(body);
}

export function createApp() {
  return createServer(async (request, response) => {
    const start = performance.now();
    let path;
    for (const [header, value] of Object.entries(security)) response.setHeader(header, value);
    try {
      try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
      catch { throw new HttpError(400, 'La dirección no es válida.'); }
      if (path === '/healthz') return send(response, { status: 200, data: { ready: true, cloud: cloudEnabled } });
      if (path.startsWith('/api/')) return send(response, await api(request, path));
      return await serveFile(request, response, path);
    } catch (error) {
      if (!(error instanceof HttpError)) {
        console.error(JSON.stringify({ severity: 'ERROR', service: error.service, message: error.message }));
      }
      if (!response.headersSent) {
        const status = error instanceof HttpError ? error.status : 502;
        const message = error instanceof HttpError ? error.message : 'El servicio no pudo responder. Intenta de nuevo en unos minutos.';
        send(response, { status, data: { error: message } });
      }
    } finally {
      if (cloudEnabled && path?.startsWith('/api/')) {
        console.log(JSON.stringify({
          severity: 'INFO', method: request.method, route: path.split('/').slice(0, 4).join('/').replace(/[a-f0-9-]{36}/g, ':id'),
          status: response.statusCode, milliseconds: Math.round(performance.now() - start)
        }));
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || (process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1');
  createApp().listen(port, host, () => console.log(`Arte al oído en http://${host}:${port} (${cloudEnabled ? 'Google Cloud' : 'catálogo incluido'})`));
}
