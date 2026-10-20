/**
 * Looping background music from assets/BG.mp3. Browsers only allow audio after the player
 * interacts with the page, so playback starts on the first click, tap or key press.
 * A missing file is not an error: the music stays silent until BG.mp3 is added.
 */
const FADE_MS = 900;

export function createMusic({ volume = 0.22, quietVolume = 0.07, onAvailability } = {}) {
  const supported = typeof Audio === 'function';
  let audio = null, enabled = false, quiet = false, unlocked = false, available = null, fade = 0;

  function target() { return quiet ? quietVolume : volume; }

  function load() {
    if (audio || !supported || available === false) return audio;
    audio = new Audio(new URL('./assets/BG.mp3', import.meta.url).href);
    audio.loop = true; audio.preload = 'auto'; audio.volume = 0;
    audio.addEventListener('canplay', () => { if (available !== true) { available = true; onAvailability?.(true); } });
    audio.addEventListener('error', () => { available = false; audio = null; onAvailability?.(false); });
    return audio;
  }

  function fadeTo(level, after) {
    if (!audio) return;
    cancelAnimationFrame(fade);
    const from = audio.volume, start = performance.now();
    const step = now => {
      if (!audio) return;
      const t = Math.min(1, (now - start) / FADE_MS);
      audio.volume = Math.max(0, Math.min(1, from + (level - from) * t));
      if (t < 1) fade = requestAnimationFrame(step); else after?.();
    };
    fade = requestAnimationFrame(step);
  }

  function sync() {
    const shouldPlay = enabled && unlocked && !document.hidden;
    if (shouldPlay) {
      if (!load()) return;
      if (audio.paused) audio.play().then(() => fadeTo(target())).catch(() => { /* still blocked; retry on the next interaction */ unlocked = false; });
      else fadeTo(target());
    } else if (audio && !audio.paused) fadeTo(0, () => audio?.pause());
  }

  if (supported) {
    const unlock = () => { if (unlocked) return; unlocked = true; sync(); };
    for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', sync);
  }

  return {
    get supported() { return supported; },
    /** null while unknown, then true or false once the browser has tried BG.mp3. */
    get available() { return available; },
    get enabled() { return enabled; },
    setEnabled(value) { enabled = Boolean(value); if (enabled) load(); sync(); },
    /** Lower the music while dialogs (listening labs, voice playback) are open. */
    setQuiet(value) { quiet = Boolean(value); if (audio && !audio.paused) fadeTo(target()); },
  };
}
