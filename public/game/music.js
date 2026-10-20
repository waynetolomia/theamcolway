/**
 * Looping background music from the assets folder, with a choice of tracks. Browsers only allow
 * audio after the player interacts with the page, so playback starts on the first click, tap or
 * key press. A missing file is not an error: that track simply stays silent.
 */
const FADE_MS = 900;
export const MUSIC_TRACKS = Object.freeze([
  Object.freeze({ id: 'bg1', label: 'Track 1', file: 'BG1.mp3' }),
  Object.freeze({ id: 'bg2', label: 'Track 2', file: 'BG2.mp3' }),
]);

export function createMusic({ volume = 0.22, quietVolume = 0.07, track = MUSIC_TRACKS[0].id, onAvailability } = {}) {
  const supported = typeof Audio === 'function';
  let audio = null, enabled = false, quiet = false, unlocked = false, fade = 0;
  let current = MUSIC_TRACKS.some(t => t.id === track) ? track : MUSIC_TRACKS[0].id;
  const availability = new Map(); // track id → null (unknown) / true / false

  const target = () => quiet ? quietVolume : volume;
  const available = () => availability.get(current) ?? null;

  function load() {
    if (audio || !supported || available() === false) return audio;
    const id = current, file = MUSIC_TRACKS.find(t => t.id === id).file;
    const element = new Audio(new URL(`./assets/${file}`, import.meta.url).href);
    element.loop = true; element.preload = 'auto'; element.volume = 0;
    element.addEventListener('canplay', () => { if (availability.get(id) !== true) { availability.set(id, true); onAvailability?.(true, id); } });
    element.addEventListener('error', () => { availability.set(id, false); if (audio === element) audio = null; onAvailability?.(false, id); });
    audio = element;
    return audio;
  }

  function fadeTo(element, level, after) {
    if (!element) return;
    if (element === audio) cancelAnimationFrame(fade);
    const from = element.volume, start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / FADE_MS);
      element.volume = Math.max(0, Math.min(1, from + (level - from) * t));
      if (t < 1) { const id = requestAnimationFrame(step); if (element === audio) fade = id; } else after?.();
    };
    const id = requestAnimationFrame(step); if (element === audio) fade = id;
  }

  function sync() {
    const shouldPlay = enabled && unlocked && !document.hidden;
    if (shouldPlay) {
      if (!load()) return;
      const element = audio;
      if (element.paused) element.play().then(() => fadeTo(element, target())).catch(() => { /* still blocked; retry on the next interaction */ unlocked = false; });
      else fadeTo(element, target());
    } else if (audio && !audio.paused) { const element = audio; fadeTo(element, 0, () => element.pause()); }
  }

  if (supported) {
    const unlock = () => { if (unlocked) return; unlocked = true; sync(); };
    for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', sync);
  }

  return {
    get supported() { return supported; },
    /** null while unknown, then true or false once the browser has tried the current track. */
    get available() { return available(); },
    get enabled() { return enabled; },
    get track() { return current; },
    setEnabled(value) { enabled = Boolean(value); if (enabled) load(); sync(); },
    /** Switch track: the old one fades out while the new one fades in. */
    setTrack(id) {
      if (!MUSIC_TRACKS.some(t => t.id === id) || id === current) return;
      const old = audio; audio = null; current = id;
      if (old) { if (old.paused) old.src = ''; else fadeTo(old, 0, () => { old.pause(); old.src = ''; }); }
      if (enabled) load();
      sync();
    },
    /** Lower the music while dialogs (listening labs, voice playback) are open. */
    setQuiet(value) { quiet = Boolean(value); if (audio && !audio.paused) fadeTo(audio, target()); },
  };
}
