import { SAFETY_GAMES, SAFETY_REFERENCES, getSafetyGame, getSafetyReferences } from './lifeboat-content.js';
import { evaluateSafetyGame } from './course-progress.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TYPES = { choice: 'Choose an answer', number: 'Read & calculate', order: 'Build a message' };
const draftKey = (journeyId, gameId) => `seapath.lifeboat-draft.${journeyId}.${gameId}`;
const button = (id, label, style = 'secondary') => `<button type="button" id="${id}" class="button ${style}">${esc(label)}</button>`;

function shuffledTiles(question, day) {
  const values = question.tokens.map((_, index) => index);
  let seed = [...`${question.id}:${day}`].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  for (let i = values.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1); [values[i], values[j]] = [values[j], values[i]];
  }
  if (question.answers.includes(values.map(i => question.tokens[i]).join(' '))) values.push(values.shift());
  return values;
}

function restoreTiles(tokens, text) {
  const find = (remaining, used) => {
    if (!remaining) return used;
    for (let i = 0; i < tokens.length; i++) {
      if (used.includes(i)) continue;
      if (remaining === tokens[i] || remaining.startsWith(tokens[i] + ' ')) {
        const found = find(remaining.slice(tokens[i].length).trimStart(), [...used, i]);
        if (found) return found;
      }
    }
    return null;
  };
  return find(String(text || ''), []) || [];
}

function referencesMarkup(references = SAFETY_REFERENCES) {
  return `<details class="lifeboat-references"><summary>Learning references</summary><p>Original campus reading and communication exercises. Background references:</p><ul>${references.map(reference => `<li><a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">${esc(reference.title)} <span aria-hidden="true">↗</span></a><span>${esc(reference.note)}</span></li>`).join('')}</ul><p>Game completion is a learning record, not a maritime qualification.</p></details>`;
}

function boatArt() {
  return '<svg class="lifeboat-art" viewBox="0 0 220 150" aria-hidden="true"><circle cx="119" cy="66" r="53" fill="#eaf1ed"/><path d="M33 96H194L171 121H65Z" fill="#d76a36"/><path d="M55 96V73Q61 43 99 43H137Q171 45 180 73V96Z" fill="#ee9761"/><path d="M58 97H178" stroke="#fff0dc" stroke-width="6"/><path d="M67 69Q72 55 95 55H104V78H63Z" fill="#244f60"/><path d="M114 55H134Q154 57 163 71L166 78H114Z" fill="#244f60"/><rect x="93" y="91" width="43" height="7" rx="2" fill="#f8efd4"/><path d="M24 129Q38 121 53 129T83 129T113 129T143 129T173 129T203 129" fill="none" stroke="#76aaa9" stroke-width="3" stroke-linecap="round"/><path d="M105 43V35H130V43" fill="none" stroke="#d76a36" stroke-width="5"/></svg>';
}

export function createLifeboatUI(bridge) {
  let session = null, viewRevision = 0;
  const state = () => bridge.getState();
  const safety = () => state()?.safety || { todayId: null, results: {}, unlockedIds: [], total: SAFETY_GAMES.length, completedCount: 0, eligibleYear: 1 };
  const record = id => safety().results?.[id];
  const completed = id => record(id)?.completed === true;
  const body = () => $('#dialog-body');
  const bind = (selector, callback) => $$(selector, body()).forEach(element => { element.onclick = () => callback(element); });
  function dispose() { viewRevision++; }
  function show(title, kicker, html, key = 'lifeboat') {
    viewRevision++;
    bridge.show(title, kicker, `<div class="lifeboat-shell">${html}</div>`, key);
  }
  function canLearn() {
    if (bridge.canStartLearning) return bridge.canStartLearning();
    if (state()?.orientation?.completed) return true;
    bridge.toast('Complete all staff introductions before starting learning games.');
    return false;
  }
  function openLifeboat() {
    if (bridge.needInit()) return;
    if (bridge.ensureLifeboat && !bridge.ensureLifeboat(openLifeboat)) return;
    const progress = safety(), today = getSafetyGame(progress.todayId), oriented = state()?.orientation?.completed === true;
    const completeToday = today && completed(today.id), pendingToday = today && record(today.id)?.attempts;
    show('Lifeboat safety games', 'AMCOL · LEARN, OBSERVE & COMMUNICATE', `<div class="lifeboat-hero"><div><span class="lifeboat-eyebrow">YEAR ${progress.eligibleYear} · GAME DAY ${state()?.day || 1}</span><h3>Ready for the next briefing?</h3><p>Your immersion suit is equipped. Practise safety words, read a muster card, and make your observations clear.</p><strong>${progress.completedCount} / ${progress.total} safety games completed</strong></div>${boatArt()}</div>${!oriented ? `<section class="lifeboat-orientation" role="status"><h3>Your first mission comes first</h3><p>Meet every staff member before playing learning games. You have completed ${state()?.orientation?.completedCount || 0} introductions.</p>${button('lifeboat-orientation', 'Continue my introductions', 'primary')}</section>` : ''}${today ? `<section class="lifeboat-today"><div class="lifeboat-today-label"><span>TODAY AT THE LIFEBOAT</span><strong>${completeToday ? '✓ Complete · practice available' : '4 questions · +10 game XP on first completion'}</strong></div><h3>${esc(today.title)}</h3><p>${esc(today.summary)}</p><div class="lifeboat-today-actions"><button type="button" id="lifeboat-start-today" class="button primary" ${!oriented ? 'disabled' : ''}>${!oriented ? 'After orientation' : completeToday ? 'Practise today’s game' : pendingToday ? 'Continue today’s game' : 'Start today’s game'}</button>${completeToday ? button('lifeboat-today-record', 'View saved answers') : ''}</div><p class="lifeboat-small">This challenge stays here for the whole game day. Sleep at the dormitory to change the rotation.</p></section>` : '<p class="lifeboat-small">Your daily challenge appears when your cadet’s saved account is ready.</p>'}<div class="lifeboat-section-title"><h3>Your safety game collection</h3><span>Two games unlock each year</span></div><div class="lifeboat-catalog">${[1, 2, 3, 4].map(year => `<section class="lifeboat-year"><h4>YEAR ${year}${year > progress.eligibleYear ? ' · LOCKED' : ''}</h4>${SAFETY_GAMES.filter(game => game.year === year).map(game => {
      const passed = completed(game.id), isToday = game.id === progress.todayId, unlocked = progress.unlockedIds.includes(game.id);
      const label = passed ? 'View record' : !unlocked ? `Starts in Year ${game.year}` : isToday ? 'Today’s challenge' : 'In daily rotation';
      return `<article class="lifeboat-game-card ${passed ? 'complete' : ''}"><div><h5>${esc(game.title)}</h5><p>${esc(game.summary)}</p><span>${passed ? '✓ 4 / 4 correct · saved' : isToday ? 'Available this game day' : unlocked ? 'Appears on a later game day' : `After sleeping to begin Year ${game.year}`}</span></div><button type="button" class="button secondary" data-lifeboat-game="${game.id}" ${!passed && (!isToday || !oriented) ? 'disabled' : ''}>${esc(label)}</button></article>`;
    }).join('')}</section>`).join('')}</div><p class="lifeboat-small">These optional games add to your character record. They do not add graduation requirements. Completed games can be practised any time; practice earns no extra XP. A new safety game uses one of today’s mission slots and its entry energy once; retries are free.</p>${referencesMarkup()}<div class="lifeboat-footer">${button('lifeboat-office', 'Academic Office')}${button('lifeboat-close', 'Back to campus', 'primary')}</div>`);
    if ($('#lifeboat-orientation')) $('#lifeboat-orientation').onclick = canLearn;
    if ($('#lifeboat-start-today')) $('#lifeboat-start-today').onclick = () => openGame(today.id, Boolean(completeToday));
    if ($('#lifeboat-today-record')) $('#lifeboat-today-record').onclick = () => openRecord(today.id);
    bind('[data-lifeboat-game]', el => completed(el.dataset.lifeboatGame) ? openRecord(el.dataset.lifeboatGame) : openGame(el.dataset.lifeboatGame));
    $('#lifeboat-office').onclick = bridge.openOffice;
    $('#lifeboat-close').onclick = bridge.closeDialog;
  }

  function saveDraft() {
    if (!session || session.practice) return;
    try { localStorage.setItem(draftKey(session.journeyId, session.game.id), JSON.stringify({ answers: session.answers, orders: session.orders, index: session.index })); } catch { /* Keep input available in memory when storage is full. */ }
  }
  function openGame(id, practice = false) {
    const game = getSafetyGame(id); if (!game || bridge.needInit()) return;
    if (completed(id) && !practice) { openRecord(id); return; }
    if (!canLearn()) return;
    if (bridge.ensureLifeboat && !bridge.ensureLifeboat(() => openGame(id, practice))) return;
    if (practice && !completed(id) || !practice && safety().todayId !== id) {
      bridge.toast('Start today’s Lifeboat challenge, or practise a game already saved in your record.'); openLifeboat(); return;
    }
    let draft = {};
    if (!practice) { try { draft = JSON.parse(localStorage.getItem(draftKey(state().journeyId, id)) || 'null') || {}; } catch {} }
    const answers = {}, orders = {}, saved = practice ? {} : record(id)?.answers || {};
    for (const question of game.questions) {
      const value = draft.answers?.[question.id] ?? saved[question.id];
      answers[question.id] = typeof value === 'string' ? value.slice(0, 1000) : '';
      if (question.type === 'order') {
        const indexes = draft.orders?.[question.id];
        orders[question.id] = Array.isArray(indexes) && indexes.length <= question.tokens.length
          && indexes.every(i => Number.isInteger(i) && i >= 0 && i < question.tokens.length)
          && new Set(indexes).size === indexes.length ? indexes : restoreTiles(question.tokens, answers[question.id]);
        answers[question.id] = orders[question.id].map(i => question.tokens[i]).join(' ');
      }
    }
    session = { game, journeyId: state().journeyId, answers, orders, practice, feedback: null, submitting: false,
      index: Number.isInteger(draft.index) ? Math.max(0, Math.min(game.questions.length - 1, draft.index)) : 0 };
    renderQuestion();
  }
  function renderQuestion() {
    const current = session; if (!current) return;
    const question = current.game.questions[current.index], value = current.answers[question.id] || '';
    const feedback = current.feedback?.items?.find(item => item.questionId === question.id);
    let field;
    if (question.type === 'choice') {
      field = `<div class="lifeboat-choices" role="group" aria-labelledby="lifeboat-question-title">${question.options.map((option, i) => `<button type="button" data-lifeboat-choice="${i}" aria-pressed="${value === option}" class="${value === option ? 'selected' : ''}"><span>${String.fromCharCode(65 + i)}</span>${esc(option)}</button>`).join('')}</div>`;
    } else if (question.type === 'number') {
      field = `<label class="lifeboat-number-label" for="lifeboat-number-answer">Your answer <span>Enter a number</span></label><input type="text" id="lifeboat-number-answer" inputmode="decimal" autocomplete="off" maxlength="40" value="${esc(value)}" placeholder="?">`;
    } else {
      field = `<p class="lifeboat-small">Tap the tiles in order. Tap a chosen tile to remove it.</p><div id="lifeboat-order-picked" class="lifeboat-order-picked" aria-label="Your ordered answer"></div><p id="lifeboat-order-status" class="lifeboat-sr-only" aria-live="polite"></p><div class="lifeboat-order-bank">${shuffledTiles(question, state()?.day).map(i => `<button type="button" data-lifeboat-tile="${i}">${esc(question.tokens[i])}</button>`).join('')}</div>${button('lifeboat-order-clear', 'Clear answer')}`;
    }
    show(current.game.title, `LIFEBOAT · ${current.practice ? 'PRACTICE' : 'TODAY’S SAFETY GAME'}`, `<div class="lifeboat-game-top"><span>${esc(TYPES[question.type])}</span><strong>${current.index + 1} / ${current.game.questions.length}</strong></div><div class="lifeboat-track" aria-hidden="true"><i style="width:${(current.index + 1) / current.game.questions.length * 100}%"></i></div><aside class="lifeboat-placard"><h3>Training placard</h3><p>${esc(current.game.instructions)}</p><ul>${current.game.learning.map(line => `<li>${esc(line)}</li>`).join('')}</ul></aside><section class="lifeboat-question"><small>QUESTION ${current.index + 1}</small><h3 id="lifeboat-question-title">${esc(question.prompt)}</h3>${field}${feedback ? `<div class="lifeboat-feedback ${feedback.passed ? 'correct' : ''}" role="status"><strong>${feedback.passed ? 'Correct' : 'Review this answer'}</strong><p>${esc(feedback.explanation || question.explanation)}</p></div>` : ''}</section><nav class="lifeboat-game-nav" aria-label="Safety game navigation">${button('lifeboat-previous', 'Previous')}${button('lifeboat-leave-game', current.practice ? 'Leave practice' : 'Save draft & leave')}${button('lifeboat-next', current.index < current.game.questions.length - 1 ? 'Next question' : current.practice ? 'Check practice' : 'Submit answers', 'primary')}</nav><div class="lifeboat-question-dots" aria-label="Question navigation">${current.game.questions.map((item, i) => `<button type="button" data-lifeboat-question="${i}" class="${i === current.index ? 'active' : current.answers[item.id] ? 'answered' : ''}" aria-label="Question ${i + 1}${current.answers[item.id] ? ', answered' : ''}" ${i === current.index ? 'aria-current="step"' : ''}>${i + 1}</button>`).join('')}</div><p class="lifeboat-small">${current.practice ? 'Practice uses the same answer check and keeps your saved grade and XP.' : 'Answer all four correctly to complete the game. You can retry during this game day.'}</p>`, 'lifeboat-game');
    $('#lifeboat-previous').disabled = current.index === 0;
    $('#lifeboat-previous').onclick = () => { if (current.index > 0) current.index--; saveDraft(); renderQuestion(); };
    $('#lifeboat-leave-game').onclick = () => { saveDraft(); openLifeboat(); };
    $('#lifeboat-next').onclick = () => {
      if (!hasAnswer(current, question)) { bridge.toast(question.type === 'order' ? 'Use every tile before continuing.' : 'Choose or enter an answer first.'); return; }
      if (current.index < current.game.questions.length - 1) { current.index++; saveDraft(); renderQuestion(); } else submit();
    };
    bind('[data-lifeboat-question]', el => { current.index = Number(el.dataset.lifeboatQuestion); saveDraft(); renderQuestion(); });
    if (question.type === 'choice') bind('[data-lifeboat-choice]', el => {
      current.answers[question.id] = question.options[Number(el.dataset.lifeboatChoice)]; saveDraft();
      $$('[data-lifeboat-choice]', body()).forEach(control => { const selected = control === el; control.classList.toggle('selected', selected); control.setAttribute('aria-pressed', String(selected)); });
    });
    if (question.type === 'number') {
      $('#lifeboat-number-answer').oninput = event => { current.answers[question.id] = event.target.value; saveDraft(); };
      $('#lifeboat-number-answer').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); $('#lifeboat-next').click(); } };
    }
    if (question.type === 'order') {
      const paint = () => {
        const selected = current.orders[question.id];
        current.answers[question.id] = selected.map(i => question.tokens[i]).join(' ');
        $('#lifeboat-order-picked').innerHTML = selected.length ? selected.map((i, position) => `<button type="button" data-lifeboat-remove="${position}" aria-label="Remove ${esc(question.tokens[i])}, position ${position + 1}"><small>${position + 1}</small>${esc(question.tokens[i])}<span aria-hidden="true">×</span></button>`).join('') : '<span class="lifeboat-order-placeholder">Your message starts here…</span>';
        $('#lifeboat-order-status').textContent = current.answers[question.id] || 'No tiles selected.';
        $$('[data-lifeboat-tile]', body()).forEach(el => { el.disabled = selected.includes(Number(el.dataset.lifeboatTile)); });
        bind('[data-lifeboat-remove]', el => { selected.splice(Number(el.dataset.lifeboatRemove), 1); paint(); saveDraft(); });
        $('#lifeboat-order-clear').disabled = !selected.length;
      };
      bind('[data-lifeboat-tile]', el => { const i = Number(el.dataset.lifeboatTile); if (!current.orders[question.id].includes(i)) current.orders[question.id].push(i); paint(); saveDraft(); });
      $('#lifeboat-order-clear').onclick = () => { current.orders[question.id] = []; paint(); saveDraft(); }; paint();
    }
  }
  function hasAnswer(current, question) {
    return Boolean(current.answers[question.id]?.trim())
      && (question.type !== 'order' || current.orders[question.id]?.length === question.tokens.length);
  }
  async function submit() {
    const current = session; if (!current || current.submitting) return;
    const missing = current.game.questions.findIndex(question => !hasAnswer(current, question));
    if (missing >= 0) { current.index = missing; renderQuestion(); bridge.toast('Complete all four answers before submitting.'); return; }
    saveDraft(); current.submitting = true;
    const revision = viewRevision, control = $('#lifeboat-next');
    control.disabled = true; control.textContent = current.practice ? 'Checking…' : 'Saving…';
    try {
      const feedback = current.practice ? evaluateSafetyGame(current.game, current.answers)
        : (await bridge.run(() => bridge.getAPI().completeSafety(current.game.id, current.answers)))?.feedback;
      if (!feedback || revision !== viewRevision || session !== current) return;
      current.feedback = feedback;
      if (!feedback.passed) {
        current.index = Math.max(0, current.game.questions.findIndex(question => feedback.items.some(item => item.questionId === question.id && !item.passed)));
        renderQuestion(); bridge.playTone?.('wrong');
        bridge.toast(current.practice ? 'Read the explanation and try again.' : 'Attempt saved. Read the explanation and try again.'); return;
      }
      if (!current.practice) { try { localStorage.removeItem(draftKey(current.journeyId, current.game.id)); } catch {} }
      bridge.playTone?.('success'); if (!current.practice) bridge.celebrate?.();
      showResult(current, feedback);
    } catch (error) {
      if (revision === viewRevision && session === current) bridge.toast(error?.message || 'Your answers are still here. Please try saving again.');
    } finally {
      current.submitting = false;
      if (control.isConnected) { control.disabled = false; control.textContent = current.practice ? 'Check practice' : 'Submit answers'; }
    }
  }
  function showResult(current, feedback) {
    show(current.practice ? 'Practice complete' : 'Safety challenge complete', 'LIFEBOAT · YOUR LEARNING RECORD', `<section class="lifeboat-result">${boatArt()}<span class="lifeboat-result-check" aria-hidden="true">✓</span><h3>${esc(current.game.title)}</h3><strong>${feedback.objectiveCorrect} / ${feedback.objectiveTotal} correct</strong><p>${current.practice ? 'Your practice is complete. Your saved answers and XP stay the same.' : 'Your completed answers are saved in your academy account. This game adds 10 XP once.'}</p></section><div class="lifeboat-footer">${button('lifeboat-result-board', 'Back to the Lifeboat', 'primary')}${button('lifeboat-result-record', 'View saved answers')}${button('lifeboat-result-practice', 'Practise again')}</div>`, 'lifeboat-result');
    $('#lifeboat-result-board').onclick = openLifeboat;
    $('#lifeboat-result-record').onclick = () => openRecord(current.game.id);
    $('#lifeboat-result-practice').onclick = () => openGame(current.game.id, true);
  }
  function openRecord(id) {
    const game = getSafetyGame(id), saved = record(id); if (!game || !saved?.completed || bridge.needInit()) return;
    show(game.title, `LIFEBOAT · YEAR ${game.year} SAVED GAME`, `<div class="lifeboat-saved-banner"><span aria-hidden="true">✓</span><div><h3>Safety game completed</h3><p>${saved.objectiveCorrect} / ${saved.objectiveTotal} correct · 10 game XP earned once</p></div></div><div class="lifeboat-saved-list">${game.questions.map((question, i) => `<section><small>QUESTION ${i + 1}</small><h3>${esc(question.prompt)}</h3><p class="lifeboat-saved-answer">${esc(saved.answers?.[question.id] || 'Correct answer recorded')}</p><p>${esc(question.explanation)}</p></section>`).join('')}</div>${referencesMarkup(getSafetyReferences(game))}<div class="lifeboat-footer">${button('lifeboat-record-back', 'Back to the Lifeboat')}${button('lifeboat-record-practice', 'Practise again', 'primary')}</div>`, 'lifeboat-record');
    $('#lifeboat-record-back').onclick = openLifeboat;
    $('#lifeboat-record-practice').onclick = () => openGame(id, true);
  }
  return { openLifeboat, openGame, dispose };
}
