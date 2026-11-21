import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
import { createApp, parseRange } from '../server.mjs';
import { normalizeNarration, normalizePreferences, safeSource } from '../model.mjs';
import { works } from '../public/works.js';

test('los audios admiten intervalos abiertos y parciales', () => {
  assert.deepEqual(parseRange('bytes=0-1', 8), { start: 0, end: 1 });
  assert.deepEqual(parseRange('bytes=4-', 8), { start: 4, end: 7 });
  assert.deepEqual(parseRange('bytes=-2', 8), { start: 6, end: 7 });
  assert.equal(parseRange('bytes=8-', 8), false);
  assert.equal(parseRange('bytes=5-3', 8), false);
});

test('revisión editorial valida las coordenadas y conserva los identificadores', () => {
  for (const item of works) {
    assert.deepEqual(normalizeNarration(item, item.zones).zones.map(zone => zone.id), item.zones.map(zone => zone.id));
  }
  const sample = structuredClone(works[0]);
  sample.zones[0].bounds = [0, .9, .2, .8];
  assert.throws(() => normalizeNarration(sample), /dentro de la imagen/);
  assert.throws(() => safeSource('javascript:alert(9)'), /HTTPS/);
  assert.throws(() => normalizePreferences({ rate: 99 }), /no son válidos/);
});

test('catálogo local incluye imágenes, narraciones y manifiesto', async () => {
  for (const work of works) {
    const paths = [work.image, work.introAudio, work.summaryAudio, ...work.zones.map(zone => zone.audio)];
    await Promise.all(paths.map(path => access(new URL('../public' + path, import.meta.url))));
  }
  await access(new URL('../public/media/bienvenida.wav', import.meta.url));
});

test('servidor permite ejecutar el catálogo local y entrega audio parcial', async t => {
  const server = createApp().listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const index = await fetch(url);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /Arte al oído/);
  const config = await fetch(`${url}/api/config`);
  assert.deepEqual(await config.json(), { cloud: false, registration: false });
  const restricted = await fetch(`${url}/api/curation/drafts`);
  assert.equal(restricted.status, 503);
  const audio = await fetch(`${url}${works[0].introAudio}`, { headers: { range: 'bytes=0-3' } });
  assert.equal(audio.status, 206);
  assert.equal(await audio.text(), 'RIFF');
  assert.match(audio.headers.get('content-range'), /^bytes 0-3\//);
});
