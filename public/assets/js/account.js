let savedToken = '';
let savedUser = null;
try {
  savedToken = sessionStorage.getItem('arte-token') || '';
  savedUser = JSON.parse(sessionStorage.getItem('arte-user') || 'null');
} catch {}

export const session = {
  config: {},
  token: savedToken,
  user: savedUser,
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

function makeField(name, label, type = 'text', options = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.name = name;
  for (const [key, value] of Object.entries(options)) input[key] = value;
  wrapper.append(caption, input);
  return wrapper;
}

export function mountAccount(root, options) {
  const form = root.querySelector('#account-form');
  const signedIn = root.querySelector('#account-session');
  const formStatus = root.querySelector('#account-form-status');
  const register = root.querySelector('#register');

  function displayAccount() {
    const user = session.user;
    form.hidden = Boolean(user);
    signedIn.hidden = !user;
    register.hidden = !session.config.registration;
    if (!user) return;
    root.querySelector('#session-email').textContent = `Sesión de ${user.email}.`;
    root.querySelector('#curator-link').hidden = !user.curator;
  }

  displayAccount();
  form.onsubmit = async event => {
    event.preventDefault();
    const submitter = event.submitter;
    submitter.disabled = true;
    formStatus.textContent = 'Conectando…';
    try {
      const values = Object.fromEntries(new FormData(form));
      const action = submitter.value === 'register' ? 'register' : 'login';
      const result = await request(`account/${action}`, 'POST', values);
      session.token = result.token;
      session.user = result.user;
      sessionStorage.setItem('arte-token', session.token);
      sessionStorage.setItem('arte-user', JSON.stringify(session.user));
      form.reset();
      displayAccount();
      root.querySelector('#account-session').focus();
    } catch (error) {
      formStatus.textContent = error.message;
    } finally {
      submitter.disabled = false;
    }
  };
  root.querySelector('#sign-out').onclick = () => {
    session.token = '';
    session.user = null;
    sessionStorage.removeItem('arte-token');
    sessionStorage.removeItem('arte-user');
    displayAccount();
    root.querySelector('#account-form').querySelector('input').focus();
  };
  root.querySelector('#save-cloud').onclick = async () => {
    const status = root.querySelector('#account-status');
    status.textContent = 'Guardando…';
    try {
      await request('preferences', 'PUT', options.preferences());
      status.textContent = 'Ajustes guardados en la nube.';
    } catch (error) {
      status.textContent = error.message;
    }
  };
  root.querySelector('#load-cloud').onclick = async () => {
    const status = root.querySelector('#account-status');
    status.textContent = 'Cargando…';
    try {
      const { preferences } = await request('preferences');
      if (preferences) options.setPreferences(preferences);
      status.textContent = preferences ? 'Ajustes aplicados en este dispositivo.' : 'Todavía no hay ajustes guardados en la nube.';
    } catch (error) {
      status.textContent = error.message;
    }
  };
}

const fileAsBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
  reader.readAsDataURL(file);
});

function makeTextarea(name, label, value, rows = 3) {
  const field = makeField(name, label, 'textarea', { rows, maxLength: 1200, required: true });
  field.querySelector('textarea').value = value ?? '';
  return field;
}

export function mountCurator(root, onPublished) {
  const form = root.querySelector('#generate');
  const status = root.querySelector('#draft-status');
  const list = root.querySelector('#drafts');
  const review = root.querySelector('#review');
  if (!session.user?.curator) {
    form.hidden = true;
    const message = document.createElement('p');
    message.textContent = 'Inicia sesión con una cuenta de curaduría.';
    list.replaceChildren(message);
    return;
  }

  async function listDrafts() {
    try {
      const { drafts } = await request('curation/drafts');
      list.replaceChildren();
      if (!drafts.length) {
        list.textContent = 'Por ahora no hay borradores.';
        return;
      }
      for (const draft of drafts) {
        const button = document.createElement('button');
        button.className = 'button';
        button.textContent = `Revisar ${draft.title}`;
        button.onclick = async () => {
          try {
            const result = await request(`curation/drafts/${draft.id}`);
            showReview(result.draft);
          } catch (error) {
            status.textContent = error.message;
          }
        };
        list.append(button);
      }
    } catch (error) {
      list.textContent = error.message;
    }
  }

  function showReview(draft) {
    const publish = document.createElement('form');
    publish.id = 'publish';
    publish.className = 'panel stack';
    const heading = document.createElement('h2');
    heading.tabIndex = -1;
    heading.textContent = `Revisar ${draft.title}`;
    const description = document.createElement('p');
    description.textContent = 'Comprueba los detalles visuales y el orden espacial. La aprobación genera las pistas de voz y publica la obra.';
    publish.append(heading, description);
    if (draft.image) {
      const image = document.createElement('img');
      image.src = draft.image;
      image.alt = `Reproducción de ${draft.title} para revisión`;
      image.style.maxHeight = '24rem';
      image.style.objectFit = 'contain';
      publish.append(image);
    }
    publish.append(makeTextarea('summary', 'Sinopsis para el catálogo', draft.summary));
    publish.append(makeTextarea('intro', 'Introducción general', draft.intro, 5));
    draft.zones.forEach((zone, index) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'draft-zone';
      const legend = document.createElement('legend');
      legend.textContent = `Zona ${index + 1}`;
      fieldset.append(legend);
      fieldset.append(makeField(`label-${index}`, 'Nombre de la zona', 'text', { value: zone.label, maxLength: 70, required: true }));
      fieldset.append(makeField(`position-${index}`, 'Ubicación', 'text', { value: zone.position, maxLength: 70, required: true }));
      fieldset.append(makeTextarea(`text-${index}`, 'Narración de la zona', zone.text));
      const coordinates = document.createElement('div');
      coordinates.className = 'field-grid';
      ['Izquierda', 'Arriba', 'Ancho', 'Alto'].forEach((label, coordinate) => {
        coordinates.append(makeField(`coord-${index}-${coordinate}`, `${label} (%)`, 'number', {
          min: 0, max: 100, step: '.1', value: Math.round(zone.bounds[coordinate] * 1000) / 10, required: true
        }));
      });
      fieldset.append(coordinates);
      publish.append(fieldset);
    });
    const confirmation = document.createElement('label');
    confirmation.className = 'check';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.required = true;
    confirmation.append(checkbox, document.createTextNode('Confirmo que revisé los textos y las zonas.'));
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'button primary';
    submit.textContent = 'Aprobar, generar audios y publicar';
    const feedback = document.createElement('p');
    feedback.id = 'publish-status';
    feedback.setAttribute('role', 'status');
    publish.append(confirmation, submit, feedback);
    review.replaceChildren(publish);
    heading.focus();

    publish.onsubmit = async event => {
      event.preventDefault();
      const values = new FormData(publish);
      submit.disabled = true;
      feedback.textContent = 'Generando narraciones y publicando…';
      try {
        const zones = draft.zones.map((zone, index) => ({
          id: zone.id,
          label: values.get(`label-${index}`),
          position: values.get(`position-${index}`),
          text: values.get(`text-${index}`),
          bounds: [0, 1, 2, 3].map(coordinate => Number(values.get(`coord-${index}-${coordinate}`)) / 100)
        }));
        const { work } = await request(`curation/drafts/${draft.id}/publish`, 'POST', {
          intro: values.get('intro'), summary: values.get('summary'), zones, approved: true
        });
        const message = document.createElement('p');
        message.tabIndex = -1;
        message.setAttribute('role', 'status');
        message.append(document.createTextNode('Obra publicada. '));
        const link = document.createElement('a');
        link.className = 'accent';
        link.href = `/obra/?id=${encodeURIComponent(draft.id)}`;
        link.textContent = 'Abrir obra';
        message.append(link);
        review.replaceChildren(message);
        message.focus();
        onPublished(work);
        await listDrafts();
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
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
    const submit = event.submitter;
    submit.disabled = true;
    status.textContent = 'Analizando la imagen…';
    try {
      delete values.art;
      const { draft } = await request('curation/drafts', 'POST', {
        ...values, imageType: art.type, imageData: await fileAsBase64(art)
      });
      form.reset();
      status.textContent = 'Borrador listo para revisar.';
      showReview(draft);
      await listDrafts();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
  listDrafts();
}
