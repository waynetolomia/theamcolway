import assert from 'node:assert/strict';

// Fake browser audio: every clip "fails to load" so the device-voice fallback is exercised,
// and every play() is recorded so we can check which clip each gender asks for.
const played = [], spoken = [];
class FakeAudio {
  constructor(src) { this.src = src; this.listeners = {}; played.push(this); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  play() { queueMicrotask(() => this.listeners.error?.()); return Promise.resolve(); }
  pause() {}
}
globalThis.Audio = FakeAudio;
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.speechSynthesis = {
  getVoices: () => [{ name: 'Google UK English Female', lang: 'en-GB' }, { name: 'Google UK English Male', lang: 'en-GB' }, { name: 'Kanya', lang: 'th-TH' }],
  speak: utterance => spoken.push(utterance), cancel() {},
};
const { createNpcVoice, VOICE_LINES } = await import('../public/game/npc-voice.js');
const settle = () => new Promise(resolve => setTimeout(resolve, 5));

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

await test('male NPCs use male clips and female NPCs use female clips', async () => {
  const voice = createNpcVoice();
  const male = voice.greet('male', 'npc-wayne'), female = voice.greet('female', 'npc-anne');
  assert.ok(VOICE_LINES.male.includes(male)); assert.ok(VOICE_LINES.female.includes(female));
  assert.match(played.at(-2).src, /assets\/voices\/greet-male-\d\.mp3$/);
  assert.match(played.at(-1).src, /assets\/voices\/greet-female-\d\.mp3$/);
});

await test('the Thai greeting uses the polite ending for each gender', () => {
  assert.ok(VOICE_LINES.male.some(line => line.text === 'Sawasdee krap!' && line.thai === 'สวัสดีครับ'));
  assert.ok(VOICE_LINES.female.some(line => line.text === 'Sawasdee ka!' && line.thai === 'สวัสดีค่ะ'));
  assert.ok(!VOICE_LINES.male.some(line => /\bka\b/i.test(line.text)), 'Male lines never say "ka"');
  assert.ok(!VOICE_LINES.female.some(line => /krap/i.test(line.text)), 'Female lines never say "krap"');
});

await test('a missing clip falls back to a device voice of the same gender', async () => {
  spoken.length = 0;
  const voice = createNpcVoice();
  voice.greet('female', 'npc-dream'); await settle();
  voice.greet('male', 'npc-jakk'); await settle();
  assert.equal(spoken.length, 2);
  const [female, male] = spoken;
  assert.ok(/Female|Kanya/.test(female.voice.name), `female voice chosen: ${female.voice.name}`);
  assert.equal(male.voice.name, 'Google UK English Male', 'A male NPC never borrows the female Thai voice');
});

await test('the same NPC does not greet twice within a few seconds, and voices can be turned off', async () => {
  let on = true;
  const voice = createNpcVoice({ enabled: () => on });
  assert.ok(voice.greet('male', 'npc-duke'));
  assert.equal(voice.greet('male', 'npc-duke'), null, 'No repeat right away');
  assert.ok(voice.greet('male', 'npc-bank'), 'A different NPC still greets');
  on = false;
  assert.equal(voice.greet('female', 'npc-amara'), null, 'Voices off means silence');
});

await test('greetings vary: the same line is not used twice in a row', () => {
  const voice = createNpcVoice();
  let previous = null;
  for (let i = 0; i < 12; i++) { const line = voice.greet('female', `npc-${i}`); assert.notEqual(line, previous); previous = line; }
});

console.log(`\n${passed} NPC voice checks passed.`);
