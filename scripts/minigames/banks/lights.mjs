// COLREG 1972 lights and shapes at night, drawn as a figure: identify the vessel or situation.
// Positions are on a 100 × 100 view (x across, y down). “Left/right” are as the observer sees them:
// a vessel heading towards you shows her green (starboard) light on your left.
import { choice, shuffle } from '../lib.mjs';

const L = (color, x, y) => ({ color, x, y });
const ENTRIES = [
  ['A power-driven vessel under 50 m heading towards you', [L('white', 50, 22), L('green', 36, 62), L('red', 64, 62)], 'Masthead light with both sidelights: you see her head-on (Rules 23 and 14).'],
  ['A power-driven vessel crossing, showing her starboard side', [L('white', 46, 24), L('green', 60, 62)], 'Masthead light and a green sidelight: you see her starboard side (Rule 23).'],
  ['A power-driven vessel crossing, showing her port side', [L('white', 54, 24), L('red', 40, 62)], 'Masthead light and a red sidelight: you see her port side. If she is on your starboard side, you are the give-way vessel (Rule 15).'],
  ['A vessel seen from astern', [L('white', 50, 62)], 'A single white stern light: you are looking at her from astern, so you would be overtaking (Rule 13).'],
  ['A power-driven vessel of 50 m or more heading towards you', [L('white', 44, 34), L('white', 56, 16), L('green', 32, 64), L('red', 68, 64)], 'Two masthead lights, the after one higher, plus both sidelights: a vessel of 50 m or more, head-on (Rule 23).'],
  ['A vessel not under command', [L('red', 50, 26), L('red', 50, 48)], 'Two all-round red lights in a vertical line (Rule 27).'],
  ['A vessel restricted in her ability to manoeuvre', [L('red', 50, 18), L('white', 50, 38), L('red', 50, 58)], 'Red, white, red all-round lights in a vertical line (Rule 27).'],
  ['A vessel constrained by her draught', [L('red', 50, 16), L('red', 50, 36), L('red', 50, 56)], 'Three all-round red lights in a vertical line (Rule 28).'],
  ['A vessel under 50 m at anchor', [L('white', 50, 34)], 'One all-round white light where it can best be seen (Rule 30).'],
  ['A vessel engaged in trawling', [L('green', 50, 26), L('white', 50, 48)], 'Green over white all-round lights: trawling (Rule 26).'],
  ['A vessel engaged in fishing, other than trawling', [L('red', 50, 26), L('white', 50, 48)], 'Red over white all-round lights: fishing other than trawling (Rule 26).'],
  ['A pilot vessel on duty', [L('white', 50, 26), L('red', 50, 48)], 'White over red all-round lights: a pilot vessel on duty (Rule 29).'],
  ['A vessel aground', [L('white', 30, 30), L('red', 58, 24), L('red', 58, 44)], 'Anchor light plus two all-round red lights in a vertical line (Rule 30).'],
  ['A sailing vessel showing her starboard side', [L('green', 54, 60)], 'A sidelight with no masthead light: a sailing vessel. Green shows her starboard side (Rule 25).'],
];

/** Picks `count` light figures for a game; distractors are the other situations. */
export function lightsQuestions(id, count, seed = id, tag = '') {
  const answers = ENTRIES.map(entry => entry[0]);
  return shuffle(ENTRIES, `${seed}:lights`).slice(0, count).map(([answer, lights, explanation], i) => choice({
    id: `${id}-${tag}nl${i + 1}`, prompt: 'It is night. Which vessel or situation do these lights show?', correct: answer,
    distractors: shuffle(answers.filter(a => a !== answer), `${seed}:${i}:lights-wrong`).slice(0, 3), explanation,
    label: 'COLREG 1972 · lights at night', figure: { kind: 'lights', lights }, hint: 'Count the lights and note their colours and order from the top.',
  }));
}

export const LIGHT_COUNT = ENTRIES.length;
