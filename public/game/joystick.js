/**
 * A two-axis, camera-relative thumb control. x is screen-right; z is screen-down.
 * The returned vector keeps its analog magnitude and is clamped to a unit circle.
 * Call setEnabled(false) whenever a dialog, character editor, or pause opens.
 */
export function mountJoystick(element, { onMove = () => {}, onActive = () => {}, deadzone = 0.12, enabled = true } = {}) {
  if (!element?.addEventListener) throw new TypeError('A joystick element is required.');
  const document = element.ownerDocument;
  const window = document.defaultView;
  const stick = element.querySelector('[data-joystick-stick]') || element.querySelector('#joystick-stick');
  const listeners = [];
  const keys = new Set();
  const directions = {
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
    arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
  };
  const threshold = Math.min(0.35, Math.max(0, Number(deadzone) || 0));
  let pointerId = null, active = false, destroyed = false;
  let lastX = 0, lastZ = 0;
  enabled = Boolean(enabled);

  function listen(target, name, handler, options) {
    target?.addEventListener(name, handler, options);
    listeners.push(() => target?.removeEventListener(name, handler, options));
  }
  function prevent(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }
  function setActive(value) {
    value = Boolean(value);
    element.dataset.active = String(value);
    if (active === value) return;
    active = value;
    onActive(value);
  }
  function visual(x, z) {
    element.style.setProperty('--joystick-x', `${x.toFixed(2)}px`);
    element.style.setProperty('--joystick-z', `${z.toFixed(2)}px`);
  }
  function emit(x, z, force = false) {
    if (Math.abs(x) < 0.00001) x = 0;
    if (Math.abs(z) < 0.00001) z = 0;
    if (!force && Math.abs(lastX - x) < 0.0001 && Math.abs(lastZ - z) < 0.0001) return;
    lastX = x; lastZ = z;
    onMove(x, z);
  }
  function geometry() {
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    const thumb = stick?.getBoundingClientRect();
    const thumbSize = Math.max(thumb?.width || 0, thumb?.height || 0) || Math.min(bounds.width, bounds.height) * 0.42;
    return {
      x: bounds.left + bounds.width / 2,
      z: bounds.top + bounds.height / 2,
      radius: Math.max(1, (Math.min(bounds.width, bounds.height) - thumbSize) / 2 - 7),
    };
  }
  function movePointer(event) {
    if (!enabled || destroyed || pointerId === null || event.pointerId !== pointerId) return;
    const layout = geometry();
    if (!layout) { reset(); return; }
    prevent(event);
    const x = Number(event.clientX) - layout.x, z = Number(event.clientY) - layout.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const distance = Math.hypot(x, z);
    const ratio = distance > layout.radius ? layout.radius / distance : 1;
    visual(x * ratio, z * ratio);
    const rawMagnitude = Math.min(1, distance / layout.radius);
    if (rawMagnitude <= threshold || distance === 0) { emit(0, 0); return; }
    const magnitude = (rawMagnitude - threshold) / (1 - threshold);
    emit(x / distance * magnitude, z / distance * magnitude);
  }
  function releaseCapture(id) {
    try {
      if (!element.hasPointerCapture || element.hasPointerCapture(id)) element.releasePointerCapture?.(id);
    } catch { /* The browser may already have released a cancelled pointer. */ }
  }
  function reset() {
    const previous = pointerId;
    pointerId = null;
    keys.clear();
    setActive(false);
    visual(0, 0);
    emit(0, 0, true);
    if (previous !== null) releaseCapture(previous);
  }
  function endPointer(event) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    prevent(event);
    reset();
  }
  function moveKeys() {
    let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    const magnitude = Math.max(1, Math.hypot(x, z));
    x /= magnitude; z /= magnitude;
    const radius = geometry()?.radius || 30;
    setActive(keys.size > 0);
    visual(x * radius, z * radius);
    emit(x, z);
  }
  function keyUp(event) {
    const key = String(event.key || '').toLowerCase();
    if (!keys.has(key)) return;
    prevent(event);
    keys.delete(key);
    moveKeys();
  }
  function setEnabled(value) {
    if (destroyed) return;
    const next = Boolean(value);
    if (!next || enabled !== next) reset();
    enabled = next;
    element.disabled = !enabled;
    element.setAttribute('aria-disabled', String(!enabled));
    element.dataset.enabled = String(enabled);
  }

  listen(element, 'pointerdown', event => {
    if (!enabled || destroyed || pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!geometry()) return;
    // A second finger may be holding Run. The first pointer on this control owns it.
    prevent(event);
    pointerId = event.pointerId;
    keys.clear();
    setActive(true);
    element.focus?.({ preventScroll: true });
    try { element.setPointerCapture?.(pointerId); } catch { /* Window listeners still catch release. */ }
    movePointer(event);
  }, { passive: false });
  listen(element, 'pointermove', movePointer, { passive: false });
  // These also protect against an interrupted or unavailable pointer capture.
  listen(window, 'pointermove', movePointer, { passive: false });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(element, name, endPointer, { passive: false });
  }
  for (const name of ['pointerup', 'pointercancel']) listen(window, name, endPointer, { passive: false });
  listen(element, 'keydown', event => {
    const key = String(event.key || '').toLowerCase();
    if (!enabled || destroyed || !directions[key] || event.ctrlKey || event.metaKey || event.altKey) return;
    prevent(event);
    if (pointerId !== null) return;
    keys.add(key);
    moveKeys();
  });
  listen(element, 'keyup', keyUp);
  listen(window, 'keyup', keyUp);
  listen(element, 'blur', () => {
    if (pointerId !== null || !keys.size) return;
    reset();
  });
  for (const name of ['blur', 'resize', 'orientationchange']) listen(window, name, reset);
  listen(document, 'visibilitychange', () => { if (document.hidden) reset(); });
  for (const name of ['contextmenu', 'dragstart', 'selectstart']) listen(element, name, prevent);
  listen(element, 'click', event => event.preventDefault());
  element.setAttribute('aria-disabled', String(!enabled));
  element.dataset.enabled = String(enabled);
  element.disabled = !enabled;
  reset();

  return {
    reset,
    setEnabled,
    destroy() {
      if (destroyed) return;
      reset();
      destroyed = true;
      enabled = false;
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
      element.dataset.enabled = 'false';
      for (const remove of listeners.splice(0)) remove();
    },
  };
}
