
import { escapeHTML as esc } from './app.js';

/* =========================================
   CONFIGURACIÓN DE SESIÓN
========================================= */

export const session = {
  config: {},
  token: '',
  user: null,

  configure(config) {
    this.config = config;
  }
};

/* =========================================
   PETICIONES AL BACKEND
========================================= */

async function request(path, method = 'GET', body) {
  const headers = {};

  if (session.token) {
    headers.authorization = `Bearer ${session.token}`;
  }

  if (body) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || 'No se pudo completar la solicitud.'
    );
  }

  return data;
}

/* =========================================
   COMPONENTES HTML REUTILIZABLES
========================================= */

const field = (id, label, options = '') => `
  <label class="field">
    <span>${label}</span>
    <input name="${id}" ${options}>
  </label>
`;

const textarea = (id, label, value = '', rows = 3) => `
  <label class="field">
    <span>${label}</span>
    <textarea
      name="${id}"
      rows="${rows}"
      maxlength="1200"
      required
    >${esc(value)}</textarea>
  </label>
`;

const page = (title, parent, label, content) => `
  <section class="page account-page">

    <a class="breadcrumbs" href="#${parent}">
      ${label}
    </a>

    <header class="page-heading">
      <h1 tabindex="-1">${title}</h1>
    </header>

    <div class="stack">
      ${content}
    </div>

  </section>
`;

const statusMessage = message => `
  <p class="account-status" role="status">
    ${message}
  </p>
`;

/* =========================================
   CUENTA DE USUARIO
========================================= */

export function mountAccount(root, options) {
  let active = true;

  function account() {
    if (!active) return;

    const user = session.user;

    root.innerHTML = page(
      'Mi cuenta',
      'ajustes',
      'Ajustes',

      user
        ? `
          <section class="panel account-panel stack">

            <div class="account-intro">
              <h2>Bienvenido a tu cuenta</h2>

              <p>
                Has iniciado sesión correctamente.
                Desde aquí puedes administrar tus preferencias
                y sincronizarlas entre dispositivos.
              </p>
            </div>

            <div class="account-user">
              <span class="account-label">
                Cuenta activa
              </span>

              <strong>${esc(user.email)}</strong>
            </div>

            <div class="account-actions">

              <button
                class="button primary"
                id="save-cloud"
                type="button"
              >
                Guardar mis ajustes
              </button>

              <button
                class="button"
                id="load-cloud"
                type="button"
              >
                Recuperar mis ajustes
              </button>

              ${
                user.curator
                  ? `
                    <a
                      class="button"
                      href="#curaduria"
                    >
                      Administrar galería
                    </a>
                  `
                  : ''
              }

              <button
                class="button"
                id="sign-out"
                type="button"
              >
                Cerrar sesión
              </button>

            </div>

            <p id="account-status" role="status"></p>

          </section>
        `

        : `
          <section class="panel account-panel stack">

            <div class="account-intro">
              <h2>Accede a tu cuenta</h2>

              <p>
                Inicia sesión para sincronizar tus preferencias
                y conservar tu configuración de accesibilidad.
              </p>
            </div>

            <form
              class="stack"
              id="account-form"
            >

              ${field(
                'email',
                'Correo electrónico',
                'type="email" autocomplete="email" required'
              )}

              ${field(
                'password',
                'Contraseña',
                'type="password" minlength="6" autocomplete="current-password" required'
              )}

              <div class="account-actions">

                <button
                  class="button primary"
                  type="submit"
                  value="login"
                >
                  Iniciar sesión
                </button>

                ${
                  session.config.registration
                    ? `
                      <button
                        class="button"
                        type="submit"
                        value="register"
                      >
                        Crear cuenta
                      </button>
                    `
                    : ''
                }

              </div>

              <p id="account-status" role="status"></p>

            </form>

          </section>
        `
    );

    const status = root.querySelector('#account-status');

    /* -----------------------------
       INICIO DE SESIÓN Y REGISTRO
    ----------------------------- */

    if (!user) {
      root.querySelector('#account-form').onsubmit =
        async event => {
          event.preventDefault();

          const form = event.currentTarget;
          const button = event.submitter;

          if (!button) return;

          button.disabled = true;

          status.textContent = 'Conectando con el servidor…';

          try {
            const values = Object.fromEntries(
              new FormData(form)
            );

            const action =
              button.value === 'register'
                ? 'register'
                : 'login';

            const result = await request(
              `account/${action}`,
              'POST',
              values
            );

            if (!active) return;

            session.token = result.token;
            session.user = result.user;

            account();

            root.querySelector('h1')?.focus();

          } catch (error) {
            status.textContent = error.message;

          } finally {
            button.disabled = false;
          }
        };

      return;
    }

    /* -----------------------------
       CERRAR SESIÓN
    ----------------------------- */

    root.querySelector('#sign-out').onclick = () => {
      session.token = '';
      session.user = null;

      account();

      root.querySelector('h1')?.focus();
    };

    /* -----------------------------
       GUARDAR PREFERENCIAS
    ----------------------------- */

    root.querySelector('#save-cloud').onclick =
      async () => {
        const button = root.querySelector('#save-cloud');

        button.disabled = true;
        status.textContent = 'Guardando preferencias…';

        try {
          await request(
            'preferences',
            'PUT',
            options.preferences()
          );

          status.textContent =
            'Tus preferencias se guardaron correctamente.';

        } catch (error) {
          status.textContent = error.message;

        } finally {
          button.disabled = false;
        }
      };

    /* -----------------------------
       RECUPERAR PREFERENCIAS
    ----------------------------- */

    root.querySelector('#load-cloud').onclick =
      async () => {
        const button = root.querySelector('#load-cloud');

        button.disabled = true;
        status.textContent = 'Recuperando preferencias…';

        try {
          const { preferences } =
            await request('preferences');

          if (preferences) {
            options.setPreferences(preferences);

            status.textContent =
              'Tus preferencias se aplicaron correctamente.';
          } else {
            status.textContent =
              'Todavía no tienes preferencias guardadas.';
          }

        } catch (error) {
          status.textContent = error.message;

        } finally {
          button.disabled = false;
        }
      };
  }

  account();

  return () => {
    active = false;
  };
}

/* =========================================
   CONVERSIÓN DE IMÁGENES
========================================= */

const fileAsBase64 = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(
        String(reader.result).split(',')[1]
      );
    };

    reader.onerror = () => {
      reject(
        new Error('No se pudo leer la imagen.')
      );
    };

    reader.readAsDataURL(file);
  });

/* =========================================
   PANEL DE CURADURÍA
========================================= */

export function mountCurator(root, onPublished) {
  let active = true;

  if (!session.user?.curator) {
    root.innerHTML = page(
      'Curaduría',
      'cuenta',
      'Cuenta',
      `
        <section class="panel stack">
          <h2>Acceso restringido</h2>

          <p>
            Necesitas iniciar sesión con una cuenta
            autorizada para administrar la galería.
          </p>

          <a class="button primary" href="#cuenta">
            Ir a mi cuenta
          </a>
        </section>
      `
    );

    return () => {
      active = false;
    };
  }

  root.innerHTML = page(
    'Panel de curaduría',
    'cuenta',
    'Cuenta',

    `
      <section class="panel stack">

        <div class="account-intro">
          <h2>Administración de obras</h2>

          <p>
            Genera borradores a partir de imágenes,
            revisa sus descripciones y publica las obras
            cuando estén listas.
          </p>
        </div>

        <form
          id="generate"
          class="stack"
        >

          <h3>Registrar una nueva obra</h3>

          ${field(
            'title',
            'Título de la obra',
            'maxlength="120" required'
          )}

          ${field(
            'artist',
            'Nombre del artista',
            'maxlength="120" required'
          )}

          <div class="field-grid">

            ${field(
              'year',
              'Año o periodo',
              'maxlength="40" required'
            )}

            ${field(
              'technique',
              'Técnica artística',
              'maxlength="100" required'
            )}

          </div>

          ${field(
            'category',
            'Categoría',
            'maxlength="80" required'
          )}

          ${field(
            'source',
            'Enlace a la ficha original (opcional)',
            'type="url" maxlength="400"'
          )}

          <label class="field">
            <span>Paisaje sonoro</span>

            <select name="sound">
              <option value="mar">Mar</option>
              <option value="cuarto">Interior</option>
              <option value="estanque">Estanque</option>
              <option value="">Sin sonido ambiental</option>
            </select>
          </label>

          <label class="field">
            <span>Imagen de la obra</span>

            <input
              name="art"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            >
          </label>

          <p class="account-hint">
            Formatos permitidos: JPG, PNG y WebP.
            Tamaño máximo: 6 MB.
          </p>

          <button
            type="submit"
            class="button primary"
          >
            Generar borrador con Gemini
          </button>

          <p id="draft-status" role="status"></p>

        </form>

      </section>

      <section class="panel stack">

        <h2>Borradores pendientes</h2>

        <p>
          Revisa los textos y las zonas de exploración
          antes de publicar una obra.
        </p>

        <div id="drafts" class="stack"></div>

      </section>

      <div id="review"></div>
    `
  );

  const form = root.querySelector('#generate');
  const status = root.querySelector('#draft-status');
  const list = root.querySelector('#drafts');
  const review = root.querySelector('#review');

  /* -----------------------------
     OBTENER BORRADORES
  ----------------------------- */

  async function listDrafts() {
    try {
      const { drafts } =
        await request('curation/drafts');

      if (!active) return;

      list.replaceChildren();

      if (!drafts.length) {
        list.textContent =
          'Por ahora no hay borradores pendientes.';
        return;
      }

      for (const draft of drafts) {
        const control = document.createElement('button');

        control.className = 'button';
        control.type = 'button';
        control.textContent = `Revisar: ${draft.title}`;

        control.onclick = async () => {
          control.disabled = true;

          try {
            const result = await request(
              `curation/drafts/${draft.id}`
            );

            if (active) {
              showReview(result.draft);
            }

          } catch (error) {
            status.textContent = error.message;

          } finally {
            control.disabled = false;
          }
        };

        list.append(control);
      }

    } catch (error) {
      list.textContent = error.message;
    }
  }

  /* -----------------------------
     REVISIÓN DE OBRA
  ----------------------------- */

  function showReview(draft) {
    review.innerHTML = `
      <section class="panel stack">

        <form id="publish" class="stack">

          <h2 tabindex="-1">
            Revisar: ${esc(draft.title)}
          </h2>

          <p>
            Comprueba la información de la obra,
            la narración y las zonas interactivas.
          </p>

          ${
            draft.image
              ? `
                <img
                  src="${esc(draft.image)}"
                  alt="Vista previa de ${esc(draft.title)}"
                  style="max-height:24rem;object-fit:contain;width:100%;"
                >
              `
              : ''
          }

          ${textarea(
            'summary',
            'Sinopsis para el catálogo',
            draft.summary
          )}

          ${textarea(
            'intro',
            'Narración inicial de la obra',
            draft.intro,
            5
          )}

          <h3>Zonas interactivas</h3>

          ${draft.zones.map((zone, index) => `
            <fieldset class="draft-zone stack">

              <legend>
                Zona ${index + 1}
              </legend>

              ${field(
                `label-${index}`,
                'Nombre de la zona',
                `value="${esc(zone.label)}" maxlength="70" required`
              )}

              ${field(
                `position-${index}`,
                'Ubicación',
                `value="${esc(zone.position)}" maxlength="70" required`
              )}

              ${textarea(
                `text-${index}`,
                'Narración de la zona',
                zone.text
              )}

              <div class="field-grid">

                ${[
                  'Izquierda',
                  'Arriba',
                  'Ancho',
                  'Alto'
                ].map((label, coordinate) => `
                  ${field(
                    `coord-${index}-${coordinate}`,
                    `${label} (%)`,
                    `type="number" min="0" max="100" step=".1" value="${Math.round(zone.bounds[coordinate] * 1000) / 10}" required`
                  )}
                `).join('')}

              </div>

            </fieldset>
          `).join('')}

          <label class="check">
            <input type="checkbox" required>

            Confirmo que revisé los textos y las zonas.
          </label>

          <button
            type="submit"
            class="button primary"
          >
            Aprobar y publicar obra
          </button>

          <p id="publish-status" role="status"></p>

        </form>

      </section>
    `;

    review.querySelector('h2')?.focus();

    const publish = review.querySelector('#publish');

    publish.onsubmit = async event => {
      event.preventDefault();

      const values = new FormData(publish);
      const control = event.submitter;

      const feedback =
        review.querySelector('#publish-status');

      control.disabled = true;

      feedback.textContent =
        'Generando narraciones y publicando la obra…';

      try {
        const zones = draft.zones.map((zone, index) => ({
          id: zone.id,

          label: values.get(`label-${index}`),

          position: values.get(`position-${index}`),

          text: values.get(`text-${index}`),

          bounds: [0, 1, 2, 3].map(coordinate =>
            Number(
              values.get(`coord-${index}-${coordinate}`)
            ) / 100
          )
        }));

        const { work } = await request(
          `curation/drafts/${draft.id}/publish`,
          'POST',
          {
            intro: values.get('intro'),
            summary: values.get('summary'),
            zones,
            approved: true
          }
        );

        if (!active) return;

        review.innerHTML = `
          <section class="panel stack">

            <h2>Obra publicada</h2>

            <p role="status" tabindex="-1">
              La obra se publicó correctamente.
            </p>

            <a
              class="button primary"
              href="#obra/${encodeURIComponent(draft.id)}"
            >
              Abrir obra
            </a>

          </section>
        `;

        review.querySelector('[role="status"]')?.focus();

        onPublished(work);

        await listDrafts();

      } catch (error) {
        feedback.textContent = error.message;

      } finally {
        control.disabled = false;
      }
    };
  }

  /* -----------------------------
     GENERAR BORRADOR
  ----------------------------- */

  form.onsubmit = async event => {
    event.preventDefault();

    const values = Object.fromEntries(
      new FormData(form)
    );

    const { art } = values;

    if (!art || !art.size || art.size > 6_000_000) {
      status.textContent =
        'Selecciona una imagen válida de hasta 6 MB.';

      return;
    }

    const control = event.submitter;

    control.disabled = true;

    status.textContent =
      'Analizando la imagen y generando el borrador…';

    try {
      delete values.art;

      const { draft } = await request(
        'curation/drafts',
        'POST',
        {
          ...values,
          imageType: art.type,
          imageData: await fileAsBase64(art)
        }
      );

      if (!active) return;

      form.reset();

      status.textContent =
        'El borrador se generó correctamente.';

      showReview(draft);

      await listDrafts();

    } catch (error) {
      status.textContent = error.message;

    } finally {
      control.disabled = false;
    }
  };

  listDrafts();

  return () => {
    active = false;
  };
}
