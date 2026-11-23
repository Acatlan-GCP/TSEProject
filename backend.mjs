import { createHash, randomUUID } from 'node:crypto';
import {
  registrationEnabled, verifyToken, signIn, readDoc, listDocs, writeDoc, deleteDoc, // 👈 AGREGA deleteDoc AQUÍ
  commitPublication, saveObject, removeObject, signedObject, describeImage, synthesize, synthesizeSpeech
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
  const title = work.title || work.author || 'Obra sin título';
  const artist = work.artist || 'Artista desconocido';
  const year = work.year || 'Año no especificado';
  const technique = work.technique || 'Técnica no especificada';
  const category = work.category || 'Galería';
  const source = work.source || '';
  const sound = work.sound || '';
  
  const intro = work.intro || work.aiDescription || '';
  const summary = work.summary || work.aiDescription || '';

  const mappedZones = (work.zones || []).map((zone, index) => ({
    id: zone.id || `zona-${index + 1}`,
    label: zone.label || `Zona ${index + 1}`,
    position: zone.position || '',
    text: zone.text || zone.narration || '',
    bounds: zone.bounds || [0, 0, 0, 0],
    audio: zone.audioPath ? trackURL(work.id, `zona-${index + 1}`) : (zone.audio || '')
  }));

  return {
    id: work.id,
    title,
    artist,
    year,
    category,
    technique,
    source,
    sound,
    summary,
    intro,
    ambientAudio: work.ambiencePath ? trackURL(work.id, 'ambiente') : '',
    image: work.imagePath ? trackURL(work.id, 'imagen') : '',
    summaryAudio: work.audio?.ficha ? trackURL(work.id, 'ficha') : '',
    introAudio: work.introAudioPath ? trackURL(work.id, 'intro') : (work.narrationAudioPath ? trackURL(work.id, 'narracion') : (work.audio?.intro ? trackURL(work.id, 'intro') : '')),
    zones: mappedZones
  };
}

async function getCatalog() {
  if (catalog && Date.now() < expiration) return catalog;
  if (!pendingCatalog) {
    pendingCatalog = listDocs('works').then(works => {
      // FIX: Usar createdAt como respaldo si publishedAt no existe (borradores)
      catalog = works.sort((a, b) => {
        const dateA = a.publishedAt || a.createdAt || '0';
        const dateB = b.publishedAt || b.createdAt || '0';
        return dateB.localeCompare(dateA);
      });
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

  const media = path.match(/^\/api\/media\/([a-f0-9-]{36})\/(imagen|ambiente|intro|ficha|zona-[1-4]|narracion)$/);
  if (method === 'GET' && media) {
    const [, id, key] = media;
    
    const document = await readDoc('works', id);
    if (!document) throw notFound();
    
    const artwork = document.data;
    
    // Lógica robusta para encontrar el archivo correcto
    let object = null;
    if (key === 'imagen') {
      object = artwork?.imagePath;
    } else if (key === 'narracion' || key === 'intro') {
      // 👈 AQUÍ ESTÁ LA CLAVE: Si piden 'intro', busca primero en narrationAudioPath
      object = artwork?.narrationAudioPath || artwork?.audio?.[key];
    } else if (key === 'ambiente') {
      object = artwork?.ambiencePath;
    } else if (key === 'ficha') {
      object = artwork?.audio?.[key];
    } else if (key.startsWith('zona-')) {
      const zoneIndex = parseInt(key.split('-')[1], 10) - 1;
      object = artwork?.zones?.[zoneIndex]?.audioPath || artwork?.audio?.[key];
    }
                  
    if (!object) throw notFound();
    
    return HTTP(302, null, { 
      location: await signedObject(object), 
      'cache-control': 'public, max-age=60' 
    });
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

if (path === '/api/admin/register' && method === 'POST') {
    const { email, password, realName, username } = await readBody(request, 4000);
    
    // Validar campos
    const cleanEmail = text(email, 254, 'correo');
    const cleanPassword = text(password, 1200, 'contraseña');
    const cleanRealName = text(realName, 100, 'nombre real');
    const cleanUsername = text(username, 30, 'nombre de usuario').toLowerCase();

    if (cleanPassword.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres.');

    // 1. Verificar que el username no exista (Colección 'usernames')
    const existingUsername = await readDoc('usernames', cleanUsername);
    if (existingUsername) {
      throw new HttpError(409, 'El nombre de usuario ya está en uso.');
    }

    // 2. Crear usuario en Firebase Auth
    const authResult = await signIn(cleanEmail, cleanPassword, true);
    const uid = authResult.user.uid;

    // 3. Guardar perfil en Firestore (Colección 'users')
    await writeDoc('users', uid, {
      realName: cleanRealName,
      username: cleanUsername,
      email: cleanEmail,
      role: 'creador', // Rol por defecto
      createdAt: new Date().toISOString()
    });

    // 4. Reservar el username (Colección 'usernames')
    await writeDoc('usernames', cleanUsername, { uid });

    return okay({ 
      message: 'Usuario creado exitosamente', 
      token: authResult.token,
      user: { uid, username: cleanUsername, role: 'creador' }
    });
  }

  // LOGIN DE USUARIO
  if (path === '/api/admin/login' && method === 'POST') {
    const { email, password } = await readBody(request, 4000);
    const cleanEmail = text(email, 254, 'correo');
    const cleanPassword = text(password, 1200, 'contraseña');

    const authResult = await signIn(cleanEmail, cleanPassword, false);
    const uid = authResult.user.uid;

    // Leer perfil completo desde Firestore
    const userProfile = await readDoc('users', uid);
    if (!userProfile) {
      throw new HttpError(500, 'Error al recuperar el perfil del usuario.');
    }

    return okay({ 
      message: 'Inicio de sesión exitoso',
      token: authResult.token,
      user: { uid, ...userProfile.data }
    });
  }

  // OBTENER PERFIL DEL USUARIO LOGUEADO
  if (path === '/api/admin/me' && method === 'GET') {
    const user = await readUser(request); // Usa tu función existente que valida el token
    const userProfile = await readDoc('users', user.uid);
    return okay({ user: userProfile.data });
  }

  // ==========================================
  // 🎨 ADMIN: GESTIÓN DE OBRAS (CRUD)
  // ==========================================

  // LISTAR OBRAS (Admin ve todas, Creador ve solo las suyas)
  if (path === '/api/admin/works' && method === 'GET') {
    const user = await readUser(request);
    const allWorks = await listDocs('works');
    
    if (user.role === 'administrador') {
      return okay({ works: allWorks });
    }
    
    // Filtrar solo las obras del creador
    const userWorks = allWorks.filter(work => work.creatorId === user.uid);
    return okay({ works: userWorks });
  }

  // CREAR NUEVA OBRA (Borrador)
  if (path === '/api/admin/works' && method === 'POST') {
    const user = await readUser(request);
    const body = await readBody(request, 10_000_000);

    const workId = randomUUID();
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const imagePath = `works/${workId}/art.${extensions[body.imageType] || 'jpg'}`;

    const imageBytes = verifyImage(body.imageType, body.imageData);
    await saveObject(imagePath, imageBytes, body.imageType);

    const workData = {
      id: workId,
      creatorId: user.uid,
      title: text(body.title, 120, 'título') || text(body.artist, 120, 'título'),
      artist: text(body.artist, 120, 'artista') || text(body.author, 120, 'artista'),
      year: text(body.year, 20, 'año'),
      technique: text(body.technique, 100, 'técnica'),
      category: text(body.category, 100, 'categoría'),
      exhibitionPlace: text(body.exhibitionPlace, 200, 'lugar de exposición'),
      intro: text(body.intro, 3000, 'introducción'),
      summary: text(body.summary, 1000, 'resumen'),
      aiDescription: text(body.aiDescription, 3000, 'descripción IA'),
      uploadDate: new Date().toISOString(),
      imagePath: imagePath,
      imageType: body.imageType || 'image/jpeg',
      zones: body.zones || [],
      narrationAudioPath: '',
      sceneAudioPath: body.sceneAudioPath || '',
      isPublished: false
    };

    await writeDoc('works', workId, workData);
    return HTTP(201, { work: workData });
  }
  
  if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/) && method === 'GET') {
    const user = await readUser(request);
    const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/)[1];
    
    const document = await readDoc('works', workId);
    if (!document) throw notFound();
    
    // Verificar que sea el creador o un administrador
    if (user.role !== 'administrador' && document.data.creatorId !== user.uid) {
      throw new HttpError(403, 'No tienes permisos para ver esta obra.');
    }
    
    // Devolver los datos con el ID incluido
    return okay({ work: { id: workId, ...document.data } });
  }

  // GENERAR DESCRIPCIÓN CON IA Y AUDIO CON ELEVENLABS
  if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-description$/) && method === 'POST') {
    const user = await readUser(request);
    const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-description$/)[1];
    
    const workDoc = await readDoc('works', workId);
    if (!workDoc) throw notFound();
    
    if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) {
      throw new HttpError(403, 'No tienes permisos para editar esta obra.');
    }

    const work = workDoc.data;

    try {
      const aiResult = await describeImage({ title: work.author || 'Obra sin título', artist: work.exhibitionPlace || 'Desconocido' }, work.imagePath, work.imageType || 'image/jpeg');
      
      const aiDescription = aiResult.intro || aiResult.summary || 'Descripción no disponible.';
      const zones = aiResult.zones || [];

      const updatedWork = { ...work, aiDescription, zones, updatedAt: new Date().toISOString() };
      await writeDoc('works', workId, updatedWork);

      return okay({ work: updatedWork });
    } catch (error) {
      console.error("❌ FALLO EN VERTEX AI:", error.message);
      throw new HttpError(502, `Error al generar la descripción con IA: ${error.message}`);
    }
  }

  // ==========================================
  // 🔊 GENERAR SOLO AUDIO CON ELEVENLABS
  // ==========================================
  if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-audio$/) && method === 'POST') {
    const user = await readUser(request);
    const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-audio$/)[1];
    
    const workDoc = await readDoc('works', workId);
    if (!workDoc) throw notFound();
    
    if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) {
      throw new HttpError(403, 'No tienes permisos para editar esta obra.');
    }

    const work = workDoc.data;

    if (!work.aiDescription) {
      throw new HttpError(400, 'Primero debes generar la descripción con IA.');
    }

    try {
      // 👇 CAMBIO: synthesizeElevenLabs → synthesizeSpeech
      const audioBytes = await synthesizeSpeech(work.aiDescription);
      const narrationAudioPath = `works/${workId}/audio/narracion.mp3`;
      await saveObject(narrationAudioPath, audioBytes, 'audio/mpeg');

      const updatedWork = { ...work, narrationAudioPath, updatedAt: new Date().toISOString() };
      await writeDoc('works', workId, updatedWork);

      return okay({ work: updatedWork });
    } catch (error) {
      console.error("❌ FALLO EN CLOUD TTS:", error.message);
      throw new HttpError(502, `Error al generar el audio con Cloud TTS: ${error.message}`);
    }
  }

  // ACTUALIZAR OBRA (Metadatos o Zonas editadas)
  if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/) && method === 'PUT') {
    const user = await readUser(request);
    const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/)[1];
    
    const workDoc = await readDoc('works', workId);
    if (!workDoc) throw notFound();
    
    if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) {
      throw new HttpError(403, 'No tienes permisos para editar esta obra.');
    }

    const body = await readBody(request, 10_000_000);
    const existing = workDoc.data;

    const updated = {
      ...existing,
      title: body.title ?? existing.title ?? existing.author,
      artist: body.artist ?? existing.artist ?? existing.author,
      year: body.year ?? existing.year,
      technique: body.technique ?? existing.technique,
      category: body.category ?? existing.category,
      exhibitionPlace: body.exhibitionPlace ?? existing.exhibitionPlace,
      intro: body.intro ?? existing.intro ?? existing.aiDescription,
      summary: body.summary ?? existing.summary ?? existing.aiDescription,
      aiDescription: body.aiDescription ?? existing.aiDescription,
      zones: body.zones ?? existing.zones,
      narrationAudioPath: body.narrationAudioPath ?? existing.narrationAudioPath,
      updatedAt: new Date().toISOString()
    };

    if (body.imageData) {
      const imagePath = `works/${workId}/art.${body.imageType?.split('/')[1] || 'jpg'}`;
      const imageBuffer = Buffer.from(body.imageData, 'base64');
      await saveObject(imagePath, imageBuffer, body.imageType || 'image/jpeg');
      updated.imagePath = imagePath;
      updated.imageType = body.imageType || 'image/jpeg';
    }

    await writeDoc('works', workId, updated);
    return okay({ work: { id: workId, ...updated } });
  }

  // ELIMINAR OBRA
    if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/) && method === 'DELETE') {
    const user = await readUser(request, true);
    const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/)[1];
    
    const workDoc = await readDoc('works', workId);
    if (!workDoc) throw notFound();
    
    if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) {
      throw new HttpError(403, 'No tienes permisos para eliminar esta obra.');
    }

    // 1. Eliminar archivos de Cloud Storage (Imagen y Audio)
    if (workDoc.data.imagePath) await removeObject(workDoc.data.imagePath).catch(() => {});
    if (workDoc.data.narrationAudioPath) await removeObject(workDoc.data.narrationAudioPath).catch(() => {});

    // 2. Eliminar el documento de Firestore usando la nueva función
    await deleteDoc('works', workId);

    return okay({ message: 'Obra eliminada correctamente' });
  }
if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/upload-audio$/) && method === 'POST') {
  const user = await readUser(request);
  const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/upload-audio$/)[1];
  
  const workDoc = await readDoc('works', workId);
  if (!workDoc) throw notFound();
  
  if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) {
    throw new HttpError(403, 'No tienes permisos para editar esta obra.');
  }

  const body = await readBody(request, 15_000_000); // 15MB máximo
  
  if (!body.audioData) {
    throw new HttpError(400, 'Faltan datos de audio.');
  }

  try {
    const audioBuffer = Buffer.from(body.audioData, 'base64');
    const ext = (body.audioType || 'audio/mpeg').split('/')[1] || 'mp3';
    const narrationAudioPath = `works/${workId}/audio/narracion.${ext}`;
    
    await saveObject(narrationAudioPath, audioBuffer, body.audioType || 'audio/mpeg');
    
    const updatedWork = { 
      ...workDoc.data, 
      narrationAudioPath, 
      updatedAt: new Date().toISOString() 
    };
    await writeDoc('works', workId, updatedWork);
    
    console.log(`✅ Audio subido: ${Math.round(audioBuffer.length / 1024)} KB`);
    return okay({ work: { id: workId, ...updatedWork } });
    
  } catch (error) {
    console.error("❌ FALLO AL SUBIR AUDIO:", error.message);
    throw new HttpError(502, `Error al subir el audio: ${error.message}`);
  }
}
  // ==========================================
  // 🌿 SUBIR AUDIO AMBIENTAL
  // ==========================================
  if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/upload-ambience$/) && method === 'POST') {
    const user = await readUser(request);
    const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/upload-ambience$/)[1];
    const workDoc = await readDoc('works', workId);
    if (!workDoc) throw notFound();
    if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) throw new HttpError(403, 'No tienes permisos.');

    const body = await readBody(request, 15_000_000);
    if (!body.audioData) throw new HttpError(400, 'Faltan datos de audio.');

    const audioBuffer = Buffer.from(body.audioData, 'base64');
    const ext = (body.audioType || 'audio/mpeg').split('/')[1] || 'mp3';
    const ambiencePath = `works/${workId}/audio/ambiente.${ext}`;
    
    await saveObject(ambiencePath, audioBuffer, body.audioType || 'audio/mpeg');
    
    const updatedWork = { ...workDoc.data, ambiencePath, updatedAt: new Date().toISOString() };
    await writeDoc('works', workId, updatedWork);
    
    return okay({ work: { id: workId, ...updatedWork } });
  }

  // ==========================================
  // 🎵 SUBIR AUDIO PARA UNA ZONA ESPECÍFICA
  // ==========================================
  if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/zones\/(\d+)\/upload-audio$/) && method === 'POST') {
    const user = await readUser(request);
    const [, workId, zoneIndexStr] = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/zones\/(\d+)\/upload-audio$/);
    const zoneIndex = parseInt(zoneIndexStr, 10);
    
    const workDoc = await readDoc('works', workId);
    if (!workDoc) throw notFound();
    if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) throw new HttpError(403, 'No tienes permisos.');

    const body = await readBody(request, 15_000_000);
    if (!body.audioData) throw new HttpError(400, 'Faltan datos de audio.');

    const zones = workDoc.data.zones || [];
    if (!zones[zoneIndex]) throw new HttpError(400, 'Índice de zona inválido.');

    const audioBuffer = Buffer.from(body.audioData, 'base64');
    const ext = (body.audioType || 'audio/mpeg').split('/')[1] || 'mp3';
    const zoneAudioPath = `works/${workId}/audio/zona-${zoneIndex + 1}.${ext}`;
    
    await saveObject(zoneAudioPath, audioBuffer, body.audioType || 'audio/mpeg');
    
    // Actualizar el array de zonas con la nueva ruta de audio
    zones[zoneIndex] = { ...zones[zoneIndex], audioPath: zoneAudioPath };
    
    const updatedWork = { ...workDoc.data, zones, updatedAt: new Date().toISOString() };
    await writeDoc('works', workId, updatedWork);
    
    return okay({ work: { id: workId, ...updatedWork } });
  }
  // ==========================================
// 🤖 GENERAR INTRODUCCIÓN CON IA
// ==========================================
if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-intro$/) && method === 'POST') {
  const user = await readUser(request);
  const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-intro$/)[1];
  const workDoc = await readDoc('works', workId);
  if (!workDoc) throw notFound();
  if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) throw new HttpError(403, 'No tienes permisos.');

  const work = workDoc.data;

  try {
    const aiResult = await describeImage(
      { title: work.title || 'Obra sin título', artist: work.artist || 'Desconocido' },
      work.imagePath,
      work.imageType || 'image/jpeg'
    );
    
    const intro = aiResult.intro || aiResult.summary || 'Descripción no disponible.';
    const updatedWork = { ...work, intro, updatedAt: new Date().toISOString() };
    await writeDoc('works', workId, updatedWork);

    return okay({ work: { id: workId, ...updatedWork } });
  } catch (error) {
    console.error("❌ FALLO EN IA:", error.message);
    throw new HttpError(502, `Error al generar la introducción: ${error.message}`);
  }
}

// ==========================================
// 🔊 GENERAR AUDIO TTS DE LA INTRODUCCIÓN
// ==========================================
if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-intro-audio$/) && method === 'POST') {
  const user = await readUser(request);
  const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/generate-intro-audio$/)[1];
  const workDoc = await readDoc('works', workId);
  if (!workDoc) throw notFound();
  if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) throw new HttpError(403, 'No tienes permisos.');

  const body = await readBody(request, 50_000);
  if (!body.introText) throw new HttpError(400, 'Falta el texto de la introducción.');

  try {
    const audioBytes = await synthesizeSpeech(body.introText);
    const introAudioPath = `works/${workId}/audio/introduccion.mp3`;
    await saveObject(introAudioPath, audioBytes, 'audio/mpeg');

    const updatedWork = { ...workDoc.data, introAudioPath, updatedAt: new Date().toISOString() };
    await writeDoc('works', workId, updatedWork);

    return okay({ work: { id: workId, ...updatedWork } });
  } catch (error) {
    console.error("❌ FALLO EN TTS:", error.message);
    throw new HttpError(502, `Error al generar el audio: ${error.message}`);
  }
}

// ==========================================
// 📤 SUBIR AUDIO DE INTRODUCCIÓN MANUAL
// ==========================================
if (path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/upload-intro-audio$/) && method === 'POST') {
  const user = await readUser(request);
  const workId = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})\/upload-intro-audio$/)[1];
  const workDoc = await readDoc('works', workId);
  if (!workDoc) throw notFound();
  if (user.role !== 'administrador' && workDoc.data.creatorId !== user.uid) throw new HttpError(403, 'No tienes permisos.');

  const body = await readBody(request, 15_000_000);
  if (!body.audioData) throw new HttpError(400, 'Faltan datos de audio.');

  try {
    const audioBuffer = Buffer.from(body.audioData, 'base64');
    const ext = (body.audioType || 'audio/mpeg').split('/')[1] || 'mp3';
    const introAudioPath = `works/${workId}/audio/introduccion.${ext}`;
    
    await saveObject(introAudioPath, audioBuffer, body.audioType || 'audio/mpeg');
    
    const updatedWork = { ...workDoc.data, introAudioPath, updatedAt: new Date().toISOString() };
    await writeDoc('works', workId, updatedWork);
    
    return okay({ work: { id: workId, ...updatedWork } });
  } catch (error) {
    console.error("❌ FALLO AL SUBIR AUDIO:", error.message);
    throw new HttpError(502, `Error al subir el audio: ${error.message}`);
  }
}
  throw notFound();
}
