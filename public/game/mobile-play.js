/**
 * Phone play helpers: full screen, landscape rotation and a compact "focus" layout.
 * Fullscreen and orientation lock are browser features; when a browser does not offer them
 * (for example iPhone Safari), the game falls back to a friendly "turn your phone" hint.
 */
const doc = globalThis.document;
const fullscreenElement = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
const canFullscreen = () => Boolean(doc.documentElement.requestFullscreen || doc.documentElement.webkitRequestFullscreen) && doc.fullscreenEnabled !== false;
const DISMISS_KEY = 'amcol.rotate-hint.dismissed';

async function enterFullscreen() {
  const el = doc.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* the browser refused (not from a tap, or not allowed in this frame) */ }
}
async function exitFullscreen() {
  try { if (doc.exitFullscreen) await doc.exitFullscreen(); else doc.webkitExitFullscreen?.(); } catch { /* already closed */ }
}
/** Landscape lock only works in full screen on supporting browsers (mainly Android). */
async function lockLandscape() {
  try { await globalThis.screen?.orientation?.lock?.('landscape'); return true; } catch { return false; }
}

export function setupMobilePlay({ icon, toast } = {}) {
  if (!doc?.body) return null;
  const body = doc.body;
  const coarse = globalThis.matchMedia?.('(any-pointer: coarse)');
  const portrait = globalThis.matchMedia?.('(orientation: portrait)');
  const fsButton = doc.getElementById('fullscreen-btn');
  const hint = doc.getElementById('rotate-hint');
  let dismissed = false, autoHidden = false, hintTimer = 0, lastOrientation = '';
  try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { /* storage blocked */ }

  const sync = () => {
    body.dataset.touch = String(Boolean(coarse?.matches) || globalThis.innerWidth <= 700);
    body.dataset.orientation = portrait?.matches ? 'portrait' : 'landscape';
    body.dataset.fullscreen = String(Boolean(fullscreenElement()));
    if (fsButton) {
      const on = Boolean(fullscreenElement());
      fsButton.hidden = !canFullscreen();
      fsButton.innerHTML = icon?.(on ? 'shrink' : 'expand') || '';
      fsButton.setAttribute('aria-pressed', String(on));
      fsButton.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
      fsButton.title = on ? 'Exit full screen' : 'Full screen';
    }
    // The hint shows on portrait phones, hides itself after 10 s, and returns after the next turn to portrait.
    if (body.dataset.orientation !== lastOrientation) { lastOrientation = body.dataset.orientation; if (lastOrientation === 'portrait') autoHidden = false; }
    if (hint) {
      const show = !dismissed && !autoHidden && body.dataset.touch === 'true' && body.dataset.orientation === 'portrait';
      if (show && hint.hidden) { clearTimeout(hintTimer); hintTimer = setTimeout(() => { autoHidden = true; sync(); }, 10000); }
      hint.hidden = !show;
    }
  };

  /** Full screen + landscape in one tap where supported; otherwise explain how to rotate. */
  const goLandscape = async () => {
    if (canFullscreen() && !fullscreenElement()) await enterFullscreen();
    const locked = fullscreenElement() ? await lockLandscape() : false;
    if (!locked && portrait?.matches) toast?.('Turn your phone sideways for the widest view. Turn off rotation lock if the screen does not turn.');
    sync();
  };

  fsButton?.addEventListener('click', async () => {
    if (fullscreenElement()) { try { globalThis.screen?.orientation?.unlock?.(); } catch { /* not locked */ } await exitFullscreen(); }
    else { await enterFullscreen(); if (body.dataset.touch === 'true') await lockLandscape(); }
    sync();
  });
  doc.getElementById('rotate-go')?.addEventListener('click', goLandscape);
  doc.getElementById('rotate-dismiss')?.addEventListener('click', () => {
    dismissed = true; try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked */ } sync();
  });
  for (const event of ['fullscreenchange', 'webkitfullscreenchange']) doc.addEventListener(event, sync);
  portrait?.addEventListener?.('change', sync);
  coarse?.addEventListener?.('change', sync);
  globalThis.addEventListener?.('resize', sync);
  sync();
  return { sync, goLandscape };
}
