import { ACTIVITIES } from './book-course.js';
import { NPCS, NPC_MISSIONS } from './npc-content.js';
import { SAFETY_GAMES } from './lifeboat-content.js';
import { LOMA_FINAL_COUNT, getLomaGame } from './loma-content.js';
import { displayCharacter, normalizeCharacter } from './progress.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const integer = (value, fallback = 0, minimum = 0, maximum = 1000000) => typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.floor(value))) : fallback;
const validOutfits = ['cadet', 'maritime-white', 'maritime', 'coverall', 'immersion'];
const outfitNames = { cadet: 'Campus uniform', coverall: 'Workshop suit', immersion: 'Immersion suit', maritime: 'Maritime navy uniform', 'maritime-white': 'Maritime white uniform', casual: 'Dormitory casual clothes' };
const majorNames = { deck: 'DECK', engine: 'ENGINE' };
const majorFocus = { deck: 'Navigation, bridge watchkeeping, cargo and seamanship', engine: 'Machinery, engine-room watchkeeping and maintenance' };
const fitnessNames = { pt: 'PT', run: 'Running', football: 'Football' };
const isCompleted = result => result?.completed === true;
const activityEntries = ACTIVITIES.map(item => ({ id: item.id, source: 'book', item }));
const missionEntries = NPC_MISSIONS.map(item => ({ id: item.id, source: 'staff', item }));
const safetyEntries = SAFETY_GAMES.map(item => ({ id: item.id, source: 'safety', item }));
const allEntries = [...activityEntries, ...missionEntries, ...safetyEntries];

function savedResult(state, entry) {
  if (entry.source === 'book') return state?.results?.[entry.id];
  if (entry.source === 'safety') return (state?.safety?.results || state?.safetyResults)?.[entry.id];
  if (entry.source === 'loma') return state?.loma?.results?.[entry.id];
  return (state?.npc?.results || state?.npcResults)?.[entry.id];
}
function completionArea(state, id, label, entries, sourceLabel) {
  const completed = entries.filter(entry => isCompleted(savedResult(state, entry))).length;
  return { id, label, completed, total: entries.length, percent: entries.length ? Math.round(completed / entries.length * 100) : 0, sourceLabel };
}
function bestSavedScore(state, id, label, entries) {
  const scores = entries.map(entry => ({ entry, result: savedResult(state, entry) })).filter(({ result }) => result
    && typeof result.objectiveTotal === 'number' && Number.isFinite(result.objectiveTotal) && result.objectiveTotal > 0
    && typeof result.objectiveCorrect === 'number' && Number.isFinite(result.objectiveCorrect)
    && result.objectiveCorrect >= 0 && result.objectiveCorrect <= result.objectiveTotal);
  scores.sort((a, b) => b.result.objectiveCorrect / b.result.objectiveTotal - a.result.objectiveCorrect / a.result.objectiveTotal
    || b.result.objectiveTotal - a.result.objectiveTotal || a.entry.id.localeCompare(b.entry.id));
  const best = scores[0];
  const reviewed = entries.filter(entry => {
    const result = savedResult(state, entry);
    return isCompleted(result) && (integer(result.selfReviewed) > 0 || ['self-reviewed', 'mixed'].includes(result.outcome));
  }).length;
  return { id, label, attempts: scores.length, selfReviewed: reviewed, percent: best ? Math.round(best.result.objectiveCorrect / best.result.objectiveTotal * 100) : null,
    correct: best?.result.objectiveCorrect ?? null, total: best?.result.objectiveTotal ?? null, missionId: best?.entry.id ?? null,
    missionTitle: best?.entry.item.title ?? null };
}

/**
 * Honest game metrics from known catalog entries in the saved account.
 * The authoritative RPG summary includes first-completion rewards, introductions and care.
 * Older accounts without that summary retain their ten-XP-per-completion display.
 * Course areas overlap and are completion
 * indicators, not assessed professional competency or attendance records.
 */
export function getCharacterSummary(state = {}) {
  const s = state || {}, semester = integer(s.semester, 1, 1, 8), day = integer(s.day, 1, 1);
  const bookCompleted = activityEntries.filter(entry => isCompleted(savedResult(s, entry))).length;
  const staffCompleted = missionEntries.filter(entry => isCompleted(savedResult(s, entry))).length;
  const safetyCompleted = safetyEntries.filter(entry => isCompleted(savedResult(s, entry))).length;
  const lomaIds = Array.isArray(s.loma?.gameIds) ? [...new Set(s.loma.gameIds.filter(id => typeof id === 'string' && getLomaGame(id)))].slice(0, LOMA_FINAL_COUNT) : [];
  const lomaEntries = lomaIds.map(id => ({ id, source: 'loma', item: getLomaGame(id) }));
  const lomaCompleted = lomaEntries.filter(entry => isCompleted(savedResult(s, entry))).length;
  const semesterEntries = activityEntries.filter(entry => entry.item.semester === semester);
  const semesterCompleted = semesterEntries.filter(entry => isCompleted(savedResult(s, entry))).length;
  const legacyXP = (bookCompleted + staffCompleted + safetyCompleted + lomaCompleted) * 10;
  const hasRPG = typeof s.rpg?.totalXp === 'number' && Number.isFinite(s.rpg.totalXp);
  const totalXP = hasRPG ? integer(s.rpg.totalXp) : legacyXP;
  const level = hasRPG ? integer(s.rpg.level, 1 + Math.floor(totalXP / 100), 1) : 1 + Math.floor(totalXP / 100);
  const xpForNextLevel = hasRPG ? integer(s.rpg.xpForNextLevel, 100, 1) : 100;
  const progressToNextLevel = hasRPG ? integer(s.rpg.xpIntoLevel, totalXP % 100, 0, xpForNextLevel) : totalXP % 100;
  const orientation = s.orientation || {};
  const knownVisits = Array.isArray(orientation.visitedIds) ? new Set(orientation.visitedIds.filter(id => NPCS.some(npc => npc.id === id))) : null;
  const orientationTotal = NPCS.length;
  const orientationCompleted = orientation.completed === true;
  const orientationCount = orientationCompleted ? orientationTotal : Math.min(orientationTotal, knownVisits ? knownVisits.size : integer(orientation.completedCount));
  const fitnessComplete = s.fitness?.day === day && Object.hasOwn(fitnessNames, s.fitness?.kind || '');
  const results = activityEntries.map(entry => savedResult(s, entry)).filter(Boolean);
  const areas = [
    completionArea(s, 'english', 'English', [...activityEntries, ...missionEntries.filter(entry => entry.item.npcId === 'wayne')], 'All book missions + Dr. Wayne’s missions'),
    completionArea(s, 'radio', 'SMCP & radio', [...activityEntries.filter(entry => [3, 5, 6].includes(entry.item.unit) || entry.item.room === 'gmdss'), ...missionEntries.filter(entry => entry.item.npcId === 'bank')], 'Watchkeeping and radio units 3, 5–6 + GMDSS tasks and Tr. Bank’s missions'),
    completionArea(s, 'seamanship', 'Seamanship', [...activityEntries.filter(entry => [2, 3, 4, 7, 8].includes(entry.item.unit)), ...missionEntries.filter(entry => ['jakk', 'duke'].includes(entry.item.npcId))], 'Book units 2–4, 7–8 + Capt. Jakk’s and Tr. Duke’s missions'),
    completionArea(s, 'engineering', 'Engineering', [...activityEntries.filter(entry => entry.item.unit === 9 || entry.item.room === 'engine'), ...missionEntries.filter(entry => ['asawin', 'gerald'].includes(entry.item.npcId))], 'Machinery unit 9 + Engine Simulator tasks with C/E Asawin and Engineer Gerald'),
    completionArea(s, 'safety', 'Lifeboat safety', safetyEntries, 'Optional safety games · Years 1–4'),
  ];
  const bestScores = [
    bestSavedScore(s, 'safety', 'Lifeboat safety', safetyEntries),
    bestSavedScore(s, 'sentences', 'Sentence scramble', missionEntries.filter(entry => entry.item.npcId === 'wayne')),
    bestSavedScore(s, 'maths', 'Maths & algebra', missionEntries.filter(entry => entry.item.npcId === 'aphisit')),
    bestSavedScore(s, 'science', 'Science trivia', missionEntries.filter(entry => entry.item.npcId === 'anne')),
    bestSavedScore(s, 'radio', 'Radio challenges', [...activityEntries.filter(entry => [5, 6].includes(entry.item.unit) || entry.item.room === 'gmdss'), ...missionEntries.filter(entry => entry.item.npcId === 'bank')]),
    bestSavedScore(s, 'engine', 'Engine Simulator challenges', [...activityEntries.filter(entry => entry.item.room === 'engine'), ...missionEntries.filter(entry => ['asawin', 'gerald'].includes(entry.item.npcId))]),
    bestSavedScore(s, 'workshop', 'Workshop challenges', [...activityEntries.filter(entry => entry.item.location === 'workshop'), ...missionEntries.filter(entry => entry.item.npcId === 'amara')]),
  ];
  return {
    year: Math.ceil(semester / 2), term: ((semester - 1) % 2) + 1, semester, day,
    rank: s.graduated ? 'Academy graduate' : `Cadet · Year ${Math.ceil(semester / 2)}`,
    totalXP, level, progressToNextLevel, xpForNextLevel, xpToNextLevel: xpForNextLevel - progressToNextLevel,
    levelPercent: Math.round(progressToNextLevel / xpForNextLevel * 100), hasRPG,
    bookCompleted, bookTotal: activityEntries.length, staffCompleted, staffTotal: missionEntries.length, safetyCompleted, safetyTotal: safetyEntries.length,
    lomaCompleted, lomaTotal: LOMA_FINAL_COUNT,
    lomaComplete: lomaCompleted === LOMA_FINAL_COUNT && lomaEntries.length === LOMA_FINAL_COUNT,
    missionCompleted: bookCompleted + staffCompleted + safetyCompleted + lomaCompleted, missionTotal: allEntries.length + LOMA_FINAL_COUNT,
    semesterCompleted, semesterRequired: semesterEntries.length,
    orientation: { completed: orientationCompleted, completedCount: orientationCount, total: orientationTotal },
    fitness: { completed: fitnessComplete, label: fitnessComplete ? fitnessNames[s.fitness.kind] : null, day },
    selfReviewedMissions: results.filter(result => isCompleted(result) && (integer(result.selfReviewed) > 0 || ['self-reviewed', 'mixed'].includes(result.outcome))).length,
    selfReviewedResponses: results.reduce((total, result) => total + (isCompleted(result) ? integer(result.selfReviewed) : 0), 0),
    exactOnlyMissions: results.filter(result => isCompleted(result) && result.outcome === 'correct').length,
    areas, bestScores,
  };
}

function normalizedPortraitProfile(value = {}) {
  const p = normalizeCharacter(value);
  return value?.outfit === 'casual' ? { ...p, outfit: 'casual' } : p;
}

/** Code-native avatar: the saved appearance, never a generated personal likeness. */
function portrait(value, full = false) {
  const p = normalizedPortraitProfile(value);
  const immersion = p.outfit === 'immersion', cadet = p.outfit === 'cadet', casual = p.outfit === 'casual';
  const maritimeNavy = p.outfit === 'maritime', maritimeWhite = p.outfit === 'maritime-white', maritime = maritimeNavy || maritimeWhite, coverall = p.outfit === 'coverall';
  const top = immersion ? '#ec7038' : coverall ? '#38566b' : maritimeNavy ? '#162c43' : '#fafbfa';
  const bottom = immersion ? '#d9632c' : coverall ? '#38566b' : casual ? '#192e50' : '#171e2a';
  const scale = p.body === 'broad' ? 1.12 : p.body === 'slim' ? .92 : 1;
  const skirt = p.gender === 'female' && (cadet || maritime);
  const hairBehind = p.hairStyle === 'bob' ? `<path d="M57 76Q55 28 88 28Q124 28 123 80L117 101H62Z" fill="${p.hairColor}"/>`
    : p.hairStyle === 'bun' ? `<circle cx="94" cy="33" r="19" fill="${p.hairColor}"/>` : '';
  const hair = p.hairStyle === 'swept' ? `<path d="M58 64Q53 29 88 29Q114 25 124 53Q102 56 91 44Q79 62 58 64Z" fill="${p.hairColor}"/>`
    : `<path d="M59 62Q56 30 91 30Q124 30 121 62L112 49H67Z" fill="${p.hairColor}"/>`;
  const head = `<ellipse cx="60" cy="75" rx="6" ry="9" fill="${p.skin}"/><ellipse cx="120" cy="75" rx="6" ry="9" fill="${p.skin}"/><rect x="62" y="38" width="56" height="68" rx="26" fill="${p.skin}"/><ellipse cx="77" cy="73" rx="3" ry="4" fill="#23313b"/><ellipse cx="103" cy="73" rx="3" ry="4" fill="#23313b"/><path d="M82 90Q90 96 99 88" fill="none" stroke="#874c3e" stroke-width="3" stroke-linecap="round"/>`;
  const accessory = immersion ? '' : p.accessory === 'cap' && !casual ? '<ellipse cx="90" cy="38" rx="43" ry="15" fill="#f6f8fa"/><path d="M57 38H123V51H57Z" fill="#19304b"/><path d="M58 50Q91 62 126 49Q116 44 93 46Z" fill="#203247"/><circle cx="90" cy="43" r="5" fill="#d4b25c"/>'
    : p.accessory === 'glasses' ? '<g fill="none" stroke="#263747" stroke-width="3"><rect x="66" y="65" width="22" height="16" rx="6"/><rect x="93" y="65" width="22" height="16" rx="6"/><path d="M88 70H93"/></g>' : '';
  const collar = cadet ? '<path d="M72 108L90 118L81 133L66 114M108 108L90 118L99 133L114 114" fill="#e4e9eb" stroke="#cbd6dc" stroke-width="1"/><path d="M90 126V166" stroke="#bac8d2" stroke-width="2"/><circle cx="91" cy="142" r="1.5" fill="#b6c2cb"/><circle cx="91" cy="154" r="1.5" fill="#b6c2cb"/>'
    : immersion ? '<path d="M89 111V211" stroke="#623d2c" stroke-width="4"/><path d="M57 122H78M101 122H123" stroke="#dfe2c5" stroke-width="10"/><rect x="105" y="146" width="14" height="18" rx="3" fill="#ed964c"/>'
      : maritimeWhite ? '<g data-avatar-uniform="maritime-white"><path d="M72 108L90 118L81 132L66 114M108 108L90 118L99 132L114 114" fill="#edf1f3" stroke="#cbd6dc" stroke-width="1"/><path d="M90 124V166" stroke="#bac8d2" stroke-width="1.5"/><path d="M85 117H95L93 125L98 148L90 157L82 148L87 125Z" fill="#171e2a"/><path d="M59 134H76V148H59ZM104 134H121V148H104Z" fill="#f8fafb" stroke="#b4c4ce" stroke-width="1"/><path d="M59 137H76M104 137H121" stroke="#b4c4ce" stroke-width="1"/><path d="M54 116L73 120M107 120L126 116" stroke="#172637" stroke-width="7"/><path d="M59 117L60 121M65 119L66 123M115 118L116 123M121 117L122 121" stroke="#d1b065" stroke-width="2"/><path d="M35 169L51 173M130 174L146 170" stroke="#d7e0e5" stroke-width="3"/></g>'
      : maritimeNavy ? '<path d="M75 106H105L91 154Z" fill="#fbfcfc"/><path d="M86 114H95L94 122L99 143L91 152L83 143L87 122Z" fill="#142538"/><path d="M75 106L66 122L79 132L70 137L91 169L110 137L101 131L113 120L106 106L91 155Z" fill="#2b4760"/><path d="M54 116L73 120M107 120L126 116" stroke="#0d1a2b" stroke-width="7"/><path d="M59 117L60 121M65 119L66 123M115 118L116 123M121 117L122 121" stroke="#d1b065" stroke-width="2"/><circle cx="91" cy="159" r="2.5" fill="#d9b866"/><path d="M35 169L51 173M35 175L50 179M130 174L146 170M131 180L146 176" stroke="#d9b866" stroke-width="3"/>'
        : coverall ? '<path d="M71 107L90 120L108 107M90 120V215" fill="none" stroke="#a5bdc9" stroke-width="2"/><path d="M62 137H77V151H62ZM102 137H117V151H102Z" fill="#2e485a"/><path d="M57 169H123" stroke="#284758" stroke-width="2"/>'
          : '<path d="M74 108Q90 123 106 108" fill="none" stroke="#d3dce3" stroke-width="3"/>';
  const legs = skirt ? `<path d="M68 201H83V236H68ZM97 201H112V236H97Z" fill="${p.skin}"/><path data-avatar-cut="fitted-skirt" d="M59 160H121L120 208H60Z" fill="${bottom}"/><path d="M92 185V207" stroke="#293544" stroke-width="1.5"/>`
    : casual ? `<path d="M65 185H83V236H65ZM97 185H115V236H97Z" fill="${p.skin}"/><path data-avatar-cut="shorts" d="M58 160H122L120 199H94L90 183L86 199H60Z" fill="${bottom}"/>`
      : `<path d="M59 160H88V235H60ZM92 160H121L120 235H93Z" fill="${bottom}"/>`;
  const uniformDetail = cadet ? `, plain white long sleeves and black ${skirt ? 'fitted skirt' : 'pants'}`
    : maritimeWhite ? `, white long sleeves, epaulettes and black tie, with black ${skirt ? 'fitted skirt' : 'pants'}`
    : maritimeNavy ? `, navy jacket and black ${skirt ? 'fitted skirt' : 'pants'}`
      : casual ? ', white short-sleeved shirt and navy blue shorts' : coverall ? ', blue one-piece coveralls' : ', orange hood, gloves and boots';
  return `<svg class="record-avatar-svg${full ? ' full' : ''}" viewBox="${full ? '0 0 180 260' : '24 10 132 150'}" role="img" aria-label="${esc(`${p.gender === 'female' ? 'Female' : 'Male'} cadet wearing ${outfitNames[p.outfit].toLowerCase()}${uniformDetail}`)}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="90" cy="245" rx="53" ry="7" fill="#06132745"/><g transform="translate(90 0) scale(${scale} 1) translate(-90 0)">${legs}<path d="M57 233H86V244H52Q50 237 57 233M95 233H121L129 240V244H94Z" fill="${immersion ? '#ba4e22' : '#0a1420'}"/><path d="M57 108Q90 100 123 108L125 168H55Z" fill="${top}"/><path d="M58 109Q43 109 40 125L33 ${casual ? 146 : 177}L49 ${casual ? 150 : 182}L63 118M123 109Q138 109 141 125L148 ${casual ? 146 : 177}L132 ${casual ? 150 : 182}L118 118" fill="${top}"/>${casual ? `<path d="M35 145L31 180Q33 192 44 184L49 149M145 145L150 180Q148 192 137 184L132 149" fill="${p.skin}"/>` : ''}<ellipse cx="41" cy="182" rx="9" ry="12" fill="${immersion ? '#d65d27' : p.skin}"/><ellipse cx="140" cy="182" rx="9" ry="12" fill="${immersion ? '#d65d27' : p.skin}"/>${!immersion ? `<rect x="80" y="92" width="20" height="24" rx="6" fill="${p.skin}"/>` : ''}${collar}${cadet || maritimeWhite ? '<path d="M56 167H124" stroke="#192838" stroke-width="6"/><rect x="85" y="164" width="11" height="6" rx="1" fill="#a9b1b8"/>' : ''}</g>${immersion ? `<path d="M48 76Q46 20 90 20Q134 20 132 76L126 113H54Z" fill="#ef763a"/><path d="M58 75Q58 34 90 34Q122 34 122 75L117 103H63Z" fill="#713e2e"/>${head}<path d="M57 92Q90 122 123 92L119 115H62Z" fill="#e66830"/><path d="M50 50L55 37M125 37L130 50" stroke="#dedfc7" stroke-width="7"/>` : `${hairBehind}${head}${hair}${accessory}`}</svg>`;
}

export function createCharacterDashboard(bridge) {
  let viewRevision = 0, activeDraft = null, saving = false;
  const body = () => document.querySelector('#dialog-body');
  const select = selector => body()?.querySelector(selector);
  const selectAll = selector => [...(body()?.querySelectorAll(selector) || [])];
  const state = () => bridge.getState?.() || {};
  const zone = () => bridge.getZone?.() === 'dorm' ? 'dorm' : 'campus';
  const profile = () => {
    const p = normalizeCharacter({ ...(bridge.getCharacter?.() || {}), ...(state().profile || {}) });
    if (state().loma?.majorLocked && Object.hasOwn(majorNames, state().loma?.major)) p.major = state().loma.major;
    return p;
  };
  const icon = name => bridge.icon?.(name) || '';
  const button = (id, text, primary = false) => `<button type="button" class="record-button${primary ? ' primary' : ''}" id="${id}">${esc(text)}</button>`;
  function dispose() {
    viewRevision++; activeDraft = null; saving = false;
    body()?.closest('dialog')?.classList.remove('character-dialog');
  }
  function show(title, kicker, html, key) {
    bridge.show(title, kicker, html, key);
    viewRevision++; body()?.closest('dialog')?.classList.add('character-dialog');
  }
  function attach(id, action) { const element = select(`#${id}`); if (element) element.onclick = action; }
  function majorMarkup(p) {
    const locked = state().loma?.majorLocked === true;
    return `<section class="record-major"><div><small>YOUR MAJOR</small><h3>${majorNames[p.major]}</h3><p>${esc(majorFocus[p.major])}.</p><span>${locked ? 'Major fixed for your drawn Loma final.' : 'Choose DECK or ENGINE before drawing your Loma final.'}</span></div>${button('record-major', locked ? 'View major & uniform' : 'Choose my major')}</section>`;
  }
  function lomaMarkup(summary) {
    const loma = state().loma || {}, started = loma.started === true;
    const status = summary.lomaComplete ? 'All 50 final mini-games passed.' : started ? 'Your final set is in progress.' : 'Your final challenge awaits.';
    const today = loma.today?.day === summary.day ? integer(loma.today?.completed, 0, 0, 5) : 0;
    const detail = summary.lomaComplete ? 'Return to the Academic Office to complete your remaining graduation requirements.'
      : started ? `Pass every game in your saved set. ${today} / 5 final games completed today. Dorm exercise and sleep open the next game day.`
        : 'In Year 4, Semester 2, draw a personal set of 50 random mini-games for your major. Pass every game to complete the Loma final.';
    return `<section class="record-loma${summary.lomaComplete ? ' complete' : ''}" aria-labelledby="record-loma-title"><div class="record-loma-heading"><div><small>LOMA LOUNGE · YEAR 4, SEMESTER 2</small><h3 id="record-loma-title">${status}</h3></div><strong>${summary.lomaCompleted}<span> / ${summary.lomaTotal}</span></strong></div><div class="record-track" role="progressbar" aria-label="Loma final completion" aria-valuemin="0" aria-valuemax="${summary.lomaTotal}" aria-valuenow="${summary.lomaCompleted}"><i style="width:${Math.round(summary.lomaCompleted / summary.lomaTotal * 100)}%"></i></div><p>${detail}</p>${button('record-loma', started ? 'Open my Loma final' : 'Visit Loma Lounge', loma.available === true)}</section>`;
  }
  function rpgMarkup(s) {
    const rpg = s.rpg;
    if (!rpg || !Array.isArray(rpg.skills)) return '';
    const skills = rpg.skills, traits = rpg.traits || {}, options = Array.isArray(traits.options) ? traits.options : [];
    const selected = options.filter(option => traits.selected?.includes(option.id));
    const earned = Array.isArray(traits.earned) ? traits.earned : [];
    const wellbeing = rpg.wellbeing || {}, bodyRecord = rpg.body || {};
    const needs = [
      { id: 'energy', label: 'Energy', action: 'rest', place: 'dorm', placeName: 'Dormitory', detail: 'Rest between your studies.' },
      { id: 'hydration', label: 'Hydration', action: 'water', place: 'garden', placeName: 'Palm Garden', detail: 'Make time for a water break.' },
      { id: 'nourishment', label: 'Nourishment', action: 'meal', place: 'cafe', placeName: 'Loma Café', detail: 'Sit down for a balanced meal.' },
    ];
    const bmi = typeof bodyRecord.bmi === 'number' && Number.isFinite(bodyRecord.bmi) ? bodyRecord.bmi.toFixed(1) : '—';
    return `<section class="record-rpg" data-rpg-overview aria-labelledby="record-rpg-title"><div class="record-rpg-heading"><div><small>BUILD YOUR CADET</small><h3 id="record-rpg-title">Your next level starts here.</h3><p>Study. Practise. Take care of yourself.</p></div><span class="record-rpg-emblem" aria-hidden="true">${icon('compass') || '✦'}</span></div><section class="record-trait-banner${selected.length === 2 ? '' : ' choose'}" aria-labelledby="record-starter-title"><div><small>STARTER TRAITS · ${selected.length} / 2</small><h4 id="record-starter-title">${selected.length === 2 ? selected.map(option => esc(option.label)).join(' + ') : 'Choose what makes your cadet unique.'}</h4><p>${traits.locked ? 'Your selected traits add bonus skill XP to matching training.' : 'Choose two traits. They become fixed when you next earn a mini-game or exercise reward.'}</p></div>${button('record-rpg-traits', selected.length === 2 ? 'View my traits' : 'Choose two traits', selected.length !== 2)}</section><div class="record-section-title"><h3>SKILLS & EXPERIENCE</h3><span>${integer(rpg.completedGames)} games completed</span></div><div class="record-skill-grid">${skills.map(skill => {
      const target = integer(skill.xpForNextLevel, 30, 1), progress = integer(skill.xpIntoLevel, 0, 0, target);
      return `<article class="record-skill" data-rpg-skill="${esc(skill.id)}"><div><h4>${esc(skill.label)}</h4><span>LV ${integer(skill.level, 1, 1)}</span></div><div class="record-track" role="progressbar" aria-label="${esc(skill.label)} XP toward next skill level" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${progress}"><i style="width:${Math.round(progress / target * 100)}%"></i></div><p><strong>${integer(skill.xp).toLocaleString('en-GB')} XP</strong><span>${progress} / ${target} to next level</span></p></article>`;
    }).join('')}</div><p class="record-note">A first completed mini-game earns 10 character XP and trains its related skills. Matching traits add +2 skill XP. Wellbeing at 40 or more in all three meters adds +2 primary skill XP.</p><div class="record-section-title"><h3>EVERYDAY WELLBEING</h3><span>Game meters · 0–100</span></div><div class="record-needs-grid">${needs.map(need => {
      const value = integer(wellbeing[need.id], 100, 0, 100), completed = wellbeing.careToday?.[need.action] === true;
      return `<article class="record-need" data-rpg-need="${need.id}"><div><h4>${need.label}</h4><strong>${value}<small> / 100</small></strong></div><div class="record-track" role="progressbar" aria-label="${need.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i style="width:${value}%"></i></div><p>${need.detail}</p><span class="record-care-status">${completed ? '✓ Care recorded today' : 'One care reward available today'}</span><button type="button" class="record-button" data-rpg-care-location="${need.place}">Visit ${need.placeName}</button></article>`;
    }).join('')}</div><p class="record-note">Training uses energy, hydration and nourishment. Water, meals and rest restore your game meters and each earn a daily care reward. Sleep starts a fresh game day.</p><section class="record-body-card"><div><small>FICTIONAL AVATAR RECORD</small><h4>BMI <strong>${bmi}</strong></h4><p>${bodyRecord.heightCm != null && bodyRecord.weightKg != null ? `${esc(bodyRecord.heightCm)} cm · ${esc(bodyRecord.weightKg)} kg` : 'Optional height and weight for your cadet.'}</p><span>BMI is a reference, not a fitness score. <a href="https://www.cdc.gov/bmi/about/index.html" target="_blank" rel="noopener noreferrer">About BMI ↗</a></span></div>${button('record-rpg-body', 'Edit avatar measurements')}</section>${earned.length ? `<div class="record-section-title"><h3>EARNED TRAITS</h3><span>${earned.filter(trait => trait.unlocked).length} / ${earned.length} unlocked</span></div><div class="record-earned-grid">${earned.map(trait => {
      const target = integer(trait.target, 1, 1), current = integer(trait.current, 0, 0, target);
      return `<article class="record-earned-trait${trait.unlocked ? ' unlocked' : ''}" data-rpg-earned="${esc(trait.id)}"><div><span class="record-trait-medal" aria-hidden="true">${trait.unlocked ? '✦' : '◇'}</span><h4>${esc(trait.label)}</h4><small>${trait.unlocked ? 'UNLOCKED' : `${current} / ${target}`}</small></div><p>${esc(trait.description || trait.goal)}</p>${trait.goal ? `<span class="record-earned-goal">${esc(trait.goal)}</span>` : ''}${!trait.unlocked ? `<div class="record-track" role="progressbar" aria-label="${esc(trait.label)} unlock progress" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${current}"><i style="width:${Math.round(current / target * 100)}%"></i></div>` : ''}</article>`;
    }).join('')}</div>` : ''}</section>`;
  }
  function openRPGProfile(options = {}) {
    const rpg = state().rpg;
    if (!rpg || !Array.isArray(rpg.skills)) { bridge.toast?.('Connect your cadet to open the RPG record.'); return; }
    const mode = options?.mode === 'traits' ? 'traits' : 'body';
    const draft = { mode, heightCm: rpg.body?.heightCm ?? '', weightKg: rpg.body?.weightKg ?? '', traits: [...(rpg.traits?.selected || [])] };
    renderRPGProfile(draft);
  }
  function renderRPGProfile(draft) {
    const rpg = state().rpg || {}, editingTraits = draft.mode === 'traits';
    const options = Array.isArray(rpg.traits?.options) ? rpg.traits.options : [];
    const locked = () => state().rpg?.traits?.locked === true;
    const traitIds = new Set(options.map(option => option.id));
    const skillNames = Object.fromEntries((rpg.skills || []).map(skill => [skill.id, skill.label]));
    const history = Array.isArray(rpg.body?.history) ? [...rpg.body.history].reverse().slice(0, 5) : [];
    const content = editingTraits ? `<p class="record-editor-intro">Pick two strengths for your cadet. Each selected trait adds +2 XP to its matching trained skills in future mini-games and exercise.</p><div class="record-trait-choice-heading"><strong id="rpg-trait-count">${draft.traits.length} / 2 selected</strong><span>${locked() ? 'Traits fixed for this journey' : 'Fixed after your next training reward'}</span></div><div class="record-trait-options">${options.map(option => `<button type="button" data-rpg-trait="${esc(option.id)}" aria-pressed="${draft.traits.includes(option.id)}" ${locked() ? 'disabled' : ''}><span><strong>${esc(option.label)}</strong><span class="record-trait-choice-mark" aria-hidden="true">${draft.traits.includes(option.id) ? '✓' : '+'}</span></span><p>${esc(option.description)}</p><small>${(option.skillIds || []).map(id => esc(skillNames[id] || id)).join(' · ')} <b>+${integer(option.bonus, 2)} skill XP</b></small></button>`).join('')}</div><p class="record-note">Trait bonuses apply to the skills a task trains. Your course year, major and passed missions continue to determine which tasks are available.</p>`
      : `<p class="record-editor-intro">These optional measurements belong to your <strong>fictional cadet</strong>. Use invented values for the character you are creating.</p><div class="record-body-editor"><div class="record-measurement-fields"><label for="rpg-height">Avatar height <span>cm</span><input id="rpg-height" type="number" inputmode="decimal" min="90" max="250" step="0.1" value="${esc(draft.heightCm)}" autocomplete="off" placeholder="e.g. 170" aria-describedby="rpg-measurement-note"></label><label for="rpg-weight">Avatar weight <span>kg</span><input id="rpg-weight" type="number" inputmode="decimal" min="20" max="300" step="0.1" value="${esc(draft.weightKg)}" autocomplete="off" placeholder="e.g. 65" aria-describedby="rpg-measurement-note"></label></div><div class="record-bmi-preview"><small>AVATAR BMI</small><output id="rpg-bmi-preview" for="rpg-height rpg-weight" aria-live="polite">—</output><span>kg ÷ height in metres²</span></div></div><p class="record-note" id="rpg-measurement-note">Character editor range: 90–250 cm and 20–300 kg. Leave both blank to remove avatar measurements and their saved history.</p><div class="record-bmi-reference"><strong>BMI is a reference, not a fitness score.</strong><p>It is one screening measure and does not directly measure body fat. Your cadet’s game wellbeing is shown by energy, hydration and nourishment.</p><a href="https://www.cdc.gov/bmi/about/index.html" target="_blank" rel="noopener noreferrer">Read the CDC explanation of BMI ↗</a></div>${button('rpg-body-clear', 'Clear avatar measurements')}${history.length ? `<section class="record-measurement-history"><div class="record-section-title"><h3>RECENT AVATAR RECORDS</h3><span>Last ${history.length} saved</span></div><div class="record-history-list">${history.map(entry => `<div><strong>Day ${integer(entry.day, 1, 1)}</strong><span>${entry.heightCm == null || entry.weightKg == null ? 'Measurements cleared' : `${esc(entry.heightCm)} cm · ${esc(entry.weightKg)} kg`}</span><small>BMI ${typeof entry.bmi === 'number' && Number.isFinite(entry.bmi) ? entry.bmi.toFixed(1) : '—'}</small></div>`).join('')}</div></section>` : ''}`;
    show(editingTraits ? 'Choose your strengths.' : 'Your fictional cadet.', editingTraits ? 'STARTER TRAITS' : 'AVATAR WELLBEING RECORD', `<section class="character-record record-rpg-editor">${content}<p id="rpg-profile-message" class="wardrobe-save-message" role="status" aria-live="polite">${!state().initialized ? 'Connect your cadet at the Academic Office before saving.' : editingTraits && locked() ? 'Your saved starter traits are active for this journey.' : editingTraits ? 'Choose exactly two different traits, then save your selection.' : 'The BMI preview updates as you type. Save to update your avatar record.'}</p><div class="wardrobe-actions">${button('rpg-profile-back', 'Back to my record')}<button type="button" class="record-button primary" id="rpg-profile-save" ${!state().initialized || (editingTraits && locked()) ? 'disabled' : ''}>${editingTraits ? 'Save starter traits' : 'Save avatar measurements'}</button></div></section>`, 'character-rpg-profile');
    activeDraft = draft; saving = false;
    const setMessage = message => { const element = select('#rpg-profile-message'); if (element) element.textContent = message; };
    const updateBMI = () => {
      const preview = select('#rpg-bmi-preview'); if (!preview) return;
      const height = Number(draft.heightCm), weight = Number(draft.weightKg);
      const valid = draft.heightCm !== '' && draft.weightKg !== '' && Number.isFinite(height) && Number.isFinite(weight) && height >= 90 && height <= 250 && weight >= 20 && weight <= 300;
      preview.textContent = valid ? (weight / ((height / 100) ** 2)).toFixed(1) : '—';
    };
    const updateTraits = () => {
      if (activeDraft !== draft || saving) return;
      select('#rpg-trait-count').textContent = `${draft.traits.length} / 2 selected`;
      selectAll('[data-rpg-trait]').forEach(element => {
        const chosen = draft.traits.includes(element.dataset.rpgTrait);
        element.setAttribute('aria-pressed', String(chosen)); element.disabled = locked();
        element.querySelector('.record-trait-choice-mark').textContent = chosen ? '✓' : '+';
      });
    };
    selectAll('[data-rpg-trait]').forEach(element => element.onclick = () => {
      if (saving || activeDraft !== draft || locked() || !traitIds.has(element.dataset.rpgTrait)) return;
      const id = element.dataset.rpgTrait;
      if (draft.traits.includes(id)) draft.traits = draft.traits.filter(item => item !== id);
      else if (draft.traits.length < 2) draft.traits.push(id);
      else { setMessage('Two traits are selected. Deselect one before choosing another.'); return; }
      updateTraits(); setMessage(`${draft.traits.length} of 2 traits selected. ${draft.traits.length === 2 ? 'Ready to save.' : 'Choose two different traits to continue.'}`);
    });
    for (const [id, key] of [['rpg-height', 'heightCm'], ['rpg-weight', 'weightKg']]) {
      const input = select(`#${id}`);
      if (input) input.oninput = () => { if (saving || activeDraft !== draft) return; draft[key] = input.value.trim(); updateBMI(); };
    }
    if (!editingTraits) updateBMI();
    attach('rpg-body-clear', () => {
      if (saving || activeDraft !== draft) return;
      draft.heightCm = ''; draft.weightKg = '';
      select('#rpg-height').value = ''; select('#rpg-weight').value = ''; updateBMI();
      setMessage('Avatar measurements and their saved history will be removed when you save.');
    });
    attach('rpg-profile-back', openDashboard);
    attach('rpg-profile-save', async () => {
      if (saving || activeDraft !== draft || !state().initialized || (editingTraits && locked())) return;
      let payload;
      if (editingTraits) {
        if (draft.traits.length !== 2 || new Set(draft.traits).size !== 2 || draft.traits.some(id => !traitIds.has(id))) { setMessage('Choose exactly two different traits before saving.'); return; }
        payload = { traits: [...draft.traits] };
      } else {
        const emptyHeight = String(draft.heightCm).trim() === '', emptyWeight = String(draft.weightKg).trim() === '';
        const height = Number(draft.heightCm), weight = Number(draft.weightKg);
        if (emptyHeight && emptyWeight) payload = { heightCm: null, weightKg: null };
        else if (emptyHeight || emptyWeight || !Number.isFinite(height) || !Number.isFinite(weight) || height < 90 || height > 250 || weight < 20 || weight > 300) {
          setMessage('Enter both avatar measurements: height 90–250 cm and weight 20–300 kg, or leave both blank.'); return;
        } else payload = { heightCm: Math.round(height * 10) / 10, weightKg: Math.round(weight * 10) / 10 };
      }
      const revision = viewRevision, saveButton = select('#rpg-profile-save');
      saving = true; saveButton.disabled = true; saveButton.textContent = 'Saving your RPG record…';
      selectAll('[data-rpg-trait], #rpg-height, #rpg-weight, #rpg-body-clear').forEach(element => element.disabled = true);
      setMessage('Saving to your cadet record…');
      try {
        const response = await bridge.rpgProfile?.(payload);
        if (revision !== viewRevision || activeDraft !== draft) return;
        if (!response) { setMessage('Your RPG record was not saved. Your changes are still here; please try again.'); return; }
        const confirmed = response.state?.rpg;
        const matches = editingTraits ? Array.isArray(confirmed?.traits?.selected) && confirmed.traits.selected.length === payload.traits.length && payload.traits.every(id => confirmed.traits.selected.includes(id))
          : confirmed?.body && confirmed.body.heightCm === payload.heightCm && confirmed.body.weightKg === payload.weightKg;
        if (!matches) { setMessage('The saved RPG record did not confirm your changes. Please review and try again.'); return; }
        bridge.toast?.(editingTraits ? 'Your two starter traits are saved.' : payload.heightCm == null ? 'Avatar measurements and history cleared.' : 'Your avatar measurements are saved.');
        saving = false; openDashboard();
      } catch (error) {
        if (revision === viewRevision && activeDraft === draft) setMessage(error?.message || 'Your RPG record could not be saved. Please try again.');
      } finally {
        if (revision === viewRevision && activeDraft === draft) {
          saving = false;
          selectAll('[data-rpg-trait]').forEach(element => element.disabled = locked());
          selectAll('#rpg-height, #rpg-weight, #rpg-body-clear').forEach(element => element.disabled = false);
          if (saveButton.isConnected) { saveButton.disabled = editingTraits && locked(); saveButton.textContent = editingTraits ? 'Save starter traits' : 'Save avatar measurements'; }
        }
      }
    });
  }
  function openDashboard() {
    const s = state(), p = profile(), displayed = displayCharacter(p, zone()), summary = getCharacterSummary(s), orientation = summary.orientation;
    const clearance = s.npc?.seaTraining?.status === 'approved';
    const outfitNote = displayed.outfit === 'casual' ? `White short-sleeved shirt · navy blue shorts. Your ${outfitNames[p.outfit].toLowerCase()} returns on campus.`
      : `${outfitDescription(p.outfit, p)}. Workshop: one-piece workshop suit. Lifeboat: immersion suit.`;
    const weeklyRemaining = integer(s.week?.remaining, 0, 0, 5), weeklyKnown = Boolean(s.week);
    const resetTime = s.week?.resetsAt && Number.isFinite(Date.parse(s.week.resetsAt)) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s.week.resetsAt)) : 'Monday, 00:00';
    show(p.name || 'Your cadet', summary.hasRPG ? 'YOUR RPG CADET RECORD' : 'SEAFARER’S RECORD BOOK', `<section class="character-record"><p class="record-subtitle">AMCOL · ${esc(p.origin || 'Your seafaring journey')} · ${p.gender === 'female' ? 'Female' : 'Male'} character</p><div class="record-identity"><div class="record-portrait">${portrait(displayed)}<span>LV ${summary.level}</span></div><div class="record-stat-grid"><div><small>RANK</small><strong>${esc(summary.rank)}</strong></div><div><small>CALENDAR</small><strong>Year ${summary.year} · Sem ${summary.term} · Day ${summary.day}</strong></div><div><small>GAME XP</small><strong>${summary.totalXP.toLocaleString('en-GB')} <span>total</span></strong></div><div><small>NEXT LEVEL</small><strong>${summary.progressToNextLevel} / ${summary.xpForNextLevel} <span>XP</span></strong></div></div></div><div class="record-level-line"><div class="record-track" role="progressbar" aria-label="Progress to next game level" aria-valuemin="0" aria-valuemax="${summary.xpForNextLevel}" aria-valuenow="${summary.progressToNextLevel}"><i style="width:${summary.levelPercent}%"></i></div><span>${summary.xpToNextLevel} XP to level ${summary.level + 1}</span></div><p class="record-note">${summary.hasRPG ? 'First completions, introductions, daily exercise and care build your character XP. Each reward is recorded once; practice replays keep your existing rewards.' : '10 game XP per completed book, staff, safety, or Loma final mini-game. Replays and introductions do not add XP.'}</p>${rpgMarkup(s)}${majorMarkup(p)}<div class="record-course-counters"><div><strong>${summary.semesterCompleted}<span> / ${summary.semesterRequired}</span></strong><small>This semester’s book missions</small></div><div><strong>${summary.bookCompleted}<span> / ${summary.bookTotal}</span></strong><small>All book missions</small></div><div><strong>${summary.staffCompleted}<span> / ${summary.staffTotal}</span></strong><small>Staff mission sign-offs</small></div><div><strong>${summary.safetyCompleted}<span> / ${summary.safetyTotal}</span></strong><small>Lifeboat safety games</small></div></div><section class="record-orientation ${orientation.completed ? 'done' : ''}"><div><small>${orientation.completed ? 'FIRST MISSION COMPLETE' : 'YOUR FIRST MISSION'}</small><h3>${orientation.completed ? 'You know your college team.' : 'Meet every member of staff.'}</h3><p>${orientation.completed ? 'Every introduction is recorded. Your teachers can now help you with the course.' : 'Talk to each staff member and learn their role before beginning your learning missions.'}</p></div><div class="record-orientation-action"><strong>${orientation.completedCount} / ${orientation.total}</strong>${button('record-orientation', orientation.completed ? 'View introductions' : 'Follow first-day mission', !orientation.completed)}</div></section>${lomaMarkup(summary)}<section aria-labelledby="record-course-title"><div class="record-section-title"><h3 id="record-course-title">COURSE PROGRESS BY AREA</h3><span>Completed missions</span></div><div class="record-area-list">${summary.areas.map(area => `<div class="record-area" data-record-area="${area.id}"><div><strong>${esc(area.label)}</strong><span>${area.completed} / ${area.total}</span></div><div class="record-track" role="progressbar" aria-label="${esc(area.label)} mission completion" aria-valuemin="0" aria-valuemax="${area.total}" aria-valuenow="${area.completed}"><i style="width:${area.percent}%"></i></div><small>${esc(area.sourceLabel)}</small></div>`).join('')}</div><p class="record-note">These areas overlap. The bars show course completion, not a professional skill grade.</p></section><div class="record-life-grid"><section class="record-life-card"><span class="record-life-icon">${icon('bolt')}</span><div><small>FITNESS · TODAY</small><strong>${summary.fitness.completed ? `${esc(summary.fitness.label)} completed` : 'One activity to complete'}</strong><p>${summary.fitness.completed ? 'Today’s exercise is recorded. Sleep when a reset is available.' : 'Choose PT, running, or football at the dormitory before sleep.'}</p>${button('record-dorm', summary.fitness.completed ? 'Go to the dormitory' : 'Choose my exercise')}</div></section><section class="record-life-card"><span class="record-life-icon">${icon('home')}</span><div><small>REAL-WEEK ALLOWANCE</small><strong>${weeklyKnown ? `${weeklyRemaining} / 5 day resets left` : 'Connect to view resets'}</strong><p>Refreshes ${esc(resetTime)} · Thailand time.</p><span class="record-soft-tag">Sleep starts the next game day</span></div></section></div><section aria-labelledby="record-scores-title"><div class="record-section-title"><h3 id="record-scores-title">BEST SAVED EXACT SCORES</h3><span>Learning games</span></div><div class="record-score-list">${summary.bestScores.map(score => `<div class="record-score-row"><div><strong>${esc(score.label)}</strong><small>${score.percent === null ? score.selfReviewed ? `${score.selfReviewed} self-reviewed submission${score.selfReviewed === 1 ? '' : 's'} · no exact score` : 'No exact-answer attempt saved' : `${score.correct} / ${score.total} exact answers · ${esc(score.missionTitle)}`}</small></div><span class="${score.percent === null ? 'unplayed' : ''}">${score.percent === null ? '—' : `${score.percent}%`}</span></div>`).join('')}</div><p class="record-note">Highest exact-answer result currently in your saved record. Unsubmitted practice is excluded.</p><div class="record-reviewed"><strong>${summary.selfReviewedMissions} book missions with self-reviewed work</strong><span>${summary.selfReviewedResponses} written, speaking, reflection, or practical responses completed against a checklist.</span><small>Self-review completion is recorded separately from exact-answer scores.</small></div></section><section class="record-outfit"><div class="record-outfit-icon ${displayed.outfit === 'immersion' ? 'immersion' : ''}">${icon('shirt')}</div><div><small>${zone() === 'dorm' ? 'AUTOMATIC DORM OUTFIT' : 'CURRENT OUTFIT'}</small><h3>${esc(outfitNames[displayed.outfit])}</h3><p>${esc(outfitNote)}</p></div>${button('record-wardrobe', 'Open wardrobe', true)}</section>${clearance ? '<div class="record-clearance"><span>✓</span><div><strong>Sea-training clearance recorded</strong><p>Tr. Dream has approved your Year 2 readiness review in the game.</p></div></div>' : ''}<nav class="record-navigation" aria-label="Character record navigation">${button('record-office', 'Academic Office')}${button('record-staff', 'Staff & missions')}${button('record-atlantic', 'Atlantic rooms')}${button('record-lifeboat', 'Lifeboat safety')}${button('record-close', 'Back to campus')}</nav></section>`, 'character-record');
    attach('record-atlantic', () => bridge.goLocation?.('atlantic')); attach('record-orientation', () => bridge.openOrientation?.()); attach('record-wardrobe', () => openWardrobe());
    attach('record-office', () => bridge.openOffice?.()); attach('record-staff', () => bridge.openStaff?.());
    attach('record-lifeboat', () => bridge.goLocation?.('lifeboat'));
    attach('record-major', () => openWardrobe());
    attach('record-rpg-traits', () => openRPGProfile({ mode: 'traits' }));
    attach('record-rpg-body', () => openRPGProfile({ mode: 'body' }));
    selectAll('[data-rpg-care-location]').forEach(element => element.onclick = () => {
      const location = element.dataset.rpgCareLocation;
      if (!['cafe', 'garden', 'dorm'].includes(location)) return;
      if (typeof bridge.openNeeds === 'function') bridge.openNeeds(location); else bridge.goLocation?.(location);
    });
    attach('record-loma', () => typeof bridge.openLoma === 'function' ? bridge.openLoma() : bridge.goLocation?.('loma-lounge'));
    attach('record-dorm', () => bridge.goLocation?.('dorm')); attach('record-close', () => bridge.closeDialog?.());
  }
  function openWardrobe(options = {}) {
    if (!options || typeof options !== 'object' || 'target' in options) options = {};
    const requiredOutfit = ['coverall', 'immersion'].includes(options.requiredOutfit) ? options.requiredOutfit : options.requireImmersion === true ? 'immersion' : null;
    const draft = { ...profile() };
    if (requiredOutfit) draft.outfit = requiredOutfit;
    renderWardrobe(draft, { ...options, requiredOutfit });
  }
  function outfitDescription(key, draft) {
    const cut = draft.gender === 'female' ? 'fitted skirt' : 'pants';
    if (key === 'cadet') return `Plain white long sleeves · black ${cut}`;
    if (key === 'immersion') return 'Orange suit, hood, gloves & boots · lifeboat safety games';
    if (key === 'coverall') return 'Blue one-piece suit · workshop mini-games';
    if (key === 'maritime-white') return `White officer shirt · epaulettes & black tie · black ${cut}`;
    if (key === 'maritime') return `Navy professional jacket · black ${cut}`;
    return 'White short-sleeved shirt · navy blue shorts';
  }
  function uniformCutNote(draft) {
    return draft.gender === 'female' ? 'Female campus and maritime uniforms have a fitted, knee-length black skirt.' : 'Male campus and maritime uniforms have black pants.';
  }
  function renderWardrobe(draft, options) {
    const required = options.requiredOutfit, requiring = Boolean(required), place = required === 'coverall' ? 'workshop' : 'lifeboat';
    const majorLocked = () => state().loma?.majorLocked === true;
    const majorNote = () => `${majorFocus[draft.major]}. ${majorLocked() ? 'Your major is fixed because your Loma final has been drawn.' : 'You may change your major until you draw the Loma final.'}`;
    const requirement = requiring ? `<div class="wardrobe-requirement"><strong>${esc(outfitNames[required])} required</strong><p>${required === 'coverall' ? 'Equip the one-piece workshop suit before entering the workshop and starting its mini-games.' : 'Equip the immersion suit before starting the lifeboat safety mini-games.'}</p></div>` : '';
    show('Your cadet. Your look.', requiring ? `${place.toUpperCase()} CHANGING AREA` : 'CHARACTER WARDROBE', `<section class="character-wardrobe">${requirement}<div class="wardrobe-layout"><div class="wardrobe-preview"><div id="wardrobe-portrait">${portrait(draft, true)}</div><span class="wardrobe-preview-label" id="wardrobe-preview-label">${esc(outfitNames[draft.outfit])}</span><small>${zone() === 'dorm' ? 'Campus preview · dorm clothes stay casual' : 'Preview · save to wear this outfit'}</small></div><div class="wardrobe-controls"><fieldset><legend>Your major</legend><div class="wardrobe-segmented"><button type="button" data-record-major="deck" aria-pressed="${draft.major === 'deck'}" ${majorLocked() ? 'disabled' : ''}>DECK</button><button type="button" data-record-major="engine" aria-pressed="${draft.major === 'engine'}" ${majorLocked() ? 'disabled' : ''}>ENGINE</button></div><p class="wardrobe-field-note" id="wardrobe-major-note">${esc(majorNote())}</p></fieldset><fieldset><legend>Character gender</legend><div class="wardrobe-segmented"><button type="button" data-record-gender="male" aria-pressed="${draft.gender === 'male'}">Male</button><button type="button" data-record-gender="female" aria-pressed="${draft.gender === 'female'}">Female</button></div><p class="wardrobe-field-note" id="wardrobe-bottom-note">${uniformCutNote(draft)}</p></fieldset><fieldset><legend>Choose an outfit</legend><div class="wardrobe-outfits">${validOutfits.map(key => `<button type="button" data-record-outfit="${key}" aria-pressed="${draft.outfit === key}" ${requiring && key !== required ? `disabled title="The ${place} requires the ${outfitNames[required].toLowerCase()}."` : ''}><span class="wardrobe-outfit-swatch ${key}" aria-hidden="true">${icon(key === 'immersion' ? 'life-ring' : 'shirt')}</span><span><strong>${esc(outfitNames[key])}</strong><small>${esc(outfitDescription(key, draft))}</small></span><span class="wardrobe-selected-mark" aria-hidden="true">${draft.outfit === key ? '✓' : ''}</span></button>`).join('')}</div></fieldset><aside class="wardrobe-dorm-rule"><strong>Automatic dormitory outfit</strong><p>At the dormitory, everyone wears a white short-sleeved shirt and navy blue shorts. Your selected campus or training outfit returns when you leave the dormitory.</p></aside></div></div><p class="wardrobe-save-message" id="wardrobe-save-message" role="status" aria-live="polite">${state().initialized ? 'Your name, progress, and weekly resets stay with this character.' : 'Connect your cadet at the Academic Office before saving your outfit.'}</p><div class="wardrobe-actions">${button('wardrobe-back', 'Back to my record')}${!requiring ? button('wardrobe-edit', 'Edit name & appearance') : ''}<button type="button" class="record-button primary" id="wardrobe-save" ${!state().initialized ? 'disabled' : ''}>${requiring ? 'Equip suit & continue' : 'Save character & outfit'}</button></div></section>`, 'character-wardrobe');
    activeDraft = draft; saving = false;
    const updatePreview = () => {
      if (activeDraft !== draft || saving) return;
      draft.uniformBottom = draft.gender === 'female' ? 'skirt' : 'pants';
      if (majorLocked()) draft.major = profile().major;
      select('#wardrobe-portrait').innerHTML = portrait(draft, true);
      select('#wardrobe-preview-label').textContent = outfitNames[draft.outfit];
      selectAll('[data-record-gender]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.recordGender === draft.gender)));
      selectAll('[data-record-major]').forEach(element => { element.setAttribute('aria-pressed', String(element.dataset.recordMajor === draft.major)); element.disabled = majorLocked(); });
      selectAll('[data-record-outfit]').forEach(element => { const selected = element.dataset.recordOutfit === draft.outfit; element.setAttribute('aria-pressed', String(selected)); element.querySelector('.wardrobe-selected-mark').textContent = selected ? '✓' : ''; element.querySelector('small').textContent = outfitDescription(element.dataset.recordOutfit, draft); });
      select('#wardrobe-bottom-note').textContent = uniformCutNote(draft);
      select('#wardrobe-major-note').textContent = majorNote();
    };
    selectAll('[data-record-gender]').forEach(element => element.onclick = () => { if (saving || activeDraft !== draft) return; draft.gender = element.dataset.recordGender; updatePreview(); });
    selectAll('[data-record-major]').forEach(element => element.onclick = () => { if (saving || activeDraft !== draft || element.disabled || majorLocked()) return; draft.major = element.dataset.recordMajor; updatePreview(); });
    selectAll('[data-record-outfit]').forEach(element => element.onclick = () => { if (saving || activeDraft !== draft || element.disabled) return; draft.outfit = element.dataset.recordOutfit; updatePreview(); });
    attach('wardrobe-back', openDashboard); attach('wardrobe-edit', () => bridge.editCadet?.());
    attach('wardrobe-save', async () => {
      if (saving || activeDraft !== draft || !state().initialized) return;
      if (requiring && draft.outfit !== required) return;
      if (majorLocked()) { draft.major = profile().major; updatePreview(); }
      const revision = viewRevision, saveButton = select('#wardrobe-save');
      const updatedProfile = normalizeCharacter({ ...(bridge.getCharacter?.() || {}), ...(state().profile || {}), gender: draft.gender,
        uniformBottom: draft.gender === 'female' ? 'skirt' : 'pants', outfit: draft.outfit, major: draft.major });
      saving = true; saveButton.disabled = true; saveButton.textContent = 'Saving your character…';
      selectAll('[data-record-gender], [data-record-major], [data-record-outfit]').forEach(element => element.disabled = true);
      try {
        const response = await bridge.updateProfile(updatedProfile);
        if (revision !== viewRevision || activeDraft !== draft) return;
        if (!response) { select('#wardrobe-save-message').textContent = 'Your character was not saved. Please try again.'; return; }
        const savedProfile = response.state?.profile;
        if (!savedProfile || ['outfit', 'gender', 'uniformBottom', 'major'].some(key => savedProfile[key] !== updatedProfile[key])) {
          select('#wardrobe-save-message').textContent = requiring ? `The ${outfitNames[required].toLowerCase()} and character changes were not confirmed. Please try saving again.` : 'Your character changes were not confirmed. Please try saving again.';
          return;
        }
        bridge.toast?.(requiring ? `${outfitNames[required]} equipped. You are ready for the ${place}.` : 'Your character and outfit are saved.');
        saving = false;
        if (typeof options.returnTo === 'function') options.returnTo(); else openDashboard();
      } catch (error) {
        if (revision === viewRevision && activeDraft === draft) select('#wardrobe-save-message').textContent = error?.message || 'Your character could not be saved. Please try again.';
      } finally {
        if (revision === viewRevision && activeDraft === draft) {
          saving = false;
          selectAll('[data-record-gender]').forEach(element => element.disabled = false);
          selectAll('[data-record-major]').forEach(element => element.disabled = majorLocked());
          selectAll('[data-record-outfit]').forEach(element => element.disabled = requiring && element.dataset.recordOutfit !== required);
          if (saveButton.isConnected) { saveButton.disabled = false; saveButton.textContent = requiring ? 'Equip suit & continue' : 'Save character & outfit'; }
        }
      }
    });
  }

  return { openDashboard, openWardrobe, openRPGProfile, dispose };
}
