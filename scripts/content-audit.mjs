// Content audit and curriculum matrix.
//
//   node scripts/content-audit.mjs            → writes docs/CONTENT_AUDIT.md and docs/CURRICULUM.md
//   node scripts/content-audit.mjs --json     → also prints the raw numbers as JSON
//
// Counts unique questions separately from reused references and generated numerical combinations.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ACTIVITIES, UNITS, SEMESTERS, BOOK } from '../public/game/book-course.js';
import { NPCS, NPC_MISSIONS } from '../public/game/npc-content.js';
import { SAFETY_GAMES } from '../public/game/lifeboat-content.js';
import { LOMA_GAMES } from '../public/game/loma-content.js';
import { BALANCE } from '../public/game/game-config.js';
import { activityHost, activityMajor, activitySubject, activityDifficulty } from '../public/game/curriculum.js';

const root = new URL('../', import.meta.url);
const ORIGINAL = JSON.parse(readFileSync(new URL('scripts/minigames/source/book-activities.json', root), 'utf8'));
const normal = text => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[“”"'’.!?]/g, '').trim();
const inc = (map, key, n = 1) => { map[key] = (map[key] || 0) + n; return map; };
const npcName = id => NPCS.find(npc => npc.id === id)?.name || id;

// Every playable question with its context.
const items = [];
for (const a of ACTIVITIES) {
  const sets = [a.questions, ...(Array.isArray(a.variants) ? a.variants.map(v => v.questions) : [])];
  sets.forEach((set, variant) => set.forEach(q => items.push({ source: 'book', activity: a, variant, q })));
}
for (const m of NPC_MISSIONS) m.questions.forEach(q => items.push({ source: 'staff', mission: m, variant: 0, q }));
for (const g of SAFETY_GAMES) g.questions.forEach(q => items.push({ source: 'safety', game: g, variant: 0, q }));

const generated = q => /-(?:[a-z]-)?(m|x|g)\d+$/.test(q.id) || /Maritime (mathematics|science)/.test(q.sourceLabel || '') && /\d/.test(q.prompt) && !/[A-Za-z]{30,}/.test(q.answers?.[0] || '');
const keyOf = q => `${normal(q.prompt)}|${normal(q.answers?.[0] ?? q.answer)}`;
const seen = new Map();
for (const item of items) seen.set(keyOf(item.q), (seen.get(keyOf(item.q)) || 0) + 1);
const unique = [...seen.keys()].length;
const generatedCount = items.filter(item => generated(item.q)).length;
const reusedReferences = items.length - unique;

const by = { semester: {}, major: {}, subject: {}, npc: {}, location: {}, mechanic: {}, difficulty: {}, format: {}, type: {} };
const uniqueBy = { semester: {}, subject: {} };
const seenSem = new Set();
for (const item of items) {
  const { q } = item;
  if (item.source === 'book') {
    const a = item.activity, sem = `Y${a.year} S${a.term}`, subject = activitySubject(a);
    inc(by.semester, sem); inc(by.major, activityMajor(a).toUpperCase()); inc(by.subject, subject);
    inc(by.npc, npcName(activityHost(a))); inc(by.location, a.room ? `${a.location} / ${a.room}` : a.location);
    inc(by.mechanic, a.type); inc(by.difficulty, activityDifficulty(a)); inc(by.format, q.format || 'blank');
    const k = `${sem}|${keyOf(q)}`; if (!seenSem.has(k)) { seenSem.add(k); inc(uniqueBy.semester, sem); }
  } else if (item.source === 'staff') {
    inc(by.subject, `Staff mission (${npcName(item.mission.npcId)})`); inc(by.npc, npcName(item.mission.npcId));
    inc(by.mechanic, `staff:${q.type}`); inc(by.format, q.type);
  } else {
    inc(by.subject, 'Lifeboat safety'); inc(by.location, 'lifeboat'); inc(by.mechanic, `safety:${q.type}`); inc(by.format, q.type);
  }
}
for (const key of new Set(items.filter(i => i.source === 'book').map(i => `${activitySubject(i.activity)}|${keyOf(i.q)}`))) inc(uniqueBy.subject, key.split('|')[0]);

const originalQuestions = ORIGINAL.flatMap(a => a.questions);
const originalObjective = originalQuestions.filter(q => q.answers?.length).length;
const summary = {
  book: BOOK.title, generatedAt: new Date().toISOString().slice(0, 10),
  original: { activities: ORIGINAL.length, questions: originalQuestions.length, objective: originalObjective, selfReview: originalQuestions.length - originalObjective },
  now: {
    bookActivities: ACTIVITIES.length,
    bookQuestionSets: ACTIVITIES.reduce((n, a) => n + 1 + (a.variants?.length || 0), 0),
    figureQuestions: items.filter(item => item.q.figure).length,
    playableQuestionItems: items.length, uniqueQuestions: unique, reusedReferences, generatedNumerical: generatedCount,
    staffMissions: NPC_MISSIONS.length, staffQuestions: NPC_MISSIONS.reduce((n, m) => n + m.questions.length, 0),
    safetyGames: SAFETY_GAMES.length, lomaPool: LOMA_GAMES.length,
  },
};

// Growth against the audit saved before the progression and content update.
let baseline = null;
try { baseline = JSON.parse(readFileSync(new URL('docs/content-audit-baseline.json', root), 'utf8')); } catch { /* first run */ }
const growth = baseline?.now ? Object.entries(summary.now).filter(([k]) => typeof baseline.now[k] === 'number')
  .map(([k, v]) => `| ${k} | ${baseline.now[k]} | ${v} | ${v - baseline.now[k] >= 0 ? '+' : ''}${v - baseline.now[k]} |`).join('\n') : '';
const table = (title, map, unit = 'questions') => `### ${title}\n\n| ${title} | ${unit} |\n|---|---:|\n${Object.entries(map).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true })).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n`;
const weak = Object.entries(uniqueBy.subject).filter(([, v]) => v < 120).map(([k, v]) => `- **${k}**: ${v} unique questions`).join('\n') || '- None below 120 unique questions.';

const md = `# Content audit — ${summary.generatedAt}

Generated by \`node scripts/content-audit.mjs\` from the live game data. Do not edit by hand.

## Totals

| Measure | Original book data | Now |
|---|---:|---:|
| Book mini-game slots | ${summary.original.activities} | ${summary.now.bookActivities} |
| Book question sets (incl. equivalent variants) | ${summary.original.activities} | ${summary.now.bookQuestionSets} |
| Questions (all playable items) | ${summary.original.questions} | ${summary.now.playableQuestionItems} |
| Automatically checked | ${summary.original.objective} | ${summary.now.playableQuestionItems} |
| Self-review (not auto-checked) | ${summary.original.selfReview} | 0 |
| **Unique questions** (deduplicated prompt + answer) | — | **${unique}** |
| Reused references (same question used again) | — | ${reusedReferences} |
| Generated numerical combinations (maths/science) | — | ${generatedCount} |
| Staff missions / questions | ${NPC_MISSIONS.length} | ${summary.now.staffMissions} / ${summary.now.staffQuestions} |
| Lifeboat safety games | ${SAFETY_GAMES.length} | ${summary.now.safetyGames} |
| Loma final pool (50 drawn) | — | ${summary.now.lomaPool} |

${growth ? `## Growth since the baseline audit\n\n| Measure | Baseline | Now | Change |\n|---|---:|---:|---:|\n${growth}\n` : ''}
## Coverage

${table('Year and semester', by.semester)}
Unique book questions per semester: ${Object.entries(uniqueBy.semester).map(([k, v]) => `${k} ${v}`).join(' · ')}

${table('Major (DECK / ENGINE / common core)', by.major)}
${table('Subject', by.subject)}
${table('NPC host', by.npc)}
${table('Location', by.location)}
${table('Mini-game mechanic', by.mechanic)}
${table('Input format', by.format)}
${table('Difficulty', by.difficulty)}

## Weakest areas (fewer than 120 unique questions)

${weak}

## Source coverage and gaps

- Reading comprehension, vocabulary, grammar, trivia, scrambles and listening come from *${BOOK.title}* (PDF page references are kept on every question).
- COLREG, safety (SOLAS/STCW/MARPOL), maritime mathematics and maritime science are **not in the book**; they were written from standard references and carry \`reviewStatus: auto-checked; instructor review pending\` in \`instructor/QUESTION_BANK.json\`.
- The supplied book has no teacher’s answer key for its open tasks; all answers for those were authored and need instructor review.
`;

// Curriculum matrix: one section per semester.
const lines = ['# Curriculum matrix', '', `Generated by \`node scripts/content-audit.mjs\`. ${BALANCE.missions.perDay} graded missions per study day, ${BALANCE.week.studyDays} study days per real week.`, ''];
for (const sem of SEMESTERS) {
  const acts = ACTIVITIES.filter(a => a.semester === sem.id);
  const units = UNITS.filter(u => (sem.units || []).includes(u.id));
  const days = Math.ceil(acts.length / BALANCE.missions.perDay);
  const count = (f) => Object.entries(acts.reduce((m, a) => inc(m, f(a)), {})).map(([k, v]) => `${k} ${v}`).join(', ');
  const skills = new Set(acts.map(a => activitySubject(a)));
  const gates = [`All ${acts.length} required mini-games`];
  if (sem.id === 4) gates.push('Tr. Dream’s sea-training readiness review (Years 1–2 complete + 16 staff sign-offs)');
  if (sem.id === 8) gates.push(`Loma Lounge final: pass all ${BALANCE.loma.finalCount} saved games (unlocks after this semester’s book work)`);
  lines.push(`## Year ${sem.year}, Semester ${sem.term} — ${sem.title}`, '',
    `**Units:** ${units.map(u => `${u.id}. ${u.title} (grammar: ${u.grammar})`).join('; ') || 'Final assessment'}`, '',
    `**Learning objectives:** ${units.map(u => u.objectives).filter(Boolean).join(' ') || 'Integrated review of the full course.'}`, '',
    `**Required missions:** ${acts.length} (≈ ${days} study days at ${BALANCE.missions.perDay}/day)`, '',
    `**Difficulty:** ${[...new Set(acts.map(activityDifficulty))].join(', ')}`, '',
    `**Mechanics:** ${count(a => a.type)}`, '',
    `**Locations:** ${count(a => a.room ? `${a.location}/${a.room}` : a.location)}`, '',
    `**NPC hosts:** ${count(a => npcName(activityHost(a)))}`, '',
    `**Majors:** ${count(a => activityMajor(a))}`, '',
    `**Skill rewards:** ${[...skills].join(', ')}`, '',
    `**Progression gate:** ${gates.join('; ')}`, '');
}
mkdirSync(new URL('docs/', root), { recursive: true });
writeFileSync(new URL('docs/CONTENT_AUDIT.md', root), md);
writeFileSync(new URL('docs/CURRICULUM.md', root), lines.join('\n'));
console.log('Wrote docs/CONTENT_AUDIT.md and docs/CURRICULUM.md');
console.log(JSON.stringify(summary.now));
if (process.argv.includes('--json')) console.log(JSON.stringify({ summary, by, uniqueBy }, null, 1));
