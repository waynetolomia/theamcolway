/** THE AMCOL WAY achievement and save state. This module has no browser dependencies. */
import { CAMPUS } from './campus.js';

export const STORAGE_KEY = 'seapath.save.v1';

export const DEFAULT_CHARACTER = Object.freeze({
  name: 'Alex',
  origin: 'Thailand',
  trait: 'Curious',
  skin: '#b97850',
  hairColor: '#292327',
  hairStyle: 'swept',
  gender: 'male',
  major: 'deck',
  uniformBottom: 'pants',
  outfit: 'cadet',
  accent: '#198879',
  body: 'regular',
  accessory: 'none',
});

const CHARACTER_OPTIONS = {
  trait: ['Curious', 'Steady', 'Sociable'],
  hairStyle: ['crop', 'swept', 'bob', 'bun'],
  gender: ['male', 'female'],
  major: ['deck', 'engine'],
  uniformBottom: ['pants', 'skirt'],
  outfit: ['cadet', 'coverall', 'immersion', 'maritime', 'maritime-white'],
  body: ['slim', 'regular', 'broad'],
  accessory: ['none', 'glasses', 'cap'],
};
const YEAR_NUMBERS = [1, 2, 3, 4];
const ACTIVITIES_PER_YEAR = 8;
const MAX_DAY = 999999;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value, fallback, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const bounded = Math.min(max, Math.max(min, value));
  return integer ? Math.floor(bounded) : bounded;
}

function shortText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned ? Array.from(cleaned).slice(0, maxLength).join('') : fallback;
}

export function normalizeCharacter(value = {}) {
  const source = isRecord(value) ? value : {};
  const result = { ...DEFAULT_CHARACTER };
  result.name = shortText(source.name, result.name, 28);
  result.origin = shortText(source.origin, result.origin, 50);
  for (const [key, choices] of Object.entries(CHARACTER_OPTIONS)) {
    if (choices.includes(source[key])) result[key] = source[key];
  }
  for (const key of ['skin', 'hairColor', 'accent']) {
    if (typeof source[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(source[key])) {
      result[key] = source[key].toLowerCase();
    }
  }
  // Campus and professional uniforms have a fixed cut for each character gender.
  // Legacy polos, display-only casual clothes and unknown outfits resolve to cadet.
  result.uniformBottom = result.gender === 'female' ? 'skirt' : 'pants';
  return result;
}

/** Automatic dorm clothes are a view of the profile, never a saved outfit change. */
export function displayCharacter(value = {}, zone = 'campus') {
  const profile = normalizeCharacter(value);
  return zone === 'dorm' ? { ...profile, outfit: 'casual' } : profile;
}

function emptyYear() {
  return {
    mentor: false,
    studied: false,
    vocabSets: [false, false],
    smcp: [],
    bestAccuracy: 0,
  };
}

function normalizePhraseId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id || id.length > 60 || /[\u0000-\u001f\u007f]/.test(id)) return null;
  return id;
}

function normalizeYear(value) {
  if (!isRecord(value)) return emptyYear();
  const result = emptyYear();
  result.mentor = value.mentor === true;
  result.studied = value.studied === true;
  if (Array.isArray(value.vocabSets)) {
    result.vocabSets = [value.vocabSets[0] === true, value.vocabSets[1] === true];
  }
  if (Array.isArray(value.smcp)) {
    for (const candidate of value.smcp) {
      const id = normalizePhraseId(candidate);
      if (id && !result.smcp.includes(id)) result.smcp.push(id);
      if (result.smcp.length === 4) break;
    }
  }
  result.bestAccuracy = finiteNumber(value.bestAccuracy, 0, 0, 100);
  return result;
}

function yearXp(year) {
  return (year.mentor ? 30 : 0)
    + (year.studied ? 30 : 0)
    + year.vocabSets.filter(Boolean).length * 60
    + year.smcp.length * 30;
}

function syncXp(state) {
  state.xp = YEAR_NUMBERS.reduce((sum, year) => sum + yearXp(state.years[year]), 0);
  return state.xp;
}

function yearComplete(year) {
  return year.mentor && year.studied && year.vocabSets.every(Boolean) && year.smcp.length === 4;
}

function activeYear(state) {
  if (!isRecord(state) || !YEAR_NUMBERS.includes(state.year) || !isRecord(state.years)) return null;
  const year = state.years[state.year];
  return isRecord(year) && Array.isArray(year.vocabSets) && Array.isArray(year.smcp) ? year : null;
}

function outcome(success, awarded = 0, first = false, extra = {}) {
  return { success, awarded, first, ...extra };
}

export function createState(character = DEFAULT_CHARACTER) {
  return {
    version: 1,
    campusId: CAMPUS.id,
    character: normalizeCharacter(character),
    year: 1,
    xp: 0,
    energy: 100,
    day: 1,
    minutes: 480,
    graduated: false,
    position: { ...CAMPUS.spawn },
    years: Object.fromEntries(YEAR_NUMBERS.map(year => [year, emptyYear()])),
  };
}

/**
 * Accept a parsed save and return a fresh, bounded state, or null for a bad schema.
 * Achievement records are authoritative; a stored XP or graduation claim cannot
 * award progress. Missing later-year records are restored as empty records.
 * Older campus saves retain their achievements and begin at the current entrance.
 */
export function normalizeState(value) {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.character)
    || !isRecord(value.years) || !isRecord(value.years[1])) return null;

  const state = createState(value.character);
  for (const year of YEAR_NUMBERS) state.years[year] = normalizeYear(value.years[year]);
  const firstIncomplete = YEAR_NUMBERS.find(year => !yearComplete(state.years[year]));
  const highestUnlockedYear = firstIncomplete ?? 4;
  state.year = Math.min(finiteNumber(value.year, 1, 1, 4, true), highestUnlockedYear);
  state.graduated = value.graduated === true && firstIncomplete === undefined;
  if (state.graduated) state.year = 4;
  state.energy = finiteNumber(value.energy, 100, 0, 100, true);
  state.day = finiteNumber(value.day, 1, 1, MAX_DAY, true);
  state.minutes = finiteNumber(value.minutes, 480, 0, 1439, true);
  if (value.campusId === CAMPUS.id && isRecord(value.position)) {
    state.position = {
      x: finiteNumber(value.position.x, CAMPUS.spawn.x, CAMPUS.bounds.minX, CAMPUS.bounds.maxX),
      z: finiteNumber(value.position.z, CAMPUS.spawn.z, CAMPUS.bounds.minZ, CAMPUS.bounds.maxZ),
    };
  }
  syncXp(state);
  return state;
}

export function getYearProgress(state, year = state.year) {
  const record = state.years[year];
  const progress = normalizeYear(record);
  const completed = Number(progress.mentor) + Number(progress.studied)
    + progress.vocabSets.filter(Boolean).length + progress.smcp.length;
  return {
    ...progress,
    completed,
    total: ACTIVITIES_PER_YEAR,
    percent: Math.round(completed / ACTIVITIES_PER_YEAR * 100),
  };
}

function completeFlag(state, key) {
  const year = activeYear(state);
  if (!year) return outcome(false);
  if (year[key]) return outcome(true);
  if (state.graduated) return outcome(false);
  year[key] = true;
  syncXp(state);
  return outcome(true, 30, true);
}

export function completeMentor(state) {
  return completeFlag(state, 'mentor');
}

export function completeStudy(state) {
  return completeFlag(state, 'studied');
}

export function completeVocab(state, setIndex, accuracy) {
  const year = activeYear(state);
  if (!year || !Number.isInteger(setIndex) || setIndex < 0 || setIndex > 1
    || typeof accuracy !== 'number' || !Number.isFinite(accuracy)
    || accuracy < 0 || accuracy > 100) return outcome(false);

  year.bestAccuracy = Math.max(year.bestAccuracy, accuracy);
  if (accuracy < 75) return outcome(false, 0, false, { accuracy, passed: false });
  if (year.vocabSets[setIndex]) return outcome(true, 0, false, { accuracy, passed: true });
  if (state.graduated) return outcome(false, 0, false, { accuracy, passed: true });
  year.vocabSets[setIndex] = true;
  syncXp(state);
  return outcome(true, 60, true, { accuracy, passed: true });
}

export function completeSMCP(state, phraseId) {
  const year = activeYear(state);
  const id = normalizePhraseId(phraseId);
  if (!year || !id) return outcome(false);
  if (year.smcp.includes(id)) return outcome(true);
  if (state.graduated || year.smcp.length >= 4) return outcome(false);
  year.smcp.push(id);
  syncXp(state);
  return outcome(true, 30, true);
}

export function canAdvance(state) {
  const year = activeYear(state);
  return Boolean(year && !state.graduated && yearComplete(year));
}

/** Completes a simulated academic year. Graduation confers no real credential. */
export function advanceYear(state) {
  if (!canAdvance(state)) return outcome(false, 0, false, { graduated: Boolean(state.graduated), year: state.year });
  if (state.year === 4) {
    state.graduated = true;
  } else {
    state.year += 1;
  }
  syncXp(state);
  return outcome(true, 0, true, { graduated: state.graduated, year: state.year });
}

/** Rest begins the next simulated day at 08:00. */
export function rest(state) {
  state.energy = 100;
  state.day = Math.min(MAX_DAY, state.day + 1);
  state.minutes = 480;
  return outcome(true, 0, false, { energy: state.energy, day: state.day, minutes: state.minutes });
}

/** Each activity advances 30 simulated minutes; zero energy does not lock play. */
export function spendEnergy(state, amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return outcome(false);
  state.energy = Math.max(0, state.energy - amount);
  const totalMinutes = state.minutes + 30;
  state.day = Math.min(MAX_DAY, state.day + Math.floor(totalMinutes / 1440));
  state.minutes = totalMinutes % 1440;
  return outcome(true, 0, false, { energy: state.energy, day: state.day, minutes: state.minutes });
}

export function getLevel(state) {
  return 1 + Math.floor(finiteNumber(state.xp, 0, 0, 1200) / 150);
}
