import { CAMPUS, BUILDINGS, STATIONS, DORM, DORM_STATIONS, ATLANTIC, ATLANTIC_ROOMS, ATLANTIC_STATIONS, NPC_STATIONS, WORKSHOP_STATIONS, SAFETY_STATIONS, REST_STATIONS, LOMA_ENTRANCES, TEACHER_PLAZA } from './campus.js';

const FRAME = Object.freeze({ x: 40, y: 84, w: 820, h: 540 });
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const round = value => Math.round(value * 100) / 100;
const mx = value => round(FRAME.x + (value - CAMPUS.bounds.minX) / (CAMPUS.bounds.maxX - CAMPUS.bounds.minX) * FRAME.w);
const my = value => round(FRAME.y + (value - CAMPUS.bounds.minZ) / (CAMPUS.bounds.maxZ - CAMPUS.bounds.minZ) * FRAME.h);
const stationById = new Map([...STATIONS,...REST_STATIONS,...SAFETY_STATIONS].map(station => [station.id, station]));
const labels = {
  imd: ['IMD'],
  cruise: ['CRUISE SHIP', 'TRAINING CENTRE'],
  pacific: ['PACIFIC BUILDING', '4 STOREYS'],
  workshop: ['WORKSHOP'],
  dome: ['DOME'],
  academic: ['ACADEMIC', 'OFFICE'],
  garden: ['PALM GARDEN', 'EAT · RELAX'],
  atlantic: ['ATLANTIC BUILDING', '4 STOREYS'],
  'loma-lounge': ['LOMA', 'LOUNGE', 'FINAL EXAMS'],
  cafe: ['LOMA', 'CAFÉ'],
};

function path(points, extraClass = '') {
  return `<path class="amcol-map-path ${extraClass}" d="${points.map(([x,z], index) => `${index ? 'L' : 'M'}${mx(x)} ${my(z)}`).join(' ')}"/>`;
}

function textLines(lines, x, y, className = '', gap = 19) {
  const top = y - (lines.length - 1) * gap / 2;
  return `<text class="amcol-map-label ${className}" text-anchor="middle">${lines.map((line,index) => `<tspan x="${round(x)}" y="${round(top + index * gap)}">${escapeText(line)}</tspan>`).join('')}</text>`;
}

function renderBuilding(building) {
  const x = mx(building.x - building.w / 2), y = my(building.z - building.d / 2);
  const w = round(mx(building.x + building.w / 2) - x), h = round(my(building.z + building.d / 2) - y);
  const cx = mx(building.x), cy = my(building.z);
  const station = stationById.get(building.id);
  const name = station?.name || building.name;
  let detail = '';
  let label = textLines(labels[building.id] || [building.name], cx, cy + 5, building.id === 'dome' ? 'amcol-map-dome-label' : '',building.id==='loma-lounge'?17:19);
  if (building.id === 'atlantic') {
    label = `<g transform="rotate(-90 ${cx} ${cy})">${textLines(labels.atlantic, cx, cy + 5, 'amcol-map-inverse', 20)}</g>`;
  } else if (building.id === 'pacific') {
    label = textLines(labels.pacific, cx, cy - 3, 'amcol-map-inverse', 20);
  } else if (building.id === 'dome') {
    const stageX=mx(building.x-8.5),stageY=my(building.z-building.d/2+1.7),stageW=round(mx(building.x+8.5)-stageX);
    const plaza=TEACHER_PLAZA;
    detail = `<rect class="amcol-map-stage" x="${stageX}" y="${stageY}" width="${stageW}" height="${round(my(3.5)-my(0))}" rx="3"/><text class="amcol-map-stage-label" x="${cx}" y="${stageY+23}" text-anchor="middle">STAGE · BIG SCREEN</text>
      <rect class="amcol-map-teacher-plaza" x="${mx(plaza.x-plaza.w/2)}" y="${my(plaza.z-plaza.d/2)}" width="${round(mx(plaza.w)-mx(0))}" height="${round(my(plaza.d)-my(0))}" rx="7"/>
      <text class="amcol-map-teacher-title" x="${mx(plaza.x)}" y="${my(plaza.z-plaza.d/2+.77)}" text-anchor="middle">TEACHERS · IN FRONT OF THE STAGE</text>`;
    label += `<text class="amcol-map-small" text-anchor="middle" x="${cx}" y="${cy+29}">CADET PRESENTATIONS</text>`;
  } else if (building.id === 'garden') {
    detail = `<g class="amcol-map-palm" transform="translate(${cx} ${y+26})"><path d="M0 11V-2M0-2Q-12-17-18-3M0-2Q12-17 18-3M0-2Q-8-7-14 4M0-2Q8-7 14 4"/></g>`;
    label = textLines(labels.garden, cx, cy + 14, 'amcol-map-garden-label', 21);
  }
  const destination = station ? `<circle class="amcol-map-door" cx="${mx(station.x)}" cy="${my(station.z)}" r="4.5"/>` : '';
  return `<g class="amcol-map-building amcol-map-${escapeText(building.id)}" data-campus="${escapeText(building.id)}" role="button" tabindex="0" aria-label="Go to ${escapeText(name)}">
    <title>${escapeText(name)}${station ? ` — ${escapeText(station.subtitle)}` : ''}. Select to visit.</title>
    <rect class="amcol-map-building-shadow" x="${x}" y="${y+4}" width="${w}" height="${h}" rx="${building.id==='dome'?17:8}"/>
    <rect class="amcol-map-building-face" x="${x}" y="${y}" width="${w}" height="${h}" rx="${building.id==='dome'?17:8}"/>
    ${detail}${label}${destination}
  </g>`;
}

function renderCadet(position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return '';
  const x = Math.max(CAMPUS.bounds.minX, Math.min(CAMPUS.bounds.maxX, position.x));
  const z = Math.max(CAMPUS.bounds.minZ, Math.min(CAMPUS.bounds.maxZ, position.z));
  return `<g class="amcol-map-cadet" transform="translate(${mx(x)} ${my(z)})" data-world-x="${round(x)}" data-world-z="${round(z)}" aria-label="Your cadet’s current position"><title>Your cadet is here</title><circle class="amcol-map-cadet-halo" r="16"/><circle class="amcol-map-cadet-dot" r="8"/><circle class="amcol-map-cadet-center" r="2.3"/></g>`;
}

function renderStaffPins(zone, projectX, projectY) {
  return NPC_STATIONS.filter(station => station.zone === zone).map(station => `<g class="amcol-map-staff-pin" data-campus="${escapeText(station.id)}" role="button" tabindex="0" aria-label="Meet ${escapeText(station.name)}, ${escapeText(station.subtitle)}" transform="translate(${projectX(station.x)} ${projectY(station.z)})" style="--staff-color:${station.color}">
    <title>${escapeText(station.name)} — ${escapeText(station.subtitle)}. Select to meet and view cadet tasks.</title>
    <circle class="amcol-map-staff-hit" r="25"/>
    <circle class="amcol-map-staff-halo" r="18" style="stroke:${station.color}"/>
    <circle class="amcol-map-staff-dot" r="13" style="fill:${station.color}"/>
    <text class="amcol-map-staff-number" text-anchor="middle" y="5" style="fill:${station.numberColor}">${station.staffNumber}</text>
  </g>`).join('');
}

function renderStaffKey(zone, top) {
  const staff = NPC_STATIONS.filter(station => station.zone === zone);
  const title = zone === 'dorm' ? 'YOUR DORMITORY MASTER' : zone==='atlantic' ? 'MEET YOUR ATLANTIC STAFF' : 'MEET YOUR AMCOL STAFF';
  return `<g class="amcol-map-staff-key">
    <text class="amcol-map-kicker" x="40" y="${top}">${title}</text>
    ${staff.map((station, index) => {
      const x = staff.length === 1 ? 40 : 40 + (index % 2) * 416;
      const y = top + 20 + Math.floor(index / 2) * 73;
      const width = staff.length === 1 ? 820 : 404;
      return `<g class="amcol-map-staff-card" data-campus="${escapeText(station.id)}" role="button" tabindex="0" aria-label="Meet ${escapeText(station.name)} and open their cadet tasks" style="--staff-color:${station.color}">
        <title>${escapeText(station.name)} — ${escapeText(station.subtitle)}</title>
        <rect x="${x}" y="${y}" width="${width}" height="64" rx="11"/>
        <circle class="amcol-map-staff-dot" cx="${x+27}" cy="${y+30}" r="17" style="fill:${station.color}"/>
        <text class="amcol-map-staff-number" text-anchor="middle" x="${x+27}" y="${y+35}" style="fill:${station.numberColor}">${station.staffNumber}</text>
        <text class="amcol-map-staff-name" x="${x+56}" y="${y+26}">${escapeText(station.name)}</text>
        <text class="amcol-map-staff-role" x="${x+56}" y="${y+46}">${escapeText(station.subtitle)}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderWorkshopGear() {
  const station = WORKSHOP_STATIONS[0];
  return `<g class="amcol-map-gear-pin" data-campus="${station.id}" role="button" tabindex="0" aria-label="Visit the Workshop Changing Locker to change into a one-piece coverall" transform="translate(${mx(station.x)} ${my(station.z)})">
    <title>Workshop Changing Locker — change into your one-piece coverall before training. Outside the workshop.</title>
    <circle class="amcol-map-gear-hit" r="25"/>
    <rect class="amcol-map-gear-badge" x="-17" y="-17" width="34" height="34" rx="8"/>
    <path class="amcol-map-gear-suit" d="M-5-8H5L12-4L9 5L5 3V12H1V4H-1V12H-5V3L-9 5L-12-4ZM0-8V1"/>
  </g>`;
}

function renderLifeboat() {
  const station=SAFETY_STATIONS[0],x=mx(station.modelX),y=my(station.modelZ);
  return `<g class="amcol-map-building amcol-map-lifeboat" data-campus="lifeboat" role="button" tabindex="0" aria-label="Go to the Lifeboat for safety mini-games">
    <title>Lifeboat Safety Training — wear an immersion suit to enter and play safety mini-games.</title>
    <rect class="amcol-map-lifeboat-pad" x="${x-40}" y="${y-76}" width="80" height="161" rx="13"/>
    <path class="amcol-map-lifeboat-hull" d="M${x} ${y-65}C${x+26} ${y-57} ${x+25} ${y-26} ${x+25} ${y+35}Q${x+25} ${y+59} ${x} ${y+62}Q${x-25} ${y+59} ${x-25} ${y+35}C${x-25} ${y-26} ${x-26} ${y-57} ${x} ${y-65}Z"/>
    <path class="amcol-map-lifeboat-canopy" d="M${x} ${y-53}Q${x+17} ${y-40} ${x+17} ${y+35}Q${x} ${y+50} ${x-17} ${y+35}Q${x-17} ${y-40} ${x} ${y-53}Z"/>
    ${[-31,-10,11,32].map(d=>`<rect class="amcol-map-lifeboat-window" x="${x-20}" y="${y+d}" width="6" height="11" rx="2"/><rect class="amcol-map-lifeboat-window" x="${x+14}" y="${y+d}" width="6" height="11" rx="2"/>`).join('')}
    <rect class="amcol-map-lifeboat-hatch" x="${x-7}" y="${y-8}" width="14" height="25" rx="4"/>
    <text class="amcol-map-lifeboat-title" text-anchor="middle" x="${x}" y="${y+79}">LIFEBOAT</text>
    <text class="amcol-map-lifeboat-subtitle" text-anchor="middle" x="${x}" y="${y+102}">IMMERSION SUIT</text>
    <circle class="amcol-map-door" cx="${mx(station.x)}" cy="${my(station.z)}" r="5"/>
  </g>`;
}

const lomaDoors=()=>[
  {...REST_STATIONS.find(s=>s.id==='loma-lounge'),side:'west'},
  ...LOMA_ENTRANCES.filter(s=>s.canonicalId==='loma-lounge'),
  ...LOMA_ENTRANCES.filter(s=>s.canonicalId==='cafe'),
  {...STATIONS.find(s=>s.id==='cafe'),side:'east'},
];
function renderLomaEntrancePins(){
  return lomaDoors().map(s=>`<g class="amcol-map-loma-door" data-campus="${s.id}" role="button" tabindex="0" aria-label="Visit ${escapeText(s.name)}" transform="translate(${mx(s.x)} ${my(s.z)})"><title>${escapeText(s.name)} — ${escapeText(s.subtitle)}</title><circle r="12"/><text y="4" text-anchor="middle">${s.side==='west'?'W':'E'}</text></g>`).join('');
}
function renderLomaEntranceKey(top){
  return `<g class="amcol-map-loma-key"><text class="amcol-map-kicker" x="40" y="${top}">LOMA · ENTRANCES ON BOTH SIDES</text>${lomaDoors().map((s,i)=>{
    const x=40+i%2*416,y=top+20+Math.floor(i/2)*73;
    return `<g class="amcol-map-loma-card" data-campus="${s.id}" role="button" tabindex="0" aria-label="Visit ${escapeText(s.name)}"><title>${escapeText(s.subtitle)}</title><rect x="${x}" y="${y}" width="404" height="64" rx="11"/><text class="amcol-map-loma-side" x="${x+24}" y="${y+37}">${s.side==='west'?'W':'E'}</text><text class="amcol-map-loma-name" x="${x+54}" y="${y+26}">${s.location==='loma-lounge'?'Loma Lounge':'Loma Café'} · ${s.side==='west'?'West':'East'} entrance</text><text class="amcol-map-loma-subtitle" x="${x+54}" y="${y+46}">${s.location==='loma-lounge'?'Semester final examinations':'Eat, chat, and recharge'}</text></g>`;
  }).join('')}</g>`;
}

/** Pure SVG renderer. Layout comes directly from the shared campus coordinates. */
export function renderCampusMap(position) {
  const entrance = stationById.get('entrance') || {...CAMPUS.spawn,name:'AMCOL Entrance'};
  const gateX = mx(entrance.x), gateY = my(entrance.z);
  const staffCount = NPC_STATIONS.filter(station => station.zone === 'campus').length;
  const staffTop = 1111, height = staffTop + 20 + Math.ceil(staffCount / 2) * 73 + 39;
  return `<svg class="amcol-campus-map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" style="aspect-ratio:900 / ${height}" role="group" aria-label="Interactive AMCOL campus map with four-storey Pacific and Atlantic buildings, Lifeboat safety mini-games, Loma Lounge, Loma Café, ${staffCount} named staff members and the workshop changing locker.">
    <title>AMCOL Main Campus — choose a destination</title>
    <desc>Relative placement follows the supplied college sketch. Pacific spans the back of the Dome, with its entrance on the right/east side. Cruise Ship Training is beneath its west end and IMD farther west. Both Pacific and Atlantic have four storeys. Atlantic is along the eastern edge and leads to a walkable interior with a CEO Office, Bridge Simulator, Engine Simulator, ECDIS and GMDSS rooms. The Academic Office and open Palm Garden are east of the Dome. Workshop is northeast. An orange lifeboat for safety mini-games stands west of the Dome. Loma Lounge hosts semester final examinations and Loma Café is for food and rest. Both have opposing east and west side entrances. Dr. Wayne, Tr. Aphisit and Tr. Anne stand side-by-side in front of the Dome stage, on the audience side of the screen. Tr. Amara and the coverall changing locker are outside the workshop. The dormitory is a separate area. This stylized guide does not assign teaching rooms to individual floors.</desc>
    <rect class="amcol-map-paper" x="0" y="0" width="900" height="${height}" rx="18"/>
    <text class="amcol-map-kicker" x="40" y="31">AMCOL · CAMPUS GUIDE</text>
    <circle class="amcol-map-legend-dot" cx="612" cy="27" r="5"/>
    <text class="amcol-map-legend" x="624" y="32">Your cadet</text>
    <rect class="amcol-map-legend-pacific" x="715" y="22" width="11" height="11" rx="3"/>
    <text class="amcol-map-legend" x="733" y="32">Pacific</text>
    <rect class="amcol-map-legend-atlantic" x="794" y="22" width="11" height="11" rx="3"/>
    <text class="amcol-map-legend" x="812" y="32">Atlantic</text>
    <text class="amcol-map-orientation" text-anchor="middle" x="450" y="65">BACK OF CAMPUS</text>
    <rect class="amcol-map-grounds" x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${FRAME.h}" rx="15"/>
    <g aria-hidden="true">
      ${path([[-33,25],[-33,19.6],[29,19.6]])}
      ${path([[-34.8,19.6],[-34.8,-6.7],[-20,-6.7]])}
      ${path([[-19.5,19.6],[-19.5,-8.7]])}
      ${path([[-33,2],[-19.5,2]])}
      ${path([[9.6,19.6],[9.6,-20.5]])}${path([[9.6,-14.3],[29,-14.3],[29,15.3]])}
      ${path([[-13,-12.5],[9.6,-12.5]])}
      ${path([[9.6,-1.2],[29,-1.2]])}
      ${path([[9.6,13.8],[29,13.8]])}
      ${path([[12.7,13.8],[12.7,20]])}${path([[22.9,13.8],[22.9,24]])}${path([[29,14.8],[33.1,14.8],[33.1,20]])}${path([[22.9,24],[33.1,24],[33.1,20]])}
    </g>
    ${BUILDINGS.map(renderBuilding).join('')}
    <g class="amcol-map-pacific-entry" data-campus="pacific" role="button" tabindex="0" aria-label="Go to Pacific through its right-side east entrance" transform="translate(${mx(stationById.get('pacific').x)} ${my(stationById.get('pacific').z)})">
      <title>Pacific Building — enter through the right/east façade.</title><circle r="13"/><path d="M5 0H-5M-1-4L-5 0L-1 4"/><text text-anchor="middle" y="29">EAST ENTRY</text>
    </g>
    ${renderLifeboat()}
    <path class="amcol-map-perimeter" d="M${gateX-15} ${FRAME.y+FRAME.h}H${FRAME.x+15}Q${FRAME.x} ${FRAME.y+FRAME.h} ${FRAME.x} ${FRAME.y+FRAME.h-15}V${FRAME.y+15}Q${FRAME.x} ${FRAME.y} ${FRAME.x+15} ${FRAME.y}H${FRAME.x+FRAME.w-15}Q${FRAME.x+FRAME.w} ${FRAME.y} ${FRAME.x+FRAME.w} ${FRAME.y+15}V${FRAME.y+FRAME.h-15}Q${FRAME.x+FRAME.w} ${FRAME.y+FRAME.h} ${FRAME.x+FRAME.w-15} ${FRAME.y+FRAME.h}H${gateX+15}"/>
    <rect class="amcol-map-road" x="40" y="642" width="820" height="38" rx="7"/>
    <path class="amcol-map-road-line" d="M52 661H320M580 661H848"/>
    <text class="amcol-map-road-label" text-anchor="middle" x="450" y="666">FRONT ROAD</text>
    <g class="amcol-map-building amcol-map-entrance" data-campus="entrance" role="button" tabindex="0" aria-label="Go to AMCOL Entrance">
      <title>AMCOL Entrance — main gate and campus information. Select to visit.</title>
      <rect class="amcol-map-entry-hit" x="${gateX-29}" y="${gateY-22}" width="175" height="69" rx="12"/>
      <path class="amcol-map-entry-line" d="M${gateX} ${gateY+9}V642M${gateX-15} 616V632M${gateX+15} 616V632"/>
      <circle class="amcol-map-entry-badge" cx="${gateX}" cy="${gateY-1}" r="16"/>
      <path class="amcol-map-entry-arrow" d="M${gateX} ${gateY+6}V${gateY-8}M${gateX-5} ${gateY-3}L${gateX} ${gateY-8}L${gateX+5} ${gateY-3}"/>
      <text class="amcol-map-entry-name" x="${gateX+25}" y="${gateY-2}">AMCOL ENTRANCE</text>
      <text class="amcol-map-entry-small" x="${gateX+25}" y="${gateY+15}">FRONT OF CAMPUS</text>
    </g>
    ${renderStaffPins('campus',mx,my)}${renderWorkshopGear()}${renderLomaEntrancePins()}${renderCadet(position)}
    <g class="amcol-map-offsite amcol-map-building" data-campus="dorm" role="button" tabindex="0" aria-label="Travel to the separate cadet dormitory">
      <title>Travel to the dormitory for PT, running, football, and sleep.</title>
      <rect x="40" y="705" width="820" height="64" rx="10"/>
      <path transform="translate(0 9)" d="M56 728L67 718L78 728M59 726V738H75V726M65 738V731H69V738"/>
      <text class="amcol-map-offsite-title" x="91" y="733">DORMITORY · OFF CAMPUS</text>
      <text class="amcol-map-offsite-copy" x="91" y="751">Travel to your room, PT yard, running track, and football field.</text>
      <text class="amcol-map-offsite-action" text-anchor="end" x="837" y="743">TRAVEL →</text>
    </g>
    <g class="amcol-map-gear-card" data-campus="workshop-changing" role="button" tabindex="0" aria-label="Visit the workshop changing locker and equip a one-piece coverall">
      <title>Workshop Changing Locker — outside the workshop, beside Tr. Amara.</title>
      <rect x="40" y="780" width="820" height="64" rx="10"/>
      <path class="amcol-map-gear-suit" transform="translate(65 810)" d="M-5-8H5L12-4L9 5L5 3V12H1V4H-1V12H-5V3L-9 5L-12-4ZM0-8V1"/>
      <text class="amcol-map-gear-title" x="91" y="806">WORKSHOP CHANGING LOCKER</text>
      <text class="amcol-map-gear-copy" x="91" y="824">Equip your one-piece coverall before workshop mini-games. Meet Tr. Amara outside.</text>
      <text class="amcol-map-gear-action" text-anchor="end" x="837" y="816">CHANGE →</text>
    </g>
    <g class="amcol-map-safety-card" data-campus="lifeboat" role="button" tabindex="0" aria-label="Visit the Lifeboat for safety mini-games">
      <title>Lifeboat Safety Training — west of the Dome.</title>
      <rect x="40" y="855" width="820" height="64" rx="10"/>
      <path d="M56 881H79L75 893H61ZM61 876H75L78 881H58Z"/>
      <text class="amcol-map-safety-title" x="91" y="881">LIFEBOAT · SAFETY MINI-GAMES</text>
      <text class="amcol-map-safety-copy" x="91" y="899">Equip an immersion suit to enter the orange lifeboat training area.</text>
      <text class="amcol-map-safety-action" text-anchor="end" x="837" y="891">VISIT →</text>
    </g>
    ${renderLomaEntranceKey(937)}
    ${renderStaffKey('campus',staffTop)}
    <text class="amcol-map-small" text-anchor="middle" x="450" y="${height-21}">TEACHERS IN FRONT OF THE DOME STAGE · ATLANTIC INTERIOR · SEA TRAINING REVIEW WITH TR. DREAM</text>
  </svg>`;
}

/** Separate schematic residence, sharing the playable dormitory coordinates. */
export function renderDormMap(position) {
  const frame={x:45,y:95,w:810,h:510};
  const dx=x=>round(frame.x+(x-DORM.bounds.minX)/(DORM.bounds.maxX-DORM.bounds.minX)*frame.w);
  const dy=z=>round(frame.y+(z-DORM.bounds.minZ)/(DORM.bounds.maxZ-DORM.bounds.minZ)*frame.h);
  const sx=w=>round(w/(DORM.bounds.maxX-DORM.bounds.minX)*frame.w);
  const sy=d=>round(d/(DORM.bounds.maxZ-DORM.bounds.minZ)*frame.h);
  const rect=(b,cls)=>`<rect class="${cls}" x="${dx(b.x-b.w/2)}" y="${dy(b.z-b.d/2)}" width="${sx(b.w)}" height="${sy(b.d)}" rx="12"/>`;
  const route=points=>`<path class="amcol-map-path" d="${points.map(([x,z],i)=>`${i?'L':'M'}${dx(x)} ${dy(z)}`).join(' ')}"/>`;
  const station=id=>DORM_STATIONS.find(item=>item.id===id);
  const open=id=>`<g class="amcol-map-building amcol-dorm-${id.replace('dorm-','')}" data-campus="${id}" role="button" tabindex="0" aria-label="Visit ${escapeText(station(id).name)}"><title>${escapeText(station(id).name)} — ${escapeText(station(id).subtitle)}</title>`;
  const door=id=>`<circle class="amcol-map-door" cx="${dx(station(id).x)}" cy="${dy(station(id).z)}" r="5"/>`;
  const hall=DORM.hall,pt=DORM.pt,t=DORM.track,f=DORM.football;
  let cadet='';
  if(position&&Number.isFinite(position.x)&&Number.isFinite(position.z)){
    const x=Math.max(DORM.bounds.minX,Math.min(DORM.bounds.maxX,position.x));
    const z=Math.max(DORM.bounds.minZ,Math.min(DORM.bounds.maxZ,position.z));
    cadet=`<g class="amcol-map-cadet" transform="translate(${dx(x)} ${dy(z)})" aria-label="Your cadet’s current position"><title>Your cadet is here</title><circle class="amcol-map-cadet-halo" r="16"/><circle class="amcol-map-cadet-dot" r="8"/><circle class="amcol-map-cadet-center" r="2.3"/></g>`;
  }
  return `<svg class="amcol-campus-map amcol-dorm-map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 825" role="group" aria-label="Interactive dormitory map with Kru Yak, the dormitory master. A separate residence and sports area.">
    <title>Cadet Dormitory — choose a destination</title>
    <desc>Separate schematic dormitory game area. Meet Kru Yak, walk to the cadet room, PT yard, running track, or football field, or return to the main campus.</desc>
    <rect class="amcol-map-paper" width="900" height="825" rx="18"/>
    <text class="amcol-map-kicker" x="45" y="35">CADET DORMITORY</text>
    <text class="amcol-map-orientation" text-anchor="end" x="855" y="35">HOME · FITNESS · REST</text>
    <text class="amcol-map-legend" x="45" y="63">Complete PT, running, or football. Then visit your room to sleep.</text>
    <rect class="amcol-map-grounds" x="45" y="95" width="810" height="510" rx="15"/>
    <g aria-hidden="true">
      ${route([[-24,24],[-24,18],[27,18],[27,-12]])}
      ${route([[-15,18],[-15,-12]])}
      ${route([[-3,18],[-3,-18]])}
      ${route([[13,18],[13,12]])}
    </g>
    ${open('dorm-sleep')}
      ${rect(hall,'amcol-map-building-face amcol-dorm-hall')}
      <g class="amcol-dorm-bed" aria-hidden="true">${[-1,1].map(side=>`<rect x="${dx(hall.x+side*5.9-1.4)}" y="${dy(hall.z-3.7)}" width="${sx(2.8)}" height="${sy(4.2)}" rx="5"/><path d="M${dx(hall.x+side*5.9-1.4)} ${dy(hall.z-2.6)}H${dx(hall.x+side*5.9+1.4)}"/>`).join('')}</g>
      ${textLines(['CADET ROOM','SLEEP'],dx(hall.x),dy(hall.z)-35,'amcol-dorm-hall-label',23)}
      ${door('dorm-sleep')}
    </g>
    ${open('dorm-pt')}
      ${rect(pt,'amcol-map-building-face amcol-dorm-yard')}
      <g class="amcol-dorm-mats" aria-hidden="true">${[-1,1].map(side=>`<rect x="${dx(pt.x+side*4-1)}" y="${dy(pt.z-1.5)}" width="${sx(2)}" height="${sy(3)}" rx="4"/>`).join('')}</g>
      ${textLines(['PT YARD'],dx(pt.x),dy(pt.z)-27,'',20)}
      <text class="amcol-map-small" text-anchor="middle" x="${dx(pt.x)}" y="${dy(pt.z)+37}">GUIDED EXERCISES</text>
      ${door('dorm-pt')}
    </g>
    ${open('dorm-run')}
      <ellipse class="amcol-map-building-face amcol-dorm-track" cx="${dx(t.x)}" cy="${dy(t.z)}" rx="${sx(t.rx)}" ry="${sy(t.rz)}"/>
      ${[.8,1.8].map(i=>`<ellipse class="amcol-dorm-lane" cx="${dx(t.x)}" cy="${dy(t.z)}" rx="${sx(t.rx-i)}" ry="${sy(t.rz-i)}"/>`).join('')}
      <text class="amcol-dorm-track-label" text-anchor="middle" x="${dx(t.x)}" y="${dy(t.z-t.rz)+21}">RUNNING TRACK</text>
      ${door('dorm-run')}
    </g>
    ${open('dorm-football')}
      ${rect(f,'amcol-map-building-face amcol-dorm-field')}
      <path class="amcol-dorm-field-line" d="M${dx(f.x-f.w/2+.7)} ${dy(f.z)}H${dx(f.x+f.w/2-.7)}"/>
      <ellipse class="amcol-dorm-field-line" cx="${dx(f.x)}" cy="${dy(f.z)}" rx="${sx(2.4)}" ry="${sy(2.4)}"/>
      ${[-1,1].map(side=>`<rect class="amcol-dorm-goal" x="${dx(f.x-2.5)}" y="${dy(f.z+side*(f.d/2-1.1)-.6)}" width="${sx(5)}" height="${sy(1.2)}" rx="2"/>`).join('')}
      ${textLines(['FOOTBALL'],dx(f.x),dy(f.z)-41,'amcol-map-inverse',20)}
      ${door('dorm-football')}
    </g>
    ${open('dorm-arrival')}
      <rect class="amcol-map-entry-hit" x="${dx(-28)}" y="${dy(16.4)}" width="${sx(8)}" height="${sy(6.7)}" rx="8"/>
      <circle class="amcol-map-entry-badge" cx="${dx(-24)}" cy="${dy(18)}" r="17"/>
      <path class="amcol-map-entry-arrow" d="M${dx(-24)} ${dy(18)+6}V${dy(18)-8}M${dx(-24)-5} ${dy(18)-3}L${dx(-24)} ${dy(18)-8}L${dx(-24)+5} ${dy(18)-3}"/>
      <text class="amcol-map-entry-small" text-anchor="middle" x="${dx(-24)}" y="${dy(18)+34}">ARRIVAL</text>
    </g>
    ${open('dorm-return')}
      <rect class="amcol-map-building-face amcol-dorm-shuttle" x="${dx(-19.5)}" y="${dy(17)}" width="${sx(8.2)}" height="${sy(5)}" rx="8"/>
      ${textLines(['CAMPUS','SHUTTLE'],dx(-14.4),dy(19.5)+3,'amcol-dorm-shuttle-label',16)}
      ${door('dorm-return')}
    </g>
    ${renderStaffPins('dorm', dx, dy)}
    ${cadet}
    <rect class="amcol-map-perimeter" x="45" y="95" width="810" height="510" rx="15"/>
    <text class="amcol-map-legend" text-anchor="middle" x="450" y="640">Separate from the AMCOL main campus · Select a destination to walk there</text>
    <text class="amcol-map-small" text-anchor="middle" x="450" y="671">EXERCISE → SLEEP → A NEW DAY OF CAMPUS MISSIONS</text>
    ${renderStaffKey('dorm', 713)}
  </svg>`;
}

/** Atlantic's cutaway uses the same room boundaries and doors as the world. */
export function renderAtlanticMap(position) {
  const frame={x:40,y:90,w:820,h:600},bounds=ATLANTIC.bounds;
  const staffCount=NPC_STATIONS.filter(station=>station.zone==='atlantic').length;
  const height=874+Math.ceil(staffCount/2)*73;
  const ax=x=>round(frame.x+(x-bounds.minX)/(bounds.maxX-bounds.minX)*frame.w);
  const az=z=>round(frame.y+(z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*frame.h);
  const sw=w=>round(w/(bounds.maxX-bounds.minX)*frame.w);
  const sd=d=>round(d/(bounds.maxZ-bounds.minZ)*frame.h);
  const stationById=new Map(ATLANTIC_STATIONS.map(station=>[station.id,station]));
  const rectangle=(x,z,w,d,cls)=>`<rect class="${cls}" x="${ax(x-w/2)}" y="${az(z-d/2)}" width="${sw(w)}" height="${sd(d)}" rx="4"/>`;
  const roomMarkup=ATLANTIC_ROOMS.map(room=>{
    const station=stationById.get(room.stationId),left=ax(room.x-room.w/2),top=az(room.z-room.d/2);
    const doorX=room.x+(room.doorSide==='east'?1:-1)*room.w/2;
    let equipment='';
    if(room.id==='captain')equipment=rectangle(room.x,room.z,5,2,'amcol-atlantic-desk')+`<text class="amcol-atlantic-equipment-label" x="${ax(room.x)}" y="${az(room.z)+4}" text-anchor="middle">CEO DESK</text>`;
    else if(room.id==='engine')equipment=rectangle(room.x+2,room.z-4.2,8,4.8,'amcol-atlantic-engine')+[-2.3,0,2.3].map(x=>`<circle class="amcol-atlantic-cylinder" cx="${ax(room.x+2+x)}" cy="${az(room.z-4.2)}" r="8"/>`).join('');
    else {
      const cfg=room.id==='bridge'?{x:-2,z:-4.75,w:13,d:1.7}:room.id==='ecdis'?{x:-1.2,z:-2.7,w:13.5,d:1.75}:{x:-1,z:-5.5,w:12.8,d:2};
      equipment=rectangle(room.x+cfg.x,room.z+cfg.z,cfg.w,cfg.d,'amcol-atlantic-console');
      for(const offset of[-4,0,4])equipment+=rectangle(room.x+cfg.x+offset,room.z+cfg.z-.10,2.9,.67,'amcol-atlantic-monitor');
    }
    const subtitles={captain:'CAPT. CHALERMVUT',bridge:'CAPT. JAKK',engine:'ASAWIN + GERALD',ecdis:'TR. DUKE',gmdss:'TR. BANK'};
    const labelY=['bridge','ecdis','gmdss'].includes(room.id)?top+sd(room.d)-28:top+26;
    const labelX=ax(room.x-(room.id==='ecdis'?1.5:0));
    return `<g class="amcol-map-building amcol-atlantic-room" data-campus="${room.stationId}" data-room="${room.id}" role="button" tabindex="0" aria-label="Walk to ${escapeText(room.name)}">
      <title>${escapeText(room.name)} — ${escapeText(station.subtitle)}. Select to walk through the hall into this room.</title>
      <rect class="amcol-map-building-face" x="${left}" y="${top}" width="${sw(room.w)}" height="${sd(room.d)}" rx="6" style="fill:${room.color};stroke:${room.trim}"/>
      ${equipment}
      <path class="amcol-atlantic-open-door" d="M${ax(doorX)} ${az(room.doorZ-room.doorWidth/2)}V${az(room.doorZ+room.doorWidth/2)}"/>
      <path class="amcol-atlantic-door-route" d="M${ax(doorX)} ${az(room.doorZ)}H${ax(station.x)}"/>
      <circle class="amcol-map-door" cx="${ax(station.x)}" cy="${az(station.z)}" r="5"/>
      <text class="amcol-atlantic-room-title" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeText(room.name.toUpperCase())}</text>
      <text class="amcol-atlantic-room-subtitle" x="${labelX}" y="${labelY+18}" text-anchor="middle">${subtitles[room.id]}</text>
    </g>`;
  }).join('');
  const cadet=position&&Number.isFinite(position.x)&&Number.isFinite(position.z)?`<g class="amcol-map-cadet" transform="translate(${ax(Math.max(bounds.minX,Math.min(bounds.maxX,position.x)))} ${az(Math.max(bounds.minZ,Math.min(bounds.maxZ,position.z)))})" data-world-x="${round(position.x)}" data-world-z="${round(position.z)}" aria-label="Your cadet’s current position"><title>Your cadet is here</title><circle class="amcol-map-cadet-halo" r="16"/><circle class="amcol-map-cadet-dot" r="8"/><circle class="amcol-map-cadet-center" r="2.3"/></g>`:'';
  return `<svg class="amcol-campus-map amcol-atlantic-map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" style="aspect-ratio:900 / ${height}" role="group" aria-label="Interactive Atlantic interior map with five walkable rooms and ${staffCount} named staff members">
    <title>Atlantic Building — walkable interior</title>
    <desc>A roofless gameplay cutaway with a wide central hall and open doorways. The CEO Office contains Capt. Chalermvut and his desk. Capt. Jakk is in the Bridge Simulator. Chief Engineer Asawin and Engineer Gerald are in the Engine Simulator. Tr. Duke teaches in the ECDIS chart lab and Tr. Bank teaches in the GMDSS communications lab. This schematic does not assign rooms to any real college floor.</desc>
    <rect class="amcol-map-paper" x="0" y="0" width="900" height="${height}" rx="18"/>
    <text class="amcol-map-kicker" x="40" y="31">ATLANTIC · INTERIOR GUIDE</text>
    <circle class="amcol-map-legend-dot" cx="736" cy="27" r="5"/><text class="amcol-map-legend" x="749" y="32">Your cadet</text>
    <text class="amcol-map-orientation" x="450" y="65" text-anchor="middle">WALK THROUGH THE HALL TO ENTER ANY ROOM</text>
    <rect class="amcol-atlantic-ground" x="40" y="90" width="820" height="600" rx="14"/>
    ${rectangle(0,0,8,40,'amcol-atlantic-hall')}
    <path class="amcol-atlantic-hall-route" d="M${ax(0)} ${az(-18)}V${az(19.3)}"/>
    ${roomMarkup}
    <text class="amcol-atlantic-hall-label" text-anchor="middle" transform="translate(${ax(0)} ${az(-3)}) rotate(-90)">CENTRAL HALL</text>
    <g class="amcol-map-building amcol-atlantic-lobby" data-campus="atlantic-lobby" role="button" tabindex="0" aria-label="Walk to the Atlantic Lobby">
      <title>Atlantic Lobby — choose an office or simulator room.</title><rect class="amcol-map-building-face" x="${ax(-3.3)}" y="${az(11)}" width="${sw(6.6)}" height="${sd(3)}" rx="7"/><text class="amcol-atlantic-lobby-label" x="${ax(0)}" y="${az(12.5)+4}" text-anchor="middle">LOBBY</text>
    </g>
    <g class="amcol-map-building amcol-atlantic-exit" data-campus="atlantic-return" role="button" tabindex="0" aria-label="Exit Atlantic and return to campus">
      <title>Exit Atlantic to the main campus.</title><rect class="amcol-map-building-face" x="${ax(-3.3)}" y="${az(17.7)}" width="${sw(6.6)}" height="${sd(3)}" rx="7"/><text class="amcol-atlantic-lobby-label" x="${ax(0)}" y="${az(19.3)+4}" text-anchor="middle">EXIT ↓</text>
    </g>
    ${renderStaffPins('atlantic',ax,az)}${cadet}
    <text class="amcol-map-legend" x="450" y="723" text-anchor="middle">Select a room or a staff member to walk there. Use the south exit to return to campus.</text>
    ${renderStaffKey('atlantic',771)}
    <text class="amcol-map-small" x="450" y="${height-26}" text-anchor="middle">CEO OFFICE · BRIDGE SIMULATOR · ENGINE SIMULATOR · ECDIS · GMDSS</text>
  </svg>`;
}
