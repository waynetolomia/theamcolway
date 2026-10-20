import { NPCS, ORIENTATION_ROUTE, getNPC, getNPCPlace } from './npc-content.js';
import { npcPortrait } from './npc-ui.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createOrientationUI(bridge) {
  const state = () => bridge.getState();
  const info = () => state()?.orientation || { completed: false, completedCount: 0, total: NPCS.length, visitedIds: [], route: ORIENTATION_ROUTE };
  const button = (id, label, primary = false) => `<button type="button" class="button ${primary ? 'primary' : 'secondary'}" id="${id}">${esc(label)}</button>`;
  function summaryMarkup() {
    const o = info();
    if (o.completed) return '';
    return `<section class="orientation-office" aria-label="Your first mission"><span class="orientation-seal">01</span><div><small>FIRST MISSION · CAMPUS ORIENTATION</small><h3>Meet your AMCOL team</h3><p>Talk to all ${o.total} staff members and acknowledge their introductions before starting learning missions or sleeping.</p><strong>${o.completedCount} / ${o.total} introductions complete</strong></div><button type="button" class="button primary" data-open-orientation>Follow my first mission</button></section>`;
  }
  function bindSummary(scope = document) {
    scope.querySelectorAll('[data-open-orientation]').forEach(el => el.onclick = openOrientation);
  }
  function openOrientation() {
    if (bridge.needInit()) return;
    const o = info(), visited = new Set(o.visitedIds || []);
    const route = o.route?.length ? o.route : ORIENTATION_ROUTE;
    const next = getNPC(o.nextNpcId || route.find(id => !visited.has(id)));
    bridge.show(o.completed ? 'You know your AMCOL team.' : 'Your first day starts with hello.', 'MISSION 01 · MEET YOUR AMCOL TEAM', `<section class="orientation-hero ${o.completed ? 'complete' : ''}"><span class="orientation-seal">${o.completed ? '✓' : '01'}</span><div><small>${o.completed ? 'ORIENTATION COMPLETE' : `ONE MISSION · ${o.total} INTRODUCTIONS`}</small><h3>${o.completed ? 'Ready for your learning journey.' : 'Meet the people who will guide you.'}</h3><p>${o.completed ? 'Every introduction is saved. Visit the Academic Office for your current assignments, or open your record book to see your character and progress.' : 'Visit each staff member, read what they do, and tap “Thanks, I understand your role.” Meet them in any order. The suggested route below ends at the dormitory.'}</p></div></section><div class="orientation-progress" role="status"><strong>${o.completedCount} / ${o.total} introductions complete</strong><span>${o.completed ? 'Mission complete' : `${o.total - o.completedCount} people still to meet`}</span><div class="academy-track"><i style="width:${o.completedCount / o.total * 100}%"></i></div></div>${next ? `<div class="orientation-next"><div><small>SUGGESTED NEXT STOP</small><strong>${esc(next.name)}</strong><span>${esc(getNPCPlace(next))} · ${esc(next.role)}</span></div>${button('orientation-next', `Meet ${next.name}`, true)}</div>` : ''}<ol class="orientation-route">${route.map((id, index) => { const npc = getNPC(id); if (!npc) return ''; const met = visited.has(id); return `<li class="${met ? 'met' : ''}"><span class="orientation-step" aria-label="${met ? 'Introduction complete' : `Stop ${index + 1}`}">${met ? '✓' : String(index + 1).padStart(2, '0')}</span>${npcPortrait(npc, true)}<div><strong>${esc(npc.name)}</strong><p>${esc(npc.role)}</p><small>${esc(getNPCPlace(npc))}</small></div><button type="button" class="button secondary" data-orientation-npc="${npc.id}">${met ? 'Meet again' : 'Go meet'}<span class="npc-sr-only"> ${esc(npc.name)}</span></button></li>`; }).join('')}</ol><div class="orientation-tips"><h3>What to do when you arrive</h3><p>Use the joystick or WASD to move. Tap Interact or press E near the staff member. Choosing a person here guides your cadet to their meeting point.</p><p>Tr. Aphisit, Dr. Wayne, and Tr. Anne stand in front of the Dome stage. Tr. Amara meets you outside the Workshop beside the changing area; you can introduce yourself without changing clothes. Enter the Atlantic Building to visit Capt. Chalermvut in the CEO Office, Capt. Jakk in the Bridge Simulator, and Engineer Gerald with Chief Engineer Asawin in the Engine Simulator. Kru Yak is at the separate dormitory. Choosing a person guides you to the correct area.</p><p>Introductions and outfit changes keep the same game day and weekly reset allowance. Your checklist saves as you go.</p></div><div class="dialog-actions">${button('orientation-record', 'My record book')}${button('orientation-office', 'Academic Office', o.completed)}${button('orientation-close', 'Explore campus', !o.completed)}</div>`, 'orientation');
    const body = document.querySelector('#dialog-body');
    body.querySelectorAll('[data-orientation-npc]').forEach(el => el.onclick = () => bridge.goLocation(`npc-${el.dataset.orientationNpc}`));
    if (next) body.querySelector('#orientation-next').onclick = () => bridge.goLocation(`npc-${next.id}`);
    body.querySelector('#orientation-office').onclick = bridge.openOffice;
    body.querySelector('#orientation-record').onclick = bridge.openDashboard;
    body.querySelector('#orientation-close').onclick = bridge.closeDialog;
  }
  return { openOrientation, summaryMarkup, bindSummary };
}
