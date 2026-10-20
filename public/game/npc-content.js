/**
 * Original THE AMCOL WAY staff activities, written for the AMCOL game.
 * These supplemental challenges are separate from the 381 book activities.
 * Characters use the names and roles supplied by the game owner.
 */
export const NPC_CONTENT_NOTE = 'Original THE AMCOL WAY supplemental activities. Staff dialogue and challenges are written for the game.';

const NPC_ROLE_INTROS = {
  chalermvut: 'I am Capt. Chalermvut, Captain and CEO of the College. Visit me inside the CEO Office in the Atlantic Building. I help cadets develop leadership, clear communication, and responsibility. My missions ask you to plan with your team, check instructions, and make honest decisions. Begin with your teachers, build your skills step by step, and bring those habits to every challenge.',
  kobchapan: 'I am Director Kobchapan, Director of Academics. The Academic Office is where you see your semester missions, unfinished work, and progress. Your first mission is to meet every staff member and learn how each of us can help, including the teachers inside the Atlantic Building. After those introductions, your learning games open on the same day. Complete every required book activity before asking to advance a semester. In Year 4, Semester 2, pass all fifty final mini-games at Loma Lounge before graduating.',
  wayne: 'I am Dr. Wayne, Head of Foreign Languages. Find me beside Tr. Aphisit and Tr. Anne directly in front of the Dome stage. I guide English sentence scrambles and clear-message practice. The Pacific Building holds vocabulary, reading, grammar, and listening activities from your course book. Take your time, read the feedback, and ask for clarification when a message is unclear.',
  thanaphat: 'I am Director Thanaphat, Director of Student Affairs. I help cadets with campus life, teamwork, punctuality, and caring for shared spaces. My missions let you practise helpful decisions. You can eat and relax in the Palm Garden, and use the Dome for presentations with your fellow cadets and teachers.',
  yak: 'I am Kru Yak, your Dormitory Master. The dormitory is separate from the main campus. Before sleeping, complete one fitness activity: PT, running, or football. Sleep starts a new game day and releases the next location activities. You have five day resets per real week, refreshing on Monday at 00:00 Thailand time. Meet everyone first, then I can help you settle into that routine.',
  aphisit: 'I am Tr. Aphisit, your Mathematics Teacher. I stand beside Dr. Wayne and Tr. Anne directly in front of the Dome stage. We start with addition, subtraction, multiplication, and missing numbers, then practise simple algebra. Read what the question asks and enter the number requested. You can retry a difficult problem after checking its explanation.',
  anne: 'I am Tr. Anne, your Science Teacher. Meet me beside Dr. Wayne and Tr. Aphisit directly in front of the Dome stage. My trivia games cover observations, temperature, gravity, materials, buoyancy, and density. Look for evidence and change one test variable at a time. In later challenges, you will use simple calculations to explain what you observe.',
  jakk: 'I am Capt. Jakk, Head of the Maritime Department. Visit me inside the Bridge Simulator in the four-storey Atlantic Building. The building also contains the Engine Simulator, ECDIS and GMDSS rooms, and the CEO Office. I guide your maritime learning, ship-direction practice, clear reporting, and watch handovers. Follow each supervised game’s instructions and check uncertain information before continuing. The separate Lifeboat safety games require the orange immersion suit.',
  dream: 'I am Tr. Dream, Deputy Director of the Maritime Department. At the end of Year 2, I check whether you are ready for sea training in this game. Finish the required book activities in the first four semesters and collect the sixteen required staff sign-offs. Then pass my six-question readiness review. My approval lets you advance to Year 3; you do not need to reset the day just to receive it.',
  asawin: 'I am Chief Engineer Asawin. Meet Engineer Gerald and me inside the Engine Simulator in the Atlantic Building. I guide engineering basics, careful observations, comparison of supplied values, and clear equipment records. My first challenge also checks that you know the Workshop outfit rule; you can complete my simulator challenges in your campus uniform. Tr. Amara now leads the Workshop. My optional challenges do not change Tr. Dream’s sixteen required sign-offs.',
  gerald: 'I am Engineer Gerald, your Engine Simulator Instructor. Find me with Chief Engineer Asawin inside the Engine Simulator in the Atlantic Building. I help you read supplied display values, identify labels and units, compare readings, and make clear time-stamped training logs. We work with fictional exercise data and follow the instructor’s task sheet. My two simulator challenges are optional practice and accept your campus uniform.',
  amara: 'I am Tr. Amara, your Workshop Teacher. Meet me outside the Workshop beside the changing area. I guide workshop readiness, tool labels, careful measurement, and accurate records using the values shown in each exercise. Change into the blue one-piece workshop suit before entering the Workshop or starting my mini-games. You can speak to me here in your campus uniform. The orange immersion suit is for the Lifeboat. My two workshop challenges are optional practice.',
  bank: 'I am Tr. Bank, your GMDSS Instructor. Visit me inside the GMDSS Room in the Atlantic Building. I help you understand radio vocabulary, build clear messages, ask for missing information, and read the times and details in classroom communication logs. Use the fictional message cards supplied with each exercise, and check a detail before recording it if it is unclear. My first message challenge opens in Year 1. Pass it to unlock the radio-log follow-up when Year 2 begins. Both missions are optional, accept your campus or maritime uniform, and add practice alongside Tr. Dream’s existing readiness requirements.',
  duke: 'I am Tr. Duke, your ECDIS Instructor. Find me inside the ECDIS Room in the Atlantic Building. I guide electronic-chart learning through fictional chart legends, waypoint sequences, route records, and scales supplied in the questions. Read the labels carefully, follow the stated route, and show each step of a distance calculation. My chart-reading challenge opens in Year 1. Pass it to unlock the route-check follow-up when Year 2 begins. Both missions are optional and accept your campus or maritime uniform.',
};

/** Suggested first-day walking route. Cadets may acknowledge staff in any order. */
export const ORIENTATION_ROUTE = Object.freeze(['kobchapan', 'aphisit', 'wayne', 'anne', 'amara', 'dream', 'chalermvut', 'jakk', 'duke', 'gerald', 'asawin', 'bank', 'thanaphat', 'yak']);

export const NPCS = [
  { id: 'chalermvut', name: 'Capt. Chalermvut', role: 'Captain and CEO of the College', gender: 'male', zone: 'atlantic', location: 'atlantic', room: 'captain', color: '#cba556', appearance: { skin: '#bd8b65', hairColor: '#252b33', hairStyle: 'crop', outfit: 'officer', accent: '#cba556', body: 'regular', accessory: 'cap' }, greeting: 'Welcome to my office, cadet. Show me that you can communicate clearly, act responsibly, and help your team.', missionIds: ['chalermvut-first-command', 'chalermvut-team-leader'] },
  { id: 'kobchapan', name: 'Director Kobchapan', role: 'Director of Academics', gender: 'female', zone: 'campus', location: 'academic', color: '#846ac1', appearance: { skin: '#d7ab85', hairColor: '#29252a', hairStyle: 'bun', outfit: 'blazer', accent: '#846ac1', body: 'regular', accessory: 'none' }, greeting: 'Your progress starts with a clear plan. Let us check your learning habits and semester record.', missionIds: ['kobchapan-study-plan', 'kobchapan-progress-check'] },
  { id: 'wayne', name: 'Dr. Wayne', role: 'Head of Foreign Languages', gender: 'male', zone: 'campus', location: 'pacific', color: '#378ec0', appearance: { skin: '#bd8b65', hairColor: '#282724', hairStyle: 'swept', outfit: 'polo', accent: '#378ec0', body: 'regular', accessory: 'glasses' }, greeting: 'A good seafarer makes the message easy to understand. Put your words in order and listen carefully.', missionIds: ['wayne-sentence-builder', 'wayne-clear-messages'] },
  { id: 'thanaphat', name: 'Director Thanaphat', role: 'Director of Student Affairs', gender: 'male', zone: 'campus', location: 'garden', color: '#49a58f', appearance: { skin: '#bd8b65', hairColor: '#20282b', hairStyle: 'crop', outfit: 'polo', accent: '#49a58f', body: 'regular', accessory: 'none' }, greeting: 'A cadet looks after the team as well as the timetable. Let us practise responsible campus decisions.', missionIds: ['thanaphat-cadet-life', 'thanaphat-team-care'] },
  { id: 'yak', name: 'Kru Yak', role: 'Dormitory Master', gender: 'male', zone: 'dorm', location: 'dorm-arrival', color: '#bd7f4c', appearance: { skin: '#b8845c', hairColor: '#282522', hairStyle: 'bald', outfit: 'polo', accent: '#bd7f4c', body: 'broad', accessory: 'none', bald: true }, greeting: 'Welcome to the dorm, cadet! Keep the room ready, finish PT, running, or football, and then get your rest.', missionIds: ['yak-dorm-routine', 'yak-weekly-discipline'] },
  { id: 'aphisit', name: 'Tr. Aphisit', role: 'Mathematics Teacher', gender: 'male', zone: 'campus', location: 'pacific', color: '#dc9a43', appearance: { skin: '#c99a73', hairColor: '#262b2f', hairStyle: 'crop', outfit: 'polo', accent: '#dc9a43', body: 'regular', accessory: 'glasses' }, greeting: 'Numbers become easier when you show each step. Start with additions, then solve for the missing value.', missionIds: ['aphisit-number-deck', 'aphisit-algebra-watch'] },
  { id: 'anne', name: 'Tr. Anne', role: 'Science Teacher', gender: 'female', zone: 'campus', location: 'pacific', color: '#65a05d', appearance: { skin: '#d5a57e', hairColor: '#302723', hairStyle: 'bob', outfit: 'labcoat', accent: '#65a05d', body: 'regular', accessory: 'none' }, greeting: 'Notice what changes, test one idea at a time, and use evidence. Ready for a science challenge?', missionIds: ['anne-science-discovery', 'anne-science-at-sea'] },
  { id: 'jakk', name: 'Capt. Jakk', role: 'Head of Maritime Department', gender: 'male', zone: 'atlantic', location: 'atlantic', room: 'bridge', color: '#467eae', appearance: { skin: '#bd8b65', hairColor: '#303234', hairStyle: 'crop', outfit: 'officer', accent: '#467eae', body: 'regular', accessory: 'cap' }, greeting: 'Welcome to the Bridge Simulator. Before you go to sea, build reliable habits ashore. Know your directions and report what you observe.', missionIds: ['jakk-first-watch', 'jakk-watch-readiness'] },
  { id: 'dream', name: 'Tr. Dream', role: 'Deputy Director Maritime Department', gender: 'female', zone: 'campus', location: 'atlantic', color: '#c97793', appearance: { skin: '#d0a17e', hairColor: '#29252c', hairStyle: 'bun', outfit: 'officer', accent: '#c97793', body: 'regular', accessory: 'none' }, greeting: 'I review cadets for sea training after Year 2. Bring your completed academic record and all staff sign-offs, then take the readiness challenge.', missionIds: ['dream-sea-training-review'] },
  { id: 'asawin', name: 'Chief Engineer Asawin', role: 'Chief Engineer', gender: 'male', zone: 'atlantic', location: 'atlantic', room: 'engine', color: '#cf713e', appearance: { skin: '#bc8962', hairColor: '#282829', hairStyle: 'crop', outfit: 'officer', accent: '#cf713e', body: 'broad', accessory: 'none' }, greeting: 'Welcome to the Engine Simulator. Read the supplied training information, compare values, and report what you actually observe.', missionIds: ['asawin-workshop-ready', 'asawin-engineering-record'] },
  { id: 'gerald', name: 'Engineer Gerald', role: 'Engine Simulator Instructor', gender: 'male', zone: 'atlantic', location: 'atlantic', room: 'engine', color: '#4a9fa8', appearance: { skin: '#b78866', hairColor: '#252d32', hairStyle: 'swept', outfit: 'officer', accent: '#4a9fa8', body: 'regular', accessory: 'glasses' }, greeting: 'Welcome to the Engine Simulator. Read the display label, copy the value and unit, and put the observation in a clear training log.', missionIds: ['gerald-display-reader', 'gerald-simulator-log'] },
  { id: 'amara', name: 'Tr. Amara', role: 'Workshop Teacher', gender: 'female', zone: 'campus', location: 'workshop', color: '#aa748f', appearance: { skin: '#cfa17e', hairColor: '#30282a', hairStyle: 'bun', outfit: 'coverall', accent: '#436c86', body: 'regular', accessory: 'none' }, greeting: 'Welcome to the Workshop. Equip your blue one-piece suit, check the task sheet, and record each measurement carefully.', missionIds: ['amara-workshop-ready', 'amara-measurement-record'] },
  { id: 'bank', name: 'Tr. Bank', role: 'GMDSS Instructor', gender: 'male', zone: 'atlantic', location: 'atlantic', room: 'gmdss', color: '#797bb6', appearance: { skin: '#c49772', hairColor: '#242a32', hairStyle: 'crop', outfit: 'officer', accent: '#797bb6', body: 'regular', accessory: 'none' }, greeting: 'Welcome to the GMDSS Room. Build a clear message, ask about missing words, and check the details before completing the training log.', missionIds: ['bank-radio-message', 'bank-radio-log'] },
  { id: 'duke', name: 'Tr. Duke', role: 'ECDIS Instructor', gender: 'male', zone: 'atlantic', location: 'atlantic', room: 'ecdis', color: '#438d79', appearance: { skin: '#b98d68', hairColor: '#302923', hairStyle: 'swept', outfit: 'officer', accent: '#438d79', body: 'regular', accessory: 'glasses' }, greeting: 'Welcome to the ECDIS Room. Read the chart legend, follow the supplied waypoint order, and compare your route record with the exercise card.', missionIds: ['duke-chart-reader', 'duke-route-check'] },
].map(npc => ({ ...npc, roleIntro: NPC_ROLE_INTROS[npc.id] }));

function order(id, prompt, answer, tokens, explanation, alternatives = []) {
  return { id, type: 'order', prompt, answers: [answer, ...alternatives], tokens, explanation };
}
function number(id, prompt, answer, explanation, alternatives = []) {
  return { id, type: 'number', prompt, answers: [String(answer), ...alternatives.map(String)], explanation };
}
function choice(id, prompt, answer, options, explanation) {
  return { id, type: 'choice', prompt, answers: [answer], options, explanation };
}
function mission(id, npcId, title, unlockSemester, type, instructions, questions, prerequisite, requiredForSeaTraining = true) {
  return { id, npcId, title, unlockSemester, type, instructions, questions,
    ...(prerequisite ? { prerequisite } : {}), requiredForSeaTraining,
    source: 'seapath-supplemental', sourceNote: NPC_CONTENT_NOTE };
}

export const NPC_MISSIONS = [
  mission('chalermvut-first-command', 'chalermvut', 'Your first command', 1, 'mixed', 'Build a clear introduction and choose responsible actions for a new cadet.', [
    order('ceo1-q1', 'Put the introduction in order.', 'I am a cadet at AMCOL', ['cadet', 'AMCOL', 'a', 'I', 'at', 'am'], 'Use subject + verb + description: I am a cadet at AMCOL.'),
    choice('ceo1-q2', 'Your team receives an instruction that you do not understand. What should you do?', 'Ask the teacher to explain the instruction', ['Guess and tell everyone to start', 'Ask the teacher to explain the instruction', 'Pretend you understood'], 'Ask for clarification before acting so the team has a shared understanding.'),
    number('ceo1-q3', 'A briefing has 12 deck cadets and 9 engine cadets. How many cadets attend? Enter a number.', 21, 'Add the two groups: 12 + 9 = 21.'),
    choice('ceo1-q4', 'You notice a mistake in the team record. What is the responsible response?', 'Tell the team and correct the record honestly', ['Hide the record', 'Blame a cadet who was absent', 'Tell the team and correct the record honestly'], 'An accurate record helps the team learn and make sound decisions.'),
  ]),
  mission('chalermvut-team-leader', 'chalermvut', 'Lead a reliable team', 3, 'mixed', 'Demonstrate clear communication and basic planning as a Year 2 team leader.', [
    order('ceo2-q1', 'Put the leadership message in order.', 'We will complete the task together', ['task', 'We', 'together', 'the', 'complete', 'will'], 'Use subject + will + base verb: We will complete the task together.'),
    number('ceo2-q2', 'Twenty-four cadets form teams of four. How many teams are there? Enter a number.', 6, '24 ÷ 4 = 6 teams.'),
    choice('ceo2-q3', 'Two cadets understand a task differently. What should the leader do first?', 'Check the instruction with the teacher', ['Choose the fastest guess', 'Check the instruction with the teacher', 'Tell both cadets to work without discussing it'], 'Resolve the uncertainty before assigning work.'),
    choice('ceo2-q4', 'Your group finishes early. What is the best next step?', 'Review the work against the task requirements', ['Submit without checking', 'Change another group’s answers', 'Review the work against the task requirements'], 'Checking the requirements can reveal omissions before submission.'),
  ], 'chalermvut-first-command'),

  mission('kobchapan-study-plan', 'kobchapan', 'Make a study plan', 1, 'mixed', 'Learn where to find missions and how to plan your study time.', [
    choice('acad1-q1', 'Where can you see the game’s semester missions and progress?', 'Academic Office', ['Football field', 'Academic Office', 'Dormitory bed'], 'The Academic Office holds the semester mission and progress record.'),
    order('acad1-q2', 'Arrange these study steps from first to last.', 'Read the task Study the example Complete the activity Check your work', ['Check your work', 'Study the example', 'Read the task', 'Complete the activity'], 'Read the task, study the example, complete the activity, and then check it.'),
    number('acad1-q3', 'You study English for 20 minutes and mathematics for 15 minutes. How many minutes is that in total?', 35, '20 + 15 = 35 minutes.'),
    choice('acad1-q4', 'You do not finish today’s assigned game. Where can you find it later?', 'The unfinished mission backlog', ['It disappears forever', 'The unfinished mission backlog', 'Only a new character can find it'], 'Unfinished assigned activities remain available in the backlog.'),
  ]),
  mission('kobchapan-progress-check', 'kobchapan', 'Check your Year 2 record', 3, 'mixed', 'Use an academic record to decide what still needs attention.', [
    number('acad2-q1', 'A semester requires 35 mini-games. You have completed 28. How many remain?', 7, 'Subtract completed work from required work: 35 − 28 = 7.'),
    choice('acad2-q2', 'What academic result is required before a semester can be passed?', 'Complete every required mini-game for the semester', ['Complete only the easiest mini-game', 'Visit every building without submitting work', 'Complete every required mini-game for the semester'], 'The semester requirement is completion of all assigned required mini-games.'),
    order('acad2-q3', 'Arrange these progress-check steps.', 'Open the record Find unfinished work Complete the work Review progress', ['Complete the work', 'Review progress', 'Open the record', 'Find unfinished work'], 'Use the record to identify and complete unfinished work, then review the updated result.'),
    choice('acad2-q4', 'At the end of Year 2, whose game readiness review is needed before sea training?', 'Tr. Dream', ['The café visitor', 'Tr. Dream', 'A random cadet'], 'Tr. Dream reviews the academic record and staff sign-offs at the end of Year 2.'),
  ], 'kobchapan-study-plan'),

  mission('wayne-sentence-builder', 'wayne', 'Sentence scramble: first day', 1, 'order', 'Tap the word tiles in the correct order to form complete sentences.', [
    order('eng1-q1', 'Introduce your status.', 'I am a new cadet', ['new', 'am', 'cadet', 'I', 'a'], 'Use I am, followed by a noun phrase: a new cadet.'),
    order('eng1-q2', 'Describe a daily habit.', 'We study English every day', ['day', 'English', 'We', 'every', 'study'], 'A normal statement starts with the subject We, followed by study.'),
    order('eng1-q3', 'Ask a polite question.', 'Where is the classroom', ['classroom', 'is', 'Where', 'the'], 'Use question word + is + subject: Where is the classroom?'),
    order('eng1-q4', 'Make a polite request.', 'Please repeat the message slowly', ['slowly', 'the', 'Please', 'message', 'repeat'], 'Please makes the request polite; slowly describes how to repeat the message.'),
  ]),
  mission('wayne-clear-messages', 'wayne', 'Sentence scramble: clear messages', 3, 'mixed', 'Build unambiguous messages and choose a useful response when communication is unclear.', [
    order('eng2-q1', 'Report a completed check.', 'We have checked the equipment', ['equipment', 'have', 'We', 'the', 'checked'], 'Use have + past participle for this completed check: have checked.'),
    order('eng2-q2', 'Ask for a repeated message.', 'Could you repeat the last message', ['message', 'repeat', 'you', 'last', 'Could', 'the'], 'Could you + base verb forms a polite request.'),
    order('eng2-q3', 'Describe a current activity.', 'The cadets are checking the chart', ['chart', 'are', 'The', 'the', 'checking', 'cadets'], 'The plural subject cadets uses are checking.'),
    choice('eng2-q4', 'A message is broken by noise. What is the clearest response?', 'Ask the speaker to repeat the missing part', ['Invent the missing words', 'Ask the speaker to repeat the missing part', 'Say yes without understanding'], 'Ask for the missing information instead of guessing.'),
  ], 'wayne-sentence-builder'),

  mission('thanaphat-cadet-life', 'thanaphat', 'A good campus day', 1, 'mixed', 'Practise punctuality, shared-space care, and simple teamwork.', [
    choice('life1-q1', 'A class begins at 09:00. Which arrival time is five minutes early?', '08:55', ['09:05', '09:00', '08:55'], 'Five minutes before 09:00 is 08:55.'),
    choice('life1-q2', 'You finish lunch in the Palm Garden. What should you do with your rubbish?', 'Put it in the appropriate bin', ['Leave it on a bench', 'Put it in the appropriate bin', 'Hide it behind a tree'], 'Keep the open garden clean for the next students.'),
    number('life1-q3', 'A team has 6 cadets. Each collects 2 practice cones. How many cones are collected?', 12, '6 × 2 = 12 cones.'),
    choice('life1-q4', 'A new cadet cannot find the Academic Office. What is a helpful response?', 'Offer clear directions or walk with the cadet', ['Laugh and walk away', 'Give a random direction', 'Offer clear directions or walk with the cadet'], 'Clear directions and practical help make the campus easier to navigate.'),
  ]),
  mission('thanaphat-team-care', 'thanaphat', 'Look after your team', 3, 'mixed', 'Make responsible choices during a team activity.', [
    order('life2-q1', 'Build a message that supports a teammate.', 'Let us check the instructions together', ['together', 'the', 'Let', 'instructions', 'us', 'check'], 'Let us invites the other person to work together.'),
    choice('life2-q2', 'A team meeting starts at 14:10 and lasts 25 minutes. When does it finish?', '14:35', ['14:25', '14:45', '14:35'], 'Add 25 minutes to 14:10: the meeting finishes at 14:35.'),
    choice('life2-q3', 'A teammate feels unwell during practice. What should you do?', 'Stop the activity and notify the supervising teacher', ['Tell the teammate to hide it', 'Stop the activity and notify the supervising teacher', 'Continue without telling anyone'], 'The supervising teacher needs to know so the activity can be managed appropriately.'),
    choice('life2-q4', 'A group disagreement is delaying work. What should the group do?', 'Listen calmly and agree on the task requirements', ['Shout until someone gives up', 'Ignore the task and blame others', 'Listen calmly and agree on the task requirements'], 'Listening and returning to the shared requirements helps the team resolve the disagreement.'),
  ], 'thanaphat-cadet-life'),

  mission('yak-dorm-routine', 'yak', 'Learn the dorm routine', 1, 'mixed', 'Show Kru Yak that you understand the game’s exercise and sleep routine.', [
    choice('dorm1-q1', 'What must you complete before sleeping to start a new game day?', 'One activity: PT, running, or football', ['Every campus mini-game and all three sports', 'One activity: PT, running, or football', 'Only open the dormitory map'], 'Complete one of the three dormitory exercise games before sleeping.'),
    order('dorm1-q2', 'Arrange the game’s day-reset routine.', 'Return to the dorm Complete one exercise Go to bed Start the next day', ['Go to bed', 'Return to the dorm', 'Start the next day', 'Complete one exercise'], 'Return to the dorm, finish one exercise, and sleep to start the next day when a reset is available.'),
    number('dorm1-q3', 'Kru Yak’s PT game has 8 repetitions. You have completed 5. How many remain?', 3, '8 − 5 = 3 repetitions remain.'),
    choice('dorm1-q4', 'Where should you leave a bag so people can move through the dorm safely?', 'In its storage place away from the walkway', ['Across the doorway', 'In the middle of the stairs', 'In its storage place away from the walkway'], 'Store belongings where they do not block the walking route.'),
  ]),
  mission('yak-weekly-discipline', 'yak', 'Plan your weekly resets', 3, 'mixed', 'Manage your weekly sleep allowance while keeping study and practice available.', [
    number('dorm2-q1', 'The game allows five day resets this week. You have used three. How many remain?', 2, '5 − 3 = 2 day resets remain.'),
    choice('dorm2-q2', 'When does the game’s weekly reset allowance refresh?', 'Monday at 00:00 Thailand time', ['Every time you refresh the page', 'Every time you change your uniform', 'Monday at 00:00 Thailand time'], 'The weekly allowance refreshes on Monday at midnight in Asia/Bangkok.'),
    choice('dorm2-q3', 'You have used all five resets. What can you still do?', 'Finish current assignments and practise', ['Use a new character to gain five extra resets', 'Finish current assignments and practise', 'Change your device clock to advance the game'], 'Current assignments, backlog work, reading, and practice remain available while you wait.'),
    choice('dorm2-q4', 'The real week has just refreshed. What starts your next game day?', 'Complete one exercise and sleep at the dorm', ['The new week automatically moves the cadet to a new day', 'Complete one exercise and sleep at the dorm', 'Close the Academic Office'], 'The weekly refresh restores the allowance; exercise and sleep still advance the game day.'),
  ], 'yak-dorm-routine'),

  mission('aphisit-number-deck', 'aphisit', 'Number deck: additions and missing values', 1, 'number', 'Solve each short calculation. Enter only the number requested.', [
    number('math1-q1', 'A locker contains 18 notebooks. A teacher adds 7. How many notebooks are now in the locker?', 25, '18 + 7 = 25.'),
    number('math1-q2', 'There are 30 practice cards. Cadets use 12. How many cards remain?', 18, '30 − 12 = 18.'),
    number('math1-q3', 'Solve x + 6 = 14. What is x?', 8, 'Subtract 6 from both sides: x = 14 − 6 = 8.'),
    number('math1-q4', 'Four groups receive 5 rulers each. How many rulers are needed?', 20, '4 × 5 = 20 rulers.'),
  ]),
  mission('aphisit-algebra-watch', 'aphisit', 'Algebra watch', 3, 'number', 'Find the unknown value and apply a simple distance calculation.', [
    number('math2-q1', 'Solve 3x + 4 = 19. What is x?', 5, 'Subtract 4 to get 3x = 15, then divide by 3: x = 5.'),
    number('math2-q2', 'Solve 2(x + 3) = 18. What is x?', 6, 'Divide by 2 to get x + 3 = 9, then subtract 3: x = 6.'),
    number('math2-q3', 'A training model moves at 4 metres per second for 6 seconds. Using distance = speed × time, how many metres does it travel?', 24, '4 × 6 = 24 metres.'),
    number('math2-q4', 'The mean of three readings is (12 + 15 + 18) ÷ 3. What is the mean?', 15, 'The total is 45. Divide by 3 to get a mean of 15.'),
  ], 'aphisit-number-deck'),

  mission('anne-science-discovery', 'anne', 'Science discovery', 1, 'choice', 'Choose the best answer for each basic science question.', [
    choice('sci1-q1', 'What is the change from liquid water to water vapour called?', 'Evaporation', ['Freezing', 'Evaporation', 'Melting'], 'Evaporation is the change from a liquid into a gas at its surface.'),
    choice('sci1-q2', 'Which instrument is used to measure temperature?', 'Thermometer', ['Ruler', 'Stopwatch', 'Thermometer'], 'A thermometer measures temperature.'),
    choice('sci1-q3', 'Which force pulls a dropped object toward the Earth?', 'Gravity', ['Gravity', 'Magnetism in every object', 'Light'], 'The Earth’s gravitational force pulls objects toward it.'),
    choice('sci1-q4', 'Which material is normally a good electrical conductor?', 'Copper', ['Dry rubber', 'Copper', 'Dry plastic'], 'Copper conducts electricity well; it is commonly used in electrical wires.'),
  ]),
  mission('anne-science-at-sea', 'anne', 'Science around a vessel', 3, 'mixed', 'Connect forces, observations, and units to simple maritime examples.', [
    choice('sci2-q1', 'What is the upward force exerted by water on a floating object called?', 'Buoyancy', ['Friction', 'Buoyancy', 'Sound'], 'Buoyancy is the upward force a fluid exerts on an immersed object.'),
    choice('sci2-q2', 'Two blocks have the same volume. One has greater mass. Which has greater density?', 'The block with greater mass', ['They must have the same density', 'The block with less mass', 'The block with greater mass'], 'Density = mass ÷ volume. At the same volume, greater mass means greater density.'),
    choice('sci2-q3', 'In an experiment testing how surface type affects friction, what should you change?', 'Only the surface type while keeping other relevant conditions the same', ['The surface, block mass, and pulling method all at once', 'Only the surface type while keeping other relevant conditions the same', 'Nothing at all'], 'Changing one test variable at a time helps identify its effect.'),
    number('sci2-q4', 'A block has a mass of 200 grams and a volume of 100 cubic centimetres. Using density = mass ÷ volume, enter its density in grams per cubic centimetre as a number.', 2, '200 ÷ 100 = 2 grams per cubic centimetre.'),
  ], 'anne-science-discovery'),

  mission('jakk-first-watch', 'jakk', 'Your first watch briefing', 1, 'mixed', 'Practise ship directions and clear reporting before entering the simulator.', [
    choice('sea1-q1', 'When you face the bow of a ship, which side is port?', 'Left', ['Right', 'Left', 'The stern'], 'Port is the left side when facing forward toward the bow.'),
    choice('sea1-q2', 'Which word names the front end of a ship?', 'Bow', ['Stern', 'Beam', 'Bow'], 'The front end is the bow; the rear end is the stern.'),
    order('sea1-q3', 'Build a clear request for the location.', 'Please report your position', ['position', 'Please', 'your', 'report'], 'This message directly asks the other person to report a position.'),
    choice('sea1-q4', 'An equipment indicator behaves unexpectedly during a supervised simulator exercise. What should a cadet do?', 'Report the observation to the instructor', ['Hide the observation', 'Report the observation to the instructor', 'Change unknown settings without permission'], 'Report what you observe so the instructor can guide the exercise.'),
  ]),
  mission('jakk-watch-readiness', 'jakk', 'Prepare for the next watch', 3, 'mixed', 'Use a clear handover sequence and check basic voyage information.', [
    order('sea2-q1', 'Arrange this supervised training handover.', 'Read the instructions Check the information Ask about uncertainties Confirm understanding', ['Ask about uncertainties', 'Read the instructions', 'Confirm understanding', 'Check the information'], 'Read, check, clarify uncertainties, and confirm understanding before the exercise continues.'),
    number('sea2-q2', 'For this exercise, speed is 10 nautical miles per hour and time is 2 hours. How many nautical miles are travelled?', 20, 'Distance = speed × time = 10 × 2 = 20 nautical miles.'),
    choice('sea2-q3', 'Which report includes a clear time and observation?', 'At 10:15, the simulator display went blank', ['Something happened sometime', 'It is probably fine', 'At 10:15, the simulator display went blank'], 'The report states both when the event occurred and what was observed.'),
    choice('sea2-q4', 'You are unsure whether you copied a position correctly. What should you do?', 'Read it back and ask for confirmation', ['Use a similar position from yesterday', 'Read it back and ask for confirmation', 'Remove the position from the report'], 'Read-back and confirmation help catch copying or hearing errors.'),
  ], 'jakk-first-watch'),

  // Historical IDs and question IDs stay stable so existing Asawin sign-offs and
  // selected Loma final games remain attached to the same instructor and work.
  mission('asawin-workshop-ready', 'asawin', 'Engine Simulator: readiness and observations', 1, 'mixed', 'Review the separate Workshop outfit rule, then practise simple engineering observations in the Engine Simulator. Your campus uniform is accepted here.', [
    choice('eng-room1-q1', 'Which outfit must your character equip before entering this game’s Workshop?', 'One-piece workshop suit', ['Campus uniform', 'One-piece workshop suit', 'Immersion suit'], 'The game’s Workshop gate opens when the one-piece workshop suit is saved as your equipped outfit. The immersion suit is for the Lifeboat.'),
    choice('eng-room1-q2', 'During a supervised training exercise, a display changes unexpectedly. What should you do?', 'Tell Chief Engineer Asawin what you observed', ['Change unknown controls at random', 'Hide the display', 'Tell Chief Engineer Asawin what you observed'], 'Report the observed change so the instructor can guide the training activity.'),
    number('eng-room1-q3', 'The practice board shows 6 gauges on the left and 4 on the right. How many gauges are shown?', 10, '6 + 4 = 10 gauges.'),
    order('eng-room1-q4', 'Arrange a clear observation report.', 'At 09:20 the display went blank', ['blank', 'At', 'went', '09:20', 'display', 'the'], 'Include a time and an observation: At 09:20 the display went blank.'),
  ], undefined, false),
  mission('asawin-engineering-record', 'asawin', 'Engineering record: compare and report', 3, 'mixed', 'Read the supplied training information, compare values, and record observations accurately.', [
    number('eng-room2-q1', 'A training table shows a temperature of 24 degrees at the first check and 29 degrees at the second. By how many degrees did it increase?', 5, '29 − 24 = 5 degrees. This question asks only for the change shown in the training table.'),
    choice('eng-room2-q2', 'Which entry records an observation without inventing a cause?', 'At 10:05, the indicator changed from green to amber', ['The equipment is certainly broken because I guessed', 'At 10:05, the indicator changed from green to amber', 'Everything is fine, so no record is needed'], 'A useful entry states the time and what was observed, without presenting a guess as a fact.'),
    order('eng-room2-q3', 'Arrange these classroom record-check steps.', 'Read the instruction Compare the values Record the observation Ask for guidance', ['Record the observation', 'Ask for guidance', 'Read the instruction', 'Compare the values'], 'Read the task, compare the supplied values, record the observation, and ask the instructor for guidance.'),
    choice('eng-room2-q4', 'You cannot read one value on the exercise sheet. What is the best response?', 'Ask the instructor to clarify the value', ['Copy a random value from another task', 'Ask the instructor to clarify the value', 'Remove the value without explaining why'], 'Clarification keeps the record accurate when the supplied information is unclear.'),
  ], 'asawin-workshop-ready', false),

  mission('gerald-display-reader', 'gerald', 'Simulator display: read and compare', 1, 'mixed', 'Read the fictional training display carefully. Use only the labels and values supplied in the question; your campus uniform is accepted in the Engine Simulator.', [
    choice('gerald1-q1', 'A training display reads “Tank B — 62 litres”. Which entry copies both the value and its unit correctly?', 'Tank B: 62 litres', ['Tank B: 62 minutes', 'Tank B: 26 litres', 'Tank B: 62 litres'], 'Copy the label, value, and unit exactly as shown: Tank B, 62 litres.'),
    number('gerald1-q2', 'Display A shows 38 points and Display B shows 45 points. How many points higher is B than A?', 7, 'Subtract the displayed values: 45 − 38 = 7 points.'),
    order('gerald1-q3', 'Put the simulator observation in order.', 'At 10:10 the training display changed', ['display', 'At', 'changed', 'training', '10:10', 'the'], 'Place the time before the observation: At 10:10 the training display changed.'),
    choice('gerald1-q4', 'One digit on your exercise display is unclear. What should you do before copying it?', 'Ask Engineer Gerald to clarify the displayed value', ['Guess the digit', 'Copy yesterday’s number', 'Ask Engineer Gerald to clarify the displayed value'], 'Ask the instructor to clarify the supplied value so the exercise record remains accurate.'),
  ], undefined, false),
  mission('gerald-simulator-log', 'gerald', 'Simulator log: time, value and unit', 3, 'mixed', 'Build accurate classroom log entries from the fictional simulator readings. Compare the records with the supplied task sheet.', [
    choice('gerald2-q1', 'The task sheet says “11:20 — training tank level 48 litres”. Which log entry matches it?', '11:20 — training tank level 48 litres', ['11:20 — training tank level 84 litres', '11:20 — training tank level 48 litres', '11:02 — training tank level 48 litres'], 'Check the time, label, value, and unit against the task sheet.'),
    number('gerald2-q2', 'The supplied log has readings of 30, 33, and 36 units. Using mean = total ÷ 3, what is the mean reading?', 33, 'Add 30 + 33 + 36 = 99, then divide 99 by 3 to get 33.'),
    order('gerald2-q3', 'Arrange these classroom log-check steps.', 'Read the task Copy the reading Add the time Check the entry', ['Add the time', 'Check the entry', 'Read the task', 'Copy the reading'], 'Read the task, copy its reading, add the observation time, and check the complete entry.'),
    choice('gerald2-q4', 'Which entry states an observation without claiming an unconfirmed cause?', 'At 11:35, the training display showed 41 units', ['The display is broken because I guessed', 'At 11:35, the training display showed 41 units', 'Something happened, but I did not check the display'], 'Record the supplied time and value. Keep guesses separate from observed information.'),
  ], 'gerald-display-reader', false),

  mission('amara-workshop-ready', 'amara', 'Workshop readiness: suit and task sheet', 1, 'mixed', 'Equip the blue one-piece workshop suit, then check the game’s entry rule, tool labels, and simple classroom instructions.', [
    choice('amara1-q1', 'Which outfit opens this game’s Workshop training area?', 'One-piece workshop suit', ['Campus uniform', 'Immersion suit', 'One-piece workshop suit'], 'Equip the blue one-piece workshop suit. The orange immersion suit is used at the Lifeboat.'),
    choice('amara1-q2', 'The exercise asks for the ruler labelled R2. Which label should you select?', 'R2', ['R1', 'R2', 'T2'], 'Match the supplied tool label exactly: R2.'),
    number('amara1-q3', 'The practice tray holds 8 labelled parts. Tr. Amara adds 5 more. How many parts are in the tray?', 13, 'Add the two groups: 8 + 5 = 13 parts.'),
    order('amara1-q4', 'Arrange these supervised classroom preparation steps.', 'Read the task Check the labels Ask about uncertainties Confirm the instructions', ['Confirm the instructions', 'Ask about uncertainties', 'Read the task', 'Check the labels'], 'Read and check the supplied information, ask about anything unclear, and confirm that you understand the task.'),
  ], undefined, false),
  mission('amara-measurement-record', 'amara', 'Workshop measurements: compare and record', 3, 'mixed', 'Wear the one-piece workshop suit and use the supplied measurement values to practise comparing lengths and recording units.', [
    number('amara2-q1', 'An exercise sheet shows lengths of 24 millimetres and 31 millimetres. What is the difference in millimetres?', 7, '31 − 24 = 7 millimetres. Use the values given on the exercise sheet.'),
    choice('amara2-q2', 'A sample card reads “Part C — 18 mm”. Which record copies its measurement correctly?', 'Part C: 18 mm', ['Part C: 81 mm', 'Part C: 18 cm', 'Part C: 18 mm'], 'Keep the label, value, and unit together: Part C, 18 mm.'),
    number('amara2-q3', 'Three practice pieces measure 12, 14, and 16 millimetres. Using mean = total ÷ 3, what is their mean length in millimetres?', 14, '12 + 14 + 16 = 42; 42 ÷ 3 = 14 millimetres.'),
    choice('amara2-q4', 'Your copied value does not match the task sheet. What should you do?', 'Compare it with the sheet and correct the entry', ['Erase the unit and keep the number', 'Compare it with the sheet and correct the entry', 'Leave it because no one will notice'], 'Check against the supplied evidence and correct the record accurately.'),
  ], 'amara-workshop-ready', false),

  mission('bank-radio-message', 'bank', 'Radio messages: words and clarification', 1, 'mixed', 'Read the fictional classroom message cards, build a clear request, and identify the details that need clarification.', [
    choice('bank1-q1', 'The lesson card defines TRANSMIT as “send a message” and RECEIVE as “get a message”. Which term means “get a message”?', 'RECEIVE', ['TRANSMIT', 'RECEIVE', 'RECORD'], 'The supplied card defines RECEIVE as getting a message. TRANSMIT means sending one.'),
    order('bank1-q2', 'Build a polite request to hear the last two words again.', 'Please repeat the last two words', ['words', 'last', 'Please', 'two', 'the', 'repeat'], 'Start with Please, then say what you need: repeat the last two words.'),
    choice('bank1-q3', 'The classroom log shows “09:40 — Coral Group — Message 6”. Which group is named in the Message 6 entry?', 'Coral Group', ['Harbour Group', 'Coral Group', 'Compass Group'], 'Read the group field in the supplied log entry: Coral Group.'),
    choice('bank1-q4', 'Headset noise hides the destination in a classroom message. What should you do before writing that destination in the log?', 'Ask for the missing destination to be repeated', ['Copy the destination from another message', 'Invent a destination that sounds similar', 'Ask for the missing destination to be repeated'], 'Request the missing information and confirm what you heard before recording it.'),
  ], undefined, false),
  mission('bank-radio-log', 'bank', 'Radio log: time, details and evidence', 3, 'mixed', 'Use the times and message details supplied in each fictional training log. Record confirmed information accurately.', [
    number('bank2-q1', 'The training log records the first message at 10:05 and the next at 10:13 on the same morning. How many minutes are between them?', 8, 'From 10:05 to 10:13 is 8 minutes.'),
    order('bank2-q2', 'Put the message-receipt statement in order.', 'The message was received at 10:13', ['10:13', 'received', 'The', 'at', 'message', 'was'], 'Use The message was received, followed by the supplied time: at 10:13.'),
    choice('bank2-q3', 'The exercise card reads “Training vessel Manta — Room B — 11:25”. Which log entry copies all three details correctly?', 'Manta — Room B — 11:25', ['Manta — Room D — 11:25', 'Manta — Room B — 11:25', 'Manta — Room B — 11:52'], 'Compare the vessel name, room label, and time separately. All three must match the card.'),
    choice('bank2-q4', 'The classroom sheet says: “Mark an entry CONFIRMED only after the instructor checks its details.” The instructor has not checked your entry yet. Which status fits the sheet?', 'Awaiting instructor check', ['CONFIRMED', 'Awaiting instructor check', 'Checked yesterday'], 'Follow the stated classroom rule. The entry is awaiting the instructor’s check, so it is not yet marked CONFIRMED.'),
  ], 'bank-radio-message', false),

  mission('duke-chart-reader', 'duke', 'Chart reader: labels, waypoints and scale', 1, 'mixed', 'Read the legend and route supplied for a fictional classroom chart. Use the stated scale for the distance question.', [
    choice('duke1-q1', 'A fictional chart legend says “WPT = waypoint” and “DK = dock”. Which label identifies waypoint 3?', 'WPT 3', ['DK 3', 'WPT 3', 'DK 1'], 'The supplied legend uses WPT for a waypoint, so waypoint 3 is labelled WPT 3.'),
    order('duke1-q2', 'The exercise route starts at Start, then visits WPT 1, then WPT 2, and finishes at Dock. Arrange those four labels in that order.', 'Start WPT 1 WPT 2 Dock', ['WPT 2', 'Dock', 'Start', 'WPT 1'], 'Follow the route given in the question: Start → WPT 1 → WPT 2 → Dock.'),
    number('duke1-q3', 'For this fictional chart, 1 centimetre represents 2 nautical miles. A marked line is 3 centimetres long. How many nautical miles does it represent?', 6, 'Multiply the measured length by the supplied scale: 3 × 2 = 6 nautical miles.'),
    choice('duke1-q4', 'You cannot read a symbol in the classroom chart legend. What should you do before identifying it in your answer?', 'Ask Tr. Duke to clarify the legend', ['Guess its meaning from its colour', 'Use an unrelated symbol from another chart', 'Ask Tr. Duke to clarify the legend'], 'Ask for the unclear legend information so your answer uses the supplied chart evidence.'),
  ], undefined, false),
  mission('duke-route-check', 'duke', 'Route check: sequences and distances', 3, 'mixed', 'Compare the fictional route labels and calculate distances using only the scales and leg lengths provided.', [
    choice('duke2-q1', 'The exercise route is “Start → WPT 2 → WPT 5 → Dock Seven”. Which waypoint comes immediately before Dock Seven?', 'WPT 5', ['WPT 2', 'WPT 5', 'Start'], 'Read the stated sequence. WPT 5 is the last waypoint before Dock Seven.'),
    number('duke2-q2', 'An exercise scale says 1 centimetre represents 2.5 nautical miles. A route leg measures 3 centimetres. What distance does it represent, in nautical miles?', 7.5, 'Use the given scale: 3 × 2.5 = 7.5 nautical miles.'),
    number('duke2-q3', 'The supplied route table lists three legs: 4.5, 2.5, and 3 nautical miles. What is the total route distance, in nautical miles?', 10, 'Add the three supplied legs: 4.5 + 2.5 + 3 = 10 nautical miles.'),
    order('duke2-q4', 'Build a statement saying that the route finishes at Dock Seven.', 'The route ends at Dock Seven', ['Seven', 'at', 'route', 'The', 'Dock', 'ends'], 'Use The route ends, then state its endpoint: at Dock Seven.'),
  ], 'duke-chart-reader', false),

  mission('dream-sea-training-review', 'dream', 'Year 2 sea-training readiness review', 4, 'mixed', 'Complete all six checks after finishing Years 1–2 and receiving the sixteen required staff sign-offs. Passing records Tr. Dream’s sea-training clearance in this game.', [
    order('review-q1', 'Build a clear readiness statement.', 'I am ready for supervised sea training', ['training', 'for', 'I', 'supervised', 'ready', 'am', 'sea'], 'The sentence identifies readiness for supervised sea training.'),
    number('review-q2', 'Solve 4x + 2 = 22. What is x?', 5, 'Subtract 2 to get 4x = 20, then divide by 4: x = 5.'),
    choice('review-q3', 'Which force acts upward on a floating vessel?', 'Buoyancy', ['Gravity', 'Buoyancy', 'Friction along the deck'], 'Water exerts an upward buoyant force on the vessel.'),
    choice('review-q4', 'You cannot hear part of an instruction during a training exercise. What should you do?', 'Ask for the unclear part to be repeated before acting', ['Guess the missing information', 'Ask for the unclear part to be repeated before acting', 'Tell the team it was understood'], 'Clear understanding is needed before carrying out an instruction.'),
    order('review-q5', 'Arrange the academic sea-training review steps in this game.', 'Complete Years 1 and 2 Collect staff sign-offs Pass the readiness review Receive clearance', ['Pass the readiness review', 'Complete Years 1 and 2', 'Receive clearance', 'Collect staff sign-offs'], 'The game checks academic completion and staff sign-offs before Tr. Dream’s review can grant clearance.'),
    choice('review-q6', 'You observe an unexpected result during supervised training. What should your report include?', 'The time, the observation, and a clear request for guidance', ['Only your guess about the cause', 'A different cadet’s name and no details', 'The time, the observation, and a clear request for guidance'], 'A useful report separates observed facts from guesses and helps the instructor respond.'),
  ]),
];

export const SEA_TRAINING_REVIEW_ID = 'dream-sea-training-review';
export const STAFF_SIGNOFF_IDS = NPC_MISSIONS.filter(item => item.npcId !== 'dream' && item.requiredForSeaTraining !== false).map(item => item.id);
export function getNPC(id) { return NPCS.find(item => item.id === id); }
export function getNPCPlace(npc) {
  const person = typeof npc === 'string' ? getNPC(npc) : npc;
  if (!person) return '';
  const rooms = { captain: 'CEO Office', bridge: 'Bridge Simulator', engine: 'Engine Simulator', ecdis: 'ECDIS Room', gmdss: 'GMDSS Room' };
  if (person.zone === 'atlantic') return `Atlantic Building · ${rooms[person.room] || 'Lobby'}`;
  const places = { academic: 'Academic Office', pacific: 'Dome · in front of the stage', workshop: 'Workshop forecourt', atlantic: 'Atlantic entrance', garden: 'Palm Garden', 'dorm-arrival': 'Cadet Dormitory' };
  return places[person.location] || person.location;
}
export function getNPCMission(id) { return NPC_MISSIONS.find(item => item.id === id); }
export function getNPCMissions(id) { return NPC_MISSIONS.filter(item => item.npcId === id); }
