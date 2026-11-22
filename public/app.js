
import { works as demo, welcome } from './works.js';

import {
  audioStatus,
  environmentSound,
  pauseVoice,
  playVoice,
  resumeEnvironment,
  stopVoice,
  updateAudio,
  vibrate,
  zoneEffect
} from './player.js';

import {
  mountAccount,
  mountCurator,
  session
} from './account.js';

/* ==========================================
   ICONOS
   ========================================== */

const glyphs = {
  wave: '<path d="M3 12h2l2-5 3 10 3-14 3 17 2-8h3"/>',

  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',

  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-3 0h6"/>',

  settings: '<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',

  headphones: '<path d="M3 14v-3a9 9 0 1 1 18 0v3"/><rect x="3" y="12" width="5" height="8" rx="2"/><rect x="16" y="12" width="5" height="8" rx="2"/>',

  play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',

  pause: '<path d="M9 5v14m6-14v14" stroke-width="3"/>',

  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',

  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 6h8"/>',

  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',

  close: '<path d="m6 6 12 12M18 6 6 18"/>'
};

export const icon = name => `
  <svg
    aria-hidden="true"
    focusable="false"
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linejoin="round"
    stroke-linecap="round">
    ${glyphs[name] || ''}
  </svg>
`;

/* ==========================================
   SEGURIDAD Y UTILIDADES
   ========================================== */

export const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

const esc = escapeHTML;

const main = document.querySelector('main');
const status = document.querySelector('#route-status');

const defaults = {
  rate: 1,
  volume: 0.25,
  haptic: 1,
  contrast: false,
  large: false,
  automatic: true
};

const safeNumber = (value, fallback, min, max) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

let preferences = { ...defaults };
let catalog = [...demo];

let selected = 0;
let services = { cloud: false };

let cleanup = () => {};
let refreshGallery = () => {};

let query = '';
let activeRoute;

try {
  setPreferences(
    JSON.parse(localStorage.getItem('arte-preferences'))
  );
} catch {
  setPreferences();
}

document.querySelectorAll('[data-icon]').forEach(element => {
  element.innerHTML = icon(element.dataset.icon);
});

/* ==========================================
   PREFERENCIAS
   ========================================== */

function setPreferences(values = {}) {
  const input = values ?? {};

  preferences = {
    rate: safeNumber(input.rate, 1, 0.65, 1.55),

    volume: safeNumber(input.volume, 0.25, 0, 1),

    haptic: Math.round(
      safeNumber(input.haptic, 1, 0, 2)
    ),

    contrast: input.contrast === true,

    large: input.large === true,

    automatic: input.automatic !== false
  };

  document.body.classList.toggle(
    'contrast',
    preferences.contrast
  );

  document.body.classList.toggle(
    'large',
    preferences.large
  );

  updateAudio(preferences);
}

function savePreferences() {
  try {
    localStorage.setItem(
      'arte-preferences',
      JSON.stringify(preferences)
    );
  } catch {}
}

function announce(message) {
  if (status) {
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = message;
    });
  }
}

function hash() {
  return location.hash.slice(1) || 'inicio';
}

const workLink = work =>
  `#obra/${encodeURIComponent(work.id)}`;

const trackText = work =>
  `${work.title}, de ${work.artist}. ${work.summary}`;

const titleBlock = (title, description) => `
  <div class="page-heading">
    <h1 tabindex="-1">${esc(title)}</h1>
    ${description
      ? `<p class="muted">${esc(description)}</p>`
      : ''}
  </div>
`;

const back = (where, label) => `
  <a class="breadcrumbs" href="#${where}">
    ${esc(label)}
  </a>
`;

const button = (label, id, glyph, kind = '') => `
  <button
    type="button"
    class="button ${kind}"
    id="${id}">
    ${glyph ? icon(glyph) : ''}
    ${label}
  </button>
`;

const image = (work, options = '') => `
  <img
    alt=""
    src="${esc(work.image)}"
    ${options}>
`;

const cards = (list, active) =>
  list.map(work => `
    <article class="card${active === work.id ? ' current' : ''}">
      <a class="card-link" href="${workLink(work)}">
        <span class="card-art">
          ${image(work, 'loading="lazy"')}
        </span>

        <span class="card-body">
          <span>
            <span class="card-title">
              ${esc(work.title)}
            </span>

            <span class="card-meta">
              ${esc(work.artist)} · ${esc(work.year)}
            </span>
          </span>

          <span class="card-play">
            ${icon('play')}
          </span>
        </span>
      </a>
    </article>
  `).join('');

/* ==========================================
   TUTORIAL ACCESIBLE
   ========================================== */

const tutorialText = `
  Bienvenido a Arte al oído.

  Esta es una galería diseñada para explorar obras de arte
  mediante narraciones, sonidos y controles accesibles.

  En la pantalla principal encontrarás el botón Explorar galería.

  Dentro de la galería puedes utilizar los botones anterior
  y siguiente para recorrer las obras.

  También puedes seleccionar una obra para entrar a su
  experiencia de audioguía.

  Cada obra tiene una introducción que explica su composición,
  contexto y significado.

  Después puedes explorar diferentes zonas de la imagen.

  Si utilizas una pantalla táctil, mantén presionado el lienzo
  para escuchar una zona.

  También puedes utilizar los botones que aparecen debajo
  de la imagen para escuchar cada parte.

  En el apartado de búsqueda puedes escribir el nombre
  de una obra o utilizar el micrófono.

  En ajustes puedes modificar la velocidad de narración,
  el volumen ambiental, el contraste y el tamaño del texto.

  Te invitamos a explorar el arte a tu propio ritmo.
`;

function tutorial() {
  main.innerHTML = `
    <section class="page">
      ${back('inicio', 'Inicio')}

      ${titleBlock(
        'Conoce la galería',
        'Una guía para comenzar a explorar Arte al oído.'
      )}

      <section class="panel stack">
        <div class="eyebrow">
          ${icon('headphones')}
          Guía de navegación
        </div>

        <h2>Tu experiencia comienza aquí</h2>

        <p>
          Esta audioguía te acompañará por las obras,
          sus detalles y sus historias.
        </p>

        <ol class="tutorial-steps">
          <li>
            <strong>Explora la galería.</strong>
            Recorre las obras mediante los botones
            anterior y siguiente.
          </li>

          <li>
            <strong>Escucha la introducción.</strong>
            Conoce el contexto y la composición
            de cada obra.
          </li>

          <li>
            <strong>Descubre los detalles.</strong>
            Explora las zonas de la imagen mediante
            el tacto o los botones accesibles.
          </li>

          <li>
            <strong>Busca tus obras favoritas.</strong>
            Escribe un título o utiliza el micrófono.
          </li>

          <li>
            <strong>Personaliza la experiencia.</strong>
            Ajusta la voz, el volumen y la pantalla.
          </li>
        </ol>

        <div class="row">
          ${button(
            'Escuchar tutorial',
            'tutorial-play',
            'play',
            'primary'
          )}

          ${button(
            'Volver al inicio',
            'tutorial-home',
            'arrow'
          )}
        </div>

        <p
          id="tutorial-status"
          class="provider-status"
          role="status"
          aria-live="polite">
        </p>
      </section>
    </section>
  `;

  const control = document.querySelector('#tutorial-play');
  const feedback = document.querySelector('#tutorial-status');

  control.onclick = () => {
    const key = 'tutorial-principal';

    if (audioStatus(key) === 'playing') {
      pauseVoice(key);
      return;
    }

    playVoice(
      key,
      tutorialText,
      '',
      state => {
        control.innerHTML = `
          ${icon(state === 'playing' ? 'pause' : 'play')}
          ${state === 'playing'
            ? 'Pausar tutorial'
            : 'Escuchar tutorial'}
        `;

        if (state === 'unavailable') {
          feedback.textContent =
            'No se pudo iniciar la narración. Puedes leer las instrucciones en pantalla.';
        } else if (state === 'stopped') {
          feedback.textContent = 'Tutorial finalizado.';
        }
      }
    );
  };

  document.querySelector('#tutorial-home').onclick = () => {
    location.hash = '#inicio';
  };
}

/* ==========================================
   PANTALLA DE INICIO
   ========================================== */

function home() {
  const work = catalog[0];

  main.innerHTML = `
    <section class="hero">
      <div class="hero-copy">

        <div class="eyebrow">
          ${icon('headphones')}
          Galería accesible
        </div>

        <h1 tabindex="-1">
          El arte también
          <br>
          se <em>escucha.</em>
        </h1>

        <p>
          Explora obras de arte a través del tacto,
          la narración y el sonido.
        </p>

        <div class="hero-actions">

          <a class="button primary" href="#galeria">
            ${icon('grid')}
            Explorar galería
          </a>

          <a class="button" href="#buscar">
            ${icon('mic')}
            Buscar una obra
          </a>

          <a class="button" href="#tutorial">
            ${icon('book')}
            Conocer cómo funciona
          </a>

          <a class="button" href="#ajustes">
            ${icon('settings')}
            Ajustes de accesibilidad
          </a>

          ${button(
            'Escuchar bienvenida',
            'welcome',
            'play',
            'plain welcome'
          )}

        </div>
      </div>

      <figure class="hero-art" style="margin:0">
        ${image(work, 'fetchpriority="high"')}

        <figcaption class="hero-caption">
          <span class="art-icon">
            ${icon('wave')}
          </span>

          <span>
            <strong>${esc(work.title)}</strong>

            <span class="caption-meta">
              ${esc(work.artist)} · ${esc(work.technique)}
            </span>
          </span>
        </figcaption>
      </figure>
    </section>

    <section
      class="collection"
      aria-labelledby="collection-title">

      <div class="section-heading">
        <div>
          <h2 id="collection-title">
            Obras para escuchar
          </h2>

          <p class="muted">
            Elige una pieza para explorar sus zonas.
          </p>
        </div>
      </div>

      <div class="cards" id="home-cards">
        ${cards(catalog.slice(0, 3))}
      </div>
    </section>
  `;

  const control = document.querySelector('#welcome');

  control.onclick = () => {
    const key = 'bienvenida';

    if (audioStatus(key) === 'playing') {
      pauseVoice(key);
      return;
    }

    playVoice(
      key,
      welcome,
      '/media/bienvenida.wav',
      state => {
        control.innerHTML = `
          ${icon(state === 'playing' ? 'pause' : 'play')}
          ${state === 'playing'
            ? 'Pausar bienvenida'
            : 'Escuchar bienvenida'}
        `;

        if (state === 'unavailable') {
          announce(welcome);
        }
      }
    );
  };
}

/* ==========================================
   FICHA DE CATÁLOGO
   ========================================== */

function previewCatalog() {
  const work = catalog[selected];

  if (!work) return;

  const control = document.querySelector('#summary');
  const caption = document.querySelector('#catalog-status');

  playVoice(
    `ficha-${work.id}`,
    trackText(work),
    work.summaryAudio,
    state => {
      if (control) {
        control.innerHTML = `
          ${icon(state === 'playing' ? 'pause' : 'play')}
          ${state === 'playing'
            ? 'Pausar ficha'
            : 'Escuchar ficha'}
        `;
      }

      if (state === 'unavailable' && caption) {
        caption.textContent = trackText(work);
      }
    }
  );
}

/* ==========================================
   GALERÍA
   ========================================== */

function gallery() {
  main.innerHTML = `
    <section class="page">

      ${back('inicio', 'Inicio')}

      ${titleBlock(
        'Galería',
        'Recorre las obras con los controles de navegación. Selecciona una pieza para comenzar su audioguía.'
      )}

      <div class="catalog-focus" id="catalog-focus">

        <div id="current-work"></div>

        <div class="catalog-controls">
          ${button('Anterior', 'previous')}
          ${button('Escuchar ficha', 'summary', 'play')}
          ${button('Siguiente', 'next')}
        </div>

        <p
          class="sr-only"
          id="catalog-status"
          role="status"
          aria-live="polite">
        </p>

      </div>

      <div class="cards" id="catalog-cards"></div>

    </section>
  `;

  const pointerTarget =
    document.querySelector('#catalog-focus');

  const caption =
    document.querySelector('#catalog-status');

  let start;

  const sync = () => {
    const work = catalog[selected];

    if (!work) return;

    document.querySelector('#current-work').innerHTML = `
      <p class="muted small">
        Obra ${selected + 1} de ${catalog.length}
        · ${esc(work.category)}
      </p>

      <h2>
        <a href="${workLink(work)}">
          ${esc(work.title)}
        </a>
      </h2>

      <p class="muted">
        ${esc(work.artist)} · ${esc(work.year)}
      </p>

      <p>${esc(work.summary)}</p>
    `;

    document.querySelector('#catalog-cards').innerHTML =
      cards(catalog, work.id);
  };

  refreshGallery = sync;

  sync();

  const step = delta => {
    stopVoice();

    selected =
      (selected + delta + catalog.length) % catalog.length;

    sync();

    if (preferences.automatic) {
      previewCatalog();
    } else {
      caption.textContent =
        `${selected + 1} de ${catalog.length}. ${trackText(catalog[selected])}`;
    }

    announce(
      `Obra ${selected + 1} de ${catalog.length}: ${catalog[selected].title}, de ${catalog[selected].artist}.`
    );
  };

  document.querySelector('#previous').onclick =
    () => step(-1);

  document.querySelector('#next').onclick =
    () => step(1);

  document.querySelector('#summary').onclick = () => {
    const key = `ficha-${catalog[selected].id}`;

    if (audioStatus(key) === 'playing') {
      pauseVoice(key);
    } else {
      previewCatalog();
    }
  };

  pointerTarget.onpointerdown = event => {
    if (
      event.pointerType !== 'touch' ||
      event.target.closest('a,button')
    ) {
      return;
    }

    start = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };

    pointerTarget.setPointerCapture(event.pointerId);
  };

  pointerTarget.onpointerup = event => {
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

  pointerTarget.onpointercancel = () => {
    start = null;
  };
}

/* ==========================================
   EXPERIENCIA DE OBRA
   ========================================== */

function openWork(work, activated) {
  const description =
    `${work.artist} · ${work.year} · ${work.technique}`;

  main.innerHTML = `
    <section class="page">

      ${back('galeria', 'Galería')}

      ${titleBlock(work.title, description)}

      <div class="work-grid">

        <div>
          <div
            class="canvas"
            id="canvas"
            aria-label="Imagen de ${esc(work.title)}">

            ${image(work, 'draggable="false"')}
          </div>

          <p
            class="guidance muted"
            id="zone-help">
            Mantén presionado el lienzo para escuchar una zona.
            Desliza sin levantar el dedo para cambiar de zona.
            También puedes utilizar los botones de exploración.
          </p>
        </div>

        <div class="panel">

          <div class="row work-actions">
            ${button(
              'Escuchar introducción',
              'intro',
              'play',
              'primary'
            )}

            ${button(
              'Compartir',
              'share',
              'share'
            )}
          </div>

          <p
            class="now"
            id="now"
            role="status"
            aria-live="polite">
            Explora el lienzo o elige una zona.
          </p>

          <h2 id="zone-heading">
            Zonas de la obra
          </h2>

          <div
            class="zone-list"
            role="group"
            aria-labelledby="zone-heading"
            aria-describedby="zone-help">

            ${work.zones.map((zone, index) => `
              <button
                type="button"
                class="button"
                aria-pressed="false"
                data-list-zone="${index}">

                <span>
                  ${esc(zone.label)}

                  <span class="muted small">
                    · ${esc(zone.position)}
                  </span>
                </span>

                ${icon('play')}
              </button>
            `).join('')}

          </div>

          <details class="transcript">
            <summary>
              Transcripción y créditos
            </summary>

            <p>${esc(work.intro)}</p>

            ${work.zones.map(zone => `
              <p>
                <strong>${esc(zone.label)}</strong>
                · ${esc(zone.text)}
              </p>
            `).join('')}

            ${work.source
              ? `<p><a href="${esc(work.source)}">Ver ficha de la obra</a></p>`
              : ''}
          </details>

          <p
            class="provider-status small muted"
            id="sharing"
            role="status"
            hidden>
          </p>

        </div>
      </div>
    </section>
  `;

  const canvas = document.querySelector('#canvas');

  const artImage = document.querySelector('#canvas img');

  const fitCanvas = () => {
    if (artImage.naturalHeight) {
      canvas.style.aspectRatio =
        `${artImage.naturalWidth} / ${artImage.naturalHeight}`;
    }
  };

  if (artImage.complete) {
    fitCanvas();
  } else {
    artImage.addEventListener('load', fitCanvas, {
      once: true
    });
  }

  const intro = document.querySelector('#intro');
  const now = document.querySelector('#now');

  const zoneButtons = [
    ...main.querySelectorAll('[data-list-zone]')
  ];

  let pointer = null;
  let timer = null;

  const audioLabel = (label, state) => {
    if (state === 'playing') {
      return `Reproduciendo: ${label}.`;
    }

    if (state === 'paused') {
      return `En pausa: ${label}.`;
    }

    if (state === 'unavailable') {
      return 'No se pudo reproducir el audio. Puedes consultar la transcripción.';
    }

    return 'Elige una zona para continuar.';
  };

  /* INTRODUCCIÓN */

  const playIntro = () => {
    const key = `intro-${work.id}`;

    if (audioStatus(key) === 'playing') {
      pauseVoice(key);
      return;
    }

    environmentSound(work.sound, work.ambientAudio);
    resumeEnvironment();

    playVoice(
      key,
      work.intro,
      work.introAudio,
      state => {
        intro.innerHTML = `
          ${icon(state === 'playing' ? 'pause' : 'play')}
          ${state === 'playing'
            ? 'Pausar introducción'
            : state === 'paused'
              ? 'Reanudar introducción'
              : 'Escuchar introducción'}
        `;

        now.textContent =
          audioLabel('Introducción', state);

        if (state === 'unavailable') {
          announce(now.textContent);
        }
      }
    );
  };

  intro.onclick = playIntro;

  /* REPRODUCCIÓN DE ZONAS */

  const playZone = (index, toggle = true) => {
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

    playVoice(
      key,
      zone.text,
      zone.audio,
      state => {
        zoneButtons[index].setAttribute(
          'aria-pressed',
          String(state === 'playing')
        );

        zoneButtons[index].innerHTML = `
          <span>
            ${esc(zone.label)}
            <span class="muted small">
              · ${esc(zone.position)}
            </span>
          </span>

          ${icon(state === 'playing' ? 'pause' : 'play')}
        `;

        now.textContent =
          audioLabel(zone.label, state);

        if (state === 'unavailable') {
          announce(now.textContent);
        }
      }
    );
  };

  zoneButtons.forEach((control, index) => {
    control.onclick = () => playZone(index, true);
  });

  /* IDENTIFICACIÓN DE ZONA TÁCTIL */

  function indexAt(event) {
    const rect = canvas.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) / rect.width;

    const y =
      (event.clientY - rect.top) / rect.height;

    return work.zones.findIndex(zone => {
      const [left, top, width, height] = zone.bounds;

      return (
        x >= left &&
        y >= top &&
        x <= left + width &&
        y <= top + height
      );
    });
  }

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

    pointer = {
      id: event.pointerId,
      index: indexAt(event),
      holding: false
    };

    canvas.setPointerCapture(event.pointerId);

    hold();
  };

  canvas.oncontextmenu = event => {
    event.preventDefault();
  };

  canvas.onpointermove = event => {
    if (!pointer || pointer.id !== event.pointerId) {
      return;
    }

    const index = indexAt(event);

    if (index === pointer.index) return;

    const previousIndex = pointer.index;
    const previousZone = work.zones[previousIndex];

    pointer.index = index;

    vibrate();

    if (!pointer.holding) {
      hold();
      return;
    }

    if (index < 0) {
      if (previousZone) {
        pauseVoice(`${work.id}-${previousZone.id}`);
      }

      return;
    }

    playZone(index, false);
  };

  const end = event => {
    if (!pointer || pointer.id !== event.pointerId) {
      return;
    }

    const zone = work.zones[pointer.index];

    if (pointer.holding && zone) {
      pauseVoice(`${work.id}-${zone.id}`);
    }

    pointer = null;

    clearTimeout(timer);
  };

  canvas.onpointerup = end;
  canvas.onpointercancel = end;
  canvas.onlostpointercapture = end;

  cleanup = () => {
    clearTimeout(timer);
    pointer = null;
  };

  /* COMPARTIR */

  document.querySelector('#share').onclick =
    async () => {
      const note = document.querySelector('#sharing');

      try {
        if (navigator.share) {
          await navigator.share({
            title: work.title,
            url: location.href
          });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(
            location.href
          );

          note.hidden = false;
          note.textContent = 'Enlace copiado.';
        } else {
          throw new Error('Compartir no disponible');
        }
      } catch (error) {
        if (error.name === 'AbortError') return;

        note.hidden = false;
        note.textContent =
          `Enlace de la obra: ${location.href}`;
      }
    };

  if (activated && preferences.automatic) {
    playIntro();
  }
}

/* ==========================================
   BÚSQUEDA
   ========================================== */

const normalized = value =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function search() {
  main.innerHTML = `
    <section class="page">

      ${back('inicio', 'Inicio')}

      ${titleBlock(
        'Buscar una obra',
        'Escribe el nombre de una obra o de su artista. También puedes utilizar el micrófono.'
      )}

      <div class="panel stack">

        ${button(
          'Activar micrófono',
          'mic',
          'mic',
          'primary'
        )}

        <form id="search-form" role="search">

          <label class="field">
            <span>Título, artista o categoría</span>

            <input
              type="search"
              id="query"
              value="${esc(query)}"
              placeholder="Por ejemplo, Monet"
              autocomplete="off">
          </label>

        </form>

        <p
          class="provider-status muted"
          id="voice-search-status"
          role="status"
          aria-live="polite">
        </p>

      </div>

      <section
        class="results"
        aria-labelledby="results-heading">

        <h2 id="results-heading">
          Resultados
        </h2>

        <p
          class="muted guidance"
          id="result-count"
          role="status">
        </p>

        <div class="cards" id="results"></div>

      </section>
    </section>
  `;

  const input = document.querySelector('#query');

  const feedback =
    document.querySelector('#voice-search-status');

  const trigger = document.querySelector('#mic');

  const update = () => {
    query = input.value;

    const terms = normalized(query)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const matches = catalog.filter(work =>
      terms.every(term =>
        normalized(
          `${work.title} ${work.artist} ${work.category} ${work.technique}`
        ).includes(term)
      )
    );

    document.querySelector('#result-count').textContent =
      matches.length === 1
        ? '1 obra encontrada.'
        : `${matches.length} obras encontradas.`;

    document.querySelector('#results').innerHTML =
      cards(matches);
  };

  update();

  input.oninput = update;

  document.querySelector('#search-form').onsubmit =
    event => {
      event.preventDefault();
      update();
    };

  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!Recognition) {
    trigger.disabled = true;

    feedback.textContent =
      'Este navegador no admite el micrófono de búsqueda. Puedes escribir o utilizar el dictado del teclado.';

    return;
  }

  const listener = new Recognition();

  listener.lang = 'es-MX';
  listener.interimResults = false;
  listener.maxAlternatives = 1;

  listener.onresult = event => {
    input.value =
      event.results[0][0].transcript.replace(/[.!?]+$/, '');

    feedback.textContent =
      `Se reconoció: ${input.value}`;

    update();
  };

  listener.onerror = () => {
    feedback.textContent =
      'No se completó el dictado. Intenta de nuevo o utiliza el campo de texto.';
  };

  listener.onend = () => {
    trigger.disabled = false;

    if (feedback.textContent === 'Escuchando…') {
      feedback.textContent =
        'No se detectó una frase. Puedes volver a intentarlo.';
    }
  };

  trigger.onclick = () => {
    try {
      listener.start();

      trigger.disabled = true;

      feedback.textContent = 'Escuchando…';
    } catch {
      feedback.textContent =
        'No se pudo iniciar el micrófono.';
    }
  };

  cleanup = () => {
    listener.abort();
  };
}

/* ==========================================
   AJUSTES
   ========================================== */

function settings() {
  main.innerHTML = `
    <section class="page">

      ${back('inicio', 'Inicio')}

      ${titleBlock(
        'Ajustes',
        'Personaliza la narración, el ambiente y la accesibilidad de la galería.'
      )}

      <div class="stack">

        <section class="panel stack">

          <h2>Narración y ambiente</h2>

          <label class="field">
            <span>
              Velocidad de narración
              <output id="rate-value"></output>
            </span>

            <input
              id="rate"
              type="range"
              min=".65"
              max="1.55"
              step=".05"
              value="${preferences.rate}">
          </label>

          <label class="field">
            <span>
              Volumen ambiental y efectos
              <output id="volume-value"></output>
            </span>

            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step=".05"
              value="${preferences.volume}">
          </label>

          <label class="check">
            <input
              id="automatic"
              type="checkbox"
              ${preferences.automatic ? 'checked' : ''}>

            Reproducir fichas e introducciones automáticamente
          </label>

          ${button(
            'Probar narración y ambiente',
            'test-audio',
            'play'
          )}

        </section>

        <section class="panel stack">

          <h2>Pantalla y tacto</h2>

          <label class="field">
            <span>Intensidad de vibración</span>

            <select id="haptic">
              ${[
                'Desactivada',
                'Suave',
                'Intensa'
              ].map((label, index) => `
                <option
                  value="${index}"
                  ${preferences.haptic === index ? 'selected' : ''}>
                  ${label}
                </option>
              `).join('')}
            </select>
          </label>

          <p class="muted small">
            La vibración requiere un navegador y un dispositivo compatibles.
          </p>

          <label class="check">
            <input
              id="contrast"
              type="checkbox"
              ${preferences.contrast ? 'checked' : ''}>

            Alto contraste
          </label>

          <label class="check">
            <input
              id="large"
              type="checkbox"
              ${preferences.large ? 'checked' : ''}>

            Texto grande
          </label>

        </section>

        ${services.cloud
          ? `<section class="panel stack">
              <h2>Cuenta</h2>
              <a class="button" href="#cuenta">
                Cuenta y sincronización
              </a>
            </section>`
          : ''}

      </div>
    </section>
  `;

  const outputs = () => {
    document.querySelector('#rate-value').textContent =
      `${Number(preferences.rate.toFixed(2)).toLocaleString('es-MX')} ×`;

    document.querySelector('#volume-value').textContent =
      `${Math.round(preferences.volume * 100)}%`;
  };

  outputs();

  [
    'rate',
    'volume',
    'haptic',
    'contrast',
    'large',
    'automatic'
  ].forEach(key => {
    const field = document.getElementById(key);

    field.addEventListener('input', () => {
      setPreferences({
        ...preferences,
        [key]: field.type === 'checkbox'
          ? field.checked
          : Number(field.value)
      });

      savePreferences();

      outputs();

      if (key === 'haptic') vibrate();

      if (key === 'volume') resumeEnvironment();
    });
  });

  const control = document.querySelector('#test-audio');

  control.onclick = () => {
    if (audioStatus('prueba') === 'playing') {
      environmentSound('');
      pauseVoice('prueba');
      return;
    }

    environmentSound('mar');

    playVoice(
      'prueba',
      welcome,
      '/media/bienvenida.wav',
      state => {
        control.innerHTML = `
          ${icon(state === 'playing' ? 'pause' : 'play')}
          ${state === 'playing'
            ? 'Pausar prueba de audio'
            : 'Probar narración y ambiente'}
        `;

        if (state !== 'playing') {
          environmentSound('');
        }
      }
    );
  };
}

/* ==========================================
   RUTAS Y NAVEGACIÓN
   ========================================== */

function render({
  focus = false,
  gesture = false
} = {}) {
  cleanup();
  cleanup = () => {};

  refreshGallery = () => {};

  stopVoice();
  environmentSound('');

  announce('');

  const route = hash();

  activeRoute = route;

  const [section, identifier] = route.split('/');

  const work = section === 'obra'
    ? catalog.find(entry =>
        encodeURIComponent(entry.id) === identifier
      )
    : null;

  document.querySelectorAll('[data-nav]').forEach(item => {
    if (
      section === item.dataset.nav ||
      (
        section === 'obra' &&
        item.dataset.nav === 'galeria'
      )
    ) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  if (section === 'inicio') {
    home();
  }

  else if (section === 'tutorial') {
    tutorial();
  }

  else if (section === 'galeria') {
    gallery();

    if (gesture && preferences.automatic) {
      previewCatalog();
    }
  }

  else if (section === 'obra' && work) {
    openWork(work, gesture);
  }

  else if (section === 'buscar') {
    search();
  }

  else if (section === 'ajustes') {
    settings();
  }

  else if (section === 'cuenta' && services.cloud) {
    cleanup = mountAccount(main, {
      preferences: () => ({ ...preferences }),

      setPreferences: data => {
        setPreferences(data);
        savePreferences();
      }
    });
  }

  else if (section === 'curaduria' && services.cloud) {
    cleanup = mountCurator(main, newWork => {
      if (!catalog.some(item => item.id === newWork.id)) {
        catalog.push(newWork);
      }
    });
  }

  else if (
    section === 'obra' &&
    /^[a-f0-9-]{36}$/i.test(identifier) &&
    services.cloud
  ) {
    main.innerHTML = `
      <section class="page">
        ${back('galeria', 'Galería')}
        ${titleBlock('Cargando obra')}
      </section>
    `;

    fetch(`/api/works/${encodeURIComponent(identifier)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Obra no disponible');
        }

        return response.json();
      })
      .then(({ work: newWork }) => {
        if (!catalog.some(item => item.id === newWork.id)) {
          catalog.push(newWork);
        }

        if (activeRoute === route) {
          render({ focus: true });
        }
      })
      .catch(() => {
        if (activeRoute !== route) return;

        main.innerHTML = `
          <section class="page">
            ${back('galeria', 'Galería')}
            ${titleBlock(
              'Obra no disponible',
              'Puedes volver a la galería o comprobar tu conexión.'
            )}
          </section>
        `;

        main.querySelector('h1')?.focus();

        document.title =
          'Obra no disponible · Arte al oído';
      });
  }

  else {
    main.innerHTML = `
      <section class="page">
        ${back('galeria', 'Galería')}
        ${titleBlock(
          'Contenido no disponible',
          'Puedes volver a la galería para continuar explorando.'
        )}
      </section>
    `;
  }

  if (focus) {
    window.scrollTo(0, 0);
    main.querySelector('h1')?.focus();
  }

  document.title =
    section === 'inicio'
      ? 'Arte al oído'
      : `${main.querySelector('h1')?.textContent ?? ''} · Arte al oído`;
}

/* ==========================================
   EVENTOS DE NAVEGACIÓN
   ========================================== */

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');

  if (
    !link ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }

  event.preventDefault();

  const href = link.getAttribute('href');

  if (href === '#contenido') {
    main.focus();
    return;
  }

  if (location.hash !== href) {
    history.pushState(null, '', href);
  }

  if (hash() !== activeRoute) {
    render({
      focus: true,
      gesture: true
    });
  }
});

window.addEventListener('popstate', () => {
  if (hash() !== activeRoute) {
    render({ focus: true });
  }
});

window.addEventListener('hashchange', () => {
  if (hash() !== activeRoute) {
    render({ focus: true });
  }
});

/* ==========================================
   CONTROL DE AUDIO AL CAMBIAR DE PANTALLA
   ========================================== */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopVoice();
    environmentSound('');
  }
});

/* ==========================================
   CARGA DEL CATÁLOGO
   ========================================== */

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog');

    if (!response.ok) return;

    const data = await response.json();

    catalog = [
      ...demo,
      ...(Array.isArray(data.works) ? data.works : [])
    ];

    selected = Math.min(
      selected,
      catalog.length - 1
    );

  } catch {
    // El catálogo de demostración sigue disponible.
  }
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

render();

Promise.allSettled([
  fetch('/api/config')
    .then(response => response.json())
    .then(data => {
      services = data;
      session.configure(data);
    }),

  loadCatalog()
]).then(() => {
  if (
    ['cuenta', 'curaduria'].includes(activeRoute) ||
    (
      activeRoute?.startsWith('obra/') &&
      !main.querySelector('#canvas')
    )
  ) {
    render();
  }

  else if (activeRoute === 'inicio') {
    const cardsContainer =
      document.querySelector('#home-cards');

    if (cardsContainer) {
      cardsContainer.innerHTML =
        cards(catalog.slice(0, 3));
    }
  }

  else if (activeRoute === 'galeria') {
    refreshGallery();
  }

  else if (
    activeRoute === 'ajustes' &&
    services.cloud
  ) {
    render();
  }
});

/* ==========================================
   SERVICE WORKER
   ========================================== */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch(() => {});
}
