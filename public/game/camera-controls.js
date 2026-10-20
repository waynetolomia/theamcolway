/** Shared mouse/touch buttons: tap to turn, hold to rotate, release to stop. */
export function mountCameraControls(groups, { rotate = () => {}, setInput = () => {}, resetView = () => {}, enabled = false } = {}) {
  const buttons = groups.flatMap(group => [group.left, group.reset, group.right]).filter(Boolean);
  const document = buttons[0]?.ownerDocument;
  const window = document?.defaultView;
  const cleanup = [];
  let held = null, timer = null, destroyed = false, suppressUntil = 0;
  function listen(target, type, handler) { target?.addEventListener(type, handler); cleanup.push(() => target?.removeEventListener(type, handler)); }
  function stopEvent(event) { if (event.cancelable) event.preventDefault(); event.stopPropagation(); }
  function reset() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    const previous = held; held = null; setInput(0);
    if (previous) {
      previous.button.dataset.turning = 'false';
      try { previous.button.releasePointerCapture?.(previous.pointerId); } catch {}
    }
  }
  function setEnabled(value) { enabled = Boolean(value) && !destroyed; if (!enabled) reset(); buttons.forEach(button => { button.disabled = !enabled; }); }
  function release(event) {
    if (!held || event.pointerId !== held.pointerId) return;
    stopEvent(event); suppressUntil = Date.now() + 500; reset();
  }
  for (const group of groups) {
    for (const [button, direction] of [[group.left, -1], [group.right, 1]]) {
      if (!button) continue;
      listen(button, 'pointerdown', event => {
        if (!enabled || destroyed || held || event.pointerType === 'mouse' && event.button !== 0) return;
        stopEvent(event); held = { button, pointerId: event.pointerId }; button.dataset.turning = 'true';
        try { button.setPointerCapture?.(event.pointerId); } catch {}
        rotate(direction);
        timer = setTimeout(() => { timer = null; if (held?.button === button && enabled) setInput(direction); }, 220);
      });
      listen(button, 'click', event => {
        stopEvent(event);
        // Native keyboard activation has detail0 and must never lose a press.
        if (enabled && !destroyed && !(event.detail > 0 && Date.now() < suppressUntil)) rotate(direction);
      });
      listen(button, 'pointerup', release); listen(button, 'pointercancel', release);
      listen(button, 'lostpointercapture', event => { if (held?.pointerId === event.pointerId) reset(); });
    }
    if (group.reset) listen(group.reset, 'click', event => { stopEvent(event); if (enabled && !destroyed) { reset(); resetView(); } });
  }
  listen(window, 'pointerup', release); listen(window, 'pointercancel', release); listen(window, 'blur', reset);
  listen(document, 'visibilitychange', () => { if (document.hidden) reset(); });
  setEnabled(enabled);
  return { reset, setEnabled, destroy() { reset(); destroyed = true; setEnabled(false); cleanup.forEach(remove => remove()); } };
}
