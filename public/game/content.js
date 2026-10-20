/*
 * THE AMCOL WAY — A Seafarer's Journey
 * Original ESL activities for a simplified, fictional academy progression.
 * Four game years are not an approved four-year maritime curriculum.
 * Completing this prototype does not award a licence, sea service or a captain qualification.
 * Short functional SMCP utterances were checked against IMO Resolution A.918(22).
 * Optional alternatives in the source have been resolved to one answer per activity.
 */

export const CURRICULUM = [
  {
    year: 1,
    title: 'Your First Watch',
    summary: 'Find your feet at the academy. Learn the ship’s main spaces and practise asking for clear radio communication.',
    vocabulary: [
      { term: 'Bow', definition: 'The front end of a vessel.', hint: 'Face this end when identifying port and starboard.' },
      { term: 'Stern', definition: 'The back end of a vessel.', hint: 'It is at the opposite end from the bow.' },
      { term: 'Bridge', definition: 'The area from which a vessel is navigated and manoeuvred.', hint: 'The officer of the watch works here.' },
      { term: 'Deck', definition: 'A floor or horizontal platform on a vessel.', hint: 'You may walk on an open one outside.' },
      { term: 'Hull', definition: 'The main watertight body of a vessel.', hint: 'Think of the ship’s outer body, not a room inside it.' },
      { term: 'Galley', definition: 'The room where food is prepared on board.', hint: 'This is the ship’s kitchen.' },
      { term: 'Cabin', definition: 'A private room for accommodation on board.', hint: 'A crew member may sleep here.' },
      { term: 'Gangway', definition: 'A walkway used to board or leave a vessel.', hint: 'Use this connection between the vessel and the shore.' }
    ],
    smcp: [
      {
        id: 'y1-radio-check',
        context: 'You are practising a radio check in the academy lab. Ask how clearly the other station receives your voice.',
        phrase: 'How do you read me?',
        meaning: 'How clearly can you receive my radio transmission?',
        explanation: 'Here, “read” means receive and understand a radio signal. The question checks reception.',
        sourceId: 'imo-smcp-general',
        sourceSection: 'General 6.1'
      },
      {
        id: 'y1-radio-response',
        context: 'The instructor asks for a radio check. The exercise card shows GOOD reception. Give that report.',
        phrase: 'I read you good.',
        meaning: 'Your radio transmission is received with good signal strength.',
        explanation: 'Use the reception category shown on the exercise card. This is the standard radio wording for that category.',
        sourceId: 'imo-smcp-general',
        sourceSection: 'General 6.1.1 — good alternative'
      },
      {
        id: 'y1-repeat',
        context: 'Background noise covers the instructor’s message. Ask for the whole message again, using the polite version.',
        phrase: 'Say again please.',
        meaning: 'Please transmit the message again.',
        explanation: 'Ask for repetition when you did not hear the message clearly. Guessing can change its meaning.',
        sourceId: 'imo-smcp-general',
        sourceSection: 'General 9.2 — optional please included'
      },
      {
        id: 'y1-no-information',
        context: 'In a communication exercise, you are asked for a detail that cannot be obtained. State that clearly.',
        phrase: 'No information.',
        meaning: 'The requested information cannot be obtained.',
        explanation: 'This response reports that the information is unavailable. It does not promise a later answer.',
        sourceId: 'imo-smcp-general',
        sourceSection: 'General 4.4'
      }
    ]
  },
  {
    year: 2,
    title: 'Find Your Bearings',
    summary: 'Build your navigation language. Describe positions and directions, then use clear location questions and reports.',
    vocabulary: [
      { term: 'Port', definition: 'The vessel’s left side when you face the bow.', hint: 'In this activity, this word means a side of the ship.' },
      { term: 'Starboard', definition: 'The vessel’s right side when you face the bow.', hint: 'It is the side opposite port.' },
      { term: 'Forward', definition: 'Towards the front of the vessel.', hint: 'This direction leads towards the bow.' },
      { term: 'Aft', definition: 'Towards the back of the vessel.', hint: 'This direction leads towards the stern.' },
      { term: 'Amidships', definition: 'In or near the middle part of the vessel.', hint: 'Think of a location between the bow and stern.' },
      { term: 'Heading', definition: 'The direction in which the vessel’s bow is pointing.', hint: 'Check where the ship’s front points on the compass.' },
      { term: 'Bearing', definition: 'The direction from one position to another, measured from a stated reference.', hint: 'Use it to describe where an object lies from your position.' },
      { term: 'Nautical mile', definition: 'A unit of distance equal to 1,852 metres.', hint: 'This measures distance at sea; a knot measures speed.' }
    ],
    smcp: [
      {
        id: 'y2-position',
        context: 'You are playing the traffic-service operator in a classroom exercise. Ask a vessel for its current location.',
        phrase: 'What is your position?',
        meaning: 'Give the vessel’s present location.',
        explanation: '“Position” asks where the vessel is. It does not ask where the vessel is going.',
        sourceId: 'imo-smcp-position',
        sourceSection: 'A1/6.1.1, item 3'
      },
      {
        id: 'y2-heading',
        context: 'In the bridge simulator, ask the helmsman for the direction in which the vessel’s bow is pointing.',
        phrase: 'What is your heading?',
        meaning: 'Report the direction of the vessel’s bow.',
        explanation: 'The question asks for the vessel’s orientation. A rudder angle would answer a different question.',
        sourceId: 'imo-smcp-position',
        sourceSection: 'A2/1 — heading check'
      },
      {
        id: 'y2-buoy',
        context: 'The training route has already been checked. Give the wheel instruction that keeps the buoy on the vessel’s left side.',
        phrase: 'Keep the buoy on port side.',
        meaning: 'Pass so that the buoy remains on the vessel’s port side.',
        explanation: 'Port stays the vessel’s left side when facing the bow. The exercise practises a stated route, not how to choose a safe route.',
        sourceId: 'imo-smcp-position',
        sourceSection: 'A2/1, order 13 — buoy and port alternatives'
      },
      {
        id: 'y2-arrival',
        context: 'During a berthing simulation, your vessel has reached the position specified in the exercise. Report this.',
        phrase: 'We are in position.',
        meaning: 'The vessel is now in the required position.',
        explanation: 'This confirms the location has been reached. Further berthing actions still depend on the next order.',
        sourceId: 'imo-smcp-position',
        sourceSection: 'A2/3.7.2, item 18'
      }
    ]
  },
  {
    year: 3,
    title: 'Ready to Respond',
    summary: 'Join supervised safety drills. Recognise essential equipment and practise short, precise reports about people and escape routes.',
    vocabulary: [
      { term: 'Lifejacket', definition: 'A personal flotation device worn to help keep a person afloat.', hint: 'You wear this item on your body.' },
      { term: 'Lifebuoy', definition: 'A floating rescue ring that can be thrown to a person in the water.', hint: 'This rescue item is usually ring-shaped.' },
      { term: 'Lifeboat', definition: 'A survival boat used to carry people away from a vessel in an emergency.', hint: 'It is a boat, rather than a wearable flotation device.' },
      { term: 'Muster station', definition: 'The assigned place where people gather for an emergency check.', hint: 'Go to the location assigned on the ship’s safety instructions.' },
      { term: 'Escape route', definition: 'A marked path that leads out of a space to a safer location.', hint: 'This route must remain unobstructed.' },
      { term: 'Fire extinguisher', definition: 'A portable device that releases an agent to fight a fire.', hint: 'Its type must be suitable for the fire.' },
      { term: 'Alarm', definition: 'A warning signal that calls attention to danger or an emergency.', hint: 'It may be heard, seen, or both.' },
      { term: 'First aid', definition: 'Initial help given to a person who is injured or suddenly ill.', hint: 'This is immediate assistance before further medical care.' }
    ],
    smcp: [
      {
        id: 'y3-overboard',
        context: 'A supervised drill uses a floating dummy on the vessel’s right side. Practise the prescribed overboard alert for that side.',
        phrase: 'Man overboard on starboard side!',
        meaning: 'A person has fallen into the water on the vessel’s starboard side.',
        explanation: 'This standard alert names the event and its side. The wording “man overboard” is used for a person of any gender.',
        sourceId: 'imo-smcp-safety',
        sourceSection: 'B2/6.2, item 1 — starboard alternative'
      },
      {
        id: 'y3-clear-routes',
        context: 'In the safety exercise, the inspection card confirms every escape route has been checked and none is obstructed. Report the result.',
        phrase: 'All escape routes are clear.',
        meaning: 'Every checked escape route is free of obstructions.',
        explanation: '“All” is appropriate because every route was checked. “Clear” describes access along the routes.',
        sourceId: 'imo-smcp-safety',
        sourceSection: 'B2/1.3, item 1.1'
      },
      {
        id: 'y3-lifts',
        context: 'You are practising the passenger safety announcement for an emergency. Give the instruction prohibiting lift use.',
        phrase: 'Do not use lifts.',
        meaning: 'People must not travel in the lifts during this emergency.',
        explanation: '“Do not” gives a direct prohibition. “Lift” is the British English word for an elevator.',
        sourceId: 'imo-smcp-safety',
        sourceSection: 'B4/2.1, item 7 — lifts alternative'
      },
      {
        id: 'y3-injured',
        context: 'After a simulated accident, you are coordinating the classroom report. Ask the team to report people who are injured.',
        phrase: 'Report injured persons.',
        meaning: 'Give information about people who have been hurt.',
        explanation: 'The instruction asks for a report. It does not give medical treatment directions.',
        sourceId: 'imo-smcp-safety',
        sourceSection: 'B2/2.3, item 2 — injured persons alternative'
      }
    ]
  },
  {
    year: 4,
    title: 'Bridge Team Challenge',
    summary: 'Bring your language skills to the bridge simulator. Learn navigation vocabulary and distinguish wheel orders from engine orders.',
    vocabulary: [
      { term: 'Rudder', definition: 'A movable steering surface used to change a vessel’s direction.', hint: 'Wheel orders specify the angle of this surface.' },
      { term: 'Helmsman', definition: 'The person who steers the vessel under the bridge team’s orders.', hint: 'This person repeats and carries out wheel orders.' },
      { term: 'Lookout', definition: 'A person assigned to watch and listen for vessels, hazards and signals.', hint: 'This duty requires attention beyond the instruments.' },
      { term: 'Radar', definition: 'Equipment that uses radio waves to detect objects and measure their range and direction.', hint: 'Nearby objects may appear as echoes on its display.' },
      { term: 'Nautical chart', definition: 'A navigation map showing features such as water depths, coasts and hazards.', hint: 'The bridge team uses it when planning and monitoring a passage.' },
      { term: 'Knot', definition: 'A unit of speed equal to one nautical mile per hour.', hint: 'This measures speed, not distance alone.' },
      { term: 'Draft', definition: 'The vertical distance from the waterline to the bottom of the vessel’s keel.', hint: 'It helps describe how much of the vessel is below water.' },
      { term: 'Under-keel clearance', definition: 'The vertical gap between the vessel’s lowest underwater part and the seabed.', hint: 'Think of the space beneath the ship, not the ship’s submerged depth.' }
    ],
    smcp: [
      {
        id: 'y4-port-rudder',
        context: 'The instructor’s simulator card requires the rudder to be held at ten degrees to port. Assemble the wheel order.',
        phrase: 'Port ten.',
        meaning: 'Hold ten degrees of port rudder.',
        explanation: 'Ten is the rudder angle, not a compass heading. In practice, the helmsman repeats a wheel order and the bridge team checks that it is carried out.',
        sourceId: 'imo-smcp-bridge',
        sourceSection: 'A2/1, order 3 — port alternative'
      },
      {
        id: 'y4-starboard-rudder',
        context: 'The next simulator card requires the rudder to be held at twenty degrees to starboard. Assemble the wheel order.',
        phrase: 'Starboard twenty.',
        meaning: 'Hold twenty degrees of starboard rudder.',
        explanation: 'Twenty specifies the rudder angle. A request to steer a compass heading uses different wording.',
        sourceId: 'imo-smcp-bridge',
        sourceSection: 'A2/1, order 5 — starboard alternative'
      },
      {
        id: 'y4-engine-ahead',
        context: 'On the simulated engine telegraph, the instructor selects DEAD SLOW in the forward direction. Assemble that engine order.',
        phrase: 'Dead slow ahead.',
        meaning: 'Use the dead-slow engine setting in the ahead direction.',
        explanation: 'This is an engine order. It names an engine setting, not a fixed speed in knots for every vessel.',
        sourceId: 'imo-smcp-bridge',
        sourceSection: 'A2/2, order 4 — ahead alternative'
      },
      {
        id: 'y4-engine-ready',
        context: 'Before simulated manoeuvring, the instructor asks you to give the order placing the engine team in readiness.',
        phrase: 'Stand by engine.',
        meaning: 'The engine team must be fully ready for manoeuvring orders.',
        explanation: 'This order prepares the team and bridge communication for manoeuvring. It does not itself select an ahead or astern setting.',
        sourceId: 'imo-smcp-bridge',
        sourceSection: 'A2/2, order 7'
      }
    ]
  }
];

export const SOURCES = [
  {
    id: 'imo-smcp-overview',
    title: 'IMO — Standard Marine Communication Phrases',
    url: 'https://www.imo.org/en/ourwork/safety/pages/standardmarinecommunicationphrases.aspx',
    note: 'Official introduction to SMCP and its role in maritime safety communication. The game’s four academic years are an original, condensed learning progression, not an approved programme or professional qualification.'
  },
  {
    id: 'imo-smcp-general',
    title: 'IMO Resolution A.918(22) — General communication',
    url: 'https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.918(22).pdf#page=15',
    note: 'Year 1: General 4.4, 6.1, 6.1.1 and 9.2. Brief functional utterances are paired with original game scenarios and feedback. Optional words and alternatives are resolved to a single answer.'
  },
  {
    id: 'imo-smcp-position',
    title: 'IMO Resolution A.918(22) — Positions and directions',
    url: 'https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.918(22).pdf#page=48',
    note: 'Year 2: A1/6.1.1 item 3; A2/1 heading check and order 13; A2/3.7.2 item 18. The sourceSection on each activity identifies the corresponding entry.'
  },
  {
    id: 'imo-smcp-safety',
    title: 'IMO Resolution A.918(22) — Safety on board',
    url: 'https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.918(22).pdf#page=73',
    note: 'Year 3: B2/6.2 item 1; B2/1.3 item 1.1; B4/2.1 item 7; B2/2.3 item 2. These activities practise language in supervised fictional drills; they are not complete emergency procedures.'
  },
  {
    id: 'imo-smcp-bridge',
    title: 'IMO Resolution A.918(22) — Wheel and engine orders',
    url: 'https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.918(22).pdf#page=60',
    note: 'Year 4: A2/1 orders 3 and 5; A2/2 orders 4 and 7. Wheel orders refer to rudder angles. Engine settings do not imply one universal speed. The full source describes repetition and confirmation procedures.'
  },
  {
    id: 'noaa-directions',
    title: 'NOAA — Port and starboard',
    url: 'https://oceanservice.noaa.gov/facts/port-starboard.html',
    note: 'Supports the fixed meanings of port, starboard, bow and stern. Vocabulary definitions and hints in the game are original teaching text.'
  },
  {
    id: 'noaa-navigation-units',
    title: 'NOAA — Nautical miles and knots',
    url: 'https://oceanservice.noaa.gov/facts/nautical-mile-knot.html',
    note: 'Supports the distinction between nautical miles as distance and knots as speed.'
  }
];
