import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { AcademyAPI } from '../public/game/academy-api.js';
import { createAccount, applyAction, publicState, getWeekStatus } from '../public/game/course-progress.js';
import { ACTIVITIES } from '../public/game/book-course.js';
import { NPCS, NPC_MISSIONS } from '../public/game/npc-content.js';
import { createCharacterDashboard, getCharacterSummary } from '../public/game/character-dashboard.js';

// Exercise the shipped dashboard, account client and server rules in a terminal DOM.
// This deliberately does not launch a browser, contact an origin or claim pixel QA.
const NOW = Date.parse('2026-10-20T01:00:00Z');
const PROFILE = { name: 'RPG Cadet', gender: 'female', major: 'deck', outfit: 'cadet', heightCm: 999, weightKg: 999 };
const FITNESS_PROOF = { completed: true, score: 100, completedCount: 8, total: 8 };
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`✓ ${name}`); }

function harness() {
  const { window } = parseHTML('<!doctype html><html><body><dialog id="game-dialog"><h2 id="dialog-title"></h2><div id="dialog-body"></div></dialog></body></html>');
  const { document } = window;
  globalThis.document = document;
  window.HTMLElement.prototype.focus = function () {};
  let now = NOW, revision = 0, account = createAccount(now, 'rpg-ui-journey');
  let failNext = false, loseReply = false, requestGate = null, profileOverride = null;
  let dashboard, viewKey = '', zone = 'campus';
  const requests = [], calls = [], notices = [];
  const stateTokens = () => ({ expectedJourneyId: account.journey.journeyId, expectedDay: account.journey.day });
  function core(payload) {
    const outcome = applyAction(account, { ...stateTokens(), ...payload }, now, ACTIVITIES, { journeyId: 'rpg-ui-new-journey' });
    if (outcome.changed) { account = outcome.account; revision++; }
    return envelope(outcome);
  }
  function envelope(outcome = {}) {
    return { state: publicState(account, now, ACTIVITIES), week: getWeekStatus(account, now), revision,
      serverTime: new Date(now).toISOString(), feedback: outcome.feedback || null, duplicate: Boolean(outcome.duplicate),
      ...(outcome.reward ? { reward: outcome.reward } : {}) };
  }
  core({ action: 'init', profile: PROFILE });
  const api = new AcademyAPI({ fetcher: async (url, request) => {
    assert.equal(url, '/api/academy');
    const payload = request.method === 'POST' ? JSON.parse(request.body) : null;
    requests.push({ method: request.method, payload });
    if (requestGate && payload) { const gate = requestGate; requestGate = null; await gate; }
    if (failNext && payload) { failNext = false; throw new Error('Simulated disconnected save'); }
    try {
      const response = payload ? core(payload) : envelope();
      if (loseReply && payload) { loseReply = false; throw new Error('Simulated lost successful reply'); }
      return new Response(JSON.stringify(response), { status: 200 });
    } catch (error) {
      if (!error.code) throw error;
      return new Response(JSON.stringify({ error: { code: error.code, message: error.message, ...error.details } }), { status: error.status || 400 });
    }
  } });
  api._accept(envelope());
  const bridge = {
    getState: () => api.state, getCharacter: () => api.state.profile, getZone: () => zone,
    show(title, _kicker, html, key) {
      dashboard?.dispose(); dashboard?.dispose();
      document.querySelector('#dialog-title').textContent = title;
      document.querySelector('#dialog-body').innerHTML = html; viewKey = key;
    },
    rpgProfile: payload => { calls.push({ type: 'profile', payload: structuredClone(payload) }); return profileOverride ? profileOverride(payload) : api.rpgProfile(payload); },
    updateProfile: profile => api.profile(profile),
    openNeeds: location => calls.push({ type: 'needs', location }),
    goLocation: location => calls.push({ type: 'travel', location }),
    openOffice: () => calls.push({ type: 'office' }), openOrientation: () => calls.push({ type: 'orientation' }),
    openStaff: () => calls.push({ type: 'staff' }), editCadet: () => calls.push({ type: 'edit' }),
    closeDialog: () => { dashboard.dispose(); viewKey = ''; },
    toast: text => notices.push(text), icon: () => '<svg viewBox="0 0 24 24" aria-hidden="true"></svg>',
  };
  dashboard = createCharacterDashboard(bridge);
  function el(selector) { const node = document.querySelector(selector); assert.ok(node, `Missing ${selector}; view=${viewKey}`); return node; }
  async function click(selector) {
    const node = typeof selector === 'string' ? el(selector) : selector;
    assert.ok(!node.disabled, `Disabled ${selector}`);
    await node.onclick?.({ target: node, currentTarget: node, preventDefault() {} });
    await Promise.resolve();
  }
  function input(selector, value) {
    const node = el(selector); node.value = String(value);
    node.dispatchEvent(new window.Event('input', { bubbles: true }));
    node.oninput?.({ target: node, currentTarget: node });
  }
  return {
    window, document, api, dashboard, requests, calls, notices, core, el, click, input,
    get state() { return api.state; }, get account() { return account; }, get key() { return viewKey; },
    async refresh() { return api.load(); },
    fail() { failNext = true; }, loseReply() { loseReply = true; },
    setProfileResponse(callback) { profileOverride = callback; },
    holdNext() { let release; requestGate = new Promise(resolve => { release = resolve; }); return release; },
    close() { dashboard.dispose(); document.querySelector('#dialog-body').innerHTML = ''; viewKey = ''; },
    setZone(next) { zone = next; }, setNow(next) { now = next; },
    async introduceAll() { for (const npc of NPCS) core({ action: 'introduceNPC', npcId: npc.id }); return api.load(); },
    async passStaff(id = 'bank-radio-message') {
      const mission = NPC_MISSIONS.find(item => item.id === id);
      return api.npcComplete(id, Object.fromEntries(mission.questions.map(question => [question.id, question.answers[0]])));
    },
  };
}

function academicRecord(state) {
  const { profile, day, semester, results, npc, safety, loma, fitness, week, journeyId } = state;
  return structuredClone({ profile, day, semester, results, npc, safety, loma, fitness, week, journeyId });
}

await test('The RPG overview uses authoritative XP, all skill bars, earned traits and three wellbeing meters', async () => {
  const h = harness(); await h.introduceAll(); h.dashboard.openDashboard();
  assert.equal(h.state.rpg.totalXp, NPCS.length * 2);
  assert.equal(getCharacterSummary(h.state).totalXP, h.state.rpg.totalXp);
  assert.ok(h.el('[data-rpg-overview]'));
  assert.equal(h.document.querySelectorAll('[data-rpg-skill]').length, h.state.rpg.skills.length);
  assert.ok(h.state.rpg.skills.length >= 8, 'The dashboard must show distinct learning disciplines.');
  for (const id of ['energy', 'hydration', 'nourishment']) {
    const meter = h.el(`[data-rpg-need="${id}"]`);
    assert.match(meter.textContent, new RegExp(String(h.state.rpg.wellbeing[id])));
  }
  assert.equal(h.document.querySelectorAll('[data-rpg-earned]').length, h.state.rpg.traits.earned.length);
  assert.match(h.document.body.textContent, /fictional/i);
  assert.doesNotMatch(h.document.body.textContent, /overweight|underweight|obese|ideal weight|target weight|weight loss/i);
  for (const location of ['cafe', 'garden', 'dorm']) await h.click(`[data-rpg-care-location="${location}"]`);
  assert.deepEqual(h.calls.filter(call => call.type === 'needs').map(call => call.location), ['cafe', 'garden', 'dorm']);
  h.close();
});

await test('Fictional height and weight preview BMI locally and save only the reviewed measurement pair', async () => {
  const h = harness(), before = academicRecord(h.state), xp = h.state.rpg.totalXp;
  h.dashboard.openRPGProfile({ mode: 'body' });
  assert.equal(h.el('#rpg-profile-message').getAttribute('role'), 'status');
  h.input('#rpg-height', 170); h.input('#rpg-weight', 65);
  assert.match(h.el('#rpg-bmi-preview').textContent, /22\.5/);
  assert.equal(h.requests.length, 0); assert.equal(h.state.rpg.body.bmi, null);
  await h.click('#rpg-profile-save');
  assert.equal(h.key, 'character-record');
  assert.equal(h.state.rpg.body.heightCm, 170); assert.equal(h.state.rpg.body.weightKg, 65); assert.equal(h.state.rpg.body.bmi, 22.5);
  assert.deepEqual(h.calls[0].payload, { heightCm: 170, weightKg: 65 });
  const request = h.requests.find(item => item.payload?.action === 'rpgProfile').payload;
  assert.equal(request.expectedDay, 1); assert.equal(request.expectedJourneyId, h.state.journeyId);
  assert.equal(request.totalXp, undefined); assert.equal(request.bmi, undefined);
  assert.equal(h.state.rpg.body.history.length, 1); assert.equal(h.state.rpg.totalXp, xp);
  assert.deepEqual(academicRecord(h.state), before);
  h.close();
});

await test('Invalid or incomplete measurement pairs never save, while clearing removes current and historical measurements', async () => {
  const h = harness(); h.dashboard.openRPGProfile({ mode: 'body' });
  for (const [height, weight] of [['170', ''], ['', '65'], ['0', '65'], ['251', '65'], ['170', '301']]) {
    h.input('#rpg-height', height); h.input('#rpg-weight', weight);
    const save = h.el('#rpg-profile-save');
    if (!save.disabled) await h.click(save);
    assert.equal(h.requests.length, 0, `Invalid ${height}/${weight} sent to account.`);
    assert.equal(h.state.rpg.body.bmi, null);
  }
  h.input('#rpg-height', 170); h.input('#rpg-weight', 65); await h.click('#rpg-profile-save');
  h.dashboard.openRPGProfile({ mode: 'body' });
  await h.click('#rpg-body-clear');
  if (h.key !== 'character-record') await h.click('#rpg-profile-save');
  assert.equal(h.state.rpg.body.heightCm, null); assert.equal(h.state.rpg.body.weightKg, null); assert.equal(h.state.rpg.body.bmi, null);
  assert.deepEqual(h.state.rpg.body.history, []);
  assert.deepEqual(h.calls.at(-1).payload, { heightCm: null, weightKg: null });
  h.close();
});

await test('A failed body save retains its draft and an explicit retry saves one history entry', async () => {
  const h = harness(); h.dashboard.openRPGProfile({ mode: 'body' });
  h.input('#rpg-height', 172.5); h.input('#rpg-weight', 66.5); h.fail(); await h.click('#rpg-profile-save');
  assert.equal(h.state.rpg.body.bmi, null); assert.equal(h.el('#rpg-height').value, '172.5'); assert.equal(h.el('#rpg-weight').value, '66.5');
  assert.equal(h.el('#rpg-profile-save').disabled, false); assert.match(h.el('#rpg-profile-message').textContent, /save|reconnect|try again/i);
  await h.click('#rpg-profile-save');
  assert.equal(h.state.rpg.body.heightCm, 172.5); assert.equal(h.state.rpg.body.weightKg, 66.5); assert.equal(h.state.rpg.body.history.length, 1);
  assert.deepEqual(h.calls[0].payload, h.calls[1].payload);
  h.close();
});

await test('An uncertain successful body save is idempotent when the retained form is retried', async () => {
  const h = harness(); h.dashboard.openRPGProfile({ mode: 'body' });
  h.input('#rpg-height', 180); h.input('#rpg-weight', 80); h.loseReply(); await h.click('#rpg-profile-save');
  assert.equal(h.state.rpg.body.bmi, null, 'A lost reply must not display an unconfirmed success.');
  await h.click('#rpg-profile-save');
  assert.equal(h.state.rpg.body.bmi, 24.7); assert.equal(h.state.rpg.body.history.length, 1);
  h.close();
});

await test('Mismatched and empty profile responses do not claim a successful body update', async () => {
  for (const response of [{}, { state: { rpg: { body: { heightCm: 180, weightKg: 80, bmi: 24.7 } } } }]) {
    const h = harness(); h.setProfileResponse(async () => response);
    h.dashboard.openRPGProfile({ mode: 'body' }); h.input('#rpg-height', 170); h.input('#rpg-weight', 65);
    await h.click('#rpg-profile-save');
    assert.notEqual(h.key, 'character-record'); assert.equal(h.state.rpg.body.bmi, null);
    assert.equal(h.el('#rpg-profile-save').disabled, false); assert.match(h.el('#rpg-profile-message').textContent, /not confirmed|not saved|try again/i);
    assert.equal(h.notices.length, 0); h.close();
  }
});

await test('Trait choice allows exactly two distinct options, remains editable before a new reward and locks after it', async () => {
  const h = harness(); await h.introduceAll();
  const options = h.state.rpg.traits.options.map(option => option.id); assert.ok(options.length >= 3);
  h.dashboard.openRPGProfile({ mode: 'traits' });
  await h.click(`[data-rpg-trait="${options[0]}"]`);
  const one = h.el('#rpg-profile-save'); if (!one.disabled) await h.click(one);
  assert.equal(h.calls.length, 0, 'An incomplete one-trait choice must not write.');
  await h.click(`[data-rpg-trait="${options[1]}"]`);
  const third = h.el(`[data-rpg-trait="${options[2]}"]`); if (!third.disabled) await h.click(third);
  assert.equal(h.document.querySelectorAll('[data-rpg-trait][aria-pressed="true"]').length, 2);
  await h.click('#rpg-profile-save');
  assert.deepEqual(h.state.rpg.traits.selected, options.slice(0, 2)); assert.equal(h.state.rpg.traits.locked, false);
  h.dashboard.openRPGProfile({ mode: 'traits' });
  await h.click(`[data-rpg-trait="${options[1]}"]`); await h.click(`[data-rpg-trait="${options[2]}"]`); await h.click('#rpg-profile-save');
  assert.deepEqual(h.state.rpg.traits.selected, [options[0], options[2]]);
  const beforeXP = h.state.rpg.totalXp; await h.passStaff();
  assert.equal(h.state.rpg.totalXp, beforeXP + 10); assert.equal(h.state.rpg.traits.locked, true);
  h.dashboard.openRPGProfile({ mode: 'traits' });
  assert.ok([...h.document.querySelectorAll('[data-rpg-trait]')].every(node => node.disabled));
  assert.match(h.document.body.textContent, /locked|fixed/i);
  h.close();
});

await test('Cadets can choose traits after earlier rewards and lock only when their next new game earns credit', async () => {
  const h = harness(); await h.introduceAll(); await h.passStaff();
  assert.deepEqual(h.state.rpg.traits.selected, []); assert.equal(h.state.rpg.traits.locked, false);
  const ids = h.state.rpg.traits.options.slice(0, 2).map(option => option.id);
  h.dashboard.openRPGProfile({ mode: 'traits' });
  for (const id of ids) await h.click(`[data-rpg-trait="${id}"]`);
  await h.click('#rpg-profile-save'); assert.equal(h.state.rpg.traits.locked, false);
  await h.passStaff(); assert.equal(h.state.rpg.traits.locked, false, 'A duplicate passed game cannot lock a new choice.');
  await h.passStaff('duke-chart-reader'); assert.equal(h.state.rpg.traits.locked, true);
  h.close();
});

await test('A stale-day body save refreshes account state without replaying the mutation or losing the draft', async () => {
  const h = harness(); await h.introduceAll(); h.dashboard.openRPGProfile({ mode: 'body' });
  h.input('#rpg-height', 168); h.input('#rpg-weight', 60);
  h.core({ action: 'fitness', kind: 'pt', proof: FITNESS_PROOF }); h.core({ action: 'sleep', requestId: 'rpg-ui-other-tab-sleep' });
  const before = h.requests.length; await h.click('#rpg-profile-save');
  assert.equal(h.state.day, 2); assert.equal(h.state.rpg.body.bmi, null);
  assert.deepEqual(h.requests.slice(before).map(request => request.method), ['POST', 'GET']);
  assert.equal(h.el('#rpg-height').value, '168'); assert.equal(h.el('#rpg-weight').value, '60');
  assert.equal(h.el('#rpg-profile-save').disabled, false);
  await h.click('#rpg-profile-save'); assert.equal(h.state.rpg.body.heightCm, 168); assert.equal(h.state.day, 2); assert.equal(h.state.week.used, 1);
  h.close();
});

await test('A same-day trait lock from another tab refreshes the record without replaying or replacing saved choices', async () => {
  const h = harness(); await h.introduceAll();
  const ids = h.state.rpg.traits.options.slice(0, 3).map(option => option.id);
  await h.api.rpgProfile({ traits: ids.slice(0, 2) });
  h.dashboard.openRPGProfile({ mode: 'traits' });
  await h.click(`[data-rpg-trait="${ids[1]}"]`); await h.click(`[data-rpg-trait="${ids[2]}"]`);
  const mission = NPC_MISSIONS.find(item => item.id === 'bank-radio-message');
  h.core({ action: 'npcComplete', missionId: mission.id, answers: Object.fromEntries(mission.questions.map(question => [question.id, question.answers[0]])) });
  assert.equal(h.state.rpg.traits.locked, false, 'This tab has not received the other tab’s new reward yet.');
  const before = h.requests.length; await h.click('#rpg-profile-save');
  assert.deepEqual(h.requests.slice(before).map(request => request.method), ['POST', 'GET']);
  assert.equal(h.state.day, 1); assert.equal(h.state.rpg.traits.locked, true);
  assert.deepEqual(h.state.rpg.traits.selected, ids.slice(0, 2));
  assert.match(h.el('#rpg-profile-message').textContent, /locked/i);
  assert.equal(h.el('#rpg-profile-save').disabled, true);
  assert.ok([...h.document.querySelectorAll('[data-rpg-trait]')].every(node => node.disabled));
  await h.click('#rpg-profile-back');
  assert.equal(h.key, 'character-record'); assert.equal(h.state.rpg.traits.locked, true);
  h.close();
});

await test('In-flight RPG saves disable edits and cannot reopen an abandoned dashboard dialog', async () => {
  const h = harness(); h.dashboard.openRPGProfile({ mode: 'body' }); h.input('#rpg-height', 170); h.input('#rpg-weight', 65);
  const release = h.holdNext(); const saving = h.click('#rpg-profile-save');
  await Promise.resolve();
  assert.equal(h.el('#rpg-profile-save').disabled, true); assert.equal(h.el('#rpg-height').disabled, true); assert.equal(h.el('#rpg-weight').disabled, true);
  h.close(); release(); await saving;
  assert.equal(h.key, ''); assert.equal(h.document.querySelector('#dialog-body').textContent, ''); assert.equal(h.notices.length, 0);
  assert.equal(h.state.rpg.body.heightCm, 170, 'The account may finish saving while the closed view stays closed.');
});

await test('RPG forms and meters keep responsive layouts and usable touch controls in shipped CSS', async () => {
  const css = await fs.readFile(new URL('../public/game/character-dashboard.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\([^)]*max-width/);
  assert.match(css, /min-width\s*:\s*0/);
  assert.match(css, /min-height\s*:\s*(?:44|4[5-9]|[5-9]\d)px/);
  assert.match(css, /rpg-/);
  const h = harness(); h.dashboard.openRPGProfile({ mode: 'body' });
  for (const id of ['rpg-height', 'rpg-weight']) {
    assert.ok(h.document.querySelector(`label[for="${id}"]`), `${id} needs an associated label.`);
    assert.equal(h.el(`#${id}`).getAttribute('inputmode'), 'decimal');
  }
  assert.ok(h.el('#rpg-profile-message').getAttribute('aria-live'));
  h.close();
});

console.log(`RPG dashboard UI passed: ${passed} behavior checks with real account rules and client; no browser/network access.`);
