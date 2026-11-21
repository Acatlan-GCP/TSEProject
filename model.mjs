export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function text(value, limit, label, optional = false) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (cleaned.length > limit || (!optional && !cleaned)) {
    throw new HttpError(400, `Revisa el campo ${label} (máximo ${limit} caracteres).`);
  }
  return cleaned;
}

export function safeSource(value) {
  const source = text(value, 400, 'enlace', true);
  if (!source) return '';
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  throw new HttpError(400, 'La ficha de origen debe tener una dirección HTTPS válida.');
}

export function normalizeNarration(data, previous) {
  const intro = text(data?.intro, 1200, 'introducción');
  const summary = text(data?.summary, 500, 'sinopsis');
  if (!Array.isArray(data.zones) || ![3, 4].includes(data.zones.length) || previous && previous.length !== data.zones.length) {
    throw new HttpError(400, 'La obra debe tener tres o cuatro zonas.');
  }
  const zones = data.zones.map((zone, index) => {
    const id = previous?.[index].id || `zona-${index + 1}`;
    const bounds = zone?.bounds;
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new HttpError(400, `Revisa las coordenadas de la zona ${index + 1}.`);
    }
    const [x, y, width, height] = bounds;
    if (width < .04 || height < .04 || x + width > 1.00001 || y + height > 1.00001) {
      throw new HttpError(400, `La zona ${index + 1} debe quedar dentro de la imagen y medir al menos 4% por lado.`);
    }
    if (previous && zone.id !== id) throw new HttpError(400, 'Las zonas no coinciden con el borrador.');
    return {
      id, bounds, label: text(zone.label, 70, 'nombre de la zona'),
      position: text(zone.position, 70, 'ubicación'), text: text(zone.text, 1200, 'texto de la zona')
    };
  });
  return { intro, summary, zones };
}

export function artworkFields(data) {
  const sound = ['mar', 'cuarto', 'estanque', ''].includes(data.sound) ? data.sound : '';
  return {
    title: text(data.title, 120, 'título'), artist: text(data.artist, 120, 'artista'),
    year: text(data.year, 40, 'año o periodo'), category: text(data.category, 80, 'categoría'),
    technique: text(data.technique, 100, 'técnica'), source: safeSource(data.source), sound
  };
}

export function verifyImage(type, data) {
  if (typeof data !== 'string' || data.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new HttpError(400, 'Se requiere una imagen de hasta 6 MB.');
  }
  const bytes = Buffer.from(data, 'base64');
  const jpg = type === 'image/jpeg' && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  const png = type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = type === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (bytes.length > 6_000_000 || bytes.length < 16 || !(jpg || png || webp)) {
    throw new HttpError(400, 'Se requiere una imagen JPG, PNG o WebP válida de hasta 6 MB.');
  }
  return bytes;
}

export function normalizePreferences(input) {
  const { rate, volume, haptic, contrast, large, automatic } = input;
  if (!Number.isFinite(rate) || rate < .65 || rate > 1.55 || !Number.isFinite(volume) || volume < 0 || volume > 1 ||
    ![0, 1, 2].includes(haptic) || [contrast, large, automatic].some(value => typeof value !== 'boolean')) {
    throw new HttpError(400, 'Los ajustes no son válidos.');
  }
  return { rate, volume, haptic, contrast, large, automatic };
}
