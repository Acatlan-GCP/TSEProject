const voice = document.querySelector('#voice');
const ambience = document.querySelector('#ambience');
const effect = document.querySelector('#effect');
const synth = window.speechSynthesis;
let current;
let settings;
let environment = '';
let environmentURL = '';
let enabled = false;
let mixer;
let ambientGain;
let effectGain;

function applyMix() {
  if (mixer) {
    ambientGain.gain.setTargetAtTime(settings.volume, mixer.currentTime, .025);
    effectGain.gain.setTargetAtTime(settings.volume * .6, mixer.currentTime, .025);
  } else {
    ambience.volume = settings.volume;
    effect.volume = settings.volume * .6;
  }
}

function prepareMix() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (Context && !mixer) {
    try {
      const context = new Context();
      ambientGain = context.createGain();
      effectGain = context.createGain();
      ambientGain.gain.value = settings.volume;
      effectGain.gain.value = settings.volume * .6;
      context.createMediaElementSource(ambience).connect(ambientGain).connect(context.destination);
      context.createMediaElementSource(effect).connect(effectGain).connect(context.destination);
      ambience.volume = 1;
      effect.volume = 1;
      mixer = context;
    } catch {}
  }
  if (mixer && mixer.state !== 'running') mixer.resume().catch(() => {});
}

export function updateAudio(preferences) {
  settings = preferences;
  voice.playbackRate = preferences.rate;
  applyMix();
}

export function audioStatus(key) {
  return current?.key === key ? current.state : 'stopped';
}

function change(track, state) {
  if (current !== track) return;
  track.state = state;
  track.onState?.(state);
}

export function stopVoice() {
  const previous = current;
  current = null;
  voice.pause();
  if (synth?.speaking || synth?.paused) synth.cancel();
  previous?.onState?.('stopped');
}

function speak(track) {
  if (current !== track || track.state !== 'playing') return;
  if (!synth || !('SpeechSynthesisUtterance' in window)) return change(track, 'unavailable');
  const utterance = new SpeechSynthesisUtterance(track.text);
  utterance.lang = 'es-MX';
  const voices = synth.getVoices();
  const spanish = voices.find(entry => entry.lang.toLowerCase() === 'es-mx')
    || voices.find(entry => entry.lang.toLowerCase().startsWith('es'));
  if (spanish) utterance.voice = spanish;
  else if (voices.length) return change(track, 'unavailable');
  utterance.rate = settings.rate;
  utterance.onend = () => change(track, 'stopped');
  utterance.onerror = () => change(track, 'unavailable');
  track.utterance = utterance;
  synth.speak(utterance);
}

export function pauseVoice(key) {
  if (current?.key !== key || current.state !== 'playing') return;
  voice.pause();
  if (current.utterance) synth?.pause();
  change(current, 'paused');
}

export function playVoice(key, text, source, onState) {
  if (current?.key === key && current.state === 'paused') {
    const track = current;
    change(track, 'playing');
    if (track.utterance) synth.resume();
    else voice.play().catch(() => speak(track));
    return;
  }
  stopVoice();
  const track = { key, text, onState, state: 'playing' };
  current = track;
  change(track, 'playing');
  if (!source) return speak(track);
  voice.src = source;
  voice.playbackRate = settings.rate;
  voice.onended = () => change(track, 'stopped');
  voice.play().catch(() => speak(track));
}

export function environmentSound(name, source) {
  const target = name || '';
  const nextURL = target ? source || `/media/amb-${target}.wav` : '';
  if (environment === target && environmentURL === nextURL) return;
  environment = target;
  environmentURL = nextURL;
  enabled = Boolean(target);
  ambience.pause();
  effect.pause();
  if (enabled) {
    prepareMix();
    ambience.crossOrigin = 'anonymous';
    const fallback = `/media/amb-${target}.wav`;
    ambience.onerror = () => {
      if (!enabled || environmentURL !== nextURL || ambience.getAttribute('src') === fallback) return;
      ambience.src = fallback;
      if (settings.volume) ambience.play().catch(() => {});
    };
    ambience.src = environmentURL;
    if (settings.volume) ambience.play().catch(() => {});
  }
}

export function resumeEnvironment() {
  if (enabled && settings.volume) {
    prepareMix();
    if (ambience.paused) ambience.play().catch(() => {});
  }
}

export function zoneEffect(index) {
  if (!enabled || !settings.volume) return;
  effect.src = `/media/amb-${environment}-${index % 4}.wav`;
  effect.play().catch(() => {});
}

export function vibrate() {
  if (settings.haptic && navigator.vibrate) navigator.vibrate(settings.haptic === 1 ? 18 : 42);
}
