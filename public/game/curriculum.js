/**
 * Curriculum metadata shared by the rules, the interface and the content audit:
 * which subject a mini-game teaches, which major it belongs to, how hard it is,
 * and which named NPC hosts it at its campus location.
 */
export const DIFFICULTY_BY_YEAR = Object.freeze({
  1: 'Beginner', 2: 'Applied beginner', 3: 'Intermediate', 4: 'Advanced',
});

/** Book units that lean to one major. Every unit is still part of the shared book course. */
const DECK_UNITS = new Set([3, 4, 7, 8]);
const ENGINE_UNITS = new Set([9]);

const SUBJECT_BY_TYPE = Object.freeze({
  math: 'Mathematics', science: 'Science', colreg: 'Navigation · COLREG', safety: 'Safety',
  listen: 'English · Listening', reading: 'English · Reading', trivia: 'English · Reading',
  grammar: 'English · Grammar', fill: 'English · Grammar', order: 'English · Sentence building',
  match: 'English · Vocabulary', quiz: 'English · Vocabulary & usage',
});

export function activitySubject(activity) {
  return SUBJECT_BY_TYPE[activity?.type] || 'English';
}

/** 'deck', 'engine' or 'common' (common core shared by both majors). */
export function activityMajor(activity) {
  if (activity?.major) return activity.major;
  if (activity?.type === 'colreg') return 'common';
  if (DECK_UNITS.has(activity?.unit)) return 'deck';
  if (ENGINE_UNITS.has(activity?.unit)) return 'engine';
  return 'common';
}

export function activityDifficulty(activity) {
  return DIFFICULTY_BY_YEAR[activity?.year] || DIFFICULTY_BY_YEAR[Math.ceil((activity?.semester || 1) / 2)] || 'Beginner';
}

const HOST_BY_ROOM = Object.freeze({ bridge: 'jakk', engine: 'asawin', ecdis: 'duke', gmdss: 'bank', captain: 'chalermvut' });
const HOST_BY_LOCATION = Object.freeze({
  academic: 'kobchapan', garden: 'thanaphat', cafe: 'thanaphat', entrance: 'thanaphat',
  imd: 'jakk', cruise: 'dream', workshop: 'amara', dome: 'wayne', pacific: 'wayne',
});

/**
 * The named NPC who hosts a book mini-game where it is played. Subject teachers host their
 * subject in Pacific and at the Dome (where they stand); elsewhere the person at that place does.
 */
export function activityHost(activity) {
  if (!activity) return null;
  if (activity.host) return activity.host;
  if (activity.room === 'engine' && activity.type === 'science') return 'gerald';
  if (activity.room && HOST_BY_ROOM[activity.room]) return HOST_BY_ROOM[activity.room];
  const teaching = ['pacific', 'dome'].includes(activity.location);
  if (activity.type === 'math' && teaching) return 'aphisit';
  if (activity.type === 'science' && teaching) return 'anne';
  if (activity.type === 'colreg' && !HOST_BY_LOCATION[activity.location]) return 'jakk';
  return HOST_BY_LOCATION[activity.location] || 'wayne';
}

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Which equivalent question set a cadet plays: -1 is the main set, otherwise an index into
 * `activity.variants`. It depends only on the journey, activity and major, so the game shows
 * the same set the rules will grade, and the rules save it with the first attempt.
 */
export function plannedVariant(activity, journeyId, major = 'deck') {
  const sets = Array.isArray(activity?.variants) ? activity.variants : [];
  const fitting = sets.map((set, index) => ({ set, index }))
    .filter(({ set }) => !set.major || set.major === 'common' || set.major === major).map(item => item.index);
  const choices = [-1, ...fitting];
  return choices[hash(`${journeyId}:${activity?.id}`) % choices.length];
}
