import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  AcademyError, applyAction, createAccount, evaluateActivity, getAssignments,
  getBangkokWeek, getWeekStatus, getSemesterProgress, publicState, normalizeAnswer,
  evaluateNPCMission, getNPCProgress, getSeaTrainingProgress, isNPCMissionAvailable,
  getOrientationProgress, getWorkshopAccess, getLomaProgress, activityQuestions,
} from './public/game/course-progress.js';
import { plannedVariant } from './public/game/curriculum.js';
import { NPCS, NPC_MISSIONS, STAFF_SIGNOFF_IDS, SEA_TRAINING_REVIEW_ID, ORIENTATION_ROUTE, getNPCMission } from './public/game/npc-content.js';
import { DEFAULT_CHARACTER, createState, normalizeCharacter, normalizeState } from './public/game/progress.js';
import { mutateAccount, readAccount, responseFor } from './lib/academy-store.mjs';
import { AcademyAPI, AcademyAPIError } from './public/game/academy-api.js';
import { getLomaGame } from './public/game/loma-content.js';

/** The question set the game shows for a book mission: the saved set, else the planned one. */
function playedQuestions(account, activity) {
  const saved = account.journey.results[activity.id]?.variant;
  return activityQuestions(activity, Number.isInteger(saved) ? saved : plannedVariant(activity, account.journey.journeyId, account.journey.profile?.major || 'deck'));
}

let checks = 0;
function test(name, callback) {
  return Promise.resolve().then(callback).then(() => { checks++; process.stdout.write(`PASS ${name}\n`); });
}
const NOW = Date.parse('2026-10-19T11:30:00Z');
const activities = Array.from({ length: 8 }, (_, index) => {
  const semester = index + 1;
  return ['pacific', 'dome'].flatMap(location => [1, 2].map(sequence => ({
    id: `s${semester}-${location}-${sequence}`, semester, location, required: true,
    questions: location === 'pacific'
      ? [{ id: 'q1', type: 'fill', prompt: 'Name the front of a ship.', answers: ['bow'] }]
      : [{ id: 'q1', type: 'response', prompt: 'Explain your observation.', criteria: ['Relevant', 'Clear', 'Uses evidence'] }],
  })));
}).flat();
function tokens(account) { return { expectedJourneyId: account.journey.journeyId, expectedDay: account.journey.day }; }
function action(account, payload, now = NOW) {
  return applyAction(account, { ...tokens(account), ...payload }, now, activities, { journeyId: 'journey-next-123' }).account;
}
function introduced(account, now = NOW, catalog = activities) {
  for (const npcId of ORIENTATION_ROUTE) account = applyAction(account, { action: 'introduceNPC', ...tokens(account), npcId }, now, catalog).account;
  return account;
}
function initialized(now = NOW, orientation = true) {
  const account = action(createAccount(now, 'journey-12345678'), { action: 'init', profile: { name: 'Test Cadet', hair: 1 } }, now);
  return orientation ? introduced(account, now) : account;
}
const proof = { completed: true, score: 100, completedCount: 8, total: 8 };
function fitness(account, now = NOW) { return action(account, { action: 'fitness', kind: 'pt', proof }, now); }
function sleep(account, requestId, now = NOW) { return action(fitness(account, now), { action: 'sleep', requestId }, now); }
function throwsCode(callback, code) {
  assert.throws(callback, error => error instanceof AcademyError && error.code === code);
}
function finish(account, id, now = NOW) {
  const activity = activities.find(item => item.id === id);
  return action(account, { action: 'complete', activityId: id,
    answers: { q1: activity.location === 'pacific' ? 'bow' : 'The model tilted when I moved the blocks.' },
    reviews: { q1: [0, 1, 2] },
  }, now);
}
function npcAnswers(id) {
  return Object.fromEntries(getNPCMission(id).questions.map(question => [question.id, question.answers[0]]));
}
/** Test fixtures that build long records in one call stand in for several study days:
 *  they clear today's used slots, the weekly mission count and refill energy. */
function freshSlots(original) {
  const account = structuredClone(original);
  if (account.journey.daily) account.journey.daily.used = [];
  if (account.allowance) account.allowance.missions = 0;
  if (account.journey.rpg?.wellbeing) account.journey.rpg.wellbeing.energy = 100;
  return account;
}
/** Marks a semester's required book missions complete (fixtures for later-year records). */
function bookSemesterDone(account, semester, catalog = activities) {
  for (const activity of catalog.filter(item => item.semester === semester)) account.journey.results[activity.id] ||= { completed: true };
  return account;
}
function finishNPC(account, id, now = NOW, catalog = activities) {
  const result = applyAction(freshSlots(account), { action: 'npcComplete', ...tokens(account), missionId: id, answers: npcAnswers(id) }, now, catalog);
  assert.equal(result.feedback.passed, true, id);
  return result.account;
}
function finishAvailableNPCs(account, now = NOW, catalog = activities) {
  for (const mission of NPC_MISSIONS) {
    if (!account.journey.npcResults?.[mission.id]?.completed && isNPCMissionAvailable(account.journey, mission, catalog)) {
      if (mission.npcId === 'amara') account = applyAction(account, { action: 'profile', ...tokens(account),
        profile: { ...account.journey.profile, outfit: 'coverall' } }, now, catalog).account;
      account = finishNPC(account, mission.id, now, catalog);
    }
  }
  return account;
}
function yearTwoRecord({ books = true, staff = false } = {}) {
  let account = initialized();
  account.journey.semester = 4;
  account.journey.day = 20;
  account.journey.semesterStartDay = 18;
  if (books) for (const activity of activities.filter(item => item.semester <= 4)) account.journey.results[activity.id] = { completed: true };
  if (staff) for (const id of STAFF_SIGNOFF_IDS) account = finishNPC(account, id);
  return account;
}

function finishLomaToday(account, now = NOW, catalog = activities) {
  if (!getLomaProgress(account.journey, catalog).available) return account;
  if (!getLomaProgress(account.journey, catalog).started) account = applyAction(account,
    { action: 'startLoma', ...tokens(account), expectedMajor: account.journey.profile.major }, now, catalog).account;
  for (const id of account.journey.loma.gameIds) {
    if (account.journey.loma.results[id]?.completed) continue;
    if (getLomaProgress(account.journey).today.remaining === 0) break;
    const game = getLomaGame(id), answers = Object.fromEntries(game.questions.map(question => [question.id, question.answers[0]]));
    const result = applyAction(account, { action: 'completeLoma', ...tokens(account), gameId: id, answers }, now, catalog);
    assert.equal(result.feedback.passed, true, id); account = result.account;
  }
  return account;
}

await test('Bangkok Monday boundary and year boundary use UTC+7 server time', () => {
  assert.equal(getBangkokWeek('2026-10-18T16:59:59.999Z').key, '2026-10-12');
  assert.equal(getBangkokWeek('2026-10-18T17:00:00.000Z').key, '2026-10-19');
  assert.equal(getBangkokWeek('2026-10-25T16:59:59.999Z').resetsAt, '2026-10-25T17:00:00.000Z');
  assert.equal(getBangkokWeek('2026-12-31T23:00:00Z').key, '2026-12-28');
  assert.equal(getBangkokWeek('2027-01-03T17:00:00Z').key, '2027-01-04');
});

await test('GET has no default cadet; init starts day one without importing achievements', () => {
  const account = createAccount(NOW, 'journey-12345678');
  assert.equal(account.journey.profile, null);
  assert.equal(account.journey.initialized, false);
  assert.deepEqual(getAssignments(account.journey, activities).unlocked, []);
  const next = action(account, { action: 'init', profile: { name: 'Legacy', year: 4, xp: 1200 } });
  assert.equal(next.journey.semester, 1);
  assert.equal(next.journey.day, 1);
  assert.deepEqual(next.journey.results, {});
  assert.equal(getWeekStatus(next, NOW).remaining, 5);
});

await test('browser and server share the gender, uniform, and outfit allowlist', () => {
  assert.equal(DEFAULT_CHARACTER.gender, 'male');
  assert.equal(DEFAULT_CHARACTER.uniformBottom, 'pants');
  assert.equal(DEFAULT_CHARACTER.major, 'deck');
  const female = normalizeCharacter({ name: 'Mali', gender: 'female', uniformBottom: 'skirt', outfit: 'cadet' });
  assert.equal(female.gender, 'female');
  assert.equal(female.uniformBottom, 'skirt');
  assert.equal(normalizeCharacter({ ...female, uniformBottom: 'pants' }).uniformBottom, 'skirt');
  assert.equal(normalizeCharacter({ ...female, major: 'engine' }).major, 'engine');
  assert.equal(normalizeCharacter({ ...female, outfit: 'immersion' }).uniformBottom, 'skirt');
  assert.equal(normalizeCharacter({ ...female, gender: 'male' }).uniformBottom, 'pants');
  assert.equal(normalizeCharacter({ ...female, gender: 'unsupported' }).gender, 'male');
  assert.equal(normalizeCharacter({ ...female, outfit: 'officer', uniformBottom: 'other' }).outfit, 'cadet');
  const imported = normalizeState({ ...createState(female), character: { ...female, semester: 8,
    year: 4, xp: 99999, seaTrainingApproved: true, orientation: true, workshop: true } });
  assert.deepEqual(imported.character, female);
  let account = initialized(NOW, false);
  account = action(account, { action: 'profile', profile: { ...female, semester: 8, day: 100,
    fitness: true, completed: true, workshop: true, seaTrainingApproved: true, orientation: true } });
  assert.deepEqual(account.journey.profile, female);
  assert.equal(account.journey.semester, 1);
  assert.equal(account.journey.day, 1);
  assert.equal(getOrientationProgress(account.journey).completed, false);
  assert.equal(getWorkshopAccess(account.journey).equipped, false);
  const before = structuredClone(account);
  account = action(account, { action: 'profile', profile: { ...female, outfit: 'coverall' } });
  account = action(account, { action: 'profile', profile: { ...account.journey.profile, gender: 'male' } });
  assert.equal(account.journey.profile.uniformBottom, 'pants');
  assert.equal(getWorkshopAccess(account.journey).equipped, true);
  assert.deepEqual(account.journey.orientation, before.journey.orientation);
  assert.deepEqual(account.allowance, before.allowance);
  assert.equal(account.journey.day, before.journey.day);
});

await test('white and navy maritime uniforms preserve saved progression and major lock without satisfying either training-suit gate', () => {
  let account = finishNPC(finish(initialized(), 's1-pacific-1'), 'asawin-workshop-ready');
  account = fitness(account); account.allowance.used = 4;
  account.journey.semester = 8; account.journey.semesterStartDay = account.journey.day;
  // The final unlocks once Year 4 Semester 2's book work is complete.
  for (const activity of activities.filter(item => item.semester === 8)) account.journey.results[activity.id] = { completed: true };
  account = action(account, { action: 'startLoma', expectedMajor: 'deck' });
  const before = structuredClone(account);
  for (const outfit of ['maritime', 'maritime-white']) for (const gender of ['female', 'male']) {
    account = action(account, { action: 'profile', profile: { ...account.journey.profile, outfit, gender, uniformBottom: gender === 'female' ? 'pants' : 'skirt' } });
    account = JSON.parse(JSON.stringify(account));
    const visible = publicState(account, NOW, activities);
    assert.equal(visible.profile.outfit, outfit);
    assert.equal(visible.profile.gender, gender);
    assert.equal(visible.profile.uniformBottom, gender === 'female' ? 'skirt' : 'pants');
    assert.equal(visible.profile.major, 'deck'); assert.equal(visible.loma.majorLocked, true);
    assert.equal(normalizeState({ ...createState(), character: account.journey.profile }).character.outfit, outfit);
    for (const field of ['journeyId', 'semester', 'day', 'semesterStartDay', 'results', 'npcResults', 'safetyResults', 'seaTraining', 'fitness', 'orientation', 'loma', 'graduated']) assert.deepEqual(account.journey[field], before.journey[field], field);
    assert.deepEqual(account.allowance, before.allowance);
    throwsCode(() => finishNPC(account, 'amara-workshop-ready'), 'workshop_required');
    throwsCode(() => action(account, { action: 'completeSafety', safetyId: visible.safety.todayId, answers: {} }), 'immersion_required');
  }
});

await test('the first mission gates graded book work, staff work, advancement, and sleep until every introduction', () => {
  let account = initialized(NOW, false);
  const visible = publicState(account, NOW, activities);
  assert.equal(visible.orientation.id, 'first-day-orientation');
  assert.equal(visible.orientation.missionCount, 1);
  assert.equal(visible.orientation.total, NPCS.length);
  assert.equal(visible.orientation.completedCount, 0);
  assert.equal(visible.orientation.nextNpcId, 'kobchapan');
  assert.equal(visible.semesterProgress.orientationBlocked, true);
  assert.deepEqual(visible.npc.available, []);
  assert.equal(visible.orientation.completedAt, null);
  for (const payload of [
    { action: 'complete', activityId: 's1-pacific-1', answers: { q1: 'bow' }, orientation: { completed: true } },
    { action: 'npcComplete', missionId: 'wayne-sentence-builder', answers: npcAnswers('wayne-sentence-builder'), introducedAll: true },
    { action: 'advance', expectedSemester: 1, completed: true },
    { action: 'sleep', requestId: 'blocked-first-sleep', orientationComplete: true },
  ]) throwsCode(() => action(account, payload), 'orientation_required');
  account = fitness(account);
  assert.equal(account.journey.fitness.day, 1, 'Fitness may be completed during orientation, without sleep or extra credit.');
  throwsCode(() => action(account, { action: 'sleep', requestId: 'blocked-fit-sleep' }), 'orientation_required');
  throwsCode(() => action(account, { action: 'introduceNPC', npcId: 'unknown' }), 'npc_missing');
  throwsCode(() => action(account, { action: 'introduceNPC', npcId: '__proto__' }), 'npc_missing');
  throwsCode(() => action(account, { action: 'introduceNPC', npcId: 'wayne', expectedDay: 2 }), 'stale_day');
  const empty = createAccount(NOW, 'empty-orientation-123');
  throwsCode(() => action(empty, { action: 'introduceNPC', npcId: 'wayne' }), 'not_initialized');
  assert.equal(account.journey.day, 1);
  assert.equal(getWeekStatus(account, NOW).used, 0);
});

await test('all fourteen introductions can be completed in any order, remain idempotent, and unlock learning on the same day', () => {
  let account = initialized(NOW, false);
  account.allowance.used = 4; // study Day 5 of 5: still a rewarded day
  const before = structuredClone(account);
  account = action(account, { action: 'introduceNPC', npcId: 'asawin' });
  assert.equal(getOrientationProgress(account.journey).completedCount, 1, 'Asawin can be introduced without a suit.');
  assert.equal(getWorkshopAccess(account.journey).equipped, false);
  const duplicate = applyAction(account, { action: 'introduceNPC', ...tokens(account), npcId: 'asawin' }, NOW + 1, activities);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.changed, false);
  assert.deepEqual(duplicate.account, account);
  for (const npcId of [...ORIENTATION_ROUTE].reverse().filter(id => id !== 'asawin')) account = action(account,
    { action: 'introduceNPC', npcId, visitedIds: ORIENTATION_ROUTE, completedAt: 'forged' }, NOW + 5);
  const progress = getOrientationProgress(account.journey);
  assert.equal(progress.completed, true);
  assert.equal(progress.completedCount, NPCS.length);
  assert.deepEqual(progress.visitedIds, [...ORIENTATION_ROUTE]);
  assert.deepEqual(progress.remainingIds, []);
  assert.equal(progress.nextNpcId, null);
  assert.equal(progress.completedAt, new Date(NOW + 5).toISOString());
  assert.equal(getNPCProgress(account.journey, activities).completed, 0);
  assert.equal(account.journey.day, before.journey.day);
  assert.deepEqual(account.allowance, before.allowance);
  assert.deepEqual(account.journey.results, before.journey.results);
  account = finish(account, 's1-pacific-1');
  assert.equal(account.journey.results['s1-pacific-1'].completed, true);
  assert.equal(account.journey.day, 1);
  assert.equal(getWeekStatus(account, NOW).remaining, 1);
});

await test('old account migration requires introductions while preserving grades, clearance, fitness, and weekly quota', () => {
  let legacy = finishNPC(yearTwoRecord({ staff: true }), SEA_TRAINING_REVIEW_ID);
  legacy = fitness(legacy);
  legacy.allowance.used = 5;
  delete legacy.journey.orientation;
  delete legacy.journey.profile.gender;
  delete legacy.journey.profile.uniformBottom;
  const before = structuredClone(legacy);
  const visible = publicState(legacy, NOW, activities);
  assert.equal(visible.orientation.completed, false);
  assert.equal(visible.orientation.completedCount, 0);
  assert.equal(visible.profile.gender, 'male');
  assert.equal(visible.profile.uniformBottom, 'pants');
  assert.equal(visible.npc.seaTraining.status, 'approved');
  assert.equal(visible.semesterProgress.ready, false);
  assert.deepEqual(legacy, before, 'GET leaves the legacy account document untouched.');
  throwsCode(() => action(legacy, { action: 'advance', expectedSemester: 4 }), 'orientation_required');
  legacy = introduced(legacy);
  assert.equal(getSemesterProgress(legacy.journey, activities).ready, true);
  assert.deepEqual(legacy.journey.results, before.journey.results);
  assert.deepEqual(legacy.journey.npcResults, before.journey.npcResults);
  assert.deepEqual(legacy.journey.seaTraining, before.journey.seaTraining);
  assert.deepEqual(legacy.journey.fitness, before.journey.fitness);
  assert.deepEqual(legacy.allowance, before.allowance);
  assert.equal(legacy.journey.day, before.journey.day);
  assert.equal(getNPCProgress(legacy.journey, activities).seaTraining.staffRequired, 16);
});

await test('returning cadets retain their original ten or twelve introductions and all records while meeting only the missing teachers', () => {
  for (const missing of [['gerald', 'amara', 'bank', 'duke'], ['bank', 'duke']]) {
    let account = finishNPC(yearTwoRecord({ staff: true }), SEA_TRAINING_REVIEW_ID);
    account = finishNPC(account, 'asawin-workshop-ready');
    account = finishNPC(account, 'asawin-engineering-record');
    account.journey.npcResults['asawin-workshop-ready'].answers['eng-room1-q1'] = 'Immersion suit';
    account = action(account, { action: 'profile', profile: { ...account.journey.profile, major: 'engine', gender: 'female', outfit: 'maritime-white' } });
    account.journey.semester = 8; account.journey.semesterStartDay = account.journey.day;
    bookSemesterDone(account, 8);
    account = action(account, { action: 'startLoma', expectedMajor: 'engine' });
    account = fitness(account); account.allowance.used = 4;
    for (const id of missing) delete account.journey.orientation.introductions[id];
    const before = structuredClone(account), visible = publicState(account, NOW, activities);
    assert.equal(visible.orientation.completedCount, NPCS.length - missing.length);
    assert.equal(visible.orientation.total, 14);
    assert.deepEqual(new Set(visible.orientation.remainingIds), new Set(missing));
    assert.equal(visible.orientation.completed, false);
    assert.equal(visible.npc.seaTraining.status, 'approved');
    assert.equal(visible.loma.majorLocked, true);
    assert.deepEqual(account, before, 'Reading updated staff metadata does not mutate the old account.');
    throwsCode(() => finishNPC(account, 'bank-radio-message'), 'orientation_required');
    for (const [index, npcId] of missing.entries()) {
      account = action(account, { action: 'introduceNPC', npcId });
      assert.equal(getOrientationProgress(account.journey).completedCount, NPCS.length - missing.length + index + 1);
    }
    assert.equal(getOrientationProgress(account.journey).completed, true);
    for (const id of Object.keys(before.journey.orientation.introductions)) assert.equal(account.journey.orientation.introductions[id], before.journey.orientation.introductions[id]);
    assert.deepEqual(account.journey.npcResults, before.journey.npcResults);
    assert.equal(account.journey.npcResults['amara-workshop-ready'], undefined, 'Asawin’s historical work is never reattributed to Amara.');
    assert.equal(account.journey.npcResults['bank-radio-message'], undefined, 'An introduction does not complete a teaching mission.');
    assert.equal(account.journey.npcResults['duke-chart-reader'], undefined);
    for (const field of ['results', 'seaTraining', 'fitness', 'profile', 'loma']) assert.deepEqual(account.journey[field], before.journey[field], field);
    assert.deepEqual(account.allowance, before.allowance);
    assert.equal(account.journey.day, before.journey.day);
    account = finishNPC(account, 'asawin-workshop-ready');
    assert.equal(account.journey.npcResults['asawin-workshop-ready'].answers['eng-room1-q1'], 'Immersion suit', 'A current practice submission keeps the historical passed response.');
  }
});

await test('forged or malformed orientation flags cannot replace timestamped known introductions', () => {
  for (const orientation of [null, true, [], { completed: true, visitedIds: ORIENTATION_ROUTE, completedAt: new Date(NOW).toISOString() },
    { introductions: { wayne: true, unknown: new Date(NOW).toISOString(), anne: 'invalid' }, completedAt: 'forged' }]) {
    const account = initialized(NOW, false);
    account.journey.orientation = orientation;
    const visible = publicState(account, NOW, activities);
    assert.equal(visible.orientation.completed, false);
    assert.equal(visible.orientation.completedCount, 0);
    throwsCode(() => finish(account, 's1-pacific-1'), 'orientation_required');
  }
});

await test('Workshop and Tr. Amara challenges require the saved workshop suit, including direct API submissions', () => {
  const workshopActivity = { id: 'workshop-training-check', semester: 1, location: 'workshop', required: true,
    questions: [{ id: 'q1', type: 'number', answers: ['10'] }] };
  const catalog = [workshopActivity, ...activities];
  let account = initialized();
  delete account.journey.daily; // today's plan is built from this test's catalog
  const bookPayload = { action: 'complete', ...tokens(account), activityId: workshopActivity.id, answers: { q1: '10' },
    outfit: 'coverall', workshop: { equipped: true } };
  throwsCode(() => applyAction(account, bookPayload, NOW, catalog), 'workshop_required');
  throwsCode(() => finishNPC(account, 'amara-workshop-ready'), 'workshop_required');
  account = action(account, { action: 'profile', profile: { ...account.journey.profile, outfit: 'immersion' } });
  throwsCode(() => applyAction(account, bookPayload, NOW, catalog), 'workshop_required');
  const before = structuredClone(account);
  account = action(account, { action: 'profile', profile: { ...account.journey.profile, gender: 'female', uniformBottom: 'skirt', outfit: 'coverall' } });
  assert.deepEqual(publicState(account, NOW, catalog).workshop, { equipped: true, requiredOutfit: 'coverall' });
  delete account.journey.daily; // rebuild today's plan from this test's catalog (workshop activity first)
  const result = applyAction(account, bookPayload, NOW, catalog);
  assert.equal(result.feedback.passed, true);
  account = result.account;
  account = finishNPC(account, 'amara-workshop-ready');
  assert.equal(account.journey.npcResults['amara-workshop-ready'].completed, true);
  assert.equal(account.journey.profile.uniformBottom, 'skirt');
  assert.equal(account.journey.day, before.journey.day);
  assert.equal(account.allowance.used, before.allowance.used, 'Graded work never spends a day reset.');
  account = action(account, { action: 'profile', profile: { ...account.journey.profile, outfit: 'cadet' } });
  throwsCode(() => applyAction(account, bookPayload, NOW, catalog), 'workshop_required');
  throwsCode(() => finishNPC(account, 'amara-workshop-ready'), 'workshop_required');
  assert.equal(account.journey.results[workshopActivity.id].completed, true, 'Removing gear does not erase previous work.');
});

await test('Asawin follow-up respects Year 2 and its prerequisite without adding a sea-training sign-off', () => {
  let account = initialized();
  assert.equal(account.journey.profile.outfit, 'cadet');
  throwsCode(() => finishNPC(account, 'asawin-engineering-record'), 'npc_mission_locked');
  account = finishNPC(account, 'asawin-workshop-ready');
  throwsCode(() => finishNPC(account, 'asawin-engineering-record'), 'npc_mission_locked');
  account.journey.semester = 3;
  account.journey.semesterStartDay = account.journey.day + 1;
  throwsCode(() => finishNPC(account, 'asawin-engineering-record'), 'npc_mission_locked');
  account = sleep(account, 'asawin-year-two-day');
  account = finishNPC(account, 'asawin-engineering-record');
  assert.equal(getNPCProgress(account.journey, activities).completed, 2);
  assert.equal(getSeaTrainingProgress(account.journey, activities).staffCompleted, 0);
  assert.equal(getSeaTrainingProgress(account.journey, activities).staffRequired, 16);
  assert.ok(!STAFF_SIGNOFF_IDS.some(id => id.startsWith('asawin-')));
});

await test('All optional instructors’ follow-ups require their own first mission and an actually started Year 2', () => {
  for (const [first, followUp, outfit] of [['gerald-display-reader', 'gerald-simulator-log', 'cadet'], ['amara-workshop-ready', 'amara-measurement-record', 'coverall'], ['bank-radio-message', 'bank-radio-log', 'cadet'], ['duke-chart-reader', 'duke-route-check', 'cadet']]) {
    let account = initialized();
    account = action(account, { action: 'profile', profile: { ...account.journey.profile, outfit } });
    throwsCode(() => finishNPC(account, followUp), 'npc_mission_locked');
    account = finishNPC(account, first);
    throwsCode(() => finishNPC(account, followUp), 'npc_mission_locked');
    account.journey.semester = 3; account.journey.semesterStartDay = account.journey.day + 1;
    throwsCode(() => finishNPC(account, followUp), 'npc_mission_locked');
    account = sleep(account, `new-staff-${first}-year-two`);
    account = finishNPC(account, followUp);
    assert.equal(getNPCProgress(account.journey, activities).completed, 2);
    assert.equal(getSeaTrainingProgress(account.journey, activities).staffCompleted, 0);
    assert.equal(getSeaTrainingProgress(account.journey, activities).staffRequired, 16);
    assert.equal(account.journey.profile.outfit, outfit);
    assert.equal(account.allowance.used, 1);
  }
});

await test('new journeys restart the introduction mission while profile changes retain all spent resets', () => {
  let account = initialized();
  for (let index = 0; index < 5; index++) account = sleep(account, `orientation-reset-${index}`);
  account = action(account, { action: 'profile', profile: { ...account.journey.profile, gender: 'female', uniformBottom: 'skirt', outfit: 'immersion' } });
  const old = tokens(account);
  account = action(account, { action: 'newJourney', confirm: true });
  assert.equal(getOrientationProgress(account.journey).completedCount, 0);
  assert.equal(account.journey.profile.gender, 'female');
  assert.equal(account.journey.profile.uniformBottom, 'skirt');
  assert.equal(getWeekStatus(account, NOW).remaining, 0);
  throwsCode(() => applyAction(account, { action: 'introduceNPC', ...old, npcId: 'wayne' }, NOW, activities), 'stale_journey');
  account = introduced(account);
  throwsCode(() => action(fitness(account), { action: 'sleep', requestId: 'orientation-new-quota' }), 'weekly_limit');
});

await test('the daily plan offers four graded missions; retries reuse their slot and energy; unfinished work carries over', () => {
  const first = initialized();
  const today = publicState(first, NOW, activities);
  assert.equal(today.plan.length, 4, 'Four graded mission slots per study day');
  assert.equal(today.plan[0].kind, 'staff', 'One staff mission is suggested');
  assert.deepEqual(today.assignments, ['s1-pacific-1', 's1-dome-1', 's1-pacific-2'], 'Book missions mix locations');
  assert.equal(today.today.slotsLeft, 4); assert.equal(today.today.studyDay, 1); assert.equal(today.today.rest, false);
  throwsCode(() => finish(first, 's1-dome-2'), 'activity_locked');
  // A wrong first attempt starts the mission: one slot, one 15-energy charge.
  let account = action(first, { action: 'complete', activityId: 's1-pacific-1', answers: { q1: 'stern' } });
  assert.deepEqual(account.journey.daily.used, ['book:s1-pacific-1']);
  assert.equal(account.journey.rpg.wellbeing.energy, 85);
  // The retry belongs to the same mission: no new slot, no new energy, credit and XP once.
  account = finish(account, 's1-pacific-1');
  assert.deepEqual(account.journey.daily.used, ['book:s1-pacific-1']);
  assert.equal(account.journey.rpg.wellbeing.energy, 85);
  assert.equal(account.journey.results['s1-pacific-1'].attempts, 2);
  const xp = Object.keys(account.journey.rpg.rewards).filter(key => key === 'book:s1-pacific-1').length;
  account = finish(account, 's1-pacific-1'); // practice replay
  assert.equal(Object.keys(account.journey.rpg.rewards).filter(key => key === 'book:s1-pacific-1').length, xp);
  assert.deepEqual(account.journey.daily.used, ['book:s1-pacific-1'], 'Practice never uses a slot');
  // Start a mission and leave it unfinished: it carries into tomorrow's plan without a second energy charge.
  account = action(account, { action: 'complete', activityId: 's1-dome-1', answers: { q1: 'Unchecked draft.' } });
  assert.equal(account.journey.results['s1-dome-1'].completed, false);
  account = sleep(account, 'sleep-carry-0001');
  const tomorrow = publicState(account, NOW, activities);
  assert.equal(account.journey.rpg.wellbeing.energy, 100, 'Sleep restores energy');
  const carried = tomorrow.plan.find(item => item.id === 's1-dome-1');
  assert.equal(carried.status, 'in-progress');
  account = finish(account, 's1-dome-1');
  assert.equal(account.journey.results['s1-dome-1'].completed, true);
  assert.equal(account.journey.rpg.wellbeing.energy, 100, 'A carried attempt is not charged again');
  assert.deepEqual(account.journey.daily.used, ['book:s1-dome-1'], 'Carried work uses a slot on the new day');
});

await test('the daily slot cap holds across book and staff missions', () => {
  let account = initialized();
  const plan = publicState(account, NOW, activities).plan;
  for (const item of plan) {
    if (item.kind === 'staff') account = applyAction(account, { action: 'npcComplete', ...tokens(account), missionId: item.id, answers: npcAnswers(item.id) }, NOW, activities).account;
    else account = finish(account, item.id);
  }
  assert.equal(account.journey.daily.used.length, 4);
  assert.equal(publicState(account, NOW, activities).today.slotsLeft, 0);
  const extraStaff = NPC_MISSIONS.find(mission => !account.journey.npcResults[mission.id]?.completed && isNPCMissionAvailable(account.journey, mission, activities) && mission.npcId !== 'amara');
  throwsCode(() => applyAction(account, { action: 'npcComplete', ...tokens(account), missionId: extraStaff.id, answers: npcAnswers(extraStaff.id) }, NOW, activities), 'daily_limit');
  account = sleep(account, 'sleep-cap-00001');
  assert.equal(publicState(account, NOW, activities).today.slotsLeft, 4, 'Sleeping opens the next study day’s slots');
});

await test('energy: entry costs 15 once, exercise costs 10 and always works, free meals and rests recover', () => {
  let account = initialized();
  account.journey.rpg.wellbeing.energy = 10;
  throwsCode(() => finish(account, 's1-pacific-1'), 'low_energy');
  assert.equal(account.journey.daily?.used?.length || 0, 0, 'A refused start uses no slot');
  account = action(account, { action: 'rpgCare', kind: 'meal', location: 'cafe' });
  assert.equal(account.journey.rpg.wellbeing.energy, 35);
  account = finish(account, 's1-pacific-1');
  assert.equal(account.journey.rpg.wellbeing.energy, 20);
  account = action(account, { action: 'rpgCare', kind: 'rest', location: 'dorm' });
  assert.equal(account.journey.rpg.wellbeing.energy, 40);
  account.journey.rpg.wellbeing.energy = 4;
  account = fitness(account);
  assert.equal(account.journey.rpg.wellbeing.energy, 0, 'Exercise never blocks the dormitory routine');
  account = action(account, { action: 'sleep', requestId: 'sleep-energy-01' });
  assert.equal(account.journey.rpg.wellbeing.energy, 100);
});

await test('sleep requires a completed daily fitness game and resets that proof', () => {
  const first = initialized();
  throwsCode(() => action(first, { action: 'sleep', requestId: 'sleep-unfit-0001' }), 'fitness_required');
  throwsCode(() => action(first, { action: 'fitness', kind: 'pt', proof: { ...proof, completedCount: 7 } }), 'fitness_incomplete');
  const second = sleep(first, 'sleep-fitted-001');
  assert.equal(second.journey.fitness, null);
  throwsCode(() => action(second, { action: 'sleep', requestId: 'sleep-unfit-0002' }), 'fitness_required');
});

await test('five rewarded study days per week: the fifth sleep starts weekly rest, never a sixth rewarded day', () => {
  let account = initialized();
  for (let index = 1; index <= 4; index++) {
    assert.equal(getWeekStatus(account, NOW).studyDay, index);
    account = sleep(account, `sleep-quota-000${index}`);
  }
  assert.equal(getWeekStatus(account, NOW).studyDay, 5);
  assert.equal(getWeekStatus(account, NOW).rest, false);
  account = finish(account, 's1-pacific-1'); // Day 5 is still rewarded
  account = sleep(account, 'sleep-quota-0005');
  const week = getWeekStatus(account, NOW);
  assert.equal(week.rest, true); assert.equal(week.remaining, 0);
  assert.equal(publicState(account, NOW, activities).today.rest, true);
  // Weekly rest: no new graded credit, no sixth sleep, but practice and exploring continue.
  throwsCode(() => finish(account, 's1-dome-1'), 'weekly_rest');
  throwsCode(() => action(fitness(account), { action: 'sleep', requestId: 'sleep-quota-0006' }), 'weekly_limit');
  const practice = finish(account, 's1-pacific-1');
  assert.equal(practice.journey.results['s1-pacific-1'].completed, true);
  account = action(account, { action: 'introduceNPC', npcId: 'wayne' }); // conversations stay open
});

await test('Monday 00:00 Bangkok refreshes the allowance, keeps all progress, and resumes an attempt without re-charging it', () => {
  let account = initialized();
  for (let index = 1; index <= 4; index++) account = sleep(account, `sleep-roll-000${index}`);
  // Day 5: start a mission, leave it unfinished, then sleep into weekly rest.
  account = action(account, { action: 'complete', activityId: 's1-dome-1', answers: { q1: 'Draft only.' } });
  const charged = account.journey.results['s1-dome-1'].energyChargedAt;
  account = sleep(account, 'sleep-roll-0005');
  const reset = Date.parse(getBangkokWeek(NOW).resetsAt);
  assert.equal(reset, Date.parse('2026-10-25T17:00:00Z'), 'Monday 00:00 Asia/Bangkok');
  assert.equal(getWeekStatus(account, reset - 1).rest, true, 'Still weekly rest one millisecond before Monday');
  throwsCode(() => finish(account, 's1-dome-1', reset - 1), 'weekly_rest');
  const monday = getWeekStatus(account, reset);
  assert.equal(monday.rest, false); assert.equal(monday.studyDay, 1); assert.equal(monday.remaining, 5);
  const before = structuredClone(account);
  account = finish(account, 's1-dome-1', reset);
  assert.equal(account.journey.results['s1-dome-1'].completed, true);
  assert.equal(account.journey.results['s1-dome-1'].energyChargedAt, charged, 'The resumed attempt keeps its original charge');
  assert.equal(account.journey.rpg.wellbeing.energy, 100);
  assert.equal(getWeekStatus(account, reset).missionsUsed, 1, 'It occupies a slot in the new week');
  for (const field of ['semester', 'day', 'orientation', 'npcResults', 'seaTraining', 'profile']) assert.deepEqual(account.journey[field], before.journey[field], field);
  for (const key of Object.keys(before.journey.rpg.rewards)) assert.ok(account.journey.rpg.rewards[key], `Kept reward ${key}`);
  // Unused days do not accumulate: three weeks later the allowance is still five.
  assert.equal(getWeekStatus(account, reset + 21 * 86_400_000).remaining, 5);
});

await test('new characters and repeated init preserve account budget; stale journeys cannot mutate', () => {
  let account = sleep(initialized(), 'sleep-before-new');
  const oldTokens = tokens(account);
  account = action(account, { action: 'init', profile: { name: 'Imported', day: 1, semester: 8 } });
  assert.equal(account.journey.day, 2);
  account = action(account, { action: 'newJourney', profile: { name: 'Fresh' }, confirm: true });
  assert.equal(account.journey.day, 1);
  assert.equal(account.journey.semester, 1);
  assert.equal(getWeekStatus(account, NOW).remaining, 4);
  throwsCode(() => applyAction(account, { action: 'fitness', ...oldTokens, kind: 'pt', proof }, NOW, activities), 'stale_journey');
});

await test('exact responses validate answers; open responses require explicit criterion review', () => {
  const exact = activities.find(item => item.id === 's1-pacific-1');
  assert.equal(evaluateActivity(exact, { q1: '  BOW. ' }).passed, true);
  assert.equal(evaluateActivity(exact, { q1: 'stern' }).passed, false);
  const open = activities.find(item => item.id === 's1-dome-1');
  assert.equal(evaluateActivity(open, { q1: 'A'.repeat(4000) }).passed, false);
  assert.equal(evaluateActivity(open, { q1: 'My observation.' }, { q1: [0, 1] }).passed, false);
  const reviewed = evaluateActivity(open, { q1: 'My observation.' }, { q1: [0, 1, 2] });
  assert.equal(reviewed.passed, true);
  assert.equal(reviewed.items[0].status, 'self-reviewed');
  assert.equal(reviewed.objectiveTotal, 0);
  assert.equal(reviewed.outcome, 'self-reviewed');
  assert.equal(evaluateActivity(open, { q1: '' }, { q1: [0, 1, 2] }).passed, false);
  const ordered = { id: 'order', questions: [{ id: 'q1', type: 'order', answer: ['Observe', 'Explain'] }] };
  assert.equal(evaluateActivity(ordered, { q1: ['Observe', 'Explain'] }).passed, true);
  assert.equal(evaluateActivity(ordered, { q1: ['Explain', 'Observe'] }).passed, false);
});

await test('exact answer formatting tolerates slash, coordinate, unit and time spacing only', () => {
  for (const [left, right] of [
    ['Does / keep', 'Does/keep'], ['have / checked', 'have/checked'],
    ['2.7 bar', '2.7bar'], ['1630 LT', '1630LT'], ['720 RPM', '720RPM'],
    ['1300 UTC', '1300UTC'], ['6.1 m', '6.1m'],
    ['10°20′ N', '10° 20′ N'], ['10°20′ N', "10 ° 20' N"],
    ['ALDER / HSAK0 /6.1 m /1300 LT', 'ALDER/HSAK0/6.1m/1300LT'],
  ]) assert.equal(normalizeAnswer(left), normalizeAnswer(right), `${left} ≡ ${right}`);
  for (const [left, right] of [
    ['2.7 bar', '27 bar'], ['2.7 bar', '2.7'], ['1630 LT', '1630 UTC'],
    ['10°20′ N', '10°20′ S'], ['6.1 m', '6.1 nm'], ['HSAK0', 'HSAK1'],
  ]) assert.notEqual(normalizeAnswer(left), normalizeAnswer(right), `${left} ≠ ${right}`);
});

await test('every semester gate requires all work; advance grants no free day; Year 4 also requires its fifty-game final', () => {
  let account = initialized(), now = NOW;
  function nextDay() {
    account = sleep(account, `sleep-course-${account.journey.day.toString().padStart(4, '0')}`, now);
    if (getWeekStatus(account, now).rest) now += 7 * 86_400_000; // weekly rest ends next Monday
  }
  for (let semester = 1; semester <= 8; semester++) {
    assert.equal(account.journey.semester, semester);
    assert.equal(account.journey.graduated, false);
    throwsCode(() => action(account, { action: 'advance', expectedSemester: semester }, now), 'semester_incomplete');
    if (account.journey.semesterStartDay > account.journey.day) nextDay();
    for (const id of getAssignments(account.journey, activities).assignments) account = finish(account, id, now);
    nextDay();
    for (const id of getAssignments(account.journey, activities).assignments) account = finish(account, id, now);
    if (semester === 4) {
      assert.equal(getSemesterProgress(account.journey, activities).bookReady, true);
      assert.equal(getSemesterProgress(account.journey, activities).seaTrainingBlocked, true);
      throwsCode(() => action(account, { action: 'advance', expectedSemester: semester }, now), 'sea_training_clearance_required');
      account = finishAvailableNPCs(account, now);
    }
    if (semester === 8) {
      assert.equal(getSemesterProgress(account.journey, activities).lomaBlocked, true);
      throwsCode(() => action(account, { action: 'advance', expectedSemester: 8 }, now), 'loma_incomplete');
      while (!getLomaProgress(account.journey).complete) {
        account = finishLomaToday(account, now);
        if (!getLomaProgress(account.journey).complete) nextDay();
      }
    }
    assert.equal(getSemesterProgress(account.journey, activities).ready, true);
    const beforeDay = account.journey.day;
    account = action(account, { action: 'advance', expectedSemester: semester }, now);
    assert.equal(account.journey.day, beforeDay);
    if (semester < 8) {
      const opened = getAssignments(account.journey, activities).assignments.filter(id => activities.find(item => item.id === id).semester > semester);
      assert.deepEqual(opened, [], 'No new-semester mission opens before the next study day');
      assert.equal(account.journey.semesterStartDay, beforeDay + 1);
    }
  }
  assert.equal(account.journey.graduated, true);
  assert.equal(Object.values(account.journey.results).filter(item => item.completed).length, activities.length);
  throwsCode(() => action(account, { action: 'advance', expectedSemester: 8 }, now), 'already_graduated');
});

await test('a wrong practice attempt cannot erase an already completed submission', () => {
  let account = finish(initialized(), 's1-pacific-1');
  const first = account.journey.results['s1-pacific-1'];
  account = action(account, { action: 'complete', activityId: 's1-pacific-1', answers: { q1: 'stern' } });
  const result = account.journey.results['s1-pacific-1'];
  assert.equal(result.completed, true);
  assert.equal(result.completedAt, first.completedAt);
  assert.equal(result.answers.q1, 'bow');
  assert.equal(result.attempts, 2);
});

await test('staff catalog has fourteen named NPCs, twenty-seven missions, and one hundred ten answerable objective questions', () => {
  assert.equal(NPCS.length, 14);
  assert.equal(NPC_MISSIONS.length, 27);
  assert.equal(STAFF_SIGNOFF_IDS.length, 16);
  assert.equal(NPC_MISSIONS.flatMap(mission => mission.questions).length, 110);
  assert.equal(new Set(NPCS.map(npc => npc.id)).size, NPCS.length);
  assert.equal(new Set(NPC_MISSIONS.map(mission => mission.id)).size, NPC_MISSIONS.length);
  assert.equal(NPCS.find(npc => npc.id === 'yak').appearance.hairStyle, 'bald');
  assert.equal(NPCS.find(npc => npc.id === 'yak').appearance.body, 'broad');
  for (const npc of NPCS) {
    assert.deepEqual(npc.missionIds, NPC_MISSIONS.filter(mission => mission.npcId === npc.id).map(mission => mission.id));
    assert.equal(npc.zone, npc.id === 'yak' ? 'dorm' : ['chalermvut', 'jakk', 'asawin', 'gerald', 'bank', 'duke'].includes(npc.id) ? 'atlantic' : 'campus');
    assert.ok(npc.roleIntro.length >= 100);
  }
  for (const mission of NPC_MISSIONS) {
    assert.equal(mission.source, 'seapath-supplemental');
    assert.equal(mission.requiredForSeaTraining, !['asawin', 'gerald', 'amara', 'bank', 'duke'].includes(mission.npcId));
    assert.ok(mission.questions.every(question => ['order', 'number', 'choice'].includes(question.type)));
    assert.ok(mission.questions.every(question => question.answers?.length && question.explanation?.length));
    assert.equal(evaluateNPCMission(mission, npcAnswers(mission.id)).passed, true, mission.id);
    assert.equal(evaluateNPCMission(mission, {}).passed, false, mission.id);
    for (const question of mission.questions) {
      if (question.type === 'choice') assert.ok(question.answers.every(answer => question.options.includes(answer)), question.id);
      if (question.type === 'order') {
        const bag = text => normalizeAnswer(text).split(' ').sort();
        assert.deepEqual(bag(question.tokens.join(' ')), bag(question.answers[0]), question.id);
      }
      if (question.type === 'number') assert.ok(question.answers.every(answer => Number.isFinite(Number(answer))), question.id);
    }
  }
  const repeated = getNPCMission('wayne-clear-messages').questions.find(question => question.id === 'eng2-q3');
  assert.equal(repeated.tokens.filter(token => token.toLowerCase() === 'the').length, 2);
  const numericMission = getNPCMission('aphisit-algebra-watch');
  const numericAnswers = npcAnswers(numericMission.id);
  numericAnswers['math2-q1'] = ' 05.0 ';
  assert.equal(evaluateNPCMission(numericMission, numericAnswers).passed, true);
  numericAnswers['math2-q1'] = '5 metres';
  assert.equal(evaluateNPCMission(numericMission, numericAnswers).passed, false);
  const chart = getNPCMission('duke-route-check'), chartAnswers = npcAnswers(chart.id);
  chartAnswers['duke2-q2'] = ' 7.50 ';
  assert.equal(evaluateNPCMission(chart, chartAnswers).passed, true, 'The supplied chart scale gives 3 × 2.5 = 7.5 nautical miles.');
  chartAnswers['duke2-q2'] = '3';
  assert.equal(evaluateNPCMission(chart, chartAnswers).passed, false, 'The chart measurement must be converted with the given scale.');
  const radio = getNPCMission('bank-radio-log'), radioAnswers = npcAnswers(radio.id);
  radioAnswers['bank2-q1'] = '8';
  assert.equal(evaluateNPCMission(radio, radioAnswers).passed, true, 'The supplied 10:05–10:13 log interval is eight minutes.');
  radioAnswers['bank2-q3'] = 'Manta — Room B — 11:52';
  const wrongLog = evaluateNPCMission(radio, radioAnswers);
  assert.equal(wrongLog.passed, false);
  assert.match(wrongLog.items.find(item => item.questionId === 'bank2-q3').explanation, /All three must match/);
});

await test('older saves gain empty staff fields without changing book records, fitness, day, or quota', () => {
  let legacy = finish(sleep(initialized(), 'legacy-npc-sleep'), 's1-pacific-1');
  legacy = fitness(legacy);
  delete legacy.journey.npcResults;
  delete legacy.journey.seaTraining;
  const before = structuredClone(legacy);
  const visible = publicState(legacy, NOW, activities);
  assert.equal(visible.npc.completed, 0);
  assert.equal(visible.npc.total, NPC_MISSIONS.length);
  assert.equal(visible.npc.available.length, 13);
  assert.equal(visible.npc.seaTraining.status, 'locked');
  assert.deepEqual(legacy, before, 'GET normalization does not mutate stored input.');
  const next = finishNPC(legacy, 'wayne-sentence-builder');
  assert.deepEqual(next.journey.results, before.journey.results);
  assert.deepEqual(next.journey.fitness, before.journey.fitness);
  assert.equal(next.journey.day, before.journey.day);
  assert.deepEqual(next.allowance, before.allowance);
  assert.equal(next.journey.npcResults['wayne-sentence-builder'].completed, true);
  const malformed = structuredClone(before);
  malformed.journey.npcResults = [];
  malformed.journey.seaTraining = 'approved';
  assert.deepEqual(publicState(malformed, NOW, activities).npc.results, {});
  assert.equal(publicState(malformed, NOW, activities).npc.seaTraining.status, 'locked');
});

await test('Year 2 staff missions require both the first sign-off and an actually started semester', () => {
  let account = initialized();
  assert.equal(getNPCProgress(account.journey, activities).available.length, 13);
  throwsCode(() => finishNPC(account, 'aphisit-algebra-watch'), 'npc_mission_locked');
  account = finishNPC(account, 'aphisit-number-deck');
  throwsCode(() => finishNPC(account, 'aphisit-algebra-watch'), 'npc_mission_locked');
  account.journey.semester = 3;
  account.journey.semesterStartDay = account.journey.day + 1;
  throwsCode(() => finishNPC(account, 'aphisit-algebra-watch'), 'npc_mission_locked');
  account = sleep(account, 'year-two-staff-day');
  assert.equal(isNPCMissionAvailable(account.journey, getNPCMission('aphisit-algebra-watch'), activities), true);
  assert.equal(isNPCMissionAvailable(account.journey, getNPCMission('anne-science-at-sea'), activities), false);
  account = finishNPC(account, 'aphisit-algebra-watch');
  assert.equal(getNPCProgress(account.journey, activities).completed, 2);
  assert.equal(account.journey.day, 2);
  assert.equal(account.allowance.used, 1);
});

await test('wrong staff answers save an attempt and feedback; failed practice preserves a passed sign-off', () => {
  const id = 'aphisit-number-deck';
  const wrong = Object.fromEntries(getNPCMission(id).questions.map(question => [question.id, '999']));
  let result = applyAction(initialized(), { action: 'npcComplete', ...tokens(initialized()), missionId: id, answers: wrong }, NOW, activities);
  assert.equal(result.feedback.passed, false);
  assert.equal(result.feedback.objectiveCorrect, 0);
  assert.ok(result.feedback.items.every(item => item.explanation.length > 0));
  assert.equal(result.account.journey.npcResults[id].completed, false);
  let account = finishNPC(result.account, id);
  const first = structuredClone(account.journey.npcResults[id]);
  result = applyAction(account, { action: 'npcComplete', ...tokens(account), missionId: id, answers: wrong }, NOW + 1, activities);
  account = result.account;
  assert.equal(result.feedback.passed, false);
  assert.equal(account.journey.npcResults[id].completed, true);
  assert.equal(account.journey.npcResults[id].attempts, 3);
  assert.equal(account.journey.npcResults[id].completedAt, first.completedAt);
  assert.deepEqual(account.journey.npcResults[id].answers, first.answers);
  assert.equal(account.journey.npcResults[id].objectiveCorrect, 4);
});

await test('Tr. Dream stays locked until every Year 1–2 book task and all sixteen staff sign-offs are complete', () => {
  const first = initialized();
  throwsCode(() => finishNPC(first, SEA_TRAINING_REVIEW_ID), 'npc_mission_locked');
  const noBooks = yearTwoRecord({ books: false, staff: true });
  assert.equal(getSeaTrainingProgress(noBooks.journey, activities).status, 'locked');
  throwsCode(() => finishNPC(noBooks, SEA_TRAINING_REVIEW_ID), 'npc_mission_locked');
  let noStaff = yearTwoRecord();
  assert.equal(getSeaTrainingProgress(noStaff.journey, activities).status, 'needs-signoffs');
  assert.equal(getSeaTrainingProgress(noStaff.journey, activities).missingMissionIds.length, 16);
  for (const id of STAFF_SIGNOFF_IDS.slice(0, -1)) noStaff = finishNPC(noStaff, id);
  assert.equal(getSeaTrainingProgress(noStaff.journey, activities).staffCompleted, 15);
  throwsCode(() => finishNPC(noStaff, SEA_TRAINING_REVIEW_ID), 'npc_mission_locked');
  noStaff = finishNPC(noStaff, STAFF_SIGNOFF_IDS.at(-1));
  assert.equal(getSeaTrainingProgress(noStaff.journey, activities).status, 'ready-for-review');
  delete noStaff.journey.results['s1-pacific-1'];
  assert.equal(getSeaTrainingProgress(noStaff.journey, activities).academicComplete, false);
  throwsCode(() => finishNPC(noStaff, SEA_TRAINING_REVIEW_ID), 'npc_mission_locked');
});

await test('client approval claims cannot bypass Tr. Dream’s objective review or the Year 2 advancement gate', () => {
  let account = yearTwoRecord({ staff: true });
  const beforeDay = account.journey.day;
  const result = applyAction(account, { action: 'npcComplete', ...tokens(account), missionId: SEA_TRAINING_REVIEW_ID,
    answers: {}, completed: true, approved: true, seaTraining: { approvedAt: new Date(NOW).toISOString(), reviewerId: 'dream' },
    npcResults: { [SEA_TRAINING_REVIEW_ID]: { completed: true } },
  }, NOW, activities);
  assert.equal(result.feedback.passed, false);
  account = result.account;
  assert.equal(getSeaTrainingProgress(account.journey, activities).status, 'ready-for-review');
  assert.equal(account.journey.seaTraining, null);
  account = action(account, { action: 'profile', profile: { name: 'Still a Cadet', seaTrainingApproved: true, npcCompleted: 17 } });
  assert.equal(getSeaTrainingProgress(account.journey, activities).status, 'ready-for-review');
  throwsCode(() => action(account, { action: 'approveSeaTraining', approved: true }), 'unknown_action');
  throwsCode(() => action(account, { action: 'advance', expectedSemester: 4, approved: true }), 'sea_training_clearance_required');
  assert.equal(account.journey.day, beforeDay);
  assert.equal(account.journey.semester, 4);
});

await test('passing Tr. Dream saves game clearance before Year 3, with no extra sleep, reset, or grade overwrite', () => {
  let account = yearTwoRecord({ staff: true });
  account.allowance.used = 4;
  const before = structuredClone(account);
  account = finishNPC(account, SEA_TRAINING_REVIEW_ID);
  const readiness = getSeaTrainingProgress(account.journey, activities);
  assert.equal(readiness.status, 'approved');
  assert.equal(readiness.reviewer, 'Tr. Dream');
  assert.equal(readiness.approvedAt, new Date(NOW).toISOString());
  assert.equal(getNPCProgress(account.journey, activities).completed, 17);
  assert.equal(getSemesterProgress(account.journey, activities).ready, true);
  assert.deepEqual(account.journey.results, before.journey.results);
  assert.deepEqual(account.allowance, before.allowance);
  assert.equal(account.journey.day, before.journey.day);
  const approved = structuredClone(account.journey.seaTraining);
  account = action(account, { action: 'npcComplete', missionId: SEA_TRAINING_REVIEW_ID, answers: {} }, NOW + 1);
  assert.equal(getSeaTrainingProgress(account.journey, activities).status, 'approved');
  assert.deepEqual(account.journey.seaTraining, approved);
  account = action(account, { action: 'advance', expectedSemester: 4 });
  assert.equal(account.journey.semester, 5);
  assert.equal(account.journey.day, before.journey.day);
  assert.equal(account.journey.semesterStartDay, account.journey.day + 1);
  assert.deepEqual(getAssignments(account.journey, activities).assignments, []);
});

await test('a new journey clears staff sign-offs and clearance while retaining all spent weekly resets', () => {
  let account = finishNPC(yearTwoRecord({ staff: true }), SEA_TRAINING_REVIEW_ID);
  account.allowance.used = 5;
  const old = tokens(account);
  account = action(account, { action: 'newJourney', confirm: true, profile: { name: 'New Cadet' } });
  assert.deepEqual(account.journey.npcResults, {});
  assert.equal(account.journey.seaTraining, null);
  assert.equal(getWeekStatus(account, NOW).remaining, 0);
  assert.equal(getNPCProgress(account.journey, activities).completed, 0);
  throwsCode(() => applyAction(account, { action: 'npcComplete', ...old, missionId: 'wayne-sentence-builder', answers: npcAnswers('wayne-sentence-builder') }, NOW, activities), 'stale_journey');
});

await test('existing later-year accounts can earn missing staff clearance without losing their academic progress', () => {
  let legacy = yearTwoRecord();
  legacy.journey.semester = 7;
  legacy.journey.semesterStartDay = legacy.journey.day;
  legacy.journey.results['s6-pacific-1'] = { completed: true, answers: { q1: 'bow' } };
  delete legacy.journey.npcResults;
  delete legacy.journey.seaTraining;
  const bookResults = structuredClone(legacy.journey.results);
  legacy = finishAvailableNPCs(legacy);
  assert.equal(getSeaTrainingProgress(legacy.journey, activities).status, 'approved');
  assert.equal(legacy.journey.semester, 7);
  assert.deepEqual(legacy.journey.results, bookResults);
  assert.equal(getNPCProgress(legacy.journey, activities).completed, NPC_MISSIONS.length);
});

// Real SQLite executes the exact deployed SQL. Async reads/writes create CAS races.
function sqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE academy_accounts (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL)');
  sqlite.exec('CREATE TABLE academy_submissions (user_id TEXT NOT NULL, journey_id TEXT NOT NULL, activity_id TEXT NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, journey_id, activity_id))');
  function execute(sql, values) {
    if (database.failNextUpdate && sql.startsWith('UPDATE')) { database.failNextUpdate = false; throw new Error('simulated write failure'); }
    const statement = sqlite.prepare(sql);
    if (sql.startsWith('SELECT')) return { success: true, results: statement.all(...values), meta: { changes: 0 } };
    const result = statement.run(...values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  const database = {
    failNextUpdate: false,
    prepare(sql) {
      return { bind(...values) { return {
        sql, values,
        async first() { await Promise.resolve(); return sqlite.prepare(sql).get(...values) ?? null; },
        async run() {
          await Promise.resolve();
          return execute(sql, values);
        },
      }; } };
    },
    async batch(statements) {
      await Promise.resolve();
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => execute(statement.sql, statement.values));
        sqlite.exec('COMMIT'); return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); },
  };
  return database;
}
async function dbInitialized(database, user = 'cadet', orientation = true) {
  let result = await mutateAccount(database, user, { action: 'init', profile: { name: 'Database Cadet' } }, NOW, activities, () => `journey-db-${user}`);
  if (orientation) for (const npcId of ORIENTATION_ROUTE) result = await mutateAccount(database, user,
    { action: 'introduceNPC', ...stateTokens(result.state), npcId }, NOW, activities);
  return result;
}
function stateTokens(state) { return { expectedJourneyId: state.journeyId, expectedDay: state.day }; }

await test('both maritime outfit values survive authoritative database saves and independent account reads', async () => {
  const db = sqliteD1();
  try {
    let response = await dbInitialized(db, 'maritime-cadet');
    for (const outfit of ['maritime', 'maritime-white', 'maritime']) {
      response = await mutateAccount(db, 'maritime-cadet', { action: 'profile', ...stateTokens(response.state), profile: { ...response.state.profile, outfit, gender: 'female', uniformBottom: 'pants' } }, NOW, activities);
      const stored = await readAccount(db, 'maritime-cadet', NOW);
      assert.equal(stored.document.journey.profile.outfit, outfit);
      const visible = publicState(stored.document, NOW, activities);
      assert.equal(visible.profile.outfit, outfit); assert.equal(visible.profile.uniformBottom, 'skirt');
      assert.equal(visible.orientation.completedCount, NPCS.length);
      assert.equal(visible.day, 1); assert.equal(visible.week.used, 0);
    }
  } finally { db.close(); }
});

await test('concurrent introductions preserve every distinct acknowledgement and duplicate requests do not award extra progress', async () => {
  const db = sqliteD1();
  let result = await dbInitialized(db, 'cadet', false);
  const before = result.state;
  const firstSix = ORIENTATION_ROUTE.slice(0, 6);
  await Promise.all(firstSix.map(npcId => mutateAccount(db, 'cadet', {
    action: 'introduceNPC', ...stateTokens(before), npcId,
  }, NOW, activities)));
  const six = await readAccount(db, 'cadet', NOW);
  assert.equal(publicState(six.document, NOW, activities).orientation.completedCount, 6);
  const duplicatePayload = { action: 'introduceNPC', ...stateTokens(before), npcId: firstSix[0] };
  const duplicates = await Promise.all(Array.from({ length: 10 }, () => mutateAccount(db, 'cadet', duplicatePayload, NOW + 1, activities)));
  assert.ok(duplicates.every(item => item.duplicate));
  assert.equal((await readAccount(db, 'cadet', NOW)).revision, six.revision);
  for (const npcId of ORIENTATION_ROUTE.slice(6)) result = await mutateAccount(db, 'cadet', {
    action: 'introduceNPC', ...stateTokens(before), npcId,
  }, NOW + 2, activities);
  assert.equal(result.state.orientation.completed, true);
  assert.equal(result.state.orientation.completedCount, NPCS.length);
  assert.equal(result.state.day, before.day);
  assert.equal(result.week.used, 0);
  assert.equal(result.state.npc.completed, 0);
  assert.deepEqual(result.state.results, {});
  db.close();
});

await test('failed introduction writes leave the mission unfinished and a retry saves exactly one acknowledgement', async () => {
  const db = sqliteD1();
  const result = await dbInitialized(db, 'cadet', false);
  const before = await readAccount(db, 'cadet', NOW);
  const payload = { action: 'introduceNPC', ...stateTokens(result.state), npcId: 'wayne' };
  db.failNextUpdate = true;
  await assert.rejects(mutateAccount(db, 'cadet', payload, NOW, activities), /simulated write failure/);
  assert.deepEqual(await readAccount(db, 'cadet', NOW), before);
  const retry = await mutateAccount(db, 'cadet', payload, NOW, activities);
  assert.equal(retry.state.orientation.completedCount, 1);
  assert.equal(retry.state.orientation.completed, false);
  assert.equal(retry.state.day, 1);
  assert.equal(retry.week.used, 0);
  db.close();
});

await test('concurrent identical sleep requests are idempotent and spend one reset', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db);
  await mutateAccount(db, 'cadet', { action: 'fitness', ...stateTokens(first.state), kind: 'pt', proof }, NOW, activities);
  const payload = { action: 'sleep', ...stateTokens(first.state), requestId: 'concurrent-identical' };
  const results = await Promise.all(Array.from({ length: 6 }, () => mutateAccount(db, 'cadet', payload, NOW, activities)));
  assert.equal(results.filter(item => !item.duplicate).length, 1);
  const saved = (await readAccount(db, 'cadet', NOW)).document;
  assert.equal(saved.journey.day, 2);
  assert.equal(saved.allowance.used, 1);
  assert.equal(saved.sleepReceipts.length, 1);
  db.close();
});

await test('concurrent distinct requests from the same day cannot double spend', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db);
  await mutateAccount(db, 'cadet', { action: 'fitness', ...stateTokens(first.state), kind: 'pt', proof }, NOW, activities);
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => mutateAccount(db, 'cadet', {
    action: 'sleep', ...stateTokens(first.state), requestId: `concurrent-different-${index}`,
  }, NOW, activities)));
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.ok(results.filter(item => item.status === 'rejected').every(item => item.reason.code === 'stale_day'));
  const saved = (await readAccount(db, 'cadet', NOW)).document;
  assert.equal(saved.journey.day, 2);
  assert.equal(saved.allowance.used, 1);
  db.close();
});

await test('failed sleep database write leaves day, quota, and exercise intact', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db);
  await mutateAccount(db, 'cadet', { action: 'fitness', ...stateTokens(first.state), kind: 'pt', proof }, NOW, activities);
  const before = await readAccount(db, 'cadet', NOW);
  db.failNextUpdate = true;
  const payload = { action: 'sleep', ...stateTokens(first.state), requestId: 'failed-then-retried' };
  await assert.rejects(mutateAccount(db, 'cadet', payload, NOW, activities), /simulated write failure/);
  assert.deepEqual(await readAccount(db, 'cadet', NOW), before);
  const retry = await mutateAccount(db, 'cadet', payload, NOW, activities);
  assert.equal(retry.state.day, 2);
  assert.equal(retry.week.used, 1);
  db.close();
});

await test('submission and progress metadata commit together and roll back together', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db);
  const payload = { action: 'complete', ...stateTokens(first.state), activityId: 's1-dome-1',
    answers: { q1: 'The model changed direction after the load moved.' }, reviews: { q1: [0, 1, 2] } };
  db.failNextUpdate = true;
  await assert.rejects(mutateAccount(db, 'cadet', payload, NOW, activities), /simulated write failure/);
  assert.equal((await readAccount(db, 'cadet', NOW)).document.journey.results['s1-dome-1'], undefined);
  const empty = await db.prepare('SELECT COUNT(*) AS count FROM academy_submissions WHERE user_id = ?').bind('cadet').first();
  assert.equal(empty.count, 0);
  await mutateAccount(db, 'cadet', payload, NOW, activities);
  const restored = (await readAccount(db, 'cadet', NOW)).document.journey.results['s1-dome-1'];
  assert.equal(restored.completed, true);
  assert.equal(restored.answers.q1, payload.answers.q1);
  const raw = await db.prepare('SELECT document FROM academy_accounts WHERE user_id = ?').bind('cadet').first();
  assert.equal(JSON.parse(raw.document).journey.results['s1-dome-1'].answers, undefined);
  db.close();
});

await test('simultaneous activity submissions preserve both results and their responses', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db);
  await Promise.all([
    mutateAccount(db, 'cadet', { action: 'complete', ...stateTokens(first.state), activityId: 's1-pacific-1', answers: { q1: 'bow' }, reviews: {} }, NOW, activities),
    mutateAccount(db, 'cadet', { action: 'complete', ...stateTokens(first.state), activityId: 's1-dome-1', answers: { q1: 'My observed result.' }, reviews: { q1: [0, 1, 2] } }, NOW, activities),
  ]);
  const saved = (await readAccount(db, 'cadet', NOW)).document.journey.results;
  assert.equal(saved['s1-pacific-1'].completed, true);
  assert.equal(saved['s1-pacific-1'].answers.q1, 'bow');
  assert.equal(saved['s1-dome-1'].completed, true);
  assert.equal(saved['s1-dome-1'].answers.q1, 'My observed result.');
  db.close();
});

await test('concurrent staff submissions including Bank and Duke preserve every sign-off and answer in the account document', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db);
  const ids = ['wayne-sentence-builder', 'aphisit-number-deck', 'bank-radio-message', 'duke-chart-reader'];
  await Promise.all(ids.map(missionId => mutateAccount(db, 'cadet', {
    action: 'npcComplete', ...stateTokens(first.state), missionId, answers: npcAnswers(missionId),
  }, NOW, activities)));
  const saved = await readAccount(db, 'cadet', NOW);
  assert.equal(publicState(saved.document, NOW, activities).npc.completed, ids.length);
  assert.equal(publicState(saved.document, NOW, activities).npc.seaTraining.staffCompleted, 2, 'The two new optional missions do not add required sea-training credit.');
  for (const id of ids) {
    assert.equal(saved.document.journey.npcResults[id].completed, true);
    assert.deepEqual(saved.document.journey.npcResults[id].answers, npcAnswers(id));
  }
  assert.equal(saved.document.journey.day, 1);
  assert.equal(saved.document.allowance.used, 0);
  assert.deepEqual(saved.document.journey.results, {});
  const raw = await db.prepare('SELECT document FROM academy_accounts WHERE user_id = ?').bind('cadet').first();
  for (const id of ids) assert.deepEqual(JSON.parse(raw.document).journey.npcResults[id].answers, npcAnswers(id));
  // All four mission slots are used today; a further new mission is refused before any write.
  await assert.rejects(mutateAccount(db, 'cadet', {
    action: 'npcComplete', ...stateTokens(first.state), missionId: 'anne-science-discovery', answers: npcAnswers('anne-science-discovery'),
  }, NOW, activities), /mission slots/);
  // A failed database write of a practice replay leaves the saved record unchanged.
  const attempts = saved.document.journey.npcResults['wayne-sentence-builder'].attempts;
  db.failNextUpdate = true;
  await assert.rejects(mutateAccount(db, 'cadet', {
    action: 'npcComplete', ...stateTokens(first.state), missionId: 'wayne-sentence-builder', answers: npcAnswers('wayne-sentence-builder'),
  }, NOW, activities), /simulated write failure/);
  assert.equal((await readAccount(db, 'cadet', NOW)).document.journey.npcResults['wayne-sentence-builder'].attempts, attempts);
  assert.equal((await readAccount(db, 'cadet', NOW)).document.journey.npcResults['anne-science-discovery'], undefined);
  db.close();
});

await test('account identities do not share progress or weekly allowances', async () => {
  const db = sqliteD1();
  const first = await dbInitialized(db, 'one');
  await dbInitialized(db, 'two');
  await mutateAccount(db, 'one', { action: 'fitness', ...stateTokens(first.state), kind: 'pt', proof }, NOW, activities);
  await mutateAccount(db, 'one', { action: 'sleep', ...stateTokens(first.state), requestId: 'separate-account' }, NOW, activities);
  const second = (await readAccount(db, 'two', NOW)).document;
  assert.equal(second.journey.day, 1);
  assert.equal(getWeekStatus(second, NOW).used, 0);
  db.close();
});

await test('API retains uncertain sleep id and ignores delayed older revisions', async () => {
  const first = initialized();
  let lost = true;
  const bodies = [];
  const api = new AcademyAPI({ fetcher: async (_url, request) => {
    const body = JSON.parse(request.body); bodies.push(body);
    if (lost) { lost = false; throw new Error('network dropped'); }
    const next = sleep(first, body.requestId);
    return { ok: true, status: 200, json: async () => responseFor({ document: next, revision: 3 }, NOW, activities) };
  } });
  api._accept(responseFor({ document: first, revision: 1 }, NOW, activities));
  await assert.rejects(api.sleep(), error => error instanceof AcademyAPIError && error.code === 'offline');
  await api.sleep();
  assert.equal(bodies[0].requestId, bodies[1].requestId);
  assert.equal(api.state.day, 2);
  api._accept(responseFor({ document: first, revision: 2 }, NOW, activities));
  assert.equal(api.state.day, 2);
  assert.equal(api.revision, 3);
  const clockBefore = api.serverTime;
  api._accept(responseFor({ document: first, revision: 3 }, NOW - 1, activities));
  assert.equal(api.serverTime, clockBefore);
  assert.equal(api.state.day, 2);
});

await test('API refreshes stale state without replaying mutation or replacing the conflict', async () => {
  const first = initialized(), next = sleep(first, 'changed-other-tab');
  const requests = [];
  const api = new AcademyAPI({ fetcher: async (_url, request) => {
    requests.push(request);
    return request.method === 'POST'
      ? { ok: false, status: 409, json: async () => ({ error: { code: 'stale_day', message: 'The day changed.' } }) }
      : { ok: true, status: 200, json: async () => responseFor({ document: next, revision: 3 }, NOW, activities) };
  } });
  api._accept(responseFor({ document: first, revision: 1 }, NOW, activities));
  await assert.rejects(api.sleep(), error => error.code === 'stale_day' && error.message === 'The day changed.');
  assert.deepEqual(requests.map(request => request.method), ['POST', 'GET']);
  assert.equal(api.state.day, 2);
  assert.equal(api._pendingSleep, null);
});

await test('NPC API sends mission answers with current journey/day tokens and accepts saved feedback', async () => {
  let account = initialized();
  const requests = [];
  const api = new AcademyAPI({ fetcher: async (_url, request) => {
    requests.push(request);
    const result = applyAction(account, JSON.parse(request.body), NOW, activities);
    account = result.account;
    return { ok: true, status: 200, json: async () => responseFor({ document: account, revision: 2 }, NOW, activities, { feedback: result.feedback }) };
  } });
  api._accept(responseFor({ document: account, revision: 1 }, NOW, activities));
  const id = 'wayne-sentence-builder';
  const result = await api.npcComplete(id, npcAnswers(id));
  const body = JSON.parse(requests[0].body);
  assert.equal(body.action, 'npcComplete');
  assert.equal(body.expectedDay, 1);
  assert.equal(body.expectedJourneyId, account.journey.journeyId);
  assert.equal(body.missionId, id);
  assert.equal(result.feedback.passed, true);
  assert.equal(api.state.npc.results[id].completed, true);
  assert.equal(api.state.npc.completed, 1);
});

await test('introduction API sends current journey/day tokens and accepts same-day orientation progress', async () => {
  let account = initialized(NOW, false), revision = 1;
  const requests = [];
  const api = new AcademyAPI({ fetcher: async (_url, request) => {
    requests.push(JSON.parse(request.body));
    const result = applyAction(account, JSON.parse(request.body), NOW, activities);
    account = result.account;
    if (result.changed) revision++;
    return { ok: true, status: 200, json: async () => responseFor({ document: account, revision }, NOW, activities,
      { duplicate: result.duplicate }) };
  } });
  api._accept(responseFor({ document: account, revision }, NOW, activities));
  await api.introduceNPC('asawin');
  assert.deepEqual(requests[0], { action: 'introduceNPC', expectedJourneyId: account.journey.journeyId, expectedDay: 1, npcId: 'asawin' });
  assert.equal(api.state.orientation.completedCount, 1);
  assert.equal(api.state.workshop.equipped, false);
  const again = await api.introduceNPC('asawin');
  assert.equal(again.duplicate, true);
  assert.equal(api.state.orientation.completedCount, 1);
  for (const id of ORIENTATION_ROUTE.filter(id => id !== 'asawin')) await api.introduceNPC(id);
  assert.equal(api.state.orientation.completed, true);
  assert.equal(api.state.day, 1);
  assert.equal(api.state.week.used, 0);
  assert.equal(api.state.totalCompleted, 0);
});

await test('the complete book catalog unlocks and graduates with every source activity', async () => {
  const { ACTIVITIES } = await import('./public/game/book-course.js');
  let account = applyAction(createAccount(NOW, 'real-book-journey'), { action: 'init', profile: { name: 'Catalog Audit' } }, NOW, ACTIVITIES).account;
  account = introduced(account, NOW, ACTIVITIES);
  let now = NOW, sleepCount = 0, submissionCount = 0;
  while (!account.journey.graduated) {
    const assignment = getAssignments(account.journey, ACTIVITIES);
    for (const id of [...assignment.assignments, ...assignment.backlog]) {
      if (account.journey.results[id]?.completed) continue;
      const activity = ACTIVITIES.find(item => item.id === id);
      if (activity.location === 'workshop') account = applyAction(account, { action: 'profile', ...tokens(account),
        profile: { ...account.journey.profile, outfit: 'coverall' } }, now, ACTIVITIES).account;
      // Answer the set the game shows this cadet (a saved or planned equivalent variant).
      const shown = playedQuestions(account, activity);
      const answers = {}, reviews = {};
      for (const question of shown) {
        answers[question.id] = question.answers?.[0] ?? question.answer ?? 'A test submission checked against the listed review criteria.';
        reviews[question.id] = (question.criteria || []).map((_, index) => index);
      }
      const result = applyAction(account, { action: 'complete', ...tokens(account), activityId: id, answers, reviews }, now, ACTIVITIES);
      assert.equal(result.feedback.passed, true, id);
      if (activity.variants?.length) assert.equal(result.account.journey.results[id].variant, plannedVariant(activity, account.journey.journeyId, account.journey.profile.major), `${id} saves the planned set`);
      if (shown.some(question => !question.answers?.length && !question.answer)) assert.notEqual(result.feedback.outcome, 'correct');
      account = result.account; submissionCount++;
    }
    account = finishAvailableNPCs(account, now, ACTIVITIES);
    account = finishLomaToday(account, now, ACTIVITIES);
    if (getSemesterProgress(account.journey, ACTIVITIES).ready) {
      account = applyAction(account, { action: 'advance', ...tokens(account), expectedSemester: account.journey.semester }, now, ACTIVITIES).account;
      if (account.journey.graduated) break;
      const opened = getAssignments(account.journey, ACTIVITIES).assignments.filter(id => !account.journey.results[id]?.completed);
      assert.deepEqual(opened, [], 'No new-semester mission opens before the next study day');
    }
    account = applyAction(account, { action: 'fitness', ...tokens(account), kind: 'pt', proof }, now, ACTIVITIES).account;
    account = applyAction(account, { action: 'sleep', ...tokens(account), requestId: `book-sleep-${String(++sleepCount).padStart(4, '0')}` }, now, ACTIVITIES).account;
    if (getWeekStatus(account, now).rest) now += 7 * 86_400_000; // weekly rest ends next Monday
    assert.ok(sleepCount < 400, 'Catalog progression must terminate.');
  }
  assert.equal(submissionCount, ACTIVITIES.filter(activity => activity.required !== false).length);
  assert.equal(Object.values(account.journey.results).filter(result => result.completed).length, submissionCount);
  assert.equal(account.journey.semester, 8);
  assert.equal(getNPCProgress(account.journey, ACTIVITIES).completed, NPC_MISSIONS.length);
  assert.equal(getSeaTrainingProgress(account.journey, ACTIVITIES).status, 'approved');
  assert.equal(getLomaProgress(account.journey).completedCount, 50);
  process.stdout.write(`  Catalog: ${submissionCount} completed activities, ${sleepCount} resets across ${Math.ceil(sleepCount / 5)} weekly allowances.\n`);
});

await test('a save from before daily plans keeps its work, resumes its started attempt first and is not charged again', async () => {
  const { ACTIVITIES } = await import('./public/game/book-course.js');
  const now = Date.parse('2026-10-21T03:00:00Z');
  let account = applyAction(createAccount(now, 'legacy-journey-01'), { action: 'init', profile: { name: 'Old Save', major: 'engine' } }, now, ACTIVITIES).account;
  account = introduced(account, now, ACTIVITIES);
  const semesterTwo = ACTIVITIES.filter(activity => activity.semester === 2);
  account.journey.semester = 2; account.journey.day = 9; account.journey.semesterStartDay = 7;
  delete account.journey.daily; delete account.allowance.missions; account.allowance.used = 2;
  for (const activity of semesterTwo.slice(0, 10)) account.journey.results[activity.id] = { completed: true, attempts: 1, outcome: 'correct', answers: {}, firstAssignedDay: 7 };
  const started = semesterTwo[10];
  account.journey.results[started.id] = { completed: false, attempts: 2, answers: {}, firstAssignedDay: 8, lastAttemptAt: new Date(now - 86_400_000).toISOString() };
  const before = JSON.stringify(account), state = publicState(account, now, ACTIVITIES);
  assert.equal(JSON.stringify(account), before, 'Reading an old save does not change it');
  assert.equal(state.today.studyDay, 3); assert.equal(state.today.weekMissionsUsed, 0);
  assert.equal(state.plan[0].id, started.id); assert.equal(state.plan[0].status, 'in-progress');
  assert.equal(Object.values(state.results).filter(result => result.completed).length, 10);
  const done = applyAction(account, { action: 'complete', ...tokens(account), activityId: started.id,
    answers: Object.fromEntries(playedQuestions(account, started).map(question => [question.id, question.answers[0]])) }, now, ACTIVITIES);
  assert.equal(done.feedback.passed, true);
  const after = publicState(done.account, now, ACTIVITIES);
  assert.equal(after.rpg.wellbeing.energy, state.rpg.wellbeing.energy, 'An attempt started before the update is not charged entry energy');
  assert.equal(after.today.slotsUsed, 1); assert.equal(after.week.used, 2);
});

process.stdout.write(`\n${checks} academy rule, persistence, and API checks passed.\n`);
