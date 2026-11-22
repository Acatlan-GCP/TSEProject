
const voice = document.querySelector('#voice');
const ambience = document.querySelector('#ambience');
const effect = document.querySelector('#effect');

const synth = window.speechSynthesis;

let current = null;
let settings = {
  rate: 1,
  volume: 0.25,
  haptic: 1
};

let environment = '';
let environmentURL = '';
let enabled = false;

let mixer = null;
let ambientGain = null;
let effectGain = null;

let availableVoices = [];

if (synth) {
  availableVoices = synth.getVoices();

  synth.addEventListener('voiceschanged', () => {
    availableVoices = synth.getVoices();
  });
}

/* ==========================================
   SELECCIÓN DE VOZ
   ========================================== */

function selectSpanishVoice() {
  if (!availableVoices.length) return null;

  const spanishVoices = availableVoices.filter(voice =>
    voice.lang.toLowerCase().startsWith('es')
  );

  if (!spanishVoices.length) return null;

  // Preferir voces en español de México.
  const mexicanVoice = spanishVoices.find(voice =>
    voice.lang.toLowerCase() === 'es-mx'
  );

  if (mexicanVoice) return mexicanVoice;

  // Si no existe, utilizar otra voz en español.
  const defaultVoice = spanishVoices.find(voice =>
    voice.default
  );

  return defaultVoice || spanishVoices[0];
}

/* ==========================================
   MEZCLA DE AUDIO
   ========================================== */

function applyMix() {
  if (mixer && ambientGain && effectGain) {
    ambientGain.gain.setTargetAtTime(
      settings.volume,
      mixer.currentTime,
      0.05
    );

    effectGain.gain.setTargetAtTime(
      settings.volume * 0.5,
      mixer.currentTime,
      0.05
    );
  } else {
    ambience.volume = settings.volume;
    effect.volume = settings.volume * 0.5;
  }
}

function prepareMix() {
  const Context = window.AudioContext || window.webkitAudioContext;

  if (!Context || mixer) {
    if (mixer && mixer.state !== 'running') {
      mixer.resume().catch(() => {});
    }

    return;
  }

  try {
    mixer = new Context();

    ambientGain = mixer.createGain();
    effectGain = mixer.createGain();

    ambientGain.gain.value = settings.volume;
    effectGain.gain.value = settings.volume * 0.5;

    const ambientSource = mixer.createMediaElementSource(ambience);
    const effectSource = mixer.createMediaElementSource(effect);

    ambientSource.connect(ambientGain);
    effectSource.connect(effectGain);

    ambientGain.connect(mixer.destination);
    effectGain.connect(mixer.destination);

    ambience.volume = 1;
    effect.volume = 1;

    mixer.resume().catch(() => {});
  } catch (error) {
    mixer = null;
    ambientGain = null;
    effectGain = null;

    ambience.volume = settings.volume;
    effect.volume = settings.volume * 0.5;
  }
}

/* ==========================================
   CONFIGURACIÓN
   ========================================== */

export function updateAudio(preferences) {
  settings = {
    rate: Number(preferences.rate ?? 1),
    volume: Number(preferences.volume ?? 0.25),
    haptic: Number(preferences.haptic ?? 1)
  };

  if (voice) {
    voice.playbackRate = settings.rate;
  }

  applyMix();
}

export function audioStatus(key) {
  return current?.key === key
    ? current.state
    : 'stopped';
}

/* ==========================================
   ESTADO DE REPRODUCCIÓN
   ========================================== */

function change(track, state) {
  if (current !== track) return;

  track.state = state;

  if (typeof track.onState === 'function') {
    track.onState(state);
  }
}

export function stopVoice() {
  const previous = current;

  current = null;

  voice.pause();
  voice.removeAttribute('src');
  voice.load();

  if (synth && (synth.speaking || synth.paused)) {
    synth.cancel();
  }

  if (previous?.onState) {
    previous.onState('stopped');
  }
}

/* ==========================================
   NARRACIÓN CON SÍNTESIS DE VOZ
   ========================================== */

function speak(track) {
  if (current !== track || track.state !== 'playing') {
    return;
  }

  if (!synth || !window.SpeechSynthesisUtterance) {
    change(track, 'unavailable');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(track.text);

  utterance.lang = 'es-MX';

  // Configuración de narración natural.
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const selectedVoice = selectSpanishVoice();

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.onend = () => {
    change(track, 'stopped');
  };

  utterance.onerror = event => {
    if (
      event.error !== 'canceled' &&
      event.error !== 'interrupted'
    ) {
      change(track, 'unavailable');
    }
  };

  track.utterance = utterance;

  synth.speak(utterance);
}

/* ==========================================
   PAUSAR Y REANUDAR
   ========================================== */

export function pauseVoice(key) {
  if (!current || current.key !== key) return;

  if (current.state !== 'playing') return;

  voice.pause();

  if (current.utterance && synth) {
    synth.pause();
  }

  change(current, 'paused');
}

export function playVoice(key, text, source, onState) {
  if (
    current?.key === key &&
    current.state === 'paused'
  ) {
    const track = current;

    change(track, 'playing');

    if (track.utterance && synth) {
      synth.resume();
    } else {
      voice.play().catch(() => {
        speak(track);
      });
    }

    return;
  }

  stopVoice();

  const track = {
    key,
    text,
    source,
    onState,
    state: 'playing',
    utterance: null
  };

  current = track;

  change(track, 'playing');

  if (!source) {
    speak(track);
    return;
  }

  voice.src = source;
  voice.playbackRate = settings.rate;

  voice.onended = () => {
    change(track, 'stopped');
  };

  voice.onerror = () => {
    if (current === track) {
      speak(track);
    }
  };

  voice.play().catch(() => {
    if (current === track) {
      speak(track);
    }
  });
}

/* ==========================================
   MÚSICA AMBIENTAL
   ========================================== */

export function environmentSound(name, source) {
  const target = name || '';

  const nextURL = target
    ? source || `/media/amb-${target}.wav`
    : '';

  if (
    environment === target &&
    environmentURL === nextURL
  ) {
    return;
  }

  environment = target;
  environmentURL = nextURL;
  enabled = Boolean(target);

  ambience.pause();
  effect.pause();

  if (!enabled) {
    ambience.removeAttribute('src');
    ambience.load();
    return;
  }

  prepareMix();

  ambience.crossOrigin = 'anonymous';

  const fallback = `/media/amb-${target}.wav`;

  ambience.onerror = () => {
    if (
      !enabled ||
      environmentURL !== nextURL ||
      ambience.getAttribute('src') === fallback
    ) {
      return;
    }

    ambience.src = fallback;

    if (settings.volume > 0) {
      ambience.play().catch(() => {});
    }
  };

  ambience.src = nextURL;

  if (settings.volume > 0) {
    ambience.play().catch(() => {});
  }
}

export function resumeEnvironment() {
  if (!enabled || !settings.volume) return;

  prepareMix();

  if (ambience.paused) {
    ambience.play().catch(() => {});
  }
}

/* ==========================================
   EFECTOS SONOROS
   ========================================== */

export function zoneEffect(index) {
  if (!enabled || !settings.volume) return;

  effect.src = `/media/amb-${environment}-${index % 4}.wav`;

  effect.play().catch(() => {});
}

/* ==========================================
   VIBRACIÓN
   ========================================== */

export function vibrate() {
  if (!settings.haptic || !navigator.vibrate) return;

  navigator.vibrate(
    settings.haptic === 1 ? 18 : 42
  );
}
