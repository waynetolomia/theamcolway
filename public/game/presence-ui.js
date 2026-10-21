/** Small online controls. All names and API errors are rendered as text. */
import { apiURL } from './api-url.js';
import { QUICK_CHAT, EMOTES, normalizeClassCode } from './presence-protocol.js';

const EMOTE_LABELS = { wave: 'Wave', salute: 'Salute', 'thumbs-up': 'Thumbs up', cheer: 'Cheer' };
const EMOTE_MARKS = { wave: '👋', salute: '🫡', 'thumbs-up': '👍', cheer: '🙌' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createPresenceUI({
  presence, getPrefs, setMode, setHidden, onlineAvailable, isLocalMode,
  openSettings, openDialog, closeDialog, toast, getWorld = () => null,
  document: doc = globalThis.document, fetcher = (...args) => globalThis.fetch(...args),
  location = globalThis.location,
}) {
  const $ = selector => doc.querySelector(selector);
  let staff = false, sessionLoaded = false, sessionPending = null, currentCard = null, destroyed = false;
  let requestSerial = 0;
  const roleNote = () => isLocalMode() ? 'Online play needs the college sign-in version.'
    : getPrefs().playMode === 'online' && getPrefs().presenceHidden ? 'While hidden, you can watch nearby cadets. Emotes and quick chat are paused.'
    : 'Your academy progress stays the same in either mode.';
  const choices = () => `<div class="segmented presence-mode-options" role="group" aria-label="Play mode"><button type="button" data-play-mode="solo">Play solo</button><button type="button" data-play-mode="online" ${onlineAvailable() ? '' : 'hidden'}>Play online</button></div>`;

  const picker = doc.createElement('div');
  picker.id = 'play-mode-choice'; picker.className = 'presence-mode-picker';
  picker.innerHTML = `<span class="presence-field-label">PLAY MODE</span>${choices()}<p class="presence-mode-note"></p>`;
  $('.creator-footer')?.prepend(picker);

  const hud = doc.createElement('div');
  hud.id = 'presence-hud'; hud.setAttribute('aria-label', 'Online play');
  hud.innerHTML = '<button id="presence-status" class="presence-status glass" type="button" title="Play mode settings"><span class="presence-dot" aria-hidden="true"></span><span id="presence-status-text" role="status">Solo</span><span id="presence-hidden" hidden>Hidden</span></button><div class="presence-social-actions" hidden><button id="presence-emotes" type="button" class="glass">Emotes</button><button id="presence-chat" type="button" class="glass">Quick chat</button></div>';
  $('#world-ui')?.append(hud);

  const card = doc.createElement('aside');
  card.id = 'presence-player-card'; card.className = 'glass'; card.hidden = true;
  card.setAttribute('aria-labelledby', 'presence-player-name');
  card.innerHTML = '<button type="button" id="presence-card-close" class="presence-card-close" aria-label="Close cadet card">×</button><span class="presence-field-label">ONLINE CADET</span><strong id="presence-player-name"></strong><p>Quick chat and emotes only.</p><div class="presence-card-actions"><button type="button" id="presence-mute">Mute</button><button type="button" id="presence-report">Report</button></div><p id="presence-card-note" role="status"></p>';
  $('#world-ui')?.append(card);

  async function request(path, payload) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const response = await fetcher(apiURL(path, location), {
        method: payload ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
        signal: controller?.signal,
      });
      let value;
      try { value = await response.json(); } catch { throw new Error('Online play needs the college sign-in version.'); }
      if (!response.ok) throw new Error(value?.error?.message || 'Online play is unavailable. Please try again.');
      return value;
    } catch (error) {
      if (error?.name === 'AbortError' || error instanceof TypeError) throw new Error('Could not connect. Your game is still ready to play.');
      throw error;
    } finally { if (timer !== null) clearTimeout(timer); }
  }

  async function ensureSession() {
    if (!onlineAvailable() || getPrefs().playMode !== 'online') return false;
    if (sessionLoaded) return staff;
    if (!sessionPending) sessionPending = request('/api/presence/session').then(value => {
      staff = value?.staff === true; sessionLoaded = true;
      if (!destroyed) renderOptions();
      return staff;
    }).catch(() => false).finally(() => { sessionPending = null; });
    return sessionPending;
  }

  function selectMode(next) {
    if (next === 'online' && !onlineAvailable()) return;
    ++requestSerial;
    setMode(next);
    if (next === 'online' && presence.status.state === 'class-closed') presence.retry();
    renderOptions(); renderStatus();
    if (next === 'online') void ensureSession();
  }

  function bindChoices(scope) {
    scope.querySelectorAll('[data-play-mode]').forEach(button => {
      button.onclick = () => selectMode(button.dataset.playMode);
    });
  }

  function renderOptions() {
    const prefs = getPrefs(), available = onlineAvailable();
    doc.querySelectorAll('[data-play-mode]').forEach(button => {
      const selected = button.dataset.playMode === prefs.playMode;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
      if (button.dataset.playMode === 'online') button.hidden = !available;
    });
    doc.querySelectorAll('.presence-mode-note').forEach(note => { note.textContent = roleNote(); });
    const online = available && prefs.playMode === 'online';
    if ($('#presence-online-settings')) $('#presence-online-settings').hidden = !online;
    if ($('#presence-appear-offline')) {
      $('#presence-appear-offline').textContent = prefs.presenceHidden ? 'Hidden' : 'Visible';
      $('#presence-appear-offline').setAttribute('aria-pressed', String(prefs.presenceHidden === true));
    }
    if ($('#class-world-open')) $('#class-world-open').hidden = !staff || !online;
    if ($('#presence-class-current')) $('#presence-class-current').textContent = presence.code ? `Class ${presence.code}${presence.status.state === 'class-closed' ? ' · closed' : ''}` : 'Public world';
    if ($('#presence-class-note') && presence.status.state === 'class-closed') $('#presence-class-note').textContent = 'This class world has closed. Leave class to join the public world.';
    if ($('#presence-leave-class')) $('#presence-leave-class').hidden = !presence.code;
    if ($('#presence-class-code') && !$('#presence-class-code').value) $('#presence-class-code').value = presence.code;
  }

  function renderStatus() {
    const status = presence.status;
    const text = status.state === 'online' ? `Online · ${status.count} nearby`
      : status.state === 'connecting' ? 'Connecting…' : status.state === 'reconnecting' ? 'Reconnecting…' : status.state === 'class-closed' ? 'Class closed' : 'Solo';
    if ($('#presence-status-text').textContent !== text) $('#presence-status-text').textContent = text;
    hud.dataset.status = status.state;
    doc.body.dataset.presence = status.state;
    $('#presence-hidden').hidden = !status.hidden || status.mode !== 'online';
    $('.presence-social-actions').hidden = getPrefs().playMode !== 'online' || !onlineAvailable();
    $('#presence-emotes').disabled = $('#presence-chat').disabled = !presence.connected || status.hidden;
    $('#presence-emotes').title = $('#presence-chat').title = status.hidden ? 'Turn off Appear offline in Settings to send a signal.' : '';
    $('#presence-status').title = status.state === 'reconnecting'
      ? 'Your game is still playable. Online play will reconnect automatically.'
      : status.state === 'class-closed' ? 'Your class world has closed. Open Settings to leave the class or enter a new code.'
      : status.hidden ? 'Appearing offline. You can still see nearby cadets.' : 'Play mode settings';
    if (status.state === 'class-closed') renderOptions();
    if (currentCard && !presence.active.has(currentCard)) hideCard();
  }

  function hideCard() { currentCard = null; card.hidden = true; }
  function showRemoteCard(k) {
    const player = presence.getPlayer(k);
    if (!player || !presence.active.has(k)) return false;
    currentCard = k; card.hidden = false;
    $('#presence-player-name').textContent = player.label;
    $('#presence-mute').textContent = player.muted ? 'Muted' : 'Mute';
    $('#presence-mute').disabled = player.muted;
    $('#presence-report').disabled = false;
    $('#presence-card-note').textContent = player.muted ? 'Muted for this play session.' : '';
    $('#presence-card-close').focus({ preventScroll: true });
    return true;
  }

  function openEmotes() {
    if (!presence.connected) return;
    hideCard();
    openDialog('A friendly signal.','EMOTES',`<p class="dialog-copy">Greet the cadets around you.</p><div class="presence-emote-grid">${EMOTES.map(id => `<button type="button" class="button secondary" data-presence-emote="${id}"><span aria-hidden="true">${EMOTE_MARKS[id]}</span>${EMOTE_LABELS[id]}</button>`).join('')}</div><p class="campus-footnote">One emote or phrase every two seconds.</p>`,'presence-emotes');
    doc.querySelectorAll('[data-presence-emote]').forEach(button => { button.onclick = () => {
      if (!presence.sendEmote(button.dataset.presenceEmote)) { toast('Stand by a moment before your next signal.'); return; }
      closeDialog(); getWorld()?.playGesture?.(button.dataset.presenceEmote);
    }; });
  }

  function openQuickChat() {
    if (!presence.connected) return;
    hideCard();
    openDialog('Say it the maritime way.','QUICK CHAT',`<p class="dialog-copy">Choose a phrase. Nearby cadets see it for four seconds.</p><div class="presence-phrase-grid">${QUICK_CHAT.map(phrase => `<button type="button" class="button secondary" data-presence-phrase="${phrase.id}">${escape(phrase.text)}</button>`).join('')}</div><p class="campus-footnote">One phrase or emote every two seconds.</p>`,'presence-chat');
    doc.querySelectorAll('[data-presence-phrase]').forEach(button => { button.onclick = () => {
      if (!presence.say(button.dataset.presencePhrase)) { toast('Stand by a moment before your next signal.'); return; }
      closeDialog(); toast(QUICK_CHAT.find(phrase => phrase.id === button.dataset.presencePhrase).text);
    }; });
  }

  function settingsMarkup() {
    return `<section class="presence-settings"><div class="settings-row"><div><h3>Play mode</h3><p class="presence-mode-note">${roleNote()}</p></div>${choices()}</div><div id="presence-online-settings" ${getPrefs().playMode === 'online' && onlineAvailable() ? '' : 'hidden'}><div class="settings-row"><div><h3>Appear offline</h3><p>See nearby cadets while keeping your avatar hidden.</p></div><button id="presence-appear-offline" class="button secondary" type="button"></button></div><div class="presence-class-settings"><div><h3>Join a class</h3><p>Enter the six-character code from your teacher.</p></div><form id="presence-class-form"><label class="sr-only" for="presence-class-code">Class code</label><input id="presence-class-code" type="text" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC-234" aria-describedby="presence-class-note"><button class="button secondary" id="presence-join-class" type="submit">Join</button></form><div class="presence-class-current"><strong id="presence-class-current">Public world</strong><button class="text-button" id="presence-leave-class" type="button" hidden>Leave class</button></div><p id="presence-class-note" role="status"></p></div><button id="class-world-open" type="button" class="button secondary" ${staff ? '' : 'hidden'}>Class world</button></div></section>`;
  }

  async function joinClass(value, note, button) {
    const code = normalizeClassCode(value);
    if (!code) { note.textContent = 'Use a six-character class code, such as ABC-234.'; return false; }
    const serial = ++requestSerial;
    button.disabled = true; note.textContent = 'Checking class code…';
    try {
      const result = await request(`/api/presence/session?code=${encodeURIComponent(code)}`);
      if (destroyed || serial !== requestSerial) return false;
      if (!result?.enabled || result.code !== code) throw new Error('This class world is unavailable. Ask your teacher for an open code.');
      presence.setClassCode(code); selectMode('online');
      note.textContent = `Joined class ${code}.`; renderOptions();
      return true;
    } catch (error) { if (serial === requestSerial) note.textContent = error.message; return false; }
    finally { button.disabled = false; }
  }

  function bindSettings() {
    bindChoices($('#dialog-body'));
    $('#presence-appear-offline').onclick = () => { setHidden(!getPrefs().presenceHidden); renderOptions(); };
    $('#presence-class-form').onsubmit = event => {
      event.preventDefault();
      void joinClass($('#presence-class-code').value, $('#presence-class-note'), $('#presence-join-class'));
    };
    $('#presence-leave-class').onclick = () => {
      ++requestSerial; presence.setClassCode('');
      $('#presence-class-code').value = ''; $('#presence-class-note').textContent = 'Returned to the public world.';
      renderOptions();
    };
    $('#class-world-open').onclick = openClassWorlds;
    renderOptions(); if (getPrefs().playMode === 'online') void ensureSession();
  }

  function drawWorlds(worlds) {
    const list = $('#class-world-list'); if (!list) return;
    const open = Array.isArray(worlds) ? worlds.filter(world => normalizeClassCode(world?.code) === world.code && !world.closedAt).slice(0, 100) : [];
    list.innerHTML = open.length ? open.map(world => `<div class="presence-class-world"><strong>${escape(world.code)}</strong><button type="button" class="button secondary" data-class-join="${world.code}">Join</button><button type="button" class="text-button" data-class-close="${world.code}">Close code</button></div>`).join('') : '<p class="dialog-copy">No open class codes yet.</p>';
    list.querySelectorAll('[data-class-join]').forEach(button => { button.onclick = () => void joinClass(button.dataset.classJoin, $('#class-world-note'), button); });
    list.querySelectorAll('[data-class-close]').forEach(button => { button.onclick = async () => {
      button.disabled = true;
      try {
        await request('/api/class-worlds', { action: 'close', code: button.dataset.classClose });
        if ($('#class-world-note')) $('#class-world-note').textContent = `Closed ${button.dataset.classClose}.`;
        await loadWorlds();
      } catch (error) { if ($('#class-world-note')) $('#class-world-note').textContent = error.message; }
      finally { button.disabled = false; }
    }; });
  }

  async function loadWorlds() {
    try { const result = await request('/api/class-worlds'); drawWorlds(result.worlds); }
    catch (error) { if ($('#class-world-note')) $('#class-world-note').textContent = error.message; }
  }

  function openClassWorlds() {
    if (!staff || !onlineAvailable()) return;
    openDialog('Bring your class together.','CLASS WORLD', '<p class="dialog-copy">Create a code and share it with your cadets. The same code connects the campus, dormitory and Atlantic rooms.</p><div class="dialog-actions"><button type="button" id="class-world-create" class="button primary">Create class code</button></div><div id="class-world-list"><p class="dialog-copy">Loading your class codes…</p></div><p id="class-world-note" role="status"></p><p class="campus-footnote">Closing a code ends that class world. Cadets can return to the public world from Settings.</p>', 'class-world');
    $('#class-world-create').onclick = async event => {
      const button = event.currentTarget; button.disabled = true;
      try {
        const result = await request('/api/class-worlds', { action: 'create' });
        const code = normalizeClassCode(result?.world?.code);
        if (!code) throw new Error('Could not create a class code. Please try again.');
        if ($('#class-world-note')) $('#class-world-note').textContent = `Class code: ${code}. Share this code with your cadets.`;
        await loadWorlds();
      } catch (error) { if ($('#class-world-note')) $('#class-world-note').textContent = error.message; }
      finally { button.disabled = false; }
    };
    void loadWorlds();
  }

  $('#presence-status').onclick = () => { hideCard(); openSettings(); };
  $('#presence-emotes').onclick = openEmotes;
  $('#presence-chat').onclick = openQuickChat;
  $('#presence-card-close').onclick = hideCard;
  $('#presence-mute').onclick = () => {
    if (!currentCard || !presence.mute(currentCard)) return;
    $('#presence-mute').textContent = 'Muted'; $('#presence-mute').disabled = true;
    $('#presence-card-note').textContent = 'Muted for this play session.';
  };
  $('#presence-report').onclick = () => {
    if (currentCard && presence.report(currentCard)) {
      $('#presence-report').disabled = true;
      $('#presence-card-note').textContent = 'Report sent. Thank you.';
    } else $('#presence-card-note').textContent = 'The cadet has left. Please try again when connected.';
  };
  card.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); hideCard(); } };
  bindChoices(picker); renderOptions(); renderStatus();
  return {
    renderOptions, renderStatus, settingsMarkup, bindSettings, showRemoteCard, hideCard, ensureSession,
    updateAvailability() { renderOptions(); renderStatus(); },
    destroy() { destroyed = true; ++requestSerial; picker.remove(); hud.remove(); card.remove(); },
  };
}
