// Shared helpers for the mini-game generator. Everything is deterministic: the same
// inputs always produce the same games, so saved progress and answer keys stay stable.

export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rng(seed) {
  let s = hash(seed) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function shuffle(values, seed) {
  const a = [...values], next = rng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const pick = (values, seed) => values[Math.floor(rng(seed)() * values.length)];

export const normal = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();

/**
 * A multiple-choice question. Options are stored shuffled; the answer is the correct option text.
 * `figure` adds a drawn diagram (a gauge or a vessel's lights) rendered above the options.
 */
export function choice({ id, prompt, correct, distractors, explanation, label, seed = id, figure, hint }) {
  const seen = new Set([normal(correct)]);
  const wrong = [];
  for (const d of distractors) { const n = normal(d); if (d && !seen.has(n)) { seen.add(n); wrong.push(String(d)); } }
  if (wrong.length < 2) throw new Error(`Question ${id} needs at least two distinct distractors.`);
  return { id, type: 'fill', format: 'choice', prompt, options: shuffle([String(correct), ...wrong.slice(0, 3)], `${seed}:options`),
    answers: [String(correct)], explanation, sourceLabel: label, ...(figure ? { figure } : {}), ...(hint ? { hint } : {}) };
}

/** A number-entry question: any typed number within `tolerance` of `value` is correct. */
export function number({ id, prompt, value, tolerance = 0, unit = '', explanation, label, hint }) {
  if (!Number.isFinite(value)) throw new Error(`Question ${id} needs a numeric value.`);
  const shown = +value.toFixed(3);
  return { id, type: 'fill', format: 'number', prompt, value: shown, tolerance, ...(unit ? { unit } : {}),
    answers: [String(shown)], explanation, sourceLabel: label, ...(hint ? { hint } : {}) };
}

/** Steps joined by this mark form a sequence answer. */
export const STEP_JOIN = ' | ';

/** A sequencing question: tap the steps into the correct order. */
export function sequence({ id, prompt, steps, explanation, label, hint }) {
  if (steps.length < 3) throw new Error(`Question ${id} needs at least three steps.`);
  let tokens = shuffle(steps, `${id}:steps`);
  for (let attempt = 1; tokens.join(STEP_JOIN) === steps.join(STEP_JOIN) && attempt < 6; attempt++) tokens = shuffle(steps, `${id}:steps:${attempt}`);
  if (tokens.join(STEP_JOIN) === steps.join(STEP_JOIN)) tokens = [...steps.slice(1), steps[0]];
  return { id, type: 'fill', format: 'sequence', prompt, tokens, answers: [steps.join(STEP_JOIN)],
    explanation: explanation || `Correct order: ${steps.join(' → ')}`, sourceLabel: label, ...(hint ? { hint } : {}) };
}

/** A typed fill-in-the-blank question with accepted alternatives. */
export function blank({ id, prompt, answers, explanation, label, hint }) {
  return { id, type: 'fill', format: 'blank', prompt, answers: [...answers], explanation, sourceLabel: label, ...(hint ? { hint } : {}) };
}

/** A sentence scramble: tap the word tiles into the correct order. */
export function scramble({ id, prompt = 'Put the words in the correct order to make the sentence.', sentence, accepted = [], explanation, label }) {
  const words = sentence.trim().split(/\s+/);
  let tokens = shuffle(words, `${id}:tiles`);
  for (let attempt = 1; tokens.join(' ') === words.join(' ') && attempt < 6; attempt++) tokens = shuffle(words, `${id}:tiles:${attempt}`);
  if (tokens.join(' ') === words.join(' ')) tokens = [...words.slice(1), words[0]];
  return { id, type: 'fill', format: 'scramble', prompt, tokens, answers: [sentence.trim(), ...accepted], explanation: explanation || `Correct order: ${sentence.trim()}`, sourceLabel: label };
}

export const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
