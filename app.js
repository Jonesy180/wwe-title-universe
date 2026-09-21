const GAMES = ["2K15","2K16","2K17","2K18","2K19","2K20","2K22","2K23","2K24","2K25","2K26"];
const app = document.getElementById('app');
const CURRENT_VERSION='1.3.1';
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
  if(!['2K15','2K16','2K17','2K18','2K19','2K20','2K22','2K23','2K24','2K25','2K26'].includes(game)) return;
  const res=await fetch(`data/${game.toLowerCase()}.json`);
  if(!res.ok){alert(`Could not load WWE ${game} data.`);return;}
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
function homeDone(game,kind,name){
  return loadProgress(game)?.[kind]?.[name]==='DONE';
}
function homeTagStatus(game,t){
  const a=homeDone(game,'roster',t.member1),b=homeDone(game,'roster',t.member2);
  return a&&b?'READY':(a||b?'WAITING FOR 1':'LOCKED');
}
async function selectHomeGame(game,quiet=false){
  if(!GAMES.includes(game))return;
  state.homeGame=game;
  state.homeLoading=true;
  if(!quiet)render();
  try{
    const res=await fetch(`data/${game.toLowerCase()}.json`);
    if(!res.ok)throw new Error('load failed');
    state.homeData=await res.json();
    state.homeDataGame=game;
  }catch{
    state.homeData=null;
    state.homeDataGame=null;
  }
  state.homeLoading=false;
  render();
}
function home(){
  const counts={"2K15":124,"2K16":187,"2K17":183,"2K18":220,"2K19":252,"2K20":266,"2K22":228,"2K23":250,"2K24":338,"2K25":436,"2K26":501};
  const selected=state.homeGame||'2K15';
  const d=state.homeDataGame===selected?state.homeData:null;
  if(!d&&!state.homeLoading){state.homeLoading=true;setTimeout(()=>selectHomeGame(selected,true),0)}
  let status='';
  if(d){
    const rd=d.roster.filter(r=>homeDone(selected,'roster',r.name)).length;
    const cd=d.championships.filter(x=>homeDone(selected,'championships',x.name)).length;
    const ad=d.arenas.filter(x=>homeDone(selected,'arenas',x.name)).length;
    const teams=[...d.tagTeams,...loadCustomTeams(selected)];
    const ready=teams.filter(t=>homeTagStatus(selected,t)==='READY').length;
    const rp=pct(rd,d.roster.length);
    status=`<section class="status-panel home-status-panel">
      <div class="status-main">
        <div class="status-game-logo"><span class="logo-wwe">WWE</span><span class="logo-2k">2K</span><span class="logo-year">${selected.slice(2)}</span></div>
        <div class="status-kicker">GAME STATUS</div>
        <div class="status-count">${rd} / ${d.roster.length}</div>
        <div class="progress-track"><span style="width:${rp}%"></span></div>
        <div class="progress-pct">${rp}% COMPLETE</div>
      </div>
      <div class="status-breakdown">
        <div><span class="status-icon">R</span><b>ROSTER</b><em>${rd} / ${d.roster.length}</em></div>
        <div><span class="status-icon">C</span><b>CHAMPIONSHIPS</b><em>${cd} / ${d.championships.length}</em></div>
        <div><span class="status-icon">A</span><b>ARENAS</b><em>${ad} / ${d.arenas.length}</em></div>
        <div><span class="status-icon">T</span><b>TAG TEAMS</b><em>${ready} / ${teams.length}</em></div>
      </div>
    </section>
    <div class="home-nav">
      ${['roster','championships','arenas','tag teams','tournaments'].map(x=>`<button class="nav-tile" data-home-section="${x}">${x==='championships'?'Titles':x.replace(/\b\w/g,c=>c.toUpperCase())}</button>`).join('')}
    </div>`;
  }else{
    status=`<section class="home-status-loading">LOADING WWE ${selected} STATUS...</section>`;
  }
  return `<main class="shell home-shell">
    ${header('TRACK '+String.fromCharCode(8226)+' COLLECT '+String.fromCharCode(8226)+' COMPLETE')}
    <section class="deadman-stage" aria-label="Deadman entrance inspired background">
      <div class="stage-vignette"></div>
      <div class="stage-quote stage-quote-left">SOME LEGENDS<br>NEVER FADE</div>
      <div class="stage-quote stage-quote-right">THE DEADMAN<br>WALKS FOREVER</div>
    </section>
    <section class="selector-panel">
      <div class="selector-label"><span></span>SELECT A GAME<span></span></div>
      <div class="grid">${GAMES.map(g=>{const year=g.slice(2);return `<button class="game-tile ready ${g===selected?'home-selected':''}" data-home-game="${g}"><strong><span class="logo-wwe">WWE</span><span class="logo-2k">2K</span><span class="logo-year">${year}</span></strong><small>SDH ${counts[g]||''}</small></button>`}).join('')}</div>
    </section>
    ${status}
    <div class="legacy-line">IT'S NOT JUST A GAME...<br><b>IT'S A LEGACY</b></div>
    <div class="footer">Local progress and custom teams stay on this device • v${CURRENT_VERSION}.</div>
  </main>`
}
function nav(){const items=['dashboard','roster','championships','arenas','tag teams','tournaments'];return `<div class="nav-grid">${items.map(x=>`<button class="nav-tile ${state.section===x?'active':''}" data-section="${x}">${x.replace(/\b\w/g,c=>c.toUpperCase())}</button>`).join('')}</div>`}
function dashboard(){
  const d=state.data;
  const rd=d.roster.filter(r=>isDone('roster',r.name)).length;
  const cd=d.championships.filter(x=>isDone('championships',x.name)).length;
  const ad=d.arenas.filter(x=>isDone('arenas',x.name)).length;
  const teams=allTagTeams();
  const ready=teams.filter(x=>tagStatus(x)==='READY').length;
  const rp=pct(rd,d.roster.length);
  return `<section class="status-panel">
    <div class="status-main">
      <div class="status-game-logo"><span class="logo-wwe">WWE</span><span class="logo-2k">2K</span><span class="logo-year">${state.game.slice(2)}</span></div>
      <div class="status-kicker">GAME STATUS</div>
      <div class="status-count">${rd} / ${d.roster.length}</div>
      <div class="progress-track"><span style="width:${rp}%"></span></div>
      <div class="progress-pct">${rp}% COMPLETE</div>
    </div>
    <div class="status-breakdown">
      <div><span class="status-icon">R</span><b>ROSTER</b><em>${rd} / ${d.roster.length}</em></div>
      <div><span class="status-icon">C</span><b>CHAMPIONSHIPS</b><em>${cd} / ${d.championships.length}</em></div>
      <div><span class="status-icon">A</span><b>ARENAS</b><em>${ad} / ${d.arenas.length}</em></div>
      <div><span class="status-icon">T</span><b>TAG TEAMS</b><em>${ready} / ${teams.length}</em></div>
    </div>
  </section>
  <div class="safe-note">WWE ${state.game} • ${esc(d.status||'DATASET')} • MISSING remains the safe default.</div>
  <div class="legacy-line compact">IT'S NOT JUST A GAME... <b>IT'S A LEGACY</b></div>`
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
          ${tagTournaments.map(t=>`<option value="${esc(t.competition)}" ${t.competition===selectedCompetition?'selected':''}>${esc(t.competition)} • ${esc(t.division)}</option>`).join('')}
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
  if(!names.has(member1)||!names.has(member2))return alert(`Choose both members from the WWE ${state.game} roster.`);
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
// === WTU CHAOS TOURNAMENT ENGINE v1 ===
const CHAOS_TOURNAMENT_STORE='v1';
function tournamentStoreKey(game){return `wtu:${game}:tournament-runs:${CHAOS_TOURNAMENT_STORE}`}
function loadTournamentRuns(){
  try{return JSON.parse(localStorage.getItem(tournamentStoreKey(state.game))||'{}')}catch{return{}}
}
function saveTournamentRuns(runs){localStorage.setItem(tournamentStoreKey(state.game),JSON.stringify(runs))}
function tournamentKey(t){return t?._customId?`CUSTOM||${t._customId}`:[t.type||'',t.division||'',t.competition||''].join('||')}
function tournamentByKey(key){
  const builtIn=state.data.tournaments.find(t=>tournamentKey(t)===key);
  if(builtIn)return builtIn;
  return loadCustomTournamentDefs().find(t=>tournamentKey(t)===key)||null;
}
function shuffleCopy(items){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function nextBracketSize(n){let size=2;while(size<n)size*=2;return size}
function competitionEntrants(t){
  if(Array.isArray(t.customEntrants))return [...t.customEntrants];
  if(t.type==='Tag'){
    return allTagTeams()
      .filter(x=>x.competition===t.competition && tagStatus(x)==='READY')
      .map(x=>x.team);
  }
  return state.data.roster
    .filter(r=>r.tournamentEligible && r.gender===t.division && r.singlesCompetition===t.competition && isDone('roster',r.name))
    .map(r=>r.name);
}
function explicitChaosMatchTypes(t){
  const mt=state.data.matchTypes;
  if(Array.isArray(mt))return mt;
  if(!mt||typeof mt!=='object')return [];
  const keys=t.type==='Tag'&&t.division==='Mixed'
    ? ['mixedTag','mixed-tag','mixed_tag','mixed']
    : t.type==='Tag'
      ? ['tag','Tag','tags']
      : ['singles','single','Singles','Singles'];
  for(const key of keys){if(Array.isArray(mt[key])&&mt[key].length)return mt[key]}
  return [];
}
function chaosMatchPool(t){
  const fields=['round1','quarterFinal','semiFinal','final'];
  const gamePool=(state.data.tournaments||[])
    .filter(x=>x.type===t.type && !(t.type==='Tag'&&t.division==='Mixed') || (t.type==='Tag'&&t.division==='Mixed'&&String(x.division||'').toLowerCase()==='mixed'))
    .flatMap(x=>fields.map(f=>String(x[f]||'').trim()))
    .filter(x=>x && !/^(wait|tba|bye)$/i.test(x));
  const explicit=explicitChaosMatchTypes(t);
  const pool=[...new Set([...explicit,...gamePool].map(x=>String(x).trim()).filter(Boolean))];
  if(pool.length)return pool;
  if(t.type==='Tag'&&t.division==='Mixed')return ['Mixed Tag'];
  return [t.type==='Tag'?'Normal Tag':'Normal'];
}
function randomChaosType(t,previous=''){
  const pool=chaosMatchPool(t);
  const choices=pool.length>1?pool.filter(x=>x!==previous):pool;
  return choices[Math.floor(Math.random()*choices.length)]||pool[0];
}
function chaosRoundName(index,totalRounds){
  const remaining=totalRounds-index;
  if(remaining===1)return 'Final';
  if(remaining===2)return 'Semifinals';
  if(remaining===3)return 'Quarterfinals';
  return `Round ${index+1}`;
}
function buildChaosRound(t,index,totalRounds,pairs){
  return {
    name:chaosRoundName(index,totalRounds),
    matches:pairs.map((pair,i)=>{
      const a=pair[0]||null,b=pair[1]||null;
      const bye=!a||!b;
      return {
        id:`r${index}m${i}`,
        a,b,
        winner:bye?(a||b):null,
        matchType:bye?'BYE':randomChaosType(t)
      };
    })
  };
}
function startChaosTournament(key){
  const t=tournamentByKey(key);
  if(!t)return;
  const entrants=shuffleCopy(competitionEntrants(t));
  if(entrants.length<2){alert('At least two eligible entrants are needed to start this tournament.');return}
  const bracketSize=nextBracketSize(entrants.length);
  const byeCount=bracketSize-entrants.length;
  const byeEntrants=entrants.slice(0,byeCount);
  const remaining=entrants.slice(byeCount);
  let pairs=byeEntrants.map(name=>Math.random()<.5?[name,null]:[null,name]);
  for(let i=0;i<remaining.length;i+=2)pairs.push([remaining[i],remaining[i+1]]);
  pairs=shuffleCopy(pairs);
  const totalRounds=Math.log2(bracketSize);
  const run={
    key,
    competition:t.competition,
    type:t.type,
    division:t.division,
    createdAt:new Date().toISOString(),
    status:'ACTIVE',
    entrantCount:entrants.length,
    bracketSize,
    byeCount,
    entrants:[...entrants],
    totalRounds,
    currentRound:0,
    rounds:[buildChaosRound(t,0,totalRounds,pairs)],
    champion:null
  };
  const runs=loadTournamentRuns();
  runs[key]=run;
  saveTournamentRuns(runs);
  state.activeTournamentKey=key;
  render();
}
function setChaosWinner(key,matchId,winner){
  const runs=loadTournamentRuns(),run=runs[key];
  if(!run||run.status!=='ACTIVE')return;
  const round=run.rounds[run.currentRound],match=round?.matches.find(m=>m.id===matchId);
  if(!match||match.matchType==='BYE'||![match.a,match.b].includes(winner))return;
  match.winner=winner;
  saveTournamentRuns(runs);
  render();
}
function rerollChaosMatch(key,matchId){
  const runs=loadTournamentRuns(),run=runs[key],t=tournamentByKey(key);
  if(!run||!t||run.status!=='ACTIVE')return;
  const match=run.rounds[run.currentRound]?.matches.find(m=>m.id===matchId);
  if(!match||match.matchType==='BYE')return;
  match.matchType=randomChaosType(t,match.matchType);
  saveTournamentRuns(runs);
  render();
}
function advanceChaosTournament(key){
  const runs=loadTournamentRuns(),run=runs[key],t=tournamentByKey(key);
  if(!run||!t||run.status!=='ACTIVE')return;
  const round=run.rounds[run.currentRound];
  if(!round||round.matches.some(m=>!m.winner))return;
  if(run.currentRound===run.totalRounds-1){
    run.status='COMPLETE';
    run.champion=round.matches[0].winner;
    run.completedAt=new Date().toISOString();
    saveTournamentRuns(runs);
    render();
    return;
  }
  const winners=round.matches.map(m=>m.winner);
  const pairs=[];
  for(let i=0;i<winners.length;i+=2)pairs.push([winners[i],winners[i+1]]);
  const nextIndex=run.currentRound+1;
  run.rounds.push(buildChaosRound(t,nextIndex,run.totalRounds,pairs));
  run.currentRound=nextIndex;
  saveTournamentRuns(runs);
  render();
}
function abandonChaosTournament(key){
  const runs=loadTournamentRuns(),run=runs[key];
  if(!run)return;
  if(!confirm(`Abandon the ${run.competition} CHAOS tournament?`))return;
  delete runs[key];
  saveTournamentRuns(runs);
  state.activeTournamentKey=null;
  render();
}
function chaosMatchCard(key,match,index){
  if(match.matchType==='BYE'){
    const adv=match.winner||match.a||match.b;
    return `<div class="chaos-match bye-match"><div class="chaos-match-head"><b>Match ${index+1}</b><span class="pill">BYE</span></div><div class="bye-advance">${esc(adv)} advances automatically</div></div>`;
  }
  const aSelected=match.winner===match.a?' selected':'';
  const bSelected=match.winner===match.b?' selected':'';
  return `<div class="chaos-match">
    <div class="chaos-match-head"><b>Match ${index+1}</b><button class="mini-btn" data-chaos-reroll="${esc(key)}" data-chaos-match="${esc(match.id)}">REROLL TYPE</button></div>
    <div class="chaos-match-type">${esc(match.matchType)}</div>
    <div class="chaos-versus">
      <button class="chaos-entrant${aSelected}" data-chaos-winner="${esc(key)}" data-chaos-match="${esc(match.id)}" data-chaos-name="${esc(match.a)}">${esc(match.a)}</button>
      <span>VS</span>
      <button class="chaos-entrant${bSelected}" data-chaos-winner="${esc(key)}" data-chaos-match="${esc(match.id)}" data-chaos-name="${esc(match.b)}">${esc(match.b)}</button>
    </div>
    ${match.winner?`<div class="chaos-winner">WINNER: ${esc(match.winner)}</div>`:''}
  </div>`;
}
function chaosTournamentDetail(t,run){
  const key=tournamentKey(t);
  if(!run)return '';
  const venue=t.finalArena?` &bull; Venue: ${esc(t.finalArena)}`:'';
  const custom=t._customId?'<span class="pill custom-pill">CUSTOM</span>':'';
  if(run.status==='COMPLETE'){
    return `<div class="chaos-detail">
      <div class="section-title"><div><h3>${esc(t.competition)}</h3><span>CHAOS tournament complete ${custom}</span></div><button class="mini-btn" data-chaos-list>BACK</button></div>
      <div class="chaos-champion"><span>CHAMPION</span><strong>${esc(run.champion||'TBA')}</strong></div>
      <div class="chaos-meta">${run.entrantCount} entrants &bull; ${run.byeCount} ${run.byeCount===1?'bye':'byes'} &bull; ${run.bracketSize}-slot draw${venue}</div>
      <div class="chaos-actions"><button class="small-action" data-chaos-start="${esc(key)}">START NEW CHAOS</button><button class="mini-btn danger-btn" data-chaos-abandon="${esc(key)}">CLEAR RESULT</button></div>
    </div>`;
  }
  const round=run.rounds[run.currentRound];
  const complete=round.matches.every(m=>m.winner);
  const finalRound=run.currentRound===run.totalRounds-1;
  const unresolved=round.matches.filter(m=>!m.winner).length;
  return `<div class="chaos-detail">
    <div class="section-title"><div><h3>${esc(t.competition)}</h3><span>CHAOS &bull; ${esc(round.name)} &bull; ${run.currentRound+1}/${run.totalRounds} ${custom}</span></div><button class="mini-btn" data-chaos-list>BACK</button></div>
    <div class="chaos-meta">${run.entrantCount} frozen entrants &bull; ${run.byeCount} ${run.byeCount===1?'bye':'byes'} &bull; ${unresolved} match${unresolved===1?'':'es'} awaiting result${venue}</div>
    <div class="chaos-match-list">${round.matches.map((m,i)=>chaosMatchCard(key,m,i)).join('')}</div>
    ${complete?`<button class="chaos-advance" data-chaos-advance="${esc(key)}">${finalRound?'CROWN CHAMPION':'ADVANCE TO '+esc(chaosRoundName(run.currentRound+1,run.totalRounds)).toUpperCase()}</button>`:''}
    <button class="mini-btn danger-btn chaos-abandon" data-chaos-abandon="${esc(key)}">ABANDON TOURNAMENT</button>
  </div>`;
}
// === WTU CUSTOM CHAOS TOURNAMENT BUILDER v1 ===
const CUSTOM_TOURNAMENT_STORE='v1';
let customTournamentDraft=null;
function customTournamentDefsKey(game){return `wtu:${game}:custom-tournaments:${CUSTOM_TOURNAMENT_STORE}`}
function loadCustomTournamentDefs(){
  try{return JSON.parse(localStorage.getItem(customTournamentDefsKey(state.game))||'[]')}catch{return[]}
}
function saveCustomTournamentDefs(defs){localStorage.setItem(customTournamentDefsKey(state.game),JSON.stringify(defs))}
function newCustomTournamentId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return `ct-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}
function gameSupportsMixedTag(){
  const caps=state.data.capabilities||{};
  if(caps.mixedTag===true||caps.mixedTagTeam===true)return true;
  const mt=state.data.matchTypes;
  if(mt&&typeof mt==='object'&&!Array.isArray(mt)){
    for(const key of ['mixedTag','mixed-tag','mixed_tag','mixed']){
      if(Array.isArray(mt[key])&&mt[key].length)return true;
    }
  }
  return (state.data.tournaments||[]).some(t=>t.type==='Tag'&&String(t.division||'').toLowerCase()==='mixed');
}
function customTournamentModeOptions(){
  const options=[
    ['SINGLES_MALE','Male Singles'],
    ['SINGLES_FEMALE','Female Singles'],
    ['TAG_MALE','Male Tag'],
    ['TAG_FEMALE','Female Tag']
  ];
  if(gameSupportsMixedTag())options.push(['TAG_MIXED','Mixed Tag']);
  return options;
}
function customTournamentModeParts(mode){
  if(mode==='SINGLES_FEMALE')return {type:'Singles',division:'Female',label:'Female Singles'};
  if(mode==='TAG_MALE')return {type:'Tag',division:'Male',label:'Male Tag'};
  if(mode==='TAG_FEMALE')return {type:'Tag',division:'Female',label:'Female Tag'};
  if(mode==='TAG_MIXED')return {type:'Tag',division:'Mixed',label:'Mixed Tag'};
  return {type:'Singles',division:'Male',label:'Male Singles'};
}
function customTournamentModeFromDef(t){
  if(t.type==='Tag'&&t.division==='Mixed')return 'TAG_MIXED';
  if(t.type==='Tag'&&t.division==='Female')return 'TAG_FEMALE';
  if(t.type==='Tag')return 'TAG_MALE';
  if(t.division==='Female')return 'SINGLES_FEMALE';
  return 'SINGLES_MALE';
}
function openCustomTournamentBuilder(){
  const arenas=state.data.arenas||[];
  customTournamentDraft={name:'',mode:'SINGLES_MALE',arena:arenas[0]?.name||'',selected:[]};
  render();
}
function closeCustomTournamentBuilder(){customTournamentDraft=null;render()}
function customTournamentTeamDivision(team){
  const declared=String(team.division||team.pairingBucket||'').toLowerCase();
  if(declared.includes('mixed'))return 'Mixed';
  const roster=new Map((state.data.roster||[]).map(r=>[r.name,r.gender]));
  const g1=roster.get(team.member1),g2=roster.get(team.member2);
  if(g1==='Male'&&g2==='Male')return 'Male';
  if(g1==='Female'&&g2==='Female')return 'Female';
  if((g1==='Male'&&g2==='Female')||(g1==='Female'&&g2==='Male'))return 'Mixed';
  if(declared.includes('female')||declared.includes('women'))return 'Female';
  if(declared.includes('male')||declared.includes('men'))return 'Male';
  return '';
}
function customTournamentChoices(){
  if(!customTournamentDraft)return [];
  const mode=customTournamentModeParts(customTournamentDraft.mode);
  if(mode.type==='Tag'){
    return allTagTeams()
      .filter(t=>customTournamentTeamDivision(t)===mode.division)
      .map(t=>({
        value:t.team,
        title:t.team,
        subtitle:`${t.member1} + ${t.member2}`,
        status:tagStatus(t),
        search:`${t.team} ${t.member1} ${t.member2}`.toLowerCase()
      }))
      .sort((a,b)=>a.title.localeCompare(b.title));
  }
  return (state.data.roster||[])
    .filter(r=>r.gender===mode.division)
    .map(r=>({
      value:r.name,
      title:r.name,
      subtitle:'',
      status:isDone('roster',r.name)?'DONE':'MISSING',
      search:r.name.toLowerCase()
    }))
    .sort((a,b)=>a.title.localeCompare(b.title));
}
function customTournamentStatusClass(status){
  return ['DONE','READY'].includes(status)?'good':status==='WAITING FOR 1'?'warn':'bad';
}
function customTournamentBuilder(){
  if(!customTournamentDraft)return '';
  const arenas=(state.data.arenas||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const selected=new Set(customTournamentDraft.selected||[]);
  const choices=customTournamentChoices();
  const mode=customTournamentModeParts(customTournamentDraft.mode);
  const noun=mode.type==='Tag'?'TEAMS':'WRESTLERS';
  return `<div class="team-modal-backdrop custom-tournament-backdrop">
    <div class="team-modal custom-tournament-modal">
      <div class="custom-builder-head"><div><h3>CREATE CUSTOM CHAOS</h3><span>Pick the entrants. Pick the venue. CHAOS does the rest.</span></div><button class="mini-btn" data-custom-close>CLOSE</button></div>
      <label class="field-label">TOURNAMENT NAME</label>
      <input class="team-input" data-custom-name maxlength="60" value="${esc(customTournamentDraft.name||'')}" placeholder="e.g. Dad's Ridiculous Cup">
      <div class="custom-builder-grid">
        <div><label class="field-label">DIVISION / FORMAT</label><select class="team-select" data-custom-mode>${customTournamentModeOptions().map(([value,label])=>`<option value="${value}" ${customTournamentDraft.mode===value?'selected':''}>${label}</option>`).join('')}</select></div>
        <div><label class="field-label">VENUE</label><select class="team-select" data-custom-arena>${arenas.map(a=>`<option value="${esc(a.name)}" ${a.name===customTournamentDraft.arena?'selected':''}>${esc(a.name)}${isDone('arenas',a.name)?' - DONE':' - MISSING'}</option>`).join('')}</select></div>
      </div>
      <label class="field-label">${noun}</label>
      <input class="team-input" data-custom-search placeholder="Search ${mode.type==='Tag'?'teams':'wrestlers'}...">
      <div class="custom-pick-tools"><span data-custom-selected-count>${selected.size} selected</span><div><button class="mini-btn" data-custom-select-shown>SELECT SHOWN</button><button class="mini-btn" data-custom-clear>CLEAR</button></div></div>
      <div class="custom-roster-list">${choices.map(c=>`<label class="custom-wrestler-row" data-custom-search-name="${esc(c.search)}"><input type="checkbox" data-custom-entry value="${esc(c.value)}" ${selected.has(c.value)?'checked':''}><span class="custom-wrestler-name">${esc(c.title)}${c.subtitle?`<small>${esc(c.subtitle)}</small>`:''}</span><span class="pill ${customTournamentStatusClass(c.status)}">${esc(c.status)}</span></label>`).join('')}</div>
      <div class="custom-builder-foot"><div class="custom-builder-note">Choose 2 or more ${mode.type==='Tag'?'teams':'wrestlers'}. BYEs are added randomly to make the knockout draw work.</div><button class="chaos-advance" data-custom-start>START CUSTOM CHAOS</button></div>
    </div>
  </div>`;
}
function refreshCustomSelectedCount(){
  const el=document.querySelector('[data-custom-selected-count]');
  if(el)el.textContent=`${customTournamentDraft?.selected?.length||0} selected`;
}
function startCustomTournament(){
  if(!customTournamentDraft)return;
  const name=(customTournamentDraft.name||'').trim();
  if(!name){alert('Give the custom tournament a name first.');return}
  const entrants=[...new Set(customTournamentDraft.selected||[])];
  const mode=customTournamentModeParts(customTournamentDraft.mode);
  if(entrants.length<2){alert(`Pick at least two ${mode.type==='Tag'?'teams':'wrestlers'}.`);return}
  const def={
    _customId:newCustomTournamentId(),
    competition:name,
    type:mode.type,
    division:mode.division,
    format:'KO',
    finalArena:customTournamentDraft.arena||'User choice',
    customEntrants:entrants,
    createdAt:new Date().toISOString()
  };
  const defs=loadCustomTournamentDefs();
  defs.push(def);
  saveCustomTournamentDefs(defs);
  customTournamentDraft=null;
  startChaosTournament(tournamentKey(def));
}
function deleteCustomTournament(key){
  const def=tournamentByKey(key);
  if(!def?._customId)return;
  if(!confirm(`Delete custom tournament "${def.competition}"?`))return;
  saveCustomTournamentDefs(loadCustomTournamentDefs().filter(x=>tournamentKey(x)!==key));
  const runs=loadTournamentRuns();
  delete runs[key];
  saveTournamentRuns(runs);
  if(state.activeTournamentKey===key)state.activeTournamentKey=null;
  render();
}
function tournaments(){
  const runs=loadTournamentRuns();
  if(state.activeTournamentKey){
    const t=tournamentByKey(state.activeTournamentKey);
    const run=runs[state.activeTournamentKey];
    if(t&&run)return chaosTournamentDetail(t,run);
    state.activeTournamentKey=null;
  }
  const customDefs=loadCustomTournamentDefs();
  const customCards=customDefs.map(t=>{
    const key=tournamentKey(t),run=runs[key],n=t.customEntrants?.length||0;
    const status=run?.status==='ACTIVE'
      ? `<span class="pill warn">IN PROGRESS</span>`
      : run?.status==='COMPLETE'
        ? `<span class="pill good">CHAMPION: ${esc(run.champion||'TBA')}</span>`
        : `<span class="pill custom-pill">CUSTOM</span>`;
    const action=run?.status==='ACTIVE'
      ? `<button class="small-action" data-chaos-open="${esc(key)}">RESUME CHAOS</button>`
      : run?.status==='COMPLETE'
        ? `<button class="small-action" data-chaos-open="${esc(key)}">VIEW RESULT</button>`
        : `<button class="small-action" data-chaos-start="${esc(key)}">START CHAOS</button>`;
    const label=t.type==='Tag'?(t.division==='Mixed'?'Mixed Tag':`${t.division} Tag`):`${t.division} Singles`;
    return `<div class="card tournament-card custom-tournament-card">
      <div class="tournament-card-head"><h4>${esc(t.competition)}</h4>${status}</div>
      <p>Custom ${esc(label)} &bull; ${n} chosen entrants</p>
      <p>Random valid match type on every match &bull; random BYEs when needed</p>
      <p>Venue: ${esc(t.finalArena||'User choice')}</p>
      <div class="custom-card-actions"><div>${action}</div><button class="mini-btn danger-btn" data-custom-delete="${esc(key)}">DELETE</button></div>
    </div>`;
  }).join('');
  const builtInCards=state.data.tournaments.map(t=>{
    const n=competitionCount(t),key=tournamentKey(t),run=runs[key];
    const status=run?.status==='ACTIVE'
      ? `<span class="pill warn">IN PROGRESS</span>`
      : run?.status==='COMPLETE'
        ? `<span class="pill good">CHAMPION: ${esc(run.champion||'TBA')}</span>`
        : `<span class="pill">${bracketAdvice(n)}</span>`;
    const action=run?.status==='ACTIVE'
      ? `<button class="small-action" data-chaos-open="${esc(key)}">RESUME CHAOS</button>`
      : run?.status==='COMPLETE'
        ? `<button class="small-action" data-chaos-open="${esc(key)}">VIEW RESULT</button>`
        : `<button class="small-action" data-chaos-start="${esc(key)}" ${n<2?'disabled':''}>${n<2?'WAITING':'START CHAOS'}</button>`;
    return `<div class="card tournament-card">
      <div class="tournament-card-head"><h4>${esc(t.competition)}</h4>${status}</div>
      <p>${esc(t.type)} &bull; ${esc(t.division)} &bull; ${n} unlocked entrants</p>
      <p>Match pool is built from WWE ${esc(state.game)} tournament types and rerolls independently for every match.</p>
      <p>Final arena: ${esc(t.finalArena||'TBA')}</p>
      <div class="tournament-card-action">${action}</div>
    </div>`;
  }).join('');
  return `${customTournamentBuilder()}
    <div class="section-title custom-tournament-title"><div><h3>Tournaments</h3><span>Title tournaments + make-your-own CHAOS</span></div><button class="small-action" data-custom-create>+ CUSTOM TOURNAMENT</button></div>
    ${customDefs.length?`<div class="custom-tournament-heading">CUSTOM TOURNAMENTS</div><div class="cards tournament-cards">${customCards}</div><div class="custom-tournament-heading standard-heading">CHAMPIONSHIP TOURNAMENTS</div>`:''}
    <div class="cards tournament-cards">${builtInCards}</div>`;
}
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
}const UI_TEXT_FIXES=[
  ['\u00D4\u00C7\u00F3','\u2022'],
  ['\u00E2\u20AC\u00A2','\u2022'],
  ['\u00D4\u00C7\u00AA','\u2026'],
  ['\u00E2\u20AC\u00A6','\u2026'],
  ['\u00D4\u00E5\u00C9','\u2190'],
  ['\u00D4\u00E5\u00C6','\u2192'],
  ['\u00E2\u2020\u2019','\u2192'],
  ['\u00D4\u00C7\u00D6','\u2019'],
  ['\u00E2\u20AC\u2122','\u2019'],
  ['\u00D4\u00C7\u00FF','\u2018'],
  ['\u00E2\u20AC\u02DC','\u2018'],
  ['\u00D4\u00C7\u00A3','\u201C'],
  ['\u00E2\u20AC\u0153','\u201C'],
  ['\u00D4\u00C7\u00D8','\u201D'],
  ['\u00D4\u00C7\u00F4','\u2013'],
  ['\u00E2\u20AC\u201C','\u2013'],
  ['\u00D4\u00C7\u00F6','\u2014'],
  ['\u00E2\u20AC\u201D','\u2014'],
  ['\u00D4\u00E4\u00F3','\u2122'],
  ['\u00E2\u201E\u00A2','\u2122'],
  ['\u252C\u00AB','\u00AE'],
  ['\u00C2\u00AE','\u00AE'],
  ['\u252C\u00AE','\u00A9'],
  ['\u00C2\u00A9','\u00A9'],
  ['\u251C\u00F9','\u00D7'],
  ['\u00C3\u2014','\u00D7'],
  ['\u251C\u00ED','\u00E1'],
  ['\u00C3\u00A1','\u00E1'],
  ['\u251C\u00AE','\u00E9'],
  ['\u00C3\u00A9','\u00E9'],
  ['\u251C\u00A1','\u00ED'],
  ['\u00C3\u00AD','\u00ED'],
  ['\u251C\u2502','\u00F3'],
  ['\u00C3\u00B3','\u00F3'],
  ['\u251C\u2551','\u00FA'],
  ['\u00C3\u00BA','\u00FA'],
  ['\u251C\u2592','\u00F1'],
  ['\u00C3\u00B1','\u00F1'],
  ['\u251C\u00C2','\u00F6'],
  ['\u00C3\u00B6','\u00F6'],
  ['\u251C\u255D','\u00FC'],
  ['\u00C3\u00BC','\u00FC'],
  ['\u251C\u00FC','\u00C1'],
  ['\u251C\u00EB','\u00C9'],
  ['\u00C3\u2030','\u00C9'],
  ['\u251C\u00EC','\u00CD'],
  ['\u251C\u00F4','\u00D3'],
  ['\u00C3\u201C','\u00D3'],
  ['\u251C\u00DC','\u00DA'],
  ['\u00C3\u0161','\u00DA'],
  ['\u251C\u00E6','\u00D1'],
  ['\u00C3\u2018','\u00D1'],
  ['\u251C\u00FB','\u00D6'],
  ['\u00C3\u2013','\u00D6'],
  ['\u251C\u00A3','\u00DC'],
  ['\u00C3\u0153','\u00DC'],
  ['&BULL;','\u2022'],
  ['&bull;','\u2022'],
  ['&#8226;','\u2022'],
  ['&amp;bull;','\u2022'],
  ['\\u2022','\u2022'],
  ['\\u2026','\u2026'],
  ['\\u2190','\u2190'],
  ['\\u2192','\u2192']
];
function cleanUiText(value){
  let s=String(value);
  for(const [bad,good] of UI_TEXT_FIXES){
    if(s.includes(bad)) s=s.split(bad).join(good);
  }
  return s;
}
function render(){app.innerHTML=cleanUiText(state.view==='home'?home():game());const f=document.querySelector('[data-input="filter"]');if(f)f.value=state.filter}

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
// === WTU CHAOS TOURNAMENT CLICKS v1 ===
document.addEventListener('click',e=>{
  const list=e.target.closest('[data-chaos-list]');
  if(list){state.activeTournamentKey=null;render();return}
  const open=e.target.closest('[data-chaos-open]');
  if(open){state.activeTournamentKey=open.dataset.chaosOpen;render();return}
  const start=e.target.closest('[data-chaos-start]');
  if(start){startChaosTournament(start.dataset.chaosStart);return}
  const reroll=e.target.closest('[data-chaos-reroll]');
  if(reroll){rerollChaosMatch(reroll.dataset.chaosReroll,reroll.dataset.chaosMatch);return}
  const winner=e.target.closest('[data-chaos-winner]');
  if(winner){setChaosWinner(winner.dataset.chaosWinner,winner.dataset.chaosMatch,winner.dataset.chaosName);return}
  const advance=e.target.closest('[data-chaos-advance]');
  if(advance){advanceChaosTournament(advance.dataset.chaosAdvance);return}
  const abandon=e.target.closest('[data-chaos-abandon]');
  if(abandon){abandonChaosTournament(abandon.dataset.chaosAbandon);return}
});
// === WTU CUSTOM CHAOS TOURNAMENT CLICKS v1 ===
document.addEventListener('click',e=>{
  const create=e.target.closest('[data-custom-create]');
  if(create){openCustomTournamentBuilder();return}
  const close=e.target.closest('[data-custom-close]');
  if(close){closeCustomTournamentBuilder();return}
  const start=e.target.closest('[data-custom-start]');
  if(start){startCustomTournament();return}
  const del=e.target.closest('[data-custom-delete]');
  if(del){deleteCustomTournament(del.dataset.customDelete);return}
  const clear=e.target.closest('[data-custom-clear]');
  if(clear&&customTournamentDraft){customTournamentDraft.selected=[];document.querySelectorAll('[data-custom-entry]').forEach(x=>x.checked=false);refreshCustomSelectedCount();return}
  const selectShown=e.target.closest('[data-custom-select-shown]');
  if(selectShown&&customTournamentDraft){
    const selected=new Set(customTournamentDraft.selected||[]);
    document.querySelectorAll('.custom-wrestler-row').forEach(row=>{
      if(row.style.display==='none')return;
      const box=row.querySelector('[data-custom-entry]');
      if(box){box.checked=true;selected.add(box.value)}
    });
    customTournamentDraft.selected=[...selected];
    refreshCustomSelectedCount();
    return;
  }
});
document.addEventListener('input',e=>{
  if(e.target.matches('[data-custom-name]')&&customTournamentDraft){customTournamentDraft.name=e.target.value;return}
  if(e.target.matches('[data-custom-search]')){
    const q=e.target.value.trim().toLowerCase();
    document.querySelectorAll('.custom-wrestler-row').forEach(row=>{row.style.display=!q||row.dataset.customSearchName.includes(q)?'':'none'});
  }
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-custom-mode]')&&customTournamentDraft){
    customTournamentDraft.mode=e.target.value;
    customTournamentDraft.selected=[];
    render();
    return;
  }
  if(e.target.matches('[data-custom-arena]')&&customTournamentDraft){customTournamentDraft.arena=e.target.value;return}
  if(e.target.matches('[data-custom-entry]')&&customTournamentDraft){
    const selected=new Set(customTournamentDraft.selected||[]);
    if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);
    customTournamentDraft.selected=[...selected];
    refreshCustomSelectedCount();
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

document.addEventListener('click',async e=>{
  const hg=e.target.closest('[data-home-game]');
  if(hg){
    e.preventDefault();
    await selectHomeGame(hg.dataset.homeGame);
    return;
  }
  const hs=e.target.closest('[data-home-section]');
  if(hs){
    e.preventDefault();
    const game=state.homeGame||'2K15';
    await openGame(game);
    state.section=hs.dataset.homeSection;
    state.query='';
    state.filter='ALL';
    render();
  }
});render();