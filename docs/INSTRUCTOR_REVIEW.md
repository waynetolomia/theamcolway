# Instructor review list

Every generated question is checked automatically by the game, but the items below were written for THE AMCOL WAY rather than taken from *Maritime English 3.17 Plus*. Please review them before using results for assessment. Each question in `instructor/QUESTION_BANK.json` has `reviewStatus: "auto-checked; instructor review pending"`, a stable `id` and a content `version`. Use these to record what you have checked.

## New in this update (content version 2)

| Area | File | What to check |
|---|---|---|
| COLREG situations (Years 3–4) | `scripts/minigames/banks/colreg-scenarios.mjs` | 24 encounter questions. Check each action against the current consolidated COLREG text, especially Rules 17, 19 and 34. |
| Night lights figures | `scripts/minigames/banks/lights.mjs` | 14 light patterns and the observer's left/right convention. Light positions are drawn schematically, not to scale. |
| Procedures to put in order | `scripts/minigames/banks/sequences.mjs` | 13 procedures (man overboard, fire, abandon ship, enclosed space, VHF distress, watch handover, anchoring, pilot boarding, engine start, bunkering, pump isolation, generator paralleling). Steps follow common training practice; align them with your college's or company's procedures. |
| Maths, Years 2–4 | `scripts/minigames/banks/math.mjs` | New families: GM, TPC sinkage, fuel cube law, SFOC, pressure, temperature, efficiency, pump time, drift, rule of twelfths, remaining-leg speed, fuel reserve, mean readings, mixing ratio. Check the number-entry tolerances (`tolerance`). |
| Science gauges | `scripts/minigames/banks/science.mjs` | Gauge ranges and divisions (lube oil, cooling water, starting air, fuel temperature, boiler, shaft rpm, barometer, steering and ballast pressure). |
| Grammar | `scripts/minigames/banks/grammar-more.mjs` | 6 added items per unit, matched to each unit's grammar focus. |
| Study notes | `studyNotes` in `public/game/book-course.js` (built by `scripts/build-minigames.mjs`) | Short reminders under each game. They are meant to point to what to review, not give answers. |

## Carried over from earlier versions

- COLREG rules bank (`colreg.mjs`), safety bank (`safety.mjs`), maths and science facts: written from standard references; not in the book.
- Reading-comprehension answers (`scripts/minigames/reading/*.mjs`): the book has no teacher's key for these, so the answers were authored.
- Staff and Lifeboat games (`public/game/npc-content.js`, `public/game/lifeboat-content.js`).

## Balance values to confirm with staff

These are starting values in `public/game/game-config.js`. They are tested for consistency by `npm test` and for pacing by `npm run pacing` (see `docs/PACING.md`).

- 5 study days per week, 4 graded missions per day, 20 per week, weekly reset Monday 00:00 Bangkok time.
- Energy: 100 maximum, 15 per new mission, 10 for exercise, meal +25, rest +20. With 4 missions and exercise, a cadet uses 70 energy a day, so meals and rests are only needed after retries across days or on very long days.
- XP: book games 10/12/14/16 by year; staff, safety and Loma 10; level curve 100 + 35 per level. Best-case pacing reaches Cadet Captain (level 18) at graduation after about 118 study days (24 real weeks).
- Loma final: 50 games through the normal slots, at least 13 study days.
