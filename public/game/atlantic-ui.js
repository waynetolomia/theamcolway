import { ACTIVITIES, getActivity } from './book-course.js';
import { NPCS, NPC_MISSIONS, getNPC } from './npc-content.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = selector => document.querySelector(selector);
const button = (id, text, style = 'secondary') => `<button type="button" id="${id}" class="button ${style}">${esc(text)}</button>`;

export const ATLANTIC_VISITS = Object.freeze([
  { id:'atlantic-ceo', room:'captain', name:'CEO Office', icon:'anchor', label:'LEADERSHIP', staff:'Capt. Chalermvut', description:'Visit the Captain and CEO in his office for leadership, teamwork, and your cadet responsibilities.' },
  { id:'atlantic-bridge', room:'bridge', name:'Bridge Simulator', icon:'ship', label:'DECK TRAINING', staff:'Capt. Jakk', description:'Meet Capt. Jakk at the bridge consoles. Practise directions, clear reports, and watch handovers.' },
  { id:'atlantic-engine', room:'engine', name:'Engine Simulator', icon:'settings', label:'ENGINE TRAINING', staff:'C/E Asawin · Engineer Gerald', description:'Visit your engineering instructors for simulator displays, measurements, observations, and accurate records.' },
  { id:'atlantic-ecdis', room:'ecdis', name:'ECDIS Room', icon:'map', label:'NAVIGATION', staff:'Tr. Duke', description:'Meet Tr. Duke in the chart lab. Read training charts, identify waypoints, compare route legs, and check the supplied scale.' },
  { id:'atlantic-gmdss', room:'gmdss', name:'GMDSS Room', icon:'radio', label:'COMMUNICATION', staff:'Tr. Bank', description:'Meet Tr. Bank at the radio training station. Build clear messages, ask for clarification, and read time-stamped classroom radio logs.' },
]);

export function createAtlanticUI(bridge) {
  const state = () => bridge.getState();
  const done = id => state()?.results?.[id]?.completed === true;
  const currentActivities = () => [...new Set([...(state()?.assignments || []), ...(state()?.backlog || [])])].filter(id => getActivity(id)?.location === 'atlantic');
  const roomMissions = room => NPC_MISSIONS.filter(mission => {
    const npc = getNPC(mission.npcId);
    return npc?.zone === 'atlantic' && npc.room === room;
  });
  function teacherGamesMarkup(room) {
    const s = state(), oriented = s?.orientation?.completed === true;
    return `<section class="atlantic-teacher-games" aria-label="Teacher mini-games"><h3 class="section-heading">Teacher mini-games</h3><p class="atlantic-games-copy">Complete your staff introductions, then play your available challenges. Passed games stay available for practice.</p><div class="atlantic-game-grid">${roomMissions(room).map(mission => {
      const passed = s?.npc?.results?.[mission.id]?.completed === true;
      const ready = s?.npc?.available?.includes(mission.id) === true;
      const playable = oriented && (passed || ready);
      const label = !oriented ? `Meet all ${NPCS.length} staff first` : passed ? 'Practise again' : ready ? 'Play mini-game' : Number(s?.semester || 1) < mission.unlockSemester ? `Opens in Year ${Math.ceil(mission.unlockSemester / 2)}` : mission.prerequisite && !s?.npc?.results?.[mission.prerequisite]?.completed ? 'Complete the first challenge' : 'Sleep to begin the semester';
      return `<article class="atlantic-game-card${passed ? ' passed' : ''}"><div class="atlantic-game-meta"><span>${esc(getNPC(mission.npcId)?.name || 'Your instructor')}</span><span>${passed ? '✓ Passed' : `Year ${Math.ceil(mission.unlockSemester / 2)}`}</span></div><h4>${esc(mission.title)}</h4><p>${esc(mission.instructions)}</p><small>${mission.questions.length} questions · ${mission.requiredForSeaTraining ? 'Required staff sign-off' : 'Optional staff challenge'}</small><button type="button" class="button ${playable ? 'primary' : 'secondary'}" data-atlantic-mission="${esc(mission.id)}" ${playable ? '' : 'disabled'}>${esc(label)}</button></article>`;
    }).join('')}</div></section>`;
  }
  function inside(target) {
    if (bridge.needInit()) return false;
    if (bridge.getZone() !== 'atlantic') { bridge.goLocation(target); return false; }
    return true;
  }
  function openLobby() {
    if (!inside('atlantic-lobby')) return;
    const today = currentActivities();
    bridge.show('Inside Atlantic Building', 'AMCOL · OFFICES & SIMULATORS', `<div class="atlantic-shell">${bridge.orientation.summaryMarkup()}<section class="atlantic-welcome"><div><small>WELCOME TO ATLANTIC</small><h3>Choose your next visit.</h3><p>Walk through the hall to an office or simulator. Your instructors are waiting inside their rooms.</p></div><span aria-hidden="true">${bridge.icon('compass')}</span></section><div class="atlantic-room-grid">${ATLANTIC_VISITS.map(room => `<button type="button" class="atlantic-room-card" data-atlantic-room="${room.id}"><span class="atlantic-room-icon">${bridge.icon(room.icon)}</span><span><small>${room.label}</small><strong>${room.name}</strong><em>${room.staff}</em><span>${room.description}</span><span class="atlantic-room-games-count">${roomMissions(room.room).length} teacher mini-games</span></span><span class="atlantic-card-arrow" aria-hidden="true">${bridge.icon('arrow-right')}</span></button>`).join('')}</div><h3 class="section-heading">Your assignments in Atlantic</h3><div class="assignment-list">${today.map(id => bridge.card(id, { travel:true })).join('') || '<p class="dialog-copy">Your released Atlantic assignments are complete. You can meet the instructors, explore the rooms, or practise completed activities.</p>'}</div><p class="academy-note">Visit Tr. Dream near Atlantic’s outside entrance for the Year 2 sea-training readiness review. All five rooms connect through this hall.</p><div class="dialog-actions">${button('atlantic-office','Academic Office')}${button('atlantic-staff','Staff & tasks')}${button('atlantic-return-campus','Exit to campus','primary')}</div></div>`, 'atlantic-lobby');
    bridge.orientation.bindSummary(document.querySelector('#dialog-body')); bridge.bindCards();
    for (const control of document.querySelectorAll('[data-atlantic-room]')) control.onclick = () => bridge.goLocation(control.dataset.atlanticRoom);
    $('#atlantic-office').onclick = bridge.openOffice;
    $('#atlantic-staff').onclick = bridge.openStaff;
    $('#atlantic-return-campus').onclick = () => bridge.goLocation('atlantic-return');
  }
  function openRoom(id) {
    const room = ATLANTIC_VISITS.find(item => item.id === id);
    if (!room || !inside(room.id)) return;
    const assigned = currentActivities().filter(activityId => getActivity(activityId).room === room.room);
    const pool = ACTIVITIES.filter(activity => activity.location === 'atlantic' && activity.room === room.room && done(activity.id));
    const practice = pool.length ? pool[((state()?.day || 1) - 1) % pool.length] : null;
    bridge.show(room.name, `ATLANTIC · ${room.label}`, `<div class="atlantic-shell">${bridge.orientation.summaryMarkup()}<section class="atlantic-room-intro" data-room="${room.room}"><span>${bridge.icon(room.icon)}</span><div><small>INSIDE ATLANTIC BUILDING</small><h3>${room.staff}</h3><p>${room.description}</p></div></section>${bridge.staff.locationMarkup('atlantic', room.room)}${teacherGamesMarkup(room.room)}<h3 class="section-heading">Assignments in this room</h3><div class="assignment-list">${assigned.map(activityId => bridge.card(activityId)).join('') || '<p class="dialog-copy">Your released book assignments here are complete. Play an available teacher mini-game above, practise a passed challenge, or explore another room.</p>'}</div>${practice ? `<h3 class="section-heading">Today’s practice</h3>${bridge.card(practice.id,{practice:true})}` : ''}<div class="dialog-actions">${button('atlantic-room-lobby','Walk to the lobby')}${button('atlantic-room-map','Room map')}${button('atlantic-room-office','Missions & progress')}${button('atlantic-room-exit','Exit Atlantic','primary')}</div></div>`, 'atlantic-room');
    bridge.orientation.bindSummary(document.querySelector('#dialog-body')); bridge.staff.bindLocations(); bridge.bindCards();
    for (const control of document.querySelectorAll('[data-atlantic-mission]')) control.onclick = () => bridge.staff.openMission(control.dataset.atlanticMission, state()?.npc?.results?.[control.dataset.atlanticMission]?.completed === true);
    $('#atlantic-room-lobby').onclick = () => bridge.goLocation('atlantic-lobby');
    $('#atlantic-room-map').onclick = bridge.openCampus || openLobby;
    $('#atlantic-room-office').onclick = bridge.openOffice;
    $('#atlantic-room-exit').onclick = () => bridge.goLocation('atlantic-return');
  }
  return { openLobby, openRoom, handles: id => id === 'atlantic' || id === 'atlantic-lobby' || ATLANTIC_VISITS.some(room => room.id === id) };
}
