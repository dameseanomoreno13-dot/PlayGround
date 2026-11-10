(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);
  const ui = { score: $('score'), lives: $('lives'), wave: $('wave'), best: $('best'), overlay: $('overlay'), title: $('overlay-title'), copy: $('overlay-copy'), button: $('main-button'), status: $('status-text'), sound: $('sound-toggle') };
  const keyState = Object.create(null);
  let touchFire = false, audio = null, muted = false;
  let best = Number(localStorage.getItem('ultimaOrbitaRecord') || 0);
  ui.best.textContent = String(best).padStart(5, '0');
  const stars = Array.from({length: 62}, () => ({x:Math.random()*W,y:Math.random()*H,s:Math.random()<.17?2:1,v:12+Math.random()*38,a:.25+Math.random()*.7}));
  let state = 'title', score = 0, lives = 3, sector = 1, elapsed = 0, spawnClock = 0, crystalClock = 7, shotClock = 0, invulnerable = 0;
  let player = {x:W/2,y:H-30,speed:122};
  let rocks = [], bullets = [], crystals = [], particles = [];
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  function tone(freq, duration=.08, type='square', volume=.035) {
    if (muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc=audio.createOscillator(), gain=audio.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,audio.currentTime);
      gain.gain.setValueAtTime(volume,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);
    } catch (_) {}
  }
  function updateHud() {
    ui.score.textContent = String(score).padStart(5,'0');
    ui.lives.textContent = '♥ '.repeat(Math.max(0,lives)).trim() || '—';
    ui.lives.setAttribute('aria-label', `${lives} vidas`);
    ui.wave.textContent = String(sector).padStart(2,'0');
    ui.best.textContent = String(best).padStart(5,'0');
  }
  function showOverlay(title, copy, button, status) {
    ui.title.textContent=title; ui.copy.textContent=copy; ui.button.innerHTML=`${button} <span>▶</span>`;
    ui.status.textContent=status; ui.overlay.classList.remove('hidden');
  }
  function startGame() {
    score=0;lives=3;sector=1;elapsed=0;spawnClock=.5;crystalClock=5;shotClock=0;invulnerable=0;
    player={x:W/2,y:H-31,speed:122}; rocks=[];bullets=[];crystals=[];particles=[];
    state='playing';ui.overlay.classList.add('hidden');ui.status.textContent='SECTOR 01 · EN CURSO';
    updateHud();tone(520,.08);setTimeout(()=>tone(740,.12),90);
  }
  function pauseGame() {
    if(state==='playing'){state='paused';showOverlay('PAUSA',`Puntuación actual: ${score}. Tu misión está en pausa.`,`CONTINUAR`,'MISIÓN EN PAUSA');}
    else if(state==='paused'){state='playing';ui.overlay.classList.add('hidden');ui.status.textContent=`SECTOR ${String(sector).padStart(2,'0')} · EN CURSO`;}
  }
  function gameOver() {
    state='over';
    if(score>best){best=score;localStorage.setItem('ultimaOrbitaRecord',String(best));}
    updateHud();showOverlay('MISIÓN TERMINADA',`Has conseguido ${score} puntos en el sector ${String(sector).padStart(2,'0')}. Récord: ${best}.`,'VOLVER A JUGAR','SEÑAL PERDIDA');tone(130,.4,'sawtooth',.045);
  }
  function spawnRock() {
    const r=rand(7,13), x=rand(r,W-r);
    rocks.push({x,y:-r-2,r,v:rand(34,53)+sector*4,drift:rand(-16,16),rot:rand(0,6.28),spin:rand(-1.3,1.3),hp:r>11?2:1,shape:Array.from({length:8},()=>rand(.72,1.18))});
  }
  function spawnCrystal() {crystals.push({x:rand(13,W-13),y:-10,v:rand(30,43),phase:rand(0,7)});}
  function burst(x,y,color,n=8) {for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),v=rand(20,88);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:rand(.22,.55),max:.55,color});}}
  function fire() {
    if(shotClock>0)return;
    bullets.push({x:player.x,y:player.y-10,v:205});shotClock=.19;tone(440,.045,'square',.018);
  }
  function hurt() {
    if(invulnerable>0)return;
    lives--;invulnerable=1.35;burst(player.x,player.y,'#ff6482',11);tone(180,.18,'sawtooth',.045);updateHud();
    if(lives<=0)gameOver();
  }
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function drawShip(x,y,blink=false) {
    if(blink && Math.floor(performance.now()/90)%2===0)return;
    // Nave de combate dibujada en bloques de píxeles.
    rect(x-2,y+9,4,5,'#ff9b54');rect(x-1,y+10,2,4,'#ffe080');
    rect(x-7,y+2,4,6,'#ed5575');rect(x+3,y+2,4,6,'#ed5575');
    rect(x-5,y-3,10,12,'#d7e8ee');rect(x-3,y-7,6,8,'#d7e8ee');
    rect(x-3,y-3,6,4,'#56e4df');rect(x-1,y-6,2,3,'#fff1c4');
    rect(x-8,y+5,3,3,'#ffc75e');rect(x+5,y+5,3,3,'#ffc75e');
    rect(x-2,y+5,4,3,'#758da9');
  }
  function drawRock(o) {
    ctx.save();ctx.translate(Math.round(o.x),Math.round(o.y));ctx.rotate(o.rot);
    const pts=o.shape;ctx.beginPath();
    for(let i=0;i<pts.length;i++){const a=i/pts.length*Math.PI*2,rr=o.r*pts[i];const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
    ctx.closePath();ctx.fillStyle='#777b91';ctx.fill();ctx.strokeStyle='#c1a68d';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#555a70';ctx.fillRect(-o.r*.48,-o.r*.1,3,2);ctx.fillRect(o.r*.1,o.r*.28,2,2);
    ctx.fillStyle='#a8a0a0';ctx.fillRect(-o.r*.18,-o.r*.48,3,2);ctx.restore();
  }
  function render(dt) {
    ctx.fillStyle='#080e1b';ctx.fillRect(0,0,W,H);
    // Nebulosa y estrellas parallax.
    ctx.fillStyle='#11182c';ctx.fillRect(20,18,70,26);ctx.fillRect(276,58,80,30);
    ctx.fillStyle='#17203a';ctx.fillRect(35,25,48,12);ctx.fillRect(294,65,56,16);
    for(const s of stars){s.y+=s.v*dt;if(s.y>H){s.y=0;s.x=Math.random()*W;}ctx.globalAlpha=s.a;rect(s.x,s.y,s.s,s.s,s.s===2?'#9cb9de':'#dce8f4');}
    ctx.globalAlpha=1;
    // Horizonte de planeta decorativo.
    ctx.fillStyle='#171d36';ctx.fillRect(0,H-8,W,8);ctx.fillStyle='#282342';ctx.fillRect(0,H-8,W,1);
    for(let i=0;i<8;i++){const x=((i*53-(elapsed*8)%53)+W)%W;rect(x,H-5,2,1,'#515078');}
    for(const c of crystals){const pulse=Math.floor((Math.sin(c.phase+performance.now()/150)+1)*1.5);rect(c.x-4,c.y-4,8,8,'#65e9db');rect(c.x-2,c.y-6,4,12,'#b3fff1');rect(c.x-1,c.y-3,2,6,'#fff4ad');rect(c.x-5,c.y-1,10,2,'#b3fff1');if(pulse===0)rect(c.x-1,c.y-8,2,2,'#fff4ad');}
    for(const b of bullets){rect(b.x-1,b.y-5,3,8,'#8efff0');rect(b.x,b.y-5,1,5,'#fff5b0');}
    for(const r of rocks)drawRock(r);
    for(const p of particles){ctx.globalAlpha=clamp(p.t/p.max,0,1);rect(p.x,p.y,2,2,p.color);}ctx.globalAlpha=1;
    if(state!=='over')drawShip(player.x,player.y,state==='playing'&&invulnerable>0);
    // Pequeña retícula arcade en los márgenes.
    ctx.globalAlpha=.35;rect(7,7,9,1,'#647292');rect(7,7,1,9,'#647292');rect(W-16,7,9,1,'#647292');rect(W-8,7,1,9,'#647292');ctx.globalAlpha=1;
  }
  function update(dt) {
    elapsed+=dt;sector=Math.floor(elapsed/22)+1;
    if(sector!==Number(ui.wave.textContent)){ui.wave.textContent=String(sector).padStart(2,'0');ui.status.textContent=`SECTOR ${String(sector).padStart(2,'0')} · EN CURSO`;if(elapsed%22<dt){tone(660,.1);setTimeout(()=>tone(880,.12),100);}}
    const left=keyState.ArrowLeft||keyState.a||keyState.A,right=keyState.ArrowRight||keyState.d||keyState.D,up=keyState.ArrowUp||keyState.w||keyState.W,down=keyState.ArrowDown||keyState.s||keyState.S;
    let dx=(right?1:0)-(left?1:0),dy=(down?1:0)-(up?1:0);if(dx&&dy){dx*=.707;dy*=.707;}
    player.x=clamp(player.x+dx*player.speed*dt,12,W-12);player.y=clamp(player.y+dy*player.speed*dt,22,H-20);
    shotClock=Math.max(0,shotClock-dt);invulnerable=Math.max(0,invulnerable-dt);
    if(keyState[' ']||touchFire)fire();
    spawnClock-=dt;if(spawnClock<=0){spawnRock();spawnClock=Math.max(.34,1.05-sector*.055)+Math.random()*.34;}
    crystalClock-=dt;if(crystalClock<=0){spawnCrystal();crystalClock=rand(7,11);}
    for(const r of rocks){r.y+=r.v*dt;r.x+=r.drift*dt;r.rot+=r.spin*dt;if(r.x<r.r||r.x>W-r.r)r.drift*=-1;}
    for(const b of bullets)b.y-=b.v*dt;
    for(const c of crystals){c.y+=c.v*dt;c.phase+=dt*6;}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt;p.vx*=.97;p.vy*=.97;}
    for(let i=rocks.length-1;i>=0;i--){const r=rocks[i];
      if(r.y>H+r.r){rocks.splice(i,1);continue;}
      if(Math.hypot(r.x-player.x,r.y-player.y)<r.r+7){rocks.splice(i,1);hurt();if(state!=='playing')return;continue;}
    }
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(b.y<0){bullets.splice(i,1);continue;}let hit=false;
      for(let j=rocks.length-1;j>=0;j--){const r=rocks[j];if(Math.hypot(r.x-b.x,r.y-b.y)<r.r+2){bullets.splice(i,1);hit=true;r.hp--;if(r.hp<=0){rocks.splice(j,1);score+=10;burst(r.x,r.y,'#ffbf74',7);tone(250+Math.random()*180,.06,'square',.025);updateHud();}else burst(b.x,b.y,'#fff0ad',3);break;}}
      if(hit)continue;
    }
    for(let i=crystals.length-1;i>=0;i--){const c=crystals[i];if(c.y>H+10){crystals.splice(i,1);continue;}if(Math.hypot(c.x-player.x,c.y-player.y)<13){crystals.splice(i,1);score+=50;if(lives<5)lives++;burst(c.x,c.y,'#70fff0',14);tone(740,.1,'triangle',.04);setTimeout(()=>tone(980,.12,'triangle',.035),70);updateHud();}}
    particles=particles.filter(p=>p.t>0);
  }
  let last=0;
  function loop(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;if(state==='playing')update(dt);else {for(const s of stars){s.y+=s.v*dt;if(s.y>H){s.y=0;s.x=Math.random()*W;}}elapsed+=dt;}
    render(dt);requestAnimationFrame(loop);}
  requestAnimationFrame(loop);

  ui.button.addEventListener('click',()=>{if(state==='paused')pauseGame();else startGame();});
  ui.sound.addEventListener('click',()=>{muted=!muted;ui.sound.classList.toggle('is-muted',muted);ui.sound.innerHTML=muted?'♫ <span>APAGADO</span>':'♫ <span>SONIDO</span>';if(!muted)tone(620,.08);});
  window.addEventListener('keydown',e=>{
    const k=e.key==='Space'?' ':e.key;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();
    keyState[k]=true;
    if((k==='p'||k==='P'||k==='Escape')&&!e.repeat)pauseGame();
    if((k==='Enter'||k===' ')&&(state==='title'||state==='over')&&!e.repeat)startGame();
  });
  window.addEventListener('keyup',e=>{keyState[e.key==='Space'?' ':e.key]=false;});
  window.addEventListener('blur',()=>{for(const k in keyState)keyState[k]=false;touchFire=false;if(state==='playing')pauseGame();});
  document.querySelectorAll('.touch-key').forEach(button=>{
    const k=button.dataset.key;
    const down=e=>{e.preventDefault();keyState[k]=true;button.classList.add('pressed');try{button.setPointerCapture(e.pointerId);}catch(_){}};
    const up=e=>{e.preventDefault();keyState[k]=false;button.classList.remove('pressed');};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
  });
  const fireButton=$('fire-button');
  fireButton.addEventListener('pointerdown',e=>{e.preventDefault();touchFire=true;fireButton.classList.add('pressed');try{fireButton.setPointerCapture(e.pointerId);}catch(_){}});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])fireButton.addEventListener(name,()=>{touchFire=false;fireButton.classList.remove('pressed');});
  updateHud();
})();
