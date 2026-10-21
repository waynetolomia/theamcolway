/**
 * THE AMCOL WAY balance configuration. Every limit the rules, interface and Cadet Handbook
 * use is read from here, so changing a value here changes the game and its explanations.
 * These are starting values to validate through pacing tests (scripts/pacing-report.mjs).
 */
export const BALANCE = Object.freeze({
  week: Object.freeze({
    studyDays: 5,                // rewarded study days per real week (Day 1 is included)
    timezone: 'Asia/Bangkok',    // weekly allowance resets Monday 00:00 in this timezone
    timezoneLabel: 'Bangkok time (UTC+7)',
    resetLabel: 'Monday 00:00',
  }),
  missions: Object.freeze({
    perDay: 4,                   // graded mission slots per study day (one mini-game = one slot)
    perWeek: 20,                 // graded mission slots per real week
    staffSuggestedPerDay: 1,     // the daily plan suggests at most this many staff missions
  }),
  fitness: Object.freeze({
    requiredBeforeSleep: 1,      // PT, running or football before sleeping
    energyCost: 10,
  }),
  energy: Object.freeze({
    max: 100,
    missionEntry: 15,            // charged once when a graded mission attempt first starts
    meal: 25,                    // basic meal (always free) at Loma Café, Palm Garden or the dormitory
    rest: 20,                    // short rest break
    sleep: 'max',                // sleeping restores energy to maximum
  }),
  loma: Object.freeze({
    finalCount: 50,              // saved, fixed set of final mini-games
    // The final uses the normal daily and weekly mission slots.
  }),
  xp: Object.freeze({
    // Character level n → n+1 costs levelBase + levelGrowth × (n − 1) XP.
    // Tuned with docs/PACING.md so the top rank (level 18) arrives at graduation, not in Year 3.
    levelBase: 100,
    levelGrowth: 35,
    skillLevel: 30,              // skill XP per skill level
    // First completion of a graded book mini-game, by academic year.
    bookByYear: Object.freeze({ 1: 10, 2: 12, 3: 14, 4: 16 }),
    staff: 10, safety: 10, loma: 10, fitness: 10, intro: 2, care: 2,
    secondarySkill: 4,           // XP to a game's second taught skill
  }),
});

/** Character rank titles unlocked by level (shown on the dashboard and HUD). */
export const RANKS = Object.freeze([
  Object.freeze({ level: 1, title: 'New Cadet' }),
  Object.freeze({ level: 3, title: 'Cadet' }),
  Object.freeze({ level: 6, title: 'Senior Cadet' }),
  Object.freeze({ level: 10, title: 'Cadet Leader' }),
  Object.freeze({ level: 14, title: 'Cadet Officer' }),
  Object.freeze({ level: 18, title: 'Cadet Captain' }),
]);

/** Total XP needed to reach a character level under the configured curve. */
export function xpForLevel(level) {
  const { levelBase, levelGrowth } = BALANCE.xp;
  let total = 0;
  for (let n = 1; n < level; n++) total += levelBase + levelGrowth * (n - 1);
  return total;
}

export function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level), next = xpForLevel(level + 1);
  return { level, xpIntoLevel: xp - start, xpForNextLevel: next - start,
    progressPercent: Math.round((xp - start) / (next - start) * 100) };
}

export function rankForLevel(level) {
  return [...RANKS].reverse().find(rank => level >= rank.level) || RANKS[0];
}
