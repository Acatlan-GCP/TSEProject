import { works as demo, welcome } from './works.js';
import { audioStatus, environmentSound, pauseVoice, playVoice, resumeEnvironment, stopVoice, updateAudio, vibrate, zoneEffect } from './player.js';
import { mountAccount, mountCurator, session } from './account.js';

const glyphs = {
  wave: '<path d="M3 12h2l2-5 3 10 3-14 3 17 2-8h3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-3 0h6"/>',
  settings: '<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  headphones: '<path d="M3 14v-3a9 9 0 1 1 18 0v3"/><rect x="3" y="12" width="5" height="8" rx="2"/><rect x="16" y="12" width="5" height="8" rx="2"/>',
  play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="3"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'
};

export const icon = name => `<svg aria-hidden="true" focusable="false" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${glyphs[name]}</svg>`;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const esc = escapeHTML;

const main = document.querySelector('main');
const status = document.querySelector('#route-status');
const defaults = { rate: 1, volume: .25, haptic: 1, contrast: false, large: false, automatic: true };
const safeNumber = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(max, Math.max(min, value)) : fallback;
let preferences = { ...defaults };
let catalog = [...demo];
let selected = 0;
let services = { cloud: false };
let cleanup = () => {};
let refreshGallery = () => {};
let query = '';
let activeRoute;

try { setPreferences(JSON.parse(localStorage.getItem('arte-preferences'))); } catch { setPreferences(); }
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

function setPreferences(values = {}) {
  const input = values ?? {};
  preferences = {
    rate: safeNumber(input.rate, 1, .65, 1.55), volume: safeNumber(input.volume, .25, 0, 1),
    haptic: Math.round(safeNumber(input.haptic, 1, 0, 2)),
    contrast: input.contrast === true, large: input.large === true, automatic: input.automatic !== false
  };
  document.body.classList.toggle('contrast', preferences.contrast);
  document.body.classList.toggle('large', preferences.large);
  updateAudio(preferences);
}

function savePreferences() {
  try { localStorage.setItem('arte-preferences', JSON.stringify(preferences)); } catch {}
}

function announce(text) { status.textContent = text; }
function hash() { return location.hash.slice(1) || 'inicio'; }
const workLink = work => `#obra/${encodeURIComponent(work.id)}`;
const trackText = work => `${work.title}, de ${work.artist}. ${work.summary}`;
const titleBlock = (title, description) => `<div class="page-heading"><h1 tabindex="-1">${esc(title)}</h1>${description ? `<p class="muted">${esc(description)}</p>` : ''}</div>`;
const back = (where, label) => `<a class="breadcrumbs" href="#${where}">${label}</a>`;
const button = (label, id, glyph, kind = '') => `<button type="button" class="button ${kind}" id="${id}">${glyph ? icon(glyph) : ''}${label}</button>`;
const image = (work, options = '') => `<img alt="" src="${esc(work.image)}" ${options}>`;
const cards = (list, active) => list.map(work => `<article class="card${active === work.id ? ' current' : ''}">
  <a class="card-link" href="${workLink(work)}"><span class="card-art">${image(work, 'loading="lazy"')}</span>
    <span class="card-body"><span><span class="card-title">${esc(work.title)}</span><span class="card-meta">${esc(work.artist)} · ${esc(work.year)}</span></span>
      <span class="card-play">${icon('play')}</span></span></a></article>`).join('');

function home() {
  const work = demo[0];
  main.innerHTML = `<section class="hero">
    <div class="hero-copy"><div class="eyebrow">${icon('headphones')} Galería táctil y sonora</div>
      <h1 tabindex="-1">El arte también<br>se <em>escucha .</em></h1>
      <p>Explora obras de arte a través del tacto, la narración y el sonido.</p>
      <div class="hero-actions">
        <a class="button primary" href="#galeria">${icon('grid')} Explorar galería</a>
        <a class="button" href="#buscar">${icon('mic')} Búsqueda por voz</a>
        <a class="button" href="#ajustes">${icon('settings')} Ajustes de audio</a>
        ${button('Escuchar bienvenida', 'welcome', 'play', 'plain welcome')}
      </div>
    </div>
    <figure class="hero-art" style="margin:0">${image(work, 'fetchpriority="high"')}<figcaption class="hero-caption">
      <span class="art-icon">${icon('wave')}</span><span><strong>${esc(work.title)}</strong><span class="caption-meta">${esc(work.artist)} · ${esc(work.technique)}</span></span>
    </figcaption></figure>
  </section>
  <section class="collection" aria-labelledby="collection-title"><div class="section-heading">
    <div><h2 id="collection-title">Obras para escuchar</h2><p class="muted">Elige una pieza para explorar sus zonas.</p></div></div>
    <div class="cards" id="home-cards">${cards(catalog.slice(0, 3))}</div></section>`;
  const control = document.querySelector('#welcome');
  control.onclick = () => {
    if (audioStatus('bienvenida') === 'playing') return pauseVoice('bienvenida');
    playVoice('bienvenida', welcome, '/media/bienvenida.wav', state => {
      control.innerHTML = `${icon(state === 'playing' ? 'pause' : 'play')} ${state === 'playing' ? 'Pausar bienvenida' : 'Escuchar bienvenida'}`;
      if (state === 'unavailable') announce(welcome);
    });
  };
}

function previewCatalog() {
  const work = catalog[selected];
  if (!work) return;
  const control = document.querySelector('#summary');
  const caption = document.querySelector('#catalog-status');
  playVoice(`ficha-${work.id}`, trackText(work), work.summaryAudio, state => {
    if (control) control.textContent = state === 'playing' ? 'Pausar ficha' : 'Escuchar ficha';
    if (state === 'unavailable' && caption) caption.textContent = trackText(work);
  });
}

function gallery() {
  main.innerHTML = `<section class="page">${back('inicio', 'Inicio')}${titleBlock('Galería', 'Desliza hacia arriba o abajo en la ficha para recorrer las obras. También puedes usar los botones Anterior y Siguiente.')}
    <div class="catalog-focus" id="catalog-focus">
      <div id="current-work"></div>
      <div class="catalog-controls">
        ${button('Anterior', 'previous')}${button('Escuchar ficha', 'summary', 'play')}${button('Siguiente', 'next')}
      </div>
      <p class="sr-only" id="catalog-status" role="status"></p>
    </div>
    <div class="cards" id="catalog-cards"></div></section>`;
  const pointerTarget = document.querySelector('#catalog-focus');
  const caption = document.querySelector('#catalog-status');
  let start;
  const sync = () => {
    const work = catalog[selected];
    document.querySelector('#current-work').innerHTML = `<p class="muted small">${selected + 1} de ${catalog.length} · ${esc(work.category)}</p>
      <h2><a href="${workLink(work)}">${esc(work.title)}</a></h2>
      <p class="muted">${esc(work.artist)} · ${esc(work.year)}</p><p>${esc(work.summary)}</p>`;
    document.querySelector('#catalog-cards').innerHTML = cards(catalog, work.id);
  };
  refreshGallery = sync;
  sync();
  const step = delta => {
    stopVoice();
    selected = (selected + delta + catalog.length) % catalog.length;
    sync();
    if (preferences.automatic) previewCatalog();
    else caption.textContent = `${selected + 1} de ${catalog.length}. ${trackText(catalog[selected])}`;
  };
  document.querySelector('#previous').onclick = () => step(-1);
  document.querySelector('#next').onclick = () => step(1);
  document.querySelector('#summary').onclick = () => {
    const key = `ficha-${catalog[selected].id}`;
    if (audioStatus(key) === 'playing') pauseVoice(key);
    else previewCatalog();
  };
  pointerTarget.onpointerdown = event => {
    if (event.pointerType !== 'touch' || event.target.closest('a,button')) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    pointerTarget.setPointerCapture(event.pointerId);
  };
  pointerTarget.onpointerup = event => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) step(dy < 0 ? 1 : -1);
  };
  pointerTarget.onpointercancel = () => { start = null; };
}

function openWork(work, activated) {
  const description = `${work.artist} · ${work.year} · ${work.technique}`;
  main.innerHTML = `<section class="page">${back('galeria', 'Galería')}${titleBlock(work.title, description)}
    <div class="work-grid">
      <div>
        <div class="canvas" id="canvas" aria-hidden="true">${image(work, 'draggable="false"')}
          ${work.zones.map((zone, index) => {
            const [left, top, width, height] = zone.bounds;
            return `<span class="canvas-zone" data-zone="${index}" style="left:${left * 100}%;top:${top * 100}%;width:${width * 100}%;height:${height * 100}%"></span>`;
          }).join('')}</div>
        <p class="guidance muted" id="zone-help">Mantén presionado el lienzo para escuchar una zona. Desliza sin levantar el dedo para cambiar de zona. Al soltar, la narración se pausa. Los botones también reproducen cada zona.</p>
      </div>
      <div class="panel">
        <div class="row work-actions">
          ${button('Escuchar introducción', 'intro', 'play', 'primary')}
          ${button('Compartir', 'share', 'share')}
        </div>
        <p class="now" id="now">Explora el lienzo o elige una zona.</p>
        <h2 id="zone-heading">Zonas de la obra</h2>
        <div class="zone-list" role="group" aria-labelledby="zone-heading" aria-describedby="zone-help">
          ${work.zones.map((zone, index) => `<button type="button" class="button" aria-pressed="false" data-list-zone="${index}"><span>${esc(zone.label)} <span class="muted small">· ${esc(zone.position)}</span></span>${icon('play')}</button>`).join('')}
        </div>
        <details class="transcript"><summary>Transcripción y créditos</summary><p>${esc(work.intro)}</p>
          ${work.zones.map(zone => `<p><strong>${esc(zone.label)}</strong> · ${esc(zone.text)}</p>`).join('')}
          ${work.source ? `<p><a href="${esc(work.source)}">Ver ficha de la obra</a></p>` : ''}</details>
        <p class="provider-status small muted" id="sharing" role="status" hidden></p>
      </div>
    </div>
  </section>`;

  const canvas = document.querySelector('#canvas');
  const artImage = canvas.querySelector('img');
  const fitCanvas = () => {
    if (artImage.naturalHeight) canvas.style.aspectRatio = `${artImage.naturalWidth} / ${artImage.naturalHeight}`;
  };
  if (artImage.complete) fitCanvas();
  else artImage.addEventListener('load', fitCanvas, { once: true });
  const intro = document.querySelector('#intro');
  const now = document.querySelector('#now');
  const zoneButtons = [...main.querySelectorAll('[data-list-zone]')];
  const marks = [...main.querySelectorAll('.canvas-zone')];
  let pointer;
  let timer;
  const audioLabel = (label, state) => state === 'playing' ? `Reproduciendo · ${label}`
    : state === 'paused' ? `En pausa · ${label}` : state === 'unavailable' ? 'No se pudo reproducir. Puedes abrir la transcripción.' : 'Elige una zona para continuar.';

  const playIntro = () => {
    const key = `intro-${work.id}`;
    if (audioStatus(key) === 'playing') return pauseVoice(key);
    environmentSound(work.sound, work.ambientAudio);
    resumeEnvironment();
    playVoice(key, work.intro, work.introAudio, state => {
      intro.innerHTML = `${icon(state === 'playing' ? 'pause' : 'play')} ${state === 'playing' ? 'Pausar introducción' : state === 'paused' ? 'Reanudar introducción' : 'Escuchar introducción'}`;
      now.textContent = audioLabel('Introducción', state);
      if (state === 'unavailable') announce(now.textContent);
    });
  };
  intro.onclick = playIntro;

  const playZone = (index, toggle) => {
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
      zoneButtons[index].lastElementChild.outerHTML = icon(state === 'playing' ? 'pause' : 'play');
      marks[index].classList.toggle('active', state === 'playing');
      now.textContent = audioLabel(zone.label, state);
      if (state === 'unavailable') announce(now.textContent);
    });
  };
  zoneButtons.forEach((control, index) => { control.onclick = () => playZone(index, true); });

  function indexAt(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return work.zones.findIndex(({ bounds: [left, top, width, height] }) =>
      x >= left && y >= top && x <= left + width && y <= top + height);
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
  cleanup = () => clearTimeout(timer);

  document.querySelector('#share').onclick = async () => {
    const note = document.querySelector('#sharing');
    try {
      if (navigator.share) await navigator.share({ title: work.title, url: location.href });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(location.href);
        note.hidden = false;
        note.textContent = 'Enlace copiado.';
      } else throw new Error();
    } catch (error) {
      if (error.name === 'AbortError') return;
      note.hidden = false;
      note.textContent = `Enlace de la obra: ${location.href}`;
    }
  };
  if (activated && preferences.automatic) playIntro();
}

const normalized = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
function search() {
  main.innerHTML = `<section class="page">${back('inicio', 'Inicio')}${titleBlock('Buscar una obra', 'Di el nombre de una obra o de su artista. También puedes escribirlo.')}
    <div class="panel stack">
      ${button('Activar micrófono', 'mic', 'mic', 'primary')}
      <form id="search-form" role="search"><label class="field"><span>Título, artista o categoría</span>
        <input type="search" id="query" value="${esc(query)}" placeholder="Por ejemplo, Monet" autocomplete="off"></label></form>
      <p class="provider-status muted" id="voice-search-status" role="status"></p>
    </div>
    <section class="results" aria-labelledby="results-heading"><h2 id="results-heading">Resultados</h2>
      <p class="muted guidance" id="result-count" role="status"></p><div class="cards" id="results"></div></section></section>`;
  const input = document.querySelector('#query');
  const feedback = document.querySelector('#voice-search-status');
  const trigger = document.querySelector('#mic');
  const update = () => {
    query = input.value;
    const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
    const matches = catalog.filter(work => terms.every(term => normalized(`${work.title} ${work.artist} ${work.category} ${work.technique}`).includes(term)));
    document.querySelector('#result-count').textContent = matches.length === 1 ? '1 obra' : `${matches.length} obras`;
    document.querySelector('#results').innerHTML = cards(matches);
  };
  update();
  input.oninput = update;
  document.querySelector('#search-form').onsubmit = event => { event.preventDefault(); update(); };
  const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!recognition) {
    trigger.disabled = true;
    feedback.textContent = 'Este navegador no admite el micrófono de búsqueda. Puedes escribir o usar el dictado de tu teclado.';
    return;
  }
  const listener = new recognition();
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
  cleanup = () => { listener.abort(); };
}

function settings() {
  main.innerHTML = `<section class="page">${back('inicio', 'Inicio')}${titleBlock('Ajustes de audio', 'Personaliza cómo se escucha y se muestra la galería.')}
    <div class="stack">
      <section class="panel stack"><h2>Narración y ambiente</h2>
        <label class="field"><span>Velocidad de narración <output id="rate-value"></output></span><input id="rate" type="range" min=".65" max="1.55" step=".05" value="${preferences.rate}"></label>
        <label class="field"><span>Volumen del ambiente y efectos <output id="volume-value"></output></span><input id="volume" type="range" min="0" max="1" step=".05" value="${preferences.volume}"></label>
        <label class="check"><input id="automatic" type="checkbox" ${preferences.automatic ? 'checked' : ''}> Reproducir fichas e introducciones al navegar</label>
        ${button('Probar narración y ambiente', 'test-audio', 'play')}
      </section>
      <section class="panel stack"><h2>Pantalla y tacto</h2>
        <label class="field"><span>Intensidad de vibración</span><select id="haptic">
          ${['Desactivada', 'Suave', 'Intensa'].map((label, i) => `<option value="${i}" ${preferences.haptic === i ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <p class="muted small">La vibración requiere un navegador y un dispositivo compatibles.</p>
        <label class="check"><input id="contrast" type="checkbox" ${preferences.contrast ? 'checked' : ''}> Alto contraste</label>
        <label class="check"><input id="large" type="checkbox" ${preferences.large ? 'checked' : ''}> Texto grande</label>
      </section>
      ${services.cloud ? '<section class="panel stack"><h2>Cuenta</h2><a class="button" href="#cuenta">Cuenta y sincronización</a></section>' : ''}
    </div>
  </section>`;
  const outputs = () => {
    document.querySelector('#rate-value').textContent = `${Number(preferences.rate.toFixed(2)).toLocaleString('es-MX')} ×`;
    document.querySelector('#volume-value').textContent = `${Math.round(preferences.volume * 100)}%`;
  };
  outputs();
  ['rate', 'volume', 'haptic', 'contrast', 'large', 'automatic'].forEach(key => {
    const field = document.getElementById(key);
    field.addEventListener('input', () => {
      setPreferences({ ...preferences, [key]: field.type === 'checkbox' ? field.checked : Number(field.value) });
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
    playVoice('prueba', welcome, '/media/bienvenida.wav', state => {
      control.innerHTML = `${icon(state === 'playing' ? 'pause' : 'play')} ${state === 'playing' ? 'Pausar prueba de audio' : 'Probar narración y ambiente'}`;
      if (state !== 'playing') environmentSound('');
    });
  };
}

function render({ focus = false, gesture = false } = {}) {
  cleanup();
  cleanup = () => {};
  refreshGallery = () => {};
  stopVoice();
  environmentSound('');
  announce('');
  const route = hash();
  activeRoute = route;
  const [section, identifier] = route.split('/');
  const work = section === 'obra' && catalog.find(entry => encodeURIComponent(entry.id) === identifier);
  for (const item of document.querySelectorAll('[data-nav]')) {
    if (section === item.dataset.nav || section === 'obra' && item.dataset.nav === 'galeria') item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  if (section === 'inicio') home();
  else if (section === 'galeria') {
    gallery();
    if (gesture && preferences.automatic) previewCatalog();
  } else if (section === 'obra' && work) openWork(work, gesture);
  else if (section === 'buscar') search();
  else if (section === 'ajustes') settings();
  else if (section === 'cuenta' && services.cloud) {
    cleanup = mountAccount(main, { preferences: () => ({ ...preferences }), setPreferences: data => {
      setPreferences(data);
      savePreferences();
    }});
  } else if (section === 'curaduria' && services.cloud) {
    cleanup = mountCurator(main, work => {
      if (!catalog.some(item => item.id === work.id)) catalog.push(work);
    });
  } else if (section === 'obra' && /^[a-f0-9-]{36}$/.test(identifier) && services.cloud) {
    main.innerHTML = `<section class="page">${back('galeria', 'Galería')}${titleBlock('Cargando obra')}</section>`;
    fetch(`/api/works/${identifier}`).then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(({ work: newWork }) => {
      if (!catalog.some(item => item.id === newWork.id)) catalog.push(newWork);
      if (activeRoute === route) render({ focus: true });
    }).catch(() => {
      if (activeRoute !== route) return;
      main.innerHTML = `<section class="page">${back('galeria', 'Galería')}${titleBlock('Obra no disponible', 'Puedes volver a la galería o comprobar tu conexión.')}</section>`;
      main.querySelector('h1').focus();
      document.title = 'Obra no disponible · Arte al oído';
    });
  } else {
    main.innerHTML = `<section class="page">${back('galeria', 'Galería')}${titleBlock('Obra no disponible', 'Puedes volver a la galería o comprobar tu conexión.')}</section>`;
  }
  if (focus) {
    window.scrollTo(0, 0);
    main.querySelector('h1')?.focus();
  }
  document.title = section === 'inicio' ? 'Arte al oído' : `${main.querySelector('h1')?.textContent ?? ''} · Arte al oído`;
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  const href = link.getAttribute('href');
  if (href === '#contenido') return main.focus();
  if (location.hash !== href) history.pushState(null, '', href);
  if (hash() !== activeRoute) render({ focus: true, gesture: true });
});
window.addEventListener('popstate', () => { if (hash() !== activeRoute) render({ focus: true }); });
window.addEventListener('hashchange', () => { if (hash() !== activeRoute) render({ focus: true }); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopVoice();
    environmentSound('');
  }
});

async function loadCatalog() {
  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) return;
    const data = await response.json();
    catalog = [...demo, ...data.works];
    selected = Math.min(selected, catalog.length - 1);
  } catch {}
}
render();
Promise.allSettled([
  fetch('/api/config').then(response => response.json()).then(data => {
    services = data;
    session.configure(data);
  }),
  loadCatalog()
]).then(() => {
  if (['cuenta', 'curaduria'].includes(activeRoute) || activeRoute?.startsWith('obra/') && !main.querySelector('#canvas')) render();
  else if (activeRoute === 'inicio') document.querySelector('#home-cards').innerHTML = cards(catalog.slice(0, 3));
  else if (activeRoute === 'galeria') refreshGallery();
  else if (activeRoute === 'ajustes' && services.cloud) render();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
