/** Quick maritime trivia that walking students share when a cadet stops to chat.
 * Casual practice only: no XP, no grades, nothing saved to the academy record. */
export const STUDENT_GREETINGS = [
  'Hey, cadet! Got a minute? Try this one:',
  'Good timing — I was just revising. Quick question:',
  'Hi! Our instructor asked us this today:',
  'Sawasdee! Let’s test your sea sense:',
  'Before our next class, can you answer this?',
];

// [question, correct, [wrong options], fun fact]
export const STUDENT_TRIVIA = [
  ['Which side of a ship is “port”?', 'The left side, facing forward', ['The right side, facing forward', 'The back of the ship', 'The front of the ship'], 'Port is left and shows a red light. Starboard is right and shows green.'],
  ['What colour is a ship’s starboard sidelight?', 'Green', ['Red', 'White', 'Yellow'], 'Memory aid: “There is no red port left in the bottle” — port is red, so starboard is green.'],
  ['How long is a standard sea watch?', 'Four hours', ['Two hours', 'Eight hours', 'Twelve hours'], 'The 0800–1200 watch is a classic four-hour watch.'],
  ['What is one knot?', 'One nautical mile per hour', ['One kilometre per hour', 'One mile per minute', 'One metre per second'], 'One nautical mile is 1,852 metres.'],
  ['What does “aft” mean?', 'Towards the stern (back)', ['Towards the bow (front)', 'Above the deck', 'Below the waterline'], 'Forward is towards the bow; aft is towards the stern.'],
  ['Who is in overall command of a ship?', 'The Master', ['The Chief Officer', 'The bosun', 'The pilot'], 'The Master keeps command even when a pilot has the con.'],
  ['Which radio channel is used for VHF distress calls by voice?', 'Channel 16', ['Channel 12', 'Channel 70', 'Channel 6'], 'DSC distress alerts use Channel 70; voice uses Channel 16.'],
  ['How many times do you say MAYDAY at the start of a distress call?', 'Three', ['One', 'Two', 'Five'], 'MAYDAY, MAYDAY, MAYDAY — then the vessel name three times.'],
  ['What does PAN-PAN signal?', 'An urgent message, below distress level', ['Grave and imminent danger', 'A weather forecast', 'The end of a call'], 'MAYDAY = distress, PAN-PAN = urgency, SÉCURITÉ = safety.'],
  ['In the phonetic alphabet, what word means “B”?', 'Bravo', ['Bob', 'Beta', 'Baker'], 'Alfa, Bravo, Charlie, Delta…'],
  ['What is the general emergency alarm?', 'Seven or more short blasts and one long blast', ['One long blast', 'Three short blasts', 'Two long blasts'], 'When you hear it, go to your muster station with your lifejacket.'],
  ['Two power-driven ships meet head-on. Which way do both turn?', 'To starboard', ['To port', 'The smaller ship stops', 'Both keep straight'], 'COLREG Rule 14: both alter to starboard and pass port to port.'],
  ['In a crossing situation, which power-driven vessel gives way?', 'The one with the other on her starboard side', ['The one with the other on her port side', 'The bigger one', 'The faster one'], 'COLREG Rule 15. If you see a red light on your right, give way.'],
  ['Red over red all-round lights at night mean…', 'Vessel not under command', ['Vessel at anchor', 'Pilot vessel', 'Fishing vessel'], 'Memory aid: “Red over red, the captain is dead.”'],
  ['White over red all-round lights mean…', 'A pilot vessel on duty', ['A fishing vessel', 'A vessel aground', 'A tug towing'], 'Memory aid: “White over red, pilot ahead.”'],
  ['Green over white all-round lights mean…', 'A vessel trawling', ['A pilot vessel', 'A sailing vessel', 'A vessel at anchor'], 'Memory aid: “Green over white, trawling at night.”'],
  ['How long is one shackle of anchor cable?', '27.5 metres', ['10 metres', '50 metres', '100 metres'], 'The book’s Unit 7 uses shackles to describe how much cable is out.'],
  ['What does an EPIRB do?', 'Sends a distress alert by satellite', ['Measures water depth', 'Steers the ship', 'Starts the generator'], 'Modern EPIRBs transmit on 406 MHz.'],
  ['What is the fire triangle?', 'Heat, fuel and oxygen', ['Water, wind and smoke', 'Foam, CO2 and powder', 'Heat, light and sound'], 'Remove any one side and the fire goes out.'],
  ['Which extinguisher should NOT be used on an electrical fire?', 'Water', ['CO2', 'Dry powder', 'None of these'], 'Water conducts electricity — use CO2.'],
  ['What does “bosun” mean?', 'The senior rating of the deck department', ['The ship’s cook', 'The chief engineer', 'The ship’s doctor'], 'The bosun assigns deck ratings each morning (book, Unit 1).'],
  ['What is the bridge?', 'The space from which the ship is navigated', ['A ramp to the shore', 'The engine control room', 'A cargo hold'], 'Book, Unit 2 vocabulary.'],
  ['What does “ETA” stand for?', 'Estimated Time of Arrival', ['Engine Temperature Alarm', 'Emergency Tow Assistance', 'Expected Tide Angle'], 'Report your ETA to the pilot station.'],
  ['What does “OVER” mean on the radio?', 'My turn is finished; reply expected', ['The call is finished; no reply', 'Repeat your message', 'Wait'], 'OUT ends the exchange; OVER invites a reply.'],
  ['What is a “near-miss”?', 'An event that could have caused harm but did not', ['A ship that missed the port', 'A small collision', 'A late crew member'], 'Near-misses must still be reported (book, Unit 10).'],
  ['Which is denser: sea water or fresh water?', 'Sea water', ['Fresh water', 'They are equal', 'It depends on the colour'], 'A ship floats a little deeper in fresh water.'],
  ['Which convention protects the sea from pollution by ships?', 'MARPOL', ['COLREG', 'SOLAS', 'STCW'], 'MARPOL Annex V bans throwing plastics overboard.'],
  ['Which convention is about Safety of Life at Sea?', 'SOLAS', ['MARPOL', 'COLREG', 'ISPS'], 'SOLAS covers lifeboats, fire safety and much more.'],
  ['What do you shout if someone falls overboard?', '“Man overboard!”', ['“Abandon ship!”', '“All fast!”', '“Stand by!”'], 'Throw a lifebuoy and keep pointing at the person.'],
  ['Where should you NEVER stand during mooring?', 'In the bight of a rope', ['Behind the station leader', 'In the accommodation', 'On the bridge'], 'A rope under tension can snap back with great force.'],
  ['What does a barometer measure?', 'Air pressure', ['Wind speed', 'Water depth', 'Engine speed'], 'A falling barometer often means worse weather is coming.'],
  ['Wind “from the south-west” blows…', 'from the south-west towards the north-east', ['towards the south-west', 'only at night', 'from the sea floor'], 'Winds are named by where they come FROM.'],
  ['How many minutes of latitude make one nautical mile?', 'One', ['Sixty', 'Ten', 'Thirty'], 'One minute of latitude = one nautical mile.'],
  ['What is a lifebuoy for?', 'Helping a person float in the water', ['Mooring the ship', 'Marking the anchor', 'Fighting fires'], 'Bridge-wing lifebuoys carry a light and a smoke signal.'],
  ['What is a “rating”?', 'A crew member who is not an officer', ['A type of engine', 'A radio channel', 'A wave height'], 'Book, Unit 1 vocabulary.'],
];

/** Picks a random question, avoiding the last few asked in this session. */
export function pickTrivia(recent = []) {
  const pool = STUDENT_TRIVIA.map((_, i) => i).filter(i => !recent.includes(i));
  const index = pool[Math.floor(Math.random() * pool.length)];
  const [question, correct, wrong, fact] = STUDENT_TRIVIA[index];
  const options = [correct, ...wrong].map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(item => item.value);
  return { index, question, correct, options, fact };
}

export const pickGreeting = () => STUDENT_GREETINGS[Math.floor(Math.random() * STUDENT_GREETINGS.length)];
