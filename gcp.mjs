// gcp.mjs
export const PROJECT_ID = process.env.GCP_PROJECT_ID || '';
export const BUCKET_NAME = process.env.GCP_BUCKET_NAME || '';
export const REGION = process.env.GCP_REGION || 'northamerica-south1';

export const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'dummy-key'; // Dummy para que no falle si no se usa
export const GALLERY_SIGNER = process.env.GALLERY_SIGNER || `${PROJECT_ID}@appspot.gserviceaccount.com`;
export const CURATOR_UIDS = process.env.CURATOR_UIDS || '';
export const ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION === 'true';

export const FIRESTORE_DATABASE = process.env.FIRESTORE_DATABASE || '(default)';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
export const VERTEX_LOCATION = process.env.VERTEX_LOCATION || REGION;
export const TTS_VOICE = process.env.TTS_VOICE || 'es-US-Neural2-A';

// cloudEnabled será true solo si tienes Project ID y Bucket
export const cloudEnabled = Boolean(PROJECT_ID && BUCKET_NAME);