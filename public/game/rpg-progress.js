/** Saved, dependency-free RPG rules. Values describe a fictional game avatar. */
import { NPCS, NPC_MISSIONS, getNPCMission } from './npc-content.js';
import { SAFETY_GAMES } from './lifeboat-content.js';
import { getLomaGame } from './loma-content.js';

export const RPG_VERSION = 1;
export const RPG_LEVEL_XP = 100;
export const RPG_SKILL_LEVEL_XP = 30;
export const RPG_SKILLS = Object.freeze([
  { id: 'english', label: 'English', description: 'Vocabulary, sentence building, reading and presentations.' },
  { id: 'maths', label: 'Mathematics', description: 'Numbers, algebra, measurements and calculations.' },
  { id: 'science', label: 'Science', description: 'Observations, materials, evidence and scientific reasoning.' },
  { id: 'navigation', label: 'Navigation', description: 'Directions, charts, waypoints and route records.' },
  { id: 'engineering', label: 'Engineering', description: 'Equipment labels, displays, measurements and workshop records.' },
  { id: 'radio', label: 'Radio & SMCP', description: 'Clear messages, clarification and radio log details.' },
  { id: 'safety', label: 'Safety', description: 'Safety vocabulary, readiness and careful reporting.' },
  { id: 'leadership', label: 'Leadership', description: 'Planning, teamwork, introductions and responsibility.' },
  { id: 'fitness', label: 'Fitness', description: 'Dormitory exercise and regular avatar care.' },
].map(item => Object.freeze(item)));

export const RPG_TRAITS = Object.freeze([
  { id: 'communicator', label: 'Communicator', skillIds: ['english', 'radio'], description: '+2 skill XP when a new game trains English or radio.' },
  { id: 'analytical', label: 'Analytical', skillIds: ['maths', 'science'], description: '+2 skill XP when a new game trains mathematics or science.' },
  { id: 'navigator', label: 'Navigator', skillIds: ['navigation'], description: '+2 skill XP when a new game trains navigation.' },
  { id: 'technical', label: 'Technical', skillIds: ['engineering'], description: '+2 skill XP when a new game trains engineering.' },
  { id: 'team-player', label: 'Team Player', skillIds: ['leadership', 'safety'], description: '+2 skill XP when a new game trains leadership or safety.' },
  { id: 'active', label: 'Active', skillIds: ['fitness'], description: '+2 skill XP when a new game trains fitness.' },
].map(item => Object.freeze({ ...item, skillIds: Object.freeze(item.skillIds), bonus: 2 })));

export const RPG_CARE = Object.freeze([
  { id: 'water', label: 'Drink water', description: 'Refill your avatar’s hydration.', restores: { hydration: 40 } },
  { id: 'meal', label: 'Have a meal', description: 'Refill nourishment and a little energy.', restores: { nourishment: 40, energy: 5 } },
  { id: 'rest', label: 'Take a break', description: 'Rest your avatar without advancing the game day.', restores: { energy: 40 } },
].map(item => Object.freeze({ ...item, restores: Object.freeze(item.restores), xp: 2, skillId: 'fitness', skillXp: 2,
  locations: Object.freeze(['cafe', 'garden', 'dorm']) })));

const SKILL_BY_ID = new Map(RPG_SKILLS.map(item => [item.id, item]));
const TRAIT_BY_ID = new Map(RPG_TRAITS.map(item => [item.id, item]));
const STAFF_SKILLS = Object.freeze({
  chalermvut: ['leadership', 'english'], kobchapan: ['leadership', 'english'], wayne: ['english'],
  thanaphat: ['leadership'], yak: ['fitness', 'leadership'], aphisit: ['maths'], anne: ['science'],
  jakk: ['navigation', 'english'], dream: ['leadership', 'safety'],
  asawin: ['engineering', 'science'], gerald: ['engineering', 'maths'], amara: ['engineering', 'safety'],
  bank: ['radio', 'english'], duke: ['navigation', 'maths'],
});
const GAME_SOURCES = new Set(['book', 'staff', 'safety', 'loma']);
const validDay = value => Number.isInteger(value) && value >= 1 && value <= 1_000_000;
const numeric = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const boundedMeter = value => Math.max(0, Math.min(100, numeric(value, 100)));
const copy = value => JSON.parse(JSON.stringify(value));
const atISO = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;

function sourceItem(source, item, activities) {
  if (item && typeof item === 'object') return item;
  if (source === 'book') return activities.find(activity => activity.id === item) || null;
  if (source === 'staff') return getNPCMission(item);
  if (source === 'safety') return SAFETY_GAMES.find(game => game.id === item) || null;
  if (source === 'loma') return getLomaGame(item);
  return null;
}

/** Every catalog item maps to taught skills. Loma keeps its source game's mapping. */
export function getGameSkillIds(source, value, activities = []) {
  if (source === 'intro') return ['leadership'];
  if (source === 'fitness' || source === 'care') return ['fitness'];
  const item = sourceItem(source, value, activities);
  if (!item) return [];
  if (source === 'staff') return [...(STAFF_SKILLS[item.npcId] || ['leadership'])];
  if (source === 'safety') return ['safety', 'english'];
  if (source === 'loma') {
    const parent = item.source;
    if (parent?.kind && parent?.activityId) {
      const inherited = getGameSkillIds(parent.kind, parent.activityId, activities);
      if (inherited.length) return inherited;
    }
    return item.category === 'safety' ? ['safety', 'english']
      : item.major === 'engine' ? ['engineering', 'english']
        : item.major === 'deck' ? ['navigation', 'english'] : ['english'];
  }
  if (source === 'book') {
    // Subject games train their own subject first.
    const subject = { math: ['maths', 'navigation'], science: ['science', 'engineering'], colreg: ['navigation', 'safety'], safety: ['safety', 'english'] }[item.type];
    if (subject) return [...subject];
    let domain = null;
    if (item.room === 'gmdss' || [5, 6].includes(Number(item.unit))) domain = 'radio';
    else if (item.room === 'ecdis' || item.room === 'bridge' || [3, 4, 7, 8].includes(Number(item.unit))) domain = 'navigation';
    else if (item.room === 'engine' || item.location === 'workshop' || Number(item.unit) === 9) domain = 'engineering';
    else if (Number(item.unit) === 2 || item.location === 'lifeboat') domain = 'safety';
    else if (['dome', 'academic', 'garden'].includes(item.location) || item.room === 'captain') domain = 'leadership';
    return domain ? ['english', domain] : ['english'];
  }
  return [];
}

export function getRPGRewardPreview(source, item, activities = []) {
  const ids = getGameSkillIds(source, item, activities);
  const xp = source === 'intro' || source === 'care' ? 2 : ids.length ? 10 : 0;
  return { xp, skills: ids.map((id, index) => ({ id, label: SKILL_BY_ID.get(id).label,
    xp: source === 'intro' || source === 'care' ? 2 : index === 0 ? 10 : 4 })) };
}

export function createRPGState() {
  return { version: RPG_VERSION, rewards: {}, traits: { selected: [], lockedAt: null },
    wellbeing: { energy: 100, hydration: 100, nourishment: 100 },
    body: { heightCm: null, weightKg: null, history: [] } };
}

export function calculateBMI(heightCm, weightKg) {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return null;
  return Math.round(weightKg / ((heightCm / 100) ** 2) * 10) / 10;
}

function validBody(heightCm, weightKg) {
  return Number.isFinite(heightCm) && heightCm >= 90 && heightCm <= 250
    && Number.isFinite(weightKg) && weightKg >= 20 && weightKg <= 300;
}

function addBackfill(rpg, source, id, item, result, activities, day = null) {
  const key = `${source}:${id}`;
  if (rpg.rewards[key]) return;
  const preview = getRPGRewardPreview(source, item, activities);
  if (!preview.xp) return;
  rpg.rewards[key] = { source, id, xp: preview.xp,
    skills: Object.fromEntries(preview.skills.map(skill => [skill.id, skill.xp])),
    day: validDay(day) ? day : null, at: atISO(result?.completedAt || result?.at), legacy: true };
}

/** Backfill only known, saved completions. Migration never spends care or locks traits. */
export function prepareRPGJourney(journey, activities = [], sleepReceipts = []) {
  const original = journey.rpg && typeof journey.rpg === 'object' && !Array.isArray(journey.rpg)
    ? journey.rpg : createRPGState();
  const rpg = { ...createRPGState(), ...original };
  rpg.version = RPG_VERSION;
  const savedRewards = original.rewards && typeof original.rewards === 'object' && !Array.isArray(original.rewards)
    ? original.rewards : {};
  rpg.rewards = {};
  // Only our fixed reward schema is retained. Client profile fields never reach this ledger.
  for (const [key, reward] of Object.entries(savedRewards)) {
    if (!reward || typeof reward !== 'object' || typeof reward.id !== 'string' || key !== `${reward.source}:${reward.id}`) continue;
    let known = false;
    if (reward.source === 'book') known = activities.some(item => item.id === reward.id) && journey.results?.[reward.id]?.completed === true;
    else if (reward.source === 'staff') known = Boolean(getNPCMission(reward.id) && journey.npcResults?.[reward.id]?.completed === true);
    else if (reward.source === 'safety') known = SAFETY_GAMES.some(item => item.id === reward.id) && journey.safetyResults?.[reward.id]?.completed === true;
    else if (reward.source === 'loma') known = Boolean(getLomaGame(reward.id) && journey.loma?.gameIds?.includes(reward.id) && journey.loma?.results?.[reward.id]?.completed === true);
    else if (reward.source === 'intro') known = NPCS.some(npc => npc.id === reward.id) && Boolean(atISO(journey.orientation?.introductions?.[reward.id]));
    else if (reward.source === 'fitness') known = validDay(Number(reward.id)) && Number(reward.id) <= journey.day && reward.day === Number(reward.id);
    else if (reward.source === 'care') {
      const [day, kind] = reward.id.split(':');
      known = validDay(Number(day)) && Number(day) <= journey.day && reward.day === Number(day)
        && RPG_CARE.some(care => care.id === kind) && reward.id === `${Number(day)}:${kind}`;
    }
    if (!known) continue;
    const skills = {};
    for (const [id, amount] of Object.entries(reward.skills || {})) {
      if (SKILL_BY_ID.has(id) && Number.isInteger(amount) && amount > 0 && amount <= 20) skills[id] = amount;
    }
    if (!Object.keys(skills).length) continue;
    rpg.rewards[key] = { source: reward.source, id: reward.id,
      xp: ['intro', 'care'].includes(reward.source) ? 2 : 10,
      skills, day: validDay(reward.day) ? reward.day : null, at: atISO(reward.at), legacy: reward.legacy === true };
  }
  const selected = Array.isArray(original.traits?.selected)
    ? [...new Set(original.traits.selected.filter(id => TRAIT_BY_ID.has(id)))].slice(0, 2) : [];
  rpg.traits = { selected: selected.length === 2 ? selected : [],
    lockedAt: selected.length === 2 ? atISO(original.traits?.lockedAt) : null };
  rpg.wellbeing = Object.fromEntries(['energy', 'hydration', 'nourishment'].map(id => [id, boundedMeter(original.wellbeing?.[id])]));
  const body = original.body || {};
  rpg.body = { heightCm: validBody(body.heightCm, body.weightKg) ? body.heightCm : null,
    weightKg: validBody(body.heightCm, body.weightKg) ? body.weightKg : null,
    history: (Array.isArray(body.history) ? body.history : []).filter(entry => entry && validBody(entry.heightCm, entry.weightKg)
      && validDay(entry.day) && atISO(entry.recordedAt)).slice(-20).map(entry => ({ heightCm: entry.heightCm,
      weightKg: entry.weightKg, bmi: calculateBMI(entry.heightCm, entry.weightKg), day: entry.day, recordedAt: entry.recordedAt })) };
  for (const item of activities) if (journey.results?.[item.id]?.completed === true) {
    const result = journey.results[item.id];
    addBackfill(rpg, 'book', item.id, item, result, activities, result.completionDay || result.firstAssignedDay);
  }
  for (const mission of NPC_MISSIONS) if (journey.npcResults?.[mission.id]?.completed === true) {
    addBackfill(rpg, 'staff', mission.id, mission, journey.npcResults[mission.id], activities);
  }
  for (const game of SAFETY_GAMES) if (journey.safetyResults?.[game.id]?.completed === true) {
    addBackfill(rpg, 'safety', game.id, game, journey.safetyResults[game.id], activities, journey.safetyResults[game.id].firstAssignedDay);
  }
  for (const id of journey.loma?.gameIds || []) {
    const game = getLomaGame(id), result = journey.loma?.results?.[id];
    if (game && result?.completed === true) addBackfill(rpg, 'loma', id, game, result, activities, result.completionDay);
  }
  for (const npc of NPCS) if (atISO(journey.orientation?.introductions?.[npc.id])) {
    addBackfill(rpg, 'intro', npc.id, npc, { at: journey.orientation.introductions[npc.id] }, activities);
  }
  // A recorded sleep proves the required exercise was accepted for its source day.
  for (const receipt of sleepReceipts) if (receipt.journeyId === journey.journeyId && validDay(receipt.day) && receipt.day < journey.day) {
    addBackfill(rpg, 'fitness', String(receipt.day), null, { at: receipt.createdAt }, activities, receipt.day);
  }
  if (journey.fitness?.day === journey.day && ['pt', 'run', 'football'].includes(journey.fitness.kind)) {
    addBackfill(rpg, 'fitness', String(journey.day), null, journey.fitness, activities, journey.day);
  }
  journey.rpg = rpg;
  return rpg;
}

function levelAt(xp, step) {
  return { level: Math.floor(xp / step) + 1, xpIntoLevel: xp % step, xpForNextLevel: step,
    progressPercent: Math.round((xp % step) / step * 100) };
}

function summaryFromPrepared(journey) {
  const rpg = journey.rpg;
  const entries = Object.values(rpg.rewards);
  const totalXp = entries.reduce((total, entry) => total + entry.xp, 0);
  const skills = RPG_SKILLS.map(skill => {
    const xp = entries.reduce((total, entry) => total + (entry.skills[skill.id] || 0), 0);
    return { ...skill, xp, ...levelAt(xp, RPG_SKILL_LEVEL_XP) };
  });
  const completedGames = entries.filter(entry => GAME_SOURCES.has(entry.source)).length;
  const fitnessDays = entries.filter(entry => entry.source === 'fitness').length;
  const visited = entries.filter(entry => entry.source === 'intro').length;
  const careDays = [...new Set(entries.filter(entry => entry.source === 'care').map(entry => entry.day))];
  const routineDays = careDays.filter(day => ['water', 'meal', 'rest'].every(kind => rpg.rewards[`care:${day}:${kind}`])
    && rpg.rewards[`fitness:${day}`]).length;
  const radioXp = skills.find(skill => skill.id === 'radio').xp;
  const broadSkills = skills.filter(skill => skill.level >= 3).length;
  const earned = [
    { id: 'campus-connected', label: 'Campus Connected', description: 'You know the college team.', goal: `Meet all ${NPCS.length} staff members`, current: visited, target: NPCS.length },
    { id: 'steady-learner', label: 'Steady Learner', description: 'You turn learning into a habit.', goal: 'Complete 10 distinct graded mini-games', current: completedGames, target: 10 },
    { id: 'radio-ready', label: 'Clear Communicator', description: 'You have practised clear classroom radio messages.', goal: 'Earn 60 Radio & SMCP skill XP', current: radioXp, target: 60 },
    { id: 'active-cadet', label: 'Active Cadet', description: 'You keep a regular game exercise routine.', goal: 'Complete dormitory exercise on 5 game days', current: fitnessDays, target: 5 },
    { id: 'care-routine', label: 'Care Routine', description: 'You balance avatar care and exercise.', goal: 'Use water, meal, rest and exercise on 3 game days', current: routineDays, target: 3 },
    { id: 'all-round-cadet', label: 'All-round Cadet', description: 'Your strengths cover several subjects.', goal: 'Reach level 3 in 5 different skills', current: broadSkills, target: 5 },
  ].map(item => ({ ...item, current: Math.min(item.current, item.target), unlocked: item.current >= item.target }));
  return { version: RPG_VERSION, totalXp, ...levelAt(totalXp, RPG_LEVEL_XP), skills,
    traits: { selected: [...rpg.traits.selected], locked: Boolean(rpg.traits.lockedAt), lockedAt: rpg.traits.lockedAt,
      options: RPG_TRAITS, earned },
    wellbeing: { ...rpg.wellbeing, careDay: journey.day || 1,
      careToday: Object.fromEntries(RPG_CARE.map(care => [care.id, Boolean(rpg.rewards[`care:${journey.day || 1}:${care.id}`])])),
      careReady: Object.values(rpg.wellbeing).every(value => value >= 40) },
    body: { ...rpg.body, history: rpg.body.history.map(entry => ({ ...entry })),
      bmi: calculateBMI(rpg.body.heightCm, rpg.body.weightKg), fictional: true },
    rewardCount: entries.length, completedGames, fitnessDays, careRoutineDays: routineDays,
    legacyRewardCount: entries.filter(entry => entry.legacy).length };
}

/** Pure summary for both authoritative responses and read-only dashboard views. */
export function getRPGSummary(journey = {}, activities = [], sleepReceipts = []) {
  const local = { ...journey, rpg: journey.rpg ? copy(journey.rpg) : null };
  prepareRPGJourney(local, activities, sleepReceipts);
  return summaryFromPrepared(local);
}

/** Called only after server evaluation succeeds; stable keys make CAS retries harmless. */
export function awardRPGReward(journey, source, id, item, now, activities = []) {
  const rpg = journey.rpg;
  const key = `${source}:${id}`;
  if (rpg.rewards[key]) return null;
  const preview = getRPGRewardPreview(source, item, activities);
  if (!preview.xp) return null;
  const before = summaryFromPrepared(journey);
  const eligible = GAME_SOURCES.has(source) || source === 'fitness';
  const careReady = eligible && Object.values(rpg.wellbeing).every(value => value >= 40);
  const trained = new Set(rpg.traits.selected.flatMap(traitId => TRAIT_BY_ID.get(traitId)?.skillIds || []));
  const skills = preview.skills.map((skill, index) => {
    const traitBonus = eligible && trained.has(skill.id) ? 2 : 0;
    const careBonus = careReady && index === 0 ? 2 : 0;
    return { ...skill, baseXp: skill.xp, traitBonus, careBonus, xp: skill.xp + traitBonus + careBonus };
  });
  rpg.rewards[key] = { source, id, xp: preview.xp,
    skills: Object.fromEntries(skills.map(skill => [skill.id, skill.xp])), day: journey.day,
    at: new Date(now).toISOString(), legacy: false };
  if (eligible) {
    if (rpg.traits.selected.length === 2) rpg.traits.lockedAt = rpg.traits.lockedAt || new Date(now).toISOString();
    const cost = source === 'fitness' ? { energy: 8, hydration: 12, nourishment: 4 } : { energy: 3, hydration: 2, nourishment: 2 };
    for (const [meter, amount] of Object.entries(cost)) rpg.wellbeing[meter] = Math.max(0, rpg.wellbeing[meter] - amount);
  }
  const after = summaryFromPrepared(journey);
  const levelUps = after.skills.filter(skill => skill.level > before.skills.find(prior => prior.id === skill.id).level)
    .map(skill => ({ id: skill.id, label: skill.label, from: before.skills.find(prior => prior.id === skill.id).level, to: skill.level }));
  if (after.level > before.level) levelUps.unshift({ id: 'character', label: 'Cadet', from: before.level, to: after.level });
  return { key, source, id, label: item?.title || item?.name || (source === 'fitness' ? 'Dormitory exercise' : RPG_CARE.find(care => id.endsWith(`:${care.id}`))?.label) || 'Task complete',
    xp: preview.xp, skills, levelUps, level: after.level, previousLevel: before.level,
    careBonus: skills.reduce((sum, skill) => sum + skill.careBonus, 0),
    traitBonus: skills.reduce((sum, skill) => sum + skill.traitBonus, 0),
    earnedTraits: after.traits.earned.filter(trait => trait.unlocked && !before.traits.earned.find(prior => prior.id === trait.id)?.unlocked) };
}

/** Validation is injected by the authoritative course module to keep one error type. */
export function updateRPGProfile(journey, payload, now, requireRule) {
  const has = key => Object.prototype.hasOwnProperty.call(payload, key);
  const hasBody = has('heightCm') || has('weightKg');
  requireRule(hasBody || has('traits'), 'invalid_rpg_profile', 'Choose two traits or enter both avatar measurements.');
  const rpg = journey.rpg;
  if (hasBody) {
    requireRule(has('heightCm') && has('weightKg'), 'invalid_body', 'Enter height and weight together, or clear both.');
    const clear = payload.heightCm === null && payload.weightKg === null;
    requireRule(clear || validBody(payload.heightCm, payload.weightKg), 'invalid_body',
      'Use fictional avatar measurements: height 90–250 cm and weight 20–300 kg. These are game input limits, not health targets.');
    if (clear) rpg.body = { heightCm: null, weightKg: null, history: [] };
    else {
      const heightCm = Math.round(payload.heightCm * 10) / 10, weightKg = Math.round(payload.weightKg * 10) / 10;
      if (heightCm !== rpg.body.heightCm || weightKg !== rpg.body.weightKg) {
        rpg.body = { heightCm, weightKg, history: [...rpg.body.history, { heightCm, weightKg,
          bmi: calculateBMI(heightCm, weightKg), day: journey.day, recordedAt: new Date(now).toISOString() }].slice(-20) };
      }
    }
  }
  if (has('traits')) {
    requireRule(Array.isArray(payload.traits) && payload.traits.length === 2
      && payload.traits.every(id => typeof id === 'string' && TRAIT_BY_ID.has(id)) && new Set(payload.traits).size === 2,
    'invalid_traits', 'Choose exactly two different starter traits.');
    const same = payload.traits.every(id => rpg.traits.selected.includes(id));
    requireRule(!rpg.traits.lockedAt || same, 'traits_locked', 'Your starter traits are locked for this journey after a rewarded mini-game. Body measurements can still be updated.', 409);
    if (!same) rpg.traits.selected = [...payload.traits];
  }
}

export function applyRPGCare(journey, payload, now, activities, requireRule) {
  const care = RPG_CARE.find(item => item.id === payload.kind);
  requireRule(care, 'invalid_care', 'Choose water, a meal, or a rest break.');
  requireRule(typeof payload.location === 'string' && care.locations.includes(payload.location), 'care_location',
    'Use avatar care at Loma Café, Palm Garden, or the dormitory.', 409);
  const key = `care:${journey.day}:${care.id}`;
  if (journey.rpg.rewards[key]) return null;
  for (const [meter, amount] of Object.entries(care.restores)) journey.rpg.wellbeing[meter] = Math.min(100, journey.rpg.wellbeing[meter] + amount);
  return awardRPGReward(journey, 'care', `${journey.day}:${care.id}`, care, now, activities);
}

export function restoreRPGAfterSleep(journey) {
  journey.rpg.wellbeing.energy = 100;
  journey.rpg.wellbeing.hydration = Math.min(100, journey.rpg.wellbeing.hydration + 20);
  journey.rpg.wellbeing.nourishment = Math.min(100, journey.rpg.wellbeing.nourishment + 10);
}
