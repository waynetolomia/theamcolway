import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { ACTIVITIES } from '../public/game/book-course.js';
import { NPCS, NPC_MISSIONS } from '../public/game/npc-content.js';
import { SAFETY_GAMES } from '../public/game/lifeboat-content.js';
import { LOMA_GAMES, LOMA_FINAL_COUNT } from '../public/game/loma-content.js';
import { normalizeCharacter, displayCharacter } from '../public/game/progress.js';
import { createCharacterDashboard, getCharacterSummary } from '../public/game/character-dashboard.js';

// The real dashboard module in a terminal DOM, with a mocked account bridge.
// These are behavior and content checks, not a phone/browser visual test.
let passed = 0;
function check(name, work) { work(); passed++; console.log(`✓ ${name}`); }
async function checkAsync(name, work) { await work(); passed++; console.log(`✓ ${name}`); }
const baseProfile = { name: 'Alex', origin: 'Thailand', gender: 'male', major: 'deck', uniformBottom: 'pants', outfit: 'cadet',
  skin: '#b97850', hairColor: '#292327', hairStyle: 'swept', accent: '#198879', body: 'regular', accessory: 'cap' };
const bookExact = ACTIVITIES.find(activity => activity.questions.some(question => question.answers?.length));
// A second, different book game (every book game is now auto-checked).
const bookReview = ACTIVITIES.find(activity => activity.id !== bookExact.id && activity.type !== bookExact.type);
const wayne = NPC_MISSIONS.find(mission => mission.npcId === 'wayne');
const maths = NPC_MISSIONS.find(mission => mission.npcId === 'aphisit');
const science = NPC_MISSIONS.find(mission => mission.npcId === 'anne');
// Older saves may still hold self-reviewed results for a Workshop slot; the dashboard must display them.
const workshop = ACTIVITIES.find(activity => activity.location === 'workshop');

check('Uniforms normalize strict gender cuts, saved major, legacy polos, and display-only dorm clothes', () => {
  for (const outfit of ['cadet', 'coverall', 'immersion', 'maritime', 'maritime-white']) {
    assert.equal(normalizeCharacter({ gender: 'female', uniformBottom: 'pants', outfit }).uniformBottom, 'skirt');
    assert.equal(normalizeCharacter({ gender: 'male', uniformBottom: 'skirt', outfit }).uniformBottom, 'pants');
    assert.equal(normalizeCharacter({ outfit }).outfit, outfit);
  }
  assert.equal(normalizeCharacter({ outfit: 'polo' }).outfit, 'cadet');
  assert.equal(normalizeCharacter({ outfit: 'casual' }).outfit, 'cadet');
  assert.equal(normalizeCharacter({ major: 'engine' }).major, 'engine');
  assert.equal(normalizeCharacter({ major: 'captain' }).major, 'deck');
  const stored = { ...baseProfile, gender: 'female', outfit: 'immersion' }, before = JSON.stringify(stored);
  assert.equal(displayCharacter(stored, 'dorm').outfit, 'casual');
  assert.equal(displayCharacter(stored, 'campus').outfit, 'immersion');
  assert.equal(JSON.stringify(stored), before, 'Dorm display must never mutate the saved profile.');
});

check('Empty accounts show zero earned XP, unplayed scores, and fourteen introduction slots', () => {
  for (const input of [{}, null, undefined]) {
    const summary = getCharacterSummary(input);
    assert.equal(summary.totalXP, 0); assert.equal(summary.level, 1); assert.equal(summary.progressToNextLevel, 0);
    assert.equal(summary.bookCompleted, 0); assert.equal(summary.staffCompleted, 0);
    assert.equal(summary.safetyCompleted, 0); assert.equal(summary.safetyTotal, 8);
    assert.equal(summary.lomaCompleted, 0); assert.equal(summary.lomaTotal, 50); assert.equal(summary.lomaComplete, false);
    assert.equal(summary.orientation.total, NPCS.length); assert.equal(summary.orientation.completedCount, 0);
    assert.ok(summary.bestScores.every(score => score.percent === null));
    assert.ok(summary.areas.every(area => area.completed === 0 && area.percent === 0));
  }
});
check('Loma XP and final progress require distinct known selected completions, never counters or unrelated results', () => {
  const a = LOMA_GAMES[0].id, b = LOMA_GAMES[1].id, unselected = LOMA_GAMES[2].id;
  const loma = { started: true, gameIds: [a, a, 'invented-game', b], completedCount: 50, complete: true,
    results: { [a]: { completed: true, attempts: 20 }, [b]: { completed: false }, [unselected]: { completed: true }, 'invented-game': { completed: true } } };
  const summary = getCharacterSummary({ loma });
  assert.equal(summary.lomaCompleted, 1); assert.equal(summary.lomaComplete, false); assert.equal(summary.totalXP, 10);
  assert.equal(summary.bookCompleted, 0); assert.equal(summary.staffCompleted, 0); assert.equal(summary.safetyCompleted, 0);
  loma.results[a].attempts = 900;
  assert.equal(getCharacterSummary({ loma }).totalXP, 10);
  const gameIds = LOMA_GAMES.slice(0, LOMA_FINAL_COUNT).map(game => game.id);
  const complete = getCharacterSummary({ loma: { gameIds, results: Object.fromEntries(gameIds.map(id => [id, { completed: true }])) } });
  assert.equal(complete.lomaCompleted, 50); assert.equal(complete.lomaComplete, true); assert.equal(complete.totalXP, 500);
  assert.equal(complete.missionTotal, ACTIVITIES.length + NPC_MISSIONS.length + SAFETY_GAMES.length + LOMA_FINAL_COUNT);
});
check('Only completed known catalog missions earn XP; orientation and attempts do not', () => {
  const summary = getCharacterSummary({ semester: 1, totalCompleted: 99999,
    results: { [bookExact.id]: { completed: true }, [bookReview.id]: { completed: true }, unknown: { completed: true } },
    npc: { completed: 700, results: { [wayne.id]: { completed: true }, [maths.id]: { completed: false, objectiveCorrect: 3, objectiveTotal: 4 }, fake: { completed: true } } },
    safety: { completedCount: 900, results: { [SAFETY_GAMES[0].id]: { completed: true }, fake: { completed: true } } },
    orientation: { completed: true, completedCount: NPCS.length } });
  assert.equal(summary.totalXP, 40); assert.equal(summary.level, 1); assert.equal(summary.progressToNextLevel, 40);
  assert.equal(summary.xpToNextLevel, 60); assert.equal(summary.bookCompleted, 2); assert.equal(summary.staffCompleted, 1);
  assert.equal(summary.safetyCompleted, 1);
  assert.equal(summary.orientation.completed, true);
});
check('Safety scores use real saved attempts and repeated attempts do not multiply XP', () => {
  const results = {
    [SAFETY_GAMES[0].id]: { completed: false, attempts: 1, objectiveCorrect: 3, objectiveTotal: 4 },
  };
  const attempted = getCharacterSummary({ safety: { results } });
  assert.equal(attempted.totalXP, 0);
  assert.equal(attempted.bestScores.find(score => score.id === 'safety').percent, 75);
  results[SAFETY_GAMES[1].id] = { completed: true, attempts: 20, objectiveCorrect: 4, objectiveTotal: 4 };
  const summary = getCharacterSummary({ semester: 1, safety: { completedCount: 8, results } });
  assert.equal(summary.safetyCompleted, 1); assert.equal(summary.safetyTotal, 8);
  assert.equal(summary.areas.find(area => area.id === 'safety').completed, 1);
  assert.equal(summary.areas.find(area => area.id === 'safety').total, 8);
  assert.equal(summary.totalXP, 10);
  assert.equal(summary.bestScores.find(score => score.id === 'safety').percent, 100);
  assert.equal(summary.bookCompleted, 0); assert.equal(summary.staffCompleted, 0);
  assert.equal(summary.selfReviewedMissions, 0, 'Objective safety games are not self-reviewed writing.');
  results[SAFETY_GAMES[1].id].attempts = 100;
  assert.equal(getCharacterSummary({ safety: { results } }).totalXP, 10);
});
check('Levels, semester progress, introduction de-duplication, and fitness use actual saved fields', () => {
  const completed = Object.fromEntries(ACTIVITIES.slice(0, 12).map(item => [item.id, { completed: true }]));
  const summary = getCharacterSummary({ semester: 3, day: 11, results: completed, orientation: { visitedIds: ['wayne', 'wayne', 'missing-person'] }, fitness: { kind: 'pt', day: 10 } });
  assert.equal(summary.totalXP, 120); assert.equal(summary.level, 2); assert.equal(summary.progressToNextLevel, 20);
  assert.equal(summary.year, 2); assert.equal(summary.term, 1); assert.equal(summary.semesterRequired, 35); assert.equal(summary.semesterCompleted, 0);
  assert.equal(summary.orientation.completedCount, 1); assert.equal(summary.fitness.completed, false);
  assert.equal(getCharacterSummary({ semester: 8, day: 11, fitness: { kind: 'football', day: 11 } }).fitness.label, 'Football');
});
check('Exact score panels preserve imperfect attempts and separate self-reviewed work', () => {
  const summary = getCharacterSummary({ results: { [workshop.id]: { completed: true, outcome: 'self-reviewed', selfReviewed: 2, objectiveCorrect: 0, objectiveTotal: 0 } },
    npc: { results: { [wayne.id]: { completed: false, objectiveCorrect: 3, objectiveTotal: 4 }, [maths.id]: { completed: true, objectiveCorrect: 4, objectiveTotal: 4 }, [science.id]: { completed: false, objectiveCorrect: NaN, objectiveTotal: 4 } } } });
  assert.equal(summary.bestScores.find(score => score.id === 'sentences').percent, 75);
  assert.equal(summary.bestScores.find(score => score.id === 'maths').percent, 100);
  assert.equal(summary.bestScores.find(score => score.id === 'science').percent, null);
  assert.equal(summary.bestScores.find(score => score.id === 'workshop').percent, null);
  assert.equal(summary.bestScores.find(score => score.id === 'workshop').selfReviewed, 1);
  assert.equal(summary.selfReviewedMissions, 1); assert.equal(summary.selfReviewedResponses, 2);
  assert.equal(summary.totalXP, 20);
});

check('Engine and Workshop records retain their proper instructors and count new optional staff XP once', () => {
  const results = {
    'asawin-workshop-ready': { completed: true, objectiveCorrect: 4, objectiveTotal: 4, answers: { 'eng-room1-q1': 'Immersion suit' } },
    'gerald-display-reader': { completed: true, objectiveCorrect: 4, objectiveTotal: 4, attempts: 9 },
    'amara-workshop-ready': { completed: false, objectiveCorrect: 3, objectiveTotal: 4 },
  };
  const before = structuredClone(results), summary = getCharacterSummary({ npc: { results } });
  assert.equal(summary.staffTotal, NPC_MISSIONS.length); assert.equal(summary.staffCompleted, 2); assert.equal(summary.totalXP, 20);
  assert.equal(summary.areas.find(area => area.id === 'engineering').completed, 2);
  assert.equal(summary.bestScores.find(score => score.id === 'engine').percent, 100);
  assert.equal(summary.bestScores.find(score => score.id === 'workshop').percent, 75);
  assert.equal(summary.bestScores.find(score => score.id === 'workshop').missionId, 'amara-workshop-ready');
  assert.deepEqual(results, before);
});

check('Bank and Duke saved results update radio and seamanship independently of book progress', () => {
  const results = {
    'bank-radio-message': { completed: false, objectiveCorrect: 3, objectiveTotal: 4 },
    'duke-chart-reader': { completed: true, objectiveCorrect: 4, objectiveTotal: 4, attempts: 12 },
    'duke-route-check': { completed: false, objectiveCorrect: 1, objectiveTotal: 4 },
  };
  const before = structuredClone(results), attempted = getCharacterSummary({ npc: { results } });
  assert.equal(attempted.bookCompleted, 0); assert.equal(attempted.staffCompleted, 1);
  assert.equal(attempted.areas.find(area => area.id === 'radio').completed, 0, 'An imperfect Bank attempt is not a completed radio mission.');
  assert.equal(attempted.areas.find(area => area.id === 'seamanship').completed, 1, 'Duke adds seamanship credit without a book or Jakk result.');
  assert.equal(attempted.bestScores.find(score => score.id === 'radio').percent, 75);
  assert.equal(attempted.bestScores.find(score => score.id === 'radio').missionId, 'bank-radio-message', 'Duke’s perfect chart score must not enter the radio panel.');
  assert.equal(attempted.totalXP, 10); assert.deepEqual(results, before);

  for (const id of ['bank-radio-message', 'bank-radio-log', 'duke-chart-reader', 'duke-route-check', NPC_MISSIONS.find(mission => mission.npcId === 'jakk').id]) {
    results[id] = { completed: true, objectiveCorrect: 4, objectiveTotal: 4, attempts: 30 };
  }
  const completed = getCharacterSummary({ npc: { results } });
  assert.equal(completed.bookCompleted, 0); assert.equal(completed.staffCompleted, 5);
  assert.equal(completed.areas.find(area => area.id === 'radio').completed, 2, 'Both Bank missions count once.');
  assert.equal(completed.areas.find(area => area.id === 'seamanship').completed, 3, 'Both Duke missions join the existing Jakk credit.');
  assert.equal(completed.bestScores.find(score => score.id === 'radio').percent, 100);
  assert.ok(['bank-radio-message', 'bank-radio-log'].includes(completed.bestScores.find(score => score.id === 'radio').missionId));
  assert.equal(completed.totalXP, 50, 'Repeated attempts and overlapping panels cannot multiply staff XP.');
});

const { document } = parseHTML('<!doctype html><html><body><dialog id="game-dialog"><h2 id="dialog-title"></h2><div id="dialog-body"></div></dialog></body></html>');
globalThis.document = document;
let state, character, dashboard, currentZone = 'campus', shown = [], calls = [], toasts = [], onSave;
const selected = selector => document.querySelector(selector);
function reset() {
  dashboard?.dispose();
  state = { initialized: true, profile: { ...baseProfile }, semester: 1, day: 1, results: {}, npc: { results: {} },
    orientation: { completed: false, completedCount: 0, total: NPCS.length, visitedIds: [] },
    week: { remaining: 5, limit: 5, resetsAt: '2026-10-25T17:00:00Z' } };
  character = { ...baseProfile }; currentZone = 'campus'; shown = []; calls = []; toasts = [];
  onSave = async profile => { state.profile = { ...profile }; character = { ...profile }; return { state }; };
}
reset();
dashboard = createCharacterDashboard({
  getState: () => state, getCharacter: () => character, getZone: () => currentZone,
  show(title, kicker, html, key) {
    // In production the academy and outer app can both run disposal on a show.
    dashboard.dispose(); dashboard.dispose();
    selected('#dialog-title').textContent = title; selected('#dialog-body').innerHTML = html;
    shown.push({ title, kicker, key });
  },
  updateProfile: profile => { calls.push({ type: 'profile', profile: { ...profile } }); return onSave(profile); },
  openOrientation: () => calls.push({ type: 'orientation' }), openOffice: () => calls.push({ type: 'office' }),
  openStaff: () => calls.push({ type: 'staff' }), goLocation: location => calls.push({ type: 'travel', location }),
  editCadet: () => calls.push({ type: 'edit' }), closeDialog: () => { dashboard.dispose(); calls.push({ type: 'close' }); },
  toast: text => toasts.push(text), icon: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12H20"/></svg>',
});
const click = async selector => {
  const element = selected(selector); assert.ok(element, `Missing control ${selector}`);
  await element.onclick?.({ currentTarget: element, target: element });
};

check('The record exposes saved major, final progress, and actual records without fabricated attendance or ID', () => {
  dashboard.openDashboard();
  assert.equal(shown.at(-1).key, 'character-record'); assert.ok(selected('#game-dialog').classList.contains('character-dialog'));
  assert.ok(selected('#dialog-body').textContent.includes(`0 / ${NPCS.length}`));
  assert.match(selected('#dialog-body').textContent, /5 \/ 5 study days left/);
  assert.match(selected('#dialog-body').textContent, /book missions grow with your year, and staff, safety and Loma final games earn 10 XP/);
  assert.match(selected('.record-major').textContent, /DECK/); assert.match(selected('.record-major').textContent, /Navigation/);
  assert.equal(selected('.record-loma [role="progressbar"]').getAttribute('aria-valuenow'), '0');
  assert.equal(selected('.record-loma [role="progressbar"]').getAttribute('aria-valuemax'), '50');
  assert.doesNotMatch(selected('#dialog-body').textContent, /missed classes|classes on time|AMC-26D-7846/i);
  assert.equal(selected('.record-portrait svg').getAttribute('aria-label'), 'Male cadet wearing campus uniform, plain white long sleeves and black pants');
  assert.equal(document.querySelectorAll('.record-score-row > span.unplayed').length, 7);
});
await checkAsync('Record navigation reaches orientation, staff, office, dormitory, Atlantic rooms, lifeboat, Loma, and wardrobe', async () => {
  await click('#record-orientation'); await click('#record-staff'); await click('#record-office'); await click('#record-dorm');
  assert.deepEqual(calls.map(call => call.type), ['orientation', 'staff', 'office', 'travel']);
  assert.equal(calls.at(-1).location, 'dorm');
  await click('#record-atlantic'); assert.equal(calls.at(-1).location, 'atlantic');
  await click('#record-lifeboat'); assert.equal(calls.at(-1).location, 'lifeboat');
  await click('#record-loma'); assert.equal(calls.at(-1).location, 'loma-lounge');
  await click('#record-wardrobe');
  assert.equal(shown.at(-1).key, 'character-wardrobe'); assert.equal(selected('[data-record-bottom]'), null);
});
await checkAsync('Female selection automatically previews a fitted skirt and remains local until confirmed save', async () => {
  reset(); state.results[bookExact.id] = { completed: true }; const progressBefore = JSON.stringify(state.results);
  dashboard.openWardrobe(); await click('[data-record-gender="female"]');
  assert.equal(calls.length, 0); assert.equal(state.profile.gender, 'male');
  assert.equal(selected('[data-record-bottom]'), null, 'Uniform cut is fixed by gender, not a pants/skirt choice.');
  assert.match(selected('#wardrobe-portrait svg').getAttribute('aria-label'), /Female.*white long sleeves and black fitted skirt/);
  assert.ok(selected('#wardrobe-portrait [data-avatar-cut="fitted-skirt"]'));
  await click('#wardrobe-save');
  assert.equal(calls.length, 1); assert.equal(state.profile.gender, 'female'); assert.equal(state.profile.uniformBottom, 'skirt');
  assert.equal(state.profile.name, baseProfile.name); assert.equal(state.profile.hairStyle, baseProfile.hairStyle);
  assert.equal(JSON.stringify(state.results), progressBefore); assert.equal(shown.at(-1).key, 'character-record');
  assert.equal(toasts.at(-1), 'Your character and outfit are saved.');
});
await checkAsync('Five selectable outfits distinguish white and navy maritime uniforms while preserving fixed gender cuts', async () => {
  reset(); state.profile.gender = 'female'; state.profile.uniformBottom = 'pants'; dashboard.openWardrobe();
  assert.equal(document.querySelectorAll('[data-record-outfit]').length, 5);
  await click('[data-record-outfit="maritime"]');
  assert.equal(selected('#wardrobe-preview-label').textContent, 'Maritime navy uniform');
  assert.match(selected('#wardrobe-portrait svg').getAttribute('aria-label'), /navy jacket and black fitted skirt/);
  assert.ok(selected('#wardrobe-portrait [data-avatar-cut="fitted-skirt"]'));
  await click('[data-record-outfit="maritime-white"]');
  assert.equal(selected('#wardrobe-preview-label').textContent, 'Maritime white uniform');
  assert.match(selected('#wardrobe-portrait svg').getAttribute('aria-label'), /white long sleeves, epaulettes and black tie, with black fitted skirt/);
  assert.ok(selected('#wardrobe-portrait [data-avatar-cut="fitted-skirt"]'));
  assert.equal(state.profile.outfit, 'cadet', 'Preview selection does not replace the saved outfit.');
  await click('[data-record-gender="male"]');
  assert.match(selected('#wardrobe-portrait svg').getAttribute('aria-label'), /white long sleeves, epaulettes and black tie, with black pants/);
  assert.equal(selected('[data-avatar-cut="fitted-skirt"]'), null);
  assert.equal(selected('[data-record-outfit="polo"]'), null); assert.equal(selected('[data-record-outfit="casual"]'), null);
  for (const outfit of ['maritime', 'coverall', 'immersion', 'cadet', 'maritime-white']) {
    await click(`[data-record-outfit="${outfit}"]`);
    assert.equal(selected(`[data-record-outfit="${outfit}"]`).getAttribute('aria-pressed'), 'true');
  }
  await click('#wardrobe-edit'); assert.equal(calls.at(-1).type, 'edit');
  await click('#wardrobe-save'); assert.equal(state.profile.uniformBottom, 'pants'); assert.equal(state.profile.outfit, 'maritime-white');
  assert.equal(selected('.record-outfit h3').textContent, 'Maritime white uniform');
});
await checkAsync('DECK or ENGINE major changes are previewed, saved, and reflected in the record', async () => {
  reset(); const progressBefore = JSON.stringify({ results: state.results, day: state.day, week: state.week });
  dashboard.openWardrobe(); assert.equal(selected('[data-record-major="deck"]').getAttribute('aria-pressed'), 'true');
  await click('[data-record-major="engine"]');
  assert.equal(calls.length, 0); assert.equal(state.profile.major, 'deck');
  assert.equal(selected('[data-record-major="engine"]').getAttribute('aria-pressed'), 'true');
  assert.match(selected('#wardrobe-major-note').textContent, /Machinery/);
  await click('#wardrobe-save'); assert.equal(state.profile.major, 'engine');
  assert.match(selected('.record-major').textContent, /ENGINE/); assert.match(selected('.record-major').textContent, /Machinery/);
  assert.equal(JSON.stringify({ results: state.results, day: state.day, week: state.week }), progressBefore);
});
await checkAsync('A drawn Loma final locks major controls and keeps the lock when other appearance changes save', async () => {
  reset(); state.loma = { started: true, majorLocked: true, major: 'deck', gameIds: [], results: {} };
  dashboard.openWardrobe(); assert.equal(selected('[data-record-major="engine"]').disabled, true);
  await click('[data-record-major="engine"]');
  selected('[data-record-major="engine"]').disabled = false;
  await click('[data-record-major="engine"]');
  await click('[data-record-gender="female"]'); await click('#wardrobe-save');
  assert.equal(state.profile.major, 'deck'); assert.equal(state.profile.gender, 'female');
  assert.match(selected('.record-major').textContent, /Major fixed/);
});
await checkAsync('A final drawn while wardrobe is open replaces an unsaved major draft before saving', async () => {
  reset(); dashboard.openWardrobe(); await click('[data-record-major="engine"]');
  state.loma = { started: true, majorLocked: true, major: 'deck', gameIds: [], results: {} };
  await click('#wardrobe-save'); assert.equal(calls.at(-1).profile.major, 'deck'); assert.equal(state.profile.major, 'deck');
});
await checkAsync('Dorm clothes appear automatically and restore the saved outfit without any account write', async () => {
  for (const [outfit, label, portrait] of [['maritime', /maritime navy uniform returns on campus/, /navy jacket and black fitted skirt/], ['maritime-white', /maritime white uniform returns on campus/, /white long sleeves, epaulettes and black tie, with black fitted skirt/]]) {
    reset(); state.profile = { ...state.profile, gender: 'female', uniformBottom: 'skirt', outfit };
    const before = JSON.stringify(state.profile);
    currentZone = 'dorm'; dashboard.openDashboard();
    assert.match(selected('.record-portrait svg').getAttribute('aria-label'), /white short-sleeved shirt and navy blue shorts/);
    assert.match(selected('.record-outfit').textContent, /AUTOMATIC DORM OUTFIT/);
    assert.match(selected('.record-outfit').textContent, label);
    dashboard.openWardrobe(); assert.match(selected('.wardrobe-preview').textContent, /Campus preview/);
    assert.match(selected('.wardrobe-dorm-rule').textContent, /white short-sleeved shirt and navy blue shorts/);
    for (const zone of ['campus', 'atlantic']) {
      currentZone = zone; dashboard.openDashboard();
      assert.match(selected('.record-portrait svg').getAttribute('aria-label'), portrait);
    }
    assert.equal(calls.length, 0); assert.equal(JSON.stringify(state.profile), before);
  }
});
await checkAsync('Workshop and lifeboat gates only resume after their distinct required suits are confirmed saved', async () => {
  for (const [requiredOutfit, garment, destination] of [['coverall', /blue one-piece coveralls/, 'workshop'], ['immersion', /immersion suit/, 'lifeboat']]) {
    reset(); let entered = 0;
    dashboard.openWardrobe({ requiredOutfit, returnTo: () => { assert.equal(state.profile.outfit, requiredOutfit); entered++; } });
    assert.equal(selected('[data-record-outfit="cadet"]').disabled, true);
    assert.equal(selected('[data-record-outfit="maritime"]').disabled, true);
    assert.equal(selected('[data-record-outfit="maritime-white"]').disabled, true);
    assert.equal(selected(`[data-record-outfit="${requiredOutfit}"]`).getAttribute('aria-pressed'), 'true');
    assert.match(selected('#wardrobe-portrait svg').getAttribute('aria-label'), garment);
    assert.match(selected('.wardrobe-requirement').textContent, new RegExp(destination));
    assert.equal(entered, 0); assert.equal(calls.length, 0);
    await click('#wardrobe-save'); assert.equal(entered, 1); assert.equal(calls.length, 1);
    assert.match(toasts.at(-1), new RegExp(destination));
  }
});
await checkAsync('Failed suit saves retain the draft and retry controls without entering the training area', async () => {
  reset(); let entered = 0; onSave = async () => null;
  dashboard.openWardrobe({ requiredOutfit: 'coverall', returnTo: () => entered++ });
  await click('[data-record-gender="female"]'); await click('[data-record-major="engine"]'); await click('#wardrobe-save');
  assert.equal(entered, 0); assert.equal(state.profile.outfit, 'cadet'); assert.match(selected('#wardrobe-save-message').textContent, /not saved/);
  assert.equal(selected('#wardrobe-save').disabled, false); assert.equal(selected('[data-record-outfit="coverall"]').disabled, false);
  assert.equal(selected('[data-record-outfit="immersion"]').disabled, true); assert.equal(selected('[data-record-outfit="cadet"]').disabled, true);
  assert.equal(selected('[data-record-gender="female"]').getAttribute('aria-pressed'), 'true');
  assert.equal(selected('[data-record-major="engine"]').getAttribute('aria-pressed'), 'true');
  onSave = async profile => { state.profile = profile; return { state }; };
  await click('#wardrobe-save'); assert.equal(entered, 1); assert.equal(state.profile.major, 'engine'); assert.equal(state.profile.uniformBottom, 'skirt');
});
await checkAsync('Unconfirmed or mismatched server profiles never bypass the required outfit', async () => {
  for (const response of [{}, { state: { profile: { ...baseProfile, outfit: 'coverall' } } }, { state: { profile: { ...baseProfile, outfit: 'maritime-white' } } }]) {
    reset(); let entered = 0; onSave = async () => response;
    dashboard.openWardrobe({ requiredOutfit: 'immersion', returnTo: () => entered++ }); await click('#wardrobe-save');
    assert.equal(entered, 0); assert.match(selected('#wardrobe-save-message').textContent, /not confirmed/);
    assert.equal(selected('#wardrobe-save').disabled, false); assert.equal(toasts.length, 0);
  }
});
await checkAsync('Closing a wardrobe during save prevents stale continuation or modal reopening', async () => {
  reset(); let resolveSave, entered = 0;
  onSave = profile => new Promise(resolve => { resolveSave = () => { state.profile = profile; resolve({ state }); }; });
  dashboard.openWardrobe({ requiredOutfit: 'coverall', returnTo: () => entered++ });
  const pending = click('#wardrobe-save');
  await click('#wardrobe-save'); assert.equal(calls.length, 1, 'Repeated clicks must not submit again');
  dashboard.dispose(); selected('#dialog-body').innerHTML = '<p>Back in campus</p>'; const shownBefore = shown.length;
  resolveSave(); await pending;
  assert.equal(entered, 0); assert.equal(shown.length, shownBefore); assert.equal(toasts.length, 0);
  assert.equal(selected('#dialog-body').textContent, 'Back in campus'); assert.equal(selected('#game-dialog').classList.contains('character-dialog'), false);
});
await checkAsync('Invalid portrait colours are contained and user text is escaped', async () => {
  reset(); state.profile.name = '<img src=x onerror=alert(1)>'; state.profile.origin = '<script>bad()</script>';
  state.profile.skin = '"/><script>bad()</script>'; state.profile.hairColor = 'not a colour'; state.profile.hairStyle = '<svg onload=bad()> '; state.profile.outfit = 'bad-outfit';
  dashboard.openDashboard();
  assert.equal(document.querySelectorAll('script,img').length, 0);
  assert.match(selected('#dialog-body').textContent, /<script>bad\(\)<\/script>/);
  assert.match(selected('.record-portrait svg').outerHTML, /#b97850/);
  assert.match(selected('.record-portrait svg').getAttribute('aria-label'), /campus uniform/);
});
await checkAsync('Unconnected accounts can preview but cannot save a wardrobe', async () => {
  reset(); state.initialized = false; dashboard.openWardrobe();
  assert.equal(selected('#wardrobe-save').disabled, true); await click('#wardrobe-save'); assert.equal(calls.length, 0);
  assert.match(selected('#wardrobe-save-message').textContent, /Connect your cadet/);
});

dashboard.dispose(); delete globalThis.document;
console.log(`Character dashboard: ${passed} checks passed.`);
