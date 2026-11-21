import { escapeHTML as esc } from './app.js';

export const session = {
  config: {},
  token: '',
  user: null,
  configure(config) { this.config = config; }
};

async function request(path, method = 'GET', body) {
  const headers = {};
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

const field = (id, label, options = '') => `<label class="field"><span>${label}</span><input name="${id}" ${options}></label>`;
const textarea = (id, label, value = '', rows = 3) => `<label class="field"><span>${label}</span><textarea name="${id}" rows="${rows}" maxlength="1200" required>${esc(value)}</textarea></label>`;
const page = (title, parent, label, content) => `<section class="page"><a class="breadcrumbs" href="#${parent}">${label}</a>
  <div class="page-heading"><h1 tabindex="-1">${title}</h1></div><div class="stack">${content}</div></section>`;

export function mountAccount(root, options) {
  let active = true;
  function account() {
    const user = session.user;
    root.innerHTML = page('Cuenta', 'ajustes', 'Ajustes', user ? `
      <section class="panel stack"><p>Sesión de ${esc(user.email)}.</p>
        <button class="button primary" id="save-cloud">Guardar ajustes en la nube</button>
        <button class="button" id="load-cloud">Cargar ajustes de la nube</button>
        <button class="button" id="sign-out">Cerrar sesión</button>
        <p id="account-status" role="status"></p></section>
        ${user.curator ? '<a class="button" href="#curaduria">Abrir curaduría</a>' : ''}`
      : `<form class="panel stack" id="account-form">
        <p>Inicia sesión para sincronizar tus ajustes entre dispositivos.</p>
        ${field('email', 'Correo electrónico', 'type="email" autocomplete="email" required')}
        ${field('password', 'Contraseña', 'type="password" minlength="6" autocomplete="current-password" required')}
        <div class="row"><button class="button primary" type="submit" value="login">Iniciar sesión</button>
        ${session.config.registration ? '<button class="button" type="submit" value="register">Crear cuenta</button>' : ''}</div>
        <p id="account-status" role="status"></p></form>`);
    const status = root.querySelector('#account-status');
    if (!user) {
      root.querySelector('#account-form').onsubmit = async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = event.submitter;
        button.disabled = true;
        status.textContent = 'Conectando…';
        try {
          const values = Object.fromEntries(new FormData(form));
          const action = button.value === 'register' ? 'register' : 'login';
          const result = await request(`account/${action}`, 'POST', values);
          if (!active) return;
          session.token = result.token;
          session.user = result.user;
          account();
          root.querySelector('h1').focus();
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      };
      return;
    }
    root.querySelector('#sign-out').onclick = () => {
      session.token = '';
      session.user = null;
      account();
      root.querySelector('h1').focus();
    };
    root.querySelector('#save-cloud').onclick = async () => {
      status.textContent = 'Guardando…';
      try {
        await request('preferences', 'PUT', options.preferences());
        status.textContent = 'Ajustes guardados en la nube.';
      } catch (error) { status.textContent = error.message; }
    };
    root.querySelector('#load-cloud').onclick = async () => {
      status.textContent = 'Cargando…';
      try {
        const { preferences } = await request('preferences');
        if (preferences) options.setPreferences(preferences);
        status.textContent = preferences ? 'Ajustes aplicados en este dispositivo.' : 'Todavía no hay ajustes guardados en la nube.';
      } catch (error) { status.textContent = error.message; }
    };
  }
  account();
  return () => { active = false; };
}

const fileAsBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
  reader.readAsDataURL(file);
});

export function mountCurator(root, onPublished) {
  let active = true;
  if (!session.user?.curator) {
    root.innerHTML = page('Curaduría', 'cuenta', 'Cuenta', '<p>Inicia sesión con una cuenta de curaduría.</p>');
    return () => { active = false; };
  }
  root.innerHTML = page('Curaduría', 'cuenta', 'Cuenta', `
    <form id="generate" class="panel stack"><h2>Nueva obra</h2>
      ${field('title', 'Título', 'maxlength="120" required')}
      ${field('artist', 'Artista', 'maxlength="120" required')}
      <div class="field-grid">${field('year', 'Año o periodo', 'maxlength="40" required')}${field('technique', 'Técnica', 'maxlength="100" required')}</div>
      ${field('category', 'Categoría', 'maxlength="80" required')}
      ${field('source', 'Enlace a la ficha original (opcional)', 'type="url" maxlength="400"')}
      <label class="field"><span>Paisaje sonoro</span><select name="sound"><option value="mar">Mar</option><option value="cuarto">Interior</option><option value="estanque">Estanque</option><option value="">Silencio</option></select></label>
      ${field('art', 'Imagen JPG, PNG o WebP, hasta 6 MB', 'type="file" accept="image/jpeg,image/png,image/webp" required')}
      <button type="submit" class="button primary">Generar borrador con Gemini</button>
      <p id="draft-status" role="status"></p>
    </form>
    <div class="panel stack"><h2>Borradores por revisar</h2><div id="drafts" class="stack"></div></div>
    <div id="review"></div>`);
  const form = root.querySelector('#generate');
  const status = root.querySelector('#draft-status');
  const list = root.querySelector('#drafts');
  const review = root.querySelector('#review');

  async function listDrafts() {
    try {
      const { drafts } = await request('curation/drafts');
      if (!active) return;
      list.replaceChildren();
      if (!drafts.length) list.textContent = 'Por ahora no hay borradores.';
      for (const draft of drafts) {
        const control = document.createElement('button');
        control.className = 'button';
        control.textContent = `Revisar ${draft.title}`;
        control.onclick = async () => {
          try {
            const result = await request(`curation/drafts/${draft.id}`);
            if (active) showReview(result.draft);
          } catch (error) { status.textContent = error.message; }
        };
        list.append(control);
      }
    } catch (error) { list.textContent = error.message; }
  }

  function showReview(draft) {
    review.innerHTML = `<form id="publish" class="panel stack">
      <h2 tabindex="-1">Revisar ${esc(draft.title)}</h2>
      <p>Comprueba los detalles visuales y el orden espacial. La aprobación genera las pistas de voz y publica la obra.</p>
      ${draft.image ? `<img src="${esc(draft.image)}" alt="Reproducción de ${esc(draft.title)} para revisión" style="max-height:24rem;object-fit:contain">` : ''}
      ${textarea('summary', 'Sinopsis para el catálogo', draft.summary)}
      ${textarea('intro', 'Introducción general', draft.intro, 5)}
      ${draft.zones.map((zone, index) => `<fieldset class="draft-zone"><legend>Zona ${index + 1}</legend>
        ${field(`label-${index}`, 'Nombre de la zona', `value="${esc(zone.label)}" maxlength="70" required`)}
        ${field(`position-${index}`, 'Ubicación', `value="${esc(zone.position)}" maxlength="70" required`)}
        ${textarea(`text-${index}`, 'Narración de la zona', zone.text)}
        <div class="field-grid">${['Izquierda', 'Arriba', 'Ancho', 'Alto'].map((label, coordinate) =>
          field(`coord-${index}-${coordinate}`, `${label} (%)`, `type="number" min="0" max="100" step=".1" value="${Math.round(zone.bounds[coordinate] * 1000) / 10}" required`)
        ).join('')}</div></fieldset>`).join('')}
      <label class="check"><input type="checkbox" required> Confirmo que revisé los textos y las zonas.</label>
      <button type="submit" class="button primary">Aprobar, generar audios y publicar</button>
      <p id="publish-status" role="status"></p></form>`;
    review.querySelector('h2').focus();
    const publish = review.querySelector('#publish');
    publish.onsubmit = async event => {
      event.preventDefault();
      const values = new FormData(publish);
      const control = event.submitter;
      const feedback = review.querySelector('#publish-status');
      control.disabled = true;
      feedback.textContent = 'Generando narraciones y publicando…';
      try {
        const zones = draft.zones.map((zone, index) => ({
          id: zone.id, label: values.get(`label-${index}`), position: values.get(`position-${index}`),
          text: values.get(`text-${index}`), bounds: [0, 1, 2, 3].map(coord => Number(values.get(`coord-${index}-${coord}`)) / 100)
        }));
        const { work } = await request(`curation/drafts/${draft.id}/publish`, 'POST', {
          intro: values.get('intro'), summary: values.get('summary'), zones, approved: true
        });
        if (!active) return;
        review.innerHTML = `<p role="status" tabindex="-1">Obra publicada. <a class="accent" href="#obra/${esc(draft.id)}">Abrir obra</a></p>`;
        review.querySelector('p').focus();
        onPublished(work);
        await listDrafts();
      } catch (error) { feedback.textContent = error.message; }
      finally { control.disabled = false; }
    };
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const { art } = values;
    if (!art.size || art.size > 6_000_000) {
      status.textContent = 'Elige una imagen de hasta 6 MB.';
      return;
    }
    const control = event.submitter;
    control.disabled = true;
    status.textContent = 'Analizando la imagen…';
    try {
      delete values.art;
      const { draft } = await request('curation/drafts', 'POST', { ...values, imageType: art.type, imageData: await fileAsBase64(art) });
      if (!active) return;
      form.reset();
      status.textContent = 'Borrador listo para revisar.';
      showReview(draft);
      await listDrafts();
    } catch (error) { status.textContent = error.message; }
    finally { control.disabled = false; }
  };
  listDrafts();
  return () => { active = false; };
}
