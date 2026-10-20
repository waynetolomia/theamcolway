import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { AcademyError, createAccount, applyAction, publicState, getSafetyProgress } from '../public/game/course-progress.js';
import { ACTIVITIES } from '../public/game/book-course.js';
import { NPCS, NPC_MISSIONS, getNPCMission } from '../public/game/npc-content.js';
import { SAFETY_GAMES, getSafetyGame } from '../public/game/lifeboat-content.js';
import { LOMA_GAMES, getLomaGame } from '../public/game/loma-content.js';
import { RPG_SKILLS, RPG_TRAITS, RPG_CARE, getGameSkillIds, getRPGRewardPreview, getRPGSummary, calculateBMI } from '../public/game/rpg-progress.js';
import { mutateAccount, readAccount } from '../lib/academy-store.mjs';

const NOW = Date.parse('2026-10-19T11:30:00Z');
const copy = value => JSON.parse(JSON.stringify(value));
const customBook = { id: 'rpg-test-book', semester: 1, location: 'pacific', unit: 1,
  title: 'A test vocabulary game', questions: [{ id: 'q', type: 'choice', answers: ['bow'], options: ['bow', 'aft'] }] };
const activities = [customBook, ...ACTIVITIES];
let count = 0;
async function test(name, work) { await work(); count++; process.stdout.write(`PASS ${name}\n`); }
const tokens = account => ({ expectedJourneyId: account.journey.journeyId, expectedDay: account.journey.day });
const stateTokens = state => ({ expectedJourneyId: state.journeyId, expectedDay: state.day });
const doAction = (account, payload, now = NOW) => applyAction(account, { ...tokens(account), ...payload }, now, activities, { journeyId: 'journey-rpg-next', random: () => 0.314159 });
const summary = account => publicState(account, NOW, activities).rpg;
const xpFor = (rpg, id) => rpg.skills.find(skill => skill.id === id).xp;
const answersFor = game => Object.fromEntries(game.questions.map(question => [question.id, question.answers?.[0] ?? question.answer]));
const throwCode = (fn, code) => assert.throws(fn, error => error instanceof AcademyError && error.code === code);
const proof = kind => ({ completed: true, score: 100, completedCount: kind === 'football' ? 5 : 8, total: kind === 'football' ? 5 : 8 });
function initialized(introduce = true) {
  let account = doAction(createAccount(NOW, 'journey-rpg-test'), { action: 'init', profile: { name: 'RPG Cadet', gender: 'female', major: 'deck' } }).account;
  if (introduce) for (const npc of NPCS) account = doAction(account, { action: 'introduceNPC', npcId: npc.id }).account;
  return account;
}
const finishStaff = (account, id) => doAction(account, { action: 'npcComplete', missionId: id, answers: answersFor(getNPCMission(id)) });
const fitness = (account, kind = 'pt') => doAction(account, { action: 'fitness', kind, proof: proof(kind) });
const sleep = (account, id, now = NOW) => doAction(account, { action: 'sleep', requestId: `rpg-sleep-${id}` }, now);

await test('every book, staff, safety and Loma game has valid XP and taught skill mapping', () => {
  assert.equal(RPG_SKILLS.length, 9); assert.equal(RPG_TRAITS.length, 6); assert.equal(RPG_CARE.length, 3);
  const valid = new Set(RPG_SKILLS.map(skill => skill.id));
  for (const [source, catalog] of [['book', ACTIVITIES], ['staff', NPC_MISSIONS], ['safety', SAFETY_GAMES], ['loma', LOMA_GAMES]]) {
    for (const game of catalog) {
      const ids = getGameSkillIds(source, game, ACTIVITIES);
      assert.ok(ids.length > 0 && ids.every(id => valid.has(id)), `${source}:${game.id}`);
      const preview = getRPGRewardPreview(source, game, ACTIVITIES);
      assert.equal(preview.xp, 10); assert.ok(preview.skills.every(skill => skill.xp > 0 && skill.label));
    }
  }
  assert.deepEqual(getGameSkillIds('staff', 'bank-radio-message', ACTIVITIES), ['radio', 'english']);
  assert.deepEqual(getGameSkillIds('staff', 'duke-chart-reader', ACTIVITIES), ['navigation', 'maths']);
  assert.deepEqual(getGameSkillIds('loma', 'loma-staff-bank-radio-message', ACTIVITIES), ['radio', 'english']);
  assert.equal(getRPGRewardPreview('book', 'unknown', ACTIVITIES).xp, 0);
});

await test('new RPG summary is neutral, complete and pure with no body or gender-derived stats', () => {
  const account = initialized(false), before = copy(account), rpg = summary(account);
  assert.equal(rpg.totalXp, 0); assert.equal(rpg.level, 1); assert.equal(rpg.skills.length, 9);
  assert.ok(rpg.skills.every(skill => skill.xp === 0 && skill.level === 1));
  assert.deepEqual(rpg.traits.selected, []); assert.equal(rpg.traits.locked, false);
  assert.equal(rpg.body.bmi, null); assert.deepEqual(rpg.body.history, []);
  assert.equal(rpg.wellbeing.energy, 100); assert.equal(rpg.wellbeing.hydration, 100); assert.equal(rpg.wellbeing.nourishment, 100);
  assert.deepEqual(account, before);
  const male = doAction(account, { action: 'profile', profile: { ...account.journey.profile, gender: 'male' } }).account;
  assert.deepEqual(summary(male), rpg);
});

await test('legacy records backfill known completions and evidenced exercise days without changing saved course data', () => {
  const old = initialized(false); delete old.journey.rpg;
  old.journey.day = 4; old.journey.results[customBook.id] = { completed: true, firstAssignedDay: 1, completedAt: new Date(NOW).toISOString() };
  old.journey.results['not-in-the-book'] = { completed: true };
  old.journey.npcResults['bank-radio-message'] = { completed: true };
  old.journey.npcResults['unknown-teacher-game'] = { completed: true };
  old.journey.safetyResults[SAFETY_GAMES[0].id] = { completed: true };
  old.journey.orientation.introductions.bank = new Date(NOW).toISOString();
  old.journey.fitness = { kind: 'run', day: 4, completedAt: new Date(NOW).toISOString() };
  old.sleepReceipts = [{ journeyId: old.journey.journeyId, day: 2, createdAt: new Date(NOW).toISOString() },
    { journeyId: 'a-different-journey', day: 3, createdAt: new Date(NOW).toISOString() }];
  old.allowance.used = 3;
  const before = copy(old), rpg = summary(old);
  assert.equal(rpg.totalXp, 52); assert.equal(rpg.completedGames, 3); assert.equal(rpg.fitnessDays, 2);
  assert.equal(rpg.legacyRewardCount, 6); assert.equal(rpg.traits.locked, false);
  assert.equal(rpg.wellbeing.energy, 100); assert.equal(xpFor(rpg, 'radio'), 10);
  assert.deepEqual(old, before);
  const saved = doAction(old, { action: 'rpgProfile', traits: ['communicator', 'active'] }).account;
  assert.equal(summary(saved).totalXp, 52); assert.equal(summary(saved).traits.locked, false);
  assert.deepEqual(saved.journey.results, old.journey.results); assert.deepEqual(saved.allowance, old.allowance);
  assert.deepEqual(summary(saved), getRPGSummary(saved.journey, activities, saved.sleepReceipts));
});

await test('all introductions reward two XP once, train leadership, and unlock the campus trait', () => {
  let account = initialized(false), last;
  for (const npc of NPCS) { last = doAction(account, { action: 'introduceNPC', npcId: npc.id }); account = last.account; assert.equal(last.reward.xp, 2); }
  assert.equal(summary(account).totalXp, NPCS.length * 2); assert.equal(xpFor(summary(account), 'leadership'), NPCS.length * 2);
  assert.ok(last.reward.earnedTraits.some(trait => trait.id === 'campus-connected'));
  const duplicate = doAction(account, { action: 'introduceNPC', npcId: 'bank' });
  assert.equal(duplicate.changed, false); assert.ok(!duplicate.reward); assert.deepEqual(duplicate.account, account);
});

await test('graded book passes reward once; failures and completed replays neither spend care nor add XP', () => {
  let account = initialized(), start = summary(account);
  const failed = doAction(account, { action: 'complete', activityId: customBook.id, answers: { q: 'aft' } });
  assert.equal(failed.feedback.passed, false); assert.equal(failed.reward, null); assert.deepEqual(summary(failed.account).wellbeing, start.wellbeing);
  const passed = doAction(failed.account, { action: 'complete', activityId: customBook.id, answers: { q: 'bow' } });
  account = passed.account;
  assert.equal(passed.reward.xp, 10); assert.equal(passed.reward.skills[0].xp, 12); assert.equal(passed.reward.careBonus, 2);
  assert.equal(summary(account).totalXp, start.totalXp + 10);
  assert.equal(summary(account).wellbeing.energy, 97); assert.equal(summary(account).wellbeing.hydration, 98); assert.equal(summary(account).wellbeing.nourishment, 98);
  for (const answer of ['bow', 'aft']) {
    const again = doAction(account, { action: 'complete', activityId: customBook.id, answers: { q: answer } });
    assert.equal(again.reward, null); assert.deepEqual(summary(again.account), summary(account));
    assert.equal(again.account.journey.results[customBook.id].answers.q, 'bow');
  }
});

await test('Bank and Duke produce their own skill gains and failed/replayed staff work gives no extra reward', () => {
  let account = initialized();
  const failed = doAction(account, { action: 'npcComplete', missionId: 'bank-radio-message', answers: {} });
  assert.equal(failed.reward, null); assert.equal(summary(failed.account).completedGames, 0);
  const bank = finishStaff(failed.account, 'bank-radio-message');
  assert.equal(bank.reward.xp, 10); assert.deepEqual(bank.reward.skills.map(skill => skill.id), ['radio', 'english']);
  const duke = finishStaff(bank.account, 'duke-chart-reader'); account = duke.account;
  assert.deepEqual(duke.reward.skills.map(skill => skill.id), ['navigation', 'maths']);
  assert.equal(summary(account).completedGames, 2); assert.equal(xpFor(summary(account), 'maths'), 4);
  assert.equal(finishStaff(account, 'bank-radio-message').reward, null);
  assert.deepEqual(summary(finishStaff(account, 'duke-chart-reader').account), summary(account));
});

await test('Lifeboat rewards preserve outfit and daily rotation requirements and never reward a duplicate', () => {
  let account = initialized();
  const game = getSafetyGame(getSafetyProgress(account.journey).todayId);
  const payload = { action: 'completeSafety', safetyId: game.id, answers: answersFor(game) };
  throwCode(() => doAction(account, payload), 'immersion_required');
  account = doAction(account, { action: 'profile', profile: { ...account.journey.profile, outfit: 'immersion' } }).account;
  const done = doAction(account, payload); assert.equal(done.reward.xp, 10); assert.equal(done.reward.skills[0].id, 'safety');
  const again = doAction(done.account, payload); assert.equal(again.changed, false); assert.deepEqual(summary(again.account), summary(done.account));
  throwCode(() => doAction(done.account, { ...payload, safetyId: SAFETY_GAMES[2].id }), 'safety_game_locked');
});

await test('the saved Loma final rewards separate review games once and still limits completion to five per day', () => {
  let account = initialized(); account.journey.semester = 8;
  account = doAction(account, { action: 'startLoma', expectedMajor: 'deck' }).account;
  const ids = [...account.journey.loma.gameIds], beforeXp = summary(account).totalXp;
  for (const id of ids.slice(0, 5)) {
    const game = getLomaGame(id), done = doAction(account, { action: 'completeLoma', gameId: id, answers: answersFor(game) });
    assert.equal(done.reward.xp, 10); assert.equal(done.reward.source, 'loma');
    assert.deepEqual(done.reward.skills.map(skill => skill.id), getGameSkillIds('loma', game, activities));
    account = done.account;
  }
  assert.equal(summary(account).totalXp, beforeXp + 50); assert.deepEqual(account.journey.loma.gameIds, ids);
  const duplicate = doAction(account, { action: 'completeLoma', gameId: ids[0], answers: answersFor(getLomaGame(ids[0])) });
  assert.equal(duplicate.changed, false); assert.ok(!duplicate.reward);
  throwCode(() => doAction(account, { action: 'completeLoma', gameId: ids[5], answers: answersFor(getLomaGame(ids[5])) }), 'loma_daily_limit');
});

await test('fitness gives ten XP for one exercise per game day across all three exercise choices', () => {
  let account = initialized(false), before = summary(account);
  throwCode(() => doAction(account, { action: 'fitness', kind: 'pt', proof: { ...proof('pt'), completedCount: 7 } }), 'fitness_incomplete');
  const first = fitness(account); account = first.account;
  assert.equal(first.reward.xp, 10); assert.equal(first.reward.skills[0].id, 'fitness'); assert.equal(summary(account).fitnessDays, 1);
  assert.equal(summary(account).wellbeing.energy, before.wellbeing.energy - 8);
  assert.equal(summary(account).wellbeing.hydration, before.wellbeing.hydration - 12);
  for (const kind of ['pt', 'run', 'football']) {
    const next = fitness(account, kind); assert.equal(next.reward, null); assert.deepEqual(summary(next.account), summary(account));
  }
});

await test('traits remain choosable until a new rewarded game, apply prospectively and cannot be rerolled after locking', () => {
  let account = fitness(initialized()).account;
  assert.equal(summary(account).traits.locked, false); assert.deepEqual(summary(account).traits.selected, []);
  account = doAction(account, { action: 'rpgProfile', traits: ['communicator', 'active'] }).account;
  const oldFitnessXp = xpFor(summary(account), 'fitness');
  assert.equal(summary(account).traits.locked, false);
  account = doAction(account, { action: 'rpgProfile', traits: ['communicator', 'analytical'] }).account;
  account = fitness(account).account; assert.equal(summary(account).traits.locked, false);
  account = doAction(account, { action: 'rpgCare', kind: 'water', location: 'dorm' }).account;
  assert.equal(summary(account).traits.locked, false);
  const learned = finishStaff(account, 'wayne-sentence-builder'); account = learned.account;
  assert.equal(learned.reward.xp, 10); assert.equal(learned.reward.skills[0].traitBonus, 2); assert.equal(learned.reward.skills[0].xp, 14);
  assert.equal(summary(account).traits.locked, true); assert.equal(xpFor(summary(account), 'fitness'), oldFitnessXp + 2);
  throwCode(() => doAction(account, { action: 'rpgProfile', traits: ['technical', 'active'] }), 'traits_locked');
  account = doAction(account, { action: 'rpgProfile', traits: ['analytical', 'communicator'], heightCm: 170, weightKg: 65 }).account;
  assert.equal(summary(account).body.bmi, 22.5);
});

await test('profile rejects malformed traits and body inputs, gives no measurement XP, records a bounded BMI history and clears it', () => {
  let account = initialized(false);
  for (const traits of [[], ['active'], ['active', 'active'], ['active', 'invented'], { active: true }]) {
    throwCode(() => doAction(account, { action: 'rpgProfile', traits }), 'invalid_traits');
  }
  for (const values of [{ heightCm: 170 }, { heightCm: '170', weightKg: 65 }, { heightCm: 0, weightKg: 65 },
    { heightCm: 251, weightKg: 65 }, { heightCm: 170, weightKg: -1 }, { heightCm: 170, weightKg: 301 },
    { heightCm: null, weightKg: 65 }, { heightCm: Infinity, weightKg: 65 }, { heightCm: [170], weightKg: 65 }]) {
    throwCode(() => doAction(account, { action: 'rpgProfile', ...values }), 'invalid_body');
  }
  throwCode(() => doAction(account, { action: 'rpgProfile', xp: 99999 }), 'invalid_rpg_profile');
  account = doAction(account, { action: 'rpgProfile', heightCm: 170, weightKg: 65, totalXp: 99999 }).account;
  assert.equal(summary(account).totalXp, 0); assert.equal(summary(account).body.bmi, 22.5);
  assert.equal(calculateBMI(200, 80), 20); assert.equal(calculateBMI(0, 80), null);
  account = doAction(account, { action: 'rpgProfile', heightCm: 170, weightKg: 65 }).account;
  assert.equal(summary(account).body.history.length, 1);
  for (let i = 0; i < 23; i++) account = doAction(account, { action: 'rpgProfile', heightCm: 170, weightKg: 66 + i }).account;
  assert.equal(summary(account).body.history.length, 20); assert.equal(summary(account).totalXp, 0);
  assert.equal(summary(account).wellbeing.energy, 100);
  account = doAction(account, { action: 'rpgProfile', heightCm: null, weightKg: null }).account;
  assert.equal(summary(account).body.bmi, null); assert.deepEqual(summary(account).body.history, []);
});

await test('care is available before orientation but bounded once per kind per game day with explicit locations', () => {
  let account = initialized(false); account.journey.rpg.wellbeing = { energy: 10, hydration: 10, nourishment: 10 };
  for (const [kind, location] of [['water', 'cafe'], ['meal', 'garden'], ['rest', 'dorm']]) {
    const done = doAction(account, { action: 'rpgCare', kind, location }); account = done.account;
    assert.equal(done.reward.xp, 2); assert.equal(done.reward.skills[0].xp, 2); assert.equal(done.reward.skills[0].id, 'fitness');
    assert.equal(done.reward.traitBonus, 0); assert.equal(done.reward.careBonus, 0);
    const duplicate = doAction(account, { action: 'rpgCare', kind, location });
    assert.equal(duplicate.changed, false); assert.equal(duplicate.reward, null); assert.deepEqual(duplicate.account, account);
  }
  assert.equal(summary(account).totalXp, 6); assert.equal(summary(account).wellbeing.energy, 55);
  assert.equal(summary(account).wellbeing.hydration, 50); assert.equal(summary(account).wellbeing.nourishment, 50);
  throwCode(() => doAction(account, { action: 'rpgCare', kind: 'medicine', location: 'dorm' }), 'invalid_care');
  throwCode(() => doAction(account, { action: 'rpgCare', kind: 'water', location: 'bridge' }), 'care_location');
  throwCode(() => doAction(account, { action: 'rpgCare', kind: 'water', location: 'cafe', expectedDay: 0 }), 'stale_day');
  throwCode(() => doAction(account, { action: 'rpgProfile', traits: ['active', 'technical'], expectedDay: 0 }), 'stale_day');
  throwCode(() => doAction(account, { action: 'rpgCare', kind: 'water', location: 'dorm', expectedJourneyId: 'old-journey' }), 'stale_journey');
});

await test('depleted wellbeing never blocks learning; care restores the prospective skill bonus and never changes BMI', () => {
  let account = initialized();
  account = doAction(account, { action: 'rpgProfile', heightCm: 180, weightKg: 72 }).account;
  account.journey.rpg.wellbeing = { energy: 0, hydration: 0, nourishment: 0 };
  const low = finishStaff(account, 'wayne-sentence-builder'); account = low.account;
  assert.equal(low.reward.xp, 10); assert.equal(low.reward.careBonus, 0); assert.equal(low.reward.skills[0].xp, 10);
  for (const kind of ['water', 'meal', 'rest']) account = doAction(account, { action: 'rpgCare', kind, location: 'garden' }).account;
  const cared = finishStaff(account, 'bank-radio-message'); account = cared.account;
  assert.equal(cared.reward.careBonus, 2); assert.equal(cared.reward.xp, 10);
  assert.equal(summary(account).body.bmi, 22.2); assert.equal(summary(account).body.weightKg, 72);
});

await test('sleep refreshes daily care, restores energy and earns the care routine trait across three game days', () => {
  let account = initialized(), thirdFitness;
  for (let day = 1; day <= 3; day++) {
    for (const kind of ['water', 'meal', 'rest']) account = doAction(account, { action: 'rpgCare', kind, location: 'dorm' }).account;
    const done = fitness(account); account = done.account; if (day === 3) thirdFitness = done;
    const beforeSleep = summary(account); account = sleep(account, `routine-${day}`).account;
    assert.equal(summary(account).totalXp, beforeSleep.totalXp);
    assert.equal(summary(account).wellbeing.energy, 100);
    assert.deepEqual(summary(account).wellbeing.careToday, { water: false, meal: false, rest: false });
  }
  assert.equal(summary(account).careRoutineDays, 3); assert.equal(summary(account).fitnessDays, 3);
  assert.ok(thirdFitness.reward.earnedTraits.some(trait => trait.id === 'care-routine'));
  assert.equal(account.allowance.used, 3);
});

await test('five weekly sleeps and new-journey allowance rules remain authoritative with RPG care and rewards', () => {
  let account = initialized();
  for (let i = 0; i < 5; i++) account = sleep(fitness(account).account, `quota-${i}`).account;
  assert.equal(account.journey.day, 6); assert.equal(account.allowance.used, 5);
  account = fitness(account).account;
  throwCode(() => sleep(account, 'quota-blocked'), 'weekly_limit');
  const before = copy(account); const future = Date.parse('2026-10-25T17:00:00Z');
  const refilled = publicState(account, future, activities);
  assert.equal(refilled.week.remaining, 5); assert.equal(refilled.day, 6); assert.deepEqual(refilled.rpg, summary(account));
  assert.deepEqual(account, before);
  const newOne = doAction(account, { action: 'newJourney', confirm: true }).account;
  assert.equal(summary(newOne).totalXp, 0); assert.equal(summary(newOne).body.bmi, null); assert.deepEqual(summary(newOne).traits.selected, []);
  assert.equal(newOne.allowance.used, 5); assert.equal(newOne.journey.day, 1);
  const advanced = sleep(account, 'next-week', future).account;
  assert.equal(advanced.journey.day, 7); assert.equal(advanced.allowance.used, 1);
});

await test('character and skill levels follow earned XP and expose level-up metadata', () => {
  let account = initialized(), earnedCharacterLevel = false;
  const missions = NPC_MISSIONS.filter(mission => mission.unlockSemester === 1 && mission.npcId !== 'amara').slice(0, 9);
  for (const mission of missions) {
    const done = finishStaff(account, mission.id); account = done.account;
    earnedCharacterLevel ||= done.reward.levelUps.some(level => level.id === 'character' && level.from === 1 && level.to === 2);
  }
  const rpg = summary(account);
  assert.equal(rpg.totalXp, 28 + missions.length * 10); assert.equal(rpg.level, Math.floor(rpg.totalXp / 100) + 1);
  assert.equal(rpg.xpIntoLevel, rpg.totalXp % 100); assert.equal(rpg.xpForNextLevel, 100); assert.equal(earnedCharacterLevel, true);
  for (const skill of rpg.skills) assert.equal(skill.level, Math.floor(skill.xp / 30) + 1);
});

function sqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE academy_accounts (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL)');
  sqlite.exec('CREATE TABLE academy_submissions (user_id TEXT NOT NULL, journey_id TEXT NOT NULL, activity_id TEXT NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, journey_id, activity_id))');
  function execute(sql, values) {
    if (database.failNextUpdate && sql.startsWith('UPDATE')) { database.failNextUpdate = false; throw new Error('simulated RPG write failure'); }
    const statement = sqlite.prepare(sql);
    if (sql.startsWith('SELECT')) return { success: true, results: statement.all(...values), meta: { changes: 0 } };
    const result = statement.run(...values); return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
  const database = { failNextUpdate: false,
    prepare(sql) { return { bind(...values) { return { sql, values,
      async run() { await Promise.resolve(); return execute(sql, values); },
      async first() { await Promise.resolve(); return sqlite.prepare(sql).get(...values) ?? null; } }; } }; },
    async batch(statements) { await Promise.resolve(); sqlite.exec('BEGIN');
      try { const results = statements.map(statement => execute(statement.sql, statement.values)); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
    close() { sqlite.close(); } };
  return database;
}
async function dbInit(db) {
  let result = await mutateAccount(db, 'rpg-cadet', { action: 'init', profile: { name: 'Saved RPG Cadet' } }, NOW, activities, () => 'journey-db-rpg');
  for (const npc of NPCS) result = await mutateAccount(db, 'rpg-cadet', { action: 'introduceNPC', ...stateTokens(result.state), npcId: npc.id }, NOW, activities);
  return result;
}

await test('real database CAS preserves simultaneous task and care rewards and only reports one reward per stable key', async () => {
  const db = sqliteD1();
  try {
    const first = await dbInit(db), t = stateTokens(first.state);
    const bank = { action: 'npcComplete', ...t, missionId: 'bank-radio-message', answers: answersFor(getNPCMission('bank-radio-message')) };
    const duke = { action: 'npcComplete', ...t, missionId: 'duke-chart-reader', answers: answersFor(getNPCMission('duke-chart-reader')) };
    const water = { action: 'rpgCare', ...t, kind: 'water', location: 'dorm' };
    const outcomes = await Promise.all([bank, bank, duke, water, water].map(payload => mutateAccount(db, 'rpg-cadet', payload, NOW, activities)));
    assert.equal(outcomes.filter(result => result.reward?.key === 'staff:bank-radio-message').length, 1);
    assert.equal(outcomes.filter(result => result.reward?.key === 'staff:duke-chart-reader').length, 1);
    assert.equal(outcomes.filter(result => result.reward?.key === 'care:1:water').length, 1);
    const row = await readAccount(db, 'rpg-cadet', NOW), state = publicState(row.document, NOW, activities);
    assert.equal(state.rpg.totalXp, 50); assert.equal(state.rpg.completedGames, 2); assert.equal(state.rpg.wellbeing.careToday.water, true);
    assert.equal(state.npc.results['bank-radio-message'].completed, true); assert.equal(state.npc.results['duke-chart-reader'].completed, true);
    assert.equal(Object.keys(row.document.journey.rpg.rewards).length, 17);
  } finally { db.close(); }
});

await test('failed real database writes roll back book answers and rewards, and care retries persist exactly once', async () => {
  const db = sqliteD1();
  try {
    const first = await dbInit(db), t = stateTokens(first.state), before = await readAccount(db, 'rpg-cadet', NOW);
    const payload = { action: 'complete', ...t, activityId: customBook.id, answers: { q: 'bow' } };
    db.failNextUpdate = true;
    await assert.rejects(mutateAccount(db, 'rpg-cadet', payload, NOW, activities), /simulated RPG write failure/);
    assert.deepEqual(await readAccount(db, 'rpg-cadet', NOW), before);
    const retried = await mutateAccount(db, 'rpg-cadet', payload, NOW, activities);
    assert.equal(retried.reward.xp, 10); assert.equal(retried.state.rpg.totalXp, 38);
    const stored = await readAccount(db, 'rpg-cadet', NOW);
    assert.equal(stored.document.journey.results[customBook.id].answers.q, 'bow');
    assert.equal(stored.document.journey.rpg.rewards[`book:${customBook.id}`].xp, 10);
    const care = { action: 'rpgCare', ...t, kind: 'meal', location: 'cafe' };
    db.failNextUpdate = true;
    await assert.rejects(mutateAccount(db, 'rpg-cadet', care, NOW, activities), /simulated RPG write failure/);
    assert.deepEqual(await readAccount(db, 'rpg-cadet', NOW), stored);
    const done = await mutateAccount(db, 'rpg-cadet', care, NOW, activities);
    assert.equal(done.reward.xp, 2); assert.equal(done.state.rpg.totalXp, 40);
    const again = await mutateAccount(db, 'rpg-cadet', care, NOW, activities);
    assert.equal(again.reward, null); assert.equal(again.duplicate, true); assert.equal(again.revision, done.revision);
  } finally { db.close(); }
});

await test('real database profile, traits, fitness and new-day care survive independent reads', async () => {
  const db = sqliteD1();
  try {
    let result = await dbInit(db);
    result = await mutateAccount(db, 'rpg-cadet', { action: 'rpgProfile', ...stateTokens(result.state), traits: ['active', 'technical'], heightCm: 175, weightKg: 70 }, NOW, activities);
    result = await mutateAccount(db, 'rpg-cadet', { action: 'fitness', ...stateTokens(result.state), kind: 'football', proof: proof('football') }, NOW, activities);
    assert.equal(result.reward.skills[0].traitBonus, 2); assert.equal(result.state.rpg.traits.locked, true);
    result = await mutateAccount(db, 'rpg-cadet', { action: 'rpgCare', ...stateTokens(result.state), kind: 'water', location: 'dorm' }, NOW, activities);
    result = await mutateAccount(db, 'rpg-cadet', { action: 'sleep', ...stateTokens(result.state), requestId: 'rpg-db-sleep-one' }, NOW, activities);
    const row = await readAccount(db, 'rpg-cadet', NOW), state = publicState(row.document, NOW, activities);
    assert.equal(state.rpg.totalXp, 40); assert.equal(state.day, 2); assert.equal(state.week.used, 1);
    assert.equal(state.rpg.body.bmi, 22.9); assert.equal(state.rpg.body.history.length, 1); assert.equal(state.rpg.traits.locked, true);
    assert.equal(state.rpg.fitnessDays, 1); assert.equal(state.rpg.wellbeing.careToday.water, false); assert.equal(state.rpg.wellbeing.energy, 100);
    assert.deepEqual(state.rpg, result.state.rpg);
  } finally { db.close(); }
});

process.stdout.write(`\n${count} RPG rule, mapping, migration and database checks passed.\n`);
