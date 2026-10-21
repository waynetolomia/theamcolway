// Maritime mathematics. Each family generates a fresh, exact question from a seed, with
// distractors built from typical mistakes. Contexts reuse situations from the book.
import { choice, number, rng, shuffle } from '../lib.mjs';

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
      distractors: [`${rounds + 2}`, `${rounds - 1}`, `${per * 2}`], explanation: `24 ÷ ${per} = ${rounds}.`, value: rounds, unit: 'rounds' }; },
  // ---- Year 2–4 families. `value` lets the game ask for a typed number instead of a choice.
  // Metacentric height GM = KM − KG
  r => { const km = 8 + r(30) / 10, kg = km - [0.6, 0.8, 1.1, 1.4, 1.8][r(5)], gm = km - kg;
    return { prompt: `The stability sheet gives KM = ${fmt(km)} m and KG = ${fmt(kg)} m. What is the metacentric height GM?`, correct: `${fmt(gm)} m`,
      distractors: [`${fmt(km + kg)} m`, `${fmt(gm + 0.5)} m`, `${fmt(kg / km, 2)} m`], explanation: `GM = KM − KG = ${fmt(km)} − ${fmt(kg)} = ${fmt(gm)} m. A positive GM means the ship is stable.`,
      value: gm, tolerance: 0.05, unit: 'm', hint: 'GM = KM − KG.' }; },
  // Sinkage from tonnes per centimetre immersion
  r => { const tpc = [20, 25, 30, 32, 40][r(5)], cm = [5, 8, 10, 12, 15][r(5)], load = tpc * cm;
    return { prompt: `TPC is ${tpc} tonnes per cm. The ship loads ${load} tonnes of cargo. By how many centimetres does her mean draft increase?`, correct: `${cm} cm`,
      distractors: [`${cm * 2} cm`, `${fmt(load / 100)} cm`, `${cm + 5} cm`], explanation: `Sinkage = load ÷ TPC = ${load} ÷ ${tpc} = ${cm} cm.`, value: cm, unit: 'cm', hint: 'Sinkage = weight ÷ TPC.' }; },
  // Fuel consumption varies with the cube of speed
  r => { const v1 = [12, 14, 15, 16][r(4)], v2 = v1 - [1, 2, 3][r(3)], c1 = [24, 30, 36, 40][r(4)], c2 = c1 * (v2 / v1) ** 3;
    return { prompt: `At ${v1} knots the main engine burns ${c1} t/day. Fuel use varies with the cube of speed. About how much will it burn at ${v2} knots?`, correct: `${fmt(c2)} t/day`,
      distractors: [`${fmt(c1 * v2 / v1)} t/day`, `${fmt(c1 * (v2 / v1) ** 2)} t/day`, `${fmt(c1 - (v1 - v2))} t/day`], explanation: `${c1} × (${v2} ÷ ${v1})³ = ${fmt(c2, 2)} t/day.`,
      value: c2, tolerance: 0.2, unit: 't/day', hint: 'New = old × (new speed ÷ old speed)³.' }; },
  // Specific fuel oil consumption
  r => { const sfoc = [170, 175, 180, 185][r(4)], kw = [6000, 8000, 9000, 10000][r(4)], hours = 24, t = sfoc * kw * hours / 1e6;
    return { prompt: `The engine's SFOC is ${sfoc} g/kWh at ${kw.toLocaleString('en-US')} kW. How many tonnes of fuel does it use in ${hours} hours?`, correct: `${fmt(t)} t`,
      distractors: [`${fmt(t * 10)} t`, `${fmt(sfoc * kw / 1e6)} t`, `${fmt(t / 2)} t`], explanation: `${sfoc} g/kWh × ${kw} kW × ${hours} h = ${fmt(sfoc * kw * hours / 1000)} kg = ${fmt(t)} t.`,
      value: t, tolerance: 0.1, unit: 't', hint: 'grams = g/kWh × kW × hours; 1 t = 1,000,000 g.' }; },
  // Pressure: bar to kPa
  r => { const bar = [2.5, 3, 4.2, 6, 7.5, 9][r(6)];
    return { prompt: `A gauge reads ${fmt(bar)} bar. 1 bar = 100 kPa. What is the pressure in kPa?`, correct: `${fmt(bar * 100)} kPa`,
      distractors: [`${fmt(bar * 10)} kPa`, `${fmt(bar * 1000)} kPa`, `${fmt(bar / 100, 3)} kPa`], explanation: `${fmt(bar)} × 100 = ${fmt(bar * 100)} kPa.`, value: bar * 100, unit: 'kPa' }; },
  // Temperature: Celsius to Fahrenheit
  r => { const c = [10, 20, 35, 40, 60, 85][r(6)], f = c * 9 / 5 + 32;
    return { prompt: `Cooling water leaves at ${c} °C. What is that in °F? (°F = °C × 9 ÷ 5 + 32)`, correct: `${fmt(f)} °F`,
      distractors: [`${fmt(c * 5 / 9 + 32)} °F`, `${fmt(c + 32)} °F`, `${fmt(c * 2)} °F`], explanation: `${c} × 9 ÷ 5 + 32 = ${fmt(f)} °F.`, value: f, tolerance: 0.5, unit: '°F' }; },
  // Efficiency
  r => { const input = [500, 800, 1000, 1200][r(4)], pct = [35, 40, 45, 50][r(4)], out = input * pct / 100;
    return { prompt: `A generator engine receives ${input} kW of fuel energy and is ${pct}% efficient. What useful power does it deliver?`, correct: `${fmt(out)} kW`,
      distractors: [`${fmt(input - pct)} kW`, `${fmt(input * (100 - pct) / 100)} kW`, `${fmt(input / pct)} kW`], explanation: `${input} × ${pct}% = ${fmt(out)} kW.`, value: out, unit: 'kW' }; },
  // Pump fill time
  r => { const volume = [60, 90, 120, 150][r(4)], rate = [20, 30, 40][r(3)], hours = volume / rate;
    return { prompt: `A ${volume} m³ tank is filled by a pump delivering ${rate} m³/h. How many hours will it take?`, correct: `${fmt(hours)} hours`,
      distractors: [`${fmt(hours + 1)} hours`, `${fmt(volume * rate / 100)} hours`, `${fmt(rate / 10)} hours`], explanation: `${volume} ÷ ${rate} = ${fmt(hours)} h.`, value: hours, tolerance: 0.05, unit: 'h' }; },
  // Current drift
  r => { const rate = [0.5, 1, 1.5, 2, 2.5][r(5)], hours = [2, 3, 4, 6][r(4)], drift = rate * hours;
    return { prompt: `A current sets the ship at ${fmt(rate)} knots for ${hours} hours. How far does it drift her?`, correct: `${fmt(drift)} NM`,
      distractors: [`${fmt(rate + hours)} NM`, `${fmt(drift * 2)} NM`, `${fmt(hours / rate)} NM`], explanation: `Drift = rate × time = ${fmt(rate)} × ${hours} = ${fmt(drift)} NM.`, value: drift, tolerance: 0.05, unit: 'NM' }; },
  // Rule of twelfths
  r => { const range = [2.4, 3.6, 4.8, 6][r(4)], hours = [1, 2, 3][r(3)], parts = [1, 3, 6][hours - 1], rise = range * parts / 12;
    return { prompt: `The tidal range is ${fmt(range)} m. By the rule of twelfths, how much does the tide rise in the first ${hours} hour${hours > 1 ? 's' : ''} after low water?`, correct: `${fmt(rise, 2)} m`,
      distractors: [`${fmt(range * hours / 12, 2)} m`, `${fmt(range / 2 + 0.1, 2)} m`, `${fmt(range * (parts + 2) / 12, 2)} m`], explanation: `Twelfths rise 1, 2, 3, 3, 2, 1. After ${hours} h: ${parts}/12 × ${fmt(range)} = ${fmt(rise, 2)} m.`,
      value: rise, tolerance: 0.02, unit: 'm', hint: 'Hour by hour the tide rises 1, 2, 3, 3, 2 and 1 twelfths of the range.' }; },
  // Algebra: speed needed for the remaining leg
  r => { const total = [120, 144, 180, 200][r(4)], firstSpeed = [10, 12][r(2)], firstHours = [4, 5, 6][r(3)], hoursLeft = [4, 5, 6][r(3)], need = (total - firstSpeed * firstHours) / hoursLeft;
    return { prompt: `A ${total} NM passage must take ${firstHours + hoursLeft} hours. The first ${firstHours} hours were at ${firstSpeed} knots. What speed is needed for the remaining ${hoursLeft} hours?`, correct: `${fmt(need)} knots`,
      distractors: [`${fmt(total / (firstHours + hoursLeft))} knots`, `${fmt(need + 2)} knots`, `${fmt(firstSpeed)} knots`], explanation: `Distance left = ${total} − ${firstSpeed} × ${firstHours} = ${total - firstSpeed * firstHours} NM. ${total - firstSpeed * firstHours} ÷ ${hoursLeft} = ${fmt(need)} knots.`,
      value: need, tolerance: 0.1, unit: 'knots', hint: 'Find the distance still to run, then divide by the hours left.' }; },
  // Fuel with a safety reserve
  r => { const perDay = [20, 24, 28][r(3)], days = [3, 4, 5][r(3)], reserve = [10, 15, 20][r(3)], need = perDay * days * (1 + reserve / 100);
    return { prompt: `A passage takes ${days} days at ${perDay} t/day. The company requires a ${reserve}% reserve on top. How much fuel must be on board?`, correct: `${fmt(need)} t`,
      distractors: [`${fmt(perDay * days)} t`, `${fmt(perDay * days + reserve)} t`, `${fmt(perDay * (days + 1))} t`], explanation: `${perDay} × ${days} = ${perDay * days} t, plus ${reserve}% = ${fmt(need)} t.`, value: need, tolerance: 0.5, unit: 't' }; },
  // Mean of readings
  r => { const base = [70, 80, 85][r(3)], readings = [0, 1, 2, 3].map(() => base + r(9) - 4), mean = readings.reduce((a, b) => a + b, 0) / 4;
    return { prompt: `Four cylinder exhaust temperatures read ${readings.map(x => `${x * 5} °C`).join(', ')}. What is their mean?`, correct: `${fmt(mean * 5)} °C`,
      distractors: [`${fmt(Math.max(...readings) * 5)} °C`, `${fmt((readings[0] + readings[3]) / 2 * 5)} °C`, `${fmt(mean * 5 + 10)} °C`], explanation: `Add the four readings and divide by 4: ${fmt(mean * 5)} °C.`, value: mean * 5, tolerance: 0.5, unit: '°C' }; },
  // Mixing ratio
  r => { const ratio = [20, 25, 40, 50][r(4)], parts = ratio + 1, concentrate = [4, 5, 8, 10, 12][r(5)], total = parts * concentrate;
    return { prompt: `A cleaning chemical is mixed 1 : ${ratio} with fresh water. How many litres of chemical are needed for ${total} litres of mixture?`, correct: `${fmt(concentrate)} L`,
      distractors: [`${fmt(total / ratio)} L`, `${fmt(total * ratio / 100)} L`, `${fmt(concentrate * 2)} L`], explanation: `1 + ${ratio} = ${parts} parts. ${total} ÷ ${parts} = ${fmt(concentrate)} L of chemical.`, value: concentrate, tolerance: 0.1, unit: 'L' }; },
];

/** Difficulty (1 = Year 1 … 4 = Year 4) and the major whose work each family describes. */
const META = [
  [1, 'deck'], [1, 'deck'], [1, 'deck'], [2, 'deck'], [2, 'deck'], [1, 'common'], [1, 'deck'], [2, 'deck'], [2, 'engine'], [2, 'deck'],
  [1, 'engine'], [2, 'deck'], [2, 'deck'], [1, 'engine'], [1, 'engine'], [1, 'common'], [1, 'common'], [1, 'deck'], [1, 'engine'],
  [3, 'deck'], [3, 'deck'], [4, 'engine'], [4, 'engine'], [2, 'engine'], [2, 'engine'], [3, 'engine'], [2, 'engine'], [2, 'deck'],
  [3, 'deck'], [4, 'common'], [3, 'engine'], [2, 'engine'], [3, 'engine'],
].map(([level, major]) => ({ level, major }));
if (META.length !== FAMILIES.length) throw new Error('Every maths family needs a difficulty and major.');

/** Families for a year: that year's level and the one below, for the requested major. */
export function mathFamilies(year, major = 'common') {
  const fits = (index, low) => META[index].level <= year && META[index].level >= low && (major === 'common' || META[index].major !== (major === 'deck' ? 'engine' : 'deck'));
  const indexes = FAMILIES.map((_, i) => i);
  const core = indexes.filter(i => fits(i, Math.max(1, year - 1)));
  return core.length >= 5 ? core : indexes.filter(i => fits(i, 1));
}

export function mathQuestions(id, count, { semester = 1, major = 'common', set = '' } = {}) {
  const year = Math.min(4, Math.max(1, Math.ceil(semester / 2)));
  const tag = set ? `${set}-` : '';
  const order = shuffle(mathFamilies(year, major), `${id}:families:${semester}${set ? `:${set}` : ''}`).slice(0, count);
  return order.map((family, i) => {
    const next = rng(`${id}:${set}${i}:${family}`); const r = n => Math.floor(next() * n);
    const q = FAMILIES[family](r), qid = `${id}-${tag}m${i + 1}`;
    // From Year 2, every other question with an exact value is typed in rather than chosen.
    if (year >= 2 && i % 2 === 1 && Number.isFinite(q.value)) {
      return number({ id: qid, prompt: q.prompt, value: q.value, tolerance: q.tolerance ?? 0, unit: q.unit, explanation: q.explanation, label: 'Maritime mathematics · number entry', hint: q.hint });
    }
    return choice({ id: qid, prompt: q.prompt, correct: q.correct, distractors: q.distractors, explanation: q.explanation, label: 'Maritime mathematics', hint: q.hint });
  });
}
