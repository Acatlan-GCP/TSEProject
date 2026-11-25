# Arte al oído

Arte al oído es una galería móvil instalable en español de México. Permite recorrer obras con narración, ambientes sonoros y un lienzo dividido en zonas. El proyecto incluye tres obras de dominio público y un panel de curaduría para publicar nuevas piezas mediante Google Cloud.

## Probar la galería

1. Descomprime la carpeta e instala Node.js 22 o posterior si todavía no lo tienes.
2. Abre una terminal en la carpeta del proyecto y ejecuta `node server.mjs`. En Windows también puedes abrir `Iniciar-app.cmd`.
3. Abre [la galería local](http://127.0.0.1:8080). Las tres obras, narraciones y efectos incluidos funcionan sin cuenta de Google Cloud.

Para usar la PWA desde otro dispositivo, abre el enlace HTTPS del despliegue. En Android, usa la opción de instalar aplicación del navegador cuando aparezca. En iOS, abre el enlace en Safari y usa Compartir y Agregar a inicio. Después de la primera carga en línea, la PWA guarda la galería incluida para usarla sin conexión.

Cada página vive en su propia carpeta dentro de `public/`: `/galeria/`, `/buscar/`, `/ajustes/` y `/obra/`. La portada está en `public/index.html`; los recursos compartidos están en `public/assets/`, y la prueba de servicios GCP en `public/test-gcp/` (también disponible como `/test-gcp.html` y `/test.gcp.html`).

## Interacción y accesibilidad

- Desde el inicio puedes explorar la galería, buscar por voz o abrir los ajustes. **Escuchar bienvenida** inicia la guía tras la activación que requieren los navegadores móviles.
- Desliza hacia arriba o abajo en la ficha de la galería para cambiar de obra. **Anterior**, **Siguiente** y **Escuchar ficha** ofrecen el mismo recorrido sin depender del gesto.
- Una vez en la obra, mantén presionado el lienzo aproximadamente un tercio de segundo para reproducir la zona. Al deslizar sin levantar el dedo cambia la narración y, en dispositivos compatibles, vibra. Al soltar, la narración se pausa. También puedes activar directamente los botones de zona y abrir la transcripción.
- La búsqueda por voz usa la API del navegador. Su disponibilidad y el procesamiento en línea dependen del navegador. Puedes usar el campo de texto o el dictado del teclado.
- Puedes ajustar la velocidad, el volumen de ambiente y efectos, la vibración, el contraste, el tamaño de texto y la reproducción al navegar. Los ajustes se guardan en el dispositivo. Con una cuenta conectada, puedes cargarlos y guardarlos en Firestore.
- El diseño usa botones semánticos, encabezados, foco visible y un enlace para saltar al contenido. VoiceOver y TalkBack pueden reservar los gestos del sistema, por lo que las zonas también tienen botones independientes. Falta validar la experiencia con ambos lectores y con participantes ciegos en teléfonos físicos. [Disponibilidad de reconocimiento de voz](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

## Servicios de Google Cloud

| Servicio | Implementación |
| --- | --- |
| Cloud Run | Hospeda la PWA y su API. Verifica la sesión y el rol, coordina la curaduría y registra la latencia de las solicitudes en Cloud Logging. |
| Cloud Firestore | Guarda obras publicadas, borradores, coordenadas normalizadas, rutas de archivos y preferencias por UID. La API mantiene el catálogo en memoria durante cinco minutos por instancia. |
| Cloud Storage | Conserva las imágenes originales, MP3 y paisajes sonoros de las obras publicadas en un bucket privado. Cloud Run entrega redirecciones a URLs firmadas y el navegador descarga directamente desde Cloud Storage. Los ambientes del catálogo inicial también vienen con la PWA. |
| Vertex AI | Gemini 3.8 Flash analiza la imagen, redacta una sinopsis e introducción, y propone narraciones para tres o cuatro zonas. Se puede cambiar el modelo por configuración. |
| Cloud Text-to-Speech | Tras la aprobación editorial, genera las fichas, introducciones y narraciones de zona en MP3. La voz inicial es Neural2 en español de EE. UU. y se puede sustituir. |
| Firebase Authentication | Añade cuentas con correo y contraseña. El backend permite curaduría por UID autorizado o por la declaración personalizada `curator`. |

Obra nueva → imagen en Storage → borrador de Gemini → revisión y confirmación humana → MP3 de Text-to-Speech → publicación en Firestore. Un commit de Firestore crea la obra pública y elimina su borrador cuando las pistas están listas. La pantalla de revisión permite corregir tanto los textos como los rectángulos por porcentaje. [Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) · [Voces disponibles](https://cloud.google.com/text-to-speech/docs/list-voices-and-types)

### Configuración del piloto

Usa un proyecto de Google Cloud con facturación activa y con acceso de despliegue. El ejemplo usa Cloud Shell desde la raíz del proyecto. Sustituye los valores de ejemplo y reutiliza la base o el bucket si ya existen y cumplen la configuración.

```bash
PROJECT_ID='tu-proyecto-gcp'
REGION='us-central1'
BUCKET="${PROJECT_ID}-arte-al-oido"
SERVICE_ACCOUNT="arte-al-oido@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  firestore.googleapis.com aiplatform.googleapis.com texttospeech.googleapis.com storage.googleapis.com \
  iamcredentials.googleapis.com identitytoolkit.googleapis.com --project "$PROJECT_ID"

gcloud firestore databases create --project "$PROJECT_ID" --location "$REGION" \
  --edition standard --type firestore-native

gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT_ID" --location "$REGION" \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "gs://$BUCKET" --cors-file=cors-storage.json
gcloud storage cp public/media/amb-mar.wav public/media/amb-cuarto.wav public/media/amb-estanque.wav "gs://$BUCKET/ambientes/"

gcloud iam service-accounts create arte-al-oido --project "$PROJECT_ID"
for role in roles/datastore.user roles/aiplatform.user roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SERVICE_ACCOUNT" --role="$role"
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SERVICE_ACCOUNT" --role=roles/storage.objectUser
gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT" --project "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT" --role=roles/iam.serviceAccountTokenCreator
```

En la consola de Firebase, vincula el mismo proyecto, crea una app web, habilita **Correo/contraseña** y crea una cuenta inicial en la pestaña de usuarios. Copia su UID y la clave de API web. La clave de Firebase identifica el proyecto. Restringe su uso a las API de Firebase correspondientes. Para pilotos cerrados, gestiona el alta de usuarios desde Firebase y conserva la opción de registro de la galería desactivada. Configura reglas restrictivas en Firestore porque la app lee y escribe desde el backend mediante IAM. [Configuración de Firebase Authentication](https://firebase.google.com/docs/auth/web/password-auth) · [IAM de Cloud Run](https://cloud.google.com/run/docs/reference/iam/roles)

```bash
read -r -p 'Clave API web de Firebase: ' FIREBASE_KEY
read -r -p 'UID de curaduría: ' CURATOR_UID

gcloud run deploy arte-al-oido --project "$PROJECT_ID" --region "$REGION" --source . \
  --service-account="$SERVICE_ACCOUNT" --allow-unauthenticated \
  --cpu=1 --memory=512Mi --min=0 --max=3 --timeout=180s \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GALLERY_BUCKET=$BUCKET,GALLERY_SIGNER=$SERVICE_ACCOUNT,FIREBASE_WEB_API_KEY=$FIREBASE_KEY,CURATOR_UIDS=$CURATOR_UID,GEMINI_MODEL=gemini-3.8-flash,VERTEX_LOCATION=global,TTS_VOICE=es-US-Neural2-A"
```

Cloud Build compila el contenedor a partir del Dockerfile. Si tu proyecto exige una identidad de compilación explícita, configura la cuenta de compilación con el rol **Cloud Run Builder**. El despliegue anterior habilita el catálogo público. Cuenta, preferencias y curaduría siguen requiriendo autorización en la API. [Desplegar desde código fuente](https://cloud.google.com/run/docs/deploying-source-code) · [URLs firmadas de Storage](https://cloud.google.com/storage/docs/access-control/signing-urls-with-helpers)

Abre la URL HTTPS devuelta por Cloud Run y confirma que `/healthz` devuelve `"cloud":true`. Ese indicador comprueba la configuración. Para validar credenciales y permisos, inicia sesión, guarda y recupera un ajuste y publica una obra de prueba. Verifica que se reproduzcan su introducción y todas sus zonas desde otro dispositivo. La sesión se conserva en `sessionStorage` durante la pestaña del navegador; al cerrarla tendrás que iniciar sesión de nuevo o cuando venza el token. La variable opcional `FIRESTORE_DATABASE` selecciona una base distinta de `(default)`. Para varios curadores, usa declaraciones personalizadas de Firebase o una lista de UIDs separada por comas en el archivo de variables de entorno de Cloud Run. [Verificación de tokens de Firebase](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

## Costos del piloto

Consulta de tarifas del 20 de noviembre de 2026. Se mantienen los supuestos del proyecto de 500 usuarios activos, 50 obras y 150 000 tokens de entrada más 50 000 tokens de salida al mes. La estimación de uso debe incluir los tokens de razonamiento, las nuevas fichas de catálogo, los reintentos y las solicitudes parciales de audio.

| Servicio | Estimación bajo los supuestos del proyecto |
| --- | --- |
| Cloud Run | Las 60 000 solicitudes y 15 000 vCPU-segundos caben en las cuotas gratuitas de facturación por solicitud. Revisa memoria y transferencia del frontend por separado. |
| Firestore | 150 000 lecturas uniformemente distribuidas y 10 000 escrituras caben en las cuotas diarias del plan gratuito. Los picos, índices y lecturas de cada instancia pueden subir el total. |
| Storage | Los 5 GB-mes Standard y 10 GB de salida descritos pueden caber en la capa gratuita si el bucket y el destino son elegibles y se mantienen dentro de los límites de operaciones. La capa de Storage cubre las regiones de EE. UU. indicadas por Google. Cotiza aparte si eliges México. |
| Gemini 3.8 Flash global | **USD 0.30** a razón de USD 0.75 por millón de tokens de entrada y USD 3.75 por millón de salida hasta el 31 de diciembre de 2026. **USD 0.60** con el mismo volumen desde el 1 de enero de 2027, a USD 1.50 y USD 7.50 respectivamente. |
| Cloud Text-to-Speech Neural2 | 100 000 caracteres están dentro del primer millón mensual gratuito. El excedente cuesta USD 16 por millón. Para 50 obras, cuenta aproximadamente 250–300 MP3 si siempre se producen ficha, introducción y 3–4 zonas. |

Los USD 0.30 y USD 0.60 son el cálculo de Gemini dentro de ese escenario. La factura total depende de las cuotas disponibles, la región, el tamaño de las imágenes/audio, la compilación, Artifact Registry, Firebase, IAM y los registros. Registra consumo real de Storage, lecturas de Firestore y tokens durante el piloto. [Cloud Run](https://cloud.google.com/run/pricing) · [Firestore](https://cloud.google.com/firestore/pricing) · [Cloud Storage](https://cloud.google.com/storage/pricing) · [Google Cloud Free Tier](https://cloud.google.com/free/docs/free-cloud-features) · [Vertex AI](https://cloud.google.com/model-garden/pricing) · [Text-to-Speech](https://cloud.google.com/text-to-speech/pricing)

## Verificación y créditos

Ejecuta `node --test` para comprobar el servidor, los recursos de la galería, los intervalos de audio y las reglas de validación editorial. Para una validación móvil, recorre Inicio → Galería → Obra → Zonas; después, prueba búsqueda y ajustes con VoiceOver en iOS y TalkBack en Android. Comprueba también la presión sostenida, el cambio de zona y la pausa en dispositivos táctiles.

Las reproducciones son de dominio público. Las referencias de procedencia están en las fichas de [Hokusai](https://commons.wikimedia.org/wiki/File:The_Great_Wave_off_Kanagawa.jpg), [Van Gogh](https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_The_Bedroom_-_Google_Art_Project.jpg) y [Monet](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg). Los ambientes y efectos de la demo son síntesis originales. La voz incluida se generó localmente con Piper y [el modelo ald de español de México](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_MX/ald/medium/MODEL_CARD). Las obras que se publiquen desde curaduría usan Text-to-Speech.
