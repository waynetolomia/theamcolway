// Maritime science: generated calculations plus a bank of concept questions.
import { choice, number, rng, shuffle } from '../lib.mjs';

const fmt = (n, dp = 1) => { const v = +n.toFixed(dp); return Number.isInteger(v) ? String(v) : v.toFixed(dp); };

const CALC = [
  r => { const v = [10, 20, 40, 50, 100][r(5)];
    return { prompt: `Sea water has a density of about 1.025 t/m³. What is the mass of ${v} m³ of sea water?`, correct: `${fmt(v * 1.025, 2)} t`,
      distractors: [`${v} t`, `${fmt(v / 1.025, 2)} t`, `${fmt(v * 1.25, 2)} t`], explanation: `Mass = density × volume = 1.025 × ${v} = ${fmt(v * 1.025, 2)} t.`, value: v * 1.025, tolerance: 0.05, unit: 't', hint: 'Mass = density × volume.' }; },
  r => { const v = [50, 100, 200, 400][r(4)], d = [0.85, 0.9, 0.95, 0.98][r(4)];
    return { prompt: `Fuel oil has a density of ${d} t/m³. A tank holds ${v} m³. What is the mass of fuel?`, correct: `${fmt(v * d, 1)} t`,
      distractors: [`${v} t`, `${fmt(v / d, 1)} t`, `${fmt(v * (d + 0.1), 1)} t`], explanation: `Mass = ${d} × ${v} = ${fmt(v * d, 1)} t.` }; },
  r => { const bar = [2, 2.5, 3, 4, 6, 7][r(6)];
    return { prompt: `1 bar = 100 kPa. A pressure of ${bar} bar equals…`, correct: `${fmt(bar * 100)} kPa`,
      distractors: [`${fmt(bar * 10)} kPa`, `${fmt(bar * 1000)} kPa`, `${fmt(bar)} kPa`], explanation: `${bar} × 100 = ${fmt(bar * 100)} kPa.` }; },
  r => { const c = [20, 30, 40, 50, 80, 100][r(6)];
    return { prompt: `Convert ${c} °C to kelvin.`, correct: `${c + 273} K`,
      distractors: [`${c - 273} K`, `${c + 100} K`, `${c * 2} K`], explanation: `K = °C + 273 → ${c + 273} K.`, value: c + 273, unit: 'K' }; },
  r => { const c = [0, 10, 20, 30, 40, 100][r(6)], f = c * 9 / 5 + 32;
    return { prompt: `Convert ${c} °C to °F. (°F = °C × 9/5 + 32)`, correct: `${fmt(f)} °F`,
      distractors: [`${fmt(c + 32)} °F`, `${fmt(c * 2)} °F`, `${fmt((c - 32) * 5 / 9)} °F`], explanation: `${c} × 9/5 + 32 = ${fmt(f)} °F.` }; },
  r => { const i = [2, 3, 4, 5, 10][r(5)], R = [11, 22, 23, 44, 55][r(5)];
    return { prompt: `Ohm’s law: V = I × R. A current of ${i} A flows through a resistance of ${R} Ω. What is the voltage?`, correct: `${i * R} V`,
      distractors: [`${fmt(R / i, 1)} V`, `${i + R} V`, `${i * R * 2} V`], explanation: `V = ${i} × ${R} = ${i * R} V.`, value: i * R, unit: 'V', hint: 'V = I × R.' }; },
  r => { const v = [220, 230, 440][r(3)], i = [2, 5, 10, 20][r(4)];
    return { prompt: `Power P = V × I. A motor takes ${i} A at ${v} V. What power does it use?`, correct: `${fmt(v * i / 1000, 2)} kW`,
      distractors: [`${fmt(v / i, 1)} kW`, `${fmt(v * i, 0)} kW`, `${fmt((v + i) / 1000, 2)} kW`], explanation: `P = ${v} × ${i} = ${v * i} W = ${fmt(v * i / 1000, 2)} kW.` }; },
  r => { const depth = [5, 10, 15, 20][r(4)];
    return { prompt: `Water pressure increases by about 0.1 bar for each metre of depth in sea water. About how much extra pressure acts at ${depth} m depth?`, correct: `${fmt(depth * 0.1)} bar`,
      distractors: [`${depth} bar`, `${fmt(depth * 0.01, 2)} bar`, `${fmt(depth * 1.025)} bar`], explanation: `${depth} × 0.1 = ${fmt(depth * 0.1)} bar (about ${depth * 10} kPa).` }; },
  r => { const f = [200, 400, 500, 1000][r(4)], d = [2, 3, 5, 10][r(4)];
    return { prompt: `Work = force × distance. A winch pulls with ${f} N over ${d} m. How much work is done?`, correct: `${f * d} J`,
      distractors: [`${f + d} J`, `${fmt(f / d)} J`, `${f * d * 10} J`], explanation: `W = ${f} × ${d} = ${f * d} J.`, value: f * d, unit: 'J' }; },
  r => { const p1 = [1, 2][r(2)], v1 = [6, 8, 10, 12][r(4)], k = [2, 4][r(2)];
    return { prompt: `Boyle’s law (constant temperature): P₁V₁ = P₂V₂. Air at ${p1} bar in ${v1} L is compressed to ${v1 / k} L. What is the new pressure?`, correct: `${p1 * k} bar`,
      distractors: [`${fmt(p1 / k)} bar`, `${p1 + k} bar`, `${p1} bar`], explanation: `P₂ = ${p1} × ${v1} ÷ ${v1 / k} = ${p1 * k} bar.`, value: p1 * k, unit: 'bar', hint: 'P₂ = P₁ × V₁ ÷ V₂.' }; },
  r => { const disp = [5000, 8000, 10000, 20000][r(4)];
    return { prompt: `A floating ship weighs ${disp.toLocaleString('en-US')} tonnes. What mass of water does she displace?`, correct: `${disp.toLocaleString('en-US')} tonnes`,
      distractors: [`${(disp / 2).toLocaleString('en-US')} tonnes`, `${(disp * 1.025).toLocaleString('en-US')} m³ of steel`, `0 tonnes`], explanation: 'Archimedes: a floating body displaces its own weight of water.' }; },
];

const FACTS = [
  ['A ship moves from sea water into fresh water. Her draft will…', 'increase (she sinks deeper)', ['decrease', 'stay exactly the same', 'become zero'], 'Fresh water is less dense, so more volume must be displaced.'],
  ['Why does a steel ship float?', 'Her shape displaces a weight of water equal to her own weight', ['Steel is lighter than water', 'Air in the engine pushes her up', 'The paint makes her waterproof'], 'Archimedes’ principle.'],
  ['Which is denser: sea water or fresh water?', 'Sea water', ['Fresh water', 'They are the same', 'It depends on the time of day'], 'Dissolved salt increases density (about 1.025 vs 1.000 t/m³).'],
  ['Rust on a steel deck needs…', 'iron, water and oxygen', ['only heat', 'only salt', 'only sunlight'], 'Corrosion of steel is an oxidation reaction; salt water speeds it up.'],
  ['Zinc anodes are fitted to the hull to…', 'corrode instead of the steel hull', ['make the ship faster', 'improve radio signals', 'store electricity'], 'Sacrificial anodes provide cathodic protection.'],
  ['Heat moves from a hot engine to the surrounding air mainly by…', 'convection and radiation', ['magnetism', 'evaporation of steel', 'sound waves'], 'Heat transfer: conduction, convection and radiation.'],
  ['Heat travelling along a metal pipe is an example of…', 'conduction', ['convection', 'radiation', 'reflection'], 'Conduction passes heat through solids.'],
  ['Which material is a good electrical insulator?', 'Rubber', ['Copper', 'Steel', 'Sea water'], 'Insulators resist the flow of electric current.'],
  ['Sea water is a good conductor of electricity because it contains…', 'dissolved salts (ions)', ['oxygen bubbles', 'sand', 'fish oil'], 'Ions carry electric charge.'],
  ['What is the boiling point of fresh water at normal atmospheric pressure?', '100 °C', ['0 °C', '50 °C', '212 °C'], '100 °C = 212 °F at sea level.'],
  ['At higher pressure, the boiling point of water is…', 'higher', ['lower', 'the same', 'zero'], 'This is why boilers produce steam above 100 °C.'],
  ['A fuel purifier separates water and dirt from oil using…', 'centrifugal force and the difference in density', ['magnetism', 'freezing', 'electric light'], 'Book Unit 9: the purifier separates by density in a rotating bowl.'],
  ['Why is heavy fuel oil heated before use?', 'To reduce its viscosity so it flows and atomises', ['To increase its weight', 'To change its colour', 'To make it denser'], 'Viscosity falls as temperature rises.'],
  ['“Viscosity” means…', 'resistance to flow', ['weight per volume', 'temperature', 'colour of oil'], 'Thick oil has high viscosity.'],
  ['Which gas makes up about 78% of air?', 'Nitrogen', ['Oxygen', 'Carbon dioxide', 'Hydrogen'], 'Air: about 78% nitrogen, 21% oxygen.'],
  ['Why is CO2 used to put out fires in closed spaces?', 'It displaces oxygen and smothers the fire', ['It cools by burning', 'It adds fuel', 'It is lighter than air and rises away'], 'CO2 is heavier than air and excludes oxygen — deadly for people too.'],
  ['Hydrogen sulphide (H2S) in tanks is dangerous because it is…', 'toxic and can kill at low concentrations', ['a source of oxygen', 'harmless', 'only flammable when frozen'], 'Enclosed space hazard.'],
  ['What makes a liquid “flammable” at normal temperatures?', 'A low flash point', ['A high flash point', 'A high density', 'A dark colour'], 'Flash point: lowest temperature at which vapour can ignite.'],
  ['A barometer measures…', 'atmospheric pressure', ['wind speed', 'sea temperature', 'humidity'], 'Book Unit 4: “The barometer read 1008.6 and was falling.”'],
  ['A falling barometer usually suggests…', 'worsening weather is approaching', ['calm weather is certain', 'the tide is high', 'the engine is overheating'], 'Low pressure systems bring wind and rain.'],
  ['Wind direction is named by…', 'the direction it blows FROM', ['the direction it blows TO', 'its speed', 'the time of day'], 'A south-west wind blows from the south-west (book Unit 4).'],
  ['The Beaufort scale measures…', 'wind strength from force 0 to 12', ['wave colour', 'water depth', 'engine power'], 'Book Unit 4 vocabulary.'],
  ['Swell is…', 'long waves from a distant weather system', ['waves made by the local wind only', 'a type of tide', 'a current near the coast'], 'Book Unit 4 vocabulary.'],
  ['Tides are mainly caused by…', 'the gravity of the Moon and the Sun', ['the wind', 'ships’ propellers', 'river water'], 'Gravitational attraction raises the tides.'],
  ['Sound travels faster in…', 'water than in air', ['air than in water', 'a vacuum', 'neither'], 'About 1,500 m/s in sea water vs 343 m/s in air — used by echo sounders.'],
  ['An echo sounder measures depth by…', 'timing a sound pulse to the seabed and back', ['measuring water temperature', 'reading the GPS', 'dropping a weight on a rope every second'], 'Depth = speed of sound × time ÷ 2.'],
  ['Radar works by…', 'sending radio waves and receiving their echoes', ['listening for engine noise', 'using light from the Sun', 'measuring water depth'], 'Range is found from the echo’s travel time.'],
  ['A magnetic compass points to…', 'magnetic north', ['true north exactly', 'the Sun', 'the nearest land'], 'Variation and deviation correct it to true north.'],
  ['A gyro compass points to…', 'true north', ['magnetic north', 'the bow', 'the wind'], 'It uses a spinning gyroscope and the Earth’s rotation.'],
  ['In a diesel engine, the fuel ignites because…', 'compressed air becomes very hot', ['a spark plug fires', 'sunlight heats it', 'the exhaust ignites it'], 'Compression ignition.'],
  ['Why does an engine need lubricating oil?', 'To reduce friction and wear and carry heat away', ['To make the engine heavier', 'To increase friction', 'To replace fuel'], 'Lubrication separates moving surfaces.'],
  ['A centrifugal pump’s “suction side” is…', 'the inlet side', ['the outlet side', 'the motor', 'the pressure gauge'], 'Book Unit 9: suction = inlet, discharge = outlet.'],
  ['A blocked suction strainer usually causes the suction pressure to…', 'fall', ['rise sharply', 'stay exactly the same', 'become a temperature'], 'Book Unit 9: a restriction on the suction side lowers pressure.'],
  ['Ship stability: a lower centre of gravity generally makes the ship…', 'more stable', ['less stable', 'faster', 'lighter'], 'Heavy weights low down increase stability.'],
  ['Free surface in a partly filled tank…', 'reduces the ship’s stability', ['increases stability', 'has no effect', 'makes the ship lighter'], 'Moving liquid shifts its weight as the ship rolls.'],
  ['Why is ballast water taken on?', 'To control draft, trim and stability', ['To clean the tanks', 'To make drinking water', 'To cool the cargo'], 'Book Unit 8: ballast plan and trim limits.'],
  ['Refrigeration in reefer containers works by…', 'evaporating a refrigerant that absorbs heat', ['adding ice every hour', 'burning fuel inside', 'using sea water only'], 'Evaporation absorbs heat (latent heat).'],
  ['The unit of electric current is the…', 'ampere (A)', ['volt (V)', 'ohm (Ω)', 'watt (W)'], 'Current is measured in amperes.'],
  ['The unit of pressure in the SI system is the…', 'pascal (Pa)', ['newton (N)', 'joule (J)', 'kelvin (K)'], '1 Pa = 1 N/m²; 1 bar = 100,000 Pa.'],
  ['RPM measures…', 'how many times a shaft turns each minute', ['engine temperature', 'fuel pressure', 'ship speed in knots'], 'Book Unit 3: revolutions per minute.'],
];

/** Gauges read in the engine room and on the bridge: [label, unit, minimum, maximum, smallest division]. */
const GAUGES = {
  engine: [['Lube oil pressure', 'bar', 0, 10, 0.5], ['Jacket cooling water temperature', '°C', 0, 120, 5], ['Starting air pressure', 'bar', 0, 40, 2],
    ['Fuel oil temperature', '°C', 0, 160, 10], ['Boiler steam pressure', 'bar', 0, 16, 1], ['Shaft speed', 'rpm', 0, 150, 10]],
  deck: [['Barometer', 'hPa', 960, 1050, 5], ['Hydraulic steering pressure', 'bar', 0, 100, 5], ['Ballast line pressure', 'bar', 0, 10, 0.5]],
};
function gaugeQuestion(id, major, seed) {
  const next = rng(seed), r = n => Math.floor(next() * n);
  const pool = major === 'deck' ? GAUGES.deck : major === 'engine' ? GAUGES.engine : [...GAUGES.engine, ...GAUGES.deck];
  const [label, unit, min, max, step] = pool[r(pool.length)];
  const steps = Math.round((max - min) / step), at = 2 + r(steps - 3), value = +(min + at * step).toFixed(2);
  const show = v => `${fmt(v, step < 1 ? 1 : 0)} ${unit}`;
  return choice({ id, prompt: `Read the ${label.toLowerCase()} gauge. What does the needle show?`, correct: show(value),
    distractors: [show(value + step), show(value - step), show(value + 2 * step)], label: 'Maritime science · gauge reading',
    explanation: `Each small division is ${fmt(step, step < 1 ? 1 : 0)} ${unit}. The needle points to ${show(value)}.`,
    hint: 'Find the value of one small division first.', figure: { kind: 'gauge', label, unit, min, max, step, value } });
}

export function scienceQuestions(id, count, { semester = 1, major = 'common', set = '' } = {}) {
  const year = Math.min(4, Math.max(1, Math.ceil(semester / 2))), tag = set ? `${set}-` : '';
  const calcCount = Math.ceil(count / 2);
  const calc = shuffle(CALC.map((_, i) => i), `${id}:calc:${semester}${set ? `:${set}` : ''}`).slice(0, calcCount).map((family, i) => {
    const next = rng(`${id}:${set}${i}:${family}`); const r = n => Math.floor(next() * n);
    const q = CALC[family](r), qid = `${id}-${tag}x${i + 1}`;
    // From Year 2, calculations with an exact value are typed in on alternate questions.
    if (year >= 2 && i % 2 === 1 && Number.isFinite(q.value)) return number({ id: qid, prompt: q.prompt, value: q.value, tolerance: q.tolerance ?? 0, unit: q.unit, explanation: q.explanation, label: 'Maritime science · number entry', hint: q.hint });
    return choice({ id: qid, prompt: q.prompt, correct: q.correct, distractors: q.distractors, explanation: q.explanation, label: 'Maritime science', hint: q.hint });
  });
  const gauge = gaugeQuestion(`${id}-${tag}g1`, major, `${id}:${set}gauge`);
  const facts = shuffle(FACTS, `${id}:facts${set ? `:${set}` : ''}`).slice(0, count - calcCount - 1).map(([prompt, correct, distractors, explanation], i) =>
    choice({ id: `${id}-${tag}f${i + 1}`, prompt, correct, distractors, explanation, label: 'Maritime science' }));
  return shuffle([...calc, gauge, ...facts], `${id}:mix${set}`);
}
