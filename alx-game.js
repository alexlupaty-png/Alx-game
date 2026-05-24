/* ============================================================
   ALX WELLNESS — Premium Game Engine v3.0
   ============================================================ */
'use strict';

// ============================================================
// CONFIG
// ============================================================
const GRID = 7;

const PRODUCTS = [
  { id:0, key:'aloe_concentrate', name:'Aloe',     color:'#4CAF50', glow:'rgba(76,175,80,0.75)'   },
  { id:1, key:'shake_f1',         name:'Batido',   color:'#8D6E63', glow:'rgba(141,110,99,0.75)'  },
  { id:2, key:'tea_concentrate',  name:'Té Herbal',color:'#FF8F00', glow:'rgba(255,143,0,0.75)'   },
  { id:3, key:'protein_drink',    name:'Proteína', color:'#7B1FA2', glow:'rgba(123,31,162,0.75)'  },
  { id:4, key:'liftoff',          name:'Liftoff',  color:'#D32F2F', glow:'rgba(211,47,47,0.75)'   },
  { id:5, key:'cr7_drive',        name:'CR7',      color:'#1565C0', glow:'rgba(21,101,192,0.75)'  },
  { id:6, key:'protein_bar',      name:'P.Bar',    color:'#5D4037', glow:'rgba(93,64,55,0.75)'    },
];

const WORLDS = [
  { name:'🌿 Valle del Bienestar', color:'#4CAF50' },
  { name:'⚡ Ruta Fit',            color:'#FF9800' },
  { name:'🌊 Oasis Herbal',        color:'#2196F3' },
  { name:'🏔️ Montaña Energía',     color:'#9C27B0' },
  { name:'🌟 Zona Premium',         color:'#FFD700' },
];

const LEVELS = Array.from({length:15}, (_,i) => {
  const n = i+1;
  const types = PRODUCTS.slice(0, Math.min(3 + Math.floor(i/3), PRODUCTS.length));
  return {
    num: n,
    moves: Math.max(14, 22 - Math.floor(i/2)),
    target: types.slice(0,Math.min(1+Math.floor(i/4),3)).map(t => ({id:t.id, count: 8+i*2})),
    star1: 400+i*150, star2: 800+i*300, star3: 1400+i*500,
    world: Math.floor(i/3),
  };
});

const REWARDS = [
  '🌿 Aloe Gratis','🥤 Batido Premium','⭐ Cliente Estrella',
  '🎫 Cupón Wellness','💪 Proteína Gratis','🏆 VIP Pass','☕ Té Herbal',
];

const HABITS = [
  {icon:'💧',text:'Tomar agua',done:false},
  {icon:'🌿',text:'Tomar Aloe',done:false},
  {icon:'🏃',text:'Entrenar',done:false},
  {icon:'🥤',text:'Batido',done:false},
  {icon:'😴',text:'Descanso',done:false},
  {icon:'🧘',text:'Meditar',done:false},
];

const BOOSTERS_DEF = [
  { key:'aloe',      icon:'🌿', name:'Aloe',      desc:'Limpia 3×3' },
  { key:'tea',       icon:'☕', name:'Té',         desc:'Rayo fila+col' },
  { key:'shake',     icon:'🥤', name:'Batido',     desc:'Bomba 5×5' },
  { key:'protein',   icon:'💪', name:'Proteína',   desc:'×2 puntos' },
];

// ============================================================
// STATE
// ============================================================
let G = {
  coins:0, energy:5, streak:1, musicOn:true, soundOn:true,
  playerName:'Wellness Star', playerLevel:1,
  levelsData: LEVELS.map(()=>({stars:0,best:0})),
  unlockedLevel:1,
  habits: JSON.parse(JSON.stringify(HABITS)),
  boosters:{ aloe:3, tea:2, shake:3, protein:2 },
  dailyClaimed:false, dailyDate:'',
  // in-game
  board:[], score:0, moves:0, objectives:[],
  progress:{}, selected:null, animating:false,
  combo:0, activeBooster:null, currentLevel:0,
  hintTimer:null,
};

// ============================================================
// AUDIO
// ============================================================
let AC = null;
function initAC() {
  try { AC = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
}
function note(freq, type='sine', dur=0.15, vol=0.25, delay=0) {
  if (!G.soundOn || !AC) return;
  try {
    const t = AC.currentTime + delay;
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.type=type; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.start(t); o.stop(t+dur+0.05);
  } catch(e){}
}
function sfxMatch()   { [523,659,784].forEach((f,i)=>note(f,'sine',0.12,0.2,i*0.06)); }
function sfxBig()     { [523,659,784,1047].forEach((f,i)=>note(f,'triangle',0.15,0.25,i*0.05)); }
function sfxSwap()    { note(440,'sine',0.08,0.12); }
function sfxError()   { note(220,'square',0.18,0.18); }
function sfxCoin()    { note(1047,'sine',0.1,0.18); }
function sfxBooster() { note(880,'sawtooth',0.18,0.35); }
function sfxVictory() { [523,659,784,1047,1319].forEach((f,i)=>note(f,'sine',0.3,0.3,i*0.1)); }
function sfxIntro() {
  if(!AC) return;
  const notes = [130.8,261.6,329.6,392,523,659,784,1047];
  notes.forEach((f,i)=>note(f,'sine',i<4?2.5:0.5,i<4?0.06:0.12,i<4?0.05+i*0.05:0.5+i*0.1));
}

// ============================================================
// SAVE / LOAD
// ============================================================
function save() {
  try { localStorage.setItem('alx_v3', JSON.stringify({
    coins:G.coins, energy:G.energy, streak:G.streak,
    musicOn:G.musicOn, soundOn:G.soundOn,
    playerName:G.playerName, playerLevel:G.playerLevel,
    levelsData:G.levelsData, unlockedLevel:G.unlockedLevel,
    boosters:G.boosters, habits:G.habits,
    dailyClaimed:G.dailyClaimed, dailyDate:G.dailyDate,
  })); } catch(e){}
}
function load() {
  try {
    const raw = localStorage.getItem('alx_v3');
    if (raw) Object.assign(G, JSON.parse(raw));
  } catch(e){}
  if (!G.levelsData || G.levelsData.length < LEVELS.length)
    G.levelsData = LEVELS.map(()=>({stars:0,best:0}));
  if (!G.boosters) G.boosters = {aloe:3,tea:2,shake:3,protein:2};
  if (!G.habits || G.habits.length < HABITS.length) G.habits = JSON.parse(JSON.stringify(HABITS));
  const today = new Date().toDateString();
  if (G.dailyDate !== today) { G.dailyClaimed = false; G.dailyDate = today; }
}

// ============================================================
// SCREEN MANAGER
// ============================================================
const SCREENS = ['intro','menu','levelmap','gameplay','victory','defeat','shop'];
function showScreen(id) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    if (s === id) { el.classList.add('active'); el.classList.remove('exit'); }
    else if (el.classList.contains('active')) { el.classList.add('exit'); el.classList.remove('active'); setTimeout(()=>el.classList.remove('exit'),350); }
  });
  if (id==='menu')     { refreshMenuUI(); hidePause(); }
  if (id==='levelmap') { renderLevelMap(); }
  if (id==='shop')     { renderShop(); }
}

function refreshMenuUI() {
  el('pname').textContent = G.playerName;
  el('prank').textContent = `⭐ Nivel ${G.playerLevel} · Miembro ALX`;
  el('coins-ui').textContent = G.coins;
  el('energy-ui').textContent = G.energy;
  el('streak-count').textContent = G.streak;
  el('daily-banner').style.display = G.dailyClaimed ? 'none' : 'flex';
  el('music-pill').classList.toggle('muted', !G.musicOn);
  el('sound-pill').classList.toggle('muted', !G.soundOn);
  renderHabits();
  spawnPlayParticles();
}
function updateCoins() {
  ['coins-ui','coins-map','coins-shop'].forEach(id => { const e=el(id); if(e) e.textContent=G.coins; });
}
function el(id) { return document.getElementById(id); }
function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

// ============================================================
// BACKGROUND CANVAS (floating dots)
// ============================================================
function initBgCanvas() {
  const c = el('bg-canvas'); if(!c) return;
  const ctx = c.getContext('2d');
  let W = c.width=innerWidth, H = c.height=innerHeight;
  const COLS = ['rgba(122,155,118,','rgba(201,168,76,','rgba(168,200,164,'];
  const pts = Array.from({length:40}, ()=>({
    x:Math.random()*W, y:Math.random()*H,
    r:Math.random()*1.4+0.3,
    vx:(Math.random()-.5)*0.25, vy:(Math.random()-.5)*0.25-.1,
    a:Math.random()*0.4+0.05,
    c:COLS[Math.floor(Math.random()*COLS.length)],
  }));
  function draw() {
    ctx.clearRect(0,0,W,H);
    pts.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.y<-5){p.y=H+5;p.x=Math.random()*W;}
      if(p.x<0)p.x=W; if(p.x>W)p.x=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.c+p.a+')'; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
  addEventListener('resize',()=>{W=c.width=innerWidth;H=c.height=innerHeight;});
}

// ============================================================
// INTRO
// ============================================================
function initIntroCanvas() {
  const c = el('intro-canvas'); if(!c) return;
  const ctx = c.getContext('2d');
  let W=c.width=innerWidth, H=c.height=innerHeight;
  const COLS=['rgba(122,155,118,','rgba(201,168,76,','rgba(245,240,232,'];
  const pts = Array.from({length:60},()=>({
    x:Math.random()*W, y:H+Math.random()*100,
    r:Math.random()*2+0.5,
    vx:(Math.random()-.5)*0.5, vy:-(Math.random()*0.6+0.2),
    a:Math.random()*0.5+0.1,
    c:COLS[Math.floor(Math.random()*COLS.length)],
  }));
  function draw() {
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.y<-10){p.y=H+10;p.x=Math.random()*W;}
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.c+p.a+')';ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}
function skipIntro() {
  const intro = el('intro'); if(!intro) return;
  intro.style.opacity='0'; intro.style.transition='opacity 0.8s';
  setTimeout(()=>{ intro.classList.remove('active'); showScreen('menu'); },850);
}
function runIntro() {
  initIntroCanvas();
  setTimeout(()=>{ if(AC) sfxIntro(); }, 300);
  setTimeout(skipIntro, 4000);
}

// ============================================================
// PLAY BUTTON PARTICLES
// ============================================================
function spawnPlayParticles() {
  const c = el('play-particles'); if(!c) return;
  c.innerHTML='';
  for(let i=0;i<10;i++){
    const p=document.createElement('div');
    p.className='pp';
    const s=Math.random()*5+2, hue=Math.random()>0.5?120:45;
    p.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;background:hsla(${hue},60%,65%,0.5);animation-duration:${Math.random()*3+2}s;animation-delay:${Math.random()*3}s;`;
    c.appendChild(p);
  }
}

// ============================================================
// LEAF BACKGROUND
// ============================================================
function initLeaves() {
  const lb=el('leaf-bg'); if(!lb) return;
  const L=['🌿','🍃','🌱'];
  for(let i=0;i<8;i++){
    const d=document.createElement('div');
    d.className='leaf-float';
    d.textContent=L[Math.floor(Math.random()*L.length)];
    d.style.cssText=`left:${Math.random()*100}%;animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*15}s;font-size:${Math.random()*20+16}px;`;
    lb.appendChild(d);
  }
}

// ============================================================
// DAILY REWARD
// ============================================================
function claimDaily() {
  if(G.dailyClaimed) return;
  const amt = 50 + G.streak*10;
  G.coins += amt; G.dailyClaimed=true; G.streak++;
  save(); updateCoins(); sfxCoin();
  spawnCoins(amt);
  toast(`🎁 +${amt} 🪙 ¡Recompensa reclamada! Streak: ${G.streak} días 🔥`);
  el('daily-banner').style.display='none';
  el('streak-count').textContent=G.streak;
}

function spawnCoins(count) {
  const layer=el('coins-layer'); if(!layer) return;
  for(let i=0;i<Math.min(count/10,8);i++){
    setTimeout(()=>{
      const c=document.createElement('div');
      c.className='fly-coin'; c.textContent='🪙';
      c.style.cssText=`left:${20+Math.random()*60}%;top:${30+Math.random()*40}%;`;
      layer.appendChild(c);
      setTimeout(()=>c.remove(),1100);
    },i*80);
  }
}

// ============================================================
// HABITS
// ============================================================
function renderHabits() {
  const row=el('habits-row'); if(!row) return;
  row.innerHTML='';
  G.habits.forEach((h,i)=>{
    const d=document.createElement('div');
    d.className=`habit-chip${h.done?' done':''}`;
    d.innerHTML=`<div class="habit-icon">${h.icon}</div><div class="habit-text">${h.text}</div><div class="habit-check">${h.done?'✓':''}</div>`;
    d.onclick=()=>toggleHabit(i);
    row.appendChild(d);
  });
}
function toggleHabit(i) {
  if(G.habits[i].done) return;
  G.habits[i].done=true;
  G.coins+=15; sfxCoin(); spawnCoins(15);
  save(); updateCoins(); renderHabits();
  toast(`${G.habits[i].icon} +15 🪙 ¡Hábito completado!`);
}
function showHabits() { toast('💚 Completa hábitos para ganar monedas 🪙'); }

// ============================================================
// LEVEL MAP
// ============================================================
function showLevelMap() { showScreen('levelmap'); }

function renderLevelMap() {
  el('coins-map').textContent = G.coins;
  // World tabs
  const tabs=el('world-tabs'); tabs.innerHTML='';
  WORLDS.forEach((w,i)=>{
    const t=document.createElement('div');
    t.className=`world-tab${i===0?' active':''}`;
    t.textContent=w.name;
    tabs.appendChild(t);
  });
  // Level nodes
  const path=el('level-path'); path.innerHTML='';
  LEVELS.forEach((lvl,i)=>{
    const ld=G.levelsData[i]||{stars:0,best:0};
    const unlocked=i<G.unlockedLevel;
    const completed=ld.stars>0;
    const current=i===G.unlockedLevel-1&&!completed;
    const row=document.createElement('div');
    row.className='path-row';
    const node=document.createElement('div');
    node.className=`level-node${unlocked?' unlocked':''}${completed?' completed':''}${current?' current':''}${!unlocked?' locked':''}`;
    const stars=completed?'⭐'.repeat(ld.stars)+'☆'.repeat(3-ld.stars):'☆☆☆';
    const icon=LEVELS[i].target.slice(0,2).map(t=>PRODUCTS[t.id]?.key||'').join('');
    node.innerHTML=`
      ${current?'<div class="node-crown">👑</div>':''}
      <div class="node-num">${lvl.num}</div>
      <div class="node-stars">${stars}</div>
    `;
    if(unlocked) node.onclick=()=>startLevel(i);
    row.appendChild(node);
    path.appendChild(row);
  });
}

// ============================================================
// GAME START
// ============================================================
function startLevel(idx) {
  const lvl=LEVELS[idx]; if(!lvl) return;
  if(G.energy<=0){toast('⚡ Sin energía. ¡Espera o recarga!');return;}
  G.currentLevel=idx; G.score=0; G.moves=lvl.moves;
  G.combo=0; G.selected=null; G.animating=false; G.activeBooster=null;
  G.objectives=lvl.target.map(t=>({...t,collected:0}));
  G.progress={}; lvl.target.forEach(t=>G.progress[t.id]=0);
  G.energy=Math.max(0,G.energy-1); save();
  showScreen('gameplay');
  el('g-level').textContent=lvl.num;
  refreshGameUI();
  renderObjectives();
  renderBoosters();
  genBoard(); renderBoard();
  clearHint(); scheduleHint();
}

// ============================================================
// BOARD GEN
// ============================================================
function availableTypes() {
  return PRODUCTS.slice(0, Math.min(4+Math.floor(G.currentLevel/3), PRODUCTS.length));
}
function genBoard() {
  const types=availableTypes();
  do {
    G.board=[];
    for(let r=0;r<GRID;r++){
      G.board[r]=[];
      for(let c=0;c<GRID;c++){
        let t,tries=0;
        do { t=types[Math.floor(Math.random()*types.length)]; tries++; }
        while(tries<20 && wouldMatch(r,c,t.id));
        G.board[r][c]={type:t, special:null};
      }
    }
  } while(!hasMoves());
}
function wouldMatch(r,c,id){
  if(c>=2&&G.board[r][c-1]?.type.id===id&&G.board[r][c-2]?.type.id===id) return true;
  if(r>=2&&G.board[r-1]?.[c]?.type.id===id&&G.board[r-2]?.[c]?.type.id===id) return true;
  return false;
}
function hasMoves(){
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++)
    if(canSwap(r,c,r,c+1)||canSwap(r,c,r+1,c)) return true;
  return false;
}
function canSwap(r1,c1,r2,c2){
  if(r2>=GRID||c2>=GRID) return false;
  const t=G.board[r1][c1]; G.board[r1][c1]=G.board[r2][c2]; G.board[r2][c2]=t;
  const ok=findMatches().length>0;
  G.board[r2][c2]=G.board[r1][c1]; G.board[r1][c1]=t;
  return ok;
}

// ============================================================
// RENDER BOARD
// ============================================================
function renderBoard() {
  const bd=el('board'); if(!bd) return;
  bd.style.gridTemplateColumns=`repeat(${GRID},1fr)`;
  bd.style.gridTemplateRows=`repeat(${GRID},1fr)`;
  bd.innerHTML='';
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) bd.appendChild(mkTile(r,c));
}
function mkTile(r,c) {
  const cell=G.board[r][c];
  const div=document.createElement('div');
  div.className='tile';
  div.dataset.r=r; div.dataset.c=c;
  div.style.setProperty('--tile-glow', cell.type.glow);
  div.style.setProperty('--tile-color', cell.type.color);
  let imgKey=cell.type.key;
  if(cell.special==='bomb')      { imgKey='special_bomb';      div.classList.add('sp-bomb'); }
  if(cell.special==='lightning') { imgKey='special_lightning'; div.classList.add('sp-lightning'); }
  if(cell.special==='rainbow')   { imgKey='special_rainbow';   div.classList.add('sp-rainbow'); }
  const img=document.createElement('img');
  img.className='tile-img';
  img.src=(typeof PRODUCT_IMAGES!=='undefined'&&PRODUCT_IMAGES[imgKey])?PRODUCT_IMAGES[imgKey]:'';
  img.alt=cell.type.name; img.draggable=false;
  div.appendChild(img);
  const lbl=document.createElement('span');
  lbl.className='tile-name'; lbl.textContent=cell.type.name;
  div.appendChild(lbl);
  const shine=document.createElement('div');
  shine.className='tile-shine'; div.appendChild(shine);
  if(cell.special){
    const b=document.createElement('div');
    b.className='sp-badge';
    b.textContent=cell.special==='bomb'?'💥':cell.special==='lightning'?'⚡':'🌈';
    div.appendChild(b);
  }
  div.addEventListener('click',()=>onTileClick(r,c));
  div.addEventListener('touchstart',onTS,{passive:true});
  div.addEventListener('touchend',onTE,{passive:true});
  return div;
}
function getTile(r,c){ return el('board')?.querySelector(`[data-r="${r}"][data-c="${c}"]`); }
function refreshTile(r,c){ const o=getTile(r,c); if(o) o.replaceWith(mkTile(r,c)); }

// ============================================================
// TOUCH DRAG
// ============================================================
let _ts=null;
function onTS(e){ const t=e.touches[0]; _ts={x:t.clientX,y:t.clientY,el:e.currentTarget}; }
function onTE(e){
  if(!_ts) return;
  const t=e.changedTouches[0];
  const dx=t.clientX-_ts.x, dy=t.clientY-_ts.y;
  const ax=Math.abs(dx), ay=Math.abs(dy);
  if(ax<28&&ay<28){ _ts=null; return; }
  const r=parseInt(_ts.el.dataset.r), c=parseInt(_ts.el.dataset.c);
  let tr=r,tc=c;
  if(ax>ay) tc+=dx>0?1:-1; else tr+=dy>0?1:-1;
  _ts=null;
  if(tr<0||tr>=GRID||tc<0||tc>=GRID) return;
  clearSel();
  G.selected={r,c};
  attemptSwap(r,c,tr,tc);
}

// ============================================================
// TILE CLICK
// ============================================================
function onTileClick(r,c){
  if(G.animating) return;
  if(!AC) initAC();
  if(AC?.state==='suspended') AC.resume();
  if(G.activeBooster){ applyBooster(r,c); return; }
  if(!G.selected){
    G.selected={r,c};
    getTile(r,c)?.classList.add('selected');
    sfxSwap(); clearHint();
  } else {
    const {r:sr,c:sc}=G.selected;
    if(sr===r&&sc===c){ clearSel(); return; }
    if(isAdj(sr,sc,r,c)) attemptSwap(sr,sc,r,c);
    else { clearSel(); G.selected={r,c}; getTile(r,c)?.classList.add('selected'); sfxSwap(); }
  }
}
function clearSel(){
  if(G.selected){ getTile(G.selected.r,G.selected.c)?.classList.remove('selected'); G.selected=null; }
}
function isAdj(r1,c1,r2,c2){ return (Math.abs(r1-r2)===1&&c1===c2)||(Math.abs(c1-c2)===1&&r1===r2); }

// ============================================================
// SWAP
// ============================================================
async function attemptSwap(r1,c1,r2,c2){
  if(G.animating) return;
  clearSel();
  animSwap(r1,c1,r2,c2);
  const t=G.board[r1][c1]; G.board[r1][c1]=G.board[r2][c2]; G.board[r2][c2]=t;
  const matches=findMatches();
  if(!matches.length){
    await delay(220);
    animSwap(r1,c1,r2,c2);
    G.board[r2][c2]=G.board[r1][c1]; G.board[r1][c1]=t;
    sfxError(); return;
  }
  sfxSwap(); G.moves--; refreshGameUI();
  G.animating=true; G.combo=0;
  await checkAndTriggerSpecials(r1,c1,r2,c2);
  await cascade(matches, r1,c1,r2,c2);
  G.animating=false;
  if(checkWin()){ await delay(300); doVictory(); return; }
  if(G.moves<=0){ await delay(500); doDefeat(); return; }
  if(!hasMoves()){ toast('🔄 ¡Tablero mezclado!'); await delay(400); shuffleBoard(); }
  scheduleHint();
}

function animSwap(r1,c1,r2,c2){
  const e1=getTile(r1,c1), e2=getTile(r2,c2); if(!e1||!e2) return;
  const a=e1.getBoundingClientRect(), b=e2.getBoundingClientRect();
  const dx=b.left-a.left, dy=b.top-a.top;
  [e1,e2].forEach(e=>{ e.style.transition='transform 0.2s cubic-bezier(0.34,1.4,0.64,1)'; e.style.zIndex='10'; });
  e1.style.transform=`translate(${dx}px,${dy}px)`;
  e2.style.transform=`translate(${-dx}px,${-dy}px)`;
  setTimeout(()=>{
    [e1,e2].forEach(e=>{ e.style.transform=''; e.style.transition=''; e.style.zIndex=''; });
    refreshTile(r1,c1); refreshTile(r2,c2);
  },220);
}

// ============================================================
// FIND MATCHES
// ============================================================
function findMatches(){
  const set=new Set();
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID-2;c++){
    const id=G.board[r][c]?.type.id;
    if(id===undefined) continue;
    if(G.board[r][c+1]?.type.id===id&&G.board[r][c+2]?.type.id===id){
      let e=c+2; while(e+1<GRID&&G.board[r][e+1]?.type.id===id)e++;
      for(let k=c;k<=e;k++) set.add(`${r},${k}`);
    }
  }
  for(let c=0;c<GRID;c++) for(let r=0;r<GRID-2;r++){
    const id=G.board[r][c]?.type.id;
    if(id===undefined) continue;
    if(G.board[r+1]?.[c]?.type.id===id&&G.board[r+2]?.[c]?.type.id===id){
      let e=r+2; while(e+1<GRID&&G.board[e+1]?.[c]?.type.id===id)e++;
      for(let k=r;k<=e;k++) set.add(`${k},${c}`);
    }
  }
  return [...set].map(k=>{ const[r,c]=k.split(',').map(Number); return{r,c}; });
}

// ============================================================
// SPECIALS
// ============================================================
async function checkAndTriggerSpecials(r1,c1,r2,c2){
  for(const [r,c] of [[r1,c1],[r2,c2]]){
    const cell=G.board[r]?.[c]; if(!cell?.special) continue;
    if(cell.special==='bomb') await triggerBomb(r,c);
    else if(cell.special==='lightning') await triggerLightning(r,c);
    else if(cell.special==='rainbow') await triggerRainbow(r,c);
  }
}
async function triggerBomb(r,c){
  const pos=[];
  for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<GRID&&nc>=0&&nc<GRID) pos.push({r:nr,c:nc});
  }
  explosion(r,c,'rgba(200,80,255,'); await clearTiles(pos,true); addScore(pos.length*30);
}
async function triggerLightning(r,c){
  const pos=new Set();
  for(let i=0;i<GRID;i++){pos.add(`${r},${i}`);pos.add(`${i},${c}`);}
  const arr=[...pos].map(k=>{const[r2,c2]=k.split(',').map(Number);return{r:r2,c:c2};});
  explosion(r,c,'rgba(80,180,255,'); await clearTiles(arr,true); addScore(arr.length*25);
}
async function triggerRainbow(r,c){
  const ids=[...new Set(G.board.flat().filter(Boolean).map(t=>t.type.id))];
  const tid=ids[Math.floor(Math.random()*ids.length)];
  const pos=[];
  for(let r2=0;r2<GRID;r2++) for(let c2=0;c2<GRID;c2++)
    if(G.board[r2][c2]?.type.id===tid) pos.push({r:r2,c:c2});
  explosion(r,c,'rgba(201,168,76,'); await clearTiles(pos,true); addScore(pos.length*40);
}

// ============================================================
// CASCADE
// ============================================================
async function cascade(matches, sr,sc,tr,tc){
  if(!matches.length) return;
  G.combo++;
  const multi=Math.pow(1.5,G.combo-1);
  const special=calcSpecial(matches,sr,sc);
  // Animate
  matches.forEach(({r,c})=>getTile(r,c)?.classList.add('matched'));
  // Track progress
  matches.forEach(({r,c})=>{
    const id=G.board[r][c]?.type.id;
    if(id!==undefined) G.progress[id]=(G.progress[id]||0)+1;
  });
  const base=Math.round(matches.length*50*multi);
  addScore(base);
  if(matches.length>=5){sfxBig();shakeBoard();}else sfxMatch();
  if(G.combo>1) showCombo(G.combo);
  showScorePop(matches,base);
  await delay(400);
  if(special){ const{r,c,t}=special; if(G.board[r]?.[c]){G.board[r][c].special=t;await delay(80);refreshTile(r,c);} }
  matches.forEach(({r,c})=>{ G.board[r][c]=null; });
  updateObjUI();
  await delay(120); drop(); await delay(300); fill(); await delay(350); rerenderBoard(); await delay(250);
  const nx=findMatches();
  if(nx.length) await cascade(nx,-1,-1,-1,-1);
}

function calcSpecial(matches,r,c){
  if(matches.length>=5) return{r,c,t:'rainbow'};
  if(matches.length===4) return{r,c,t:'lightning'};
  return null;
}

async function clearTiles(pos,anim=false){
  if(anim){ pos.forEach(({r,c})=>getTile(r,c)?.classList.add('matched')); await delay(380); }
  pos.forEach(({r,c})=>{ if(G.board[r]) G.board[r][c]=null; });
}

function drop(){
  for(let c=0;c<GRID;c++){
    let empty=GRID-1;
    for(let r=GRID-1;r>=0;r--){
      if(G.board[r][c]!==null){ G.board[empty][c]=G.board[r][c]; if(empty!==r) G.board[r][c]=null; empty--; }
    }
  }
}

function fill(){
  const types=availableTypes();
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++)
    if(G.board[r][c]===null)
      G.board[r][c]={type:types[Math.floor(Math.random()*types.length)],special:null};
}

function rerenderBoard(){
  const bd=el('board'); if(!bd) return;
  bd.innerHTML='';
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){
    const t=mkTile(r,c); t.classList.add('falling'); bd.appendChild(t);
  }
}

// ============================================================
// OBJECTIVES
// ============================================================
function checkWin(){ return G.objectives.every(o=>(G.progress[o.id]||0)>=o.count); }
function updateObjUI(){
  G.objectives.forEach(o=>{ o.collected=Math.min(G.progress[o.id]||0,o.count); });
  renderObjectives();
}
function renderObjectives(){
  const c=el('g-obj'); if(!c) return; c.innerHTML='';
  G.objectives.forEach(o=>{
    const col=Math.min(G.progress[o.id]||0,o.count);
    const done=col>=o.count;
    const d=document.createElement('div');
    d.className=`obj-item${done?' done':''}`;
    d.innerHTML=`<span>${PRODUCTS[o.id]?.key?'📦':''} ${PRODUCTS[o.id]?.name||'?'}</span><span>${col}/${o.count}</span>`;
    c.appendChild(d);
  });
}

// ============================================================
// SCORE / UI
// ============================================================
function addScore(n){ G.score+=n; refreshGameUI(); updateStars(); }
function refreshGameUI(){
  const gs=el('g-score'); if(gs){ gs.textContent=G.score; gs.classList.remove('pop'); void gs.offsetWidth; gs.classList.add('pop'); }
  const gm=el('g-moves'); if(gm) gm.textContent=G.moves;
}
function updateStars(){
  const lvl=LEVELS[G.currentLevel]; if(!lvl) return;
  const p1=Math.min(G.score/lvl.star2*100,100);
  const p2=Math.min(Math.max(G.score-lvl.star2,0)/(lvl.star3-lvl.star2)*100,100);
  const sf1=el('sf1'),sf2=el('sf2');
  if(sf1) sf1.style.width=p1+'%';
  if(sf2) sf2.style.width=p2+'%';
  if(G.score>=lvl.star1){ el('s1')?.classList.add('lit'); note(880,'sine',0.2,0.2); }
  if(G.score>=lvl.star2){ el('s2')?.classList.add('lit'); note(988,'sine',0.2,0.2); }
  if(G.score>=lvl.star3){ el('s3')?.classList.add('lit'); note(1047,'sine',0.2,0.2); }
}

// ============================================================
// BOOSTERS UI
// ============================================================
function renderBoosters(){
  const row=el('boosters-row'); if(!row) return; row.innerHTML='';
  BOOSTERS_DEF.forEach(b=>{
    const btn=document.createElement('button');
    btn.className=`booster-btn${G.activeBooster===b.key?' active':''}`;
    btn.id=`bst-${b.key}`;
    btn.innerHTML=`<div class="b-icon">${b.icon}</div><div class="b-name">${b.name}</div><span class="b-count">${G.boosters[b.key]||0}</span>`;
    btn.onclick=()=>useBooster(b.key);
    row.appendChild(btn);
  });
}
function useBooster(key){
  if((G.boosters[key]||0)<=0){ toast('Sin potenciadores. ¡Compra más!'); return; }
  G.activeBooster=G.activeBooster===key?null:key;
  renderBoosters();
  if(G.activeBooster) toast(`${BOOSTERS_DEF.find(b=>b.key===key)?.icon} Toca una casilla para usar`);
}
async function applyBooster(r,c){
  const key=G.activeBooster; G.activeBooster=null;
  G.boosters[key]=(G.boosters[key]||1)-1; renderBoosters(); save(); sfxBooster();
  G.animating=true;
  if(key==='shake') { await triggerBomb(r,c); G.board[r][c]=null; }
  else if(key==='tea') { await triggerLightning(r,c); }
  else if(key==='protein') { addScore(G.score); toast('💪 ×2 Puntos!'); }
  else if(key==='aloe') {
    const pos=[];
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<GRID&&nc>=0&&nc<GRID) pos.push({r:nr,c:nc});
    }
    explosion(r,c,'rgba(76,175,80,'); await clearTiles(pos,true); addScore(pos.length*35);
  }
  drop(); fill(); await delay(300); rerenderBoard(); await delay(250);
  const nx=findMatches(); if(nx.length) await cascade(nx,-1,-1,-1,-1);
  G.animating=false;
  if(checkWin()){ doVictory(); return; }
  if(G.moves<=0){ doDefeat(); return; }
}

// ============================================================
// VISUAL EFFECTS
// ============================================================
function explosion(r,c,colorBase){
  const tile=getTile(r,c); if(!tile) return;
  const bi=el('board-inner'); if(!bi) return;
  const tr=tile.getBoundingClientRect(), br=bi.getBoundingClientRect();
  for(let i=0;i<14;i++){
    const p=document.createElement('div');
    const angle=(i/14)*Math.PI*2, dist=40+Math.random()*50;
    p.style.cssText=`position:absolute;width:7px;height:7px;border-radius:50%;
      left:${tr.left-br.left+tr.width/2}px;top:${tr.top-br.top+tr.height/2}px;
      background:${colorBase}0.8);pointer-events:none;z-index:40;
      animation:explodeP 0.5s ease forwards;
      --dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px;`;
    bi.appendChild(p);
    setTimeout(()=>p.remove(),600);
  }
}
function shakeBoard(){
  const bd=el('board'); bd?.classList.add('board-shake');
  setTimeout(()=>bd?.classList.remove('board-shake'),500);
}
function showCombo(n){
  const cp=el('combo-popup'); if(!cp) return;
  cp.textContent=`COMBO ×${n}!`;
  const cf=el('combo-flash');
  cp.classList.remove('show'); cf?.classList.remove('pop');
  void cp.offsetWidth;
  cp.classList.add('show'); cf?.classList.add('pop');
  setTimeout(()=>{ cp.classList.remove('show'); cf?.classList.remove('pop'); },1100);
}
function showScorePop(matches,score){
  if(!matches.length) return;
  const mid=matches[Math.floor(matches.length/2)];
  const tile=getTile(mid.r,mid.c); if(!tile) return;
  const bi=el('board-inner'); if(!bi) return;
  const tr=tile.getBoundingClientRect(), br=bi.getBoundingClientRect();
  const p=document.createElement('div');
  p.className='score-pop'; p.textContent=`+${score}`;
  p.style.cssText=`left:${tr.left-br.left+tr.width/2}px;top:${tr.top-br.top}px;transform:translateX(-50%);`;
  bi.appendChild(p);
  setTimeout(()=>p.remove(),1000);
}

// ============================================================
// HINT
// ============================================================
function scheduleHint(){ clearHint(); G.hintTimer=setTimeout(showHint,4500); }
function clearHint(){
  clearTimeout(G.hintTimer); G.hintTimer=null;
  document.querySelectorAll('.hint-glow').forEach(e=>e.classList.remove('hint-glow'));
}
function showHint(){
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++){
    if(canSwap(r,c,r,c+1)){ getTile(r,c)?.classList.add('hint-glow'); getTile(r,c+1)?.classList.add('hint-glow'); return; }
    if(canSwap(r,c,r+1,c)){ getTile(r,c)?.classList.add('hint-glow'); getTile(r+1,c)?.classList.add('hint-glow'); return; }
  }
}

// ============================================================
// SHUFFLE
// ============================================================
function shuffleBoard(){
  const tiles=G.board.flat().filter(Boolean); tiles.sort(()=>Math.random()-.5);
  let i=0; for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) G.board[r][c]=tiles[i++];
  rerenderBoard();
}

// ============================================================
// PAUSE
// ============================================================
function pauseGame(){ el('pause-overlay')?.classList.add('show'); G.animating=true; }
function resumeGame(){ hidePause(); G.animating=false; scheduleHint(); }
function hidePause(){ el('pause-overlay')?.classList.remove('show'); }

// ============================================================
// VICTORY / DEFEAT
// ============================================================
function doVictory(){
  const lvl=LEVELS[G.currentLevel]; if(!lvl) return;
  let stars=0;
  if(G.score>=lvl.star1) stars=1;
  if(G.score>=lvl.star2) stars=2;
  if(G.score>=lvl.star3) stars=3;
  const old=G.levelsData[G.currentLevel]||{stars:0,best:0};
  G.levelsData[G.currentLevel]={stars:Math.max(old.stars,stars),best:Math.max(old.best,G.score)};
  if(G.currentLevel+1>G.unlockedLevel) G.unlockedLevel=G.currentLevel+1;
  const coins=stars*30+Math.floor(G.score/60);
  G.coins+=coins;
  G.playerLevel=Math.max(1,Math.floor(G.levelsData.reduce((s,d)=>s+(d?.stars||0),0)/5)+1);
  save(); updateCoins(); sfxVictory(); spawnCoins(coins);
  el('v-score').textContent=G.score.toLocaleString();
  el('v-coins').textContent=`+${coins} 🪙`;
  el('v-reward').textContent=REWARDS[Math.floor(Math.random()*REWARDS.length)];
  ['rs1','rs2','rs3'].forEach((id,i)=>{
    const e=el(id); if(!e) return;
    if(i<stars) setTimeout(()=>{ e.classList.add('lit'); note(523+i*130,'sine',0.25,0.3); },500+i*300);
    else { e.style.filter='grayscale(1)'; e.style.opacity='0.2'; }
  });
  showScreen('victory');
}

function doDefeat(){
  el('d-score').textContent=G.score.toLocaleString();
  showScreen('defeat');
  note(220,'square',0.5,0.25);
}

function nextLevel(){
  if(G.currentLevel+1<LEVELS.length) startLevel(G.currentLevel+1);
  else { toast('🎉 ¡Completaste todos los niveles! ¡Eres un Maestro ALX!'); showScreen('menu'); }
}
function retryLevel(){ hidePause(); startLevel(G.currentLevel); }
function continueCoins(){
  if(G.coins<30){ toast('🪙 Sin monedas suficientes'); return; }
  G.coins-=30; G.moves+=5; updateCoins(); refreshGameUI(); save();
  showScreen('gameplay'); G.animating=false; scheduleHint();
}

// ============================================================
// SHOP
// ============================================================
function renderShop(){
  const sc=el('shop-scroll'); if(!sc) return; sc.innerHTML='';
  el('coins-shop').textContent=G.coins;
  const rewards=[
    {icon:'🌿',name:'Aloe Gratis',desc:'Muestra especial',price:80},
    {icon:'🥤',name:'Batido Premium',desc:'Fórmula 1 gratis',price:120},
    {icon:'⭐',name:'Cliente Estrella',desc:'Estatus VIP',price:200},
    {icon:'🎫',name:'Cupón 20%',desc:'Descuento especial',price:150},
    {icon:'💪',name:'Proteína Gratis',desc:'Rebuild Strength',price:160},
    {icon:'🏆',name:'VIP Pass',desc:'Acceso premium total',price:350},
  ];
  const boosters=[
    {icon:'🌿',name:'Aloe ×3',desc:'Limpia 3×3',price:50,key:'aloe',amt:3},
    {icon:'☕',name:'Té ×2',desc:'Rayo fila+col',price:45,key:'tea',amt:2},
    {icon:'🥤',name:'Batido ×3',desc:'Bomba 5×5',price:55,key:'shake',amt:3},
    {icon:'💪',name:'Proteína ×2',desc:'×2 puntos',price:40,key:'protein',amt:2},
  ];
  const mkSection=(title,items,isBst)=>{
    const s=document.createElement('div');
    s.className='shop-section'; s.textContent=title; sc.appendChild(s);
    const g=document.createElement('div');
    g.className='shop-grid';
    items.forEach(item=>{
      const c=document.createElement('div');
      c.className='shop-card';
      c.innerHTML=`<div class="shop-card-icon">${item.icon}</div><div class="shop-card-name">${item.name}</div><div class="shop-card-desc">${item.desc}</div><div class="shop-card-price">🪙 ${item.price}</div>`;
      c.onclick=()=>isBst?buyBooster(item.key,item.price,item.amt):buyReward(item.name,item.price);
      g.appendChild(c);
    });
    sc.appendChild(g);
  };
  mkSection('🌟 Recompensas Wellness',rewards,false);
  mkSection('⚡ Potenciadores',boosters,true);
}
function buyReward(name,price){
  if(G.coins<price){ toast('🪙 Monedas insuficientes'); return; }
  G.coins-=price; save(); updateCoins(); sfxCoin();
  toast(`✅ ¡${name} desbloqueado! 🎉`); spawnCoins(5);
}
function buyBooster(key,price,amt){
  if(G.coins<price){ toast('🪙 Monedas insuficientes'); return; }
  G.coins-=price; G.boosters[key]=(G.boosters[key]||0)+amt;
  save(); updateCoins(); sfxCoin(); toast(`⚡ Potenciador añadido!`);
}

// ============================================================
// SOCIAL / ACHIEVEMENTS
// ============================================================
function showRanking(){
  const total=G.levelsData.filter(d=>d?.stars>0).length;
  toast(`🏆 ${total} niveles completados · ${G.coins} 🪙 totales`);
}
function showAchievements(){
  const stars=G.levelsData.reduce((s,d)=>s+(d?.stars||0),0);
  toast(`⭐ ${stars} estrellas ganadas · Nivel ${G.playerLevel}`);
}
function showProfile(){ editName(); }
function showCommunity(){ toast('👥 ¡Comunidad ALX Bolivia pronto!'); }
function showAbout(){ toast('🌿 ALX Wellness v3.0 · Club Wellness Premium Bolivia'); }
function editName(){
  const n=prompt('Tu nombre en el club:',G.playerName);
  if(n?.trim()){ G.playerName=n.trim().slice(0,20); save(); refreshMenuUI(); toast(`✅ ¡Bienvenido, ${G.playerName}!`); }
}

// ============================================================
// SETTINGS
// ============================================================
function toggleMusic(){ G.musicOn=!G.musicOn; save(); toast(G.musicOn?'🎵 Música activada':'🔇 Música desactivada'); ['music-pill','pause-music'].forEach(id=>el(id)?.classList.toggle('muted',!G.musicOn)); }
function toggleSound(){ G.soundOn=!G.soundOn; save(); toast(G.soundOn?'🔊 Sonido activado':'🔇 Sonido desactivado'); ['sound-pill','pause-sound'].forEach(id=>el(id)?.classList.toggle('muted',!G.soundOn)); }

// ============================================================
// TOAST
// ============================================================
function toast(msg,dur=2800){
  const t=el('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),dur);
}

// ============================================================
// CSS FOR EXPLOSION PARTICLES
// ============================================================
const style=document.createElement('style');
style.textContent=`
@keyframes explodeP { 0%{transform:translate(0,0)scale(1);opacity:1;} 100%{transform:translate(var(--dx),var(--dy))scale(0);opacity:0;} }
`;
document.head.appendChild(style);

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', ()=>{
  load(); initBgCanvas(); initLeaves();
  if(!AC) try{ AC=new(window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  document.addEventListener('touchstart',()=>{ if(!AC) initAC(); if(AC?.state==='suspended') AC.resume(); },{once:true});
  document.addEventListener('click',()=>{ if(!AC) initAC(); if(AC?.state==='suspended') AC.resume(); },{once:true});
  runIntro();
});
