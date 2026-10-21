import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
import { createAccount, applyAction, publicState, getWeekStatus } from '../public/game/course-progress.js';
import { ACTIVITIES } from '../public/game/book-course.js';
import { CAMPUS, DORM, ATLANTIC } from '../public/game/campus.js';

assert.ok(vm.SourceTextModule, 'Run presence-ui.test.mjs with --experimental-vm-modules');
const gameRoot = fileURLToPath(new URL('../public/game/', import.meta.url));
const SETTINGS_KEY = 'seapath.settings.v1';
const configs = { campus: CAMPUS, dorm: DORM, atlantic: ATLANTIC };
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };

async function page({ local = false, staff = false, seed = {}, dev = false } = {}) {
  const { window } = parseHTML(await fs.readFile(gameRoot + 'index.html', 'utf8'));
  const { document } = window, timers = new Map(), requests = [], sockets = [], worlds = [];
  const storage = new Map([[SETTINGS_KEY, JSON.stringify(seed)]]);
  let timerId = 0, currentWorld, closed = false;
  const location = new URL(`${dev ? 'http://127.0.0.1:8787' : 'https://college.example'}/game/index.html?storage=${local ? 'local' : 'server'}${dev ? '&dev_user=cadet-a' : ''}`);
  const selectValues = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return selectValues.get(this) ?? this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? ''; },
    set(value) { selectValues.set(this, String(value)); },
  });
  Object.defineProperty(window.HTMLInputElement.prototype, 'checked', {
    configurable: true, get() { return this.hasAttribute('checked'); },
    set(value) { this.toggleAttribute('checked', !!value); },
  });
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.setPointerCapture = function () {};
  window.HTMLElement.prototype.releasePointerCapture = function () {};
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  window.speechSynthesis = { cancel() {}, speak() {}, getVoices: () => [] };
  const dialog = document.querySelector('#game-dialog');
  dialog.open = false;
  dialog.showModal = function () { this.open = true; };
  dialog.close = function () { if (this.open) { this.open = false; queueMicrotask(() => this.dispatchEvent(new window.Event('close'))); } };

  class WorldStub {
    constructor(canvas, callbacks) { this.callbacks = callbacks; this.isReady = true; this.zone = 'campus'; this.position = { ...CAMPUS.spawn }; this.remotes = new Map(); currentWorld = this; }
    setCharacter(value) { this.character = value; }
    setMode(value) { this.mode = value; }
    setZone(zone, position) { this.zone = zone; this.position = { ...(position || configs[zone].spawn) }; }
    setPosition(value) { this.position = { ...value }; }
    getPosition() { return { ...this.position }; }
    getPresenceState() { return { ...this.position, yaw: 0, moving: false, running: false }; }
    setPaused(value) { this.paused = value; }
    setInput() {} setQuality() {} rotateCharacter() {} rotateCamera() {} setCameraInput() {} resetCamera() {}
    clearRemotePlayers() { this.remotes.clear(); }
    addRemotePlayer(k, look, label) { this.remotes.set(k, { look, label }); }
    updateRemotePlayer(k, state) { if (this.remotes.has(k)) this.remotes.get(k).state = state; }
    removeRemotePlayer(k) { this.remotes.delete(k); }
    showRemoteBubble(k, text) { if (this.remotes.has(k)) this.remotes.get(k).bubble = text; }
    playRemoteGesture() {} cancelRemoteGesture() {} playGesture() {}
  }
  class SocketStub {
    constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close(code) { this.readyState = 3; this.onclose?.({ code }); }
    open(room = `public:${currentWorld.zone}:0`) {
      this.readyState = 1; this.onopen?.();
      this.receive({ type: 'welcome', you: 'SELF_1234567', room, count: 1 });
    }
    receive(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
  }

  const now = Date.parse('2026-10-21T10:00:00Z');
  let account = createAccount(now, 'presence-ui-journey'), revision = 0;
  const envelope = () => ({ state: publicState(account, now, ACTIVITIES), week: getWeekStatus(account, now), revision, serverTime: new Date(now).toISOString() });
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fetcher = async (raw, options = {}) => {
    const url = new URL(raw, location), payload = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, payload, method: options.method });
    if (url.pathname === '/api/academy') {
      if (payload) { const result = applyAction(account, payload, now, ACTIVITIES); if (result.changed) { account = result.account; revision++; } }
      return json(envelope());
    }
    if (url.pathname === '/api/presence/session') {
      const code = url.searchParams.get('code');
      if (code && (code !== 'ABC-234' || closed)) return json({ error: { code: 'class_closed', message: 'That class code is not open.' } }, 404);
      return json({ enabled: true, staff, ...(code ? { code } : {}) });
    }
    if (url.pathname === '/api/class-worlds') {
      assert.equal(staff, true, 'Only staff controls request the class management API');
      if (payload?.action === 'create') { const world = { code: 'ABC-234', createdAt: new Date(now).toISOString(), closedAt: null }; worlds.push(world); return json({ world }); }
      if (payload?.action === 'close') { worlds.find(world => world.code === payload.code).closedAt = new Date(now).toISOString(); closed = true; return json({ code: payload.code, closed: true }); }
      return json({ worlds });
    }
    assert.fail(`Unexpected network request: ${raw}`);
  };
  const context = vm.createContext({
    window, document, console, URL, URLSearchParams, Response, Blob, fetch: fetcher, location,
    WebSocket: SocketStub, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    matchMedia: query => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() {} }),
    setTimeout: (callback, delay = 0) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance, crypto: globalThis.crypto, queueMicrotask,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url)) return modules.get(url);
    let module;
    if (url === pathToFileURL(gameRoot + 'world.js').href) {
      module = new vm.SyntheticModule(['SeaWorld'], function () { this.setExport('SeaWorld', WorldStub); }, { identifier: url, context });
    } else {
      let source = await fs.readFile(fileURLToPath(url), 'utf8');
      if (url === pathToFileURL(gameRoot + 'app.js').href) source = source.replace(/\bboot\(\);\s*$/, 'globalThis.__boot = boot();') + '\nglobalThis.__qa={ get prefs(){return prefs},get mode(){return mode},get presence(){return presence},get academy(){return academy},get dialogKey(){return dialogKey},transferTo };';
      module = new vm.SourceTextModule(source, {
        identifier: url, context, initializeImportMeta: meta => { meta.url = url; },
        async importModuleDynamically(specifier, parent) {
          const dependency = await moduleFor(new URL(specifier, parent.identifier).href);
          if (dependency.status === 'unlinked') await dependency.link(linker);
          if (dependency.status === 'linked') await dependency.evaluate();
          return dependency;
        },
      });
    }
    modules.set(url, module); return module;
  }
  const linker = (specifier, parent) => moduleFor(new URL(specifier, parent.identifier).href);
  const appModule = await moduleFor(pathToFileURL(gameRoot + 'app.js').href);
  await appModule.link(linker); await appModule.evaluate(); await context.__boot;
  const app = context.__qa;
  const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); await new Promise(setImmediate); };
  const el = selector => { const node = document.querySelector(selector); assert.ok(node, `Missing ${selector}`); return node; };
  async function click(selector) { const node = el(selector); assert.ok(!node.disabled); node.dispatchEvent(new window.Event('click', { bubbles: true })); await settle(); }
  async function closeDialog() { if (dialog.open) await click('#close-dialog'); }
  async function start() { await closeDialog(); await click('[data-tab="skills"]'); await click('#start-journey'); }
  async function submitCode(code) { el('#presence-class-code').value = code; el('#presence-class-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle(); }
  await settle();
  return { app, window, document, requests, sockets, storage, timers, el, click, settle, start, closeDialog, submitCode, world: () => currentWorld, worlds };
}

await test('default Solo starts the real academy with no presence HTTP or WebSocket request', async () => {
  const p = await page();
  assert.equal(p.app.prefs.playMode, 'solo');
  assert.equal(p.el('#play-mode-choice [data-play-mode="solo"]').getAttribute('aria-pressed'), 'true');
  await p.start();
  assert.equal(p.app.mode, 'world'); assert.equal(p.app.academy.ready, true);
  assert.equal(p.sockets.length, 0); assert.ok(p.requests.every(request => request.url.pathname === '/api/academy'));
  await p.closeDialog(); await p.click('#settings-btn');
  assert.equal(p.el('#presence-online-settings').hidden, true);
  assert.equal(p.sockets.length, 0); assert.ok(p.requests.every(request => request.url.pathname === '/api/academy'));
});

await test('playMode persists in existing settings and changes without reloading', async () => {
  const p = await page();
  await p.click('#play-mode-choice [data-play-mode="online"]');
  assert.equal(JSON.parse(p.storage.get(SETTINGS_KEY)).playMode, 'online');
  assert.equal(p.sockets.length, 0, 'Creator choice does not publish an unsaved profile');
  await p.start(); assert.equal(p.sockets.length, 1); p.sockets[0].open(); await p.settle();
  assert.match(p.el('#presence-status-text').textContent, /^Online/);
  await p.closeDialog(); await p.click('#settings-btn');
  await p.click('#dialog-body [data-play-mode="solo"]');
  assert.equal(p.sockets[0].readyState, 3); assert.equal(p.app.mode, 'world');
  assert.equal(JSON.parse(p.storage.get(SETTINGS_KEY)).playMode, 'solo');
  await p.click('#dialog-body [data-play-mode="online"]');
  assert.equal(p.sockets.length, 2); assert.equal(p.app.mode, 'world');
  assert.equal(p.app.dialogKey, 'settings');
  const reload = await page({ seed: JSON.parse(p.storage.get(SETTINGS_KEY)) });
  assert.equal(reload.el('#play-mode-choice [data-play-mode="online"]').getAttribute('aria-pressed'), 'true');
  assert.equal(reload.sockets.length, 0);
});

await test('presence loss preserves an open game dialog and academy profile saves', async () => {
  const p = await page({ seed: { playMode: 'online' } }); await p.start();
  const socket = p.sockets[0]; socket.open();
  await p.closeDialog(); await p.click('#help-btn');
  const title = p.el('#dialog-title').textContent, key = p.app.dialogKey;
  socket.close(); await p.settle();
  assert.equal(p.el('#dialog-title').textContent, title); assert.equal(p.app.dialogKey, key);
  assert.equal(p.app.mode, 'world'); assert.equal(p.app.presence.status.effectiveMode, 'solo');
  assert.equal(p.el('#presence-status-text').textContent, 'Reconnecting…');
  const before = p.app.academy.getState();
  const saved = await p.app.academy.updateProfile({ ...before.profile, outfit: 'maritime-white' }); await p.settle();
  assert.ok(saved); assert.equal(p.app.academy.getState().profile.outfit, 'maritime-white');
  assert.equal(p.app.academy.getState().day, before.day); assert.equal(p.app.academy.getState().semester, before.semester);
  assert.equal(p.el('#dialog-title').textContent, title);
});

await test('saved hidden preference is in hello; zones reconnect with the correct world', async () => {
  const p = await page({ seed: { playMode: 'online', presenceHidden: true } }); await p.start();
  p.sockets[0].open(); assert.equal(p.sockets[0].sent[0].hidden, true);
  assert.equal(p.el('#presence-emotes').disabled, true); assert.equal(p.el('#presence-chat').disabled, true);
  await p.closeDialog(); await p.click('#settings-btn'); await p.click('#presence-appear-offline');
  assert.equal(p.sockets[0].sent.at(-1).type, 'hide'); assert.equal(p.sockets[0].sent.at(-1).hidden, false);
  assert.equal(JSON.parse(p.storage.get(SETTINGS_KEY)).presenceHidden, false);
  p.app.transferTo('dorm'); await p.settle();
  assert.equal(p.sockets.length, 2); assert.match(p.sockets[1].url, /zone=dorm/);
  p.sockets[1].open(); assert.equal(p.app.presence.zone, 'dorm');
  p.app.transferTo('atlantic'); await p.settle();
  assert.equal(p.sockets.length, 3); assert.match(p.sockets[2].url, /zone=atlantic/);
});

await test('cadets can join open class codes; invalid codes keep their current room', async () => {
  const p = await page({ seed: { playMode: 'online' } }); await p.start(); p.sockets[0].open();
  await p.closeDialog(); await p.click('#settings-btn');
  assert.equal(p.el('#class-world-open').hidden, true);
  await p.submitCode('DEF-567');
  assert.match(p.el('#presence-class-note').textContent, /not open/); assert.equal(p.sockets.length, 1);
  await p.submitCode('abc234'); assert.equal(p.app.presence.code, 'ABC-234'); assert.equal(p.sockets.length, 2);
  assert.match(p.sockets[1].url, /code=ABC-234/);
  assert.match(p.el('#presence-class-current').textContent, /ABC-234/);
  await p.click('#presence-leave-class'); assert.equal(p.app.presence.code, ''); assert.equal(p.sockets.length, 3);
  assert.equal(p.requests.some(request => request.url.pathname === '/api/class-worlds'), false);
});

await test('staff get the class panel and can create and close a code', async () => {
  const p = await page({ staff: true, seed: { playMode: 'online' } }); await p.start(); p.sockets[0].open();
  await p.closeDialog(); await p.click('#settings-btn');
  assert.equal(p.el('#class-world-open').hidden, false); await p.click('#class-world-open');
  assert.equal(p.app.dialogKey, 'class-world'); await p.click('#class-world-create');
  assert.equal(p.worlds.length, 1); assert.match(p.el('#class-world-note').textContent, /ABC-234/);
  await p.click('[data-class-join="ABC-234"]'); assert.equal(p.app.presence.code, 'ABC-234');
  await p.click('[data-class-close="ABC-234"]'); assert.ok(p.worlds[0].closedAt); assert.equal(p.app.presence.code, 'ABC-234');
  assert.equal(p.document.querySelector('[data-class-close]'), null);
});

await test('closed class shows a clear status and waits for the cadet to choose the public world', async () => {
  const p = await page({ seed: { playMode: 'online' } }); await p.start(); p.sockets[0].open();
  await p.closeDialog(); await p.click('#settings-btn'); await p.submitCode('ABC-234');
  p.sockets[1].open('class:ABC-234:campus:0'); p.sockets[1].close(4003); await p.settle();
  assert.equal(p.el('#presence-status-text').textContent, 'Class closed');
  assert.match(p.el('#presence-class-note').textContent, /Leave class/);
  assert.equal(p.app.presence.code, 'ABC-234'); assert.equal(p.app.presence.status.effectiveMode, 'solo');
  assert.equal(p.sockets.length, 2);
  p.window.dispatchEvent(new p.window.Event('online')); await p.settle(); assert.equal(p.sockets.length, 2);
  await p.click('#presence-leave-class'); assert.equal(p.sockets.length, 3); assert.equal(p.app.presence.code, '');
});

await test('?storage=local hides Online, explains sign-in and starts with no network', async () => {
  const p = await page({ local: true, seed: { playMode: 'online' } });
  assert.equal(p.el('#play-mode-choice [data-play-mode="online"]').hidden, true);
  assert.match(p.el('#play-mode-choice .presence-mode-note').textContent, /college sign-in version/);
  assert.equal(p.app.prefs.playMode, 'solo');
  assert.equal(JSON.parse(p.storage.get(SETTINGS_KEY)).playMode, 'solo');
  await p.start(); assert.equal(p.app.academy.ready, true);
  await p.closeDialog(); await p.click('#settings-btn');
  assert.equal(p.el('#dialog-body [data-play-mode="online"]').hidden, true);
  assert.equal(p.el('#presence-online-settings').hidden, true);
  assert.equal(p.sockets.length, 0); assert.equal(p.requests.length, 0);
});

await test('the explicit local development identity reaches academy, session and socket APIs', async () => {
  const p = await page({ dev: true, seed: { playMode: 'online' } }); await p.start();
  assert.ok(p.requests.length >= 3);
  assert.ok(p.requests.every(request => request.url.searchParams.get('dev_user') === 'cadet-a'));
  assert.match(p.sockets[0].url, /dev_user=cadet-a/);
});

console.log(`\n${passed} presence UI checks passed (actual app modules, terminal DOM).`);
