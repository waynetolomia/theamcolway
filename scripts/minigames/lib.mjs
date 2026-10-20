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

/** A multiple-choice question. Options are stored shuffled; the answer is the correct option text. */
export function choice({ id, prompt, correct, distractors, explanation, label, seed = id }) {
  const seen = new Set([normal(correct)]);
  const wrong = [];
  for (const d of distractors) { const n = normal(d); if (d && !seen.has(n)) { seen.add(n); wrong.push(String(d)); } }
  if (wrong.length < 2) throw new Error(`Question ${id} needs at least two distinct distractors.`);
  return { id, type: 'fill', format: 'choice', prompt, options: shuffle([String(correct), ...wrong.slice(0, 3)], `${seed}:options`),
    answers: [String(correct)], explanation, sourceLabel: label };
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
