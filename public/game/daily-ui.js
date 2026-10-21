/**
 * Today's plan, study-day status, mission gates and the Cadet Handbook.
 * Every number shown here is read from game-config.js, so the explanations follow the rules.
 */
import { BALANCE, RANKS, rankForLevel } from './game-config.js';
import { getNPC, getNPCMission, NPCS } from './npc-content.js';
import { getLomaGame } from './loma-content.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const { week: W, missions: M, energy: E, fitness: F, loma: L, xp: X } = BALANCE;
const RESET = `${W.resetLabel}, ${W.timezoneLabel}`;
const resetDate = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return W.resetLabel;
  return new Intl.DateTimeFormat('en-GB', { timeZone: W.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
};

/** Why a new graded mission cannot start right now, or null when it can. */
export function missionGate(s) {
  const t = s?.today;
  if (!t || t.canStartMission) return null;
  if (t.rest) return { code: 'weekly_rest', title: 'Weekly rest', message: `All ${t.studyDays} study days are used this week. Explore, chat and practise freely; new graded missions open ${resetDate(t.resetsAt)} (${W.timezoneLabel}).` };
  if (t.weekMissionsUsed >= t.weekMissionsLimit) return { code: 'weekly_mission_limit', title: 'Weekly missions complete', message: `You have played all ${t.weekMissionsLimit} graded missions this week. New missions open ${resetDate(t.resetsAt)}.` };
  if (t.slotsLeft <= 0) return { code: 'daily_limit', title: 'Today’s missions are used', message: `All ${t.slotsLimit} mission slots for today are used. Exercise at the dormitory and sleep to start the next study day. Unfinished work stays on your plan.` };
  if (t.energy < t.entryCost) return { code: 'low_energy', title: 'Low energy', message: `A new graded mission needs ${t.entryCost} energy and you have ${t.energy}. Have a free meal (+${E.meal}) at Loma Café, Palm Garden or the dormitory, or take a rest (+${E.rest}).` };
  return null;
}

/** The study-day card: day of the week, mission slots, weekly missions, energy and PT. */
export function todayMarkup(s, icon) {
  const t = s?.today;
  if (!t) return '';
  const gate = missionGate(s);
  const notice = gate ? `<p class="today-notice" data-today-gate="${esc(gate.code)}"><strong>${esc(gate.title)}.</strong> ${esc(gate.message)}</p>` : '';
  return `<section class="today-card${t.rest ? ' rest' : ''}" data-today>
    <div class="today-head"><span>${icon('sun')}</span><div><strong>${t.rest ? 'Weekly rest' : `Study day ${t.studyDay} of ${t.studyDays}`}</strong><small>Week resets ${esc(resetDate(t.resetsAt))} · ${esc(t.timezone)}</small></div></div>
    <div class="today-meters">
      <div><small>Missions today</small><strong>${t.slotsUsed} / ${t.slotsLimit}</strong></div>
      <div><small>This week</small><strong>${t.weekMissionsUsed} / ${t.weekMissionsLimit}</strong></div>
      <div><small>Energy</small><strong>${t.energy}</strong><span>${t.entryCost} per new mission</span></div>
      <div><small>Dorm PT</small><strong>${t.fitnessDone ? '✓ Done' : 'To do'}</strong></div>
    </div>${notice}
  </section>`;
}

const STATUS = { done: '✓ Completed', 'in-progress': 'Continue', ready: 'Play' };

/** Plan entries that are not book missions (book missions use the Office's own cards). */
export function planEntryMarkup(item, { icon, names }) {
  if (item.kind === 'staff') {
    const mission = getNPCMission(item.id), npc = getNPC(mission?.npcId);
    if (!mission) return '';
    return `<button class="assignment-card ${item.status === 'done' ? 'complete' : ''}" data-plan-staff="${esc(item.id)}"><span class="assignment-icon">${icon('user')}</span><span><small>Staff mission · ${esc(npc?.name || 'AMCOL staff')}${item.location ? ` · ${esc(names[item.location] || item.location)}` : ''}</small><strong>${esc(mission.title)}</strong><span>${mission.questions?.length || 1} questions · uses one mission slot</span></span><span class="assignment-status">${STATUS[item.status] || 'Play'}</span></button>`;
  }
  if (item.kind === 'loma') {
    const game = getLomaGame(item.id);
    if (!game) return '';
    return `<button class="assignment-card ${item.status === 'done' ? 'complete' : ''}" data-plan-loma="${esc(item.id)}"><span class="assignment-icon">${icon('trophy')}</span><span><small>Loma Lounge · Final</small><strong>${esc(game.title)}</strong><span>${game.questions.length} questions · uses one mission slot</span></span><span class="assignment-status">${STATUS[item.status] || 'Play'}</span></button>`;
  }
  return '';
}

/** Short first-time explainer shown in the Academic Office until dismissed. */
export function explainerMarkup() {
  return `<section class="handbook-explainer" data-handbook-explainer><strong>How your study week works</strong><ul>
    <li>You have <b>${W.studyDays} study days</b> each real week and <b>${M.perDay} graded missions</b> per study day (${M.perWeek} a week).</li>
    <li>Starting a new graded mission uses <b>${E.missionEntry} energy</b> once. Retries are free and do not use another slot.</li>
    <li>Eat a free meal (+${E.meal}) or rest (+${E.rest}) to recover. Sleep refills energy to ${E.max}.</li>
    <li>Do one PT, run or football session, then sleep to end the study day. The ${ordinal(W.studyDays)} sleep starts weekly rest until ${RESET}.</li>
  </ul><div class="dialog-actions"><button class="button secondary" id="handbook-open-explainer">Open the Cadet Handbook</button><button class="button primary" id="handbook-dismiss">Got it</button></div></section>`;
}

function ordinal(n) { return ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n] || `${n}th`; }

/** The permanent Cadet Handbook. */
export function handbookMarkup(s) {
  const level = s?.rpg?.level || 1, rank = rankForLevel(level);
  const books = Object.entries(X.bookByYear).map(([year, xp]) => `Year ${year}: ${xp} XP`).join(' · ');
  return `<div class="handbook">
  <section><h3>Your day</h3><ol class="academy-help">
    <li><strong>Check today’s plan.</strong> The Academic Office lists today’s ${M.perDay} missions and who teaches each one, with a mix of places and game types. Unfinished missions carry over to your next study day.</li>
    <li><strong>Explore and meet people.</strong> Walk the campus, chat with cadets and teachers, and visit the places on your plan.</li>
    <li><strong>Play mini-games.</strong> Each new graded mission uses one of today’s ${M.perDay} slots and ${E.missionEntry} energy, charged once. Retrying a mission you started is free. Completed missions can be replayed as practice for no extra XP.</li>
    <li><strong>Look after your cadet.</strong> A basic meal is always free (+${E.meal} energy) at Loma Café, Palm Garden or the dormitory. A rest gives +${E.rest} energy. Meters never drop while you are away.</li>
    <li><strong>Exercise, then sleep.</strong> Do one PT, run or football session at the dormitory (${F.energyCost} energy), then sleep. Sleep refills energy to ${E.max} and starts the next study day.</li>
  </ol></section>
  <section><h3>Your week</h3><ol class="academy-help">
    <li><strong>${W.studyDays} study days per real week.</strong> Each sleep ends one. Your ${ordinal(W.studyDays)} sleep starts <strong>weekly rest</strong>: you can still explore, chat and practise, but new graded missions and XP wait for the reset.</li>
    <li><strong>${M.perWeek} graded missions per week</strong> (${M.perDay} per study day). Unused days and slots do not carry over.</li>
    <li><strong>The week resets ${RESET}.</strong> Changing devices or starting a new journey does not restore used days.</li>
  </ol></section>
  <section><h3>XP, skills and rank</h3><ol class="academy-help">
    <li><strong>XP.</strong> First completions earn character XP. Book missions grow with your year (${books}). Staff, safety and Loma final games earn ${X.staff} XP, daily exercise ${X.fitness} XP, and meeting staff or daily care ${X.intro} XP.</li>
    <li><strong>Skills.</strong> Each game trains its taught skills: English, Mathematics, Science, Navigation, Engineering, Radio &amp; SMCP, Safety, Leadership and Fitness. A skill levels up every ${X.skillLevel} skill XP.</li>
    <li><strong>Level and rank.</strong> Level 2 needs ${X.levelBase} XP and each later level needs ${X.levelGrowth} more than the one before. Ranks: ${RANKS.map(r => `${esc(r.title)} (Lv ${r.level})`).join(', ')}. You are a ${esc(rank.title)}, Level ${level}.</li>
    <li><strong>Traits</strong> add +2 skill XP to matching new games. They lock after your next rewarded game.</li>
    <li><strong>Level is not your semester.</strong> Semesters advance by finishing the semester’s book missions at the Academic Office, not by XP.</li>
  </ol></section>
  <section><h3>Your academy</h3><ol class="academy-help">
    <li><strong>First day: orientation.</strong> Meet all ${NPCS.length} staff. Introductions are outside the mission limits and use no energy.</li>
    <li><strong>Eight semesters, four years.</strong> Questions get harder each year. Choose DECK or ENGINE; it locks when you begin the Loma final.</li>
    <li><strong>Year 2 review.</strong> After Year 2’s book work, pass Tr. Dream’s readiness review near Atlantic before entering Year 3.</li>
    <li><strong>Loma Lounge final.</strong> In Year 4, Semester 2, once that semester’s book missions are done, begin a saved set of ${L.finalCount} final games. They use the same ${M.perDay} daily and ${M.perWeek} weekly slots, so the final takes at least ${Math.ceil(L.finalCount / M.perDay)} study days.</li>
    <li><strong>Dress for each place.</strong> The Workshop needs the blue workshop suit and the Lifeboat needs the orange immersion suit. The dormitory shows casual clothes automatically.</li>
  </ol></section>
  <section><h3>Controls</h3><div class="help-controls"><div><kbd>W A S D</kbd> / arrows · Walk</div><div><kbd>Shift</kbd> Run</div><div><kbd>E</kbd> Enter / talk</div><div><kbd>Q</kbd><kbd>R</kbd> Turn the camera</div><div><kbd>M</kbd> Map</div><div><kbd>J</kbd> Today’s plan</div></div><p class="dialog-copy">Click the ground to walk. On a phone, drag the joystick, tap Run to toggle running, and tap Interact near a person or building.</p></section>
  </div>`;
}
