import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { createAccount, applyAction, getAssignments, getSemesterProgress, publicState, getWeekStatus } from '../public/game/course-progress.js';
import { ACTIVITIES, getActivity } from '../public/game/book-course.js';
import { STATIONS, NPC_STATIONS, CAMPUS_STATIONS, DORM_DESTINATIONS, ATLANTIC_STATIONS, ATLANTIC_DESTINATIONS, CAMPUS, DORM, ATLANTIC } from '../public/game/campus.js';
import { NPCS, ORIENTATION_ROUTE, getNPCMissions, getNPCMission } from '../public/game/npc-content.js';
import { SAFETY_GAMES } from '../public/game/lifeboat-content.js';
import { getLomaGame } from '../public/game/loma-content.js';
import { getCharacterSummary } from '../public/game/character-dashboard.js';

// Executes the actual browser modules against a terminal DOM and real course rules.
// No browser, network server, WebGL rendering, or visual assertions are involved.
assert.ok(vm.SourceTextModule, 'Run with node --experimental-vm-modules academy-ui-checks.mjs');
const root = fileURLToPath(new URL('../public/game/', import.meta.url));
const fallback = process.argv.includes('--fallback');
const reloadSeed = process.argv.includes('--reload-atlantic') ? JSON.parse(process.env.SEAPATH_QA_RELOAD) : null;
const { window } = parseHTML(await fs.readFile(root + 'index.html', 'utf8'));
const { document } = window;
const storage = new Map(reloadSeed?.storage || []), timers = new Map();
let timerID = 0, currentWorld = null, exportedBlob = null;
let serverNow = reloadSeed?.serverNow ?? Date.parse('2026-10-19T11:30:00Z'), revision = reloadSeed?.revision ?? 0;
let nextFailure = false, nextGate = null;
let account = reloadSeed?.account ?? createAccount(serverNow, 'ui-academy-journey');
const districts = { campus: CAMPUS, dorm: DORM, atlantic: ATLANTIC };
const destinations = [...CAMPUS_STATIONS, ...DORM_DESTINATIONS, ...ATLANTIC_DESTINATIONS];
const destinationZone = id => destinations.find(station => station.id === id)?.zone || (id.startsWith('dorm-') ? 'dorm' : 'campus');
const activityDestination = id => {
  const activity = getActivity(id);
  return activity.location === 'atlantic' ? ATLANTIC_STATIONS.find(station => station.room === activity.room)?.id || 'atlantic-lobby' : activity.location;
};
const maritimeUniforms = [['maritime', 'Maritime navy uniform'], ['maritime-white', 'Maritime white uniform']];
const requests = [], unexpected = [];
process.on('unhandledRejection', error => unexpected.push(error));

const selectValues = new WeakMap();
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  configurable: true,
  get() {
    if (selectValues.has(this)) return selectValues.get(this);
    const option = this.querySelector('option[selected]') || this.querySelector('option');
    return option?.getAttribute('value') ?? option?.textContent ?? '';
  },
  set(value) {
    const options = [...this.querySelectorAll('option')];
    selectValues.set(this, options.some(option => (option.getAttribute('value') ?? option.textContent) === String(value)) ? String(value) : '');
  },
});
Object.defineProperty(window.HTMLInputElement.prototype, 'checked', {
  configurable: true, get() { return this.hasAttribute('checked'); },
  set(value) { this.toggleAttribute('checked', Boolean(value)); },
});
window.HTMLElement.prototype.focus = function () {};
window.HTMLElement.prototype.setPointerCapture = function () {};
window.HTMLElement.prototype.releasePointerCapture = function () {};
const joystickBase = document.querySelector('#movement-joystick');
joystickBase.getBoundingClientRect = () => ({ left: 20, top: 100, width: 132, height: 132 });
document.querySelector('#joystick-stick').getBoundingClientRect = () => ({ width: 56, height: 56 });
Object.defineProperty(document, 'hidden', { configurable: true, writable: true, value: false });
const svgHandlers = new WeakMap();
for (const property of ['onclick', 'onkeydown']) {
  Object.defineProperty(window.SVGElement.prototype, property, {
    configurable: true,
    get() { return svgHandlers.get(this)?.[property] ?? null; },
    set(handler) {
      const handlers = svgHandlers.get(this) || {};
      if (handlers[property]) this.removeEventListener(property.slice(2), handlers[property]);
      handlers[property] = handler; svgHandlers.set(this, handlers);
      if (handler) this.addEventListener(property.slice(2), handler);
    },
  });
}
const dialog = document.querySelector('#game-dialog');
dialog.open = false;
dialog.showModal = function () { this.open = true; };
dialog.close = function () {
  if (!this.open) return;
  this.open = false;
  queueMicrotask(() => this.dispatchEvent(new window.Event('close')));
};
window.speechSynthesis = { cancel() {}, speak() {}, getVoices() { return []; } };

class WorldStub {
  constructor(_canvas, callbacks) {
    this.callbacks = callbacks; this.isReady = !fallback; currentWorld = this;
    this.zone = 'campus'; this.position = { ...CAMPUS.spawn };
    this.touch = { x: 0, z: 0, run: false }; this.cameraTurns = 0; this.cameraInput = 0; this.cameraResets = 0;
    if (fallback) callbacks.onError(new Error('Test learning fallback'));
  }
  setCharacter(value) { this.character = { ...value }; }
  setMode(value) { this.mode = value; if (value !== 'world') this.touch = { x: 0, z: 0, run: false }; }
  setPaused(value) { this.paused = value; if (value) this.touch = { x: 0, z: 0, run: false }; }
  setInput(x, z, run = this.touch.run) { this.touch = this.paused || this.mode !== 'world' ? { x: 0, z: 0, run: false } : { x, z, run }; }
  setRunning(value) { this.setInput(this.touch.x, this.touch.z, Boolean(value)); }
  rotateCamera(direction) { this.cameraTurns += direction; }
  setCameraInput(direction) { this.cameraInput = direction; }
  resetCamera() { this.cameraInput = 0; this.cameraResets++; }
  setQuality() {}
  rotateCharacter() {}
  setZone(zone, position) {
    assert.ok(districts[zone], `Unknown district: ${zone}`);
    if (this.zone !== zone) this.callbacks.onNear(null);
    this.zone = zone; this.position = { ...(position || districts[zone].spawn) };
    this.touch = { x: 0, z: 0, run: false };
  }
  getZone() { return this.zone; }
  setPosition(value) { this.position = { ...value }; }
  getPosition() { return { ...this.position }; }
  resetPosition() { this.position = { ...districts[this.zone].spawn }; }
  setDestination(id) {
    const station = destinations.find(item => item.id === id);
    if (!station) return false;
    assert.equal(destinationZone(id), this.zone, `Cannot walk to ${id} from ${this.zone}`);
    this.destination = id; this.position = { x: station.x, z: station.z };
    this.callbacks.onMove(this.position); this.callbacks.onNear({ id }); return true;
  }
  setPresentationSlide(slide) { this.slide = slide; }
}

function envelope(feedback = null, duplicate = false, reward = null) {
  return { state: publicState(account, serverNow, ACTIVITIES), week: getWeekStatus(account, serverNow), revision, serverTime: new Date(serverNow).toISOString(), feedback, duplicate, reward };
}
function serverAction(payload) {
  const result = applyAction(account, payload, serverNow, ACTIVITIES, { journeyId: 'ui-new-journey' });
  if (result.changed) { account = result.account; revision++; }
  return envelope(result.feedback, result.duplicate, result.reward);
}
function tokens() { return { expectedJourneyId: account.journey.journeyId, expectedDay: account.journey.day }; }
const fetcher = async (url, request) => {
  assert.equal(url, '/api/academy', 'Unexpected network request');
  const payload = request.method === 'POST' ? JSON.parse(request.body) : null;
  requests.push({ method: request.method, payload });
  if (nextGate && payload) { const gate = nextGate; nextGate = null; await gate.promise; }
  if (nextFailure && payload) { nextFailure = false; throw new Error('Simulated connection failure'); }
  try {
    const response = payload ? serverAction(payload) : envelope();
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: { code: error.code, message: error.message, ...error.details } }), {
      status: error.status || 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
class ExportURL extends URL {
  static createObjectURL(blob) { exportedBlob = blob; return 'blob:academy-record'; }
  static revokeObjectURL() {}
}
const context = vm.createContext({
  window, document, console, Blob, URL: ExportURL, Response, fetch: fetcher,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  matchMedia: query => ({ matches: query.includes('prefers-reduced-motion'), addEventListener() {} }),
  setTimeout(callback, delay = 0) { const id = ++timerID; timers.set(id, { callback, delay }); return id; },
  clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  performance, crypto: globalThis.crypto, queueMicrotask,
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
});
const modules = new Map();
async function moduleFor(url) {
  if (modules.has(url)) return modules.get(url);
  let module;
  if (url === pathToFileURL(root + 'world.js').href) {
    module = new vm.SyntheticModule(['SeaWorld'], function () { this.setExport('SeaWorld', WorldStub); }, { identifier: url, context });
  } else {
    let source = await fs.readFile(fileURLToPath(url), 'utf8');
    if (url === pathToFileURL(root + 'app.js').href) source = source.replace(/\bboot\(\);\s*$/, 'globalThis.__boot = boot();') + '\nglobalThis.__qa = { get mode(){return mode}, get zone(){return currentZone}, get dialogKey(){return dialogKey}, get academy(){return academy}, get engineAvailable(){return engineAvailable}, get energy(){return state.energy}, set energy(value){state.energy=value;updateHUD()} };';
    module = new vm.SourceTextModule(source, {
      identifier: url, context,
      initializeImportMeta(meta) { meta.url = url; },
      async importModuleDynamically(specifier, referencingModule) {
        const dependency = await moduleFor(new URL(specifier, referencingModule.identifier).href);
        if (dependency.status === 'unlinked') await dependency.link(linker);
        if (dependency.status === 'linked') await dependency.evaluate();
        return dependency;
      },
    });
  }
  modules.set(url, module); return module;
}
function linker(specifier, referencingModule) { return moduleFor(new URL(specifier, referencingModule.identifier).href); }
const appModule = await moduleFor(pathToFileURL(root + 'app.js').href);
await appModule.link(linker); await appModule.evaluate(); await context.__boot;
const app = context.__qa;
const state = () => app.academy.getState();
async function settle() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
  await new Promise(setImmediate);
  if (unexpected.length) throw unexpected.shift();
}
function el(selector) {
  const node = document.querySelector(selector);
  assert.ok(node, `Missing ${selector}; title=${document.querySelector('#dialog-title').textContent}; key=${app.dialogKey}`);
  return node;
}
async function click(selector) {
  const node = typeof selector === 'string' ? el(selector) : selector;
  assert.ok(!node.disabled, `Disabled control: ${typeof selector === 'string' ? selector : node.outerHTML}`);
  node.dispatchEvent(new window.Event('click', { bubbles: true })); await settle();
}
async function value(selector, text) {
  const node = el(selector); node.value = text;
  node.dispatchEvent(new window.Event('input', { bubbles: true })); await settle();
}
async function close() { if (dialog.open) await click('#close-dialog'); }
function deferNextRequest() {
  let release;
  nextGate = { promise: new Promise(resolve => { release = resolve; }) };
  return release;
}
async function office() { await close(); await click('#journal-btn'); }
async function finishWalk(location, control = '#interaction-prompt') {
  const zone = destinationZone(location);
  if (app.engineAvailable) {
    if (zone === 'atlantic' && app.zone !== 'atlantic') {
      assert.equal(app.zone, 'campus', 'An indoor route must begin on the main campus.');
      assert.equal(currentWorld.destination, 'atlantic', 'Walk to Atlantic’s exterior entrance before entering its rooms.');
      assert.equal(dialog.open, false, 'An indoor visit must not open before reaching the entrance.');
      await click(control);
      assert.equal(app.zone, 'atlantic');
    }
    assert.equal(currentWorld.destination, location);
    assert.equal(dialog.open, false, 'Walking returns control to the game world.');
    await click(control);
  }
  assert.equal(app.zone, location === 'atlantic' ? 'atlantic' : zone);
}
async function travel(location) {
  await close(); await click('#campus-btn');
  if (app.zone !== 'campus' && !document.querySelector(`[data-campus="${location}"]`)) {
    await click('#campus-transfer'); await close(); await click('#campus-btn');
  }
  if (destinationZone(location) === 'atlantic' && app.zone !== 'atlantic') {
    await click('button[data-campus="atlantic"]'); await finishWalk('atlantic');
    await close(); await click('#campus-btn');
  }
  await click(document.querySelector(`button[data-campus="${location}"]`) || el(`[data-campus="${location}"]`));
  await finishWalk(location);
}
async function mission(id) {
  await office(); await click(`[data-mission="${id}"]`);
  await finishWalk(activityDestination(id));
}
async function equip(outfit) {
  await close(); await click('#edit-cadet'); await click('#record-wardrobe');
  await click(`[data-record-outfit="${outfit}"]`); await click('#wardrobe-save');
  assert.equal(state().profile.outfit, outfit);
}
async function importCharacterRecord(record) {
  await close(); await click('#settings-btn');
  const contents = JSON.stringify(record), input = el('#save-file');
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'cadet-record.json', size: contents.length, text: async () => contents }] });
  input.dispatchEvent(new window.Event('change', { bubbles: true })); await settle();
  assert.equal(app.dialogKey, 'confirm-import');
  await click('#confirm-import');
}
async function answerAll(activity, { wrong = false, review = true } = {}) {
  for (let index = 0; index < activity.questions.length; index++) {
    if (index > 0) await click(`[data-question="${index}"]`);
    const question = activity.questions[index];
    await value('[data-answer]', question.answers?.length ? wrong ? 'incorrect test answer' : question.answers[0] : 'I used the supplied source, explained my response, and checked the listed criteria.');
    if (review) for (const checkbox of document.querySelectorAll('[data-criterion]')) {
      checkbox.checked = true; checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    }
  }
  await click('#activity-submit');
}
async function answerSafety(game, { wrong = false, submit = true } = {}) {
  await click('[data-lifeboat-question="0"]');
  for (const [index, question] of game.questions.entries()) {
    const answer = question.answers[0];
    if (question.type === 'choice') {
      const option = question.options.findIndex(value => wrong && index === 0 ? value !== answer : value === answer);
      await click(`[data-lifeboat-choice="${option}"]`);
    } else if (question.type === 'number') {
      await value('#lifeboat-number-answer', wrong && index === 0 ? String(Number(answer) + 1) : answer);
    } else {
      if (!el('#lifeboat-order-clear').disabled) await click('#lifeboat-order-clear');
      let remainder = answer;
      const unused = question.tokens.map((token, tokenIndex) => ({ token, tokenIndex }));
      while (unused.length) {
        const at = unused.findIndex(({ token }) => remainder === token || remainder.startsWith(`${token} `));
        assert.ok(at >= 0, `Safety answer cannot be built from its tiles: ${question.id}`);
        const { token, tokenIndex } = unused.splice(at, 1)[0];
        await click(`[data-lifeboat-tile="${tokenIndex}"]`);
        remainder = remainder.slice(token.length).trimStart();
      }
    }
    if (index < game.questions.length - 1 || submit) await click('#lifeboat-next');
  }
}
async function answerStaff(mission) {
  for (const [index, question] of mission.questions.entries()) {
    await click(`[data-npc-question="${index}"]`);
    assert.equal(el('#npc-question-title').textContent, question.prompt);
    const answer = question.answers[0];
    if (question.type === 'number') await value('#npc-number-answer', answer);
    else if (question.type === 'order') {
      if (!el('#npc-order-clear').disabled) await click('#npc-order-clear');
      let remaining = answer;
      const unused = question.tokens.map((token, tokenIndex) => ({ token, tokenIndex }));
      while (unused.length) {
        const at = unused.findIndex(({ token }) => remaining === token || remaining.startsWith(`${token} `));
        assert.ok(at >= 0, `Staff answer cannot be built from its tiles: ${question.id}`);
        const { token, tokenIndex } = unused.splice(at, 1)[0];
        await click(`[data-npc-tile="${tokenIndex}"]`);
        remaining = remaining.slice(token.length).trimStart();
      }
      assert.equal(el('#npc-order-spoken').textContent, answer);
    } else {
      const option = question.options.findIndex(value => question.answers.includes(value));
      assert.ok(option >= 0, `Missing accepted staff option for ${question.id}`);
      await click(`[data-npc-choice="${option}"]`);
    }
  }
  await click('#npc-question-next');
}
async function openFinalGame(id) {
  await travel('loma-lounge'); await click('[data-loma-filter="all"]');
  const position = state().loma.gameIds.indexOf(id);
  assert.ok(position >= 0, 'The chosen final game belongs to the saved set.');
  for (let page = 0; page < Math.floor(position / 10); page++) await click('#loma-page-next');
  await click(`[data-loma-game="${id}"]`);
}
async function answerLoma(game, { wrong = false, submit = true } = {}) {
  for (const [index, question] of game.questions.entries()) {
    await click(`[data-loma-question="${index}"]`);
    const answer = question.answers[0], incorrect = wrong && index === 0;
    if (question.type === 'choice') {
      const option = question.options.findIndex(value => incorrect ? !question.answers.includes(value) : question.answers.includes(value));
      assert.ok(option >= 0, `No selectable ${incorrect ? 'incorrect' : 'accepted'} answer for ${question.id}`);
      await click(`[data-loma-choice="${option}"]`);
    } else if (question.type === 'number') {
      await value('#loma-number-answer', incorrect ? String(Number(answer) + 1) : answer);
    } else if (question.type === 'text') {
      await value('#loma-text-answer', incorrect ? 'Deliberately incorrect test answer' : answer);
    } else {
      if (!el('#loma-order-clear').disabled) await click('#loma-order-clear');
      let remainder = answer;
      const unused = question.tokens.map((token, tokenIndex) => ({ token, tokenIndex })), indexes = [];
      while (unused.length) {
        const at = unused.findIndex(({ token }) => remainder === token || remainder.startsWith(`${token} `));
        assert.ok(at >= 0, `Final answer cannot be built from its tiles: ${question.id}`);
        const { token, tokenIndex } = unused.splice(at, 1)[0]; indexes.push(tokenIndex);
        remainder = remainder.slice(token.length).trimStart();
      }
      if (incorrect) indexes.reverse();
      for (const tokenIndex of indexes) await click(`[data-loma-tile="${tokenIndex}"]`);
    }
  }
  if (submit) await click('#loma-next');
}
async function pt() {
  await click('[data-fitness="pt"]');
  assert.equal(el('[data-fitness-kind]').dataset.fitnessKind, 'pt');
  if (!el('[data-fitness-relaxed]').checked) {
    el('[data-fitness-relaxed]').checked = true;
    el('[data-fitness-relaxed]').dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  for (let index = 0; index < 16; index++) await click('[data-pt-hold]');
  assert.equal(state().fitness?.kind, 'pt');
}
let passed = 0;
async function test(name, task) { await task(); passed++; process.stdout.write(`PASS ${name}\n`); }

if (reloadSeed) {
  await test('fresh app boot restores the Atlantic room position, chosen uniform and account progress', async () => {
    const before = JSON.stringify(publicState(account, serverNow, ACTIVITIES));
    assert.equal(app.zone, 'atlantic');
    await click('#start-journey');
    assert.equal(app.mode, 'world');
    assert.equal(app.zone, 'atlantic');
    assert.equal(currentWorld.zone, 'atlantic');
    assert.deepEqual(currentWorld.getPosition(), reloadSeed.position);
    assert.equal(state().profile.outfit, reloadSeed.outfit);
    assert.equal(currentWorld.character.outfit, reloadSeed.outfit);
    assert.equal(JSON.stringify(state()), before, 'Continuing inside Atlantic must not change profile, grades, day, fitness or weekly usage.');
    await close(); await click('#edit-cadet');
    assert.ok(el('.record-outfit').textContent.includes(maritimeUniforms.find(([id]) => id === reloadSeed.outfit)[1]));
    assert.doesNotMatch(el('.record-outfit').textContent, /navy shorts|dorm.*casual/i);
    await close(); await click('#campus-btn');
    assert.match(el('#dialog-title').textContent, /Inside Atlantic/);
    assert.ok(el('[data-campus="npc-gerald"]'));
    assert.equal(JSON.parse(storage.get('seapath.world.v2')).zone, 'atlantic');
  });
  process.exit(0);
}

await test('initial creator edits update a returning saved cadet and open the guided first-day mission', async () => {
  assert.equal(app.mode, 'creator');
  assert.match(document.title, /^THE AMCOL WAY/);
  assert.match(el('#brand').textContent, /THE AMCOL WAY/);
  assert.match(el('#brand').getAttribute('aria-label'), /THE AMCOL WAY/);
  // A returning signed-in account exists before the initial creator has loaded it.
  // Choosing a new gender/name here must be applied by Continue, even though the
  // user did not reach this form through the dashboard's Edit action.
  serverAction({ action: 'init', profile: { name: 'Returning Saved Cadet', gender: 'male', uniformBottom: 'pants', outfit: 'polo' } });
  assert.equal(el('#major-options [data-value="deck"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual([...document.querySelectorAll('#outfit-options [data-value]')].map(control => control.dataset.value).sort(), ['cadet', 'coverall', 'immersion', 'maritime', 'maritime-white']);
  await click('#gender-options [data-value="female"]');
  await click('#uniform-bottom-options [data-value="skirt"]');
  await click('#outfit-options [data-value="maritime-white"]');
  assert.equal(currentWorld.character.outfit, 'maritime-white');
  assert.equal(currentWorld.character.gender, 'female');
  assert.equal(currentWorld.character.uniformBottom, 'skirt');
  assert.equal(document.querySelector('#uniform-bottom-options [data-value="pants"]'), null, 'Female campus and maritime uniforms use the fitted skirt.');
  await click('#gender-options [data-value="male"]');
  assert.equal(currentWorld.character.outfit, 'maritime-white');
  assert.equal(document.querySelector('#uniform-bottom-options [data-value="skirt"]'), null);
  assert.equal(currentWorld.character.uniformBottom, 'pants');
  await click('#gender-options [data-value="female"]');
  await click('#uniform-bottom-options [data-value="skirt"]');
  await click('#outfit-options [data-value="cadet"]');
  await value('#cadet-name', 'Jariya Cadet'); await click('#start-journey');
  assert.equal(app.mode, 'world'); assert.equal(state().profile.name, 'Jariya Cadet');
  assert.equal(state().profile.gender, 'female'); assert.equal(state().profile.uniformBottom, 'skirt');
  assert.equal(state().profile.outfit, 'cadet');
  assert.equal(state().profile.major, 'deck');
  assert.match(el('#hud-year').textContent, /DECK/);
  assert.ok(requests.some(request => request.payload?.action === 'profile'
    && request.payload.profile.name === 'Jariya Cadet' && request.payload.profile.gender === 'female'));
  assert.equal(app.dialogKey, 'orientation');
  assert.match(el('#dialog-title').textContent, /first day starts with hello/);
  assert.equal(document.querySelectorAll('[data-orientation-npc]').length, NPCS.length);
  assert.equal(state().day, 1); assert.equal(state().assignments.length, 10);
  assert.equal(state().orientation.completed, false);
  assert.match(el('#hud-time').textContent, /5 \/ 5/);
});

await test('first-day learning and sleep remain locked while the avatar opens the real character dashboard', async () => {
  const id = state().assignments.find(id => getActivity(id).location === 'pacific');
  app.academy.openActivity(id); await settle();
  assert.equal(app.dialogKey, 'orientation');
  assert.equal(document.querySelector('[data-answer]'), null);
  app.academy.openLocation('lifeboat'); await settle();
  assert.equal(app.dialogKey, 'character-wardrobe');
  assert.match(el('#dialog-eyebrow').textContent, /LIFEBOAT CHANGING AREA/);
  await click('#wardrobe-save');
  assert.equal(app.dialogKey, 'lifeboat');
  assert.equal(el('#lifeboat-start-today').disabled, true);
  assert.equal(state().safety.completedCount, 0);
  assert.equal(document.querySelector('[data-lifeboat-choice]'), null);
  await click('#lifeboat-orientation');
  assert.equal(app.dialogKey, 'orientation');
  await equip('cadet');
  app.academy.openNPC('wayne'); await settle();
  assert.equal(el('[data-npc-mission="wayne-sentence-builder"]').disabled, true);
  assert.ok(el('.npc-role-intro').textContent.includes(NPCS.find(npc => npc.id === 'wayne').roleIntro));
  assert.equal(state().orientation.completedCount, 0);
  await close(); await click('#edit-cadet');
  assert.equal(app.dialogKey, 'character-record');
  assert.equal(app.mode, 'world', 'The avatar opens a dashboard without returning to creation.');
  assert.match(el('#dialog-eyebrow').textContent, /YOUR RPG CADET RECORD/);
  assert.match(el('.record-outfit').textContent, /white long sleeves.*black fitted skirt/i);
  assert.ok(el('.record-orientation').textContent.includes(`0 / ${NPCS.length}`));
  await click('#record-orientation');
  assert.equal(app.dialogKey, 'orientation');
  await click('#orientation-office'); await click('#office-dorm');
  assert.equal(app.zone, 'dorm');
  assert.equal(el('#dorm-sleep-now').disabled, true);
  assert.match(el('.sleep-card').textContent, /Meet your AMCOL team first/);
  assert.equal(state().day, 1); assert.equal(state().week.used, 0);
});

await test('first-day route saves every explicit role acknowledgement across all three districts and unlocks same-day learning', async () => {
  const order = ['amara', ...ORIENTATION_ROUTE.filter(id => !['amara', 'bank', 'duke'].includes(id)), 'bank', 'duke'];
  for (const [index, npcId] of order.entries()) {
    if (index === 12) {
      const before = JSON.stringify(state());
      assert.equal(state().orientation.completedCount, 12);
      assert.deepEqual([...state().orientation.remainingIds].sort(), ['bank', 'duke']);
      for (const [roomId, teacher] of [['atlantic-ecdis', 'duke'], ['atlantic-gmdss', 'bank']]) {
        await travel(roomId);
        for (const mission of getNPCMissions(teacher)) {
          assert.equal(el(`[data-atlantic-mission="${mission.id}"]`).disabled, true);
          assert.match(el(`[data-atlantic-mission="${mission.id}"]`).textContent, /14 staff/);
        }
      }
      assert.equal(JSON.stringify(state()), before, 'Room visits cannot bypass the two missing staff introductions.');
    }
    app.academy.openOrientation(); await settle();
    await click(`[data-orientation-npc="${npcId}"]`);
    const npc = NPCS.find(item => item.id === npcId);
    await finishWalk(`npc-${npcId}`, '#mobile-interact');
    assert.equal(app.zone, npc.zone);
    assert.equal(el('#dialog-title').textContent, npc.name);
    assert.ok(el('.npc-role-intro').textContent.includes(npc.roleIntro));
    assert.equal(state().orientation.completedCount, index, 'Just visiting the NPC does not acknowledge the introduction.');
    if (['amara', 'asawin', 'gerald', 'bank', 'duke'].includes(npcId)) {
      assert.equal(state().profile.outfit, 'cadet');
      assert.equal(document.querySelector('#wardrobe-save'), null, 'Workshop and Engine staff introductions remain available in campus uniform.');
    }
    await click('#npc-introduce');
    assert.equal(state().orientation.completedCount, index + 1);
  }
  assert.equal(app.dialogKey, 'orientation');
  assert.match(el('#dialog-title').textContent, /You know your AMCOL team/);
  assert.equal(state().orientation.completed, true);
  assert.equal(state().day, 1); assert.equal(state().week.used, 0);
  assert.equal(state().totalCompleted, 0); assert.equal(state().npc.completed, 0);
  await click('#orientation-office');
  assert.equal(el('#dialog-title').textContent, 'Academic Office');
  assert.equal(document.querySelector('[data-open-orientation]'), null);
});

await test('touch joystick, Run and camera stop cleanly for menus and interruptions', async () => {
  assert.equal(joystickBase.disabled, true, 'The open Office must pause the joystick.');
  await close();
  if (fallback) {
    assert.equal(joystickBase.disabled, true, 'Learning mode does not enable unavailable 3D movement.');
    return;
  }
  assert.equal(joystickBase.disabled, false);
  const pointer = (type, x = 117, z = 166, pointerId = 31) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clientX: x, clientY: z, pointerId, pointerType: 'touch', button: 0 });
    joystickBase.dispatchEvent(event);
  };
  pointer('pointerdown'); assert.equal(currentWorld.touch.x, 1);
  await click('#mobile-run');
  assert.equal(currentWorld.touch.run, true);
  assert.equal(el('#mobile-run').getAttribute('aria-pressed'), 'true');
  assert.equal(el('#mobile-run [data-run-label]').textContent, 'Running');
  assert.ok(el('#mobile-run [data-icon="bolt"] svg'), 'Run toggle should preserve its icon.');
  await click('#mobile-camera-left'); assert.equal(currentWorld.cameraTurns, -1);
  await click('#mobile-camera-right'); assert.equal(currentWorld.cameraTurns, 0);
  await click('#mobile-camera-reset'); assert.equal(currentWorld.cameraResets, 1);
  await click('#camera-left'); assert.equal(currentWorld.cameraTurns, -1);
  await click('#camera-right'); assert.equal(currentWorld.cameraTurns, 0);
  await click('#camera-reset'); assert.equal(currentWorld.cameraResets, 2);
  const cameraHold = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  Object.assign(cameraHold, { pointerId: 41, pointerType: 'touch', button: 0 });
  el('#mobile-camera-left').dispatchEvent(cameraHold);
  for (const [id, timer] of [...timers]) if (timer.delay === 220) { timers.delete(id); timer.callback(); }
  assert.equal(currentWorld.cameraInput, -1, 'A held camera button sends continuous rotation to the world.');
  pointer('pointercancel'); assert.equal(currentWorld.touch.x, 0); assert.equal(currentWorld.touch.z, 0);
  pointer('pointerdown');
  await click('#help-btn');
  assert.equal(joystickBase.disabled, true); assert.equal(currentWorld.touch.x, 0); assert.equal(currentWorld.touch.run, false);
  assert.equal(currentWorld.cameraInput, 0);
  assert.equal(el('#camera-left').disabled, true); assert.equal(el('#mobile-camera-reset').disabled, true);
  assert.equal(el('#mobile-run').getAttribute('aria-pressed'), 'false');
  await close();
  assert.equal(currentWorld.cameraInput, 0, 'Closing a menu cannot resume a held camera turn.');
  pointer('pointermove'); assert.equal(currentWorld.touch.x, 0, 'Closing a menu must not resume the previous touch.');
  pointer('pointerdown'); await click('#mobile-run');
  window.dispatchEvent(new window.Event('blur'));
  assert.equal(currentWorld.touch.x, 0); assert.equal(currentWorld.touch.run, false);
  assert.equal(el('#mobile-run').getAttribute('aria-pressed'), 'false');
  pointer('pointerdown');
  document.hidden = true; document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(joystickBase.disabled, true); assert.equal(currentWorld.touch.x, 0);
  document.hidden = false; document.dispatchEvent(new window.Event('visibilitychange')); await settle();
  assert.equal(joystickBase.disabled, false); assert.equal(currentWorld.touch.x, 0);
  await office();
});

await test('all fourteen staff routes expose playable learning or the explicit Year 2 review in their correct district', async () => {
  const unchanged = JSON.stringify(state());
  const visits = [];
  for (const npc of NPCS) {
    await close(); await click('#staff-btn');
    assert.equal(document.querySelectorAll('.npc-directory [data-meet-npc]').length, NPCS.length);
    await click(`[data-meet-npc="${npc.id}"]`);
    const station = NPC_STATIONS.find(item => item.npcId === npc.id);
    assert.ok(station, `Missing world destination for ${npc.name}`);
    await finishWalk(`npc-${npc.id}`, '#mobile-interact');
    assert.equal(app.zone, station.zone, `${npc.name} must be in the correct scene.`);
    assert.equal(el('#dialog-title').textContent, npc.name);
    assert.equal(document.querySelectorAll('.npc-mission-list [data-npc-mission]').length, getNPCMissions(npc.id).length);
    const playable = [...document.querySelectorAll('.npc-mission-list [data-npc-mission]')].filter(control => !control.disabled);
    if (npc.id === 'dream') {
      assert.equal(playable.length, 0); assert.equal(el('[data-sea-status]').dataset.seaStatus, 'locked');
    } else assert.ok(playable.length > 0, `${npc.name} must offer a Year 1 mini-game after orientation.`);
    visits.push({ id: npc.id, zone: app.zone });
  }
  const yakIndex = visits.findIndex(visit => visit.id === 'yak');
  assert.equal(visits[yakIndex].zone, 'dorm');
  assert.equal(visits[yakIndex + 1]?.zone, NPCS[yakIndex + 1].zone, 'The next staff visit leaves the dormitory for the correct district.');
  assert.equal(JSON.stringify(state()), unchanged, 'Visiting staff must preserve the cadet profile, grades, game day and weekly allowance.');
  await office();
});

await test('Atlantic entrance, five room menus and room maps connect the correct indoor staff without changing progress', async () => {
  if (app.zone !== 'campus') { await close(); await click('#campus-btn'); await click('#campus-transfer'); }
  const before = JSON.stringify(state()), posts = requests.filter(request => request.method === 'POST').length;
  const entrance = STATIONS.find(station => station.id === 'atlantic');
  const roomStaff = { captain: ['chalermvut'], bridge: ['jakk'], engine: ['asawin', 'gerald'], ecdis: ['duke'], gmdss: ['bank'] };
  const rooms = ATLANTIC_STATIONS.filter(station => station.room);
  for (const room of rooms) {
    // Opening an indoor room from outside must first route through the building entrance.
    app.academy.openLocation(room.id); await settle();
    await finishWalk(room.id);
    assert.equal(app.dialogKey, 'atlantic-room');
    assert.equal(el('#dialog-title').textContent, room.name);
    assert.deepEqual([...document.querySelectorAll('[data-meet-npc]')].map(control => control.dataset.meetNpc).sort(), roomStaff[room.room]);
    assert.equal(document.querySelector('[data-meet-npc="dream"]'), null, 'Tr. Dream stays at the outside entrance.');
    assert.equal(currentWorld.character.outfit, 'cadet');
    for (const control of document.querySelectorAll('[data-activity]')) assert.equal(getActivity(control.dataset.activity).room, room.room);
    const expectedMissions = roomStaff[room.room].flatMap(id => getNPCMissions(id));
    assert.deepEqual([...document.querySelectorAll('[data-atlantic-mission]')].map(control => control.dataset.atlanticMission).sort(), expectedMissions.map(mission => mission.id).sort());
    for (const staffMission of expectedMissions) {
      assert.equal(el(`[data-atlantic-mission="${staffMission.id}"]`).disabled, !state().npc.available.includes(staffMission.id));
    }
    const firstGame = expectedMissions.find(mission => state().npc.available.includes(mission.id));
    assert.ok(firstGame, `${room.name} must offer playable teacher learning even when it has no released book activity.`);
    await click(`[data-atlantic-mission="${firstGame.id}"]`);
    assert.equal(app.dialogKey, 'npc-game');
    assert.equal(el('#dialog-title').textContent, firstGame.title);
    assert.equal(document.querySelector('#wardrobe-save'), null, 'All Atlantic simulator and office games accept the campus uniform.');
    app.academy.openLocation(room.id); await settle();
    await click('#atlantic-room-lobby'); await finishWalk('atlantic-lobby');
    assert.equal(app.dialogKey, 'atlantic-lobby');
    assert.equal(document.querySelectorAll('[data-atlantic-room]').length, 5);
    await click(`[data-atlantic-room="${room.id}"]`); await finishWalk(room.id);
    await click('#atlantic-room-map');
    assert.equal(app.dialogKey, 'campus');
    assert.deepEqual([...new Set([...document.querySelectorAll('[data-campus]')].map(control => control.dataset.campus))].sort(), ATLANTIC_DESTINATIONS.map(station => station.id).sort());
    await click('#campus-transfer');
    assert.equal(app.zone, 'campus');
    assert.deepEqual(currentWorld.getPosition(), { x: entrance.x, z: entrance.z });
  }
  await travel('atlantic');
  assert.equal(app.dialogKey, 'atlantic-lobby');
  await click('#atlantic-office'); assert.equal(el('#dialog-title').textContent, 'Academic Office');
  app.academy.openAtlantic(); await settle();
  await click('#atlantic-staff'); assert.equal(app.dialogKey, 'staff-directory');
  app.academy.openAtlantic(); await settle();
  await click('#atlantic-return-campus');
  assert.equal(app.zone, 'campus');
  assert.deepEqual(currentWorld.getPosition(), { x: entrance.x, z: entrance.z });
  app.academy.openLocation('atlantic-engine'); await settle(); await finishWalk('atlantic-engine');
  await click('#atlantic-room-office'); assert.equal(el('#dialog-title').textContent, 'Academic Office');
  app.academy.openLocation('atlantic-engine'); await settle();
  await click('#atlantic-room-exit');
  assert.equal(app.zone, 'campus');
  assert.deepEqual(currentWorld.getPosition(), { x: entrance.x, z: entrance.z });
  const bookId = state().assignments.find(id => getActivity(id).location === 'atlantic');
  await mission(bookId);
  assert.equal(app.zone, 'atlantic');
  assert.equal(el('#dialog-title').textContent, getActivity(bookId).title, 'An outside Office task must retain its activity intent through the Atlantic entrance.');
  assert.ok(el('[data-answer]'));
  await close(); await click('#campus-btn'); await click('#campus-transfer');
  assert.equal(app.zone, 'campus');
  assert.equal(JSON.stringify(state()), before);
  assert.equal(requests.filter(request => request.method === 'POST').length, posts, 'Room exploration must not write a profile or consume learning/reset allowance.');
});

await test('Engine Simulator staff accept campus uniform; both maritime outfits survive reload and dorm visits while retaining training gates', async () => {
  const before = JSON.stringify(state());
  for (const [npcId, missionId] of [['asawin', 'asawin-workshop-ready'], ['gerald', 'gerald-display-reader']]) {
    await close(); await click('#staff-btn'); await click(`[data-meet-npc="${npcId}"]`);
    await finishWalk(`npc-${npcId}`);
    await click(`[data-npc-mission="${missionId}"]`);
    assert.equal(app.zone, 'atlantic');
    assert.equal(app.dialogKey, 'npc-game');
    assert.ok(el('#npc-question-title'));
    assert.equal(document.querySelector('#wardrobe-save'), null, 'Engine Simulator tasks do not require Workshop clothes.');
    assert.equal(state().profile.outfit, 'cadet');
  }
  assert.equal(JSON.stringify(state()), before, 'Opening simulator games must not award or reattribute staff sign-offs.');
  for (const [outfit, label] of maritimeUniforms) {
    await equip(outfit);
    await close(); await click('#edit-cadet');
    assert.ok(el('.record-outfit').textContent.includes(label));
    assert.doesNotMatch(el('.record-outfit').textContent, /navy shorts|dorm.*casual/i);
    assert.equal(state().profile.uniformBottom, 'skirt');
    document.hidden = true; document.dispatchEvent(new window.Event('visibilitychange')); await settle();
    const saved = JSON.parse(storage.get('seapath.world.v2'));
    assert.equal(saved.zone, 'atlantic');
    assert.deepEqual(saved.atlantic, currentWorld.getPosition());
    assert.ok(saved.campus && saved.dorm, 'Saving Atlantic must retain the other district positions.');
    const replay = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url), '--reload-atlantic', ...(fallback ? ['--fallback'] : [])], {
      encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, SEAPATH_QA_RELOAD: JSON.stringify({ account, serverNow, revision, storage: [...storage], position: saved.atlantic, outfit }) },
    });
    assert.equal(replay.status, 0, `Fresh ${label} Atlantic reload failed:\n${replay.stdout}\n${replay.stderr}`);
    document.hidden = false; document.dispatchEvent(new window.Event('visibilitychange')); await settle();
    const savedUniform = JSON.stringify(state()), writes = requests.filter(request => request.method === 'POST').length;
    await office(); await click('#office-dorm');
    await close(); await click('#edit-cadet');
    assert.match(el('.record-outfit').textContent, /Dormitory casual clothes.*navy blue shorts/i);
    assert.equal(state().profile.outfit, outfit, 'Dorm casual must remain a display-only outfit.');
    assert.equal(JSON.parse(storage.get('seapath.save.v1')).character.outfit, outfit);
    await travel('atlantic');
    await close(); await click('#edit-cadet');
    assert.ok(el('.record-outfit').textContent.includes(label));
    assert.equal(currentWorld.character.outfit, outfit);
    for (const location of ['workshop', 'lifeboat']) {
      app.academy.openLocation(location); await settle();
      assert.equal(app.dialogKey, 'character-wardrobe', `${label} must not bypass the ${location} gear gate.`);
      assert.equal(state().profile.outfit, outfit);
      for (const [uniformId] of maritimeUniforms) assert.equal(el(`[data-record-outfit="${uniformId}"]`).disabled, true);
    }
    assert.equal(JSON.stringify(state()), savedUniform);
    assert.equal(requests.filter(request => request.method === 'POST').length, writes, 'Dorm clothing and rejected training entry must not write profile or progression.');
  }
  await equip('cadet');
  assert.equal(JSON.stringify(state()), before);
  await close(); await click('#campus-btn'); await click('#campus-transfer');
  assert.equal(app.zone, 'campus');
});

await test('both Loma Café entrances offer account-saved care with failed-save recovery and once-per-day rewards', async () => {
  for (const entrance of ['cafe', 'cafe-west']) {
    await travel(entrance);
    assert.match(el('#dialog-title').textContent, /Loma Café/);
    for (const kind of ['water', 'meal', 'rest']) assert.ok(el(`[data-rpg-care="${kind}"]`));
  }
  const courseRecord = s => JSON.stringify({ profile: s.profile, day: s.day, semester: s.semester, results: s.results, npc: s.npc, safety: s.safety, loma: s.loma, fitness: s.fitness, week: s.week });
  const progressBefore = courseRecord(state()), rpgBefore = JSON.stringify(state().rpg), xpBefore = getCharacterSummary(state()).totalXP;
  const waterMarkup = el('[data-rpg-care="water"]').innerHTML;
  assert.match(waterMarkup, /<svg/);
  nextFailure = true; await click('[data-rpg-care="water"]');
  assert.equal(JSON.stringify(state().rpg), rpgBefore, 'Failed care saves cannot refill a stat or award XP.');
  assert.equal(el('[data-rpg-care="water"]').disabled, false);
  assert.equal(el('[data-rpg-care="water"]').innerHTML, waterMarkup, 'A failed save must retain the rich care label, icon and reward details for retry.');
  await click('[data-rpg-care="water"]');
  assert.equal(state().rpg.wellbeing.careToday.water, true);
  assert.equal(el('[data-rpg-care="water"]').disabled, true);
  assert.equal(getCharacterSummary(state()).totalXP, xpBefore + 2);
  assert.equal(el('#rpg-reward').hidden, false); assert.match(el('#rpg-reward').textContent, /\+2 XP.*Fitness \+2/);
  for (const kind of ['meal', 'rest']) await click(`[data-rpg-care="${kind}"]`);
  assert.equal(getCharacterSummary(state()).totalXP, xpBefore + 6);
  assert.ok(['water', 'meal', 'rest'].every(kind => state().rpg.wellbeing.careToday[kind]));
  const savedRPG = JSON.stringify(state().rpg), requestCount = requests.length;
  await travel('cafe-west');
  for (const kind of ['water', 'meal', 'rest']) assert.equal(el(`[data-rpg-care="${kind}"]`).disabled, true);
  assert.equal(requests.length, requestCount, 'A second entrance must not trigger care or rewards.');
  assert.equal(JSON.stringify(state().rpg), savedRPG);
  assert.equal(courseRecord(state()), progressBefore);
  assert.equal(el('#hud-energy').textContent, String(state().rpg.wellbeing.energy));
});

await test('both Loma Lounge entrances open the final board while earlier years remain locked', async () => {
  const before = JSON.stringify(state()), requestCount = requests.length;
  const energyBefore = state().rpg.wellbeing.energy;
  for (const entrance of ['loma-lounge', 'loma-lounge-east']) {
    await travel(entrance);
    assert.equal(app.dialogKey, 'loma');
    assert.match(el('#dialog-title').textContent, /Loma Lounge final/);
    assert.match(el('.loma-notice').textContent, /Year 4, Semester 2/);
    assert.equal(document.querySelector('#loma-begin-final'), null);
    assert.equal(document.querySelector('[data-rpg-care]'), null);
    assert.equal(state().rpg.wellbeing.energy, energyBefore, 'An exam entrance is not an energy refill.');
  }
  assert.equal(requests.length, requestCount);
  assert.equal(JSON.stringify(state()), before);
  assert.equal(state().loma.started, false); assert.equal(state().loma.major, 'deck');
});

await test('the Lifeboat map route requires a saved immersion suit before recording an imperfect attempt', async () => {
  const xpBefore = getCharacterSummary(state()).totalXP, rpgBefore = JSON.stringify(state().rpg);
  const academicBefore = JSON.stringify({ results: state().results, npc: state().npc, semester: state().semester, assignments: state().assignments, day: state().day, week: state().week });
  assert.equal(state().profile.outfit, 'cadet');
  await travel('lifeboat');
  assert.equal(app.dialogKey, 'character-wardrobe');
  assert.match(el('#dialog-eyebrow').textContent, /LIFEBOAT CHANGING AREA/);
  assert.equal(el('[data-record-outfit="coverall"]').disabled, true);
  nextFailure = true; await click('#wardrobe-save');
  assert.equal(state().profile.outfit, 'cadet');
  assert.equal(el('#wardrobe-save').disabled, false);
  await click('#wardrobe-save');
  assert.equal(app.dialogKey, 'lifeboat');
  assert.equal(state().profile.outfit, 'immersion');
  assert.match(el('#dialog-title').textContent, /Lifeboat safety/);
  const id = state().safety.todayId, game = SAFETY_GAMES.find(game => game.id === id);
  assert.equal(game.year, 1);
  assert.equal(state().safety.unlockedIds.length, 2);
  assert.equal(document.querySelector('#wardrobe-save'), null, 'Only the successfully saved immersion suit admits Lifeboat learning.');
  await click('#lifeboat-start-today');
  assert.equal(app.dialogKey, 'lifeboat-game');
  await answerSafety(game, { wrong: true });
  assert.equal(state().safety.results[id].completed, false);
  assert.equal(state().safety.results[id].attempts, 1);
  assert.equal(state().safety.results[id].objectiveCorrect, 3);
  assert.equal(state().safety.results[id].objectiveTotal, 4);
  assert.match(el('.lifeboat-feedback').textContent, /Review this answer/);
  assert.equal(getCharacterSummary(state()).totalXP, xpBefore);
  assert.equal(JSON.stringify(state().rpg), rpgBefore, 'An imperfect safety attempt must not award skills or spend wellbeing.');
  assert.equal(state().safety.todayId, id, 'An attempt does not release a different same-day game.');
  assert.equal(JSON.stringify({ results: state().results, npc: state().npc, semester: state().semester, assignments: state().assignments, day: state().day, week: state().week }), academicBefore);
});

await test('failed safety saves retain all answers and a successful retry earns one completion and 10 XP', async () => {
  const xpBefore = getCharacterSummary(state()).totalXP;
  const id = state().safety.todayId, game = SAFETY_GAMES.find(game => game.id === id);
  await answerSafety(game, { submit: false });
  nextFailure = true;
  await click('#lifeboat-next');
  const failedAnswers = requests.at(-1).payload.answers;
  assert.equal(state().safety.results[id].completed, false);
  assert.equal(state().safety.results[id].attempts, 1, 'A network failure does not save another attempt.');
  assert.equal(el('#lifeboat-next').disabled, false);
  assert.equal(document.querySelectorAll('[data-lifeboat-remove]').length, game.questions.at(-1).tokens.length);
  await click('#lifeboat-next');
  assert.deepEqual(requests.at(-1).payload.answers, failedAnswers, 'Retry must submit the retained answers.');
  assert.equal(app.dialogKey, 'lifeboat-result');
  assert.equal(state().safety.results[id].completed, true);
  assert.equal(state().safety.results[id].attempts, 2);
  assert.equal(account.journey.safetyResults[id].completed, true);
  assert.equal(state().safety.completedCount, 1);
  assert.equal(getCharacterSummary(state()).totalXP, xpBefore + 10);
  assert.match(el('#xp-label').textContent, new RegExp(`${xpBefore + 10} XP`));
  assert.equal(el('#rpg-reward').hidden, false); assert.match(el('#rpg-reward').textContent, /\+10 XP.*Safety \+/);
  assert.equal(state().safety.todayId, id);
  assert.equal(state().day, 1); assert.equal(state().week.used, 0);
  await click('#lifeboat-result-record');
  assert.equal(app.dialogKey, 'lifeboat-record');
  assert.deepEqual([...document.querySelectorAll('.lifeboat-saved-answer')].map(node => node.textContent), game.questions.map(question => question.answers[0]));
});

await test('saved safety practice keeps account results and XP while Office and dashboard return to the Lifeboat', async () => {
  const id = state().safety.todayId, game = SAFETY_GAMES.find(game => game.id === id);
  const before = JSON.stringify(state()), requestCount = requests.length, xpBefore = getCharacterSummary(state()).totalXP;
  await click('#lifeboat-record-practice');
  await answerSafety(game);
  assert.equal(app.dialogKey, 'lifeboat-result');
  assert.match(el('#dialog-title').textContent, /Practice complete/);
  assert.equal(requests.length, requestCount, 'Unsubmitted practice does not write a result.');
  assert.equal(JSON.stringify(state()), before);
  await close(); await click('#edit-cadet');
  assert.equal(el('[data-record-area="safety"] [role="progressbar"]').getAttribute('aria-valuenow'), '1');
  await click('#record-lifeboat');
  if (app.engineAvailable) { assert.equal(currentWorld.destination, 'lifeboat'); await click('#interaction-prompt'); }
  assert.equal(app.dialogKey, 'lifeboat');
  assert.match(el('#lifeboat-start-today').textContent, /Practise/);
  await office(); await click('#office-lifeboat');
  if (app.engineAvailable) { assert.equal(currentWorld.destination, 'lifeboat'); await click('#interaction-prompt'); }
  assert.equal(app.dialogKey, 'lifeboat');
  assert.equal(getCharacterSummary(state()).totalXP, xpBefore);
  assert.equal(state().safety.todayId, id);
});

await test('Workshop entry and its book task require a saved suit, with recovery from an unsuccessful equip request', async () => {
  const id = state().assignments.find(id => getActivity(id).location === 'workshop');
  app.academy.openLocation('workshop'); await settle();
  assert.equal(app.dialogKey, 'character-wardrobe');
  assert.match(el('#dialog-eyebrow').textContent, /WORKSHOP CHANGING AREA/);
  assert.equal(state().profile.outfit, 'immersion', 'The Lifeboat outfit must not satisfy Workshop entry.');
  assert.equal(el('[data-record-outfit="cadet"]').disabled, true);
  nextFailure = true; await click('#wardrobe-save');
  assert.equal(state().profile.outfit, 'immersion');
  assert.equal(el('#wardrobe-save').disabled, false);
  assert.match(el('#wardrobe-save-message').textContent, /not saved|try again/i);
  await click('#wardrobe-save');
  assert.equal(state().profile.outfit, 'coverall');
  assert.equal(currentWorld.character.outfit, 'coverall');
  assert.equal(el('#dialog-title').textContent, STATIONS.find(station => station.id === 'workshop').name);
  assert.equal(state().profile.gender, 'female'); assert.equal(state().profile.uniformBottom, 'skirt');
  await equip('cadet');
  app.academy.openActivity(id); await settle();
  assert.equal(app.dialogKey, 'character-wardrobe');
  assert.equal(document.querySelector('[data-answer]'), null);
  await click('#wardrobe-save');
  assert.ok(el('[data-answer]'));
  assert.equal(el('#dialog-title').textContent, getActivity(id).title);
  assert.equal(state().day, 1); assert.equal(state().week.used, 0);
  assert.equal(state().results[id], undefined, 'Equipping and opening a task must not award completion.');
});

await test('the changing-area map destination and Amara mission both resume after saved Workshop coveralls', async () => {
  await equip('cadet');
  await travel('workshop-changing');
  assert.equal(app.dialogKey, 'character-wardrobe');
  assert.equal(state().profile.outfit, 'cadet');
  await click('#wardrobe-save');
  assert.equal(state().profile.outfit, 'coverall');
  assert.equal(el('#dialog-title').textContent, STATIONS.find(station => station.id === 'workshop').name);
  await equip('cadet');
  app.academy.openNPC('amara'); await settle();
  await click('[data-npc-mission="amara-workshop-ready"]');
  assert.equal(app.dialogKey, 'character-wardrobe');
  await click('#wardrobe-save');
  assert.equal(app.dialogKey, 'npc-game');
  assert.ok(el('#npc-question-title'));
  assert.equal(state().profile.outfit, 'coverall');
  assert.equal(state().npc.results['amara-workshop-ready'], undefined);
});

await test('saving an outfit after opening Help updates the avatar without replacing the chosen dialog', async () => {
  await equip('cadet');
  app.academy.openLocation('workshop'); await settle();
  const release = deferNextRequest(); await click('#wardrobe-save');
  assert.equal(el('#wardrobe-save').disabled, true);
  await click('#help-btn');
  const title = el('#dialog-title').textContent, key = app.dialogKey;
  release(); await settle();
  assert.equal(state().profile.outfit, 'coverall');
  assert.equal(currentWorld.character.outfit, 'coverall');
  assert.equal(app.dialogKey, key); assert.equal(el('#dialog-title').textContent, title);
  assert.match(title, /cadet life/);
  assert.equal(state().day, 1); assert.equal(state().week.used, 0);
});

await test('all ten campus locations open their assigned activities', async () => {
  for (const station of STATIONS) {
    await travel(station.id);
    assert.equal(el('#dialog-title').textContent, station.id === 'academic' ? 'Academic Office' : station.id === 'atlantic' ? 'Inside Atlantic Building' : station.name);
    const id = state().assignments.find(id => getActivity(id).location === station.id);
    assert.ok(id, `No initial assignment at ${station.id}`);
    if (['academic', 'atlantic'].includes(station.id)) {
      await click(`[data-mission="${id}"]`);
      await finishWalk(activityDestination(id));
    } else await click(`[data-activity="${id}"]`);
    if (getActivity(id).type === 'present') assert.ok(el('#studio-tasks'));
    else assert.ok(el('[data-answer]'));
    assert.notEqual(el('#dialog-title').textContent, 'Academic Office', `Academic mission returned to office instead of opening ${id}`);
  }
});

await test('remote outfit refresh updates the world and Workshop gate while preserving an unsaved creator draft', async () => {
  await close();
  assert.equal(state().profile.outfit, 'coverall');
  const saved = JSON.stringify({ results: state().results, npc: state().npc.results, day: state().day, week: state().week });
  const revisit = async () => {
    document.hidden = true; document.dispatchEvent(new window.Event('visibilitychange'));
    document.hidden = false; document.dispatchEvent(new window.Event('visibilitychange')); await settle();
  };
  // A different tab saved a uniform. Until this tab refreshes it still displays
  // the previous suit, so the accepted GET must update both the cache and world.
  serverAction({ action: 'profile', ...tokens(), profile: { ...state().profile, outfit: 'cadet' } });
  assert.equal(currentWorld.character.outfit, 'coverall');
  await revisit();
  assert.equal(state().profile.outfit, 'cadet');
  assert.equal(currentWorld.character.outfit, 'cadet');
  assert.equal(JSON.parse(storage.get('seapath.save.v1')).character.outfit, 'cadet');
  app.academy.openLocation('workshop'); await settle();
  assert.equal(app.dialogKey, 'character-wardrobe');
  await close();
  serverAction({ action: 'profile', ...tokens(), profile: { ...state().profile, outfit: 'coverall' } });
  await app.academy.refresh(); await settle();
  assert.equal(currentWorld.character.outfit, 'coverall');
  assert.equal(JSON.parse(storage.get('seapath.save.v1')).character.outfit, 'coverall');
  const unchangedAvatar = currentWorld.character;
  await app.academy.refresh(); await settle();
  assert.equal(currentWorld.character, unchangedAvatar, 'An unchanged accepted profile must not rebuild the avatar.');
  app.academy.openLocation('workshop'); await settle();
  assert.equal(el('#dialog-title').textContent, STATIONS.find(station => station.id === 'workshop').name);
  assert.equal(document.querySelector('#wardrobe-save'), null);

  await close(); await click('#edit-cadet'); await click('#record-wardrobe'); await click('#wardrobe-edit');
  assert.equal(app.mode, 'creator');
  await value('#cadet-name', 'My unsaved creator draft');
  await click('#gender-options [data-value="male"]');
  await click('#outfit-options [data-value="maritime"]');
  await click('#major-options [data-value="engine"]');
  assert.match(el('#creator-path-title').textContent, /Engine officer/);
  await click('#hair-options [data-value="crop"]');
  serverAction({ action: 'profile', ...tokens(), profile: { ...state().profile, name: 'Remote saved name', outfit: 'coverall', gender: 'female', uniformBottom: 'skirt' } });
  await revisit();
  assert.equal(state().profile.name, 'Remote saved name', 'The account state accepts the newer saved profile.');
  assert.equal(state().profile.outfit, 'coverall');
  assert.equal(app.mode, 'creator');
  assert.equal(el('#cadet-name').value, 'My unsaved creator draft');
  assert.equal(el('#gender-options [data-value="male"]').getAttribute('aria-pressed'), 'true');
  assert.equal(el('#outfit-options [data-value="maritime"]').getAttribute('aria-pressed'), 'true');
  assert.equal(el('#major-options [data-value="engine"]').getAttribute('aria-pressed'), 'true');
  assert.equal(el('#hair-options [data-value="crop"]').getAttribute('aria-pressed'), 'true');
  assert.equal(currentWorld.character.gender, 'male');
  assert.equal(currentWorld.character.outfit, 'maritime');
  assert.equal(currentWorld.character.major, 'engine');
  assert.equal(currentWorld.character.name, 'My unsaved creator draft');
  // Save an intentional final choice and leave the shared fixture ready for the
  // remaining academic checks; no grade, day, or quota has been changed.
  await value('#cadet-name', 'Jariya Cadet');
  await click('#gender-options [data-value="female"]');
  await click('#uniform-bottom-options [data-value="skirt"]');
  await click('#outfit-options [data-value="coverall"]');
  await click('#start-journey');
  assert.equal(app.mode, 'world');
  assert.equal(state().profile.name, 'Jariya Cadet');
  assert.equal(state().profile.outfit, 'coverall');
  assert.equal(state().profile.major, 'engine');
  assert.match(el('#hud-year').textContent, /ENGINE/);
  assert.equal(JSON.stringify({ results: state().results, npc: state().npc.results, day: state().day, week: state().week }), saved);
});

await test('a delayed book completion saves its answers without replacing a later wardrobe or clearing its unsaved choices', async () => {
  const id = state().assignments.find(item => getActivity(item).location === 'cruise');
  const activity = getActivity(id), beforeProfile = JSON.stringify(state().profile);
  assert.equal(state().results[id]?.completed, undefined);
  await mission(id);
  const release = deferNextRequest();
  await answerAll(activity);
  assert.equal(el('#activity-submit').disabled, true);
  assert.equal(state().results[id]?.completed, undefined, 'The server request is still pending.');
  await click('#edit-cadet'); await click('#record-wardrobe');
  await click('[data-record-gender="male"]');
  await click('[data-record-outfit="maritime"]');
  assert.equal(app.dialogKey, 'character-wardrobe');
  const portrait = el('#wardrobe-portrait').innerHTML;
  release(); await settle();
  assert.equal(state().results[id].completed, true);
  assert.equal(account.journey.results[id].completed, true);
  assert.equal(Object.keys(state().results[id].answers).length, activity.questions.length);
  assert.ok(Object.values(state().results[id].answers).every(answer => String(answer).trim()));
  assert.equal(app.dialogKey, 'character-wardrobe');
  assert.equal(el('[data-record-gender="male"]').getAttribute('aria-pressed'), 'true');
  assert.equal(el('[data-record-outfit="maritime"]').getAttribute('aria-pressed'), 'true');
  assert.equal(el('#wardrobe-portrait').innerHTML, portrait);
  assert.equal(el('#wardrobe-save').disabled, false);
  assert.equal(JSON.stringify(state().profile), beforeProfile, 'Unsaved wardrobe choices must not be committed by a book save.');
  assert.equal(state().day, 1); assert.equal(state().week.used, 0);
  await close();
});

const exactId = state().assignments.find(id => getActivity(id).location === 'pacific');
const openId = state().assignments.find(id => getActivity(id).location === 'entrance');
await test('drafts and original book source pages survive reader navigation', async () => {
  await mission(openId); await value('[data-answer]', 'My first campus draft.');
  const sourceButton = el('[data-page-open]'); const page = Number(sourceButton.dataset.pageOpen);
  await click(sourceButton); assert.equal(Number(el('#book-page-number').value), page);
  await value('#book-page-number', '12'); await click('#book-go');
  assert.equal(Number(el('#book-page-number').value), 12);
  await click('#book-resume'); assert.equal(el('[data-answer]').value, 'My first campus draft.');
  await click('#activity-save-exit'); await mission(openId);
  assert.equal(el('[data-answer]').value, 'My first campus draft.');
});

await test('wrong exact answers retain the attempt; correct answers complete the mini-game', async () => {
  await mission(exactId); await answerAll(getActivity(exactId), { wrong: true });
  assert.equal(state().results[exactId].completed, false);
  assert.equal(state().results[exactId].attempts, 1);
  await click('[data-question="0"]'); await answerAll(getActivity(exactId));
  assert.equal(state().results[exactId].completed, true);
  assert.equal(state().results[exactId].attempts, 2);
  assert.equal(state().results[exactId].outcome, 'correct');
});

await test('multiple-choice games are checked automatically: a wrong option fails, the right option completes', async () => {
  const activity = getActivity(openId);
  assert.ok(activity.questions.every(q => q.answers?.length && !q.criteria), 'No self-review work remains');
  await mission(openId);
  const choose = async (question, pickRight) => {
    const index = question.options.findIndex(option => (option === question.answers[0]) === pickRight);
    await click(`[data-choice="${index}"]`);
    assert.equal(el('[data-answer]').value, question.options[index]);
    assert.equal(el(`[data-choice="${index}"]`).getAttribute('aria-checked'), 'true');
  };
  for (const [i, q] of activity.questions.entries()) { if (i) await click(`[data-question="${i}"]`); await choose(q, i !== 0); }
  await click('#activity-submit');
  assert.notEqual(state().results[openId]?.completed, true, 'One wrong choice keeps the game open');
  await click('[data-question="0"]'); await choose(activity.questions[0], true);
  await click(`[data-question="${activity.questions.length - 1}"]`); await click('#activity-submit');
  assert.equal(state().results[openId].completed, true);
  assert.equal(state().results[openId].outcome, 'correct');
});

await test('sentence scrambles build the answer from tiles, and placed tiles can be removed', async () => {
  const id = state().assignments.find(id => getActivity(id).location === 'dome');
  const activity = getActivity(id); assert.equal(activity.type, 'order');
  await mission(id);
  for (const [i, q] of activity.questions.entries()) {
    if (i) await click(`[data-question="${i}"]`);
    assert.equal(q.format, 'scramble');
    const used = new Set();
    for (const word of q.answers[0].split(/\s+/)) {
      const index = q.tokens.findIndex((token, k) => token === word && !used.has(k)); used.add(index);
      await click(`[data-tile="${index}"]`);
    }
    assert.equal(el('[data-answer]').value, q.answers[0]);
    if (i === 0) { // remove the last tile, then put it back
      await click(`[data-placed="${q.tokens.length - 1}"]`); assert.notEqual(el('[data-answer]').value, q.answers[0]);
      const missing = q.tokens.findIndex((_, k) => !document.querySelector(`[data-placed]`) || document.querySelector(`[data-tile="${k}"]`));
      await click(`[data-tile="${missing}"]`); assert.equal(el('[data-answer]').value, q.answers[0]);
    }
  }
  await click('#activity-submit');
  assert.equal(state().results[id].completed, true);
});

await test('typed fill-in-the-blank games accept the book answer', async () => {
  const id = state().assignments.find(id => getActivity(id).questions.some(q => q.format === 'blank'));
  if (!id) return;
  const activity = getActivity(id);
  await mission(id);
  assert.equal(el('[data-answer]').tagName, activity.questions[0].format === 'blank' ? 'INPUT' : el('[data-answer]').tagName);
  await answerAll(activity);
  assert.equal(state().results[id].completed, true);
});

await test('dorm travel, PT and sleep advance one day and preserve unfinished assignments', async () => {
  await office(); await click('#office-dorm');
  assert.equal(app.zone, 'dorm'); assert.equal(el('#dorm-sleep-now').disabled, true);
  const safetyBefore = state().safety.todayId;
  const original = [...state().assignments]; await pt();
  assert.equal(el('#dorm-sleep-now').disabled, false);
  await click('#dorm-sleep-now');
  assert.equal(state().day, 2); assert.equal(state().week.remaining, 4); assert.equal(state().fitness, null);
  assert.notEqual(state().safety.todayId, safetyBefore, 'Sleep releases the next Year 1 lifeboat game.');
  assert.ok(original.some(id => state().backlog.includes(id)));
  assert.equal(el('#dorm-sleep-now').disabled, true);
});

await test('the next-day safety game saves during Help without reopening the old game or spending another reset', async () => {
  const id = state().safety.todayId, game = SAFETY_GAMES.find(game => game.id === id);
  assert.equal(game.id, 'lifeboat-y1-muster');
  assert.equal(state().safety.results[id], undefined);
  const beforeXP = getCharacterSummary(state()).totalXP;
  await travel('lifeboat');
  assert.equal(app.dialogKey, 'character-wardrobe', 'Workshop coveralls must not admit the Lifeboat.');
  await click('#wardrobe-save');
  assert.equal(state().profile.outfit, 'immersion');
  await click('#lifeboat-start-today');
  const release = deferNextRequest();
  await answerSafety(game);
  assert.equal(el('#lifeboat-next').disabled, true);
  assert.equal(state().safety.results[id], undefined);
  await click('#help-btn');
  const title = el('#dialog-title').textContent, key = app.dialogKey;
  release(); await settle();
  assert.equal(state().safety.results[id].completed, true);
  assert.equal(account.journey.safetyResults[id].completed, true);
  assert.equal(app.dialogKey, key); assert.equal(el('#dialog-title').textContent, title);
  assert.match(title, /cadet life/);
  assert.equal(state().safety.completedCount, 2);
  assert.equal(getCharacterSummary(state()).totalXP, beforeXP + 10);
  assert.equal(state().safety.todayId, id);
  assert.equal(state().day, 2); assert.equal(state().week.remaining, 4);
  await equip('coverall');
  await office(); await click('#office-dorm');
  assert.equal(app.zone, 'dorm'); assert.equal(state().fitness, null);
});

await test('white and navy maritime character imports keep legacy formats, gender cuts and earned progress', async () => {
  const before = JSON.stringify(state()), originalProfile = { ...state().profile };
  const courseState = () => {
    const snapshot = JSON.parse(JSON.stringify(state()));
    delete snapshot.profile; delete snapshot.workshop; delete snapshot.lifeboat;
    return snapshot;
  };
  const courseBefore = courseState();
  assert.ok(state().totalCompleted > 0 && state().week.used > 0, 'Import protection must be checked against earned work and a spent reset.');
  const cases = [
    { outfit: 'maritime-white', gender: 'female', uniformBottom: 'pants', format: 'seapath-book-record' },
    { outfit: 'maritime', gender: 'male', uniformBottom: 'skirt', format: 'legacy' },
  ];
  for (const candidate of cases) {
    const profile = { ...originalProfile, outfit: candidate.outfit, gender: candidate.gender, uniformBottom: candidate.uniformBottom };
    const record = candidate.format === 'seapath-book-record'
      ? { format: candidate.format, state: { profile, day: 1, semester: 1, results: {}, week: { used: 0, remaining: 5 } } }
      : { character: profile, day: 1, year: 4, xp: 999999 };
    await importCharacterRecord(record);
    const expectedBottom = candidate.gender === 'female' ? 'skirt' : 'pants';
    assert.equal(state().profile.outfit, candidate.outfit);
    assert.equal(state().profile.uniformBottom, expectedBottom);
    assert.equal(JSON.parse(storage.get('seapath.save.v1')).character.outfit, candidate.outfit);
    assert.deepEqual(courseState(), courseBefore, 'An imported character cannot replace grades, game day, fitness or weekly quota.');
    await close(); await click('#edit-cadet');
    assert.match(el('.record-outfit').textContent, /Dormitory casual clothes/);
    await travel('atlantic');
    await close(); await click('#edit-cadet');
    assert.ok(el('.record-outfit').textContent.includes(maritimeUniforms.find(([id]) => id === candidate.outfit)[1]));
    assert.equal(currentWorld.character.uniformBottom, expectedBottom);
    await close(); await click('#settings-btn'); await click('#export-save');
    const exported = JSON.parse(await exportedBlob.text());
    assert.equal(exported.format, 'seapath-book-record');
    assert.equal(exported.state.profile.outfit, candidate.outfit);
    assert.equal(exported.state.profile.uniformBottom, expectedBottom);
    assert.equal(exported.state.week.used, state().week.used);
    await office(); await click('#office-dorm');
  }
  await app.academy.updateProfile(originalProfile); await settle();
  assert.equal(JSON.stringify(state()), before);
  assert.equal(app.zone, 'dorm');
});

await test('running and football controls require all checkpoints and goals', async () => {
  await click('[data-fitness="run"]');
  if (!el('[data-fitness-relaxed]').checked) {
    el('[data-fitness-relaxed]').checked = true; el('[data-fitness-relaxed]').dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  for (let checkpoint = 0; checkpoint < 8; checkpoint++) {
    await click('[data-run-lane].is-target');
    for (let stride = 0; stride < 4; stride++) await click('[data-run-toggle]');
  }
  assert.equal(state().fitness.kind, 'run'); assert.equal(state().fitness.completedCount, 8);
  await click('#dorm-sleep-now');
  await click('[data-fitness="football"]');
  if (!el('[data-fitness-relaxed]').checked) {
    el('[data-fitness-relaxed]').checked = true; el('[data-fitness-relaxed]').dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  for (let goal = 0; goal < 5; goal++) {
    const coordinates = el('[data-football-target]').getAttribute('transform').match(/translate\(([^ ]+) ([^)]+)\)/);
    await value('[data-football-x]', coordinates[1]); await value('[data-football-y]', coordinates[2]);
    await click('[data-football-shoot]');
  }
  assert.equal(state().fitness.kind, 'football', `Football state: ${document.querySelector('[data-fitness-count]')?.textContent}; ${document.querySelector('[data-fitness-live]')?.textContent}; last request ${JSON.stringify(requests.at(-1))}`); assert.equal(state().fitness.completedCount, 5);
  assert.equal(state().day, 3); assert.equal(state().week.remaining, 3);
});

await test('five-reset cap and real-week refresh are visible without changing the day', async () => {
  await click('#dorm-sleep-now');
  while (state().week.remaining > 0) { await pt(); await click('#dorm-sleep-now'); }
  assert.equal(state().day, 6); assert.equal(state().week.used, 5);
  await pt(); assert.equal(el('#dorm-sleep-now').disabled, true);
  const day = state().day, safetyToday = state().safety.todayId; serverNow += 7 * 86_400_000;
  await click('#dorm-refresh'); assert.equal(state().week.remaining, 5); assert.equal(state().day, day);
  assert.equal(state().safety.todayId, safetyToday, 'A real-week refresh cannot reroll the current game day’s safety challenge.');
  assert.equal(el('#dorm-sleep-now').disabled, false);
});

await test('semester advancement waits for sleep and completed prior work can be opened', async () => {
  // Prepare the remainder through the real API rules, then exercise the Office UI.
  let serial = 0;
  while (!getSemesterProgress(account.journey, ACTIVITIES).ready) {
    for (const id of getAssignments(account.journey, ACTIVITIES).unlocked) {
      if (account.journey.results[id]?.completed) continue;
      const activity = getActivity(id), answers = {}, reviews = {};
      for (const question of activity.questions) {
        answers[question.id] = question.answers?.[0] || 'A saved review response for the course integration test.';
        reviews[question.id] = (question.criteria || []).map((_, index) => index);
      }
      serverAction({ action: 'complete', ...tokens(), activityId: id, answers, reviews });
    }
    if (getSemesterProgress(account.journey, ACTIVITIES).ready) break;
    if (getWeekStatus(account, serverNow).remaining === 0) serverNow += 7 * 86_400_000;
    serverAction({ action: 'fitness', ...tokens(), kind: 'pt', proof: { completed: true, score: 100, completedCount: 8, total: 8 } });
    serverAction({ action: 'sleep', ...tokens(), requestId: `ui-semester-${String(++serial).padStart(4, '0')}` });
  }
  await office(); await click('#office-refresh'); assert.ok(el('#office-advance'));
  const day = state().day; await click('#office-advance');
  assert.equal(state().semester, 2); assert.equal(state().day, day);
  assert.equal(state().semesterProgress.awaitingNextDay, true); assert.equal(state().assignments.length, 0);
  await click('[data-semester="1"]');
  const completedControl = document.querySelector(`[data-requirement="${openId}"]`);
  assert.ok(completedControl, 'Completed prior-semester requirement must open its saved response.');
  await click(completedControl);
  assert.equal(el('.saved-response').textContent, state().results[openId].answers[getActivity(openId).questions[0].id]);
  assert.equal(document.querySelector('[data-answer]'), null, 'Completed work should be read-only until fresh practice starts.');
});

let finalIds = [], firstFinalId;
await test('Loma opens only after the last semester starts, saves one final draw, and locks the chosen major', async () => {
  // Represent the final semester reached through the already-tested course
  // progression, but still awaiting its first sleep boundary.
  account.journey.semester = 8; account.journey.day = 200;
  account.journey.semesterStartDay = 201; account.journey.fitness = null;
  revision++; await app.academy.refresh(); await settle();
  await travel('loma-lounge-east');
  assert.equal(state().loma.available, false);
  assert.equal(document.querySelector('#loma-begin-final'), null);
  await office(); await click('#office-dorm');
  if (state().week.remaining === 0) { serverNow += 7 * 86_400_000; await click('#dorm-refresh'); }
  await pt(); await click('#dorm-sleep-now');
  assert.equal(state().day, 201); assert.equal(state().loma.available, true);
  await equip('maritime');
  await travel('loma-lounge-east');
  assert.equal(app.dialogKey, 'loma');
  assert.equal(state().profile.major, 'engine');
  const dayBefore = state().day, quotaBefore = state().week.used;
  nextFailure = true; await click('#loma-begin-final');
  assert.equal(state().loma.started, false);
  assert.equal(el('#loma-begin-final').disabled, false);
  await click('#loma-begin-final');
  assert.equal(state().loma.started, true); assert.equal(state().loma.recordValid, true);
  assert.equal(state().loma.majorLocked, true); assert.equal(state().loma.major, 'engine');
  finalIds = [...state().loma.gameIds];
  assert.equal(finalIds.length, 50); assert.equal(new Set(finalIds).size, 50);
  assert.ok(finalIds.every(id => ['shared', 'engine'].includes(getLomaGame(id).major)));
  firstFinalId = finalIds.find(id => getLomaGame(id).source.pages?.length && getLomaGame(id).questions[0].type === 'text');
  assert.ok(firstFinalId, 'The drawn final includes book material with an accessible source page.');
  await app.academy.refresh(); await settle();
  assert.deepEqual([...state().loma.gameIds], finalIds, 'Refresh must preserve the saved random selection.');
  await close(); await click('#edit-cadet'); await click('#record-major');
  assert.equal(el('[data-record-major="deck"]').disabled, true);
  assert.equal(el('[data-record-major="engine"]').disabled, true);
  await click('#wardrobe-edit');
  assert.equal(el('#major-options [data-value="deck"]').disabled, true);
  assert.equal(el('#major-options [data-value="engine"]').getAttribute('aria-pressed'), 'true');
  await click('#start-journey');
  assert.equal(state().profile.major, 'engine');
  assert.equal(state().day, dayBefore); assert.equal(state().week.used, quotaBefore);
  assert.deepEqual([...state().loma.gameIds], finalIds);
});

await test('a final source page preserves the draft, wrong answers spend no slot, and delayed retries save without replacing Help', async () => {
  const game = getLomaGame(firstFinalId), booksBefore = JSON.stringify(state().results), beforeXP = getCharacterSummary(state()).totalXP;
  await openFinalGame(firstFinalId);
  await value('#loma-text-answer', 'My retained final draft');
  await click('#loma-source-open');
  assert.equal(Number(el('#book-page-number').value), game.source.pages[0]);
  await click('#book-resume');
  assert.equal(app.dialogKey, 'loma-game');
  assert.equal(el('#loma-text-answer').value, 'My retained final draft');
  await answerLoma(game, { wrong: true });
  assert.equal(state().loma.results[firstFinalId].completed, false);
  assert.equal(state().loma.results[firstFinalId].attempts, 1);
  assert.equal(state().loma.today.remaining, 5);
  await answerLoma(game, { submit: false });
  nextFailure = true; await click('#loma-next');
  const answers = requests.at(-1).payload.answers;
  assert.equal(state().loma.results[firstFinalId].attempts, 1);
  assert.equal(state().loma.today.remaining, 5);
  assert.equal(el('#loma-next').disabled, false);
  const release = deferNextRequest(); await click('#loma-next');
  assert.equal(el('#loma-next').disabled, true);
  await click('#help-btn');
  const title = el('#dialog-title').textContent, key = app.dialogKey;
  release(); await settle();
  assert.equal(app.dialogKey, key); assert.equal(el('#dialog-title').textContent, title);
  assert.equal(state().loma.results[firstFinalId].completed, true);
  assert.equal(state().loma.completedCount, 1); assert.equal(state().loma.today.remaining, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(state().loma.results[firstFinalId].answers)), answers);
  assert.equal(getCharacterSummary(state()).totalXP, beforeXP + 10);
  assert.equal(JSON.stringify(state().results), booksBefore, 'A final attempt does not replace its original book result.');
  assert.deepEqual([...state().loma.gameIds], finalIds);
});

await test('five final completions stop new games; practice and real-week refresh preserve that cap until dormitory sleep', async () => {
  for (const id of finalIds.filter(id => id !== firstFinalId).slice(0, 4)) {
    await openFinalGame(id); await answerLoma(getLomaGame(id));
    assert.equal(state().loma.results[id].completed, true);
  }
  await click('#loma-result-board');
  assert.equal(state().loma.completedCount, 5); assert.equal(state().loma.today.remaining, 0);
  assert.ok(el('.loma-day-card.exhausted'));
  assert.equal(document.querySelector('#loma-start-next'), null);
  const pending = [...document.querySelectorAll('[data-loma-game]')].filter(control => !state().loma.results[control.dataset.lomaGame]?.completed);
  assert.ok(pending.length); assert.ok(pending.every(control => control.disabled));
  const day = state().day, savedResults = JSON.stringify(state().loma.results), xp = getCharacterSummary(state()).totalXP;
  serverNow += 7 * 86_400_000; await app.academy.refresh(); await settle();
  app.academy.openLoma(); await settle();
  assert.equal(state().week.remaining, 5); assert.equal(state().day, day);
  assert.equal(state().loma.today.remaining, 0, 'A real-week refresh does not grant another five same-day completions.');
  await openFinalGame(firstFinalId);
  const requestCount = requests.length;
  await click('#loma-record-practice'); await answerLoma(getLomaGame(firstFinalId));
  assert.equal(requests.length, requestCount);
  assert.equal(JSON.stringify(state().loma.results), savedResults);
  assert.equal(getCharacterSummary(state()).totalXP, xp);
  assert.equal(state().loma.today.remaining, 0);
  await click('#loma-result-board'); await click('#loma-go-dorm');
  await pt(); await click('#dorm-sleep-now');
  assert.equal(state().day, day + 1); assert.equal(state().week.remaining, 4);
  assert.equal(state().loma.today.remaining, 5); assert.equal(state().loma.completedCount, 5);
  assert.deepEqual([...state().loma.gameIds], finalIds, 'Sleeping cannot draw a different final.');
});

await test('Bank and Duke room cards save graded answers, survive a failed save and reopen as practice without changing the final or resets', async () => {
  await equip('maritime-white');
  const before = structuredClone(state()), beforeXP = getCharacterSummary(state()).totalXP;
  for (const [roomId, missionId] of [['atlantic-gmdss', 'bank-radio-message'], ['atlantic-ecdis', 'duke-chart-reader']]) {
    const staffMission = getNPCMission(missionId);
    await travel(roomId);
    await click(`[data-atlantic-mission="${missionId}"]`);
    assert.equal(app.dialogKey, 'npc-game'); assert.equal(state().profile.outfit, 'maritime-white');
    if (missionId === 'bank-radio-message') {
      nextFailure = true; await answerStaff(staffMission);
      assert.equal(state().npc.results[missionId], undefined, 'A failed request may not award a sign-off.');
      assert.equal(app.dialogKey, 'npc-game'); assert.equal(el('#npc-question-next').disabled, false);
    }
    await answerStaff(staffMission);
    assert.equal(app.dialogKey, 'npc-result');
    assert.equal(state().npc.results[missionId].completed, true);
    assert.deepEqual({ ...state().npc.results[missionId].answers }, Object.fromEntries(staffMission.questions.map(question => [question.id, question.answers[0]])));
    const saved = JSON.stringify(state()), requestCount = requests.length;
    await travel(roomId);
    assert.equal(el(`[data-atlantic-mission="${missionId}"]`).textContent, 'Practise again');
    await click(`[data-atlantic-mission="${missionId}"]`);
    assert.equal(app.dialogKey, 'npc-game');
    assert.match(el('.npc-game-top').textContent, /Practice/);
    await answerStaff(staffMission);
    assert.equal(el('#dialog-eyebrow').textContent, 'PRACTICE COMPLETE');
    assert.equal(JSON.stringify(state()), saved); assert.equal(requests.length, requestCount);
    await close(); await click('#staff-btn'); await click(`[data-meet-npc="${staffMission.npcId}"]`);
    await finishWalk(`npc-${staffMission.npcId}`);
    await click(`[data-npc-mission="${missionId}"]`);
    assert.equal(app.dialogKey, 'npc-record');
    assert.equal(document.querySelectorAll('.saved-response').length, 4);
  }
  assert.equal(getCharacterSummary(state()).totalXP, beforeXP + 20);
  for (const key of ['profile', 'results', 'safety', 'loma', 'fitness', 'week']) assert.deepEqual(state()[key], before[key], `New optional staff work must retain ${key}.`);
  assert.equal(state().day, before.day); assert.equal(state().semester, before.semester);
  assert.deepEqual(state().npc.seaTraining, before.npc.seaTraining);
  for (const [id, result] of Object.entries(before.npc.results)) assert.deepEqual(state().npc.results[id], result);
});

await test('export includes saved responses and the authoritative weekly allowance', async () => {
  await close(); await click('#settings-btn'); await click('#export-save');
  assert.ok(exportedBlob); const record = JSON.parse(await exportedBlob.text());
  assert.equal(record.format, 'seapath-book-record');
  assert.equal(record.state.results[openId].answers[getActivity(openId).questions[0].id], account.journey.results[openId].answers[getActivity(openId).questions[0].id]);
  assert.equal(record.state.week.used, getWeekStatus(account, serverNow).used);
  assert.equal(record.state.safety.completedCount, 2);
  for (const id of ['lifeboat-y1-vocabulary', 'lifeboat-y1-muster']) {
    assert.deepEqual(record.state.safety.results[id].answers, account.journey.safetyResults[id].answers);
  }
  assert.equal(record.state.profile.major, 'engine');
  assert.equal(record.state.loma.completedCount, 5);
  assert.deepEqual(record.state.loma.gameIds, finalIds);
  assert.deepEqual(record.state.loma.results, account.journey.loma.results);
  for (const id of ['bank-radio-message', 'duke-chart-reader']) assert.deepEqual(record.state.npc.results[id].answers, account.journey.npcResults[id].answers);
});

process.stdout.write(`\n${passed} integrated academy UI checks passed (${fallback ? 'learning fallback' : 'world interface stub'}); ${requests.length} simulated API requests.\n`);
