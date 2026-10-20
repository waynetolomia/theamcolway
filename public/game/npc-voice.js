/**
 * NPC greeting voices. When the cadet talks to an NPC (press E / tap Interact), a short
 * greeting plays in the NPC's own voice: male NPCs say "Sawasdee krap", female NPCs "Sawasdee ka".
 *
 * Recorded clips go in assets/voices/ (any missing clip is skipped):
 *   greet-male-1.mp3  "Hello!"          greet-female-1.mp3  "Hello!"
 *   greet-male-2.mp3  "Sawasdee krap!"  greet-female-2.mp3  "Sawasdee ka!"
 *   greet-male-3.mp3  "Hi, cadet!"      greet-female-3.mp3  "Hi, cadet!"
 * When no clip of that gender is available, the device's speech voice says the same words.
 */
export const VOICE_LINES = Object.freeze({
  male: Object.freeze([
    { file: 'greet-male-1.mp3', text: 'Hello!', lang: 'en' },
    { file: 'greet-male-2.mp3', text: 'Sawasdee krap!', thai: 'สวัสดีครับ', lang: 'th' },
    { file: 'greet-male-3.mp3', text: 'Hi, cadet!', lang: 'en' },
  ]),
  female: Object.freeze([
    { file: 'greet-female-1.mp3', text: 'Hello!', lang: 'en' },
    { file: 'greet-female-2.mp3', text: 'Sawasdee ka!', thai: 'สวัสดีค่ะ', lang: 'th' },
    { file: 'greet-female-3.mp3', text: 'Hi, cadet!', lang: 'en' },
  ]),
});
const REPEAT_GAP_MS = 4000;   // the same NPC does not greet again within 4 seconds
const VOLUME = 0.9;

// Names used by common device voices, to choose a male or female speaker for the fallback.
const FEMALE_HINT = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|kanya|serena|allison|ava|google uk english female|narisa|premwadee|achara/i;
const MALE_HINT = /\bmale\b|man\b|daniel|david|alex|fred|thomas|oliver|arthur|google uk english male|niwat|pattara|mark|george/i;

export function createNpcVoice({ enabled = () => true, base = new URL('./assets/voices/', import.meta.url) } = {}) {
  const missing = new Set();   // clips the browser could not load
  const lastLine = { male: -1, female: -1 };
  const lastGreeting = new Map();
  let current = null;

  function pickLine(gender) {
    const lines = VOICE_LINES[gender] || VOICE_LINES.male;
    const choices = lines.map((_, i) => i).filter(i => i !== lastLine[gender]);
    const index = choices[Math.floor(Math.random() * choices.length)];
    lastLine[gender] = index;
    return lines[index];
  }

  function speakFallback(line, gender) {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') return false;
    const voices = synth.getVoices?.() || [];
    const hint = gender === 'female' ? FEMALE_HINT : MALE_HINT;
    const thai = voices.filter(v => /^th/i.test(v.lang)), english = voices.filter(v => /^en/i.test(v.lang));
    // Gender matters more than language: a male NPC never borrows a female Thai voice.
    const voice = (line.lang === 'th' && thai.find(v => hint.test(v.name)))
      || english.find(v => hint.test(v.name))
      || (line.lang === 'th' ? thai[0] : null) || english[0] || null;
    const useThai = Boolean(voice && /^th/i.test(voice.lang) && line.thai);
    const utterance = new SpeechSynthesisUtterance(useThai ? line.thai : line.text);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || (useThai ? 'th-TH' : 'en-GB');
    // Without a gendered voice, a pitch shift keeps male and female greetings distinct.
    utterance.pitch = voice && hint.test(voice.name) ? 1 : gender === 'female' ? 1.35 : 0.75;
    utterance.rate = 0.95; utterance.volume = VOLUME;
    synth.cancel(); synth.speak(utterance);
    return true;
  }

  function playClip(line, gender) {
    if (typeof Audio !== 'function') return speakFallback(line, gender);
    const audio = new Audio(new URL(line.file, base).href);
    audio.volume = VOLUME;
    const fallback = () => { missing.add(line.file); if (current === audio) current = null; speakFallback(line, gender); };
    audio.addEventListener('error', fallback, { once: true });
    current?.pause?.(); current = audio;
    audio.play().catch(error => { if (error?.name !== 'AbortError' && !audio.error) speakFallback(line, gender); });
    return true;
  }

  return {
    /** Greets once per approach. gender: 'male' | 'female'. Returns the line used, or null. */
    greet(gender, npcId = '') {
      if (!enabled()) return null;
      const key = npcId || gender, now = Date.now();
      if (now - (lastGreeting.get(key) || 0) < REPEAT_GAP_MS) return null;
      lastGreeting.set(key, now);
      const g = gender === 'female' ? 'female' : 'male';
      const lines = VOICE_LINES[g];
      // Prefer recorded clips; skip any the browser already reported as missing.
      let line = pickLine(g);
      if (missing.has(line.file)) line = lines.find(l => !missing.has(l.file)) || line;
      if (missing.has(line.file)) speakFallback(line, g); else playClip(line, g);
      return line;
    },
    stop() { current?.pause?.(); current = null; globalThis.speechSynthesis?.cancel?.(); },
  };
}
