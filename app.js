const GAMES = ["2K15","2K16","2K17","2K18","2K19","2K20","2K22","2K23","2K24","2K25","2K26"];
const app = document.getElementById('app');
let state = { view:'home', game:null, section:'dashboard', data:null, query:'', filter:'ALL' };

function storageKey(game){ return `wtu:${game}:v1`; }
function loadProgress(game){ try{return JSON.parse(localStorage.getItem(storageKey(game))||'{}')}catch{return{}} }
function saveProgress(game,p){ localStorage.setItem(storageKey(game),JSON.stringify(p)); }
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function pct(a,b){return b?Math.round(a/b*100):0}

async function openGame(game){
  if(game!=="2K26") return;
  const res=await fetch('data/2k26.json');
  state={...state,view:'game',game,section:'dashboard',data:await res.json(),query:'',filter:'ALL'};
  render();
}
function isDone(kind,name){return loadProgress(state.game)?.[kind]?.[name]==='DONE'}
function setDone(kind,name,done){const p=loadProgress(state.game);p[kind]??={};p[kind][name]=done?'DONE':'MISSING';saveProgress(state.game,p);render();}
function tagStatus(t){const a=isDone('roster',t.member1),b=isDone('roster',t.member2);return a&&b?'READY':(a||b?'WAITING FOR 1':'LOCKED')}
function competitionCount(t){
  const d=state.data;
  if(t.type==='Tag') return d.tagTeams.filter(x=>x.competition===t.competition && tagStatus(x)==='READY').length;
  return d.roster.filter(r=>r.tournamentEligible && r.gender===t.division && r.singlesCompetition===t.competition && isDone('roster',r.name)).length;
}
function bracketAdvice(n){if(n<2)return 'WAIT'; if(n<=4)return '4 entrant KO'; if(n<=8)return '8 entrant KO'; if(n<=16)return '16 entrant KO'; if(n<=32)return '32 entrant KO'; return '64+ entrant KO'}

function header(sub=''){
  return `
    <div class="topbar">
      ${state.view==='game'
        ? '<button class="back" data-action="home">← Games</button>'
        : ''
      }

      <div class="brand">
        <h1>WWE Title Universe</h1>
        <p>${esc(sub)}</p>
      </div>

      ${state.view==='game'
        ? '<button class="help" data-section="about">?</button>'
        : ''
      }

      <div class="version">v0.2.0</div>
    </div>
  `;
}
function home(){
 return `<main class="shell">${header('Definitely not OTG! with suplexes.')}<section class="hero"><h2>Choose a game</h2><p>One simple engine. Eleven WWE 2K datasets. 2K26 is the live test game; the older games will plug into the same structure as their data is built.</p></section><div class="grid">${GAMES.map(g=>`<button class="game-tile ${g==='2K26'?'ready':''}" ${g!=='2K26'?'disabled':''} data-game="${g}"><strong>WWE ${g}</strong><small>${g==='2K26'?'OPEN • FOUNDATION':'DATA QUEUED'}</small></button>`).join('')}</div><div class="footer">Local progress is stored in this browser only in v0.2.0.</div></main>`
}
function nav(){const items=['dashboard','roster','championships','arenas','tag teams','tournaments'];return `<div class="nav-grid">${items.map(x=>`<button class="nav-tile ${state.section===x?'active':''}" data-section="${x}">${x.replace(/\b\w/g,c=>c.toUpperCase())}</button>`).join('')}</div>`}
function dashboard(){
  const d=state.data;

  const rd=d.roster.filter(r=>isDone('roster',r.name)).length;
  const cd=d.championships.filter(x=>isDone('championships',x.name)).length;
  const ad=d.arenas.filter(x=>isDone('arenas',x.name)).length;
  const ready=d.tagTeams.filter(x=>tagStatus(x)==='READY').length;

  return `
    <div class="notice">
      2K26 data is still provisional while we reconcile the full SmackDown Hotel roster.
      MISSING is deliberately the safe default.
    </div>

    <div class="stats">
      <div class="stat">
        <b>${rd}/${d.roster.length}</b>
        <span>Roster DONE • ${pct(rd,d.roster.length)}%</span>
      </div>

      <div class="stat">
        <b>${cd}/${d.championships.length}</b>
        <span>Championships DONE</span>
      </div>

      <div class="stat">
        <b>${ad}/${d.arenas.length}</b>
        <span>Arenas DONE</span>
      </div>

      <div class="stat">
        <b>${ready}/${d.tagTeams.length}</b>
        <span>Tag teams READY</span>
      </div>
    </div>
  `;
}
function about(){
  return `
    <div class="section-title">
      <h3>How It Works</h3>
    </div>

    <div class="cards">
      <div class="card">
        <h4>Unlocks</h4>
        <p>
          Wrestlers, championships and arenas start as MISSING.
          Change them to DONE as they are unlocked.
        </p>
      </div>

      <div class="card">
        <h4>Singles</h4>
        <p>
          A DONE wrestler automatically joins their assigned
          championship tournament pool.
        </p>
      </div>

      <div class="card">
        <h4>Tag Teams</h4>
        <p>
          LOCKED means neither member is available.
          WAITING FOR 1 means one member is DONE.
          READY means both members are DONE.
        </p>
      </div>

      <div class="card">
        <h4>Tournaments</h4>
        <p>
          Tournament entrant counts update automatically from the
          wrestlers you have unlocked. All tournaments use knockout formats.
        </p>
      </div>

      <div class="card">
        <h4>Data</h4>
        <p>
          MISSING is always the safe default. A wrestler or item only
          becomes DONE when you confirm it is actually available.
        </p>
      </div>
    </div>
  `;
}
function roster(){
  let arr=state.data.roster;
  const q=state.query.toLowerCase();

  if(q){
    arr=arr.filter(r=>
      [r.name,r.identity,r.brand,r.singlesCompetition]
        .some(v=>String(v||'').toLowerCase().includes(q))
    );
  }

  if(state.filter!=='ALL'){
    arr=arr.filter(r=>
      r.gender===state.filter || r.rosterType===state.filter
    );
  }

  return `
    <div class="toolbar">
      <input
        class="search"
        data-input="query"
        value="${esc(state.query)}"
        placeholder="Search wrestler, brand or title…"
      >

      <select class="filter" data-input="filter">
        <option>ALL</option>
        <option>Male</option>
        <option>Female</option>
        <option>MANAGER</option>
      </select>
    </div>

    <div class="list">
      ${arr.map(r=>`
        <div class="row">
          <div>
            <strong>${esc(r.name)}</strong>
            <div class="sub">
              ${esc(r.identity)} • ${esc(r.brand)} • OVR ${esc(r.ovr||'TBA')}
            </div>
          </div>

          <div>${esc(r.gender)}</div>
          <div>${esc(r.rosterType)}</div>
          <div>${esc(r.singlesCompetition||'—')}</div>

          <button
            class="status ${isDone('roster',r.name)?'done':''}"
            data-toggle="roster"
            data-name="${esc(r.name)}"
          >
            ${isDone('roster',r.name)?'DONE':'MISSING'}
          </button>
        </div>
      `).join('')}
    </div>
  `;
}
function genericUnlock(kind,items,nameKey,sub){let q=state.query.toLowerCase(),arr=items;if(q)arr=arr.filter(x=>Object.values(x).some(v=>String(v||'').toLowerCase().includes(q)));return `<div class="toolbar"><input class="search" data-input="query" value="${esc(state.query)}" placeholder="Search…"></div><div class="list">${arr.map(x=>{let name=x[nameKey];return `<div class="row"><div><strong>${esc(name)}</strong><div class="sub">${esc(sub(x))}</div></div><div></div><div></div><div></div><button class="status ${isDone(kind,name)?'done':''}" data-toggle="${kind}" data-name="${esc(name)}">${isDone(kind,name)?'DONE':'MISSING'}</button></div>`}).join('')}</div>`}
function tagTeams(){return `<div class="cards">${state.data.tagTeams.map(t=>{const s=tagStatus(t);return `<div class="card"><h4>${esc(t.team)}</h4><p>${esc(t.member1)} + ${esc(t.member2)}</p><p>${esc(t.competition)}</p><span class="pill ${s==='READY'?'good':s==='WAITING FOR 1'?'warn':'bad'}">${s}</span> <span class="pill">${esc(t.pairingBucket)}</span></div>`}).join('')}</div>`}
function tournaments(){return `<div class="cards">${state.data.tournaments.map(t=>{const n=competitionCount(t);return `<div class="card"><h4>${esc(t.competition)}</h4><p>${esc(t.type)} • ${esc(t.division)} • ${n} unlocked entrants</p><p>R1: ${esc(t.round1)} → QF: ${esc(t.quarterFinal)} → SF: ${esc(t.semiFinal)} → Final: ${esc(t.final)}</p><p>Final arena: ${esc(t.finalArena)}</p><span class="pill">${bracketAdvice(n)}</span></div>`}).join('')}</div>`}
function game(){
  let content='';

  if(state.section==='dashboard')content=dashboard();
  if(state.section==='roster')content=roster();
  if(state.section==='championships'){
    content=genericUnlock(
      'championships',
      state.data.championships,
      'name',
      x=>`${x.category} • ${x.competition} • ${x.division}`
    );
  }
  if(state.section==='arenas'){
    content=genericUnlock(
      'arenas',
      state.data.arenas,
      'name',
      x=>`${x.category} • ${x.unlockNote||''}`
    );
  }
  if(state.section==='tag teams')content=tagTeams();
  if(state.section==='tournaments')content=tournaments();
  if(state.section==='about')content=about();

  return `
    <main class="shell">
      ${header(`WWE ${state.game} • ${state.data.status}`)}
      ${nav()}
      ${content}
      <div class="footer">
        Source policy: SmackDown Hotel preferred. This build is the engine test, not the final 2K26 dataset.
      </div>
    </main>
  `;
}function render(){app.innerHTML=state.view==='home'?home():game();const f=document.querySelector('[data-input="filter"]');if(f)f.value=state.filter}

document.addEventListener('click',e=>{const g=e.target.closest('[data-game]');if(g)openGame(g.dataset.game);const a=e.target.closest('[data-action="home"]');if(a){state={view:'home',game:null,section:'dashboard',data:null,query:'',filter:'ALL'};render()}const s=e.target.closest('[data-section]');if(s){state.section=s.dataset.section;state.query='';state.filter='ALL';render()}const t=e.target.closest('[data-toggle]');if(t)setDone(t.dataset.toggle,t.dataset.name,!isDone(t.dataset.toggle,t.dataset.name));});
document.addEventListener('input',e=>{
  if(e.target.dataset.input==='query'){
    state.query=e.target.value;

    const caret=e.target.selectionStart;
    render();

    const search=document.querySelector('[data-input="query"]');

    if(search){
      search.focus();
      search.setSelectionRange(caret,caret);
    }
  }
});document.addEventListener('change',e=>{if(e.target.dataset.input==='filter'){state.filter=e.target.value;render()}});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
render();
