// AMCOL main-campus plan: relative placement follows the user-supplied sketch.
// Coordinates and building heights are stylized gameplay dimensions, not a survey.
import { NPCS } from './npc-content.js';

export const CAMPUS = Object.freeze({
  id: 'amcol-main-v3',
  name: 'AMCOL Main Campus',
  bounds: { minX: -38, maxX: 38, minZ: -25, maxZ: 25 },
  spawn: { x: -33, z: 20 },
});

// The dormitory is a separate game area. Its arrangement is intentionally
// schematic because the user has not supplied the dormitory's real site plan.
export const DORM = Object.freeze({
  id: 'seapath-dorm-v1',
  name: 'Cadet Dormitory',
  bounds: { minX: -30, maxX: 30, minZ: -24, maxZ: 24 },
  spawn: { x: -24, z: 18 },
  hall: { x: -15, z: -13, w: 20, d: 14, h: 5.2 },
  pt: { x: -15, z: 3, w: 16, d: 12 },
  track: { x: 13, z: -1, rx: 12, rz: 17 },
  football: { x: 13, z: -1, w: 15, d: 21 },
});

export const DORM_STATIONS = Object.freeze([
  { id:'dorm-arrival', name:'Dormitory Arrival', x:-24, z:18, color:'#a6c3b5', short:'DORM', icon:'flag', subtitle:'Your separate home area' },
  { id:'dorm-pt', name:'PT Yard', x:-15, z:3, color:'#cdbb83', short:'PT', icon:'heart', subtitle:'Complete a paced exercise routine' },
  { id:'dorm-run', name:'Running Track', x:26, z:3, color:'#ce9b82', short:'RUN', icon:'compass', subtitle:'Run a lap through the checkpoints' },
  { id:'dorm-football', name:'Football Field', x:13, z:12, color:'#a8c799', short:'FOOTBALL', icon:'sun', subtitle:'Aim and score in the target challenge' },
  { id:'dorm-sleep', name:'Cadet Room', x:-15, z:-12, color:'#9fb7ce', short:'SLEEP', icon:'moon', subtitle:'Sleep after exercise to start a new game day' },
  { id:'dorm-return', name:'Return to AMCOL', x:-17, z:19, color:'#aac9c9', short:'CAMPUS', icon:'map', subtitle:'Travel back to the main campus' },
]);

// The Atlantic interior is a playable cutaway, not a claim about the college's
// real room dimensions or its allocation of rooms to any particular storey.
export const ATLANTIC = Object.freeze({
  id:'amcol-atlantic-interior-v1', name:'Atlantic Building · Interior',
  bounds:{minX:-26,maxX:26,minZ:-22,maxZ:22}, spawn:{x:0,z:18},
  hall:{x:0,z:0,w:8,d:40}, cutaway:true,
});

export const ATLANTIC_ROOMS = Object.freeze([
  {id:'captain',stationId:'atlantic-ceo',name:'CEO Office',x:-14,z:-13,w:20,d:14,doorSide:'east',doorZ:-13,doorWidth:4,color:'#DCE4D4',trim:'#638078'},
  {id:'bridge',stationId:'atlantic-bridge',name:'Bridge Simulator',x:-14,z:2,w:20,d:14,doorSide:'east',doorZ:2,doorWidth:4,color:'#D9E6E7',trim:'#367D90'},
  {id:'engine',stationId:'atlantic-engine',name:'Engine Simulator',x:14,z:-10,w:20,d:20,doorSide:'west',doorZ:-10,doorWidth:4,color:'#E6DDD0',trim:'#A36D44'},
  {id:'ecdis',stationId:'atlantic-ecdis',name:'ECDIS Room',x:-14,z:15,w:20,d:10,doorSide:'east',doorZ:15,doorWidth:4,color:'#DAE5DE',trim:'#417D72'},
  {id:'gmdss',stationId:'atlantic-gmdss',name:'GMDSS Room',x:14,z:11,w:20,d:18,doorSide:'west',doorZ:11,doorWidth:4,color:'#DDE1EA',trim:'#576F96'},
]);

export const ATLANTIC_STATIONS = Object.freeze([
  {id:'atlantic-lobby',name:'Atlantic Lobby',x:0,z:12.5,kind:'lobby',color:'#9AB9BF',short:'LOBBY',icon:'map',subtitle:'Walk the hall to offices and simulator rooms'},
  {id:'atlantic-ceo',name:'CEO Office',room:'captain',x:-7.2,z:-13,color:'#A8BE9B',short:'CEO OFFICE',icon:'anchor',subtitle:'Capt. Chalermvut · Captain and CEO'},
  {id:'atlantic-bridge',name:'Bridge Simulator',room:'bridge',x:-7.2,z:2,color:'#8EBCC8',short:'BRIDGE',icon:'ship',subtitle:'Capt. Jakk · Bridge and maritime training'},
  {id:'atlantic-engine',name:'Engine Simulator',room:'engine',x:7.2,z:-10,color:'#D7AD83',short:'ENGINE',icon:'settings',subtitle:'Chief Engineer Asawin and Engineer Gerald'},
  {id:'atlantic-ecdis',name:'ECDIS Room',room:'ecdis',x:-7.2,z:15,color:'#A2C4B4',short:'ECDIS',icon:'map',subtitle:'Tr. Duke · Electronic charts and passage planning'},
  {id:'atlantic-gmdss',name:'GMDSS Room',room:'gmdss',x:7.2,z:11,color:'#A5B8D3',short:'GMDSS',icon:'radio',subtitle:'Tr. Bank · Radio and maritime communication training'},
  {id:'atlantic-return',name:'Exit Atlantic to Campus',x:0,z:19.3,kind:'travel',color:'#B6C7AA',short:'CAMPUS',icon:'flag',subtitle:'Return to the Atlantic entrance on the main campus'},
].map(station=>Object.freeze({zone:'atlantic',location:'atlantic',...station})));

export const BUILDINGS = Object.freeze([
  { id:'imd', name:'IMD', x:-32, z:-12, w:10, d:7, h:5.6, type:'academic', color:'#e7ecde', trim:'#427849' },
  { id:'cruise', name:'CRUISE SHIP TRAINING CENTRE', x:-20, z:-13, w:12, d:4.8, h:4.8, type:'training', color:'#e4f0ee', trim:'#238bac' },
  { id:'pacific', name:'PACIFIC BUILDING', x:-9, z:-20.5, w:33, d:6, h:13.2, floors:4, sideDoors:[{side:'east',offset:0,id:'pacific'}], type:'academic', color:'#f4efe2', trim:'#276e89' },
  { id:'workshop', name:'WORKSHOP', x:23, z:-21, w:14, d:6, h:4.7, type:'workshop', color:'#e6e4d9', trim:'#596666' },
  { id:'dome', name:'DOME', x:-3, z:3, w:22, d:28, h:8.2, type:'dome', color:'#e6e6da', trim:'#7094a7', open:true },
  { id:'academic', name:'ACADEMIC OFFICE', x:14.5, z:-7, w:7, d:8, h:4.3, type:'office', color:'#f1ddc9', trim:'#ca7842' },
  { id:'garden', name:'PALM GARDEN', x:23, z:3, w:10, d:16, h:3.4, type:'garden', color:'#e6ecda', trim:'#648875', open:true },
  { id:'atlantic', name:'ATLANTIC BUILDING', x:34, z:1.5, w:7, d:29, h:13.2, floors:4, type:'simulators', color:'#eee9de', trim:'#214c71', facing:'west' },
  { id:'loma-lounge', name:'LOMA LOUNGE · FINAL EXAMS', x:17.8, z:20, w:7, d:6, h:3.7, sideDoors:[{side:'west',offset:0,id:'loma-lounge'},{side:'east',offset:-1.2,id:'loma-lounge-east'}], type:'lounge', color:'#e4ead8', trim:'#4a7f54', facing:'north' },
  { id:'cafe', name:'LOMA CAFÉ', x:28, z:20, w:7, d:6, h:3.7, sideDoors:[{side:'west',offset:1.2,id:'cafe-west'},{side:'east',offset:0,id:'cafe'}], type:'cafe', color:'#e1e7e6', trim:'#315c82', facing:'north' },
]);

// Original ten curriculum locations stay stable, so saved book progress and
// mission destinations survive the revised campus plan.
export const STATIONS = Object.freeze([
  { id:'entrance', name:'AMCOL Entrance', x:-33, z:20, color:'#acb8a3', short:'AMCOL', icon:'flag', subtitle:'Main gate and campus information' },
  { id:'imd', name:'IMD', x:-32, z:-6.7, color:'#abc0c7', short:'IMD', icon:'compass', subtitle:'International Maritime Department' },
  { id:'cruise', name:'Cruise Ship Training Centre', x:-20, z:-8.7, color:'#b4d2d2', short:'CRUISE', icon:'ship', subtitle:'Cruise training location' },
  { id:'pacific', name:'Pacific Building · East Entrance', x:9.25, z:-20.5, side:'east', color:'#9dc7d3', short:'PACIFIC', icon:'book', subtitle:'Right-side entrance · 4 storeys · Mathematics · Science · English' },
  { id:'workshop', name:'Workshop', x:23, z:-15, color:'#e78c56', short:'WORKSHOP', icon:'settings', subtitle:'One-piece workshop coverall required for entry and mini-games' },
  { id:'dome', name:'Dome', x:-3, z:19.5, color:'#b7c7d3', short:'DOME', icon:'flag', subtitle:'Stage, big screen, and cadet presentations' },
  { id:'academic', name:'Academic Office', x:14.5, z:-1.2, color:'#d7c591', short:'OFFICE', icon:'trophy', subtitle:'Missions, semester progress, and graduation' },
  { id:'garden', name:'Palm Garden', x:24, z:12.8, color:'#b8cda6', short:'GARDEN', icon:'sun', subtitle:'Open-air meals, friends, and relaxation' },
  { id:'cafe', name:'Loma Café · East Entrance', x:33.1, z:20, color:'#9eb7cf', short:'LOMA CAFÉ', icon:'heart', subtitle:'East-side entrance · Eat, chat, and recharge' },
  { id:'atlantic', name:'Atlantic Building · Entrance', x:29, z:1.5, color:'#91b7c2', short:'ATLANTIC', icon:'radio', subtitle:'Enter the walkable interior · CEO Office · Simulators · ECDIS · GMDSS' },
]);

export const SAFETY_STATIONS = Object.freeze([
  { id:'lifeboat', name:'Lifeboat Safety Training', x:-23.7, z:2, modelX:-29, modelZ:2,
    zone:'campus', location:'lifeboat', kind:'safety', color:'#f18a41', short:'LIFEBOAT', icon:'ship',
    subtitle:'Immersion suit required · Safety vocabulary, equipment, and muster mini-games' },
]);
export const REST_STATIONS = Object.freeze([
  { id:'loma-lounge', name:'Loma Lounge · West Entrance', x:12.7, z:20,
    zone:'campus', location:'loma-lounge', kind:'exam', color:'#91b78b', short:'FINAL EXAMS', icon:'trophy',
    subtitle:'West-side entrance · Semester final examinations' },
]);

// Changing takes place on the workshop forecourt, before the training entrance.
// Gear destinations do not add another book-activity location.
export const WORKSHOP_STATIONS = Object.freeze([
  { id:'workshop-changing', name:'Workshop Changing Locker', x:28, z:-14.5, modelX:28, modelZ:-16.5,
    zone:'campus', location:'workshop', kind:'changing', color:'#d8733f', short:'CHANGE', icon:'user',
    subtitle:'Change into your one-piece workshop coverall before training' },
]);

// Canonical Loma destinations use one side each; these two aliases provide the
// opposing side entrance without duplicating a prompt at the same coordinate.
export const LOMA_ENTRANCES = Object.freeze([
  { id:'loma-lounge-east', canonicalId:'loma-lounge', name:'Loma Lounge · East Entrance', x:22.5, z:18.8,
    zone:'campus', location:'loma-lounge', kind:'exam', side:'east', color:'#91b78b', short:'FINAL EXAMS', icon:'trophy',
    subtitle:'East-side entrance · Semester final examinations' },
  { id:'cafe-west', canonicalId:'cafe', name:'Loma Café · West Entrance', x:23.3, z:21.2,
    zone:'campus', location:'cafe', kind:'rest', side:'west', color:'#9eb7cf', short:'LOMA CAFÉ', icon:'heart',
    subtitle:'West-side entrance · Eat, chat, and recharge' },
]);

// Visible training boundaries supplement the academic entry checks. The staff
// forecourt and changing locker stay outside both restricted areas.
export const TRAINING_GATES = Object.freeze([
  {id:'workshop',outfit:'coverall',callback:'onWorkshopBlocked',bounds:{x1:21.2,x2:24.8,z1:-18.2,z2:-15.8},approach:{x:23,z:-15},door:{x:23,z:-15.8}},
  {id:'lifeboat',outfit:'immersion',callback:'onLifeboatBlocked',bounds:{x1:-33.2,x2:-24.8,z1:-5.1,z2:9.1},approach:{x:-23.7,z:2},door:{x:-24.8,z:2}},
]);

// The three Pacific teachers stand on the audience side, in front of the Dome
// stage. Their approach points keep the central stage steps and seating clear.
export const TEACHER_PLAZA = Object.freeze({
  name:'Meet your teachers · In front of the stage', x:-3, z:-2.9, w:19.2, d:4.6,
  staffIds:Object.freeze(['wayne','aphisit','anne']),
});

// Conversation points remain in front of every staff model, clear of walls,
// doors and the Dome canopy. The portraits are stylized game characters.
const STAFF_PLACEMENT = Object.freeze({
  chalermvut: { x:-14, z:-11.2, modelX:-14, modelZ:-15, facing:0 },
  kobchapan: { x:11.5, z:1.5, modelX:11.5, modelZ:.1, facing:0 },
  wayne: { x:-9.4, z:-1.9, modelX:-9.4, modelZ:-3.8, facing:0 },
  thanaphat: { x:16.9, z:8.5, modelX:16.9, modelZ:7.1, facing:0 },
  yak: { x:-10, z:-3.2, modelX:-10, modelZ:-4.6, facing:0 },
  aphisit: { x:-3, z:-1.9, modelX:-3, modelZ:-3.8, facing:0 },
  anne: { x:3.4, z:-1.9, modelX:3.4, modelZ:-3.8, facing:0 },
  jakk: { x:-12, z:3, modelX:-12, modelZ:1.25, facing:0 },
  dream: { x:28.9, z:12, modelX:29.35, modelZ:12, facing:-Math.PI/2 },
  asawin: { x:11, z:-5.3, modelX:11, modelZ:-7, facing:0 },
  gerald: { x:18, z:-5.3, modelX:18, modelZ:-7, facing:0 },
  amara: { x:17.5, z:-14.4, modelX:17.5, modelZ:-16.1, facing:0 },
  bank: { x:16, z:10.8, modelX:16, modelZ:8.8, facing:0 },
  duke: { x:-10.2, z:17.3, modelX:-10.2, modelZ:15.3, facing:0 },
});

function staffNumberColor(color) {
  const rgb = String(color).replace('#', '').match(/.{2}/g)?.map(part => parseInt(part, 16) / 255) || [0, 0, 0];
  const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .179 ? '#000000' : '#FFFFFF';
}

export const NPC_STATIONS = Object.freeze(NPCS.map((npc, index) => Object.freeze({
  id:`npc-${npc.id}`, npcId:npc.id, name:npc.name, subtitle:npc.role,
  zone:npc.zone, location:npc.location, room:npc.room, gender:npc.gender, color:npc.color, icon:'user',
  numberColor:staffNumberColor(npc.color),
  short:npc.name, staffNumber:index+1, appearance:npc.appearance,
  ...STAFF_PLACEMENT[npc.id],
})));

export const CAMPUS_STATIONS = Object.freeze([
  ...STATIONS, ...NPC_STATIONS.filter(station => station.zone === 'campus'), ...WORKSHOP_STATIONS, ...SAFETY_STATIONS, ...REST_STATIONS, ...LOMA_ENTRANCES,
]);
export const DORM_DESTINATIONS = Object.freeze([
  ...DORM_STATIONS, ...NPC_STATIONS.filter(station => station.zone === 'dorm'),
]);
export const ATLANTIC_DESTINATIONS = Object.freeze([
  ...ATLANTIC_STATIONS, ...NPC_STATIONS.filter(station=>station.zone==='atlantic'),
]);

// Old quest destinations now lead to the appropriate AMCOL building.
export const ACTIVITY_LOCATIONS = Object.freeze({
  mentor:'atlantic', library:'pacific', vocabulary:'pacific', smcp:'atlantic', graduation:'academic',
});

export const ROOM_GROUPS = Object.freeze({
  pacific: [
    { id:'mathematics', name:'Mathematics', icon:'compass', description:'Mathematics learning is assigned to the Pacific Building.', status:'Location mapped' },
    { id:'science', name:'Science', icon:'sparkles', description:'Science learning is assigned to the Pacific Building.', status:'Location mapped' },
    { id:'english', name:'English', icon:'book', description:'Study the current chapter and play maritime vocabulary activities.', status:'Playable' },
  ],
  atlantic: [
    { id:'bridge', name:'Bridge Simulator', icon:'ship', description:'Enter Atlantic and meet Capt. Jakk beside the bridge consoles.', status:'Walkable room' },
    { id:'engine', name:'Engine Simulator', icon:'settings', description:'Meet Chief Engineer Asawin and Engineer Gerald in the simulator room.', status:'Walkable room' },
    { id:'ecdis', name:'ECDIS Room', icon:'map', description:'Meet Tr. Duke in the chart training lab for electronic charts and passage planning.', status:'Walkable room' },
    { id:'gmdss', name:'GMDSS Room', icon:'radio', description:'Meet Tr. Bank in the communications lab for radio and maritime communication activities.', status:'Walkable room' },
    { id:'captain', name:'CEO Office', icon:'anchor', description:'Visit Capt. Chalermvut at his office desk inside Atlantic.', status:'Walkable office' },
  ],
});
