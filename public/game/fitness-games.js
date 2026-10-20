// Input-driven dormitory games. These record a cadet's game activity, not
// the player's real-world exercise, health, or movement.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;
const TITLES={pt:'Cadet PT',run:'Track Checkpoints',football:'Target Football'};
const TOTALS={pt:8,run:8,football:5};

const person=`<g class="fitness-cadet-shadow"><ellipse cx="300" cy="329" rx="56" ry="10"/></g>
  <g data-pt-cadet><path class="fitness-limb fitness-trousers" d="M283 232L279 313M317 232L321 313"/>
  <path class="fitness-shoe" d="M279 315H263M321 315H338"/>
  <path class="fitness-torso" d="M270 151Q300 139 330 151L322 237H278Z"/>
  <path class="fitness-shirt-detail" d="M285 153L300 169L315 153M300 169V223"/>
  <g data-pt-left-arm transform="rotate(0 271 162)"><path class="fitness-limb fitness-sleeve" d="M271 162L249 197"/><path class="fitness-limb fitness-skin" d="M249 197L239 240"/></g>
  <g data-pt-right-arm transform="rotate(0 329 162)"><path class="fitness-limb fitness-sleeve" d="M329 162L351 197"/><path class="fitness-limb fitness-skin" d="M351 197L361 240"/></g>
  <path class="fitness-neck" d="M300 137V150"/><ellipse class="fitness-face" cx="300" cy="115" rx="29" ry="34"/>
  <path class="fitness-hair" d="M272 113Q266 73 299 77Q334 75 330 110L317 92Q294 103 278 99Z"/>
  <circle class="fitness-eye" cx="290" cy="116" r="2.6"/><circle class="fitness-eye" cx="310" cy="116" r="2.6"/>
  <path class="fitness-smile" d="M291 132Q300 138 309 132"/></g>`;

/**
 * PT rhythm track. Hold-notes slide towards a hit line: press when a note's front edge reaches
 * the line, keep holding while the bar passes, and release when its back edge crosses the line.
 * Times are in milliseconds; the track is pure so it can be tested without a clock or DOM.
 */
export const PT_RHYTHM=Object.freeze({leadIn:900,travel:2200,gap:900,perfect:120,good:260,
  holds:Object.freeze([700,1000,850,1200,750,1100,900,1300])});
const JUDGE_POINTS={perfect:100,good:70,miss:0};
export function createPtRhythm(start,{total=8}={}){
  const notes=[];let nextHead=start+PT_RHYTHM.leadIn+PT_RHYTHM.travel,hits=0,misses=0,combo=0,bestCombo=0,points=0,judged=0;
  const add=()=>{const hold=PT_RHYTHM.holds[notes.length%PT_RHYTHM.holds.length];notes.push({id:notes.length,head:nextHead,tail:nextHead+hold,hold,state:'waiting'});nextHead+=hold+PT_RHYTHM.gap;};
  const fill=now=>{while(hits<total&&(notes.length<3||notes.at(-1).head<now+PT_RHYTHM.travel*1.6))add();};
  const judge=error=>Math.abs(error)<=PT_RHYTHM.perfect?'perfect':Math.abs(error)<=PT_RHYTHM.good?'good':'miss';
  const settle=(note,release,reason)=>{
    note.state='done';note.release=release;note.reason=reason;judged++;points+=JUDGE_POINTS[note.press||'miss']+JUDGE_POINTS[release];
    const hit=note.press&&note.press!=='miss'&&release!=='miss';note.result=hit?'hit':'miss';
    if(hit){hits++;combo++;bestCombo=Math.max(bestCombo,combo);}else{misses++;combo=0;}
    return {type:hit?'hit':'miss',note,press:note.press||'miss',release,reason};
  };
  fill(start);
  return {
    notes,
    get hits(){return hits;},get misses(){return misses;},get combo(){return combo;},get bestCombo(){return bestCombo;},
    get done(){return hits>=total;},
    /** Average timing accuracy over every judged press and release, 0–100. */
    get score(){return judged?Math.round(points/(judged*2)):0;},
    held(){return notes.find(note=>note.state==='held')||null;},
    press(now){
      if(hits>=total||this.held())return null;
      const note=notes.find(n=>n.state==='waiting');
      if(!note)return null;
      if(note.head-now>PT_RHYTHM.good)return {type:'early',note};
      note.state='held';note.press=judge(now-note.head);note.pressedAt=now;
      return {type:'press',note,press:note.press};
    },
    release(now){
      const note=this.held();if(!note)return null;
      if(now<note.tail-PT_RHYTHM.good)return settle(note,'miss','early-release');
      return settle(note,judge(now-note.tail),'release');
    },
    /** Advances time: notes nobody pressed, or held too long, become misses. */
    update(now){
      const events=[];
      for(const note of notes){
        if(note.state==='waiting'&&now>note.head+PT_RHYTHM.good){note.press='miss';events.push(settle(note,'miss','missed'));}
        else if(note.state==='held'&&now>note.tail+PT_RHYTHM.good)events.push(settle(note,'miss','held-too-long'));
      }
      fill(now);return events;
    },
  };
}

/**
 * Mount one exercise game into an existing modal region.
 * onComplete is emitted exactly once after all required actions are achieved.
 * Host must invoke returned cleanup when closing/replacing its dialog.
 */
export function mountFitness(container,{kind='pt',onComplete,onCancel}={}){
  if(!container?.querySelector)throw new TypeError('A fitness game container is required.');
  if(!Object.hasOwn(TITLES,kind))throw new RangeError('Unknown fitness game.');
  const total=TOTALS[kind],off=[];
  let disposed=false,complete=false,raf=0,lastFrame=0,tick=()=>{};
  let count=0,score=0;
  const reduced=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  container.innerHTML=`<section class="fitness-game" data-fitness-kind="${kind}" tabindex="0" aria-label="${TITLES[kind]}">
    <div class="fitness-heading"><div><span class="fitness-eyebrow">DORMITORY · DAILY EXERCISE</span><h3>${TITLES[kind]}</h3></div><span class="fitness-count" data-fitness-count>0 / ${total}</span></div>
    <p class="fitness-instructions" data-fitness-instructions></p>
    <div class="fitness-progress-row"><progress data-fitness-progress max="${total}" value="0" aria-label="Exercise progress"></progress><span data-fitness-unit></span></div>
    <div class="fitness-scene" data-fitness-scene></div>
    <div class="fitness-controls" data-fitness-controls></div>
    <p class="fitness-live" data-fitness-live role="status" aria-live="polite">Ready when you are.</p>
    <div class="fitness-footer"><label class="fitness-mode"><input type="checkbox" data-fitness-relaxed ${reduced?'checked':''}><span data-fitness-mode-label>Untimed steps</span></label><button type="button" class="fitness-back" data-fitness-cancel>Back to dormitory</button></div>
  </section>`;
  const root=container.querySelector('.fitness-game');
  const $=selector=>root.querySelector(selector);
  const scene=$('[data-fitness-scene]'),controls=$('[data-fitness-controls]');
  const relaxed=$('[data-fitness-relaxed]');
  const listen=(node,event,handler,options)=>{node.addEventListener(event,handler,options);off.push(()=>node.removeEventListener(event,handler,options));};
  const status=(message,type='')=>{const node=$('[data-fitness-live]');node.textContent=message;node.dataset.tone=type;};
  const progress=()=>{$('[data-fitness-count]').textContent=`${count} / ${total}`;$('[data-fitness-progress]').value=count;};
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);for(const fn of off)fn();off.length=0;};
  const finish=finalScore=>{
    if(disposed||complete||count<total)return;
    complete=true;score=clamp(Math.round(finalScore),1,100);cancelAnimationFrame(raf);
    root.classList.add('fitness-complete');
    for(const button of controls.querySelectorAll('button,input'))button.disabled=true;
    relaxed.disabled=true;
    status(`Exercise complete! ${count} ${kind==='pt'?'repetitions':kind==='run'?'checkpoints':'goals'}. You can now return to your room to sleep.`,'success');
    const reward=document.createElement('div');reward.className='fitness-result';
    reward.innerHTML=`<span aria-hidden="true">✓</span><div><strong>Daily exercise complete</strong><p>Your cadet is ready for rest.</p></div><b>${score}<small> / 100</small></b>`;
    scene.after(reward);
    onComplete?.({kind,score,completed:true,completedCount:count,total});
  };
  listen($('[data-fitness-cancel]'),'click',()=>{if(disposed)return;cleanup();onCancel?.();});
  listen(window,'blur',()=>{lastFrame=0;});
  const frame=now=>{
    if(disposed||complete)return;
    const dt=lastFrame?Math.min(.05,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;
    tick(now,document.hidden?0:dt);
    if(!disposed&&!complete)raf=requestAnimationFrame(frame);
  };

  if(kind==='pt'){
    $('[data-fitness-instructions]').textContent='Keep the beat for eight repetitions. Bars slide towards the gold line: press Lift as a bar’s front edge reaches the line, hold while it passes, and release as its end crosses the line. Choose Untimed steps to lift and lower at your own pace.';
    $('[data-fitness-unit]').textContent='repetitions';
    scene.innerHTML=`<svg viewBox="0 0 600 365" role="img" aria-label="A cadet exercising in the PT yard"><rect class="fitness-sky" width="600" height="365"/><path class="fitness-yard" d="M0 275H600V365H0Z"/><path class="fitness-yard-line" d="M35 317H565M100 365L188 275M500 365L412 275"/><path class="fitness-mat" d="M243 309H357L380 345H220Z"/><g class="fitness-plant"><path d="M74 275V177M74 180Q25 143 23 193M74 180Q121 140 127 193M74 180Q43 176 40 217M74 180Q109 176 111 217"/></g>${person}<g class="fitness-pt-guide"><text x="479" y="121" text-anchor="middle">LIFT</text><path d="M479 179V140M467 153L479 140L491 153"/><text x="479" y="228" text-anchor="middle">LOWER</text><path d="M479 240V279M467 267L479 279L491 267"/></g></svg>`;
    controls.innerHTML=`<div class="pt-rhythm" data-pt-rhythm aria-hidden="true"><div class="pt-lane" data-pt-lane><div class="pt-hit-line"><span>LIFT</span></div><div class="pt-notes" data-pt-notes></div></div><div class="pt-judge" data-pt-judge></div><div class="pt-combo" data-pt-combo></div></div><p class="fitness-meter-label" data-pt-cue>Press as a bar reaches the gold line</p><button type="button" class="fitness-primary fitness-hold" data-pt-hold>Start PT</button>`;
    let raised=false,track=null,base=0,pressedAt=0,releasedAt=0,judgeTimer=0;
    const HIT_X=16,speed=(100-HIT_X)/PT_RHYTHM.travel,noteEls=new Map();
    const button=$('[data-pt-hold]'),cue=$('[data-pt-cue]'),notesLayer=$('[data-pt-notes]'),judgeEl=$('[data-pt-judge]'),comboEl=$('[data-pt-combo]');
    const pose=value=>{$('[data-pt-left-arm]').setAttribute('transform',`rotate(${value*136} 271 162)`);$('[data-pt-right-arm]').setAttribute('transform',`rotate(${-value*136} 329 162)`);};
    const LABELS={perfect:'PERFECT',good:'GOOD',miss:'MISS'};
    const flash=(text,tone)=>{judgeEl.textContent=text;judgeEl.dataset.tone=tone;judgeEl.classList.remove('pop');void judgeEl.offsetWidth;judgeEl.classList.add('pop');clearTimeout(judgeTimer);judgeTimer=setTimeout(()=>{judgeEl.textContent='';},900);};
    const showCombo=()=>{comboEl.textContent=track?.combo>1?`${track.combo} combo`:'';};
    const handle=event=>{
      if(!event)return;
      if(event.type==='early'){flash('TOO EARLY','retry');status('Too early — wait until the bar’s front edge reaches the gold line.','retry');return;}
      if(event.type==='press'){pressedAt=performance.now();button.classList.add('is-held');button.textContent='Holding… release at the end';flash(LABELS[event.press],event.press);return;}
      button.classList.remove('is-held');button.textContent='Hold Lift';if(event.note.pressedAt)releasedAt=performance.now();
      if(event.type==='hit'){
        count=base+track.hits;progress();flash(event.release==='perfect'&&event.press==='perfect'?'PERFECT REP':LABELS[event.release],'success');
        status(`Repetition ${count} of ${total} — on the beat.`,'success');
        if(track.done)finish(Math.max(1,track.score));
      }else{
        const why={missed:'Missed — press as the bar reaches the line.','early-release':'Released too soon — hold until the bar’s end crosses the line.','held-too-long':'Held too long — release as the bar’s end crosses the line.'}[event.reason]||'Keep the beat.';
        flash('MISS','retry');status(why,'retry');
      }
      showCombo();
    };
    const startTrack=()=>{base=count;track=createPtRhythm(performance.now(),{total:total-count});button.textContent='Hold Lift';status('Here comes the beat. Press as a bar reaches the gold line, hold, and release at its end.');};
    const press=()=>{if(disposed||complete||relaxed.checked)return;if(!track){startTrack();return;}handle(track.press(performance.now()));};
    const release=()=>{if(disposed||complete||relaxed.checked||!track)return;const event=track.release(performance.now());if(event){handle(event);}};
    const clearNotes=()=>{notesLayer.replaceChildren();noteEls.clear();judgeEl.textContent='';comboEl.textContent='';};
    const changeMode=()=>{raised=false;track=null;clearNotes();button.classList.remove('is-held');pose(0);button.textContent=relaxed.checked?'Lift':'Start PT';cue.textContent=relaxed.checked?'Lift, then lower — no timer':'Press as a bar reaches the gold line';controls.classList.toggle('fitness-untimed',relaxed.checked);status(relaxed.checked?'Choose Lift, then Lower, to complete each repetition at your own pace.':'Choose Start PT, then keep the beat: press, hold, release.');};
    listen(button,'pointerdown',event=>{if(relaxed.checked)return;event.preventDefault();button.setPointerCapture?.(event.pointerId);press();});
    listen(button,'pointerup',event=>{if(relaxed.checked)return;event.preventDefault();release();});
    listen(button,'pointercancel',()=>release());
    listen(button,'keydown',event=>{if(relaxed.checked||![' ','Enter'].includes(event.key))return;event.preventDefault();if(!event.repeat)press();});
    listen(button,'keyup',event=>{if(relaxed.checked||![' ','Enter'].includes(event.key))return;event.preventDefault();release();});
    listen(button,'click',()=>{
      if(!relaxed.checked||complete||disposed)return;
      raised=!raised;pose(raised?1:0);button.textContent=raised?'Lower':'Lift';
      if(raised)status('Raised position. Choose Lower to finish the repetition.');
      else{count++;progress();status(`Repetition ${count} of ${total} complete.`,'success');if(count===total)finish(100);}
    });
    listen(relaxed,'change',changeMode);
    listen(window,'blur',()=>{if(!relaxed.checked)release();});
    tick=now=>{
      if(relaxed.checked||!track)return;
      for(const event of track.update(now))handle(event);
      if(complete||!track)return;
      // Draw every bar: its front edge reaches the gold line at note.head, its end at note.tail.
      for(const note of track.notes){
        const left=HIT_X+(note.head-now)*speed,width=note.hold*speed;
        let el=noteEls.get(note.id);
        const gone=note.state==='done'&&now-(note.doneAt??=now)>650;
        if(gone||left>104){if(el&&gone){el.remove();noteEls.delete(note.id);}continue;}
        if(!el){el=document.createElement('div');el.className='pt-note';el.innerHTML='<i></i>';notesLayer.append(el);noteEls.set(note.id,el);}
        el.style.left=`${left}%`;el.style.width=`${width}%`;
        el.dataset.state=note.state==='done'?note.result:note.state;
        // Near the line the bar glows so the press moment is easy to read.
        el.classList.toggle('is-due',note.state==='waiting'&&Math.abs(note.head-now)<=PT_RHYTHM.good);
        el.classList.toggle('is-ending',note.state==='held'&&Math.abs(note.tail-now)<=PT_RHYTHM.good);
      }
      const held=track.held();
      // Arms rise over 260 ms after a press and lower over 260 ms after a release.
      pose(held?Math.min(1,(now-pressedAt)/260):releasedAt>pressedAt?Math.max(0,1-(now-releasedAt)/260):0);
      cue.textContent=held?(Math.abs(held.tail-now)<=PT_RHYTHM.good?'Release now!':'Hold… release at the end of the bar'):'Press as a bar reaches the gold line';
    };
    changeMode();
  }

  if(kind==='run'){
    $('[data-fitness-instructions]').textContent='Run two laps and pass eight checkpoints. Choose the highlighted lane before each checkpoint. Run follows the track; change lanes with the buttons or Left/Right arrows. Untimed strides lets you advance one step at a time.';
    $('[data-fitness-unit]').textContent='checkpoints';$('[data-fitness-mode-label]').textContent='Untimed strides';
    scene.innerHTML=`<svg viewBox="0 0 600 400" role="img" aria-label="Running track with three lanes and eight checkpoints"><rect class="fitness-sky" width="600" height="400"/><ellipse class="fitness-track" cx="300" cy="200" rx="250" ry="164"/><ellipse class="fitness-infield" cx="300" cy="200" rx="170" ry="94"/><g class="fitness-track-lines"><ellipse cx="300" cy="200" rx="237" ry="152"/><ellipse cx="300" cy="200" rx="210" ry="128"/><ellipse cx="300" cy="200" rx="183" ry="105"/></g><path class="fitness-field-line" d="M215 148H385V251H215ZM300 148V251"/><circle class="fitness-field-line" cx="300" cy="200" r="24"/><text class="fitness-lap-title" x="300" y="174" text-anchor="middle" data-run-lap>LAP 1 OF 2</text><text class="fitness-lap-copy" x="300" y="226" text-anchor="middle" data-run-next>Next: outer lane</text><g class="fitness-checkpoint" data-run-checkpoint><circle r="24"/><text text-anchor="middle" y="6" data-run-checkpoint-number>1</text></g><g class="fitness-runner" data-run-runner><circle class="fitness-runner-halo" r="18"/><circle class="fitness-runner-body" r="11"/><path d="M-5 2L0-5L5 2M0-5V8"/></g></svg>`;
    controls.innerHTML=`<div class="fitness-lane-heading"><strong data-run-target>Checkpoint 1 · choose Outer</strong><span data-run-distance>0 / 2 laps</span></div><div class="fitness-lanes" role="group" aria-label="Running lanes"><button type="button" data-run-lane="0">Inner</button><button type="button" data-run-lane="1" aria-pressed="true">Middle</button><button type="button" data-run-lane="2">Outer</button></div><button type="button" class="fitness-primary" data-run-toggle>Run</button>`;
    const targets=[2,0,1,2,1,0,2,1],names=['Inner','Middle','Outer'];
    let lane=1,distance=0,running=false,blockedGate=false;
    const runButton=$('[data-run-toggle]');
    const radii=[{x:183,y:105},{x:210,y:128},{x:237,y:152}];
    const at=(step,which)=>{const a=-step*Math.PI/2,r=radii[which];return{x:300+Math.sin(a)*r.x,y:200+Math.cos(a)*r.y};};
    const draw=()=>{
      const p=at(distance,lane);$('[data-run-runner]').setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      const gate=at(count+1,targets[Math.min(count,7)]);$('[data-run-checkpoint]').setAttribute('transform',`translate(${gate.x.toFixed(2)} ${gate.y.toFixed(2)})`);
      $('[data-run-checkpoint-number]').textContent=String(Math.min(8,count+1));
      $('[data-run-lap]').textContent=`LAP ${Math.min(2,Math.floor(count/4)+1)} OF 2`;
      $('[data-run-next]').textContent=count<8?`Next: ${names[targets[count]].toLowerCase()} lane`:'Two laps complete';
      $('[data-run-distance]').textContent=`${Math.min(2,distance/4).toFixed(1)} / 2 laps`;
      $('[data-run-target]').textContent=count<8?`Checkpoint ${count+1} · choose ${names[targets[count]]}`:'All checkpoints complete';
      for(const node of controls.querySelectorAll('[data-run-lane]')){
        const index=Number(node.dataset.runLane);node.setAttribute('aria-pressed',String(lane===index));node.classList.toggle('is-target',index===targets[count]);
      }
      runButton.textContent=relaxed.checked?'Run one stride':running?'Pause running':'Run';
    };
    const advance=amount=>{
      if(disposed||complete)return;
      const next=count+1,candidate=Math.min(next,distance+amount);
      if(candidate>=next-.00001){
        if(lane!==targets[count]){
          distance=Math.max(distance,next-.08);running=false;blockedGate=true;
          status(`Checkpoint ${count+1} needs the ${names[targets[count]].toLowerCase()} lane. Change lanes, then continue.`,'retry');
        }else{
          distance=next;count++;blockedGate=false;progress();
          if(count===total){running=false;draw();finish(100);return;}
          status(`Checkpoint ${count} reached. Next, choose the ${names[targets[count]].toLowerCase()} lane.`,'success');
        }
      }else distance=candidate;
      draw();
    };
    const chooseLane=value=>{
      if(disposed||complete)return;lane=clamp(value,0,2);
      if(blockedGate&&lane===targets[count]){blockedGate=false;status('Correct lane. Continue to pass the checkpoint.');}
      draw();
    };
    for(const button of controls.querySelectorAll('[data-run-lane]'))listen(button,'click',()=>chooseLane(Number(button.dataset.runLane)));
    listen(runButton,'click',()=>{if(disposed||complete)return;if(relaxed.checked){advance(.25);return;}running=!running;draw();if(running)status('Running. Watch the highlighted lane for the next checkpoint.');});
    listen(root,'keydown',event=>{
      if(event.target?.matches?.('input'))return;
      if(['ArrowLeft','a','A','ArrowRight','d','D'].includes(event.key)){
        event.preventDefault();if(!event.repeat)chooseLane(lane+(['ArrowLeft','a','A'].includes(event.key)?-1:1));
      }
      if(['ArrowUp','w','W'].includes(event.key)){
        event.preventDefault();if(relaxed.checked){if(!event.repeat)advance(.25);}else{running=true;draw();}
      }
    });
    listen(root,'keyup',event=>{if(['ArrowUp','w','W'].includes(event.key)&&!relaxed.checked){running=false;draw();}});
    listen(relaxed,'change',()=>{running=false;draw();status(relaxed.checked?'Choose a lane and use Run one stride to advance at your own pace.':'Choose the highlighted lane, then Run.');});
    listen(window,'blur',()=>{running=false;draw();});
    listen(document,'visibilitychange',()=>{if(document.hidden){running=false;draw();}});
    tick=(_now,dt)=>{if(running&&!relaxed.checked&&dt>0)advance(dt*.57);};
    draw();status('Choose the Outer lane and start your first lap.');
  }

  if(kind==='football'){
    $('[data-fitness-instructions]').textContent='Score five target goals. Tap or drag inside the goal to aim, or use the aim sliders and arrow keys. Shoot when the crosshair is inside the highlighted ring. Misses can be retried.';
    $('[data-fitness-unit]').textContent='target goals';$('[data-fitness-mode-label]').textContent='Reduced animation';
    scene.innerHTML=`<svg class="fitness-football-svg" data-football-svg viewBox="0 0 600 400" role="img" aria-label="Football goal. Tap or drag inside the goal to aim"><rect class="fitness-sky" width="600" height="400"/><path class="fitness-grass" d="M0 206H600V400H0Z"/><path class="fitness-pitch-line" d="M45 400L125 225H475L555 400"/><path class="fitness-goal-shadow" d="M91 64H509V227H91Z"/><path class="fitness-net" d="M95 62H505V223H95ZM146 62V223M197 62V223M248 62V223M299 62V223M350 62V223M401 62V223M452 62V223M95 103H505M95 143H505M95 183H505"/><path class="fitness-goal-frame" d="M90 230V58H510V230"/><g class="fitness-football-target" data-football-target><circle class="fitness-target-halo" r="34"/><circle class="fitness-target-ring" r="25"/><text text-anchor="middle" y="6" data-football-target-number>1</text></g><path class="fitness-aim-line" data-football-line d="M300 339L300 140"/><g class="fitness-crosshair" data-football-aim transform="translate(300 140)"><circle r="12"/><path d="M-19 0H19M0-19V19"/></g><g class="fitness-ball" data-football-ball transform="translate(300 339)"><circle r="14"/><path d="M-4-6L5-5L8 3L0 8L-8 1ZM-4-6L-5-12M5-5L11-8M8 3L13 6M0 8L0 13M-8 1L-13 3"/></g></svg>`;
    controls.innerHTML=`<div class="fitness-aim-controls"><label>Left / right<input type="range" min="112" max="488" step="1" value="300" data-football-x aria-label="Horizontal aim"></label><label>High / low<input type="range" min="78" max="209" step="1" value="140" data-football-y aria-label="Vertical aim"></label></div><div class="fitness-lane-heading"><strong data-football-prompt>Target 1 · upper left</strong><span data-football-attempts>0 shots</span></div><button type="button" class="fitness-primary" data-football-shoot>Shoot</button>`;
    const targets=[{x:156,y:100,label:'upper left'},{x:448,y:193,label:'lower right'},{x:300,y:98,label:'upper centre'},{x:163,y:191,label:'lower left'},{x:441,y:103,label:'upper right'}];
    const svg=$('[data-football-svg]'),xInput=$('[data-football-x]'),yInput=$('[data-football-y]'),shoot=$('[data-football-shoot]');
    let x=300,y=140,attempts=0,shot=null,dragging=false;
    const draw=()=>{
      const target=targets[Math.min(count,4)];$('[data-football-target]').setAttribute('transform',`translate(${target.x} ${target.y})`);
      $('[data-football-target-number]').textContent=String(Math.min(5,count+1));
      $('[data-football-prompt]').textContent=count<5?`Target ${count+1} · ${target.label}`:'All five targets scored';
      $('[data-football-attempts]').textContent=`${attempts} ${attempts===1?'shot':'shots'}`;
      $('[data-football-aim]').setAttribute('transform',`translate(${x} ${y})`);
      $('[data-football-line]').setAttribute('d',`M300 339L${x} ${y}`);xInput.value=String(x);yInput.value=String(y);
    };
    const aim=(newX,newY)=>{if(disposed||complete||shot)return;x=clamp(Math.round(newX),112,488);y=clamp(Math.round(newY),78,209);draw();};
    const aimPointer=event=>{
      const r=svg.getBoundingClientRect();if(!r.width||!r.height)return;
      const scale=Math.min(r.width/600,r.height/400),offsetX=(r.width-600*scale)/2,offsetY=(r.height-400*scale)/2;
      aim((event.clientX-r.left-offsetX)/scale,(event.clientY-r.top-offsetY)/scale);
    };
    const resolveShot=()=>{
      if(!shot||disposed||complete)return;const hit=shot.hit;shot=null;shoot.disabled=false;
      $('[data-football-ball]').setAttribute('transform','translate(300 339)');
      if(hit){count++;progress();status(`Goal! ${count} of ${total} targets scored.`,'success');draw();if(count===total)finish(Math.max(60,100*total/attempts));}
      else{status('Just wide of the target. Move the crosshair inside the highlighted ring and try again.','retry');draw();}
    };
    const takeShot=()=>{
      if(disposed||complete||shot)return;
      const target=targets[count];attempts++;shot={x,y,started:performance.now(),hit:Math.hypot(x-target.x,y-target.y)<=25};shoot.disabled=true;draw();
      if(relaxed.checked)resolveShot();
    };
    listen(xInput,'input',()=>aim(Number(xInput.value),y));listen(yInput,'input',()=>aim(x,Number(yInput.value)));
    listen(svg,'pointerdown',event=>{if(shot||complete)return;event.preventDefault();dragging=true;svg.setPointerCapture?.(event.pointerId);aimPointer(event);});
    listen(svg,'pointermove',event=>{if(dragging)aimPointer(event);});
    listen(svg,'pointerup',()=>{dragging=false;});listen(svg,'pointercancel',()=>{dragging=false;});
    listen(shoot,'click',takeShot);
    listen(root,'keydown',event=>{
      if(event.target?.matches?.('input'))return;
      const movement={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-7],ArrowDown:[0,7]}[event.key];
      if(movement){event.preventDefault();aim(x+movement[0],y+movement[1]);}
    });
    listen(relaxed,'change',()=>{if(relaxed.checked&&shot)resolveShot();});
    tick=now=>{
      if(!shot)return;const t=clamp((now-shot.started)/440,0,1);
      const bx=300+(shot.x-300)*t,by=339+(shot.y-339)*t-35*Math.sin(t*Math.PI),scale=1-t*.38;
      $('[data-football-ball]').setAttribute('transform',`translate(${bx.toFixed(2)} ${by.toFixed(2)}) scale(${scale.toFixed(3)})`);
      if(t>=1)resolveShot();
    };
    draw();status('Move the crosshair to the upper-left target and shoot.');
  }

  root.focus({preventScroll:true});
  raf=requestAnimationFrame(frame);
  return cleanup;
}
