import { NPCS, NPC_MISSIONS, getNPC, getNPCPlace, getNPCMission, getNPCMissions, STAFF_SIGNOFF_IDS, SEA_TRAINING_REVIEW_ID } from './npc-content.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const GAME_TYPES = { order: 'Sentence scramble', number: 'Maths challenge', choice: 'Trivia challenge', mixed: 'Cadet challenge' };
const normal = value => String(value ?? '').toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();
const draftKey = (journey, mission) => `seapath.npc-draft.${journey}.${mission}`;

function tileOrder(question, day) {
  const values = question.tokens.map((_, i) => i);
  let seed = [...`${question.id}:${day}`].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  for (let i = values.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [values[i], values[j]] = [values[j], values[i]]; }
  if (question.answers.some(answer => normal(answer) === normal(values.map(i => question.tokens[i]).join(' ')))) values.push(values.shift());
  return values;
}

function restoreTiles(tokens, answer) {
  const walk = (remaining, used) => {
    if (!remaining) return used;
    for (let i = 0; i < tokens.length; i++) {
      if (used.includes(i)) continue;
      const token = tokens[i].toLowerCase(), text = remaining.toLowerCase();
      if (text === token || text.startsWith(token + ' ')) { const found = walk(remaining.slice(token.length).trimStart(), [...used, i]); if (found) return found; }
    }
    return null;
  };
  return walk(String(answer || '').trim(), []) || [];
}

export function npcPortrait(npc, small = false) {
  const a = npc.appearance || {}, bald = a.bald || a.hairStyle === 'bald', broad = a.body === 'broad';
  const skin = esc(a.skin || '#bd8b65'), hair = esc(a.hairColor || '#282724'), accent = esc(npc.color || '#378e7f');
  const shirt = ['officer', 'labcoat'].includes(a.outfit) ? '#f5f3e8' : a.outfit === 'blazer' ? '#494564' : a.outfit === 'coverall' ? esc(a.accent || '#436c86') : accent;
  return `<span class="npc-portrait${small ? ' small' : ''}" style="--npc-accent:${accent}"><svg viewBox="0 0 100 112" aria-hidden="true"><circle cx="50" cy="51" r="45" fill="${accent}" opacity=".12"/>${a.hairStyle === 'bun' ? `<circle cx="50" cy="23" r="12" fill="${hair}"/>` : ''}${a.hairStyle === 'bob' ? `<path d="M25 49Q23 18 50 17Q79 18 77 53L79 76H22Z" fill="${hair}"/>` : ''}<path d="M${broad ? 9 : 18} 111V94Q${broad ? 11 : 18} 75 37 75H63Q${broad ? 89 : 82} 75 ${broad ? 91 : 82} 94V111Z" fill="${shirt}"/><path d="M41 69H59V81L50 88L41 81Z" fill="${skin}"/><ellipse cx="50" cy="48" rx="${broad ? 25 : 22}" ry="29" fill="${skin}"/>${!bald && a.hairStyle !== 'bob' ? `<path d="M27 45Q21 16 49 16Q78 15 73 46L66 33Q48 38 34 30Z" fill="${hair}"/>` : ''}${a.hairStyle === 'bob' ? `<path d="M27 43Q24 15 50 17Q75 17 74 44L62 28Q48 38 28 37Z" fill="${hair}"/>` : ''}<circle cx="42" cy="49" r="2" fill="#34332f"/><circle cx="59" cy="49" r="2" fill="#34332f"/><path d="M44 62Q51 67 58 62" fill="none" stroke="#78513f" stroke-width="2" stroke-linecap="round"/>${a.accessory === 'glasses' ? '<g fill="none" stroke="#414852" stroke-width="2"><rect x="32" y="43" width="16" height="12" rx="4"/><rect x="53" y="43" width="16" height="12" rx="4"/><path d="M48 47H53"/></g>' : ''}${a.accessory === 'cap' ? `<path d="M25 25Q49 5 76 25L71 31H29Z" fill="#f7f7ef"/><path d="M27 29H74L68 36H32Z" fill="#283d4b"/><circle cx="50" cy="22" r="4" fill="${accent}"/>` : ''}${a.outfit === 'officer' ? `<path d="M23 82L36 77M64 77L78 82" stroke="${accent}" stroke-width="5"/><path d="M47 88H54L57 105L50 111L44 105Z" fill="#243c4a"/>` : ''}${a.outfit === 'labcoat' ? `<path d="M34 78L44 99L50 89L57 99L66 78M50 90V112" fill="none" stroke="#b7c5b7" stroke-width="2"/>` : ''}<rect x="61" y="92" width="11" height="6" rx="1" fill="${a.outfit === 'officer' ? accent : '#f0e8d2'}"/></svg></span>`;
}

export function createStaffUI(bridge) {
  let session = null, viewRevision = 0;
  const state = () => bridge.getState();
  const body = () => $('#dialog-body');
  const result = id => state()?.npc?.results?.[id];
  const completed = id => result(id)?.completed === true;
  const available = id => state()?.npc?.available?.includes(id) === true;
  const button = (id, label, style = 'secondary') => `<button type="button" class="button ${style}" id="${id}">${esc(label)}</button>`;
  const bind = (selector, callback, scope = body()) => $$(selector, scope).forEach(el => el.onclick = () => callback(el));
  function dispose() { viewRevision++; }
  function show(title, kicker, html, key = 'npc') { bridge.show(title, kicker, html, key); viewRevision++; }
  function goNPC(id) { bridge.goLocation(`npc-${id}`); }
  function seaStatus() { return state()?.npc?.seaTraining || { status: 'locked', academicComplete: false, staffCompleted: 0, staffRequired: STAFF_SIGNOFF_IDS.length, missingMissionIds: STAFF_SIGNOFF_IDS }; }
  function readinessMarkup(compact = false) {
    const sea = seaStatus(), approved = sea.status === 'approved', ready = sea.status === 'ready-for-review';
    const heading = approved ? 'Cleared for sea training' : ready ? 'Ready for Tr. Dream’s review' : 'Your Year 2 sea-training checkpoint';
    return `<section class="npc-readiness ${approved ? 'approved' : ''}${compact ? ' compact' : ''}" data-sea-status="${esc(sea.status)}"><div class="npc-readiness-title"><span>${bridge.icon(approved ? 'check' : 'ship')}</span><div><small>TR. DREAM · END OF YEAR 2</small><h3>${heading}</h3></div></div><ul class="npc-checklist"><li class="${sea.academicComplete ? 'done' : ''}"><span>${sea.academicComplete ? '✓' : '1'}</span>Finish all required book mini-games in Years 1–2</li><li class="${sea.staffCompleted >= sea.staffRequired ? 'done' : ''}"><span>${sea.staffCompleted >= sea.staffRequired ? '✓' : '2'}</span>Collect staff sign-offs <strong>${sea.staffCompleted} / ${sea.staffRequired}</strong></li><li class="${approved ? 'done' : ''}"><span>${approved ? '✓' : '3'}</span>Pass Tr. Dream’s six-question readiness review</li></ul>${!compact ? `<p>${approved ? 'Tr. Dream has recorded your sea-training clearance in the game. Your Academic Office can now approve the end of Year 2.' : ready ? 'Your academic record and staff sign-offs are ready. Complete all six questions correctly to receive your clearance.' : 'Complete these requirements before advancing from Year 2 to Year 3. You can work on available staff tasks alongside your book assignments.'}</p>` : ''}</section>`;
  }
  function progressMarkup() {
    const count = NPC_MISSIONS.filter(m => completed(m.id)).length;
    return `<section class="npc-office-summary"><div><small>YOUR COLLEGE MENTORS</small><strong>${count} / ${NPC_MISSIONS.length} staff missions completed</strong><p>Meet your teachers, build your skills, and collect sign-offs for Tr. Dream.</p></div><div class="npc-summary-actions"><button type="button" class="button secondary" data-staff-directory>Staff & tasks</button><button type="button" class="text-button" data-sea-review>Meet Tr. Dream →</button></div></section>${state()?.semester >= 3 || seaStatus().status === 'approved' ? readinessMarkup(true) : ''}`;
  }
  function bindSummary(scope = body()) { bind('[data-staff-directory]', () => openDirectory(), scope); bind('[data-sea-review]', () => goNPC('dream'), scope); }
  function locationMarkup(location, room = null) {
    const staff = NPCS.filter(npc => npc.location === location && (location !== 'atlantic' || npc.zone === 'atlantic') && (!room || npc.room === room));
    if (!staff.length) return '';
    return `<section class="npc-local-staff"><h3 class="section-heading">Meet your ${location === 'dorm-arrival' ? 'dormitory master' : 'teachers'}</h3><div>${staff.map(npc => `<button type="button" class="npc-local-card" data-meet-npc="${npc.id}">${npcPortrait(npc, true)}<span><strong>${esc(npc.name)}</strong><small>${esc(npc.role)}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div></section>`;
  }
  function bindLocations(scope = body()) { bind('[data-meet-npc]', el => goNPC(el.dataset.meetNpc), scope); }
  function missionLabel(mission) {
    if (completed(mission.id)) return 'Sign-off earned';
    if (!state()?.orientation?.completed) return `Complete your ${NPCS.length} introductions first`;
    if (available(mission.id)) return result(mission.id)?.attempts ? 'Continue challenge' : 'Ready to play';
    if (mission.id === SEA_TRAINING_REVIEW_ID) return 'Finish Years 1–2 & staff tasks';
    if (state()?.semester < mission.unlockSemester) return `Opens in Year ${Math.ceil(mission.unlockSemester / 2)}`;
    if (mission.prerequisite && !completed(mission.prerequisite)) return 'Complete the first mission';
    return 'Sleep to begin the semester';
  }
  function openDirectory() {
    if (bridge.needInit()) return;
    const sea = seaStatus();
    show('The people behind your journey.','AMCOL · STAFF & CADET TASKS', `<p class="dialog-copy">Meet all ${NPCS.length} staff members across the campus, Atlantic Building rooms, and dormitory. Start by acknowledging every introduction. Eight mentors provide your required sign-offs; Tr. Dream leads the Year 2 sea-training review. Chief Engineer Asawin and Engineer Gerald offer optional Engine Simulator challenges. Tr. Amara leads the optional Workshop challenges. Tr. Bank offers radio mini-games in GMDSS, and Tr. Duke offers chart and route mini-games in ECDIS.</p><div class="npc-directory">${NPCS.map(npc => {
      const missions = getNPCMissions(npc.id), count = missions.filter(m => completed(m.id)).length, ready = missions.filter(m => available(m.id) && !completed(m.id)).length;
      return `<article class="npc-staff-card" style="--npc-accent:${npc.color}"><div class="npc-card-profile">${npcPortrait(npc)}<div><small>${esc(getNPCPlace(npc))}</small><h3>${esc(npc.name)}</h3><p>${esc(npc.role)}</p></div></div><span class="npc-intro-card-status">${state()?.orientation?.visitedIds?.includes(npc.id) ? '✓ Introduction complete' : '○ Introduction to complete'}</span><div class="npc-card-progress"><span>${count === missions.length ? '✓ All sign-offs earned' : `${count} / ${missions.length} ${npc.id === 'dream' ? 'review' : 'missions'} complete`}</span><strong>${!state()?.orientation?.completed ? 'Orientation first' : ready ? `${ready} available` : npc.id === 'dream' && sea.status !== 'approved' ? 'Year 2 checkpoint' : ''}</strong></div><ul>${missions.map(m => `<li class="${completed(m.id) ? 'complete' : ''}"><span>${completed(m.id) ? '✓' : available(m.id) ? '○' : '◇'}</span><div><strong>${esc(m.title)}</strong><small>${esc(missionLabel(m))}</small></div></li>`).join('')}</ul><button type="button" class="button secondary" data-meet-npc="${npc.id}">Meet ${esc(npc.name)} <span aria-hidden="true">↗</span></button></article>`;
    }).join('')}</div>${readinessMarkup()}<p class="academy-note">Staff tasks are additional challenges alongside your book course. Available staff missions can be completed during the same game day. Their sign-offs are saved to your academy account.</p><div class="dialog-actions">${button('staff-office','Academic Office')}${button('staff-close','Back to campus','primary')}</div>`, 'staff-directory');
    bindLocations(); $('#staff-office').onclick = bridge.openOffice; $('#staff-close').onclick = bridge.closeDialog;
  }
  function openNPC(id) {
    if (bridge.needInit()) return;
    const npc = getNPC(id); if (!npc) return;
    const missions = getNPCMissions(id), o = state()?.orientation;
    const met = o?.visitedIds?.includes(id) === true, oriented = o?.completed === true;
    const next = getNPC(o?.nextNpcId);
    const intro = `<section class="npc-role-intro"><small>GET TO KNOW YOUR AMCOL TEAM</small><h3>“Here’s how I can help you, cadet.”</h3><p>${esc(npc.roleIntro || npc.greeting)}</p><span class="npc-introduction-status" role="status">${met ? '✓ Your introduction is saved' : `First mission · ${o?.completedCount || 0} / ${o?.total || NPCS.length} introductions complete`}</span><div class="dialog-actions">${!met ? button('npc-introduce', 'Thanks, I understand your role', 'primary') : !oriented && next ? button('npc-next-introduction', `Next: ${next.name}`, 'primary') : ''}${button('npc-orientation', oriented ? 'View orientation record' : 'My orientation checklist')}</div></section>`;
    show(npc.name, `${getNPCPlace(npc).toUpperCase()} · ${oriented ? 'YOUR COLLEGE MENTOR' : 'FIRST MISSION · INTRODUCTION'}`, `<div class="npc-conversation" style="--npc-accent:${npc.color}">${npcPortrait(npc)}<div><small>${esc(npc.role)}</small><blockquote>“${esc(npc.greeting)}”</blockquote></div></div>${intro}${!oriented ? `<p class="npc-orientation-lock">Meet all ${NPCS.length} staff members before starting learning missions. Your introductions, existing grades, and weekly day resets are saved separately.</p>` : ''}${id === 'dream' ? readinessMarkup() : ''}<h3 class="section-heading">${id === 'dream' ? 'Your readiness assessment' : 'Your tasks with ' + esc(npc.name)}</h3>${id === 'amara' ? '<p class="academy-note">Change into your one-piece workshop suit at the locker beside the workshop before either challenge. These two workshop missions are optional extras; Tr. Dream’s sixteen required staff sign-offs stay the same.</p>' : ['asawin', 'gerald'].includes(id) ? '<p class="academy-note">Meet your instructors inside the Atlantic Building’s Engine Simulator. These optional simulator challenges accept your campus uniform. The Workshop is led by Tr. Amara and requires its separate one-piece suit.</p>' : ''}<div class="npc-mission-list">${missions.map(m => `<article class="npc-mission-card ${completed(m.id) ? 'complete' : ''}"><div class="npc-mission-number">${completed(m.id) ? '✓' : m.unlockSemester === 1 ? '01' : m.unlockSemester === 3 ? '02' : 'Y2'}</div><div><small>${m.id === SEA_TRAINING_REVIEW_ID ? 'END OF YEAR 2' : `YEAR ${Math.ceil(m.unlockSemester / 2)} · ${GAME_TYPES[m.type].toUpperCase()}`}</small><h3>${esc(m.title)}</h3><p>${esc(m.instructions)}</p><span>${m.questions.length} questions · ${esc(missionLabel(m))}</span></div><button type="button" class="button ${oriented && available(m.id) && !completed(m.id) ? 'primary' : 'secondary'}" data-npc-mission="${m.id}" ${!completed(m.id) && (!oriented || !available(m.id)) ? 'disabled' : ''}>${completed(m.id) ? 'View sign-off' : !oriented ? 'After orientation' : result(m.id)?.attempts ? 'Continue' : 'Start mission'}</button></article>`).join('')}</div>${id === 'dream' && seaStatus().status !== 'approved' ? '<p class="academy-note">This review unlocks once all four semesters in Years 1–2 and all 16 required staff missions are complete. You do not need to enter Year 3 to take it.</p>' : ''}<div class="dialog-actions">${id === 'amara' ? button('npc-changing', 'Go to changing area') : ''}${button('npc-directory','All staff & tasks')}${button('npc-office','Academic Office')}${id === 'yak' ? button('npc-dorm','Exercise & rest','primary') : button('npc-leave', npc.zone === 'atlantic' ? 'Back to the room' : 'Back outside','primary')}</div>`, 'npc-conversation');
    const revision = viewRevision;
    if ($('#npc-introduce')) $('#npc-introduce').onclick = async () => {
      const control = $('#npc-introduce'); if (control.disabled) return;
      control.disabled = true; control.textContent = 'Saving introduction…';
      const saved = await bridge.run(() => bridge.getAPI().introduceNPC(id));
      if (revision !== viewRevision) return;
      if (saved) {
        bridge.toast(`Introduction saved: ${npc.name}.`);
        if (state()?.orientation?.completed) { bridge.playTone?.('success'); bridge.openOrientation(); }
        else openNPC(id);
      } else if (control.isConnected) { control.disabled = false; control.textContent = 'Thanks, I understand your role'; }
    };
    if ($('#npc-next-introduction')) $('#npc-next-introduction').onclick = () => goNPC(next.id);
    $('#npc-orientation').onclick = bridge.openOrientation;
    if ($('#npc-changing')) $('#npc-changing').onclick = () => bridge.goLocation('workshop-changing');
    bind('[data-npc-mission]', el => completed(el.dataset.npcMission) ? openRecord(el.dataset.npcMission) : openMission(el.dataset.npcMission));
    $('#npc-directory').onclick = openDirectory; $('#npc-office').onclick = bridge.openOffice;
    if ($('#npc-dorm')) $('#npc-dorm').onclick = bridge.openDorm; if ($('#npc-leave')) $('#npc-leave').onclick = bridge.closeDialog;
  }
  function saveDraft() {
    if (!session || session.practice) return;
    try { localStorage.setItem(draftKey(state()?.journeyId, session.mission.id), JSON.stringify({ answers: session.answers, orders: session.orders, index: session.index })); } catch { /* Input remains available in this session. */ }
  }
  function openMission(id, practice = false) {
    const mission = getNPCMission(id); if (!mission || bridge.needInit()) return;
    if (!available(id) && !completed(id)) { bridge.toast(missionLabel(mission)); openNPC(mission.npcId); return; }
    if (completed(id) && !practice) { openRecord(id); return; }
    if (!state()?.orientation?.completed) { bridge.openOrientation?.(); return; }
    if (bridge.canStartLearning && !bridge.canStartLearning()) return;
    if (getNPC(mission.npcId)?.location === 'workshop' && bridge.ensureWorkshop && !bridge.ensureWorkshop(() => openMission(id, practice))) return;
    let draft = {};
    if (!practice) { try { draft = JSON.parse(localStorage.getItem(draftKey(state().journeyId, id)) || 'null') || {}; } catch {} }
    const answers = {}, orders = {}, saved = !practice ? result(id)?.answers || {} : {};
    for (const q of mission.questions) {
      const value = draft.answers?.[q.id] ?? saved[q.id]; answers[q.id] = typeof value === 'string' ? value.slice(0, 1000) : '';
      if (q.type === 'order') { const indexes = draft.orders?.[q.id]; orders[q.id] = Array.isArray(indexes) && indexes.every(i => Number.isInteger(i) && i >= 0 && i < q.tokens.length) && new Set(indexes).size === indexes.length ? indexes : restoreTiles(q.tokens, answers[q.id]); answers[q.id] = orders[q.id].map(i => q.tokens[i]).join(' '); }
    }
    session = { mission, npc: getNPC(mission.npcId), answers, orders, practice, index: Number.isInteger(draft.index) ? Math.max(0, Math.min(mission.questions.length - 1, draft.index)) : 0, feedback: null, submitting: false };
    renderQuestion();
  }
  function renderQuestion() {
    const t = session; if (!t) return;
    const q = t.mission.questions[t.index], value = t.answers[q.id] || '', feedback = t.feedback?.items?.find(item => item.questionId === q.id);
    let field;
    if (q.type === 'order') {
      field = `<p class="npc-field-hint">Tap the tiles in the right order. Tap a chosen tile to remove it.</p><div id="npc-order-picked" class="npc-order-picked" aria-label="Your ordered answer"></div><p id="npc-order-spoken" class="npc-sr-only" aria-live="polite"></p><div id="npc-order-bank" class="npc-order-bank">${tileOrder(q, state()?.day).map(i => `<button type="button" data-npc-tile="${i}">${esc(q.tokens[i])}</button>`).join('')}</div><button type="button" class="text-button" id="npc-order-clear">Clear answer</button>`;
    } else if (q.type === 'number') {
      field = `<label class="npc-number-label" for="npc-number-answer">Your answer <span>Enter a number</span></label><input id="npc-number-answer" class="npc-number-answer" type="text" inputmode="decimal" autocomplete="off" maxlength="40" value="${esc(value)}" placeholder="?">`;
    } else {
      field = `<div class="npc-choice-list" role="group" aria-labelledby="npc-question-title">${q.options.map((option, i) => `<button type="button" data-npc-choice="${i}" aria-pressed="${value === option}" class="${value === option ? 'selected' : ''}"><span>${String.fromCharCode(65 + i)}</span>${esc(option)}</button>`).join('')}</div>`;
    }
    show(t.mission.title, `${t.npc.name.toUpperCase()} · ${GAME_TYPES[q.type].toUpperCase()}`, `<div class="npc-game-top">${npcPortrait(t.npc, true)}<div><strong>${esc(t.npc.name)}</strong><span>${t.practice ? 'Practice · sign-off stays saved' : 'Staff sign-off challenge'}</span></div><span class="academy-pill">${t.index + 1} / ${t.mission.questions.length}</span></div><div class="npc-game-track"><i style="width:${(t.index + 1) / t.mission.questions.length * 100}%"></i></div><section class="npc-question"><small>QUESTION ${t.index + 1}</small><h3 id="npc-question-title">${esc(q.prompt)}</h3>${field}${feedback ? `<div class="npc-feedback ${feedback.passed || feedback.status === 'correct' ? 'correct' : ''}" role="status"><strong>${feedback.passed || feedback.status === 'correct' ? 'Correct' : 'Let’s try this one again'}</strong><p>${esc(feedback.explanation || q.explanation || feedback.message)}</p></div>` : ''}</section><div class="npc-game-nav">${button('npc-question-prev','Previous')}${button('npc-save-exit',t.practice ? 'Leave practice' : 'Save draft & leave')}${button('npc-question-next',t.index === t.mission.questions.length - 1 ? t.practice ? 'Check practice' : 'Submit mission' : 'Next question','primary')}</div><div class="npc-question-dots" aria-label="Question navigation">${t.mission.questions.map((item, i) => `<button type="button" data-npc-question="${i}" class="${i === t.index ? 'active' : t.answers[item.id] ? 'answered' : ''}" aria-label="Question ${i + 1}${t.answers[item.id] ? ', answered' : ''}" ${i === t.index ? 'aria-current="step"' : ''}>${i + 1}</button>`).join('')}</div><p class="academy-note">${t.practice ? 'Practice is available any time after earning this sign-off.' : 'Answer every question correctly to earn the sign-off. You can retry during the same day.'}</p>`, 'npc-game');
    $('#npc-question-prev').disabled = t.index === 0;
    $('#npc-question-prev').onclick = () => { t.index--; saveDraft(); renderQuestion(); };
    $('#npc-save-exit').onclick = () => { saveDraft(); openNPC(t.npc.id); };
    $('#npc-question-next').onclick = () => {
      if (!t.answers[q.id]?.trim() || q.type === 'order' && t.orders[q.id].length !== q.tokens.length) { bridge.toast(q.type === 'order' ? 'Use every tile before continuing.' : 'Choose or enter an answer first.'); return; }
      if (t.index < t.mission.questions.length - 1) { t.index++; saveDraft(); renderQuestion(); } else submit();
    };
    bind('[data-npc-question]', el => { t.index = Number(el.dataset.npcQuestion); saveDraft(); renderQuestion(); });
    if (q.type === 'number') { $('#npc-number-answer').oninput = event => { t.answers[q.id] = event.target.value; saveDraft(); }; $('#npc-number-answer').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); $('#npc-question-next').click(); } }; }
    if (q.type === 'choice') bind('[data-npc-choice]', el => { t.answers[q.id] = q.options[Number(el.dataset.npcChoice)]; saveDraft(); $$('[data-npc-choice]', body()).forEach(option => { const selected = option === el; option.classList.toggle('selected', selected); option.setAttribute('aria-pressed', String(selected)); }); });
    if (q.type === 'order') {
      const paint = () => {
        const picked = t.orders[q.id]; t.answers[q.id] = picked.map(i => q.tokens[i]).join(' ');
        $('#npc-order-picked').innerHTML = picked.length ? picked.map((i, order) => `<button type="button" data-npc-remove="${order}" aria-label="Remove ${esc(q.tokens[i])}, position ${order + 1}"><small>${order + 1}</small>${esc(q.tokens[i])}<span aria-hidden="true">×</span></button>`).join('') : '<span class="npc-order-placeholder">Your sentence starts here…</span>';
        $('#npc-order-spoken').textContent = t.answers[q.id] || 'No tiles selected.';
        $$('[data-npc-tile]', body()).forEach(el => { el.disabled = picked.includes(Number(el.dataset.npcTile)); });
        bind('[data-npc-remove]', el => { picked.splice(Number(el.dataset.npcRemove), 1); paint(); saveDraft(); });
        $('#npc-order-clear').disabled = !picked.length;
      };
      bind('[data-npc-tile]', el => { const i = Number(el.dataset.npcTile); if (!t.orders[q.id].includes(i)) t.orders[q.id].push(i); paint(); saveDraft(); });
      $('#npc-order-clear').onclick = () => { t.orders[q.id] = []; paint(); saveDraft(); }; paint();
    }
  }
  async function submit() {
    const t = session; if (!t || t.submitting) return;
    const missing = t.mission.questions.findIndex(q => !t.answers[q.id]?.trim() || q.type === 'order' && t.orders[q.id].length !== q.tokens.length);
    if (missing >= 0) { t.index = missing; renderQuestion(); bridge.toast('Complete every question before submitting.'); return; }
    saveDraft(); t.submitting = true; const revision = viewRevision, submitButton = $('#npc-question-next');
    submitButton.disabled = true; submitButton.textContent = t.practice ? 'Checking…' : 'Saving…';
    try {
      let feedback;
      if (t.practice) { const { evaluateNPCMission } = await import('./course-progress.js'); feedback = evaluateNPCMission(t.mission, t.answers); }
      else { const response = await bridge.run(() => bridge.getAPI().npcComplete(t.mission.id, t.answers)); if (!response) return; feedback = response.feedback; }
      if (viewRevision !== revision || session !== t) return;
      t.feedback = feedback;
      if (!feedback?.passed) { t.index = Math.max(0, t.mission.questions.findIndex(q => feedback?.items?.some(item => item.questionId === q.id && !item.passed && item.status !== 'correct'))); renderQuestion(); bridge.playTone('wrong'); bridge.toast(t.practice?'Check the explanation and try the practice again.':'Your attempt is saved. Check the explanation and try again.'); return; }
      if (!t.practice) { try { localStorage.removeItem(draftKey(state()?.journeyId, t.mission.id)); } catch {} }
      bridge.playTone('success'); if (!t.practice) bridge.celebrate(); showResult(t, feedback);
    } catch (error) { bridge.toast(error?.message || 'This challenge could not finish. Your answers are still here.'); }
    finally { t.submitting = false; if (submitButton.isConnected) { submitButton.disabled = false; submitButton.textContent = t.practice ? 'Check practice' : 'Submit mission'; } }
  }
  function showResult(t, feedback) {
    const clearance = t.mission.id === SEA_TRAINING_REVIEW_ID && !t.practice;
    show(t.practice ? 'Practice complete, cadet.' : clearance ? 'Your next horizon is ready.' : 'Sign-off earned, cadet.', t.practice ? 'PRACTICE COMPLETE' : clearance ? 'TR. DREAM · SEA-TRAINING CLEARANCE' : `${t.npc.name.toUpperCase()} · MISSION COMPLETE`, `<div class="npc-result-hero">${npcPortrait(t.npc)}<span class="npc-result-check">${bridge.icon('check')}</span><h3>${clearance ? 'Cleared for sea training' : esc(t.mission.title)}</h3><p>${t.practice ? 'All answers are correct. Your saved sign-off is unchanged.' : clearance ? `${esc(state()?.profile?.name || 'Cadet')}, Tr. Dream has approved your sea-training readiness in the game.` : `${esc(t.npc.name)} has signed off your mission. Your completed answers are saved in your academy record.`}</p><strong>${feedback.objectiveCorrect} / ${feedback.objectiveTotal} correct</strong></div>${clearance ? readinessMarkup(true) : ''}<div class="dialog-actions">${button('npc-result-mentor','Back to my mentor')}${button('npc-result-office',clearance ? 'Go to Academic Office' : 'Staff & tasks','primary')}${button('npc-result-practice','Practise again')}</div>`, 'npc-result');
    $('#npc-result-mentor').onclick = () => openNPC(t.npc.id); $('#npc-result-office').onclick = clearance ? bridge.openOffice : openDirectory; $('#npc-result-practice').onclick = () => openMission(t.mission.id, true);
  }
  function openRecord(id) {
    const mission = getNPCMission(id), saved = result(id); if (!mission || !saved?.completed) return;
    const npc = getNPC(mission.npcId);
    const previousUniformRule = id === 'asawin-workshop-ready' && saved.answers?.['eng-room1-q1'] === 'Immersion suit';
    show(mission.title, `${npc.name.toUpperCase()} · SAVED SIGN-OFF`, `<div class="npc-saved-banner">${npcPortrait(npc, true)}<div><strong>✓ ${id === SEA_TRAINING_REVIEW_ID ? 'Sea-training clearance recorded' : 'Staff sign-off earned'}</strong><p>All ${mission.questions.length} answers passed. Practising keeps this completed record.</p></div></div>${id === SEA_TRAINING_REVIEW_ID ? readinessMarkup(true) : ''}${previousUniformRule ? '<p class="academy-note">This sign-off was earned under the earlier outfit rule and remains saved. Tr. Amara’s Workshop now requires the one-piece workshop suit; the immersion suit belongs at the Lifeboat. Chief Engineer Asawin now teaches in the Engine Simulator, where your campus uniform is accepted. The response below is your original saved answer.</p>' : ''}<div class="saved-response-list">${mission.questions.map((q, i) => `<section><small>QUESTION ${i + 1}</small><h3>${esc(q.prompt)}</h3><p class="saved-response">${esc(saved.answers?.[q.id] || 'Correct answer recorded')}</p><p class="npc-saved-explanation">${esc(q.explanation)}</p></section>`).join('')}</div><div class="dialog-actions">${button('npc-record-back','Back to my mentor')}${button('npc-record-practice','Practise again','primary')}</div>`, 'npc-record');
    $('#npc-record-back').onclick = () => openNPC(npc.id); $('#npc-record-practice').onclick = () => openMission(id, true);
  }
  return { openDirectory, openNPC, openMission, openRecord, progressMarkup, readinessMarkup, bindSummary, locationMarkup, bindLocations, dispose };
}
