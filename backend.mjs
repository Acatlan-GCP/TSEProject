import { createHash, randomUUID } from 'node:crypto';
import {
  registrationEnabled, verifyToken, signIn, readDoc, listDocs, writeDoc, commitPublication,
  saveObject, removeObject, signedObject, describeImage, synthesize
} from './google.mjs';
import { cloudEnabled, BUCKET_NAME } from './gcp.mjs';
import { HttpError, artworkFields, normalizeNarration, normalizePreferences, text, verifyImage } from './model.mjs';

const HTTP = (status, data, headers) => ({ status, data, headers });
const okay = data => HTTP(200, data);
const notFound = () => new HttpError(404, 'No se encontró el recurso.');
let catalog;
let expiration = 0;
let pendingCatalog;

const trackURL = (id, key) => `/api/media/${id}/${key}`;
function publicData(work) {
  const { id, title, artist, year, category, technique, source, sound, summary, intro } = work;
  return {
    id, title, artist, year, category, technique, source, sound, summary, intro,
    ambientAudio: work.ambiencePath ? trackURL(id, 'ambiente') : '',
    image: trackURL(id, 'imagen'), summaryAudio: trackURL(id, 'ficha'), introAudio: trackURL(id, 'intro'),
    zones: work.zones.map(({ id: zoneId, bounds, label, position, text: narration }) => ({
      id: zoneId, bounds, label, position, text: narration, audio: trackURL(id, zoneId)
    }))
  };
}

async function getCatalog() {
  if (catalog && Date.now() < expiration) return catalog;
  if (!pendingCatalog) {
    pendingCatalog = listDocs('works').then(works => {
      catalog = works.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      expiration = Date.now() + 300000;
      return catalog;
    }).finally(() => { pendingCatalog = null; });
  }
  return pendingCatalog;
}

async function readBody(request, limit = 16000) {
  if (String(request.headers['content-type']).split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'Envía los datos en formato JSON.');
  }
  if (Number(request.headers['content-length']) > limit) throw new HttpError(413, 'La solicitud supera el tamaño máximo.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      request.resume();
      throw new HttpError(413, 'La solicitud supera el tamaño máximo.');
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new HttpError(400, 'El cuerpo de la solicitud debe ser un objeto JSON válido.'); }
}

async function readUser(request, curator = false) {
  const token = request.headers.authorization?.match(/^Bearer ([^ ]+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar.');
  const user = await verifyToken(token);
  if (curator && !user.curator) throw new HttpError(403, 'Tu cuenta no tiene acceso a curaduría.');
  return user;
}

async function authoringData(draft) {
  const { imagePath, ...data } = draft;
  return { ...data, image: await signedObject(imagePath) };
}

async function generateDraft(request, user) {
  const body = await readBody(request, 8_030_000);
  const base = artworkFields(body);
  const bytes = verifyImage(body.imageType, body.imageData);
  const id = randomUUID();
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const imagePath = `works/${id}/art.${extensions[body.imageType]}`;
  await saveObject(imagePath, bytes, body.imageType);
  try {
    const raw = await describeImage(base, imagePath, body.imageType);
    let narration;
    try { narration = normalizeNarration(raw); }
    catch { throw new HttpError(502, 'El borrador de Gemini no cumple el formato de las zonas. Intenta generarlo de nuevo.'); }
    const draft = { ...base, ...narration, id, imagePath, createdAt: new Date().toISOString(), createdBy: user.uid };
    await writeDoc('drafts', id, draft);
    return HTTP(201, { draft: await authoringData(draft) });
  } catch (error) {
    const stored = await readDoc('drafts', id).catch(() => undefined);
    if (stored === null) await removeObject(imagePath).catch(() => {});
    throw error;
  }
}

async function publish(request, id, user) {
  const body = await readBody(request);
  if (body.approved !== true) throw new HttpError(400, 'Confirma que revisaste los textos y las zonas.');
  const current = await readDoc('drafts', id);
  if (!current) {
    const result = await readDoc('works', id);
    if (result) return okay({ id, work: publicData(result.data) });
    throw notFound();
  }
  const { data: draft, updateTime } = current;
  const approved = normalizeNarration(body, draft.zones);
  const version = createHash('sha256').update(JSON.stringify(approved)).digest('hex').slice(0, 24);
  const tracks = [
    ['intro', approved.intro], ['ficha', `${draft.title}, de ${draft.artist}. ${approved.summary}`],
    ...approved.zones.map(zone => [zone.id, zone.text])
  ];
  const audio = Object.fromEntries(await Promise.all(tracks.map(async ([key, script]) => {
    const path = `works/${id}/audio/${version}/${key}.mp3`;
    const bytes = await synthesize(script);
    await saveObject(path, bytes, 'audio/mpeg');
    return [key, path];
  })));
  const ambiencePath = draft.sound ? `ambientes/amb-${draft.sound}.wav` : '';
  const artwork = { ...draft, ...approved, audio, ambiencePath, publishedAt: new Date().toISOString(), publishedBy: user.uid };
  try {
    await commitPublication(id, updateTime, artwork);
  } catch (error) {
    const published = await readDoc('works', id);
    if (!published) throw error;
    if (published.data.audio.intro !== audio.intro) {
      await Promise.allSettled(Object.values(audio).map(removeObject));
      throw new HttpError(409, 'Otra persona publicó el borrador mientras lo revisabas. Abre la obra publicada.');
    }
  }
  expiration = 0;
  return okay({ id, work: publicData(artwork) });
}

export async function api(request, path) {
  const method = request.method;
  if (method === 'GET' && path === '/api/config') return okay({ cloud: cloudEnabled, registration: registrationEnabled && cloudEnabled });
  if (method === 'GET' && path === '/api/catalog') {
    return okay({ works: cloudEnabled ? (await getCatalog()).map(publicData) : [] });
  }
  if (!cloudEnabled) throw new HttpError(503, 'La versión local funciona con el catálogo incluido. Conecta Google Cloud para usar cuentas y curaduría.');

  const workPage = path.match(/^\/api\/works\/([a-f0-9-]{36})$/);
  if (method === 'GET' && workPage) {
    const document = await readDoc('works', workPage[1]);
    if (!document) throw notFound();
    return okay({ work: publicData(document.data) });
  }

  const media = path.match(/^\/api\/media\/([a-f0-9-]{36})\/(imagen|ambiente|intro|ficha|zona-[1-4])$/);
  if (method === 'GET' && media) {
    const [, id, key] = media;
    const works = await getCatalog();
    const artwork = works.find(work => work.id === id) || (await readDoc('works', id))?.data;
    const object = key === 'imagen' ? artwork?.imagePath : key === 'ambiente' ? artwork?.ambiencePath : artwork?.audio?.[key];
    if (!object) throw notFound();
    return HTTP(302, null, { location: await signedObject(object), 'cache-control': 'public, max-age=60' });
  }

  if (method === 'POST' && ['/api/account/login', '/api/account/register'].includes(path)) {
    const register = path.endsWith('/register');
    if (register && !registrationEnabled) throw notFound();
    const { email, password } = await readBody(request, 4000);
    if (typeof password !== 'string' || password.length < 6 || password.length > 1200) {
      throw new HttpError(400, 'Revisa la contraseña.');
    }
    return okay(await signIn(text(email, 254, 'correo'), password, register));
  }
  if (path === '/api/preferences' && ['GET', 'PUT'].includes(method)) {
    const user = await readUser(request);
    const id = createHash('sha256').update(user.uid).digest('hex');
    if (method === 'GET') return okay({ preferences: (await readDoc('preferences', id))?.data ?? null });
    const preferences = normalizePreferences(await readBody(request, 4000));
    await writeDoc('preferences', id, preferences);
    return okay({ preferences });
  }
  if (path === '/api/curation/drafts' && ['GET', 'POST'].includes(method)) {
    const user = await readUser(request, true);
    if (method === 'POST') return generateDraft(request, user);
    const drafts = (await listDocs('drafts')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return okay({ drafts: drafts.map(({ id, title }) => ({ id, title })) });
  }
  const draftMatch = path.match(/^\/api\/curation\/drafts\/([a-f0-9-]{36})(\/publish)?$/);
  if (draftMatch) {
    const [, id, action] = draftMatch;
    const user = await readUser(request, true);
    if (method === 'POST' && action) return publish(request, id, user);
    if (method === 'GET' && !action) {
      const document = await readDoc('drafts', id);
      if (!document) throw notFound();
      return okay({ draft: await authoringData(document.data) });
    }
  }
  if (path === '/api/prueba') {
  if (method === 'POST') {
    const body = await readBody(request, 1000);
    await writeDoc('pruebas', 'test-doc', {
      mensaje: body.mensaje || 'Prueba',
      timestamp: body.timestamp || new Date().toISOString()
    });
    return okay({ exito: true, mensaje: 'Documento creado en Firestore' });
  }
  if (method === 'GET') {
    const doc = await readDoc('pruebas', 'test-doc');
    if (!doc) return okay({ mensaje: 'No hay documento de prueba aún' });
    return okay({ id: 'test-doc', datos: doc.data });
  }
}

// Test Storage: Subir archivo
if (path === '/api/subir' && method === 'POST') {
  // Leer el archivo del request (multipart/form-data)
  const boundary = request.headers['content-type']?.match(/boundary=(.+)/)?.[1];
  if (!boundary) throw new HttpError(400, 'Formato de archivo inválido');
  
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  
  // Parsear el archivo (simplificado para prueba)
  const fileMatch = buffer.toString('binary').match(/filename="([^"]+)"/);
  const fileName = fileMatch ? fileMatch[1] : `test-${Date.now()}.txt`;
  const path = `test-uploads/${Date.now()}-${fileName}`;
  
  await saveObject(path, buffer, 'application/octet-stream');
  return okay({ 
    exito: true, 
    mensaje: 'Archivo subido',
    ruta: path,
    url: `https://storage.googleapis.com/${BUCKET_NAME}/${path}`
  });
}
  throw notFound();
}
