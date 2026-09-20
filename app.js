const GAMES = ["2K15","2K16","2K17","2K18","2K19","2K20","2K22","2K23","2K24","2K25","2K26"];
const app = document.getElementById('app');
const CURRENT_VERSION='0.3.1';
let state = { view:'home', game:null, section:'dashboard', data:null, query:'', filter:'ALL', teamEditor:null };

function storageKey(game){ return `wtu:${game}:v1`; }
function customTeamsKey(game){return `wtu:${game}:custom-teams:v1`}
function loadCustomTeams(game){try{return JSON.parse(localStorage.getItem(customTeamsKey(game))||'[]')}catch{return[]}}
function saveCustomTeams(game,teams){localStorage.setItem(customTeamsKey(game),JSON.stringify(teams))}
function allTagTeams(){
  if(!state.data)return [];
  return [
    ...state.data.tagTeams.map(t=>({...t,_custom:false})),
    ...loadCustomTeams(state.game).map(t=>({...t,_custom:true}))
  ];
}
function backupWTUData(){
  const snapshot={createdAt:new Date().toISOString(),version:CURRENT_VERSION,data:{}};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key && key.startsWith('wtu:') && key!=='wtu:backups:v1')snapshot.data[key]=localStorage.getItem(key);
  }
  let backups=[];
  try{backups=JSON.parse(localStorage.getItem('wtu:backups:v1')||'[]')}catch{}
  backups.unshift(snapshot);
  localStorage.setItem('wtu:backups:v1',JSON.stringify(backups.slice(0,5)));
}
function versionParts(v){return String(v||'0').replace(/^v/i,'').split('.').map(x=>parseInt(x,10)||0)}
function isNewerVersion(remote,local){
  const a=versionParts(remote),b=versionParts(local),n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0)}
  return false;
}
async function applyAppUpdate(version){
  backupWTUData();
  if('caches' in window){
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('wtu-')).map(k=>caches.delete(k)));
  }
  if('serviceWorker' in navigator){
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
  }
  location.replace(`${location.pathname}?updated=${encodeURIComponent(version)}&t=${Date.now()}`);
}
async function checkForUpdate(){
  try{
    const res=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const info=await res.json();
    if(isNewerVersion(info.version,CURRENT_VERSION)){
      const extra=info.notes?`\n\n${info.notes}`:'';
      if(confirm(`WWE Title Universe ${info.version} is ready.${extra}\n\nUpdate now?`))await applyAppUpdate(info.version);
    }else{
      alert(`WWE Title Universe ${CURRENT_VERSION} is up to date.`);
    }
  }catch(err){
    alert('Could not check for updates. Check the internet connection and try again.');
  }
}
function loadProgress(game){ try{return JSON.parse(localStorage.getItem(storageKey(game))||'{}')}catch{return{}} }
function saveProgress(game,p){ localStorage.setItem(storageKey(game),JSON.stringify(p)); }
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function pct(a,b){return b?Math.round(a/b*100):0}

async function openGame(game){
  if(game!=="2K26") return;
  const res=await fetch('data/2k26.json');
  state={...state,view:'game',game,section:'dashboard',data:await res.json(),query:'',filter:'ALL',teamEditor:null};
  render();
}
function isDone(kind,name){return loadProgress(state.game)?.[kind]?.[name]==='DONE'}
function setDone(kind,name,done){const p=loadProgress(state.game);p[kind]??={};p[kind][name]=done?'DONE':'MISSING';saveProgress(state.game,p);render();}
function tagStatus(t){const a=isDone('roster',t.member1),b=isDone('roster',t.member2);return a&&b?'READY':(a||b?'WAITING FOR 1':'LOCKED')}
function competitionCount(t){
  const d=state.data;
  if(t.type==='Tag') return allTagTeams().filter(x=>x.competition===t.competition && tagStatus(x)==='READY').length;
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

      <button class="update-btn" data-action="check-update" title="Check for updates" aria-label="Check for updates"></button>
      <div class="version">v${CURRENT_VERSION}</div>
    </div>
  `;
}
function home(){
 return `<main class="shell">${header('Definitely not OTG! with suplexes.')}<section class="hero"><h2>Choose a game</h2><p>One simple engine. Eleven WWE 2K datasets. 2K26 is the live test game; the older games will plug into the same structure as their data is built.</p></section><div class="grid">${GAMES.map(g=>`<button class="game-tile ${g==='2K26'?'ready':''}" ${g!=='2K26'?'disabled':''} data-game="${g}"><strong>WWE ${g}</strong><small>${g==='2K26'?'OPEN • FOUNDATION':'DATA QUEUED'}</small></button>`).join('')}</div><div class="footer">Local progress and custom teams are stored on this device &bull; v${CURRENT_VERSION}.</div></main>`
}
function nav(){const items=['dashboard','roster','championships','arenas','tag teams','tournaments'];return `<div class="nav-grid">${items.map(x=>`<button class="nav-tile ${state.section===x?'active':''}" data-section="${x}">${x.replace(/\b\w/g,c=>c.toUpperCase())}</button>`).join('')}</div>`}
function dashboard(){
  const d=state.data;

  const rd=d.roster.filter(r=>isDone('roster',r.name)).length;
  const cd=d.championships.filter(x=>isDone('championships',x.name)).length;
  const ad=d.arenas.filter(x=>isDone('arenas',x.name)).length;
  const teams=allTagTeams();
  const ready=teams.filter(x=>tagStatus(x)==='READY').length;

  return `
    <div class="notice">
      2K26 roster is reconciled to TheSmackDownHotel's 501-entry list.
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
        <b>${ready}/${teams.length}</b>
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
function tagTeamEditor(){
  const customs=loadCustomTeams(state.game);
  const editing=state.teamEditor && state.teamEditor!=='new' ? customs.find(t=>t.id===state.teamEditor) : null;
  const roster=[...state.data.roster].sort((a,b)=>a.name.localeCompare(b.name));
  const tagTournaments=[...new Map(state.data.tournaments.filter(t=>t.type==='Tag').map(t=>[t.competition,t])).values()];
  const selectedCompetition=editing?.competition||tagTournaments[0]?.competition||'';
  return `
    <form class="team-editor" data-team-form>
      <div class="team-editor-title">${editing?'Edit custom team':'Add custom team'}</div>
      <input type="hidden" name="id" value="${esc(editing?.id||'')}">
      <label class="field-label">Team name
        <input class="search team-input" name="team" value="${esc(editing?.team||'')}" placeholder="e.g. Brothers of Darkness" required>
      </label>
      <label class="field-label">Member 1
        <input class="search team-input" name="member1" list="wtu-roster-names" value="${esc(editing?.member1||'')}" placeholder="Start typing a wrestler..." required>
      </label>
      <label class="field-label">Member 2
        <input class="search team-input" name="member2" list="wtu-roster-names" value="${esc(editing?.member2||'')}" placeholder="Start typing a wrestler..." required>
      </label>
      <datalist id="wtu-roster-names">${roster.map(r=>`<option value="${esc(r.name)}"></option>`).join('')}</datalist>
      <label class="field-label">Tag championship
        <select class="filter team-select" name="competition" required>
          ${tagTournaments.map(t=>`<option value="${esc(t.competition)}" ${t.competition===selectedCompetition?'selected':''}>${esc(t.competition)} &bull; ${esc(t.division)}</option>`).join('')}
        </select>
      </label>
      <div class="team-editor-actions">
        <button class="small-action" type="submit">${editing?'SAVE TEAM':'ADD TEAM'}</button>
        <button class="mini-btn" type="button" data-action="cancel-team">CANCEL</button>
      </div>
    </form>`;
}
function saveTeamFromForm(form){
  const fd=new FormData(form);
  const id=String(fd.get('id')||'').trim();
  const team=String(fd.get('team')||'').trim();
  const member1=String(fd.get('member1')||'').trim();
  const member2=String(fd.get('member2')||'').trim();
  const competition=String(fd.get('competition')||'').trim();
  const names=new Set(state.data.roster.map(r=>r.name));
  if(!team)return alert('Give the team a name.');
  if(!names.has(member1)||!names.has(member2))return alert('Choose both members from the WWE 2K26 roster.');
  if(member1===member2)return alert('A tag team needs two different wrestlers.');
  const tournament=state.data.tournaments.find(t=>t.type==='Tag'&&t.competition===competition);
  if(!tournament)return alert('Choose a valid tag championship.');
  const duplicate=allTagTeams().find(t=>String(t.team).toLowerCase()===team.toLowerCase() && (!t._custom || t.id!==id));
  if(duplicate)return alert('A team with that name already exists.');
  const teams=loadCustomTeams(state.game);
  const item={id:id||`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,team,member1,member2,division:tournament.division,competition,pairingBucket:'CUSTOM'};
  const index=teams.findIndex(t=>t.id===id);
  if(index>=0)teams[index]=item;else teams.push(item);
  saveCustomTeams(state.game,teams);
  state.teamEditor=null;
  render();
}
function tagTeams(){
  const teams=allTagTeams();
  return `
    ${state.teamEditor?`<div class="team-modal-backdrop"><div class="team-modal">${tagTeamEditor()}</div></div>`:''}
    <div class="section-title tag-title">
      <div><h3>Tag Teams</h3><span>${teams.length} total &bull; ${loadCustomTeams(state.game).length} custom</span></div>
      <button class="small-action" data-action="add-team">+ ADD TEAM</button>
    </div>
    <div class="cards">
      ${teams.map(t=>{
        const s=tagStatus(t);
        return `<div class="card">
          <div class="tag-card-head"><h4>${esc(t.team)}</h4>${t._custom?'<span class="pill custom-pill">CUSTOM</span>':''}</div>
          <p>${esc(t.member1)} + ${esc(t.member2)}</p>
          <p>${esc(t.competition)}</p>
          <span class="pill ${s==='READY'?'good':s==='WAITING FOR 1'?'warn':'bad'}">${s}</span>
          <span class="pill">${esc(t.pairingBucket)}</span>
          ${t._custom?`<div class="card-actions"><button class="mini-btn" data-edit-team="${esc(t.id)}">EDIT</button><button class="mini-btn danger-btn" data-delete-team="${esc(t.id)}">DELETE</button></div>`:''}
        </div>`;
      }).join('')}
    </div>`;
}
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
        Source policy: TheSmackDownHotel preferred. Progress and custom teams are stored on this device.
      </div>
    </main>
  `;
}function render(){app.innerHTML=state.view==='home'?home():game();const f=document.querySelector('[data-input="filter"]');if(f)f.value=state.filter}

document.addEventListener('click',e=>{const g=e.target.closest('[data-game]');if(g)openGame(g.dataset.game);const a=e.target.closest('[data-action="home"]');if(a){state={view:'home',game:null,section:'dashboard',data:null,query:'',filter:'ALL',teamEditor:null};render()}const s=e.target.closest('[data-section]');if(s){state.section=s.dataset.section;state.query='';state.filter='ALL';render()}const t=e.target.closest('[data-toggle]');if(t)setDone(t.dataset.toggle,t.dataset.name,!isDone(t.dataset.toggle,t.dataset.name));});
document.addEventListener('click',async e=>{
  const update=e.target.closest('[data-action="check-update"]');
  if(update){await checkForUpdate();return;}
  const add=e.target.closest('[data-action="add-team"]');
  if(add){state.teamEditor='new';render();return;}
  const cancel=e.target.closest('[data-action="cancel-team"]');
  if(cancel){state.teamEditor=null;render();return;}
  const edit=e.target.closest('[data-edit-team]');
  if(edit){state.teamEditor=edit.dataset.editTeam;render();return;}
  const del=e.target.closest('[data-delete-team]');
  if(del){
    const teams=loadCustomTeams(state.game);
    const found=teams.find(t=>t.id===del.dataset.deleteTeam);
    if(found && confirm(`Delete custom team "${found.team}"?`)){
      saveCustomTeams(state.game,teams.filter(t=>t.id!==found.id));
      if(state.teamEditor===found.id)state.teamEditor=null;
      render();
    }
  }
});
document.addEventListener('submit',e=>{
  const form=e.target.closest('[data-team-form]');
  if(form){e.preventDefault();saveTeamFromForm(form);}
});
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
if(
  'serviceWorker' in navigator &&
  !['127.0.0.1','localhost','::1'].includes(location.hostname)
){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
render();
