// Maritime mathematics. Each family generates a fresh, exact question from a seed, with
// distractors built from typical mistakes. Contexts reuse situations from the book.
import { choice, rng, shuffle } from '../lib.mjs';

const fmt = (n, dp = 1) => { const v = +n.toFixed(dp); return Number.isInteger(v) ? String(v) : v.toFixed(dp); };
const hm = hours => { const total = Math.round(hours * 60), h = Math.floor(total / 60), m = total % 60; return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
const clock = minutes => { const m = ((Math.round(minutes) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`; };
const SHIPS = ['MV Andaman Trader', 'MV Blue Horizon', 'MV Coral Star', 'MV Cedar Bay', 'MV Meadow Bay', 'MV Sea Lantern'];

const FAMILIES = [
  // Time = distance ÷ speed
  r => { const speed = [8, 10, 12, 14, 15, 16][r(6)], hours = [3, 4, 5, 6, 7.5, 8, 9, 10.5][r(8)], dist = speed * hours;
    return { prompt: `${SHIPS[r(6)]} has ${fmt(dist)} nautical miles to run at ${speed} knots. How long will it take?`, correct: hm(hours),
      distractors: [hm(hours + 1), hm(hours * 0.8), hm(dist / (speed + 2))], explanation: `Time = distance ÷ speed = ${fmt(dist)} ÷ ${speed} = ${fmt(hours, 2)} h = ${hm(hours)}.` }; },
  // Distance = speed × time
  r => { const speed = [9, 11, 12, 12.5, 13, 14][r(6)], hours = [2, 3, 4, 6, 8, 24][r(6)], dist = speed * hours;
    return { prompt: `A vessel steams at ${fmt(speed)} knots for ${hours} hours. What distance does she run?`, correct: `${fmt(dist)} NM`,
      distractors: [`${fmt(dist + speed)} NM`, `${fmt(dist - speed)} NM`, `${fmt(speed + hours)} NM`], explanation: `Distance = speed × time = ${fmt(speed)} × ${hours} = ${fmt(dist)} NM.` }; },
  // Speed = distance ÷ time
  r => { const hours = [4, 5, 6, 8, 10, 12, 24][r(7)], speed = [9, 10, 11, 12, 13, 14, 15][r(7)], dist = speed * hours;
    return { prompt: `In ${hours} hours a ship runs ${dist} nautical miles. What is her average speed?`, correct: `${speed} knots`,
      distractors: [`${speed + 1} knots`, `${speed - 2} knots`, `${fmt(dist / (hours + 2))} knots`], explanation: `Speed = distance ÷ time = ${dist} ÷ ${hours} = ${speed} knots.` }; },
  // ETA from start time
  r => { const start = [0, 6, 8, 12, 14, 16][r(6)] * 60 + [0, 30][r(2)], speed = [10, 12, 15][r(3)], hours = [2, 3, 4, 5, 6, 7][r(6)], dist = speed * hours;
    return { prompt: `At ${clock(start)} LT the ship has ${dist} NM to the pilot station at ${speed} knots, with no delay. What is the ETA?`, correct: `${clock(start + hours * 60)} LT`,
      distractors: [`${clock(start + (hours + 1) * 60)} LT`, `${clock(start + (hours - 1) * 60)} LT`, `${clock(start + hours * 100)} LT`], explanation: `${dist} ÷ ${speed} = ${hours} h. ${clock(start)} + ${hours} h = ${clock(start + hours * 60)} LT.` }; },
  // Revised ETA at reduced speed (book Unit 4 style)
  r => { const start = [12, 14, 15, 16][r(4)] * 60 + [0, 30][r(2)], speed = [6, 8, 9][r(3)], hours = [3, 4, 5, 6][r(4)], dist = speed * hours;
    return { prompt: `At ${clock(start)} LT, ${dist} NM remain. The Master reduces the planning speed to ${speed} knots for all of it. What is the revised ETA?`, correct: `${clock(start + hours * 60)} LT`,
      distractors: [`${clock(start + dist / 12 * 60)} LT`, `${clock(start + (hours + 2) * 60)} LT`, `${clock(start + (hours - 1) * 60)} LT`], explanation: `${dist} ÷ ${speed} = ${hours} h after ${clock(start)} gives ${clock(start + hours * 60)} LT.` }; },
  // Knots to km/h
  r => { const kn = [5, 10, 12, 15, 20][r(5)], kmh = kn * 1.852;
    return { prompt: `1 nautical mile = 1.852 km. A speed of ${kn} knots is how many km/h?`, correct: `${fmt(kmh)} km/h`,
      distractors: [`${fmt(kn * 1.609)} km/h`, `${fmt(kn / 1.852)} km/h`, `${fmt(kn * 1.5)} km/h`], explanation: `${kn} × 1.852 = ${fmt(kmh)} km/h.` }; },
  // Shackles to metres (book Unit 7)
  r => { const s = [3, 4, 5, 6, 7, 8][r(6)];
    return { prompt: `One shackle of anchor cable is 27.5 metres. How long is ${s} shackles?`, correct: `${fmt(s * 27.5)} m`,
      distractors: [`${fmt(s * 25)} m`, `${fmt(s * 30)} m`, `${fmt((s + 1) * 27.5)} m`], explanation: `${s} × 27.5 = ${fmt(s * 27.5)} m.` }; },
  // Latitude difference to distance
  r => { const a = 10 + r(5), am = r(50), b = a + 1 + r(2), bm = r(50), diff = (b * 60 + bm) - (a * 60 + am);
    return { prompt: `A ship sails due north from ${a}°${String(am).padStart(2, '0')}′ N to ${b}°${String(bm).padStart(2, '0')}′ N. One minute of latitude is one nautical mile. How far did she sail?`, correct: `${diff} NM`,
      distractors: [`${diff + 60} NM`, `${Math.abs(bm - am)} NM`, `${diff - 10} NM`], explanation: `Difference = ${diff}′ of latitude = ${diff} NM.` }; },
  // Fuel consumption
  r => { const perDay = [18, 20, 24, 28, 30, 32][r(6)], days = [2, 3, 4, 5, 6][r(5)], rob = perDay * days + [40, 60, 80, 100][r(4)];
    return { prompt: `The ship burns ${perDay} tonnes of fuel per day. She has ${rob} tonnes on board and a ${days}-day passage. How much fuel will remain on arrival?`, correct: `${rob - perDay * days} t`,
      distractors: [`${rob - perDay * (days - 1)} t`, `${perDay * days} t`, `${rob + perDay} t`], explanation: `Used: ${perDay} × ${days} = ${perDay * days} t. Remaining: ${rob} − ${perDay * days} = ${rob - perDay * days} t.` }; },
  // Loading time (book Unit 8)
  r => { const rate = [600, 750, 800, 1000, 1200][r(5)], hours = [4, 5, 6, 8, 10, 12][r(6)], qty = rate * hours;
    return { prompt: `The loading rate is ${rate} tonnes per hour and ${qty.toLocaleString('en-US')} tonnes remain. How many hours of loading are left?`, correct: `${hours} hours`,
      distractors: [`${hours + 2} hours`, `${hours - 1} hours`, `${fmt(qty / (rate + 200))} hours`], explanation: `${qty.toLocaleString('en-US')} ÷ ${rate} = ${hours} h.` }; },
  // Ballast quantity
  r => { const rate = [400, 500, 550, 600][r(4)], hours = [2, 3, 4, 5][r(4)];
    return { prompt: `A ballast pump discharges ${rate} m³ per hour for ${hours} hours. How much ballast water is discharged?`, correct: `${rate * hours} m³`,
      distractors: [`${rate * (hours + 1)} m³`, `${rate + hours} m³`, `${rate * hours / 2} m³`], explanation: `${rate} × ${hours} = ${rate * hours} m³.` }; },
  // Mean draft and trim
  r => { const fwd = 6 + r(30) / 10, aft = fwd + [0.4, 0.6, 0.8, 1.0, 1.2][r(5)];
    return { prompt: `Draft forward ${fmt(fwd)} m, draft aft ${fmt(aft)} m. What is the trim?`, correct: `${fmt(aft - fwd)} m by the stern`,
      distractors: [`${fmt(aft - fwd)} m by the head`, `${fmt((fwd + aft) / 2)} m by the stern`, `${fmt(aft + fwd)} m by the stern`], explanation: `Trim = aft − forward = ${fmt(aft - fwd)} m. Deeper aft = by the stern.` }; },
  r => { const fwd = 6 + r(30) / 10, aft = fwd + [0.2, 0.4, 0.6, 0.8][r(4)];
    return { prompt: `Draft forward ${fmt(fwd)} m and aft ${fmt(aft)} m. What is the mean draft?`, correct: `${fmt((fwd + aft) / 2, 2)} m`,
      distractors: [`${fmt(fwd + aft, 2)} m`, `${fmt(aft - fwd, 2)} m`, `${fmt((fwd + aft) / 2 + 0.5, 2)} m`], explanation: `Mean draft = (${fmt(fwd)} + ${fmt(aft)}) ÷ 2 = ${fmt((fwd + aft) / 2, 2)} m.` }; },
  // Tank volume
  r => { const l = [4, 5, 6, 8][r(4)], b = [3, 4, 5][r(3)], h = [2, 2.5, 3][r(3)], v = l * b * h;
    return { prompt: `A rectangular tank is ${l} m long, ${b} m wide and ${fmt(h)} m deep. What is its volume?`, correct: `${fmt(v)} m³`,
      distractors: [`${fmt(l * b)} m³`, `${fmt(l + b + h)} m³`, `${fmt(v * 2)} m³`], explanation: `V = l × b × h = ${l} × ${b} × ${fmt(h)} = ${fmt(v)} m³.` }; },
  // Percentage of a tank
  r => { const cap = [200, 400, 500, 800][r(4)], pct = [25, 40, 60, 75, 90][r(5)];
    return { prompt: `A ${cap} m³ tank is ${pct}% full. How much liquid is in it?`, correct: `${cap * pct / 100} m³`,
      distractors: [`${cap * (100 - pct) / 100} m³`, `${pct} m³`, `${cap * pct / 10} m³`], explanation: `${pct}% of ${cap} = ${cap} × ${pct} ÷ 100 = ${cap * pct / 100} m³.` }; },
  // Watch duration
  r => { const start = [0, 4, 8, 12, 16, 20][r(6)] * 60;
    return { prompt: `A watch runs from ${clock(start)} to ${clock(start + 240)}. How long is it?`, correct: '4 hours',
      distractors: ['2 hours', '6 hours', '8 hours'], explanation: 'Each standard watch is four hours (book Unit 1).' }; },
  // Time between two times
  r => { const a = (6 + r(8)) * 60 + [0, 15, 30, 45][r(4)], d = [45, 75, 90, 105, 135][r(5)];
    // Subtracting clock figures as plain numbers is the classic mistake; use it only when it is actually wrong.
    const naive = Number(clock(a + d)) - Number(clock(a));
    return { prompt: `A fault was recorded at ${clock(a)} and the inspection began at ${clock(a + d)}. How long was the gap?`, correct: hm(d / 60),
      distractors: [hm((d + 30) / 60), hm((d - 15) / 60), naive !== d ? hm(naive / 60) : hm((d + 60) / 60)], explanation: `${clock(a)} → ${clock(a + d)} = ${d} minutes = ${hm(d / 60)}.` }; },
  // Cable to metres
  r => { const c = [2, 3, 4, 5][r(4)];
    return { prompt: `One cable is one tenth of a nautical mile (185.2 m). How far is ${c} cables?`, correct: `${fmt(c * 185.2)} m`,
      distractors: [`${fmt(c * 100)} m`, `${fmt(c * 1852)} m`, `${fmt(c * 200)} m`], explanation: `${c} × 185.2 = ${fmt(c * 185.2)} m.` }; },
  // Simple algebra on watch data
  r => { const per = [2, 3, 4][r(3)], rounds = 24 / per;
    return { prompt: `The duty engineer makes rounds every ${per} hours. How many rounds in 24 hours?`, correct: `${rounds}`,
      distractors: [`${rounds + 2}`, `${rounds - 1}`, `${per * 2}`], explanation: `24 ÷ ${per} = ${rounds}.` }; },
];

export function mathQuestions(id, count, { semester = 1 } = {}) {
  const order = shuffle(FAMILIES.map((_, i) => i), `${id}:families:${semester}`).slice(0, count);
  return order.map((family, i) => {
    const next = rng(`${id}:${i}:${family}`); const r = n => Math.floor(next() * n);
    const q = FAMILIES[family](r);
    return choice({ id: `${id}-m${i + 1}`, prompt: q.prompt, correct: q.correct, distractors: q.distractors, explanation: q.explanation, label: 'Maritime mathematics' });
  });
}
