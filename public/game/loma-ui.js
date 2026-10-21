import { LOMA_FINAL_COUNT, LOMA_DAILY_LIMIT, getLomaGame } from './loma-content.js';
import { evaluateLomaGame } from './course-progress.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const button = (id, label, style = 'secondary') => `<button type="button" id="${id}" class="button ${style}">${esc(label)}</button>`;
const draftKey = (journeyId, gameId) => `seapath.loma-draft.${journeyId}.${gameId}`;
const TYPES = { choice: 'Choose an answer', number: 'Read & calculate', order: 'Build the answer', text: 'Complete the answer' };
const PAGE_SIZE = 10;

function tileOrder(question, gameId) {
  const values = question.tokens.map((_, i) => i);
  let seed = [...`${gameId}:${question.id}`].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  for (let i = values.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [values[i], values[j]] = [values[j], values[i]]; }
  if (question.answers.includes(values.map(i => question.tokens[i]).join(' '))) values.push(values.shift());
  return values;
}
function restoreTiles(tokens, text) {
  const find = (remaining, used) => {
    if (!remaining) return used;
    for (let i = 0; i < tokens.length; i++) if (!used.includes(i) && (remaining === tokens[i] || remaining.startsWith(tokens[i] + ' '))) {
      const found = find(remaining.slice(tokens[i].length).trimStart(), [...used, i]); if (found) return found;
    }
    return null;
  };
  return find(String(text || ''), []) || [];
}

export function createLomaUI(bridge) {
  let session = null, revision = 0, drawing = false, filter = 'pending', page = 0;
  const state = () => bridge.getState();
  const final = () => state()?.loma || { available: false, started: false, major: state()?.profile?.major || 'deck', gameIds: [], results: {}, completedCount: 0, total: LOMA_FINAL_COUNT, today: { completed: 0, remaining: LOMA_DAILY_LIMIT, limit: LOMA_DAILY_LIMIT } };
  const saved = id => final().results?.[id];
  const completed = id => saved(id)?.completed === true;
  const body = () => $('#dialog-body');
  const bind = (selector, callback) => $$(selector, body()).forEach(element => { element.onclick = () => callback(element); });
  function dispose() { revision++; }
  function show(title, kicker, html, key = 'loma') { revision++; bridge.show(title, kicker, `<div class="loma-shell">${html}</div>`, key); }
  function canLearn() { if (bridge.canStartLearning) return bridge.canStartLearning(); return state()?.orientation?.completed === true; }
  function openLoma() {
    if (bridge.needInit()) return;
    const progress = final(), major = String(progress.major).toUpperCase(), oriented = state()?.orientation?.completed === true;
    const ids = progress.gameIds.filter(id => getLomaGame(id));
    const filtered = ids.filter(id => filter === 'all' || filter === 'complete' ? filter === 'all' || completed(id) : !completed(id));
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); page = Math.min(Math.max(0, page), pageCount - 1);
    const next = ids.find(id => !completed(id));
    const hero = `<section class="loma-hero"><span class="loma-eyebrow">YEAR 4 · SEMESTER 2 · ${major}</span><h3>Your final chapter.</h3><p>Bring together your maritime knowledge, clear communication, and cadet judgement.</p><div class="loma-hero-stats"><div><strong>${progress.completedCount}<small> / ${progress.total}</small></strong><span>final games complete</span></div><div><strong>${progress.today.remaining}<small> / ${progress.today.limit}</small></strong><span>completions left this day</span></div></div></section>`;
    const legacy = progress.legacyGraduate ? '<section class="loma-notice"><strong>Your previous graduation remains valid.</strong><p>You graduated before this final was introduced. You can complete it as an additional challenge using the same daily limits.</p></section>' : '';
    let content;
    if (!oriented) {
      content = `<section class="loma-notice"><h3>Meet your AMCOL team first</h3><p>Finish every staff introduction before beginning learning games.</p>${button('loma-orientation', 'Continue my introductions', 'primary')}</section>`;
    } else if (!progress.available) {
      content = `<section class="loma-notice"><h3>The final opens in Year 4, Semester 2</h3><p>Complete the earlier semesters, then sleep at the dormitory to begin your last semester. You will draw your final here when you are ready.</p></section>`;
    } else if (!progress.started) {
      content = `<section class="loma-begin-card"><span class="loma-eyebrow">REVIEW YOUR MAJOR</span><h3>${major} final · 50 mini-games</h3><p>Your final will contain 20 ${major} games, 20 shared course reviews, 6 safety reviews, and 4 staff challenges. Each game has two to four questions.</p><p><strong>Beginning the final saves its random selection and locks your ${major} major for this journey.</strong> The same set stays with you through retries, refreshes, and new game days.</p><p>Each new final game uses one of today’s ${LOMA_DAILY_LIMIT} mission slots and its entry energy once. Retrying a game you started is free. Exercise and sleep at the dormitory to begin another day.</p><div class="loma-actions">${button('loma-review-character', 'Review my character')}${button('loma-begin-final', `Begin final & lock ${major}`, 'primary')}</div></section>`;
    } else {
      const completeBanner = progress.complete ? `<section class="loma-complete-banner"><span aria-hidden="true">✓</span><div><h3>All 50 final mini-games passed</h3><p>${progress.legacyGraduate ? 'Your additional final record is complete.' : 'Visit the Academic Office to check your book requirements and graduate.'}</p></div>${button('loma-finish-office', 'Academic Office', 'primary')}</section>` : '';
      const allowance = progress.today.remaining > 0 ? `<section class="loma-day-card"><div><h3>${progress.today.remaining} mission slots left today</h3><p>${progress.today.limit - progress.today.remaining} / ${progress.today.limit} slots used today · ${progress.today.completed} final games passed today. Choose any unfinished game in your saved set.</p></div>${next ? button('loma-start-next', 'Continue my final', 'primary') : ''}</section>` : `<section class="loma-day-card exhausted"><div><h3>Today’s mission slots are used</h3><p>Finish PT, running, or football at the dormitory, then sleep. Your next study day brings new slots.</p></div>${!progress.complete ? button('loma-go-dorm', 'Go to the dormitory', 'primary') : ''}</section>`;
      content = `${completeBanner}${progress.complete ? '' : allowance}<nav class="loma-filters" aria-label="Filter final games">${[['pending', 'To complete'], ['complete', 'Completed'], ['all', 'All 50']].map(([id, label]) => `<button type="button" data-loma-filter="${id}" aria-pressed="${filter === id}" class="${filter === id ? 'active' : ''}">${label}</button>`).join('')}</nav><div class="loma-game-list">${filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(id => {
        const game = getLomaGame(id), pass = completed(id), position = ids.indexOf(id) + 1;
        return `<article class="loma-game-card ${pass ? 'complete' : ''}"><span class="loma-game-number">${pass ? '✓' : String(position).padStart(2, '0')}</span><div><small>${game.major === 'shared' ? 'SHARED COURSE' : `${game.major.toUpperCase()} MAJOR`} · ${game.questions.length} QUESTIONS</small><h3>${esc(game.title)}</h3><p>${esc(game.summary)}</p><span>${pass ? '✓ Passed · saved in your final record' : saved(id)?.attempts ? 'In progress · your last answers are saved' : 'Ready in your saved final'}</span></div><button type="button" class="button ${pass ? 'secondary' : 'primary'}" data-loma-game="${esc(id)}" ${!pass && progress.today.remaining === 0 ? 'disabled' : ''}>${pass ? 'View record' : progress.today.remaining === 0 ? 'Next game day' : saved(id)?.attempts ? 'Continue' : 'Start game'}</button></article>`;
      }).join('') || `<p class="loma-empty">${filter === 'complete' ? 'Your completed games will appear here.' : 'No unfinished games in this view.'}</p>`}</div><nav class="loma-pages" aria-label="Final collection pages">${button('loma-page-prev', 'Previous page')}<span>Page ${page + 1} / ${pageCount}</span>${button('loma-page-next', 'Next page')}</nav>`;
    }
    show('Loma Lounge final', 'AMCOL · A FINAL TO CALL YOUR OWN', `${hero}${legacy}${content}<p class="loma-small">Final first completions earn 10 game XP each. Replays keep your saved result and earn no extra XP. Final games share your daily and weekly mission slots.</p><div class="loma-actions footer">${button('loma-office', 'Academic Office')}${button('loma-close', 'Back to campus', 'primary')}</div>`);
    if ($('#loma-orientation')) $('#loma-orientation').onclick = canLearn;
    if ($('#loma-review-character')) $('#loma-review-character').onclick = bridge.openDashboard || bridge.openOffice;
    if ($('#loma-begin-final')) $('#loma-begin-final').onclick = beginFinal;
    if ($('#loma-finish-office')) $('#loma-finish-office').onclick = bridge.openOffice;
    if ($('#loma-start-next')) $('#loma-start-next').onclick = () => openGame(next);
    if ($('#loma-go-dorm')) $('#loma-go-dorm').onclick = () => bridge.goLocation('dorm');
    bind('[data-loma-filter]', element => { filter = element.dataset.lomaFilter; page = 0; openLoma(); });
    bind('[data-loma-game]', element => completed(element.dataset.lomaGame) ? openRecord(element.dataset.lomaGame) : openGame(element.dataset.lomaGame));
    if ($('#loma-page-prev')) { $('#loma-page-prev').disabled = page === 0; $('#loma-page-prev').onclick = () => { if (page > 0) page--; openLoma(); }; }
    if ($('#loma-page-next')) { $('#loma-page-next').disabled = page >= pageCount - 1; $('#loma-page-next').onclick = () => { if (page < pageCount - 1) page++; openLoma(); }; }
    $('#loma-office').onclick = bridge.openOffice; $('#loma-close').onclick = bridge.closeDialog;
  }
  async function beginFinal() {
    if (drawing || !canLearn()) return;
    drawing = true; const currentRevision = revision, control = $('#loma-begin-final');
    if (!control) { drawing = false; return; }
    const label = control.textContent; control.disabled = true; control.textContent = 'Saving your final…';
    try {
      const response = await bridge.run(() => bridge.getAPI().startLoma());
      if (response && revision === currentRevision) { filter = 'pending'; page = 0; openLoma(); bridge.toast('Your fifty-game final is saved.'); }
    } catch (error) { if (revision === currentRevision) bridge.toast(error.message || 'Please try again.'); }
    finally { drawing = false; if (control.isConnected) { control.disabled = false; control.textContent = label; } }
  }
  function saveDraft() {
    if (!session || session.practice) return;
    try { localStorage.setItem(draftKey(session.journeyId, session.game.id), JSON.stringify({ answers: session.answers, orders: session.orders, index: session.index })); } catch {}
  }
  function openGame(id, practice = false) {
    const game = getLomaGame(id); if (!game || bridge.needInit()) return;
    if (!final().gameIds.includes(id)) { bridge.toast('Choose a game from your saved final.'); openLoma(); return; }
    if (completed(id) && !practice) { openRecord(id); return; }
    if (!canLearn()) return;
    if (practice && !completed(id)) { bridge.toast('Complete this final game before replaying it.'); return; }
    if (!practice && final().today.remaining <= 0) { bridge.toast('Sleep at the dormitory to begin the next game day.'); openLoma(); return; }
    let draft = {};
    if (!practice) { try { draft = JSON.parse(localStorage.getItem(draftKey(state().journeyId, id)) || 'null') || {}; } catch {} }
    const answers = {}, orders = {}, previous = practice ? {} : saved(id)?.answers || {};
    for (const question of game.questions) {
      const value = draft.answers?.[question.id] ?? previous[question.id]; answers[question.id] = typeof value === 'string' ? value.slice(0, 2000) : '';
      if (question.type === 'order') {
        const indexes = draft.orders?.[question.id];
        orders[question.id] = Array.isArray(indexes) && indexes.length <= question.tokens.length && new Set(indexes).size === indexes.length
          && indexes.every(i => Number.isInteger(i) && i >= 0 && i < question.tokens.length) ? indexes : restoreTiles(question.tokens, answers[question.id]);
        answers[question.id] = orders[question.id].map(i => question.tokens[i]).join(' ');
      }
    }
    session = { game, journeyId: state().journeyId, practice, answers, orders, feedback: null, submitting: false,
      index: Number.isInteger(draft.index) ? Math.max(0, Math.min(game.questions.length - 1, draft.index)) : 0 };
    renderQuestion();
  }
  function sourceMarkup(game) {
    const source = game.source;
    const references = source.references || [];
    const context = source.instructions ? `<details class="loma-source-context" ${source.openByDefault ? 'open' : ''}><summary>Original activity instructions${source.openByDefault ? ' & evidence' : ''}</summary><p>${esc(source.instructions)}</p><p>This final uses only the questions shown below.</p>${source.openByDefault && source.images?.length ? source.images.map((url, i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="loma-source-image"><img src="${esc(url)}" alt="Original evidence for physical PDF page ${source.pages?.[i] || source.pages?.[0] || ''}" loading="lazy"><span>Open the original evidence image ↗</span></a>`).join('') : ''}</details>` : '';
    return `<aside class="loma-source"><div><strong>${esc(source.title)}</strong><span>${esc(source.author)}${source.pages?.length ? ` · physical PDF page ${source.pages.join(', ')}` : ''}</span></div>${source.pages?.length ? button('loma-source-open', 'Open source page') : ''}<p>${esc(source.note)}</p>${context}${references.length ? `<details><summary>Background references</summary><ul>${references.map(reference => `<li><a href="${esc(reference.url)}" target="_blank" rel="noopener noreferrer">${esc(reference.title)}</a></li>`).join('')}</ul></details>` : ''}</aside>`;
  }
  function bindSource(current) {
    if (!$('#loma-source-open')) return;
    $('#loma-source-open').onclick = () => {
      saveDraft();
      if (bridge.openSourcePage) bridge.openSourcePage(current.game.source.pages[0], () => {
        if (state()?.journeyId !== current.journeyId || !final().gameIds.includes(current.game.id)) { openLoma(); return; }
        session = current; renderQuestion();
      });
      else bridge.toast('Open the course book at the physical PDF page listed above.');
    };
  }
  function hasAnswer(current, question) { return Boolean(current.answers[question.id]?.trim()) && (question.type !== 'order' || current.orders[question.id]?.length === question.tokens.length); }
  function renderQuestion() {
    const current = session; if (!current) return;
    const question = current.game.questions[current.index], value = current.answers[question.id] || '', feedback = current.feedback?.items?.find(item => item.questionId === question.id);
    let field;
    if (question.type === 'choice') field = `<div class="loma-choices" role="group" aria-labelledby="loma-question-title">${question.options.map((option, i) => `<button type="button" data-loma-choice="${i}" aria-pressed="${value === option}" class="${value === option ? 'selected' : ''}"><span>${String.fromCharCode(65 + i)}</span>${esc(option)}</button>`).join('')}</div>`;
    else if (question.type === 'number') field = `<label class="loma-field-label" for="loma-number-answer">Your numeric answer</label><input type="text" id="loma-number-answer" inputmode="decimal" autocomplete="off" maxlength="40" value="${esc(value)}" placeholder="?">`;
    else if (question.type === 'text') field = `<label class="loma-field-label" for="loma-text-answer">Your answer</label><textarea id="loma-text-answer" rows="2" maxlength="2000" autocomplete="off" spellcheck="false" placeholder="Type the requested word or phrase">${esc(value)}</textarea><p class="loma-small">Keep required figures, units, and word forms. If there are two blanks, give both parts in order.</p>`;
    else field = `<p class="loma-small">Tap every tile in order. Tap a chosen tile to remove it.</p><div id="loma-order-picked" class="loma-order-picked" aria-label="Your ordered answer"></div><p id="loma-order-status" class="loma-sr-only" aria-live="polite"></p><div class="loma-order-bank">${tileOrder(question, current.game.id).map(i => `<button type="button" data-loma-tile="${i}">${esc(question.tokens[i])}</button>`).join('')}</div>${button('loma-order-clear', 'Clear answer')}`;
    show(current.game.title, `LOMA FINAL · ${current.practice ? 'PRACTICE' : `${final().major.toUpperCase()} MAJOR`}`, `<div class="loma-game-top"><span>${esc(TYPES[question.type])}</span><strong>${current.index + 1} / ${current.game.questions.length}</strong></div><div class="loma-track" aria-hidden="true"><i style="width:${(current.index + 1) / current.game.questions.length * 100}%"></i></div><p class="loma-instructions">${esc(current.game.instructions)}</p>${current.game.learning.length ? `<aside class="loma-placard"><h3>Exercise card</h3><ul>${current.game.learning.map(line => `<li>${esc(line)}</li>`).join('')}</ul></aside>` : ''}${sourceMarkup(current.game)}<section class="loma-question"><small>QUESTION ${current.index + 1}</small><h3 id="loma-question-title">${esc(question.prompt)}</h3>${field}${feedback ? `<div class="loma-feedback ${feedback.passed ? 'correct' : ''}" role="status"><strong>${feedback.passed ? 'Correct' : 'Review this answer'}</strong><p>${esc(feedback.explanation || question.explanation || feedback.message)}</p></div>` : ''}</section><nav class="loma-game-nav" aria-label="Final game navigation">${button('loma-previous', 'Previous')}${button('loma-leave-game', current.practice ? 'Leave practice' : 'Save draft & leave')}${button('loma-next', current.index < current.game.questions.length - 1 ? 'Next question' : current.practice ? 'Check practice' : 'Submit final game', 'primary')}</nav><div class="loma-question-dots" aria-label="Question navigation">${current.game.questions.map((item, i) => `<button type="button" data-loma-question="${i}" class="${current.index === i ? 'active' : current.answers[item.id] ? 'answered' : ''}" aria-label="Question ${i + 1}${current.answers[item.id] ? ', answered' : ''}" ${current.index === i ? 'aria-current="step"' : ''}>${i + 1}</button>`).join('')}</div><p class="loma-small">${current.practice ? 'Practice keeps your saved grade, daily allowance, and XP.' : `Only a first pass uses one daily completion. ${final().today.remaining} of ${LOMA_DAILY_LIMIT} remain this game day.`}</p>`, 'loma-game');
    bindSource(current);
    $('#loma-previous').disabled = current.index === 0; $('#loma-previous').onclick = () => { if (current.index > 0) current.index--; saveDraft(); renderQuestion(); };
    $('#loma-leave-game').onclick = () => { saveDraft(); openLoma(); };
    $('#loma-next').onclick = () => { if (!hasAnswer(current, question)) { bridge.toast(question.type === 'order' ? 'Use every tile before continuing.' : 'Add an answer before continuing.'); return; } if (current.index < current.game.questions.length - 1) { current.index++; saveDraft(); renderQuestion(); } else submit(); };
    bind('[data-loma-question]', element => { current.index = Number(element.dataset.lomaQuestion); saveDraft(); renderQuestion(); });
    if (question.type === 'choice') bind('[data-loma-choice]', element => { current.answers[question.id] = question.options[Number(element.dataset.lomaChoice)]; saveDraft(); $$('[data-loma-choice]', body()).forEach(control => { control.classList.toggle('selected', control === element); control.setAttribute('aria-pressed', String(control === element)); }); });
    if (['number', 'text'].includes(question.type)) {
      const input = $(question.type === 'number' ? '#loma-number-answer' : '#loma-text-answer'); input.oninput = event => { current.answers[question.id] = event.target.value; saveDraft(); };
      if (question.type === 'number') input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); $('#loma-next').click(); } };
    }
    if (question.type === 'order') {
      const paint = () => {
        const selected = current.orders[question.id]; current.answers[question.id] = selected.map(i => question.tokens[i]).join(' ');
        $('#loma-order-picked').innerHTML = selected.length ? selected.map((i, position) => `<button type="button" data-loma-remove="${position}" aria-label="Remove ${esc(question.tokens[i])}, position ${position + 1}"><small>${position + 1}</small>${esc(question.tokens[i])}<span aria-hidden="true">×</span></button>`).join('') : '<span>Your answer starts here…</span>';
        $('#loma-order-status').textContent = current.answers[question.id] || 'No tiles selected.';
        $$('[data-loma-tile]', body()).forEach(element => { element.disabled = selected.includes(Number(element.dataset.lomaTile)); });
        bind('[data-loma-remove]', element => { selected.splice(Number(element.dataset.lomaRemove), 1); paint(); saveDraft(); });
        $('#loma-order-clear').disabled = !selected.length;
      };
      bind('[data-loma-tile]', element => { const i = Number(element.dataset.lomaTile); if (!current.orders[question.id].includes(i)) current.orders[question.id].push(i); paint(); saveDraft(); });
      $('#loma-order-clear').onclick = () => { current.orders[question.id] = []; paint(); saveDraft(); }; paint();
    }
  }
  async function submit() {
    const current = session; if (!current || current.submitting) return;
    const missing = current.game.questions.findIndex(question => !hasAnswer(current, question));
    if (missing >= 0) { current.index = missing; renderQuestion(); bridge.toast('Complete every answer before submitting.'); return; }
    saveDraft(); current.submitting = true; const currentRevision = revision, control = $('#loma-next'); control.disabled = true; control.textContent = current.practice ? 'Checking…' : 'Saving…';
    try {
      const feedback = current.practice ? evaluateLomaGame(current.game, current.answers) : (await bridge.run(() => bridge.getAPI().completeLoma(current.game.id, current.answers)))?.feedback;
      if (!feedback || currentRevision !== revision || session !== current) return;
      current.feedback = feedback;
      if (!feedback.passed) { current.index = Math.max(0, current.game.questions.findIndex(question => feedback.items.some(item => item.questionId === question.id && !item.passed))); renderQuestion(); bridge.playTone?.('wrong'); bridge.toast('Review the explanation and retry. No daily completion was spent.'); return; }
      if (!current.practice) { try { localStorage.removeItem(draftKey(current.journeyId, current.game.id)); } catch {} }
      bridge.playTone?.('success'); if (!current.practice) bridge.celebrate?.(); showResult(current, feedback);
    } catch (error) { if (currentRevision === revision && session === current) bridge.toast(error.message || 'Your answers are still here. Please retry the save.'); }
    finally { current.submitting = false; if (control.isConnected) { control.disabled = false; control.textContent = current.practice ? 'Check practice' : 'Submit final game'; } }
  }
  function showResult(current, feedback) {
    show(current.practice ? 'Final practice complete' : 'Final mini-game passed', 'LOMA LOUNGE · YOUR SAVED FINAL', `<section class="loma-result"><span aria-hidden="true">✓</span><h3>${esc(current.game.title)}</h3><strong>${feedback.objectiveCorrect} / ${feedback.objectiveTotal} correct</strong><p>${current.practice ? 'Your saved result, daily allowance, and XP stay unchanged.' : `${final().completedCount} / ${LOMA_FINAL_COUNT} final games complete. This first completion earns 10 game XP.`}</p>${!current.practice ? `<p>${final().complete ? 'Every final mini-game has passed. Visit the Academic Office for your graduation check.' : `${final().today.remaining} final completions remain this game day.`}</p>` : ''}</section><div class="loma-actions footer">${button('loma-result-board', 'My final collection', 'primary')}${button('loma-result-office', 'Academic Office')}${button('loma-result-practice', 'Practise again')}</div>`, 'loma-result');
    $('#loma-result-board').onclick = openLoma; $('#loma-result-office').onclick = bridge.openOffice; $('#loma-result-practice').onclick = () => openGame(current.game.id, true);
  }
  function openRecord(id) {
    const game = getLomaGame(id), result = saved(id); if (!game || !result?.completed || !final().gameIds.includes(id)) return;
    show(game.title, 'LOMA LOUNGE · COMPLETED FINAL GAME', `<div class="loma-saved-banner"><strong>✓ Final mini-game passed</strong><p>${result.objectiveCorrect} / ${result.objectiveTotal} correct · completed on game day ${result.completionDay} · 10 XP earned once</p></div><div class="loma-saved-list">${game.questions.map((question, i) => `<section><small>QUESTION ${i + 1}</small><h3>${esc(question.prompt)}</h3><p class="loma-saved-answer">${esc(result.answers?.[question.id] || 'Correct response saved')}</p><p>${esc(question.explanation || '')}</p></section>`).join('')}</div><p class="loma-small">Source: ${esc(game.source.title)} · ${esc(game.source.author)}${game.source.pages?.length ? ` · physical PDF page ${game.source.pages.join(', ')}` : ''}.</p><div class="loma-actions footer">${button('loma-record-back', 'My final collection')}${button('loma-record-practice', 'Practise again', 'primary')}</div>`, 'loma-record');
    $('#loma-record-back').onclick = openLoma; $('#loma-record-practice').onclick = () => openGame(id, true);
  }
  return { openLoma, openGame, dispose };
}
