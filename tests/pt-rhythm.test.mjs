import assert from 'node:assert/strict';
import { createPtRhythm, PT_RHYTHM } from '../public/game/fitness-games.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

test('bars arrive on a steady beat: front edge first, end after the hold', () => {
  const track = createPtRhythm(0);
  const [a, b] = track.notes;
  assert.equal(a.head, PT_RHYTHM.leadIn + PT_RHYTHM.travel);
  assert.equal(a.tail - a.head, PT_RHYTHM.holds[0]);
  assert.equal(b.head, a.tail + PT_RHYTHM.gap, 'The next bar follows after a fixed gap');
});

test('pressing on the line and releasing at the end scores a perfect repetition', () => {
  const track = createPtRhythm(0); const note = track.notes[0];
  assert.equal(track.press(note.head + 40).press, 'perfect');
  const result = track.release(note.tail - 60);
  assert.equal(result.type, 'hit'); assert.equal(result.release, 'perfect');
  assert.equal(track.hits, 1); assert.equal(track.combo, 1); assert.equal(track.score, 100);
});

test('slightly off timing is GOOD, and still counts as a repetition', () => {
  const track = createPtRhythm(0); const note = track.notes[0];
  assert.equal(track.press(note.head - 200).press, 'good');
  assert.equal(track.release(note.tail + 200).type, 'hit');
  assert.equal(track.score, 70);
});

test('pressing too early is ignored, not punished', () => {
  const track = createPtRhythm(0); const note = track.notes[0];
  assert.equal(track.press(note.head - 900).type, 'early');
  assert.equal(note.state, 'waiting'); assert.equal(track.misses, 0);
});

test('letting go mid-bar, holding past the end, or never pressing are misses that reset the combo', () => {
  const track = createPtRhythm(0); const [a, b, c] = track.notes;
  track.press(a.head); track.release(a.tail);                      // hit
  track.press(b.head); assert.equal(track.release(b.head + 50).reason, 'early-release');
  assert.equal(track.combo, 0);
  track.update(c.head + PT_RHYTHM.good + 1);
  assert.equal(c.state, 'done'); assert.equal(c.result, 'miss');
  const d = track.notes[3]; track.press(d.head);
  const events = track.update(d.tail + PT_RHYTHM.good + 1);
  assert.ok(events.some(e => e.reason === 'held-too-long'));
  assert.equal(track.hits, 1); assert.equal(track.misses, 3);
});

test('the track keeps feeding bars until eight clean repetitions are done', () => {
  const track = createPtRhythm(0);
  for (let i = 0; i < 8; i++) { const note = track.notes.find(n => n.state === 'waiting'); track.press(note.head); track.release(note.tail); track.update(note.tail); }
  assert.equal(track.hits, 8); assert.equal(track.done, true);
  assert.equal(track.press(10 ** 9), null, 'No more presses after completion');
});

console.log(`\n${passed} PT rhythm checks passed.`);
