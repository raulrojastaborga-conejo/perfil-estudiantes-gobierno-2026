let teamsData=[];let matches=[];let players=[];let odds=[];let playersMeta={};
const $=s=>document.querySelector(s);
async function getJson(url,fb){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return await r.json()}catch(e){return fb}}
function unwrap(payload,key){return payload&&payload.data&&payload.data[key]?payload.data[key]:payload}
function normalizeMatch(m){return Object.assign({},m,{gh:m.gh??m.score_home??'',ga:m.ga??m.score_away??''})}
async function load(){
  const ofTeams=await getJson('data/openfootball_teams.json',null);
  const ofMatches=await getJson('data/openfootball_matches.json',null);
  teamsData=unwrap(ofTeams,'groups')||await getJson('data/teams.json',[]);
  const base=(unwrap(ofMatches,'matches')||await getJson('data/matches.json',[])).map(normalizeMatch);
  const squadPayload=await getJson('data/squads_crosscheck.json',null);
  const playersPayload=squadPayload||await getJson('data/players.json',{players:[]});
  players=Array.isArray(playersPayload)?playersPayload:(playersPayload.players||[]);
  playersMeta=Array.isArray(playersPayload)?{}:playersPayload;
  odds=await getJson('data/odds.json',[]);
  const saved=JSON.parse(localStorage.getItem('wc26_matches')||'null');
  matches=(saved&&saved.length?mergeSaved(base,saved):base);
  const gf=$('#groupFilter');
  if(gf) gf.innerHTML='<option value="">Todos los grupos</option>'+teamsData.map(g=>'<option value="'+g.group+'">Grupo '+g.group+'</option>').join('');
  renderAll();
}
function mergeSaved(base,saved){const byId=Object.fromEntries(saved.map(m=>[m.id,m]));return base.map(m=>Object.assign({},m,{gh:byId[m.id]?.gh??m.gh??'',ga:byId[m.id]?.ga??m.ga??'',channel:byId[m.id]?.channel??m.channel}))}
function save(){localStorage.setItem('wc26_matches',JSON.stringify(matches))}
function renderAll(){renderMatches();renderStandings();renderPlayers();renderThirds();renderBracket()}
function updateMatch(id,k,v){matches=matches.map(m=>m.id===id?Object.assign({},m,{[k]:v}):m);save();renderMatches();renderStandings();renderThirds();renderBracket()}
function oddsHtml(m){const o=odds.find(x=>x.match_id===m.id);if(!o)return '<div class="odds"><b>Pronóstico</b><div class="mini">Sin probabilidades cargadas.</div></div>';const r=(n,v)=>'<div class="odd-row"><span>'+n+'</span><div class="bar"><div class="fill" style="width:'+v+'%"></div></div><b>'+v+'%</b></div>';return '<div class="odds"><b>Pronóstico</b>'+r(m.home,o.home_win)+r('Empate',o.draw)+r(m.away,o.away_win)+'<div class="source">Fuente: '+o.source+' · '+o.updated_at+'</div></div>'}
function renderMatches(){const box=$('#matches');if(!box)return;const q=($('#search')?.value||'').toLowerCase(),g=$('#groupFilter')?.value||'',d=$('#dateFilter')?.value||'';box.innerHTML=matches.filter(m=>(!g||m.group===g)&&(!d||m.date===d)&&[m.group,m.home,m.away,m.channel,m.date,m.venue].join(' ').toLowerCase().includes(q)).map(m=>'<div class="match"><div><b>Grupo '+m.group+'</b><div class="mini">'+m.date+' · '+m.time_cl+' Chile · '+(m.venue||'Sede por confirmar')+'</div></div><div class="score"><span class="team">'+m.home+'</span><input value="'+(m.gh||'')+'" oninput="updateMatch(\''+m.id+'\',\'gh\',this.value)"><input value="'+(m.ga||'')+'" oninput="updateMatch(\''+m.id+'\',\'ga\',this.value)"><span class="team">'+m.away+'</span></div><div><input value="'+(m.channel||'Por definir')+'" oninput="updateMatch(\''+m.id+'\',\'channel\',this.value)"></div>'+oddsHtml(m)+'</div>').join('')||'<p class="mini">No hay partidos para mostrar.</p>'}
function calcGroup(group){const gi=teamsData.find(x=>x.group===group);if(!gi)return[];const t={};gi.teams.forEach(n=>t[n]={team:n,group,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0});matches.filter(m=>m.group===group&&m.gh!==''&&m.ga!=='').forEach(m=>{let h=+m.gh,a=+m.ga;if(isNaN(h)||isNaN(a))return;[m.home,m.away].forEach(n=>{if(!t[n])t[n]={team:n,group,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0}});t[m.home].pj++;t[m.away].pj++;t[m.home].gf+=h;t[m.home].gc+=a;t[m.away].gf+=a;t[m.away].gc+=h;if(h>a){t[m.home].pg++;t[m.away].pp++;t[m.home].pts+=3}else if(a>h){t[m.away].pg++;t[m.home].pp++;t[m.away].pts+=3}else{t[m.home].pe++;t[m.away].pe++;t[m.home].pts++;t[m.away].pts++}});Object.values(t).forEach(x=>x.dg=x.gf-x.gc);return Object.values(t).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||a.team.localeCompare(b.team))}
function rows(arr,third=false){return arr.map((r,i)=>'<tr><td>'+(third&&i<8?'<span class="badge ok">Clasifica</span> ':'')+(i<2&&!third?'🏆 ':'')+r.team+' <span class="mini">'+(third?'Grupo '+r.group:'')+'</span></td><td><b>'+r.pts+'</b></td><td>'+r.pj+'</td><td>'+r.pg+'</td><td>'+r.pe+'</td><td>'+r.pp+'</td><td>'+r.gf+'</td><td>'+r.gc+'</td><td>'+r.dg+'</td></tr>').join('')}
function table(body){return '<div class="third-table"><table><thead><tr><th>Equipo</th><th>PTS</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th></tr></thead><tbody>'+body+'</tbody></table></div>'}
function renderStandings(){const b=$('#standings');if(b)b.innerHTML=teamsData.map(g=>'<div class="card"><h3>Grupo '+g.group+'</h3>'+table(rows(calcGroup(g.group)))+'</div>').join('')}
function getThirds(){return teamsData.map(g=>calcGroup(g.group)[2]).filter(Boolean).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf)}
function renderThirds(){const b=$('#thirds');if(b)b.innerHTML=table(rows(getThirds(),true))}
function renderPlayers(){const b=$('#players');if(!b)return;if(!players.length){b.innerHTML='<div class="card"><h3>Convocatorias pendientes</h3><p class="mini">'+(playersMeta.note||'Aún no hay jugadores verificados para mostrar.')+'</p></div>';return}const intro='<div class="card"><h3>Convocatorias referenciales cruzadas</h3><p class="mini">'+(playersMeta.note||'Datos preliminares.')+'</p></div>';b.innerHTML=intro+players.map(p=>'<div class="player"><b>'+p.team+'</b><span>'+p.name+'</span><span class="badge">'+p.position+'</span><span class="badge">'+(p.squad_status||p.status||'sin estado')+'</span><span class="mini">Club: '+(p.club||'s/d')+' · Fuente base: '+(p.source_primary||p.source_id||'sin fuente')+' · Confianza: '+(p.confidence||'s/d')+'</span></div>').join('')}
function renderBracket(){const b=$('#bracket');if(!b)return;const q=[...teamsData.flatMap(g=>calcGroup(g.group).slice(0,2)),...getThirds().slice(0,8)];b.innerHTML='<div class="bracket-note"><b>Clasificados simulados: '+q.length+'/32</b><p class="mini">Cruces exactos pendientes de regla oficial FIFA.</p>'+q.map(x=>'<span class="badge">'+x.team+'</span> ').join('')+'</div>'}
document.addEventListener('click',e=>{if(e.target.classList.contains('tab')){document.querySelectorAll('.tab,.section').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');const t=document.getElementById(e.target.dataset.tab);if(t)t.classList.add('active')}});
window.resetSim=()=>{localStorage.removeItem('wc26_matches');location.reload()};
load();