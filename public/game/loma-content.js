/** Loma Lounge finals reuse taught objective work; source records remain untouched.
 * Book tasks are partitioned into distinct, disjoint 2–4-question review rounds.
 * The final is a game achievement, separate from the source course grades.
 */
import { ACTIVITIES, BOOK, UNITS } from './book-course.js';
import { NPC_MISSIONS, getNPC } from './npc-content.js';
import { SAFETY_GAMES, getSafetyReferences } from './lifeboat-content.js';

export const LOMA_FINAL_COUNT = 50;
export const LOMA_DAILY_LIMIT = 5;
export const LOMA_SELECTION_BLUEPRINT = { major: 20, academic: 20, safety: 6, staff: 4 };
export const LOMA_MAJOR_LABELS = { deck: 'DECK', engine: 'ENGINE' };

const normal = value => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
const objectiveAnswers = question => Array.isArray(question.answers) && question.answers.every(value => typeof value === 'string')
  ? question.answers.filter(value => value.trim()) : typeof question.answer === 'string' && question.answer.trim() ? [question.answer] : [];

function adaptQuestion(question) {
  const answers = objectiveAnswers(question);
  if (!answers.length) return null;
  if (['choice', 'number', 'order'].includes(question.type)) return { ...question, answers };
  const options = Array.isArray(question.options) ? question.options.filter(value => typeof value === 'string') : [];
  const acceptedOptions = options.filter(option => answers.some(answer => normal(answer) === normal(option)));
  if (options.length >= 2 && acceptedOptions.length) {
    return { ...question, type: 'choice', answers, options, prompt: question.prompt.split('\n\n')[0].replace('Enter its letter or the complete meaning.', 'Choose the matching meaning.') };
  }
  const tokens = answers[0].split(/\s+/);
  if (tokens.length >= 4 && tokens.length <= 20 && !answers[0].includes('/') && !answers[0].includes('\n')) {
    return { ...question, type: 'order', answers, tokens, prompt: `${question.prompt}\nBuild the correct answer with every tile.` };
  }
  return { ...question, type: 'text', answers };
}

function partition(questions) {
  const groups = [];
  for (let i = 0; i < questions.length; i += 3) groups.push(questions.slice(i, i + 3));
  if (groups.length > 1 && groups.at(-1).length === 1) groups.at(-2).push(...groups.pop());
  return groups.filter(group => group.length >= 2);
}

function bookMajor(activity) {
  if ([3, 4, 7, 8].includes(activity.unit) || activity.sourcePages?.includes(235)) return 'deck';
  if (activity.unit === 9 || activity.sourcePages?.includes(236)) return 'engine';
  return 'shared';
}

const bookGames = ACTIVITIES.filter(activity => activity.type !== 'listen').flatMap(activity => {
  const questions = activity.questions.map(adaptQuestion).filter(Boolean);
  const groups = partition(questions);
  const unit = UNITS.find(item => item.id === activity.unit);
  const major = bookMajor(activity);
  const kind = activity.type === 'match' ? 'Vocabulary' : activity.type === 'record' ? 'Evidence reading' : 'Language accuracy';
  return groups.map((group, index) => ({
    id: `loma-book-${activity.id}-${index + 1}`, major, category: major === 'shared' ? 'academic' : 'major',
    title: `${unit?.title || 'Course review'} · ${kind} · p${activity.sourcePages?.[0] || '?'}${groups.length > 1 ? ` · ${index + 1}` : ''}`,
    summary: `${group.length} questions adapted from “${activity.title}”.`,
    instructions: 'Complete each presented question. Keep the source meaning, figures, units, and requested language form. All answers must pass.',
    learning: [], questions: group,
    source: { kind: 'book', activityId: activity.id, title: BOOK.title, author: BOOK.author,
      pages: [...(activity.sourcePages || [])], images: [...(activity.sourceImages || [])],
      href: `${BOOK.pdfUrl}#page=${activity.sourcePages?.[0] || 1}`, instructions: activity.instructions,
      note: `Loma final adaptation: ${group.length} objective items from this taught activity. Open responses and self-review items are excluded.`,
      openByDefault: activity.type === 'record' },
  }));
});

const staffGames = NPC_MISSIONS.filter(mission => mission.npcId !== 'dream').map(mission => {
  const major = ['asawin', 'gerald', 'aphisit', 'anne'].includes(mission.npcId) ? 'engine' : ['jakk', 'duke'].includes(mission.npcId) ? 'deck' : 'shared';
  return {
    id: `loma-staff-${mission.id}`, major, category: major === 'shared' ? 'staff' : 'major',
    title: `${getNPC(mission.npcId)?.name || 'Staff'} · ${mission.title}`,
    summary: `${mission.questions.length} questions reviewing this taught staff challenge.`,
    instructions: `Classroom final review of ${getNPC(mission.npcId)?.name || 'your mentor'}’s taught challenge. Answer every question correctly. Your current outfit is accepted at Loma Lounge.`, learning: [], questions: mission.questions.map(adaptQuestion).filter(Boolean),
    source: { kind: 'staff', activityId: mission.id, title: mission.title, author: getNPC(mission.npcId)?.name || 'AMCOL staff',
      instructions: mission.instructions,
      note: 'Loma final adaptation of the existing THE AMCOL WAY staff challenge. Original location rules describe the source task; this is its classroom review. The final result is separate from the staff sign-off.' },
  };
});

const safetyGames = SAFETY_GAMES.map(game => ({
  id: `loma-safety-${game.id}`, major: 'shared', category: 'safety', title: `Safety review · ${game.title}`,
  summary: 'Four questions about taught safety vocabulary, evidence, or communication.',
  instructions: game.instructions, learning: [...game.learning], questions: game.questions.map(adaptQuestion),
  source: { kind: 'safety', activityId: game.id, title: game.title, author: 'THE AMCOL WAY · Lifeboat safety games',
    references: getSafetyReferences(game), note: 'Loma classroom review of the existing fictional safety exercise. No Lifeboat entry or equipment operation is involved.' },
}));

export const LOMA_GAMES = [...bookGames, ...staffGames, ...safetyGames];
const catalog = new Map(LOMA_GAMES.map(game => [game.id, game]));
export const getLomaGame = id => catalog.get(id) || null;
export const getLomaCandidates = major => LOMA_GAMES.filter(game => game.major === 'shared' || game.major === major);

function shuffled(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('The final selection needs a random value in [0, 1).');
    const j = Math.floor(sample * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Randomness is supplied only by the server; payload fields never select the exam. */
export function drawLomaSet(major, random) {
  if (!['deck', 'engine'].includes(major)) throw new Error('Select DECK or ENGINE before drawing a final.');
  const candidates = getLomaCandidates(major), selected = [];
  for (const [category, count] of Object.entries(LOMA_SELECTION_BLUEPRINT)) {
    const pool = candidates.filter(game => game.category === category);
    if (pool.length < count) throw new Error(`The ${major} final has too few ${category} games.`);
    selected.push(...shuffled(pool, random).slice(0, count).map(game => game.id));
  }
  return shuffled(selected, random);
}
