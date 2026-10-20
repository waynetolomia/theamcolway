import { CAMPUS, DORM, ATLANTIC, STATIONS, DORM_STATIONS, ATLANTIC_STATIONS, NPC_STATIONS, WORKSHOP_STATIONS, SAFETY_STATIONS, REST_STATIONS, LOMA_ENTRANCES, ACTIVITY_LOCATIONS } from './campus.js';
import { renderCampusMap, renderDormMap, renderAtlanticMap } from './map-view.js';
import { STORAGE_KEY, createState, normalizeState } from './progress.js';
import { BOOK, SEMESTERS, ACTIVITIES, getActivity } from './book-course.js';
import { createAcademy } from './academy-ui.js';
import { rewardMarkup } from './rpg-campus.js';
import { mountJoystick } from './joystick.js';
import { mountCameraControls } from './camera-controls.js';
import { NPCS, NPC_MISSIONS } from './npc-content.js';

const $ = (s, scope = document) => scope.querySelector(s);
const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS = {
  anchor:'<path d="M12 5v16M5 13H2c0 5 4 8 10 8s10-3 10-8h-3M7 10h10"/><circle cx="12" cy="4" r="2"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  user:'<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  flag:'<path d="M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.7 2.7 0 0 1 5.3.5c0 1.7-2.7 2-2.7 4M12 17h.01"/>',
  settings:'<path d="m9 3-.6 2.3-2 .9-2.2-.6L2 9l1.7 1.7v2.6L2 15l2.2 3.4 2.2-.6 2 .9L9 21h6l.6-2.3 2-.9 2.2.6L22 15l-1.7-1.7v-2.6L22 9l-2.2-3.4-2.2.6-2-.9L15 3Z"/><circle cx="12" cy="12" r="3"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
  'rotate-left':'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
  'rotate-right':'<path d="M21 10a9 9 0 1 0-1 7m1-13v6h-6"/>',
  shuffle:'<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  book:'<path d="M12 5v16M2 4c4-1 7-1 10 1 3-2 6-2 10-1v15c-4-1-7-1-10 2-3-3-6-3-10-2Z"/>',
  radio:'<rect x="5" y="7" width="14" height="15" rx="3"/><path d="m8 7 9-6M9 12h6M9 17h.01M15 17h.01"/>',
  home:'<path d="m3 10 9-8 9 8v11H3Zm6 11v-8h6v8"/>',
  ship:'<path d="m2 15 10-4 10 4-3 6H5ZM7 13V6h10v7M10 6V2h4v4"/>',
  map:'<path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3ZM8 2v17m8-14v17"/>',
  trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 2v5m-4 2h8"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  minus:'<path d="M5 12h14"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',
  volume:'<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  heart:'<path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.3a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z"/>',
  shield:'<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  hair:'<path d="M5 13V8a7 7 0 0 1 14 0v5M6 8c4 0 6-4 6-4 1 3 4 4 6 4M6 11v3a6 6 0 0 0 12 0v-3"/>',
  shirt:'<path d="m8 3-6 5 4 4 2-2v11h8V10l2 2 4-4-6-5c-2 3-6 3-8 0Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M3 15v6h18v-6"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
  moon:'<path d="M21 12.8A9 9 0 0 1 11.2 3a9 9 0 1 0 9.8 9.8Z"/>',
  lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.compass}</svg>`;
function paintIcons(scope=document){ $$('[data-icon]',scope).forEach(el => el.innerHTML=icon(el.dataset.icon)); }
const SETTINGS_KEY='seapath.settings.v1', WORLD_KEY='seapath.world.v2';
let storageOK=true, initialSave=null, prefs={sound:false,quality:'high'}, savedWorld=null;
try {
  initialSave=normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));
  const p=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');
  if(p&&typeof p==='object')prefs={sound:p.sound===true,quality:p.quality==='low'?'low':'high'};
  savedWorld=JSON.parse(localStorage.getItem(WORLD_KEY)||'null');
} catch { storageOK=false; }
// The former prototype save is retained for its character and appearance only.
// Semester completions, game days and quota are always loaded from the academy API.
let state=initialSave||createState(), character={...state.character}, hasSave=!!initialSave;
let mode='creator', world=null, nearStation=null, destinationIntent=null, engineAvailable=false;
let editing=false, creatorDirty=false, dialogKey='', lastMoveSave=0, audioContext=null, toastTimer=null, rewardTimer=null, academy=null;
let joystick=null, cameraControls=null, mobileRun=false, touchVector={x:0,z:0};
const districts={campus:CAMPUS,dorm:DORM,atlantic:ATLANTIC};
let currentZone=Object.hasOwn(districts,savedWorld?.zone)?savedWorld.zone:'campus';
const validPosition=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const positions={campus:validPosition(savedWorld?.campus)?savedWorld.campus:state.position||{...CAMPUS.spawn},dorm:validPosition(savedWorld?.dorm)?savedWorld.dorm:{...DORM.spawn},atlantic:validPosition(savedWorld?.atlantic)?savedWorld.atlantic:{...ATLANTIC.spawn}};
const dialog=$('#game-dialog');
const stationDetails=Object.fromEntries([...STATIONS,...DORM_STATIONS,...ATLANTIC_STATIONS,...NPC_STATIONS,...WORKSHOP_STATIONS,...SAFETY_STATIONS,...REST_STATIONS,...LOMA_ENTRANCES].map(s=>[s.id,{...s,label:s.npcId?`Talk to ${s.name}`:['dorm-return','atlantic-return'].includes(s.id)?'Return to the AMCOL campus':s.id==='atlantic'?'Enter Atlantic · Offices & Simulators':s.id==='lifeboat'?'Play lifeboat safety games':s.id.startsWith('loma-lounge')?'Enter Loma Lounge · Final 50':`Explore ${s.name}`} ]));
const canonicalLocation=id=>id==='loma-lounge-east'?'loma-lounge':id==='cafe-west'?'cafe':id;
const skinColors=[['#f2d0b0','Light'],['#dca479','Warm light'],['#b97850','Medium'],['#98603e','Warm brown'],['#72482f','Brown'],['#4c3026','Deep']];
const hairColors=[['#292327','Dark'],['#523426','Chestnut'],['#956347','Brown'],['#c2a071','Sandy'],['#b54f39','Auburn'],['#77767c','Silver']];
const accents=[['#198879','Sea green'],['#284b79','Ocean blue'],['#b46649','Terracotta'],['#84709c','Lilac'],['#d3a850','Golden yellow']];
const traitOptions=[{value:'Curious',icon:'sparkles',description:'There’s always more to discover.'},{value:'Steady',icon:'shield',description:'A calm mind, even in a storm.'},{value:'Sociable',icon:'heart',description:'Every crew starts with a connection.'}];

function save(){if(!hasSave)return;try{state.character={...character};localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}}
function saveWorld(){try{localStorage.setItem(WORLD_KEY,JSON.stringify({zone:currentZone,...positions}));}catch{storageOK=false;}}
function savePrefs(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(prefs));}catch{storageOK=false;}}
function htmlButton(id,label,style='primary',name='arrow-right'){return `<button class="button ${style}" id="${id}">${escapeHTML(label)}${name?icon(name):''}</button>`;}
function setProfile(profile,{preserveDraft=false}={}){
  if(!profile||preserveDraft&&mode==='creator'&&(editing||creatorDirty))return;
  const next=createState(profile).character,changed=Object.keys(next).some(key=>next[key]!==character[key]);
  character={...next};state.character={...character};
  if(changed)world?.setCharacter(character);
  save();if(mode==='creator'&&changed)updateCreator();
}
function restoreEnergy(){state.energy=100;save();updateHUD();}
function setMobileRun(value){mobileRun=Boolean(value);const button=$('#mobile-run');button?.setAttribute('aria-pressed',String(mobileRun));button?.setAttribute('aria-label',mobileRun?'Run, on. Toggle walking.':'Run, off. Toggle running.');if(button?.querySelector('[data-run-label]'))button.querySelector('[data-run-label]').textContent=mobileRun?'Running':'Run';world?.setInput(touchVector.x,touchVector.z,mobileRun);}
function stopTouch(){touchVector={x:0,z:0};setMobileRun(false);joystick?.reset();cameraControls?.reset();world?.setInput(0,0,false);}
function updateTouchState(){const enabled=mode==='world'&&!dialog.open&&!document.hidden&&engineAvailable;joystick?.setEnabled(enabled);cameraControls?.setEnabled(enabled);if(!enabled)stopTouch();for(const id of ['mobile-run','mobile-interact']){const button=$('#'+id);if(button)button.disabled=!enabled;}document.body.dataset.worldAvailable=String(engineAvailable);}
function toast(text){
  const item=document.createElement('div');item.className='toast';item.textContent=text;$('#toast-stack').replaceChildren(item);clearTimeout(toastTimer);toastTimer=setTimeout(()=>item.remove(),4200);
}
function showReward(reward){
  const item=$('#rpg-reward'),html=rewardMarkup(reward);if(!item||!html)return;
  item.innerHTML=html;item.hidden=false;clearTimeout(rewardTimer);
  rewardTimer=setTimeout(()=>{item.hidden=true;},12000);
  if(Number(reward.level)>Number(reward.previousLevel))celebrate();
}
function playTone(type='tap'){
  if(!prefs.sound)return;
  try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const now=audioContext.currentTime;const notes=type==='success'?[523,659,784]:type==='wrong'?[220,196]:[440];notes.forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,now+i*.1);g.gain.linearRampToValueAtTime(.055,now+i*.1+.012);g.gain.exponentialRampToValueAtTime(.001,now+i*.1+.18);o.connect(g);g.connect(audioContext.destination);o.start(now+i*.1);o.stop(now+i*.1+.2);});}catch{}
}
function celebrate(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(let i=0;i<38;i++){const p=document.createElement('i');p.className='confetti';p.style.left=`${Math.random()*100}%`;p.style.background=['#82b891','#d6ac57','#d7eabc','#b9ced1','#dda68b'][i%5];p.style.animationDelay=`${Math.random()*.7}s`;p.style.animationDuration=`${2+Math.random()}s`;document.body.append(p);setTimeout(()=>p.remove(),4000);}
}
function buildCreatorControls(){
  $('#trait-options').innerHTML=traitOptions.map(t=>`<button class="trait-button${character.trait===t.value?' active':''}" data-value="${t.value}" type="button" aria-pressed="${character.trait===t.value}"><span class="trait-icon">${icon(t.icon)}</span><span><strong>${t.value}</strong><small>${t.description}</small></span><span class="radio-dot"></span></button>`).join('');
  const swatches=(id,key,colors)=>{ $(id).innerHTML=colors.map(([value,label])=>`<button type="button" class="swatch${character[key]===value?' active':''}" data-value="${value}" style="--swatch:${value}" title="${label}" aria-label="${label}" aria-pressed="${character[key]===value}"></button>`).join(''); $(id).onclick=e=>{const b=e.target.closest('[data-value]');if(b)choose(key,b.dataset.value);};};
  swatches('#skin-options','skin',skinColors);swatches('#hair-color-options','hairColor',hairColors);swatches('#accent-options','accent',accents);
  $('#hair-options').innerHTML=[['crop','Cropped'],['swept','Swept'],['bob','Bob'],['bun','Bun']].map(([value,label])=>`<button class="choice-button${character.hairStyle===value?' active':''}" data-value="${value}" aria-pressed="${character.hairStyle===value}">${icon('hair')}${label}</button>`).join('');
  const segments=(id,key,choices)=>{ $(id).innerHTML=choices.map(([value,label])=>`<button class="${character[key]===value?'active':''}" data-value="${value}" aria-pressed="${character[key]===value}">${label}</button>`).join('');$(id).onclick=e=>{const b=e.target.closest('[data-value]');if(b)choose(key,b.dataset.value);};};
  segments('#gender-options','gender',[['male','Male'],['female','Female']]);
  segments('#major-options','major',[['deck','DECK'],['engine','ENGINE']]);
  const majorLocked=academy?.getState()?.loma?.majorLocked===true;
  $$('#major-options button').forEach(button=>{button.disabled=majorLocked&&button.dataset.value!==character.major;});
  $('#major-note').textContent=majorLocked?'Your major is locked to your saved Loma Lounge final.':'DECK: navigation and bridge work. ENGINE: machinery and engineering.';
  segments('#uniform-bottom-options','uniformBottom',character.gender==='female'?[['skirt','Fitted black skirt']]:[['pants','Black pants']]);
  $('#uniform-bottom-note').textContent=character.gender==='female'?'Campus and both maritime uniforms use a fitted black skirt.':'Campus and both maritime uniforms use black pants.';
  segments('#body-options','body',[['slim','Slim'],['regular','Regular'],['broad','Broad']]);
  segments('#accessory-options','accessory',[['none','None'],['glasses','Glasses'],['cap','Cadet cap']]);
  $('#outfit-options').innerHTML=[['cadet','Campus uniform','#ffffff'],['maritime-white','Maritime white uniform','#f8faf7'],['maritime','Maritime navy uniform','#17344b'],['coverall','Workshop suit','#38566b'],['immersion','Immersion suit','#e96528']].map(([value,label,color])=>`<button class="outfit-card${character.outfit===value?' active':''}" data-value="${value}" aria-pressed="${character.outfit===value}"><span style="color:${color};filter:drop-shadow(0 1px 0 #92a294)">${icon('shirt')}</span>${label}</button>`).join('');
  updateCreatorMajor();
  $('#trait-options').onclick=e=>{const b=e.target.closest('[data-value]');if(b)choose('trait',b.dataset.value);};
  $('#hair-options').onclick=e=>{const b=e.target.closest('[data-value]');if(b)choose('hairStyle',b.dataset.value);};
  $('#outfit-options').onclick=e=>{const b=e.target.closest('[data-value]');if(b)choose('outfit',b.dataset.value);};
}
function choose(key,value){if(key==='major'&&academy?.getState()?.loma?.majorLocked&&value!==academy.getState().loma.major){toast('Your major is locked to the final set you started at Loma Lounge.');return;}creatorDirty=true;character[key]=value;character.uniformBottom=character.gender==='female'?'skirt':'pants';buildCreatorControls();world?.setCharacter(character);playTone();}
function updateCreatorMajor(){const engine=character.major==='engine',s=academy?.getState();$('.avatar-role').textContent=engine?'FUTURE CHIEF ENGINEER':'FUTURE CAPTAIN';$('.avatar-meta').textContent=`${s?.initialized?s.graduated?'Academy graduate':`Year ${s.year} · Semester ${s.term}`:'Year 1'} · ${engine?'ENGINE':'DECK'} cadet`;$('#creator-path-title').textContent=engine?'Engine officer pathway':'Deck officer pathway';$('#creator-path-copy').textContent=engine?'Your long-term destination: chief engineer.':'Your long-term destination: captain.';}

function updateCreator(){
  $('#cadet-name').value=character.name;$('#cadet-origin').value=character.origin;
  if(!$('#cadet-origin').value)$('#cadet-origin').value='Somewhere else';
  $('#preview-name').textContent=character.name;buildCreatorControls();
  $('#start-journey span:first-child').textContent=editing?'Save & return to campus':hasSave?'Continue my journey':'Begin my journey';
  $('#save-note').textContent='Your book journey saves to your signed-in academy account.';
  updateCreatorMajor();
  world?.setCharacter(character);
}
function selectTab(key){
  $$('.creator-tabs button').forEach(b=>{const selected=b.dataset.tab===key;b.classList.toggle('active',selected);b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;});
  $$('.tab-content').forEach(c=>{c.hidden=c.id!==`tab-${key}`;c.classList.toggle('active',!c.hidden);});
}
async function beginJourney(){
  const name=$('#cadet-name').value.trim();if(!name){$('#cadet-name').focus();toast('Give your cadet a name to begin.');return;}
  const wasEditing=editing||creatorDirty;character.name=name;character.origin=$('#cadet-origin').value;
  state.character=createState(character).character;character={...state.character};hasSave=true;editing=false;creatorDirty=false;
  mode='world';document.body.dataset.mode='world';$('#creator').hidden=true;$('#world-ui').hidden=false;
  updateChapter();world?.setCharacter(character);world?.setMode('world');world?.setZone(currentZone,positions[currentZone]);world?.setPosition(positions[currentZone]);if(engineAvailable)positions[currentZone]=world.getPosition();world?.setPaused(false);
  save();saveWorld();updateHUD();updateTouchState();await academy.start(character,{editing:wasEditing});
}
function editCadet(){closeDialog();mode='creator';editing=true;creatorDirty=false;character={...state.character};document.body.dataset.mode='creator';$('#creator').hidden=false;$('#world-ui').hidden=true;world?.setMode('creator');world?.setPaused(false);updateTouchState();updateCreator();}
function openDialog(title,eyebrow,html,key='info'){
  academy?.dispose();dialogKey=key;dialog.classList.toggle('map-dialog',key==='campus');dialog.classList.remove('academy-dialog');
  world?.setPaused(true);stopTouch();joystick?.setEnabled(false);window.speechSynthesis?.cancel();
  $('#dialog-title').textContent=title;$('#dialog-eyebrow').textContent=eyebrow;$('#dialog-body').innerHTML=html;
  if(!dialog.open)dialog.showModal();updateTouchState();dialog.scrollTop=0;paintIcons(dialog);
}
function closeDialog(){academy?.dispose();if(dialog.open)dialog.close();}
dialog.addEventListener('close',()=>{if(dialog.open)return;academy?.dispose();dialogKey='';$('#rpg-reward').hidden=true;clearTimeout(rewardTimer);world?.setPaused(document.hidden);stopTouch();updateTouchState();window.speechSynthesis?.cancel();if(mode==='world')$('#game-canvas').focus({preventScroll:true});});
$('#close-dialog').onclick=closeDialog;
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
function updateHUD(){
  $('#edit-cadet').textContent=Array.from(character.name)[0]?.toUpperCase()||'A';$('#edit-cadet').style.background=character.accent;
  $('#hud-energy').textContent=state.energy;$('#hud-energy').title=`Energy: ${state.energy} / 100`;
  if(academy?.renderHUD())return;
  $('#hud-name').textContent=character.name;$('#hud-year').textContent='Book journey · Connecting';$('#hud-level').textContent='LV 1';
  $('#xp-fill').style.width='0%';$('#xp-label').textContent=`${ACTIVITIES.length} book mini-games · 8 semesters`;
  $('#hud-day').textContent='Day 01';$('#hud-time').textContent='Weekly allowance loads with your account';
  $('#quest-title').textContent='Your Maritime English journey';$('#quest-summary').textContent='Connect your cadet to load missions and saved progress.';
  $('#quest-list').innerHTML='<div class="quest-row"><span></span><button id="connect-missions">Open the Academic Office</button></div>';
  $('#connect-missions').onclick=openJournal;
}
function updateChapter(){$('#chapter-label').innerHTML=`PHASE 01 <i>/</i> ${currentZone==='dorm'?'CADET DORMITORY':currentZone==='atlantic'?'ATLANTIC INTERIOR':'AMCOL CAMPUS'}`;}
function setNear(station){nearStation=station?.id||null;const d=stationDetails[nearStation];$('#mobile-interact').dataset.nearby=String(!!d);$('#interaction-prompt').hidden=!d||mode!=='world';if(d)$('#near-label').textContent=destinationIntent?.station===nearStation&&destinationIntent.courseId?getActivity(destinationIntent.courseId)?.title||d.label:d.label;}
function transferTo(zone,position=null){
  closeDialog();destinationIntent=null;currentZone=Object.hasOwn(districts,zone)?zone:'campus';
  positions[currentZone]=position||positions[currentZone]||{...districts[currentZone].spawn};
  cameraControls?.reset();world?.setZone(currentZone,positions[currentZone]);world?.setPosition(positions[currentZone]);if(engineAvailable)positions[currentZone]=world.getPosition();setNear(engineAvailable&&nearStation?stationDetails[nearStation]:null);updateChapter();updateHUD();saveWorld();
}
const atlanticEntrance=()=>{const s=STATIONS.find(station=>station.id==='atlantic');return {x:s.x,z:s.z};};
function leaveAtlantic(){transferTo('campus',atlanticEntrance());toast('You are outside Atlantic Building.');if(!engineAvailable)openCampus();}
function atlasTarget(id,courseId){
  const activity=courseId?getActivity(courseId):null;
  if(activity?.location==='atlantic')return ATLANTIC_STATIONS.find(station=>station.room===(activity.room||''))?.id||'atlantic-lobby';
  return ACTIVITY_LOCATIONS[id]||id;
}
function navigateToStation(physical){
  closeDialog();
  if(!engineAvailable){interact(physical);return;}
  if(world.canEnterStation&&!world.canEnterStation(physical,{notify:true}))return;
  if(!world.setDestination(physical)){destinationIntent=null;toast('Move onto a clear path, then choose your destination again.');return;}
  setNear(nearStation?stationDetails[nearStation]:null);
  $('#location-toast').textContent=`Walking to ${stationDetails[physical].name}`;$('#location-toast').hidden=false;setTimeout(()=>$('#location-toast').hidden=true,4000);
}
function walkTo(id,courseId=null){
  if(mode!=='world'){toast('Create your cadet and begin your journey to explore.');return;}
  if(id==='journey'||id==='harbor'){openJourney();return;}
  if(id==='dorm'){if(currentZone!=='dorm')transferTo('dorm',{...DORM.spawn});else closeDialog();academy.openDorm();return;}
  if(id==='dorm-return'){transferTo('campus',{...CAMPUS.spawn});toast('Welcome back to AMCOL. Your assignments are in the Academic Office.');if(!engineAvailable)openCampus();return;}
  if(id==='atlantic-return'){if(currentZone==='atlantic')leaveAtlantic();return;}
  let physical=atlasTarget(id,courseId);
  if(physical==='atlantic'&&currentZone==='atlantic')physical='atlantic-lobby';
  if(!stationDetails[physical])return;
  const targetZone=stationDetails[physical].zone||(physical.startsWith('dorm-')?'dorm':'campus');
  // Indoor visits begin at Atlantic's outside entrance. Interacting there
  // continues the saved route into the hall and toward the requested room.
  if(targetZone==='atlantic'&&currentZone!=='atlantic'){
    if(currentZone!=='campus')transferTo('campus',{...CAMPUS.spawn});
    destinationIntent={station:'atlantic',targetStation:physical,courseId};navigateToStation('atlantic');return;
  }
  if(targetZone!==currentZone)transferTo(targetZone,targetZone==='campus'&&currentZone==='atlantic'?atlanticEntrance():{...districts[targetZone].spawn});
  destinationIntent=courseId?{station:physical,courseId}:null;
  navigateToStation(physical);
}
function interact(id){
  if(mode!=='world')return;
  if(id==='dorm-return'||id==='atlantic-return'){walkTo(id);return;}
  playTone();
  if(engineAvailable&&world?.canEnterStation&&!world.canEnterStation(id,{notify:true}))return;
  const intent=destinationIntent?.station===id?destinationIntent:null;destinationIntent=null;
  if(id==='atlantic'){
    transferTo('atlantic',{...ATLANTIC.spawn});
    if(intent?.targetStation)walkTo(intent.targetStation,intent.courseId);
    else academy.openLocation('atlantic-lobby');
    return;
  }
  if(id.startsWith('npc-'))academy.openNPC(id.slice(4));else if(intent?.courseId)academy.openActivity(intent.courseId);else academy.openLocation(canonicalLocation(id));
  setNear(nearStation?stationDetails[nearStation]:null);
}
function trainingGate({stationId,requiredOutfit}){const courseId=destinationIntent?.station===stationId?destinationIntent.courseId:null;destinationIntent=null;academy.openWardrobe({requiredOutfit,returnTo:()=>walkTo(stationId,courseId)});}
function openJournal(){if(academy.ready&&!academy.getState()?.orientation?.completed)academy.openOrientation();else academy.openOffice();}
function openHelp(){academy.openHelp();}
function openSources(){academy.openBook(1);}
function openDorm(){academy.openDorm();}
function openCampus(){
  if(mode!=='world'){openJourney();return;}
  const atDorm=currentZone==='dorm',atAtlantic=currentZone==='atlantic';
  const stations=atDorm?DORM_STATIONS:atAtlantic?ATLANTIC_STATIONS:[...STATIONS,...SAFETY_STATIONS,...REST_STATIONS];
  const title=atDorm?'Cadet Dormitory':atAtlantic?'Inside Atlantic Building':'AMCOL Main Campus';
  const map=atDorm?renderDormMap(positions.dorm):atAtlantic?renderAtlanticMap(positions.atlantic):renderCampusMap(positions.campus);
  openDialog(title,'YOUR COLLEGE · YOUR JOURNEY',`<p class="dialog-copy">${engineAvailable?'Choose a destination and your cadet will walk there. Press <strong>E</strong> or tap <strong>Interact</strong> to enter or meet a teacher.':'Choose a destination to open its activities.'}</p><div class="amcol-map-scroll">${map}</div>${!atDorm&&!atAtlantic?`<div class="campus-focus-strip"><span>${icon('book')} <strong>Pacific · Right-side entrance</strong> Maths · Science · English</span><span>${icon('radio')} <strong>Enter Atlantic</strong> CEO office · Bridge · Engine · ECDIS · GMDSS</span></div>`:''}<div class="campus-grid">${stations.map(d=>`<button class="campus-location" data-campus="${d.id}"><span class="location-icon" style="--location-color:${d.color}">${icon(d.icon)}</span><span><strong>${escapeHTML(d.name)}</strong><small>${escapeHTML(d.subtitle||'')}</small></span><span>${icon('arrow-up-right')}</span></button>`).join('')}</div><div class="offsite-note"><span>${icon(atDorm||atAtlantic?'flag':'home')}</span><div><strong>${atDorm||atAtlantic?'AMCOL Main Campus':'Cadet Dormitory · Separate map'}</strong><p>${atAtlantic?'Leave through the Atlantic entrance and return to the college grounds.':atDorm?'Return for your book missions and campus life.':'PT, running, football, and your room for a new day.'}</p></div><button id="campus-transfer" class="text-button">${atAtlantic?'Exit Atlantic':'Travel'} ${icon('arrow-right')}</button></div><p class="campus-footnote">${atDorm?'This residence layout is a game arrangement, ready to be adjusted when the dormitory plan is supplied.':atAtlantic?'Visit Capt. Chalermvut in the CEO office, Capt. Jakk at the Bridge Simulator, and C/E Asawin with Engineer Gerald at the Engine Simulator, Tr. Duke in ECDIS, and Tr. Bank in GMDSS.':'Pacific’s entrance is on its right side. Meet Dr. Wayne, Tr. Aphisit, and Tr. Anne in front of the Dome stage. Tr. Amara welcomes you outside the Workshop. Both Loma buildings have entrances on each side.'}</p><div class="dialog-actions">${htmlButton('campus-center',atDorm?'Return to the dorm entrance':atAtlantic?'Return to Atlantic lobby':'Return to AMCOL entrance','secondary','compass')}${htmlButton('campus-missions','Missions & progress','primary','book')}</div>`,'campus');
  $$('[data-campus]',dialog).forEach(b=>{b.onclick=()=>walkTo(b.dataset.campus);if(b.tagName.toLowerCase()!=='button')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();walkTo(b.dataset.campus);}};});
  $('#campus-transfer').onclick=()=>walkTo(atAtlantic?'atlantic-return':atDorm?'dorm-return':'dorm');$('#campus-missions').onclick=openJournal;
  $('#campus-center').onclick=()=>{transferTo(currentZone,{...districts[currentZone].spawn});toast(atDorm?'Back at the dormitory entrance.':atAtlantic?'Back in Atlantic’s entrance hall.':'Back at the AMCOL entrance.');};
}
function openJourney(){
  const s=academy.getState(),year=s?.year||1;
  openDialog('A first day. A lifetime of horizons.',character.major==='engine'?'YOUR JOURNEY TO CHIEF ENGINEER':'YOUR JOURNEY TO CAPTAIN',`<p class="dialog-copy">Create your cadet and explore AMCOL. Your first chapter covers the complete <strong>Maritime English 3.17 Plus</strong> student book across four game years and eight semesters, plus staff missions in English, maths, science, and cadet life.</p><h3 class="section-heading">Phase 1 · The academy · Playable now</h3><div class="year-timeline">${['Joining & ship life','Watchkeeping & passage','Radio, port & cargo','Machinery & leadership'].map((n,i)=>`<div class="year-node ${s?.graduated||year>i+1?'done':year===i+1?'current':''}"><div class="year-dot">${s?.graduated||year>i+1?'✓':i+1}</div><strong>Year ${i+1}</strong><small>${n}</small></div>`).join('')}</div><div class="career-list"><div class="career-row"><span class="career-badge">${icon('book')}</span><div><h3>Student → academy graduate</h3><p>${ACTIVITIES.length} required book mini-games, ${NPC_MISSIONS.length} staff missions including Tr. Dream’s Year 2 sea-training review and optional challenges with Chief Engineer Asawin, Engineer Gerald, Tr. Amara, Tr. Bank, and Tr. Duke. Choose DECK or ENGINE and begin by meeting all ${NPCS.length} staff members. In Year 4, Semester 2, pass all 50 random Loma Lounge final games; at most five first completions per game day. Exercise and sleep at the dorm to begin a new game day.</p></div><span class="phase-pill">PLAYABLE</span></div>${[['ship','Shipboard cadet','Your first vessel, watch, and crew.'],...(character.major==='engine'?[['settings','Engine officer → second engineer','Machinery, maintenance, and leading an engineering team.'],['settings','Chief engineer','Lead the vessel’s engineering department.']]:[['compass','Deck officer → chief officer','Navigation, responsibility, and leading a team.'],['anchor','Captain','Bring your knowledge and crew together.']])].map(([sym,title,description])=>`<div class="career-row future"><span class="career-badge">${icon(sym)}</span><div><h3>${title}</h3><p>${description}</p></div><span class="phase-pill">FUTURE PHASE</span></div>`).join('')}</div><p class="campus-footnote">The eight-semester arrangement is the game’s learning progression. Completing it awards an in-game academy achievement.</p><div class="dialog-actions">${htmlButton('journey-book','View the course book','secondary','book')}${htmlButton('journey-return',mode==='world'?'Back to my adventure':'Create my cadet')}</div>`,'journey');$('#journey-return').onclick=closeDialog;$('#journey-book').onclick=openSources;
}
function openSettings(){
  openDialog('Make the journey yours.','GAME SETTINGS',`<div class="settings-row"><div><h3>Game sounds</h3><p>Gentle feedback for learning and milestones.</p></div><button id="sound-toggle" class="button secondary" aria-pressed="${prefs.sound}">${prefs.sound?'Sound on':'Sound off'}</button></div><div class="settings-row"><div><h3>Graphics quality</h3><p>Choose lighter graphics on a slower device.</p></div><select id="quality-select" aria-label="Graphics quality"><option value="high" ${prefs.quality==='high'?'selected':''}>Beautiful</option><option value="low" ${prefs.quality==='low'?'selected':''}>Lightweight</option></select></div><div class="settings-row"><div><h3>Export your academy record</h3><p>Download your responses and semester achievements.</p></div><button id="export-save" class="button secondary" ${!academy.ready?'disabled':''}>${icon('download')} Export</button></div><div class="settings-row"><div><h3>Import a character</h3><p>Reuse a cadet’s appearance from an earlier academy save.</p></div><button id="import-save" class="button secondary">${icon('upload')} Import</button><input id="save-file" type="file" accept=".json,application/json" hidden></div><div class="settings-row"><div><h3>A brand-new story</h3><p>Restart your book course. Used weekly resets stay on your account.</p></div><button id="new-game" class="button secondary">New journey</button></div><p class="settings-footnote">Your completed work, game day, and weekly allowance save to your academy account. Your map position, appearance preferences, and unsubmitted drafts also use this browser. Voice playback uses an available device voice.</p>${!storageOK?'<p class="save-warning">Local drafts cannot be saved in this browser. Submit completed work while connected.</p>':''}`,'settings');
  $('#sound-toggle').onclick=()=>{prefs.sound=!prefs.sound;savePrefs();$('#sound-toggle').textContent=prefs.sound?'Sound on':'Sound off';$('#sound-toggle').setAttribute('aria-pressed',prefs.sound);playTone('success');};
  $('#quality-select').onchange=e=>{prefs.quality=e.target.value;world?.setQuality(prefs.quality);savePrefs();};$('#export-save').onclick=()=>academy.exportRecord();$('#import-save').onclick=()=>$('#save-file').click();$('#save-file').onchange=e=>importSave(e.target.files[0]);$('#new-game').onclick=confirmNewJourney;
}
async function importSave(file){
  if(!file)return;if(file.size>12000000){toast('Choose an academy JSON record under 12 MB.');return;}
  let imported;try{const value=JSON.parse(await file.text());const raw=value.format==='seapath-book-record'?value.state?.profile:value.character;if(raw&&typeof raw.name==='string'&&raw.name.trim())imported=createState(raw).character;}catch{}
  if(!imported){toast('This file does not contain a cadet profile.');return;}
  openDialog('Bring this cadet aboard?','IMPORT CHARACTER',`<div class="soft-card"><strong>${escapeHTML(imported.name)}</strong><p>${escapeHTML(imported.origin)} · ${escapeHTML(imported.trait)}</p></div><p class="dialog-copy">Use this character’s name and appearance. Your academy account keeps its current semester, completed assignments, and weekly reset allowance.</p><div class="dialog-actions">${htmlButton('import-cancel','Cancel','secondary','')}${htmlButton('confirm-import','Use this character')}</div>`,'confirm-import');
  $('#import-cancel').onclick=openSettings;$('#confirm-import').onclick=async()=>{if(academy.ready){const result=await academy.updateProfile(imported);if(!result)return;}setProfile(imported);hasSave=true;save();closeDialog();updateCreator();updateHUD();toast(`Welcome, ${character.name}. Your academy progress is ready.`);};
}
function confirmNewJourney(){
  if(!academy.ready){toast('Connect your current cadet before starting a new book journey.');if(mode==='world')academy.start(character);return;}
  const s=academy.getState();
  openDialog('Ready for a new beginning?','NEW JOURNEY',`<p class="dialog-copy">Restart <strong>${escapeHTML(s.profile.name)}’s book course</strong> at Year 1, Semester 1. This replaces your current course answers and achievements. You have <strong>${s.week.remaining} of 5 day resets</strong> left this real week; starting again keeps that allowance.</p><div class="dialog-actions">${htmlButton('reset-export','Export my current record','secondary','download')}${htmlButton('reset-cancel','Keep my journey','secondary','')}${htmlButton('reset-confirm','Restart the book course','danger','')}</div>`,'confirm-reset');
  $('#reset-export').onclick=()=>academy.exportRecord();$('#reset-cancel').onclick=closeDialog;$('#reset-confirm').onclick=async()=>{const result=await academy.newJourney(character);if(!result)return;currentZone='campus';positions.campus={...CAMPUS.spawn};positions.dorm={...DORM.spawn};positions.atlantic={...ATLANTIC.spawn};saveWorld();editCadet();selectTab('identity');toast('Your new book journey is ready. Weekly resets keep their existing allowance.');};
}
function connectUI(){
  paintIcons();updateCreator();selectTab('identity');
  $('#cadet-name').oninput=e=>{creatorDirty=true;character.name=e.target.value;$('#preview-name').textContent=character.name.trim()||'Your cadet';};$('#cadet-origin').onchange=e=>{creatorDirty=true;character.origin=e.target.value;};
  $$('.creator-tabs [data-tab]').forEach((b,i)=>{b.onclick=()=>selectTab(b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const buttons=$$('.creator-tabs [data-tab]');const next=buttons[(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];selectTab(next.dataset.tab);next.focus();};});
  $('#randomize').onclick=()=>{creatorDirty=true;for(const [key,arr] of Object.entries({skin:skinColors.map(c=>c[0]),hairColor:hairColors.map(c=>c[0]),hairStyle:['crop','swept','bob','bun'],outfit:['cadet','maritime-white','maritime','coverall','immersion'],accent:accents.map(c=>c[0]),body:['slim','regular','broad'],accessory:['none','glasses','cap']}))character[key]=arr[Math.floor(Math.random()*arr.length)];buildCreatorControls();world?.setCharacter(character);playTone();};
  $('#rotate-left').onclick=()=>world?.rotateCharacter(-1);$('#rotate-right').onclick=()=>world?.rotateCharacter(1);$('#start-journey').onclick=beginJourney;
  $('#staff-btn').onclick=()=>academy.openStaff();$('#edit-cadet').onclick=()=>academy.openDashboard();$('#journey-btn').onclick=openJourney;$('#help-btn').onclick=openHelp;$('#settings-btn').onclick=openSettings;$('#campus-btn').onclick=openCampus;$('#journal-btn').onclick=()=>openJournal();$('#interaction-prompt').onclick=()=>nearStation&&interact(nearStation);$('#mobile-interact').onclick=()=>nearStation?interact(nearStation):toast('Walk near a teacher or learning station, or choose a destination from Campus.');
  $('#brand').onclick=e=>{e.preventDefault();openJourney();};
  $('#collapse-quest').onclick=()=>{const b=$('#quest-body');b.hidden=!b.hidden;$('#collapse-quest').setAttribute('aria-expanded',!b.hidden);$('#collapse-quest').setAttribute('aria-label',b.hidden?'Expand objectives':'Collapse objectives');$('#collapse-quest').innerHTML=icon(b.hidden?'plus':'minus');};
  if(matchMedia('(max-width:700px)').matches){$('#quest-body').hidden=true;$('#collapse-quest').setAttribute('aria-expanded','false');$('#collapse-quest').setAttribute('aria-label','Expand objectives');$('#collapse-quest').innerHTML=icon('plus');}
  joystick=mountJoystick($('#movement-joystick'),{enabled:false,onMove:(x,z)=>{touchVector={x,z};world?.setInput(x,z,mobileRun);}});
  $('#mobile-run').onclick=()=>{if(mode==='world'&&!dialog.open&&engineAvailable)setMobileRun(!mobileRun);};
  cameraControls=mountCameraControls([{left:$('#camera-left'),reset:$('#camera-reset'),right:$('#camera-right')},{left:$('#mobile-camera-left'),reset:$('#mobile-camera-reset'),right:$('#mobile-camera-right')}],{enabled:false,rotate:direction=>world?.rotateCamera(direction),setInput:direction=>world?.setCameraInput?.(direction),resetView:()=>world?.resetCamera?.()});
  window.addEventListener('blur',stopTouch);updateTouchState();
  window.addEventListener('keydown',e=>{if(mode!=='world'||dialog.open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(key==='m'){e.preventDefault();openCampus();}if(key==='j'){e.preventDefault();openJournal();}if(key==='c'){e.preventDefault();academy.openDashboard();}});
  window.addEventListener('beforeunload',()=>{save();saveWorld();academy.dispose();joystick?.destroy();cameraControls?.destroy();});document.addEventListener('visibilitychange',()=>{if(document.hidden){save();saveWorld();world?.setPaused(true);stopTouch();}else{world?.setPaused(dialog.open);if(academy.ready)academy.refresh();}updateTouchState();});
  $('#dismiss-fallback').onclick=()=>{$('#engine-fallback').hidden=true;toast('Learning mode is ready. Use Campus after creating your cadet.');};
}

function engineFailure(error){engineAvailable=false;updateTouchState();$('#loading').hidden=true;$('#engine-fallback').hidden=false;document.body.dataset.ready='true';console.warn('THE AMCOL WAY 3D view unavailable:',error?.message||error);if(mode==='world'){toast('The 3D view is unavailable. Every learning activity is accessible from Campus.');$('#engine-fallback').hidden=true;}}
academy=createAcademy({openDialog,dialog,closeDialog,toast,icon,editCadet,getCharacter:()=>({...character}),onProfile:setProfile,onState:updateHUD,onReward:showReward,goLocation:walkTo,getZone:()=>currentZone,openCampus,getWorld:()=>world,restoreEnergy,celebrate,playTone,afterSleep:()=>{save();saveWorld();}});
async function boot(){
  connectUI();
  try{
    const {SeaWorld}=await import('./world.js');
    world=new SeaWorld($('#game-canvas'),{onNear:setNear,onInteract:id=>{if(!dialog.open)interact(id);},onWorkshopBlocked:trainingGate,onLifeboatBlocked:trainingGate,onMove:pos=>{if(mode!=='world')return;positions[currentZone]={x:pos.x,z:pos.z};if(currentZone==='campus')state.position={...positions.campus};if(Date.now()-lastMoveSave>2500){lastMoveSave=Date.now();save();saveWorld();}},onError:engineFailure});
    engineAvailable=world.isReady;
    if(engineAvailable){world.setCharacter(character);world.setQuality(prefs.quality);world.setMode(mode);if(mode==='world'){world.setZone(currentZone,positions[currentZone]);world.setPosition(positions[currentZone]);positions[currentZone]=world.getPosition();}world.setPaused(dialog.open||document.hidden);$('#loading').hidden=true;}
  }catch(error){engineFailure(error);}
  document.body.dataset.ready='true';updateTouchState();
}
boot();
