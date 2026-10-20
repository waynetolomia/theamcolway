/** Shared, dependency-free academic rules. All authoritative calls use server time. */
import { NPCS, NPC_MISSIONS, STAFF_SIGNOFF_IDS, SEA_TRAINING_REVIEW_ID, ORIENTATION_ROUTE, getNPC, getNPCMission } from './npc-content.js';
import { normalizeCharacter } from './progress.js';
import { SAFETY_GAMES, getSafetyGame } from './lifeboat-content.js';
import { LOMA_FINAL_COUNT, LOMA_DAILY_LIMIT, getLomaGame, drawLomaSet } from './loma-content.js';
import { createRPGState, prepareRPGJourney, getRPGSummary, awardRPGReward,
  updateRPGProfile, applyRPGCare, restoreRPGAfterSleep } from './rpg-progress.js';

export const WEEKLY_RESET_LIMIT = 5;
export const COURSE_SEMESTERS = 8;
export const CAMPUS_TIMEZONE = 'Asia/Bangkok';
export const ORIENTATION_ID = 'first-day-orientation';
export const WORKSHOP_OUTFIT = 'coverall';
export const LIFEBOAT_OUTFIT = 'immersion';
const DAY_MS = 86_400_000;
const BANGKOK_OFFSET_MS = 7 * 3_600_000;
const FITNESS_KINDS = new Set(['pt', 'run', 'football']);
const FITNESS_TARGETS = { pt: 8, run: 8, football: 5 };

export class AcademyError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message); this.name = 'AcademyError'; this.code = code;
    this.status = status; this.details = details;
  }
}

function requireRule(condition, code, message, status = 400, details = {}) {
  if (!condition) throw new AcademyError(code, message, status, details);
}
function timestamp(now) {
  const value = typeof now === 'number' ? now : new Date(now).getTime();
  requireRule(Number.isFinite(value), 'invalid_time', 'A valid server time is required.', 500);
  return value;
}
function iso(now) { return new Date(timestamp(now)).toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

/** Monday 00:00 Bangkok is Sunday 17:00 UTC. Bangkok has no daylight saving. */
export function getBangkokWeek(now) {
  const utc = timestamp(now);
  const local = new Date(utc + BANGKOK_OFFSET_MS);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const monday = localMidnight - ((local.getUTCDay() + 6) % 7) * DAY_MS;
  const starts = monday - BANGKOK_OFFSET_MS;
  const ends = starts + 7 * DAY_MS;
  return {
    key: new Date(monday).toISOString().slice(0, 10),
    startsAt: new Date(starts).toISOString(),
    resetsAt: new Date(ends).toISOString(),
    timezone: CAMPUS_TIMEZONE,
  };
}

export function getWeekStatus(account, now) {
  const week = getBangkokWeek(now);
  const used = account?.allowance?.weekKey === week.key
    ? Math.min(WEEKLY_RESET_LIMIT, Math.max(0, Number(account.allowance.used) || 0)) : 0;
  return { ...week, used, remaining: WEEKLY_RESET_LIMIT - used, limit: WEEKLY_RESET_LIMIT };
}

function cleanProfile(profile) {
  requireRule(profile && typeof profile === 'object' && !Array.isArray(profile), 'invalid_profile', 'Create or select a cadet first.');
  requireRule(Object.keys(profile).length > 0, 'invalid_profile', 'The cadet profile is empty.');
  // Creator and account use one allowlist. Unrecognized values cannot equip gear
  // or smuggle progress, orientation, approval, or clock fields into the profile.
  return normalizeCharacter(profile);
}

function createJourney(now, journeyId, profile = null) {
  requireRule(typeof journeyId === 'string' && journeyId.length >= 8, 'invalid_journey', 'A server-generated journey id is required.', 500);
  return {
    journeyId, initialized: Boolean(profile), profile,
    semester: 1, day: 1, semesterStartDay: 1,
    fitness: null, results: {}, npcResults: {}, safetyResults: {}, seaTraining: null,
    loma: null, lomaRequirementVersion: 1, lomaLegacyGraduate: false,
    orientation: { introductions: {}, completedAt: null }, graduated: false,
    rpg: createRPGState(),
    createdAt: iso(now), updatedAt: iso(now),
  };
}

export function createAccount(now, journeyId) {
  return {
    schemaVersion: 1,
    allowance: { weekKey: getBangkokWeek(now).key, used: 0 },
    journey: createJourney(now, journeyId),
    sleepReceipts: [],
    completedJourneys: [],
  };
}

export function activitySemester(activity) {
  const raw = activity?.semesterId ?? activity?.semester;
  return Number(raw);
}

export function semesterActivities(activities, semester) {
  return activities.filter(activity => activity.required !== false && activitySemester(activity) === Number(semester));
}

/** The next item at each location unlocks only when the server day advances. */
export function getAssignments(state, activities) {
  if (!state?.initialized || state.graduated) return { assignments: [], backlog: [], unlocked: [], byLocation: {} };
  const elapsed = state.day - state.semesterStartDay;
  const groups = new Map();
  for (const activity of semesterActivities(activities, state.semester)) {
    if (!groups.has(activity.location)) groups.set(activity.location, []);
    groups.get(activity.location).push(activity);
  }
  const assignments = [], backlog = [], unlocked = [], byLocation = {};
  for (const [location, group] of groups) {
    const open = elapsed < 0 ? [] : group.slice(0, elapsed + 1);
    const today = elapsed >= 0 ? group[elapsed]?.id ?? null : null;
    const oldIncomplete = open.filter(item => item.id !== today && !state.results[item.id]?.completed).map(item => item.id);
    if (today) assignments.push(today);
    backlog.push(...oldIncomplete);
    unlocked.push(...open.map(item => item.id));
    byLocation[location] = {
      today, backlog: oldIncomplete,
      unlocked: open.map(item => item.id),
      remainingToUnlock: Math.max(0, group.length - open.length),
      practice: open.filter(item => state.results[item.id]?.completed).map(item => item.id),
    };
  }
  return { assignments, backlog, unlocked, byLocation };
}

export function getSemesterProgress(state, activities) {
  const required = semesterActivities(activities, state.semester);
  const completed = required.filter(item => state.results[item.id]?.completed).length;
  const bookReady = required.length > 0 && completed === required.length;
  const seaTrainingBlocked = Number(state.semester) === 4 && getSeaTrainingProgress(state, activities).status !== 'approved';
  const orientationBlocked = !getOrientationProgress(state).completed;
  const lomaBlocked = Number(state.semester) === 8 && !state.graduated && !getLomaProgress(state).complete;
  return {
    required: required.length, completed, remaining: required.length - completed,
    bookReady, seaTrainingBlocked, orientationBlocked, lomaBlocked, ready: bookReady && !seaTrainingBlocked && !orientationBlocked && !lomaBlocked,
    awaitingNextDay: state.day < state.semesterStartDay,
  };
}

/** New fields are optional on older journeys; existing course and quota records stay intact. */
function normalizeNPCFields(state) {
  if (!state.npcResults || typeof state.npcResults !== 'object' || Array.isArray(state.npcResults)) state.npcResults = {};
  if (!state.safetyResults || typeof state.safetyResults !== 'object' || Array.isArray(state.safetyResults)) state.safetyResults = {};
  if (!state.seaTraining || typeof state.seaTraining !== 'object' || Array.isArray(state.seaTraining)) state.seaTraining = null;
  // An already-awarded legacy degree stays awarded. Current journeys gain the
  // final requirement; a fresh journey never inherits the grandfathered flag.
  if (state.lomaRequirementVersion !== 1) {
    state.lomaLegacyGraduate = state.graduated === true;
    state.lomaRequirementVersion = 1;
  }
  if (!state.loma || typeof state.loma !== 'object' || Array.isArray(state.loma)) state.loma = null;
  if (state.loma && (!state.loma.results || typeof state.loma.results !== 'object' || Array.isArray(state.loma.results))) state.loma.results = {};
  if (state.profile) state.profile = normalizeCharacter(state.profile);
  const oldIntroductions = state.orientation?.introductions;
  const introductions = {};
  if (oldIntroductions && typeof oldIntroductions === 'object' && !Array.isArray(oldIntroductions)) {
    for (const npc of NPCS) {
      const at = oldIntroductions[npc.id];
      if (typeof at === 'string' && Number.isFinite(Date.parse(at))) introductions[npc.id] = at;
    }
  }
  const completedAt = state.orientation?.completedAt;
  state.orientation = { introductions,
    completedAt: Object.keys(introductions).length === NPCS.length
      && typeof completedAt === 'string' && Number.isFinite(Date.parse(completedAt)) ? completedAt : null };
  return state;
}

/** First-day orientation is one mission with an explicit introduction for each staff member. */
export function getOrientationProgress(state) {
  const introductions = state?.orientation?.introductions || {};
  const route = [...ORIENTATION_ROUTE, ...NPCS.map(npc => npc.id).filter(id => !ORIENTATION_ROUTE.includes(id))];
  const visitedIds = route.filter(id => typeof introductions[id] === 'string' && Number.isFinite(Date.parse(introductions[id])));
  const remainingIds = route.filter(id => !visitedIds.includes(id));
  const completed = Boolean(state?.initialized && remainingIds.length === 0);
  return { id: ORIENTATION_ID, title: 'Meet your AMCOL team', required: true, missionCount: 1,
    completed, completedCount: visitedIds.length, total: route.length, visitedIds, remainingIds,
    nextNpcId: completed ? null : remainingIds[0] || route[0], route,
    completedAt: completed ? state.orientation?.completedAt || visitedIds.map(id => introductions[id]).sort().at(-1) : null };
}

export function getWorkshopAccess(state) {
  return { equipped: state?.profile?.outfit === WORKSHOP_OUTFIT, requiredOutfit: WORKSHOP_OUTFIT };
}

export function getLifeboatAccess(state) {
  return { equipped: state?.profile?.outfit === LIFEBOAT_OUTFIT, requiredOutfit: LIFEBOAT_OUTFIT };
}

function requireOrientation(state) {
  const orientation = getOrientationProgress(state);
  requireRule(orientation.completed, 'orientation_required',
    `Your first mission is to meet all ${NPCS.length} staff members. Acknowledge each introduction, then your learning games and dormitory sleep will unlock.`,
    409, { orientation });
}
function requireWorkshopOutfit(state) {
  const workshop = getWorkshopAccess(state);
  requireRule(workshop.equipped, 'workshop_required',
    'Change into the workshop one-piece suit before entering the Workshop or completing its mini-games.',
    409, { workshop });
}
function requireLifeboatOutfit(state) {
  const lifeboat = getLifeboatAccess(state);
  requireRule(lifeboat.equipped, 'immersion_required',
    'Change into the immersion suit before entering the Lifeboat area or completing its safety mini-games.',
    409, { lifeboat });
}

function startedSemester(state) {
  return Math.max(1, Number(state.semester) - (state.day < state.semesterStartDay ? 1 : 0));
}
function hasNPCCompletion(state, id) { return state.npcResults?.[id]?.completed === true; }

/** Readiness is calculated from the server record, never from a submitted approval flag. */
export function getSeaTrainingProgress(state, activities) {
  const academic = activities.filter(item => item.required !== false && activitySemester(item) >= 1 && activitySemester(item) <= 4);
  const hasEverySemester = [1, 2, 3, 4].every(semester => academic.some(item => activitySemester(item) === semester));
  const academicComplete = Boolean(state.initialized && startedSemester(state) >= 4 && hasEverySemester
    && academic.every(item => state.results?.[item.id]?.completed === true));
  const missingMissionIds = STAFF_SIGNOFF_IDS.filter(id => !hasNPCCompletion(state, id));
  const staffCompleted = STAFF_SIGNOFF_IDS.length - missingMissionIds.length;
  const record = state.seaTraining;
  const approved = academicComplete && missingMissionIds.length === 0 && hasNPCCompletion(state, SEA_TRAINING_REVIEW_ID)
    && record?.missionId === SEA_TRAINING_REVIEW_ID && record?.journeyId === state.journeyId
    && record?.reviewerId === 'dream' && typeof record?.approvedAt === 'string' && Number.isFinite(Date.parse(record.approvedAt));
  const status = approved ? 'approved' : !academicComplete ? 'locked'
    : missingMissionIds.length > 0 ? 'needs-signoffs' : 'ready-for-review';
  return {
    status, academicComplete, staffCompleted, staffRequired: STAFF_SIGNOFF_IDS.length,
    missingMissionIds, approvedAt: approved ? record.approvedAt : null,
    reviewer: 'Tr. Dream', reviewMissionId: SEA_TRAINING_REVIEW_ID,
  };
}

export function isNPCMissionAvailable(state, mission, activities) {
  if (!state?.initialized || !mission || !getOrientationProgress(state).completed) return false;
  // Passed challenges remain available as practice, including on older later-year accounts.
  if (hasNPCCompletion(state, mission.id)) return true;
  if (startedSemester(state) < mission.unlockSemester) return false;
  if (mission.prerequisite && !hasNPCCompletion(state, mission.prerequisite)) return false;
  if (mission.id === SEA_TRAINING_REVIEW_ID) {
    const readiness = getSeaTrainingProgress(state, activities);
    return readiness.status === 'ready-for-review' || readiness.status === 'approved';
  }
  return true;
}

export function getNPCProgress(state, activities) {
  const results = state.npcResults || {};
  return {
    results,
    available: NPC_MISSIONS.filter(mission => isNPCMissionAvailable(state, mission, activities)).map(mission => mission.id),
    completed: NPC_MISSIONS.filter(mission => hasNPCCompletion(state, mission.id)).length,
    total: NPC_MISSIONS.length,
    requiredForSeaTraining: [...STAFF_SIGNOFF_IDS],
    seaTraining: getSeaTrainingProgress(state, activities),
  };
}

/** The game day selects one optional safety game from all years actually started.
 * Keep earlier games in the rotation so a missed day cannot permanently hide one.
 * Advancing a semester without sleeping does not unlock the next year's games.
 */
export function getSafetyProgress(state = {}) {
  const eligibleYear = Math.min(4, Math.max(1, Math.ceil((state?.initialized ? startedSemester(state) : 1) / 2)));
  const unlockedIds = state?.initialized ? SAFETY_GAMES.filter(game => game.year <= eligibleYear).map(game => game.id) : [];
  const dayIndex = Math.max(0, Math.floor(Number(state?.day) || 1) - 1);
  const results = state?.safetyResults || {};
  return {
    todayId: unlockedIds.length ? unlockedIds[dayIndex % unlockedIds.length] : null,
    results, unlockedIds, eligibleYear, total: SAFETY_GAMES.length,
    completedCount: SAFETY_GAMES.filter(game => results[game.id]?.completed === true).length,
  };
}

/** A saved final set is immutable. Daily credit comes from first-completion days,
 * not client counters or wall-clock dates, so a real-week refresh cannot refill it.
 */
export function getLomaProgress(state = {}) {
  const final = state?.loma;
  const legacyGraduate = state?.lomaLegacyGraduate === true
    || Boolean(state?.graduated && state?.lomaRequirementVersion !== 1);
  const available = Boolean(state?.initialized && (startedSemester(state) >= 8 || legacyGraduate));
  const major = final?.major || state?.profile?.major || 'deck';
  const gameIds = Array.isArray(final?.gameIds) ? final.gameIds : [];
  const results = final?.results || {};
  const validIds = [...new Set(gameIds)].filter(id => {
    const game = getLomaGame(id); return game && (game.major === major || game.major === 'shared');
  });
  const started = Boolean(final);
  const recordValid = started && ['deck', 'engine'].includes(major)
    && gameIds.length === LOMA_FINAL_COUNT && validIds.length === LOMA_FINAL_COUNT;
  const completedIds = validIds.filter(id => results[id]?.completed === true);
  const completedToday = completedIds.filter(id => results[id].completionDay === state.day).length;
  const complete = recordValid && completedIds.length === LOMA_FINAL_COUNT;
  return {
    available, started, recordValid, major, majorLocked: started, legacyGraduate,
    gameIds: [...gameIds], results, completedCount: completedIds.length, total: LOMA_FINAL_COUNT,
    complete, required: !legacyGraduate, selectedAt: final?.selectedAt || null, completedAt: final?.completedAt || null,
    canResetDay: Boolean(legacyGraduate && started && !complete),
    today: { day: state?.day || 1, completed: completedToday, remaining: Math.max(0, LOMA_DAILY_LIMIT - completedToday), limit: LOMA_DAILY_LIMIT },
  };
}

function serverRandom() {
  requireRule(typeof globalThis.crypto?.getRandomValues === 'function', 'final_random_unavailable', 'The final could not be prepared. Please try again.', 503);
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
}

export function normalizeAnswer(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    // Formatting equivalences only: preserve every figure, unit and hemisphere.
    .replace(/\s*\/\s*/g, '/')
    .replace(/(\d)\s*(m|bar|rpm|lt|utc)\b/g, '$1$2')
    .replace(/(\d)\s*['′]\s*(?=\d|[nsew]\b)/g, '$1′')
    .replace(/\s*([°′″])\s*/g, '$1')
    .replace(/[.!?]+$/, '').trim();
}

function responsePresent(value) {
  return Array.isArray(value) ? value.length > 0 && value.every(item => typeof item === 'string' && item.trim().length > 0)
    : typeof value === 'string' && value.trim().length > 0;
}

/** Exact work is checked against the catalog. Open work is explicitly self-reviewed. */
export function evaluateActivity(activity, answers = {}, reviews = {}) {
  requireRule(activity && Array.isArray(activity.questions) && activity.questions.length > 0,
    'invalid_activity', 'This activity is not ready to submit.', 422);
  const items = activity.questions.map(question => {
    const supplied = answers[question.id];
    const present = responsePresent(supplied);
    const ordered = question.type === 'order' && Array.isArray(question.answer);
    const accepted = Array.isArray(question.answers) ? question.answers
      : typeof question.answer === 'string' ? [question.answer] : null;
    const exact = ordered || Boolean(accepted?.length);
    if (exact) {
      const correct = ordered
        ? Array.isArray(supplied) && supplied.length === question.answer.length
          && supplied.every((value, index) => normalizeAnswer(value) === normalizeAnswer(question.answer[index]))
        : present && !Array.isArray(supplied) && accepted.some(answer => normalizeAnswer(supplied) === normalizeAnswer(answer));
      return {
        questionId: question.id, status: correct ? 'correct' : present ? 'needs-review' : 'unanswered',
        passed: correct, exact: true,
        message: correct ? 'Correct.' : present ? 'Review the learning material and try again.' : 'Add your answer first.',
      };
    }
    const criteria = Array.isArray(question.criteria) ? question.criteria : [];
    const checked = Array.isArray(reviews[question.id]) ? new Set(reviews[question.id].filter(Number.isInteger)) : new Set();
    const reviewed = criteria.length > 0 && criteria.every((_, index) => checked.has(index));
    const passed = present && reviewed;
    return {
      questionId: question.id, status: passed ? 'self-reviewed' : present ? 'submitted' : 'unanswered',
      passed, exact: false, reviewed: passed,
      message: passed ? 'Response submitted and self-reviewed against the criteria.'
        : present ? 'Check your response against every review criterion.' : 'Add your response, then review the criteria.',
    };
  });
  const objective = items.filter(item => item.exact);
  return {
    activityId: activity.id,
    items, passed: items.every(item => item.passed),
    objectiveCorrect: objective.filter(item => item.passed).length,
    objectiveTotal: objective.length,
    selfReviewed: items.filter(item => item.status === 'self-reviewed').length,
    responseTotal: items.filter(item => !item.exact).length,
    outcome: items.every(item => item.exact) ? 'correct' : items.every(item => !item.exact) ? 'self-reviewed' : 'mixed',
  };
}

/** Staff practice and saved submissions use the same objective answer evaluator. */
export function evaluateNPCMission(mission, answers = {}) {
  requireRule(mission && Array.isArray(mission.questions), 'invalid_activity', 'This staff activity is not ready to submit.', 422);
  const numeric = value => {
    const text = String(value ?? '').normalize('NFKC').trim();
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(Number(text))
      ? String(Number(text)) : text;
  };
  const normalized = { ...answers };
  const questions = mission.questions.map(question => {
    if (question.type !== 'number') return question;
    if (typeof normalized[question.id] === 'string') normalized[question.id] = numeric(normalized[question.id]);
    return { ...question, answers: question.answers.map(numeric) };
  });
  const feedback = evaluateActivity({ ...mission, questions }, normalized);
  return { ...feedback, missionId: mission.id, npcId: mission.npcId,
    items: feedback.items.map(item => ({ ...item,
      explanation: mission.questions.find(question => question.id === item.questionId)?.explanation || '',
    })),
  };
}

/** Saved Lifeboat answers and unlimited completed-game practice share one evaluator. */
export function evaluateSafetyGame(game, answers = {}) {
  const feedback = evaluateNPCMission(game, answers);
  const { missionId, npcId, ...safeFeedback } = feedback;
  return { ...safeFeedback, safetyId: game.id };
}

export function evaluateLomaGame(game, answers = {}) {
  const feedback = evaluateNPCMission(game, answers);
  const { missionId, npcId, ...result } = feedback;
  return { ...result, gameId: game.id };
}

export function publicState(account, now, activities) {
  const state = normalizeNPCFields(clone(account.journey));
  const assignment = getAssignments(state, activities);
  return {
    ...state, ...assignment,
    year: Math.ceil(state.semester / 2), term: ((state.semester - 1) % 2) + 1,
    semesterProgress: getSemesterProgress(state, activities),
    npc: getNPCProgress(state, activities),
    safety: getSafetyProgress(state),
    loma: getLomaProgress(state),
    orientation: getOrientationProgress(state),
    workshop: getWorkshopAccess(state),
    lifeboat: getLifeboatAccess(state),
    week: getWeekStatus(account, now),
    totalCompleted: Object.values(state.results).filter(result => result.completed).length,
    rpg: getRPGSummary(state, activities, account.sleepReceipts),
  };
}

function expectCurrent(state, payload, checkDay = true) {
  requireRule(state.initialized, 'not_initialized', 'Create your cadet before starting the course.', 409);
  requireRule(payload.expectedJourneyId === state.journeyId, 'stale_journey', 'Your journey changed in another window. Refresh your missions.', 409);
  if (checkDay) requireRule(payload.expectedDay === state.day, 'stale_day', 'The day changed in another window. Refresh your missions.', 409);
}

function cleanResponses(activity, answers, reviews) {
  const safeAnswers = {}, safeReviews = {};
  requireRule(answers && typeof answers === 'object' && !Array.isArray(answers), 'invalid_answers', 'Answers must be identified by question.');
  for (const question of activity.questions) {
    const value = answers[question.id];
    if (Array.isArray(value)) {
      requireRule(value.length <= 100 && value.every(item => typeof item === 'string' && item.length <= 2000), 'answer_too_long', 'This answer is too long.');
      safeAnswers[question.id] = value;
    } else if (typeof value === 'string') {
      requireRule(value.length <= 8000, 'answer_too_long', 'Keep each response under 8,000 characters.');
      safeAnswers[question.id] = value;
    } else if (value != null) throw new AcademyError('invalid_answer', 'Use text or an ordered list for each answer.');
    if (Array.isArray(reviews?.[question.id])) safeReviews[question.id] = [...new Set(reviews[question.id].filter(item => Number.isInteger(item) && item >= 0 && item < 100))];
  }
  return { answers: safeAnswers, reviews: safeReviews };
}

/** Return a complete candidate document; the repository commits it with CAS. */
export function applyAction(previous, payload, now, activities, options = {}) {
  requireRule(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid_request', 'A valid action is required.');
  const account = clone(previous);
  const state = normalizeNPCFields(account.journey);
  prepareRPGJourney(state, activities, account.sleepReceipts);
  const action = payload.action;
  let feedback = null, duplicate = false, reward = null;

  if (action === 'init') {
    if (!state.initialized) {
      state.profile = cleanProfile(payload.profile); state.initialized = true;
    }
  } else if (action === 'profile') {
    expectCurrent(state, payload, false);
    const profile = cleanProfile(payload.profile);
    if (!Object.prototype.hasOwnProperty.call(payload.profile, 'major')) profile.major = state.profile?.major || 'deck';
    const final = getLomaProgress(state);
    requireRule(!final.majorLocked || profile.major === final.major, 'major_locked',
      `Your ${String(final.major).toUpperCase()} major is locked to your saved Loma final. Keep that major when saving your character.`, 409, { major: final.major });
    state.profile = profile;
  } else if (action === 'rpgProfile') {
    expectCurrent(state, payload);
    updateRPGProfile(state, payload, now, requireRule);
  } else if (action === 'rpgCare') {
    expectCurrent(state, payload);
    reward = applyRPGCare(state, payload, now, activities, requireRule);
    if (!reward) return { account: previous, feedback: null, reward: null, duplicate: true, changed: false };
  } else if (action === 'introduceNPC') {
    expectCurrent(state, payload);
    requireRule(typeof payload.npcId === 'string' && getNPC(payload.npcId),
      'npc_missing', 'This staff member could not be found.', 404);
    if (state.orientation.introductions[payload.npcId]) {
      return { account: previous, feedback: null, duplicate: true, changed: false };
    }
    state.orientation.introductions[payload.npcId] = iso(now);
    if (getOrientationProgress(state).completed) state.orientation.completedAt = iso(now);
    reward = awardRPGReward(state, 'intro', payload.npcId, getNPC(payload.npcId), now, activities);
  } else if (action === 'newJourney') {
    expectCurrent(state, payload);
    requireRule(payload.confirm === true, 'confirmation_required', 'Confirm starting a new book journey.');
    if (state.graduated) account.completedJourneys = [
      ...account.completedJourneys.slice(-9),
      { journeyId: state.journeyId, graduatedAt: state.graduatedAt, profile: state.profile },
    ];
    account.journey = createJourney(now, options.journeyId, cleanProfile(payload.profile || state.profile));
    // Deliberately preserve allowance and receipt history across characters.
  } else if (action === 'sleep') {
    requireRule(typeof payload.requestId === 'string' && /^[a-zA-Z0-9._-]{8,100}$/.test(payload.requestId), 'invalid_request_id', 'Sleep needs a unique request id.');
    const receipt = account.sleepReceipts.find(item => item.requestId === payload.requestId);
    if (receipt) {
      requireRule(receipt.journeyId === payload.expectedJourneyId && receipt.day === payload.expectedDay,
        'request_id_reused', 'That sleep request was already used for another day.', 409);
      duplicate = true;
      return { account: previous, feedback: null, duplicate, changed: false };
    }
    expectCurrent(state, payload);
    requireRule(!state.graduated || getLomaProgress(state).canResetDay, 'already_graduated', 'Your book journey is complete. Continue practising or start a new journey.', 409);
    requireOrientation(state);
    const week = getWeekStatus(account, now);
    requireRule(week.remaining > 0, 'weekly_limit', 'All five day resets for this week are used. Sleep unlocks again on Monday at 00:00 Bangkok time.', 409, { week });
    requireRule(state.fitness?.day === state.day && FITNESS_KINDS.has(state.fitness.kind),
      'fitness_required', 'Complete PT, a run, or football at the dorm before sleeping.', 409);
    account.allowance = { weekKey: week.key, used: week.used + 1 };
    const fromDay = state.day;
    state.day += 1; state.fitness = null;
    restoreRPGAfterSleep(state);
    account.sleepReceipts = [...account.sleepReceipts.slice(-63), {
      requestId: payload.requestId, journeyId: state.journeyId,
      day: fromDay, resultDay: state.day, weekKey: week.key, createdAt: iso(now),
    }];
  } else if (action === 'fitness') {
    expectCurrent(state, payload);
    requireRule(!state.graduated || getLomaProgress(state).canResetDay, 'already_graduated', 'Your book journey is complete. Fitness is now optional.', 409);
    requireRule(FITNESS_KINDS.has(payload.kind), 'invalid_fitness', 'Choose PT, a run, or football.');
    requireRule(payload.proof && payload.proof.completed === true, 'fitness_incomplete', 'Finish the fitness mini-game first.');
    const score = Number(payload.proof.score);
    const target = FITNESS_TARGETS[payload.kind];
    requireRule(Number.isFinite(score) && score >= 1 && score <= 100
      && payload.proof.completedCount === target && payload.proof.total === target,
      'fitness_incomplete', 'Finish every repetition, checkpoint, or goal in the fitness mini-game first.');
    state.fitness = { kind: payload.kind, day: state.day, completedAt: iso(now), score,
      completedCount: target, total: target, evidence: 'game-reported' };
    reward = awardRPGReward(state, 'fitness', String(state.day), null, now, activities);
  } else if (action === 'npcComplete') {
    expectCurrent(state, payload);
    requireOrientation(state);
    const mission = getNPCMission(payload.missionId);
    requireRule(mission, 'npc_mission_missing', 'This staff mission could not be found.', 404);
    if (getNPC(mission.npcId)?.location === 'workshop') requireWorkshopOutfit(state);
    const readiness = getSeaTrainingProgress(state, activities);
    requireRule(isNPCMissionAvailable(state, mission, activities), 'npc_mission_locked',
      mission.id === SEA_TRAINING_REVIEW_ID
        ? 'Finish all Years 1–2 book activities and collect every staff sign-off before Tr. Dream’s review.'
        : mission.prerequisite && !hasNPCCompletion(state, mission.prerequisite)
          ? 'Complete this staff member’s first mission before the Year 2 follow-up.'
          : 'This follow-up opens when Year 2 starts after a dormitory sleep.',
      409, { missionId: mission.id, seaTraining: readiness });
    const cleaned = cleanResponses(mission, payload.answers || {}, {});
    feedback = evaluateNPCMission(mission, cleaned.answers);
    const prior = state.npcResults[mission.id];
    const priorCompleted = hasNPCCompletion(state, mission.id);
    const completed = priorCompleted || feedback.passed;
    state.npcResults[mission.id] = {
      missionId: mission.id, npcId: mission.npcId, completed,
      status: completed ? 'complete' : 'in-progress', attempts: (prior?.attempts || 0) + 1,
      completedAt: prior?.completedAt || (feedback.passed ? iso(now) : null),
      lastAttemptAt: iso(now),
      outcome: completed ? 'correct' : 'in-progress',
      answers: priorCompleted ? prior.answers : cleaned.answers,
      objectiveCorrect: priorCompleted ? prior.objectiveCorrect : feedback.objectiveCorrect,
      objectiveTotal: feedback.objectiveTotal,
    };
    if (mission.id === SEA_TRAINING_REVIEW_ID && feedback.passed && readiness.status !== 'approved') {
      state.seaTraining = { missionId: mission.id, reviewerId: 'dream', reviewer: 'Tr. Dream',
        journeyId: state.journeyId, approvedAt: iso(now) };
    }
    if (!priorCompleted && feedback.passed) reward = awardRPGReward(state, 'staff', mission.id, mission, now, activities);
  } else if (action === 'completeSafety') {
    expectCurrent(state, payload);
    requireOrientation(state);
    requireLifeboatOutfit(state);
    const game = getSafetyGame(payload.safetyId);
    requireRule(game, 'safety_game_missing', 'This Lifeboat safety game could not be found.', 404);
    const safety = getSafetyProgress(state);
    requireRule(safety.todayId === game.id, 'safety_game_locked',
      'This is not today’s Lifeboat game. Complete the current challenge, or practise a saved game. The rotation changes after a dormitory sleep.',
      409, { todayId: safety.todayId, eligibleYear: safety.eligibleYear });
    const cleaned = cleanResponses(game, payload.answers || {}, {});
    const prior = state.safetyResults[game.id];
    // First completions are permanent. A duplicate request cannot add XP,
    // downgrade a score, or replace the successful answers with practice work.
    if (prior?.completed === true) {
      return { account: previous, feedback: evaluateSafetyGame(game, prior.answers), duplicate: true, changed: false };
    }
    feedback = evaluateSafetyGame(game, cleaned.answers);
    // Retrying the same uncertain failed submission is also idempotent.
    if (prior && JSON.stringify(prior.answers) === JSON.stringify(cleaned.answers)) {
      return { account: previous, feedback, duplicate: true, changed: false };
    }
    state.safetyResults[game.id] = {
      safetyId: game.id, year: game.year, location: 'lifeboat', completed: feedback.passed,
      status: feedback.passed ? 'complete' : 'in-progress', outcome: feedback.passed ? 'correct' : 'in-progress',
      attempts: (prior?.attempts || 0) + 1, answers: cleaned.answers,
      firstAssignedDay: prior?.firstAssignedDay || state.day,
      completedAt: feedback.passed ? iso(now) : null, lastAttemptAt: iso(now),
      objectiveCorrect: feedback.objectiveCorrect, objectiveTotal: feedback.objectiveTotal,
    };
    if (feedback.passed) reward = awardRPGReward(state, 'safety', game.id, game, now, activities);
  } else if (action === 'startLoma') {
    expectCurrent(state, payload);
    requireOrientation(state);
    const final = getLomaProgress(state);
    requireRule(final.available, 'loma_locked', 'The Loma final opens after sleeping to begin Year 4, Semester 2.', 409);
    if (final.started) {
      requireRule(final.recordValid, 'loma_record_invalid', 'Your saved final needs attention. It has not been replaced or rerolled.', 503);
      return { account: previous, feedback: null, duplicate: true, changed: false };
    }
    requireRule(payload.expectedMajor === state.profile.major, 'stale_major',
      'Your saved major changed in another window. Review it again before beginning the final.', 409, { major: state.profile.major });
    const major = state.profile.major;
    const gameIds = drawLomaSet(major, typeof options.random === 'function' ? options.random : serverRandom);
    state.loma = { version: 1, major, gameIds, results: {}, selectedAt: iso(now), selectedDay: state.day, completedAt: null };
  } else if (action === 'completeLoma') {
    expectCurrent(state, payload);
    requireOrientation(state);
    const final = getLomaProgress(state);
    requireRule(final.available, 'loma_locked', 'The Loma final opens after sleeping to begin Year 4, Semester 2.', 409);
    requireRule(final.started && final.recordValid, 'loma_not_started', 'Begin your final at Loma Lounge to save your fifty-game set.', 409);
    const game = getLomaGame(payload.gameId);
    requireRule(game && final.gameIds.includes(game.id), 'loma_game_unassigned', 'This mini-game is not part of your saved Loma final.', 409);
    const cleaned = cleanResponses(game, payload.answers || {}, {});
    const prior = state.loma.results[game.id];
    if (prior?.completed === true) {
      return { account: previous, feedback: evaluateLomaGame(game, prior.answers), duplicate: true, changed: false };
    }
    feedback = evaluateLomaGame(game, cleaned.answers);
    if (prior && JSON.stringify(prior.answers) === JSON.stringify(cleaned.answers)) {
      return { account: previous, feedback, duplicate: true, changed: false };
    }
    requireRule(!feedback.passed || final.today.remaining > 0, 'loma_daily_limit',
      'You have completed five final mini-games this game day. Finish your dormitory exercise and sleep before earning another final completion.',
      409, { today: final.today });
    state.loma.results[game.id] = {
      gameId: game.id, completed: feedback.passed, status: feedback.passed ? 'complete' : 'in-progress',
      outcome: feedback.passed ? 'correct' : 'in-progress', attempts: (prior?.attempts || 0) + 1,
      answers: cleaned.answers, objectiveCorrect: feedback.objectiveCorrect, objectiveTotal: feedback.objectiveTotal,
      firstAttemptDay: prior?.firstAttemptDay || state.day, completionDay: feedback.passed ? state.day : null,
      completedAt: feedback.passed ? iso(now) : null, lastAttemptAt: iso(now),
    };
    if (getLomaProgress(state).complete) state.loma.completedAt = state.loma.completedAt || iso(now);
    if (feedback.passed) reward = awardRPGReward(state, 'loma', game.id, game, now, activities);
  } else if (action === 'complete') {
    expectCurrent(state, payload);
    requireOrientation(state);
    const activity = activities.find(item => item.id === payload.activityId);
    requireRule(activity, 'activity_missing', 'This activity could not be found.', 404);
    if (activity.location === 'workshop') requireWorkshopOutfit(state);
    const assigned = getAssignments(state, activities).unlocked.includes(activity.id);
    const prior = state.results[activity.id];
    requireRule(assigned || prior?.completed, 'activity_locked', 'This mini-game is not assigned yet. Finish a dorm routine and sleep to unlock the next day.', 409);
    const cleaned = cleanResponses(activity, payload.answers || {}, payload.reviews || {});
    feedback = evaluateActivity(activity, cleaned.answers, cleaned.reviews);
    const completed = Boolean(prior?.completed || feedback.passed);
    state.results[activity.id] = {
      activityId: activity.id, semester: activitySemester(activity), location: activity.location,
      completed, status: completed ? 'complete' : 'in-progress',
      attempts: (prior?.attempts || 0) + 1,
      firstAssignedDay: prior?.firstAssignedDay || state.day,
      completedAt: prior?.completedAt || (feedback.passed ? iso(now) : null),
      lastAttemptAt: iso(now),
      outcome: prior?.completed ? prior.outcome : feedback.passed ? feedback.outcome : 'in-progress',
      // Preserve a completed submission when later practice contains mistakes.
      answers: prior?.completed ? prior.answers : cleaned.answers,
      reviews: prior?.completed ? prior.reviews : cleaned.reviews,
      objectiveCorrect: prior?.completed ? prior.objectiveCorrect : feedback.objectiveCorrect,
      objectiveTotal: feedback.objectiveTotal,
      selfReviewed: prior?.completed ? prior.selfReviewed : feedback.selfReviewed,
      responseTotal: feedback.responseTotal,
    };
    if (!prior?.completed && feedback.passed) reward = awardRPGReward(state, 'book', activity.id, activity, now, activities);
  } else if (action === 'advance') {
    expectCurrent(state, payload);
    requireRule(!state.graduated, 'already_graduated', 'You already completed this journey.', 409);
    requireOrientation(state);
    requireRule(payload.expectedSemester === state.semester, 'stale_semester', 'Your semester changed. Refresh the Academic Office.', 409);
    const progress = getSemesterProgress(state, activities);
    requireRule(progress.bookReady, 'semester_incomplete', 'Finish every required mini-game in this semester before advancing.', 409, { progress });
    requireRule(!progress.seaTrainingBlocked, 'sea_training_clearance_required',
      'Visit Tr. Dream and pass the Year 2 sea-training readiness review before advancing to Year 3.',
      409, { progress, seaTraining: getSeaTrainingProgress(state, activities) });
    requireRule(!progress.lomaBlocked, 'loma_incomplete',
      'Complete all fifty mini-games in your saved Loma Lounge final before graduating.',
      409, { progress, loma: getLomaProgress(state) });
    if (state.semester === COURSE_SEMESTERS) {
      state.graduated = true; state.graduatedAt = iso(now);
    } else {
      state.semester += 1;
      // Entering a semester cannot bypass the weekly sleep limit.
      state.semesterStartDay = state.day + 1;
    }
  } else {
    throw new AcademyError('unknown_action', 'That academy action is not supported.');
  }
  account.journey.updatedAt = iso(now);
  return { account, feedback, reward, duplicate, changed: true };
}
