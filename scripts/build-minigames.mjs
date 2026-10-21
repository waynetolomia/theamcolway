// Builds the simplified, fully auto-checked mini-games for all 381 book slots.
//
//   node scripts/build-minigames.mjs
//
// Input:  scripts/minigames/source/book-activities.json  (the original book activities, saved once)
//         scripts/minigames/{reading,banks}/*.mjs         (authored question banks)
// Output: the ACTIVITIES line of public/game/book-course.js, the COVERAGE counts,
//         and instructor/MINIGAME_ANSWER_KEY.json.
// Slot ids, semesters, locations and source pages never change, so saved progress stays valid.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { choice, blank, scramble, shuffle, rng, normal, clean } from './minigames/lib.mjs';
import { lightsQuestions } from './minigames/banks/lights.mjs';
import { sequenceQuestions } from './minigames/banks/sequences.mjs';
import { mathQuestions } from './minigames/banks/math.mjs';
import { scienceQuestions } from './minigames/banks/science.mjs';
import COLREG from './minigames/banks/colreg.mjs';
import COLREG_SCENARIOS from './minigames/banks/colreg-scenarios.mjs';
import SAFETY from './minigames/banks/safety.mjs';
import BASE_GRAMMAR from './minigames/banks/grammar.mjs';
import MORE_GRAMMAR from './minigames/banks/grammar-more.mjs';
// Each unit's grammar bank: the original items first, then the added ones.
const GRAMMAR = Object.fromEntries(Object.keys(BASE_GRAMMAR).map(unit => [unit, [...BASE_GRAMMAR[unit], ...(MORE_GRAMMAR[unit] || [])]]));

const root = new URL('../', import.meta.url);
const coursePath = new URL('public/game/book-course.js', root);
const sourcePath = new URL('scripts/minigames/source/book-activities.json', root);
const courseText = readFileSync(coursePath, 'utf8');
const lines = courseText.split('\n');
const activitiesLine = lines.findIndex(line => line.startsWith('export const ACTIVITIES = '));
const coverageLine = lines.findIndex(line => line.startsWith('export const COVERAGE = '));
if (activitiesLine < 0 || coverageLine < 0) throw new Error('book-course.js layout changed: ACTIVITIES/COVERAGE line not found.');

// Save the untouched book activities once; every later build starts from that snapshot.
if (!existsSync(sourcePath)) {
  const original = JSON.parse(lines[activitiesLine].replace(/^export const ACTIVITIES = /, '').replace(/;\s*$/, ''));
  if (!original.some(a => a.type === 'present')) throw new Error('book-course.js no longer holds the original activities and no snapshot exists.');
  mkdirSync(new URL('scripts/minigames/source/', root), { recursive: true });
  writeFileSync(sourcePath, JSON.stringify(original));
}
const SOURCE = JSON.parse(readFileSync(sourcePath, 'utf8'));
const { BOOK_PAGES, UNITS } = await import(pathToFileURL(fileURLToPath(coursePath)).href);
const pageText = page => BOOK_PAGES[page - 1]?.text || '';
const { activitySubject, activityMajor, activityDifficulty, activityHost } = await import(new URL('public/game/curriculum.js', root).href);
const { getGameSkillIds } = await import(new URL('public/game/rpg-progress.js', root).href);
/** Bump when generated wording or answers change, so instructor reviews can be matched to a version. */
const CONTENT_VERSION = 2;

// Authored reading comprehension, keyed by the book's question id.
const READING = {};
for (const file of readdirSync(new URL('scripts/minigames/reading/', root)).filter(f => f.endsWith('.mjs'))) {
  Object.assign(READING, (await import(new URL(`scripts/minigames/reading/${file}`, root).href)).default);
}

// ---------------------------------------------------------------- book-derived generators
const PAIRS_BY_UNIT = new Map();
for (const a of SOURCE) for (const p of a.pairs || []) {
  if (!PAIRS_BY_UNIT.has(a.unit)) PAIRS_BY_UNIT.set(a.unit, []);
  if (!PAIRS_BY_UNIT.get(a.unit).some(x => x.term === p.term)) PAIRS_BY_UNIT.get(a.unit).push(p);
}
const ALL_PAIRS = [...PAIRS_BY_UNIT.values()].flat();
const unitPairs = unit => PAIRS_BY_UNIT.get(unit) || ALL_PAIRS;
const others = (list, exclude, seed, n = 3) => shuffle(list.filter(x => normal(x) !== normal(exclude)), seed).slice(0, n);

function vocabQuestion(id, pair, unit, variant) {
  const pool = unitPairs(unit), terms = pool.map(p => p.term), meanings = pool.map(p => p.meaning);
  const label = `Vocabulary · PDF p.${pair.sourcePage}`;
  const example = pair.example?.replace(/^Question:\s*/i, '');
  const re = new RegExp(pair.term.replace(/^to /, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (variant === 'example' && example && re.test(example)) {
    return choice({ id, label, prompt: `Fill in the blank from the book example:\n“${example.replace(re, '_____')}”`, correct: pair.term.replace(/^to /, ''),
      distractors: others(terms.map(t => t.replace(/^to /, '')), pair.term.replace(/^to /, ''), id, 5), explanation: `Book example: ${example}` });
  }
  if (variant === 'meaning') {
    return choice({ id, label, prompt: `What does “${pair.term}” mean?`, correct: pair.meaning, distractors: others(meanings, pair.meaning, id, 5), explanation: `${pair.term}: ${pair.meaning}` });
  }
  return choice({ id, label, prompt: `Which term matches this meaning?\n“${pair.meaning}”`, correct: pair.term, distractors: others(terms, pair.term, id, 5), explanation: `${pair.term}: ${pair.meaning}` });
}

// Sentences from book pages, for scrambles and reading trivia.
const SKIP = /(CLASS NOTES|Source|fictional|Original|Write|Use the|Read |Answer|Self-check|Check|NOTES|Questions?|e\.g\.|\?|_{3,}|\[|\]|\bS\d\b|V\d|Card|Round|Student|marks?\b|LANGUAGE TRAINING|Not to scale|\/|\.\.\.|…|\bpage\b|\bexercise\b|\bclassroom\b|\blesson\b|Recording script|approx\.|:)/i;
// Classroom task instructions are not maritime content, so they never become a game sentence.
const INSTRUCTION = /^(Use|Add|Avoid|Copy|Circle|Choose|Complete|Match|Work|Listen|Find|Change|Tick|Mark|Compare|Study|Plot|Trace|Name|Score|State|Practise|Practice|Prepare|Give|Ask|Look|Follow|Keep this|Do not (look|write|show|use|stage|fill|invent))\b/;
const SPEAKER = /^(?:CHIEF OFFICER|SECOND OFFICER|THIRD OFFICER|CHIEF ENGINEER|SECOND ENGINEER|THIRD ENGINEER|FOURTH ENGINEER|DUTY ENGINEER|DECK CADET|ENGINE CADET|LOADING MASTER|PORT CONTROL|HARBOUR CONTROL|COAST RADIO|MASTER|BOSUN|PILOT|OOW|TRAINER|CADET)\s+/;
const usable = sentence => {
  const words = sentence.split(' ');
  return words.length >= 5 && words.length <= 13 && /^[A-Z“"]/.test(sentence) && /[.!]$/.test(sentence)
    && !SKIP.test(sentence) && !INSTRUCTION.test(sentence) && !/\s{2,}|•|\|/.test(sentence) && !(/[;:]/.test(sentence.slice(0, -1)) && words.length > 11);
};
function splitSentences(text) {
  return text.split(/(?<=[.!])\s+(?=[A-Z“"])/).map(s => clean(s).replace(SPEAKER, '')).filter(usable);
}
function sentencesFrom(pages) {
  const out = [];
  for (const page of pages) {
    const text = pageText(page).replace(/\n(?=[a-z(])/g, ' ').replace(/[ \t]+/g, ' ');
    for (const line of text.split(/\n+/)) for (const sentence of splitSentences(line.trim())) out.push({ page, sentence });
  }
  return [...new Map(out.map(item => [item.sentence, item])).values()];
}
// Real maritime sentences for scrambles: the unit's dialogue lines and the book's vocabulary examples.
function scrambleSource(unit, fallbackPages) {
  const dialogue = SOURCE.filter(x => x.unit === unit && x.section === 'dialogue');
  const fromScript = dialogue.flatMap(x => splitSentences(clean(x.script || '')).map(sentence => ({ page: x.sourcePages[0], sentence })));
  const examples = unitPairs(unit).map(p => ({ page: p.sourcePage, sentence: clean(p.example?.replace(/^Question:\s*/i, '')) })).filter(x => usable(x.sentence));
  const pages = unit ? sentencesFrom(dialogue.flatMap(x => x.sourcePages)) : sentencesFrom(fallbackPages);
  return [...new Map([...fromScript, ...examples, ...pages].map(item => [item.sentence, item])).values()];
}

const hhmm = minutes => { const m = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`; };
const KEY_PATTERNS = [
  { kind: 'time', re: /\b(?:[01]\d|2[0-3])[0-5]\d\b(?!\s*(?:tonnes|metres|m\b|kg))/ },
  { kind: 'measure', re: /\b\d+(?:[.,]\d+)?\s?(?:metres|m|knots|bar|tonnes|nautical miles|NM|°C|kg|miles|RPM|hours|minutes)\b/ },
];
function triviaQuestion(id, item, unitSentences, unit) {
  const terms = unitPairs(unit).map(p => p.term.replace(/^to /, '')).sort((a, b) => b.length - a.length);
  const term = terms.find(t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(item.sentence));
  let key, kind;
  if (term) { key = item.sentence.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))[0]; kind = 'term'; }
  else for (const p of KEY_PATTERNS) { const m = item.sentence.match(p.re); if (m) { key = m[0]; kind = p.kind; break; } }
  if (!key) return null;
  let pool;
  if (kind === 'term') pool = terms;
  else {
    const re = KEY_PATTERNS.find(p => p.kind === kind).re;
    pool = unitSentences.map(s => s.sentence.match(re)?.[0]).filter(Boolean);
    const n = parseFloat(key.replace(',', '.')), unitWord = key.replace(/^[\d.,\s]+/, '');
    if (kind === 'time') { const minutes = Math.floor(+key / 100) * 60 + (+key % 100); pool.push(...[30, 60, 120, -60, -30].map(d => hhmm(minutes + d))); }
    else pool.push(...[0.5, 2, 1.5, 0.75].map(f => `${+(n * f).toFixed(n % 1 ? 1 : 0)}${unitWord ? (key.includes(' ') ? ' ' : '') + unitWord : ''}`));
  }
  const distractors = others([...new Set(pool)], key, id, 3);
  if (distractors.length < 3) return null;
  return choice({ id, label: `Reading trivia · PDF p.${item.page}`, prompt: `Complete the sentence from the book (PDF p.${item.page}):\n“${item.sentence.replace(key, '_____')}”`,
    correct: key, distractors, explanation: `The book says: “${item.sentence}”` });
}

/** Converts an existing exact book question to choice or scramble format. */
function convertExact(q, siblings, seed) {
  const accepted = q.answers;
  if (q.options?.length) return choice({ id: q.id, prompt: q.prompt.split('\n\n')[0], correct: accepted.find(a => q.options.some(o => normal(o) === normal(a))) || accepted[0],
    distractors: q.options, explanation: q.explanation, label: q.sourceLabel });
  const main = accepted[0], words = main.split(/\s+/);
  if (words.length >= 4 && !main.includes('/') && !/\d/.test(main)) {
    return { ...scramble({ id: q.id, prompt: `${q.prompt}\nBuild the answer with the word tiles.`, sentence: main, accepted: accepted.slice(1), explanation: q.explanation, label: q.sourceLabel }) };
  }
  // Wrong options come from sibling answers of a similar shape (e.g. other message cards).
  const pool = [...new Set(siblings.flatMap(s => s.answers?.[0] ? [s.answers[0]] : []))]
    .filter(x => !accepted.some(a => normal(a) === normal(x)) && Math.abs(x.split(/\s+/).length - words.length) <= 1);
  if (pool.length >= 2) return choice({ id: q.id, prompt: q.prompt, correct: main, distractors: shuffle(pool, seed).slice(0, 3), explanation: q.explanation, label: q.sourceLabel });
  return blank({ id: q.id, prompt: q.prompt, answers: accepted, explanation: q.explanation, label: q.sourceLabel });
}

// ---------------------------------------------------------------- authored banks
function bankTake(bank, name) {
  let cursor = 0;
  return (count, idPrefix) => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const [prompt, correct, distractors, explanation] = bank[cursor % bank.length]; cursor++;
      items.push(choice({ id: `${idPrefix}-${i + 1}`, prompt, correct, distractors, explanation, label: name }));
    }
    return items;
  };
}
/** An equivalent set drawn from a bank with its own seed (used for alternative question sets). */
function bankPick(bank, name, seed, count, idPrefix) {
  return shuffle(bank, seed).slice(0, count).map(([prompt, correct, distractors, explanation], i) =>
    choice({ id: `${idPrefix}-${i + 1}`, prompt, correct, distractors, explanation, label: name }));
}
const takeColreg = bankTake(COLREG, 'COLREG 1972');
const takeSafety = bankTake(SAFETY, 'Safety at sea');
const grammarCursor = new Map();
function takeGrammar(unit, count, idPrefix) {
  const bank = GRAMMAR[unit] || GRAMMAR.review;
  const start = grammarCursor.get(unit) || 0; grammarCursor.set(unit, start + count);
  return Array.from({ length: count }, (_, i) => {
    const item = bank[(start + i) % bank.length];
    if (item.scramble) return scramble({ id: `${idPrefix}-${i + 1}`, prompt: item.prompt || 'Put the words in the correct order.', sentence: item.scramble, explanation: item.explanation, label: `Grammar · ${UNITS.find(u => u.id === unit)?.grammar || 'review'}` });
    const [prompt, correct, distractors, explanation] = item;
    return choice({ id: `${idPrefix}-${i + 1}`, prompt, correct, distractors, explanation, label: `Grammar · ${UNITS.find(u => u.id === unit)?.grammar || 'review'}` });
  });
}

// ---------------------------------------------------------------- slot mapping
const GAME = {
  match: { title: 'Vocabulary match', instructions: 'Choose the correct answer for each maritime term from the book.' },
  quiz: { title: 'Multiple choice', instructions: 'Choose the best answer. Every question comes from this unit of the book.' },
  reading: { title: 'Reading comprehension', instructions: 'Read the book page, then choose the best answer to each question.' },
  trivia: { title: 'Reading trivia', instructions: 'Read the book page, then choose the word or figure that completes each sentence.' },
  fill: { title: 'Fill in the blanks', instructions: 'Type the missing word or words. Check the verb form and spelling.' },
  order: { title: 'Sentence scramble', instructions: 'Tap the word tiles in the correct order to rebuild each sentence from the book.' },
  grammar: { title: 'Grammar challenge', instructions: 'Choose the correct form or build the sentence with the tiles.' },
  listen: { title: 'Listening challenge', instructions: 'Play the audio or read the transcript, then answer each question.' },
  safety: { title: 'Safety drill', instructions: 'Choose the safest, most correct answer.' },
  colreg: { title: 'COLREG rules', instructions: 'International Regulations for Preventing Collisions at Sea, 1972. Choose the correct answer.' },
  math: { title: 'Maritime mathematics', instructions: 'Work out the answer, then choose it. Use the working space on paper if you need it.' },
  science: { title: 'Maritime science', instructions: 'Choose the correct answer using basic science for ships and the sea.' },
};

function kindFor(a, index) {
  const exact = a.questions.filter(q => q.answers?.length).length;
  switch (a.section) {
    case 'unit-introduction': return 'trivia';
    case 'vocabulary': return a.type === 'match' ? 'match' : 'fill-vocab';
    case 'dialogue': return 'listen';
    case 'dialogue-comprehension': case 'article-comprehension': case 'unit-test-reading': return 'reading';
    case 'document': case 'article': return 'trivia';
    case 'grammar-guide': return 'grammar';
    case 'grammar-a': return 'fill';
    case 'grammar-bc': return exact ? 'quiz' : 'grammar';
    case 'grammar-de': return 'order';
    case 'speaking': return a.type === 'present' ? 'order' : 'math';
    case 'practical': return index % 2 ? 'safety' : 'science';
    case 'visual-resource':
      if (exact >= 3) return 'quiz';
      if (['bridge', 'ecdis'].includes(a.room)) return 'colreg';
      if (a.room === 'engine' || a.location === 'workshop') return 'science';
      if (['gmdss', 'captain'].includes(a.room)) return 'safety';
      return index % 2 ? 'colreg' : 'math';
    case 'worksheet': return exact ? 'quiz' : 'math';
    case 'unit-test-ab': return exact ? 'quiz' : index % 2 ? 'colreg' : 'quiz-review';
    case 'unit-test-performance': return a.type === 'present' ? 'colreg' : 'safety';
    case 'final-assessment':
      if (a.type === 'listen') return 'listen-exact';
      if (exact) return 'quiz';
      if (a.type === 'response') return 'reading';
      return a.type === 'record' ? (a.id.endsWith('151') ? 'math' : 'science') : (a.id.endsWith('153') ? 'colreg' : 'safety');
    default: return exact ? 'quiz' : 'trivia';
  }
}

// Scramble sentences are not repeated between games of the same unit while fresh ones remain.
const usedScramble = new Map();
function takeFresh(unit, sentences, count = QUESTIONS_PER_GAME) {
  const used = usedScramble.get(unit) || new Set(); usedScramble.set(unit, used);
  const fresh = sentences.filter(s => !used.has(s));
  const picked = [...fresh, ...sentences.filter(s => used.has(s))].slice(0, count);
  picked.forEach(s => used.add(s));
  return picked;
}

const sectionIndex = new Map();
const stats = {};
const QUESTIONS_PER_GAME = 5;

function build(a) {
  const key = `${a.unit}:${a.section}`; const index = sectionIndex.get(key) || 0; sectionIndex.set(key, index + 1);
  let kind = kindFor(a, index);
  const unit = Number.isInteger(a.unit) ? a.unit : null;
  const pages = [...new Set([...(a.studyPages || []), ...(a.sourcePages || [])])];
  const exactQs = a.questions.filter(q => q.answers?.length);
  const year = Math.min(4, Math.max(1, Math.ceil(a.semester / 2)));
  let questions = [];
  // Equivalent alternative sets: a cadet plays one, chosen per journey (see plannedVariant).
  const variants = [];

  if (kind === 'reading') {
    for (const q of a.questions) {
      const r = READING[q.id];
      if (!r) continue;
      const [prompt, correct, distractors, explanation] = r;
      questions.push(choice({ id: q.id, prompt: prompt || q.prompt.replace(/\s*\[\d marks?\]\s*$/, '').replace(/\s+B$/, ''), correct, distractors, explanation, label: `Reading comprehension · PDF p.${a.sourcePages.join(', ')}` }));
    }
    if (!questions.length) kind = 'trivia';
  }
  if (kind === 'match') questions = a.questions.map((q, i) => { const pair = a.pairs?.[i] || ALL_PAIRS.find(p => normal(p.term) === normal(q.answers[0])); return pair ? vocabQuestion(q.id, pair, unit, 'term') : convertExact(q, a.questions, q.id); });
  if (kind === 'fill-vocab') {
    const pairs = shuffle(unitPairs(unit), a.id).slice(0, QUESTIONS_PER_GAME);
    questions = pairs.map((p, i) => vocabQuestion(`${a.id}-v${i + 1}`, p, unit, i % 2 ? 'meaning' : 'example'));
    const spare = shuffle(unitPairs(unit).filter(p => !pairs.includes(p)), `${a.id}:b`).slice(0, QUESTIONS_PER_GAME);
    if (spare.length >= 4) variants.push({ set: 'b', major: 'common', questions: spare.map((p, i) => vocabQuestion(`${a.id}-b-v${i + 1}`, p, unit, i % 2 ? 'example' : 'meaning')) });
    kind = 'fill';
  }
  if ((kind === 'quiz' || kind === 'fill') && !questions.length) questions = exactQs.map(q => kind === 'fill' ? blank({ id: q.id, prompt: q.prompt, answers: q.answers, explanation: q.explanation, label: q.sourceLabel }) : convertExact(q, exactQs, q.id));
  if (kind === 'quiz-review') {
    const pairs = shuffle(unitPairs(unit), `${a.id}:review`).slice(0, QUESTIONS_PER_GAME);
    questions = pairs.map((p, i) => vocabQuestion(`${a.id}-r${i + 1}`, p, unit, ['meaning', 'term', 'example'][i % 3]));
    kind = 'quiz';
  }
  if (kind === 'listen-exact') { questions = exactQs.map(q => blank({ id: q.id, prompt: q.prompt.replace(/\s*\[\d marks?\]\s*$/, ''), answers: q.answers, explanation: q.explanation, label: q.sourceLabel })); kind = 'listen'; }
  if (kind === 'listen' && !questions.length) {
    // Only what the speakers actually say: the script, then the printed dialogue page.
    const pool = [...new Set([...splitSentences(clean(a.script || '')), ...sentencesFrom(a.sourcePages).map(l => l.sentence)])];
    questions = takeFresh(unit, shuffle(pool, a.id)).map((sentence, i) => scramble({ id: `${a.id}-l${i + 1}`, prompt: 'Listen to the dialogue, then rebuild what the speaker said.', sentence, label: `Listening · PDF p.${a.sourcePages.join(', ')}` }));
  }
  if (kind === 'order') {
    const pool = shuffle(scrambleSource(unit, pages), a.id);
    const chosen = takeFresh(unit, pool.map(item => item.sentence));
    questions = chosen.map((sentence, i) => scramble({ id: `${a.id}-s${i + 1}`, sentence, label: `Sentence scramble · PDF p.${pool.find(x => x.sentence === sentence).page}` }));
    if (questions.length < 3) { questions = takeGrammar(unit, QUESTIONS_PER_GAME, `${a.id}-g`); kind = 'grammar'; }
  }
  if (kind === 'trivia') {
    const unitPages = unit ? [...new Set(SOURCE.filter(x => x.unit === unit).flatMap(x => x.sourcePages))] : pages;
    const unitSentences = sentencesFrom(unitPages);
    const own = sentencesFrom(pages);
    const candidates = shuffle(own, a.id).concat(shuffle(unitSentences.filter(s => !own.includes(s)), `${a.id}:unit`));
    for (const item of candidates) {
      if (questions.length >= QUESTIONS_PER_GAME) break;
      const q = triviaQuestion(`${a.id}-t${questions.length + 1}`, item, unitSentences, unit);
      if (q && !questions.some(x => x.prompt === q.prompt)) questions.push(q);
    }
    if (questions.length < 3) {
      const pairs = shuffle(unitPairs(unit), `${a.id}:trivia`).slice(0, QUESTIONS_PER_GAME - questions.length);
      questions.push(...pairs.map((p, i) => vocabQuestion(`${a.id}-tv${i + 1}`, p, unit, 'example')));
    }
  }
  if (kind === 'grammar' && !questions.length) questions = takeGrammar(unit, QUESTIONS_PER_GAME, `${a.id}-g`);
  if (kind === 'grammar') {
    // An equivalent set from the unit's other grammar items.
    const used = new Set(questions.map(q => normal(q.prompt)));
    const spare = shuffle((GRAMMAR[unit] || GRAMMAR.review).filter(item => !used.has(normal(item.scramble ? item.prompt || 'Put the words in the correct order.' : item[0]))), `${a.id}:b`).slice(0, QUESTIONS_PER_GAME);
    if (spare.length >= 4) variants.push({ set: 'b', major: 'common', questions: spare.map((item, i) => item.scramble
      ? scramble({ id: `${a.id}-b-gr${i + 1}`, prompt: item.prompt || 'Put the words in the correct order.', sentence: item.scramble, explanation: item.explanation, label: `Grammar · ${UNITS.find(u => u.id === unit)?.grammar || 'review'}` })
      : choice({ id: `${a.id}-b-gr${i + 1}`, prompt: item[0], correct: item[1], distractors: item[2], explanation: item[3], label: `Grammar · ${UNITS.find(u => u.id === unit)?.grammar || 'review'}` })) });
  }
  if (kind === 'colreg') {
    // Years 3–4 apply the rules to situations; earlier years learn the rules and lights.
    const situations = year >= 3 ? 2 : 0;
    questions = [...takeColreg(3 - situations, `${a.id}-c`), ...bankPick(COLREG_SCENARIOS, 'COLREG 1972 · situation', `${a.id}:situations`, situations, `${a.id}-cs`), ...lightsQuestions(a.id, 2)];
    variants.push({ set: 'b', major: 'common', questions: [...bankPick(COLREG, 'COLREG 1972', `${a.id}:b`, 3 - situations, `${a.id}-b-c`), ...bankPick(COLREG_SCENARIOS, 'COLREG 1972 · situation', `${a.id}:b:situations`, situations, `${a.id}-b-cs`), ...lightsQuestions(a.id, 2, `${a.id}:b`, 'b-')] });
  }
  if (kind === 'safety') {
    questions = [...takeSafety(4, `${a.id}-sf`), ...sequenceQuestions(`${a.id}-p`, 1, { year })];
    variants.push({ set: 'b', major: 'common', questions: [...bankPick(SAFETY, 'Safety at sea', `${a.id}:b`, 4, `${a.id}-b-sf`), ...sequenceQuestions(`${a.id}-b-p`, 1, { year, seed: `${a.id}:b` })] });
  }
  if (kind === 'math') {
    questions = mathQuestions(a.id, QUESTIONS_PER_GAME, { unit, semester: a.semester });
    for (const [set, major] of [['b', 'deck'], ['c', 'engine']]) variants.push({ set, major, questions: mathQuestions(a.id, QUESTIONS_PER_GAME, { semester: a.semester, major, set }) });
  }
  if (kind === 'science') {
    questions = scienceQuestions(a.id, QUESTIONS_PER_GAME, { unit, semester: a.semester });
    for (const [set, major] of [['b', 'deck'], ['c', 'engine']]) variants.push({ set, major, questions: scienceQuestions(a.id, QUESTIONS_PER_GAME, { semester: a.semester, major, set }) });
  }

  if (!questions.length) throw new Error(`No questions generated for ${a.id} (${kind}).`);
  // Short book rounds are topped up with vocabulary from the same unit so every game has 4+ questions.
  if (questions.length < 4) {
    const extra = shuffle(unit ? unitPairs(unit) : ALL_PAIRS, `${a.id}:topup`).slice(0, 4 - questions.length);
    questions.push(...extra.map((p, i) => vocabQuestion(`${a.id}-x${i + 1}`, p, unit, ['meaning', 'example', 'term'][i % 3])));
  }
  stats[kind] = (stats[kind] || 0) + 1;
  const game = GAME[kind];
  const unitTitle = UNITS.find(u => u.id === unit)?.title || 'Final assessment';
  const { questions: _q, criteria, reviewMode, presentation, adaptation, wordBank, ...slot } = a;
  const built = {
    ...slot,
    type: kind,
    title: `${game.title} — ${unitTitle}${a.title.match(/ · (round )?\d+$/)?.[0] || ''}`,
    instructions: game.instructions,
    reviewMode: 'exact',
    estimatedMinutes: Math.max(2, Math.ceil(questions.length * 0.8)),
    ...(kind === 'listen' && a.script ? { adaptation: 'Device speech reads the book dialogue. Listen or read the transcript, then answer.' } : {}),
    questions,
  };
  const everyQuestion = [questions, ...variants.map(v => v.questions)].flat();
  built.studyNotes = studyNotesFor(kind, unit, a, everyQuestion);
  built.meta = { version: CONTENT_VERSION, subject: activitySubject(built), major: activityMajor(built), difficulty: activityDifficulty(built),
    host: activityHost(built), mechanics: [...new Set(everyQuestion.map(q => q.format))], source: BANK_KINDS.has(kind) ? 'authored-bank' : 'book',
    reviewStatus: 'auto-checked; instructor review pending' };
  if (variants.length) built.variants = variants;
  return built;
}

const BANK_KINDS = new Set(['colreg', 'safety', 'math', 'science', 'grammar']);
const KIND_NOTES = {
  math: ['Write down what you know and what you need before you calculate.', 'Distance = speed × time, so time = distance ÷ speed.', 'Check the units: knots, nautical miles, tonnes, cubic metres.'],
  science: ['Mass = density × volume.', 'Read a gauge by finding the value of one small division first.', 'Ohm’s law: V = I × R. Power: P = V × I.'],
  colreg: ['Rule 5: keep a proper lookout at all times.', 'Rules 13–15: overtaking, head-on and crossing situations.', 'Sidelights: red is port and green is starboard; the stern light is white.', 'Lights in a vertical line show a special status (Rules 26–30).'],
  safety: ['Raise the alarm first, then act only when it is safe.', 'Know your muster station and your duties on the muster list.', 'Never enter an enclosed space without a permit and a tested atmosphere.'],
};
/** Short review notes shown under each game: no answers, only what to look at or remember. */
function studyNotesFor(kind, unit, a, questions) {
  const unitInfo = UNITS.find(u => u.id === unit);
  const notes = [...(KIND_NOTES[kind] || [])];
  if (!KIND_NOTES[kind]) {
    notes.push(`Review ${unitInfo ? `Unit ${unitInfo.id}, ${unitInfo.title}` : 'the final assessment'} on PDF p.${a.sourcePages.join(', ')}.`);
    if (unitInfo?.grammar) notes.push(`Grammar focus: ${unitInfo.grammar}.`);
  }
  for (const hint of new Set(questions.map(q => q.hint).filter(Boolean))) if (notes.length < 6) notes.push(hint);
  return notes;
}

// Tidy prompts: no exam mark labels, and very long book instructions keep only their first sentence.
const tidyPrompt = prompt => {
  const text = prompt.replace(/\s*\[\d+ marks?\]/g, '').trim();
  if (text.length <= 170 || text.includes('\n')) return text;
  const first = text.match(/^.+?[.?!](?=\s|$)/)?.[0];
  return first && first.length >= 20 ? first : text;
};
const ACTIVITIES = SOURCE.map(build).map(a => ({ ...a, questions: a.questions.map(q => ({ ...q, prompt: tidyPrompt(q.prompt) })) }));

// ---------------------------------------------------------------- write outputs
for (const a of ACTIVITIES) for (const v of a.variants || []) v.questions = v.questions.map(q => ({ ...q, prompt: tidyPrompt(q.prompt) }));
const questions = ACTIVITIES.flatMap(a => a.questions);
const allSets = ACTIVITIES.flatMap(a => [{ a, set: 'a', major: 'common', questions: a.questions }, ...(a.variants || []).map(v => ({ a, ...v }))]);
const ids = new Set(); for (const { questions: qs } of allSets) for (const q of qs) { if (ids.has(q.id)) throw new Error(`Duplicate question id ${q.id}`); ids.add(q.id); }
lines[activitiesLine] = `export const ACTIVITIES = ${JSON.stringify(ACTIVITIES)};`;
const coverage = JSON.parse(lines[coverageLine].replace(/^export const COVERAGE = /, '').replace(/;\s*$/, ''));
const playable = allSets.reduce((n, s) => n + s.questions.length, 0);
coverage.counts = { ...coverage.counts, activities: ACTIVITIES.length, questions: questions.length, exactQuestions: questions.length, selfReviewQuestions: 0, variantSets: allSets.length - ACTIVITIES.length, playableQuestions: playable };
coverage.minigames = { generator: 'scripts/build-minigames.mjs', types: stats };
lines[coverageLine] = `export const COVERAGE = ${JSON.stringify(coverage)};`;
writeFileSync(coursePath, lines.join('\n'));

const keyQuestion = q => ({ id: q.id, format: q.format, prompt: q.prompt, answer: q.answers[0], ...(q.options ? { options: q.options } : {}),
  ...(q.format === 'number' ? { value: q.value, tolerance: q.tolerance, unit: q.unit } : {}), ...(q.figure ? { figure: q.figure.kind } : {}) });
const key = ACTIVITIES.map(a => ({ id: a.id, semester: a.semester, location: a.location, type: a.type, title: a.title,
  questions: a.questions.map(keyQuestion), ...(a.variants ? { variants: a.variants.map(v => ({ set: v.set, major: v.major, questions: v.questions.map(keyQuestion) })) } : {}) }));
writeFileSync(new URL('instructor/MINIGAME_ANSWER_KEY.json', root), JSON.stringify({ generatedBy: 'scripts/build-minigames.mjs', games: key.length, questions: questions.length, playableQuestions: playable, types: stats, games_list: key }, null, 1));

// Structured question bank: one record per playable question with its curriculum metadata.
const OBJECTIVES = {
  match: 'Recognise and use maritime vocabulary from the unit.', fill: 'Use unit vocabulary and grammar accurately in context.',
  quiz: 'Apply the unit’s vocabulary and language accurately.', reading: 'Understand key information in a maritime text.',
  trivia: 'Read a maritime text for key words and figures.', listen: 'Understand and rebuild spoken maritime messages.',
  order: 'Build clear, correctly ordered maritime sentences.', grammar: 'Use the unit’s grammar structure accurately.',
  safety: 'Recall safe practice and emergency procedures at sea.', colreg: 'Apply the COLREG 1972 rules and identify lights.',
  math: 'Carry out maritime calculations with the correct units.', science: 'Apply basic science to ships, engines and the sea.',
};
const bank = allSets.flatMap(({ a, set, major, questions: qs }) => qs.map(q => ({
  id: q.id, version: CONTENT_VERSION, activityId: a.id, set, setMajor: major, objective: OBJECTIVES[a.type] || 'Apply the unit’s learning.',
  subject: a.meta.subject, year: Math.ceil(a.semester / 2), semester: a.semester, major: a.meta.major, difficulty: a.meta.difficulty,
  activityType: a.type, location: a.location, room: a.room || null, npc: a.meta.host, format: q.format, prompt: q.prompt,
  ...(q.options ? { options: q.options } : {}), ...(q.tokens ? { tokens: q.tokens } : {}), answers: q.answers,
  ...(q.format === 'number' ? { value: q.value, tolerance: q.tolerance, unit: q.unit || '' } : {}), ...(q.figure ? { figure: q.figure } : {}),
  hint: q.hint || null, explanation: q.explanation || '', skills: getGameSkillIds('book', a, ACTIVITIES), xpCategory: 'book',
  source: q.sourceLabel || a.meta.source, sourcePages: a.sourcePages, reviewStatus: a.meta.reviewStatus })));
writeFileSync(new URL('instructor/QUESTION_BANK.json', root), JSON.stringify({ generatedBy: 'scripts/build-minigames.mjs', version: CONTENT_VERSION, questions: bank.length, bank }, null, 1));

const formats = questions.reduce((m, q) => (m[q.format] = (m[q.format] || 0) + 1, m), {});
console.log(`Built ${ACTIVITIES.length} mini-games, ${questions.length} main questions, ${playable} playable with ${allSets.length - ACTIVITIES.length} alternative sets.`, { types: stats, formats });
