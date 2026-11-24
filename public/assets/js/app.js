import { works as demo, welcome } from './works.js';
import {
  audioStatus, environmentSound, pauseVoice, playVoice, resumeEnvironment, stopVoice,
  updateAudio, vibrate, zoneEffect
} from './player.js';

const main = document.querySelector('main');
const status = document.querySelector('#route-status');
const defaults = { rate: 1, volume: .25, haptic: 1, contrast: false, large: false, automatic: true };
const safeNumber = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(max, Math.max(min, value)) : fallback;
let preferences = { ...defaults };
let catalog = [...demo];
let selected = 0;
let services = { cloud: false };

function setPreferences(values = {}) {
  const input = values ?? {};
  preferences = {
    rate: safeNumber(input.rate, 1, .65, 1.55),
    volume: safeNumber(input.volume, .25, 0, 1),
    haptic: Math.round(safeNumber(input.haptic, 1, 0, 2)),
    contrast: input.contrast === true,
    large: input.large === true,
    automatic: input.automatic !== false
  };
  document.body.classList.toggle('contrast', preferences.contrast);
  document.body.classList.toggle('large', preferences.large);
  updateAudio(preferences);
}

function savePreferences() {
  try { localStorage.setItem('arte-preferences', JSON.stringify(preferences)); } catch {}
}

try { setPreferences(JSON.parse(localStorage.getItem('arte-preferences'))); } catch { setPreferences(); }

function announce(text) {
  if (status) status.textContent = text;
}

function workLink(work) {
  return `/obra/?id=${encodeURIComponent(work.id)}`;
}

function makeCard(work, active) {
  const article = document.createElement('article');
  article.className = `card${active === work.id ? ' current' : ''}`;
  const link = document.createElement('a');
  link.className = 'card-link';
  link.href = workLink(work);
  const art = document.createElement('span');
  art.className = 'card-art';
  const image = document.createElement('img');
  image.src = work.image;
  image.alt = '';
  image.loading = 'lazy';
  art.append(image);
  const body = document.createElement('span');
  body.className = 'card-body';
  const description = document.createElement('span');
  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = work.title;
  const meta = document.createElement('span');
  meta.className = 'card-meta';
  meta.textContent = `${work.artist} · ${work.year}`;
  description.append(title, meta);
  const play = document.createElement('span');
  play.className = 'card-play';
  play.setAttribute('aria-hidden', 'true');
  play.textContent = '▶';
  body.append(description, play);
  link.append(art, body);
  article.append(link);
  return article;
}

function renderCards(root, list, active) {
  root.replaceChildren(...list.map(work => makeCard(work, active)));
}

function fillHome() {
  // Portada minimalista.
  // La única acción visible es acceder a la galería.
  // Se conserva el resto de la aplicación sin modificaciones.
}


function fillGallery() {
  const current = document.querySelector('#current-work');
  const cards = document.querySelector('#catalog-cards');
  const caption = document.querySelector('#catalog-status');
  const focus = document.querySelector('#catalog-focus');

  // Elementos del menú accesible
  const menu = document.querySelector('.access-menu');
  const galleryContent = document.querySelector('#gallery-content');
  const exploreButton = document.querySelector('#explore-works');
  const backButton = document.querySelector('#back-to-menu');

  // Elementos de bienvenida
  const welcomeButton = document.querySelector('#welcome-audio');
  const welcomeStatus = document.querySelector('#welcome-status');
  const welcomeKey = 'bienvenida-galeria';

  // Elementos de reproducción de la ficha
  const summaryButton = document.querySelector('#summary');

  // Actualizar la obra seleccionada
  const sync = () => {
    const work = catalog[selected];
    if (!work || !current) return;

    const count = document.createElement('p');
    count.className = 'muted small';
    count.textContent =
      `${selected + 1} de ${catalog.length} · ${work.category}`;

    const title = document.createElement('h2');
    const titleLink = document.createElement('a');

    titleLink.href = workLink(work);
    titleLink.textContent = work.title;
    title.append(titleLink);

    const artist = document.createElement('p');
    artist.className = 'muted';
    artist.textContent = `${work.artist} · ${work.year}`;

    const summary = document.createElement('p');
    summary.textContent = work.summary;

    current.replaceChildren(count, title, artist, summary);

    if (cards) {
      renderCards(cards, catalog, work.id);
    }
  };

  // Reproducir la descripción de la obra
  const preview = () => {
    const work = catalog[selected];
    if (!work || !summaryButton) return;

    const key = `ficha-${work.id}`;

    playVoice(
      key,
      `${work.title}, de ${work.artist}. ${work.summary}`,
      work.summaryAudio,
      state => {
        switch (state) {
          case 'playing':
            summaryButton.textContent = 'Pausar ficha';
            summaryButton.setAttribute('aria-pressed', 'true');
            break;

          case 'paused':
            summaryButton.textContent = 'Reanudar ficha';
            summaryButton.setAttribute('aria-pressed', 'false');
            break;

          case 'unavailable':
            summaryButton.textContent = 'Escuchar ficha';
            summaryButton.setAttribute('aria-pressed', 'false');

            if (caption) {
              caption.textContent =
                `${work.title}, de ${work.artist}. ${work.summary}`;
            }
            break;

          default:
            summaryButton.textContent = 'Escuchar ficha';
            summaryButton.setAttribute('aria-pressed', 'false');
        }
      }
    );
  };

  // Bienvenida: reproducir, pausar y reanudar
  if (welcomeButton) {
    welcomeButton.setAttribute('aria-pressed', 'false');

    welcomeButton.addEventListener('click', () => {
      if (audioStatus(welcomeKey) === 'playing') {
        pauseVoice(welcomeKey);
        return;
      }

      playVoice(
        welcomeKey,
        welcome,
        null,
        state => {
          if (state === 'playing') {
            welcomeButton.textContent = 'Pausar bienvenida';
            welcomeButton.setAttribute('aria-pressed', 'true');

            if (welcomeStatus) {
              welcomeStatus.textContent =
                'Reproduciendo mensaje de bienvenida.';
            }
          } else if (state === 'paused') {
            welcomeButton.textContent = 'Reanudar bienvenida';
            welcomeButton.setAttribute('aria-pressed', 'false');

            if (welcomeStatus) {
              welcomeStatus.textContent = 'Bienvenida pausada.';
            }
          } else if (state === 'unavailable') {
            welcomeButton.textContent = 'Intentar nuevamente';
            welcomeButton.setAttribute('aria-pressed', 'false');

            if (welcomeStatus) {
              welcomeStatus.textContent =
                'No fue posible reproducir la bienvenida. Comprueba que tu navegador permita la síntesis de voz.';
            }
          } else {
            welcomeButton.textContent = 'Escuchar bienvenida';
            welcomeButton.setAttribute('aria-pressed', 'false');

            if (welcomeStatus) {
              welcomeStatus.textContent =
                'La bienvenida ha terminado.';
            }
          }
        }
      );
    });
  }

  // Mostrar la galería
  function showGallery() {
    if (!galleryContent) return;

    galleryContent.hidden = false;

    galleryContent.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    const heading = current?.querySelector('h2');

    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  // Regresar al menú principal
  function showMenu() {
    if (!menu || !galleryContent) return;

    stopVoice();
    galleryContent.hidden = true;

    menu.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    exploreButton?.focus({ preventScroll: true });
  }

  // Eventos de navegación
  exploreButton?.addEventListener('click', showGallery);
  backButton?.addEventListener('click', showMenu);

  // Cambiar de obra
  const step = delta => {
    stopVoice();

    selected =
      (selected + delta + catalog.length) % catalog.length;

    if (summaryButton) {
      summaryButton.textContent = 'Escuchar ficha';
      summaryButton.setAttribute('aria-pressed', 'false');
    }

    sync();

    if (preferences.automatic) {
      preview();
    } else if (caption) {
      caption.textContent =
        `${selected + 1} de ${catalog.length}. ${catalog[selected].title}`;
    }
  };

  // Botones anterior y siguiente
  document.querySelector('#previous')?.addEventListener(
    'click',
    () => step(-1)
  );

  document.querySelector('#next')?.addEventListener(
    'click',
    () => step(1)
  );

  // Botón escuchar ficha
  if (summaryButton) {
    summaryButton.textContent = 'Escuchar ficha';
    summaryButton.setAttribute('aria-pressed', 'false');

    summaryButton.addEventListener('click', () => {
      const work = catalog[selected];
      if (!work) return;

      const key = `ficha-${work.id}`;
      const state = audioStatus(key);

      if (state === 'playing') {
        pauseVoice(key);
      } else {
        preview();
      }
    });
  }

  // Navegación táctil
  let start = null;

  if (focus) {
    focus.onpointerdown = event => {
      if (
        event.pointerType !== 'touch' ||
        event.target.closest('a, button')
      ) return;

      start = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
      };

      focus.setPointerCapture(event.pointerId);
    };

    focus.onpointerup = event => {
      if (!start || event.pointerId !== start.id) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;

      start = null;

      if (
        Math.abs(dy) > 40 &&
        Math.abs(dy) > Math.abs(dx)
      ) {
        step(dy < 0 ? 1 : -1);
      }
    };

    focus.onpointercancel = () => {
      start = null;
    };
  }

  // Preparar la primera obra
  sync();
}

function fillSearch() {
  const input = document.querySelector('#query');
  const feedback = document.querySelector('#voice-search-status');
  const trigger = document.querySelector('#mic');
  const results = document.querySelector('#results');
  const normalized = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const update = () => {
    const terms = normalized(input.value).trim().split(/\s+/).filter(Boolean);
    const matches = catalog.filter(work => terms.every(term =>
      normalized(`${work.title} ${work.artist} ${work.category} ${work.technique}`).includes(term)));
    document.querySelector('#result-count').textContent = matches.length === 1 ? '1 obra' : `${matches.length} obras`;
    renderCards(results, matches);
  };
  input.oninput = update;
  document.querySelector('#search-form').onsubmit = event => {
    event.preventDefault();
    update();
  };
  update();
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    trigger.disabled = true;
    feedback.textContent = 'Este navegador no admite el micrófono de búsqueda. Puedes escribir o usar el dictado de tu teclado.';
    return;
  }
  const listener = new Recognition();
  listener.lang = 'es-MX';
  listener.interimResults = false;
  listener.onresult = event => {
    input.value = event.results[0][0].transcript.replace(/[.!?]+$/, '');
    feedback.textContent = `Se reconoció: ${input.value}`;
    update();
  };
  listener.onerror = () => { feedback.textContent = 'No se completó el dictado. Intenta de nuevo o usa el campo de texto.'; };
  listener.onend = () => {
    trigger.disabled = false;
    if (feedback.textContent === 'Escuchando…') feedback.textContent = 'No se detectó una frase. Puedes volver a intentarlo.';
  };
  trigger.onclick = () => {
    try {
      listener.start();
      trigger.disabled = true;
      feedback.textContent = 'Escuchando…';
    } catch { feedback.textContent = 'No se pudo iniciar el micrófono.'; }
  };
  window.addEventListener('pagehide', () => listener.abort(), { once: true });
}

function fillSettings() {
  const updateOutputs = () => {
    document.querySelector('#rate-value').textContent = `${Number(preferences.rate.toFixed(2)).toLocaleString('es-MX')} ×`;
    document.querySelector('#volume-value').textContent = `${Math.round(preferences.volume * 100)}%`;
  };
  for (const key of ['rate', 'volume', 'haptic', 'contrast', 'large', 'automatic']) {
    const field = document.getElementById(key);
    field.value = String(preferences[key]);
    if (field.type === 'checkbox') field.checked = preferences[key];
    field.addEventListener('input', () => {
      setPreferences({ ...preferences, [key]: field.type === 'checkbox' ? field.checked : Number(field.value) });
      savePreferences();
      updateOutputs();
      if (key === 'haptic') vibrate();
      if (key === 'volume') resumeEnvironment();
    });
  }
  updateOutputs();
  document.querySelector('#test-audio').onclick = () => {
    if (audioStatus('prueba') === 'playing') {
      environmentSound('');
      pauseVoice('prueba');
      return;
    }
    environmentSound('mar');
    playVoice('prueba', welcome, '/media/bienvenida.wav', state => {
      document.querySelector('#test-audio').textContent = state === 'playing'
        ? 'Pausar prueba de audio' : 'Probar narración y ambiente';
      if (state !== 'playing') environmentSound('');
    });
  };
}

function makeZoneButton(zone, index, play) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.setAttribute('aria-pressed', 'false');
  const label = document.createElement('span');
  label.textContent = `${zone.label} · ${zone.position}`;
  const icon = document.createElement('span');
  icon.textContent = '▶';
  icon.setAttribute('aria-hidden', 'true');
  button.append(label, icon);
  button.onclick = () => play(index, true);
  return button;
}

function fillWork(work, activated = false) {
  document.querySelector('#work-title').textContent = work.title;
  document.querySelector('#work-meta').textContent = `${work.artist} · ${work.year} · ${work.technique}`;
  document.title = `${work.title} · Arte al oído`;
  const canvas = document.querySelector('#canvas');
  const image = document.createElement('img');
  image.src = work.image;
  image.alt = '';
  image.draggable = false;
  canvas.append(image);
  const list = document.querySelector('#zone-list');
  const now = document.querySelector('#now');
  const intro = document.querySelector('#intro');
  const marks = work.zones.map((zone, index) => {
    const [left, top, width, height] = zone.bounds;
    const mark = document.createElement('span');
    mark.className = 'canvas-zone';
    mark.dataset.zone = String(index);
    mark.style.left = `${left * 100}%`;
    mark.style.top = `${top * 100}%`;
    mark.style.width = `${width * 100}%`;
    mark.style.height = `${height * 100}%`;
    canvas.append(mark);
    return mark;
  });
  const zoneButtons = work.zones.map((zone, index) => makeZoneButton(zone, index, playZone));
  list.replaceChildren(...zoneButtons);
  const transcript = document.querySelector('#transcript');
  const introText = document.createElement('p');
  introText.textContent = work.intro;
  transcript.append(introText);
  for (const zone of work.zones) {
    const paragraph = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = zone.label;
    paragraph.append(title, document.createTextNode(` · ${zone.text}`));
    transcript.append(paragraph);
  }
  if (work.source) {
    const paragraph = document.createElement('p');
    const source = document.createElement('a');
    source.href = work.source;
    source.textContent = 'Ver ficha de la obra';
    paragraph.append(source);
    transcript.append(paragraph);
  }
  const fitCanvas = () => {
    if (image.naturalHeight) canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  };
  if (image.complete) fitCanvas();
  else image.addEventListener('load', fitCanvas, { once: true });

  const audioLabel = (label, state) => state === 'playing' ? `Reproduciendo · ${label}`
    : state === 'paused' ? `En pausa · ${label}`
      : state === 'unavailable' ? 'No se pudo reproducir. Puedes abrir la transcripción.' : 'Elige una zona para continuar.';
  const playIntro = () => {
    const key = `intro-${work.id}`;
    if (audioStatus(key) === 'playing') return pauseVoice(key);
    environmentSound(work.sound, work.ambientAudio);
    resumeEnvironment();
    playVoice(key, work.intro, work.introAudio, state => {
      intro.textContent = state === 'playing' ? 'Pausar introducción'
        : state === 'paused' ? 'Reanudar introducción' : 'Escuchar introducción';
      now.textContent = audioLabel('Introducción', state);
      if (state === 'unavailable') announce(now.textContent);
    });
  };
  intro.onclick = playIntro;
  function playZone(index, toggle) {
    const zone = work.zones[index];
    if (!zone) return;
    const key = `${work.id}-${zone.id}`;
    if (audioStatus(key) === 'playing') {
      if (toggle) pauseVoice(key);
      return;
    }
    environmentSound(work.sound, work.ambientAudio);
    resumeEnvironment();
    zoneEffect(index);
    playVoice(key, zone.text, zone.audio, state => {
      zoneButtons[index].setAttribute('aria-pressed', String(state === 'playing'));
      zoneButtons[index].lastElementChild.textContent = state === 'playing' ? 'Ⅱ' : '▶';
      marks[index].classList.toggle('active', state === 'playing');
      now.textContent = audioLabel(zone.label, state);
      if (state === 'unavailable') announce(now.textContent);
    });
  }
  function indexAt(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return work.zones.findIndex(({ bounds: [left, top, width, height] }) =>
      x >= left && y >= top && x <= left + width && y <= top + height);
  }
  let pointer;
  let timer;
  function hold() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!pointer || pointer.index < 0) return;
      pointer.holding = true;
      playZone(pointer.index, false);
    }, 320);
  }
  canvas.onpointerdown = event => {
    if (pointer || event.button !== 0) return;
    pointer = { id: event.pointerId, index: indexAt(event), holding: false };
    canvas.setPointerCapture(event.pointerId);
    hold();
  };
  canvas.oncontextmenu = event => event.preventDefault();
  canvas.onpointermove = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const index = indexAt(event);
    if (index === pointer.index) return;
    const previous = work.zones[pointer.index];
    pointer.index = index;
    vibrate();
    if (!pointer.holding) return hold();
    if (index < 0 && previous) pauseVoice(`${work.id}-${previous.id}`);
    else playZone(index, false);
  };
  const end = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const zone = work.zones[pointer.index];
    if (pointer.holding && zone) pauseVoice(`${work.id}-${zone.id}`);
    pointer = null;
    clearTimeout(timer);
  };
  canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = end;
  document.querySelector('#share').onclick = async () => {
    const note = document.querySelector('#sharing');
    try {
      if (navigator.share) await navigator.share({ title: work.title, url: location.href });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(location.href);
        note.hidden = false;
        note.textContent = 'Enlace copiado.';
      } else throw new Error('Compartir no está disponible.');
    } catch (error) {
      if (error.name === 'AbortError') return;
      note.hidden = false;
      note.textContent = `Enlace de la obra: ${location.href}`;
    }
  };
  if (activated && preferences.automatic) playIntro();
}

async function loadWork() {
  const id = new URLSearchParams(location.search).get('id');
  let work = catalog.find(entry => entry.id === id);
  if (!work && id && /^[a-f0-9-]{36}$/i.test(id) && services.cloud) {
    try {
      const response = await fetch(`/api/works/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('No se pudo cargar la obra.');
      ({ work } = await response.json());
      catalog.push(work);
    } catch {
      work = null;
    }
  }
  if (work) {
    // 👇 MAPEO DE AUDIOS DE LA NUBE AL FORMATO QUE ESPERA player.js
    const cloudWork = {
      ...work,
      // 1. Audio ambiental de fondo
      ambientAudio: work.ambientAudioPath ? `/api/media/${work.id}/ambiente` : '',
      
      // 2. Audio de introducción / resumen (Botón "Escuchar introducción")
      introAudio: work.introAudioPath ? `/api/media/${work.id}/intro` : (work.narrationAudioPath ? `/api/media/${work.id}/narracion` : ''),
      
      // 3. Audio de ficha/resumen (si lo tienes separado)
      summaryAudio: work.summaryAudioPath ? `/api/media/${work.id}/ficha` : '',
      
      // 4. Audio para cada zona de la imagen
      zones: work.zones.map((zone, index) => ({
        ...zone,
        // Genera la ruta dinámica para la zona (zona-1, zona-2, etc.)
        audio: zone.audioPath ? `/api/media/${work.id}/zona-${index + 1}` : ''
      }))
    };
    
    fillWork(cloudWork);
  } else {
    document.querySelector('#work-title').textContent = 'Obra no disponible';
    document.querySelector('#work-meta').textContent = 'Puedes volver a la galería o comprobar tu conexión.';
  }
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) return;
    const data = await response.json();
    catalog = [...demo, ...data.works];
    selected = Math.min(selected, catalog.length - 1);
  } catch {}
}

async function initialize() {
  const page = document.body.dataset.page;
  const configPromise = fetch('/api/config').then(response => response.json()).then(data => {
    services = data;
    session.configure(data);
    const accountLink = document.querySelector('#account-link');
    if (accountLink) accountLink.hidden = !services.cloud;
    const adminLink = document.querySelector('#admin-link');
    if (adminLink) {
      adminLink.hidden = !session.user; 
    }
  });
  const catalogPromise = loadCatalog();
  await Promise.allSettled([configPromise, catalogPromise]);
  if (page === 'inicio') fillHome();
  if (page === 'galeria') fillGallery();
  if (page === 'buscar') fillSearch();
  if (page === 'ajustes') fillSettings();
  if (page === 'obra') await loadWork();
}

initialize();
window.addEventListener('pagehide', () => {
  stopVoice();
  environmentSound('');
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/assets/js/sw.js', { scope: '/' }).catch(() => {});
