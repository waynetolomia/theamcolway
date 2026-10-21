// Shipboard procedures to put in order. Steps follow common company and training practice;
// instructors should confirm them against the vessel's own procedures (see instructor review list).
import { sequence, shuffle } from '../lib.mjs';

const PROCEDURES = [
  { major: 'common', level: 1, title: 'Man overboard (first actions)', steps: ['Shout “Man overboard!” and throw a lifebuoy', 'Keep the person in sight and point', 'Raise the alarm and inform the bridge', 'Manoeuvre the ship back (for example, a Williamson turn)', 'Prepare the rescue boat and recover the person'] },
  { major: 'common', level: 1, title: 'Discovering a fire', steps: ['Raise the fire alarm', 'Inform the bridge of the location', 'Fight the fire only if it is safe, with the right extinguisher', 'Close doors and ventilation to contain it', 'Report to the muster point and follow the fire party leader'] },
  { major: 'common', level: 1, title: 'Abandon ship', steps: ['Hear the general alarm: seven short blasts and one long', 'Put on warm clothing and your lifejacket', 'Go to your muster station', 'Follow the order to abandon ship and board the survival craft', 'Launch and move clear of the ship'] },
  { major: 'common', level: 2, title: 'Entering an enclosed space', steps: ['Get a permit to work signed by the responsible officer', 'Ventilate the space', 'Test the atmosphere for oxygen, flammable and toxic gases', 'Post a standby person with rescue equipment', 'Enter, keep testing and keep in contact'] },
  { major: 'common', level: 1, title: 'Putting on an immersion suit', steps: ['Unpack the suit and check it for damage', 'Sit down and put your legs in', 'Put your arms and the hood on', 'Close the zip fully', 'Check the face seal and gloves'] },
  { major: 'common', level: 2, title: 'VHF distress message', steps: ['Press the DSC distress button', 'Switch to channel 16', 'Say “MAYDAY” three times', 'Give the ship’s name and call sign', 'Give your position', 'State the nature of distress and the help needed'] },
  { major: 'deck', level: 2, title: 'Handing over the navigational watch', steps: ['Arrive early and let your eyes adjust to the dark', 'Check the position, course and speed', 'Review traffic, weather and the Master’s orders', 'Confirm you are ready to take over', 'Take over the watch and record it in the log'] },
  { major: 'deck', level: 3, title: 'Letting go the anchor', steps: ['Confirm the anchoring position and depth with the bridge', 'Remove the lashings and check the brake is on', 'Engage and walk out the anchor to just above the seabed', 'Put the windlass out of gear and let go on the brake', 'Report the number of shackles and when the anchor is holding'] },
  { major: 'deck', level: 3, title: 'Preparing for arrival at a pilot station', steps: ['Check the passage plan and ETA with the pilot station', 'Rig the pilot ladder on the lee side', 'Test the steering gear, engines and communications', 'Reduce speed and make a lee for the pilot boat', 'Meet the pilot and hold the Master–pilot exchange'] },
  { major: 'engine', level: 2, title: 'Preparing the main engine for start', steps: ['Check the lube oil sump level', 'Start the lube oil pump and check the pressure', 'Turn the engine with the turning gear', 'Disengage the turning gear', 'Blow the engine through with air, then start'] },
  { major: 'engine', level: 3, title: 'Bunkering', steps: ['Hold the pre-bunkering meeting and complete the checklist', 'Sound the tanks and set the valves', 'Connect the hose and check for leaks', 'Start pumping slowly, then increase the rate', 'Top off, stop, drain and disconnect'] },
  { major: 'engine', level: 2, title: 'Isolating a pump for maintenance', steps: ['Inform the duty engineer and get a permit', 'Stop the pump and lock out its breaker', 'Close the suction and discharge valves', 'Drain and vent the pump', 'Tag it out and start the work'] },
  { major: 'engine', level: 3, title: 'Starting a generator and putting it on the switchboard', steps: ['Check fuel, lube oil and cooling water', 'Start the generator engine', 'Check voltage and frequency', 'Synchronise with the running generator', 'Close the breaker and share the load'] },
];

/** Procedures for a year and major: that year's level and below. */
export function procedures(year, major = 'common') {
  return PROCEDURES.filter(p => p.level <= year && (major === 'common' || p.major === 'common' || p.major === major));
}

export function sequenceQuestions(id, count, { year = 1, major = 'common', seed = id, tag = '' } = {}) {
  return shuffle(procedures(year, major), `${seed}:procedures`).slice(0, count).map((p, i) => sequence({
    id: `${id}-${tag}q${i + 1}`, prompt: `${p.title}: put the steps in the correct order.`, steps: p.steps,
    label: `Procedure · ${p.major === 'common' ? 'safety' : p.major.toUpperCase()}`, hint: 'Think about what keeps people safe first.',
  }));
}

export const PROCEDURE_COUNT = PROCEDURES.length;
