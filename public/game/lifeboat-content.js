/** Original, supplemental AMCOL safety games. All rosters, counts and placards are fictional.
 * These reading and communication exercises do not model release gear or launching controls.
 * Primary references checked 19 October 2026; no official assessment or certification is implied.
 */
export const SAFETY_REFERENCES = [
  { id: 'imo-lsa', title: 'IMO · Life-saving appliances', url: 'https://www.imo.org/en/ourwork/safety/pages/lifesavingappliances-default.aspx', note: 'Background: personal life-saving appliances and survival craft.' },
  { id: 'mca-muster', title: 'MCA · MGN 71 Amendment 1, Annex', url: 'https://www.gov.uk/government/publications/mgn-71-mf-amendment-1-musters-drills-on-board-training-and-instructions-and-decision-support-systems/mgn-71-amendment-1-annex', note: 'Background: muster information, clear instructions, assigned duties and training records.' },
  { id: 'mca-drills', title: 'MCA · Code of Safe Working Practices, 2026', url: 'https://assets.publishing.service.gov.uk/media/69bd45a5ed813d0d8b690c2b/code-of-safe-working-practices-for-merchant-seafarers-2026-edition.pdf', note: 'Background: Chapter 4, organised drills and recording improvements.' },
];

const choice = (id, prompt, options, answer, explanation) => ({ id, type: 'choice', prompt, options, answers: [answer], explanation });
const number = (id, prompt, answer, explanation) => ({ id, type: 'number', prompt, answers: [String(answer)], explanation });
const order = (id, prompt, tokens, answer, explanation) => ({ id, type: 'order', prompt, tokens, answers: [answer], explanation });

export const SAFETY_GAMES = [
  {
    id: 'lifeboat-y1-vocabulary', year: 1, title: 'Know your safety words',
    summary: 'Match the words, recognise the equipment, and build a clear sentence.',
    instructions: 'Read the training placard. Answer four short questions using its words.',
    learning: [
      'A lifeboat and a liferaft are survival craft. A lifejacket and an immersion suit are personal life-saving appliances.',
      'On this game placard, “muster” means gather at your assigned meeting point. “Ready” means prepared.',
      'The practice message on the placard is: “We are ready for the briefing.”',
    ], references: ['imo-lsa', 'mca-muster'],
    questions: [
      choice('y1-vocab-1', 'Which item is a survival craft?', ['A notebook', 'A lifeboat', 'A chair'], 'A lifeboat', 'The placard groups a lifeboat and a liferaft as survival craft.'),
      choice('y1-vocab-2', 'Which pair contains personal life-saving appliances?', ['A lifejacket and an immersion suit', 'A lifeboat and a liferaft', 'A pen and a notebook'], 'A lifejacket and an immersion suit', 'These two items belong to the personal life-saving appliance group on the placard.'),
      choice('y1-vocab-3', 'What does “muster” mean on this placard?', ['Finish a written test', 'Gather at your assigned meeting point', 'Choose a different classroom'], 'Gather at your assigned meeting point', 'Use the meaning given on the training placard.'),
      order('y1-vocab-4', 'Build the practice message from the placard.', ['We', 'are', 'ready', 'for', 'the briefing.'], 'We are ready for the briefing.', 'The sentence names the group, gives its status, and explains what it is ready for.'),
    ],
  },
  {
    id: 'lifeboat-y1-muster', year: 1, title: 'Find your muster team',
    summary: 'Read a practice roster and report the correct meeting point.',
    instructions: 'Use this fictional campus drill card. All answers come from the card.',
    learning: [
      'CAMPUS PRACTICE CARD · Team Coral: muster point A beside the Lifeboat. Team Pearl: muster point B beside the Dome.',
      'You are in Team Coral. Its instructor is Capt. Jakk. The card lists 12 cadets; 10 have checked in.',
      'For this exercise, report your name and team to your instructor. Follow the meeting point printed on your own card.',
    ], references: ['mca-muster'],
    questions: [
      choice('y1-muster-1', 'Where should your cadet meet Team Coral?', ['Point B beside the Dome', 'The Academic Office', 'Point A beside the Lifeboat'], 'Point A beside the Lifeboat', 'The Coral row assigns point A beside the Lifeboat.'),
      choice('y1-muster-2', 'Who receives Team Coral’s check-in?', ['Capt. Jakk', 'Tr. Anne', 'Kru Yak'], 'Capt. Jakk', 'Capt. Jakk is the instructor named on this fictional card.'),
      number('y1-muster-3', '12 cadets are listed and 10 have checked in. How many have not checked in yet?', 2, '12 − 10 = 2. This is the card’s check-in count; it does not establish anyone’s location.'),
      order('y1-muster-4', 'Build this check-in: “I am Mali from Team Coral.”', ['I', 'am', 'Mali', 'from', 'Team Coral.'], 'I am Mali from Team Coral.', 'The message gives a name and a team without adding unsupported information.'),
    ],
  },
  {
    id: 'lifeboat-y2-equipment', year: 2, title: 'Read the equipment board',
    summary: 'Sort the display labels and spot a mismatch in the training inventory.',
    instructions: 'Inspect a fictional classroom display through its written labels. No equipment is operated.',
    learning: [
      'DISPLAY A · Personal appliances: lifejacket, immersion suit. DISPLAY B · Survival craft: lifeboat, liferaft.',
      'TRAINING INVENTORY · Expected label cards: 8. Label cards found: 7. Card D is unreadable.',
      'The instructor’s task is to record observations and report missing or unreadable cards before the next demonstration.',
    ], references: ['imo-lsa', 'mca-drills'],
    questions: [
      choice('y2-equipment-1', 'Which label belongs in Display B?', ['Immersion suit', 'Lifejacket', 'Liferaft'], 'Liferaft', 'The display board places the liferaft with the survival craft.'),
      choice('y2-equipment-2', 'A lifejacket card was placed in Display B. Which display should receive it?', ['Display A', 'Display B', 'Neither display'], 'Display A', 'Display A is labelled for personal life-saving appliances.'),
      number('y2-equipment-3', 'The inventory expects 8 label cards, but only 7 are found. How many cards are missing?', 1, '8 − 7 = 1. The count applies to training label cards only.'),
      choice('y2-equipment-4', 'Which note records the observation without guessing?', ['All cards are complete and readable.', 'Seven cards were found; card D is unreadable.', 'Card D was damaged during yesterday’s drill.'], 'Seven cards were found; card D is unreadable.', 'The board gives a count and an unreadable label. It gives no cause or time of damage.'),
    ],
  },
  {
    id: 'lifeboat-y2-reports', year: 2, title: 'Send a clear safety report',
    summary: 'Use place, observation, and request to make a useful practice report.',
    instructions: 'Read the instructor’s exercise card and build messages from the facts provided.',
    learning: [
      'PRACTICE SCENE · At the Lifeboat training board, label C cannot be read. The cause is unknown.',
      'The instructor asks for three pieces of information: place → observation → request. For this game, use that order.',
      'The reply says, “Meet at point B.” If part of a message is unclear, ask for it to be repeated before confirming it.',
    ], references: ['mca-muster'],
    questions: [
      choice('y2-reports-1', 'Which report uses only the facts on the card?', ['The Lifeboat engine is broken.', 'The entire training area is unsafe.', 'Label C at the Lifeboat board is unreadable.'], 'Label C at the Lifeboat board is unreadable.', 'Report the observed label and its location. The card says nothing about the engine or the rest of the area.'),
      order('y2-reports-2', 'Arrange the three parts in the order requested by the instructor.', ['At the Lifeboat board,', 'label C is unreadable.', 'Please check the label.'], 'At the Lifeboat board, label C is unreadable. Please check the label.', 'This exercise uses place, then observation, then request.'),
      choice('y2-reports-3', 'You did not hear the meeting point clearly. What should you say?', ['I will guess the meeting point.', 'Please repeat the meeting point.', 'I confirm point A.'], 'Please repeat the meeting point.', 'Ask for the missing information before confirming a message.'),
      choice('y2-reports-4', 'The instructor repeats, “Meet at point B.” Which reply confirms that information?', ['Understood, point A.', 'Understood, point B.', 'The label is now repaired.'], 'Understood, point B.', 'The reply repeats the meeting point that was actually given.'),
    ],
  },
  {
    id: 'lifeboat-y3-readiness', year: 3, title: 'Check the briefing record',
    summary: 'Find missing evidence before an instructor-led demonstration.',
    instructions: 'Read the classroom readiness sheet. Identify what has and has not been recorded.',
    learning: [
      'DEMONSTRATION SHEET · Briefing attendance: 6 of 6 cadets. Assigned roles: confirmed. Instructor approval: blank.',
      'This exercise begins only when the instructor confirms approval. A blank box means the information is not recorded.',
      'Record the missing approval and ask the instructor. A completed game sheet does not authorise any real equipment operation.',
    ], references: ['mca-drills'],
    questions: [
      choice('y3-readiness-1', 'Which entry is missing from the sheet?', ['Briefing attendance', 'Assigned roles', 'Instructor approval'], 'Instructor approval', 'The approval field is blank; the other two entries are present.'),
      number('y3-readiness-2', 'Six of six cadets attended the briefing. How many attendance entries are still missing?', 0, '6 − 6 = 0. Attendance is complete, but the separate approval entry is still blank.'),
      choice('y3-readiness-3', 'Which status accurately describes the blank approval box?', ['Approval is not recorded.', 'Approval has been refused.', 'Approval has been granted.'], 'Approval is not recorded.', 'A blank record alone proves neither approval nor refusal.'),
      choice('y3-readiness-4', 'According to this exercise sheet, what happens next?', ['A cadet fills in the instructor’s approval.', 'Ask the instructor to review the missing approval.', 'Start because attendance is complete.'], 'Ask the instructor to review the missing approval.', 'Follow this sheet’s condition: the instructor confirms approval before the exercise begins.'),
    ],
  },
  {
    id: 'lifeboat-y3-accountability', year: 3, title: 'Reconcile the muster count',
    summary: 'Compare a roster with a check-in list and write a factual update.',
    instructions: 'Use the fictional drill register. Keep “not checked in” separate from “location known”.',
    learning: [
      'PRACTICE ROSTER · C01, C02, C03, C04, C05, C06. CHECKED IN · C01, C02, C03, C05, C06.',
      'The instructor is Capt. Jakk. The register does not give C04’s current location.',
      'A later instructor update confirms C04 has checked in. Keep the original observation and record the update.',
    ], references: ['mca-muster', 'mca-drills'],
    questions: [
      number('y3-accountability-1', 'How many of the six roster IDs have not checked in at the first count?', 1, 'Five of the six listed IDs are checked in, leaving one unconfirmed check-in.'),
      choice('y3-accountability-2', 'Which ID is absent from the initial check-in list?', ['C03', 'C04', 'C06'], 'C04', 'C04 appears on the roster but not on the initial check-in list.'),
      choice('y3-accountability-3', 'Which first-count report is supported by the register?', ['C04 is at the dormitory.', 'C04 has left campus.', 'Five checked in; C04 has not checked in yet.'], 'Five checked in; C04 has not checked in yet.', 'The register supports a check-in status, not a guess about the cadet’s location.'),
      order('y3-accountability-4', 'Build the update after the instructor confirms C04’s arrival.', ['Update:', 'C04', 'has checked in;', 'all six', 'are accounted for.'], 'Update: C04 has checked in; all six are accounted for.', 'The later update resolves the missing check-in while keeping the first-count observation accurate.'),
    ],
  },
  {
    id: 'lifeboat-y4-leadership', year: 4, title: 'Lead the practice team',
    summary: 'Use assigned roles and calm instructions to organise a briefing.',
    instructions: 'Act as the student team leader for this instructor-led campus exercise.',
    learning: [
      'EXERCISE ROLE CARD · Arun reads the roster. Mali records observations. Dara reads back the instructor’s message.',
      'Arun is unavailable. The card names Pim as the substitute roster reader. Role changes go through the instructor.',
      'One cadet says a briefing instruction is unclear. The team pauses for clarification and confirms the instruction together.',
    ], references: ['mca-muster', 'mca-drills'],
    questions: [
      choice('y4-leadership-1', 'Who records observations on this role card?', ['Arun', 'Dara', 'Mali'], 'Mali', 'Mali is assigned to record observations.'),
      choice('y4-leadership-2', 'Whom should you propose to the instructor as Arun’s replacement?', ['Pim, the named substitute', 'Any cadet without checking the card', 'No one; skip the roster'], 'Pim, the named substitute', 'The exercise card identifies Pim as the substitute; confirm the change with the instructor.'),
      choice('y4-leadership-3', 'A cadet did not understand the briefing. Which response follows the card?', ['Continue and ask about it later.', 'Pause and ask the instructor to clarify.', 'Tell the cadet to copy someone else.'], 'Pause and ask the instructor to clarify.', 'The role card asks the team to resolve unclear instructions before continuing.'),
      order('y4-leadership-4', 'Build a calm request for clarification.', ['Please', 'repeat', 'the instruction', 'so everyone', 'can confirm it.'], 'Please repeat the instruction so everyone can confirm it.', 'The request is specific, calm, and gives everyone a chance to check understanding.'),
    ],
  },
  {
    id: 'lifeboat-y4-briefing', year: 4, title: 'Close the drill briefing',
    summary: 'Turn observations into a clear debrief with an owner and a follow-up.',
    instructions: 'Read the final exercise notes and choose an accurate training record.',
    learning: [
      'DEBRIEF NOTES · Eight cadets attended. Two asked for the meeting point to be repeated. All eight confirmed point A after clarification.',
      'AGREED IMPROVEMENT · Dara will make the practice meeting-point card clearer. Capt. Jakk will review it before the next briefing.',
      'Use this exercise’s record order: observation → improvement → owner and review. Record what happened, including the clarification.',
    ], references: ['mca-drills', 'mca-muster'],
    questions: [
      choice('y4-briefing-1', 'Which summary matches the debrief notes?', ['Two cadets missed the entire briefing.', 'All eight knew the meeting point without help.', 'All eight confirmed point A after clarification.'], 'All eight confirmed point A after clarification.', 'The notes say the information was clarified before all eight confirmed it.'),
      number('y4-briefing-2', 'How many cadets asked for the meeting point to be repeated?', 2, 'The debrief notes record two requests for repetition.'),
      choice('y4-briefing-3', 'Which follow-up assigns both the task and the review?', ['Someone should fix the card eventually.', 'Dara updates the card; Capt. Jakk reviews it before the next briefing.', 'No follow-up is needed because the drill finished.'], 'Dara updates the card; Capt. Jakk reviews it before the next briefing.', 'The agreed improvement has a named person and a review before the next briefing.'),
      order('y4-briefing-4', 'Put this game’s debrief record in its requested order.', ['Two cadets needed clarification.', 'Make the meeting-point card clearer.', 'Dara updates it; Capt. Jakk reviews it.'], 'Two cadets needed clarification. Make the meeting-point card clearer. Dara updates it; Capt. Jakk reviews it.', 'The record moves from observation to improvement, then names the owner and reviewer.'),
    ],
  },
];

export const getSafetyGame = id => SAFETY_GAMES.find(game => game.id === id) || null;
export const getSafetyReferences = game => SAFETY_REFERENCES.filter(reference => game?.references?.includes(reference.id));
