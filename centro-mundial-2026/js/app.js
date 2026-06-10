let teamsData=[];let matches=[];let players=[];let odds=[];
const $=s=>document.querySelector(s);

const fallbackTeams=[
  {group:'A',teams:['México','Sudáfrica','Corea del Sur','Ganador playoff']},
  {group:'B',teams:['Canadá','Suiza','Qatar','Ganador playoff']},
  {group:'C',teams:['Brasil','Marruecos','Haití','Escocia']},
  {group:'D',teams:['Estados Unidos','Paraguay','Australia','Ganador playoff']},
  {group:'E',teams:['Alemania','Curazao','Costa de Marfil','Ecuador']},
  {group:'F',teams:['Países Bajos','Japón','Túnez','Ganador playoff']},
  {group:'G',teams:['Bélgica','Egipto','Irán','Nueva Zelanda']},
  {group:'H',teams:['España','Cabo Verde','Arabia Saudita','Uruguay']},
  {group:'I',teams:['Francia','Senegal','Noruega','Ganador playoff']},
  {group:'J',teams:['Argentina','Argelia','Austria','Jordania']},
  {group:'K',teams:['Inglaterra','Croacia','Ghana','Panamá']},
  {group:'L',teams:['Portugal','Colombia','Uzbekistán','Ganador playoff']}
];
const fallbackMatches=[
  {id:'A1',group:'A',date:'2026-06-11',time_cl:'20:00',home:'México',away:'Sudáfrica',channel:'Por definir',gh:'',ga:''},
  {id:'A2',group:'A',date:'2026-06-12',time_cl:'17:00',home:'Corea del Sur',away:'Ganador playoff',channel:'Por definir',gh:'',ga:''},
  {id:'C1',group:'C',date:'2026-06-13',time_cl:'20:00',home:'Brasil',away:'Marruecos',channel:'Por definir',gh:'',ga:''},
  {id:'C2',group:'C',date:'2026-06-14',time_cl:'17:00',home:'Haití',away:'Escocia',channel:'Por definir',gh:'',ga:''},
  {id:'J1',group:'J',date:'2026-06-16',time_cl:'20:00',home:'Argentina',away:'Argelia',channel:'Por definir',gh:'',ga:''}
];
const fallbackPlayers=[
  {team:'Argentina',name:'Lionel Messi',position:'Delantero',status:'Disponible'},
  {team:'Francia',name:'Kylian Mbappé',position:'Delantero',status:'Disponible'},
  {team:'Brasil',name:'Vinícius Jr.',position:'Delantero',status:'Disponible'},
  {team:'Portugal',name:'Cristiano Ronaldo',position:'Delantero',status:'Disponible'}
];
const fallbackOdds=[
  {match_id:'A1',home_win:55,draw:26,away_win:19,source:'manual inicial',updated_at:'2026-06-10'},
  {match_id:'C1',home_win:62,draw:23,away_win:15,source:'manual inicial',updated_at:'2026-06-10'},
  {match_id:'J1',home_win:70,draw:19,away_win:11,source:'manual inicial',updated_at:'2026-06-10'}
];

async function safeJson(url,fallback){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url);return await r.json();}catch(e){console.warn('Usando fallback para',url,e);return fallback;}}
async function load(){teamsData=await safeJson('data/teams.json',fallbackTeams);const base=await safeJson('data/matches.json',fallbackMatches);players=await safeJson('data/players.json',fallbackPlayers);odds=await safeJson('data/odds.json',fallbackOdds);matches=JSON.parse(localStorage.getItem('wc26_matches')||'null')||base;renderAll();}
function save(){localStorage.setItem('wc26_matches',JSON.stringify(matches));}
function renderAll(){renderMatches();renderStandings();renderPlayers();}
function updateMatch(id,key,value){matches=matches.map(m=>m.id===id?{...m,[key]:value}:m);save();renderStandings();}
function oddsHtml(m){const o=odds.find(x=>x.match_id===m.id);if(!o)return '<div class="odds"><b>Pronóstico</b><div class="mini">Sin probabilidades cargadas todavía.</div></div>';const row=(label,val)=>`<div class="odd-row"><span>${label}</span><div class="bar"><div class="fill" style="width:${val}%"></div></div><b>${val}%</b></div>`;return `<div class="odds"><b>Pronóstico del partido</b>${row(m.home,o.home_win)}${row('Empate',o.draw)}${row(m.away,o.away_win)}<div class="source">Fuente: ${o.source} · actualizado ${o.updated_at}</div></div>`;}
function renderMatches(){const box=$('#matches');if(!box)return;const q=($('#search')?.value||'').toLowerCase();box.innerHTML=matches.filter(m=>[m.group,m.home,m.away,m.channel,m.date].join(' ').toLowerCase().includes(q)).map(m=>`<div class="match"><div><b>Grupo ${m.group}</b><div class="mini">${m.date} · ${m.time_cl} Chile</div></div><div class="score"><span class="team">${m.home}</span><input value="${m.gh??''}" oninput="updateMatch('${m.id}','gh',this.value)"><input value="${m.ga??''}" oninput="updateMatch('${m.id}','ga',this.value)"><span class="team">${m.away}</span></div><div><input value="${m.channel??'Por definir'}" oninput="updateMatch('${m.id}','channel',this.value)"></div>${oddsHtml(m)}</div>`).join('')||'<p class="mini">No hay partidos para mostrar.</p>';}
function calcGroup(group){const groupInfo=teamsData.find(g=>g.group===group);if(!groupInfo)return[];let table={};groupInfo.teams.forEach(t=>table[t]={team:t,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0});matches.filter(m=>m.group===group&&m.gh!==''&&m.ga!=='').forEach(m=>{const h=Number(m.gh),a=Number(m.ga);if(Number.isNaN(h)||Number.isNaN(a))return;if(!table[m.home])table[m.home]={team:m.home,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0};if(!table[m.away])table[m.away]={team:m.away,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0};table[m.home].pj++;table[m.away].pj++;table[m.home].gf+=h;table[m.home].gc+=a;table[m.away].gf+=a;table[m.away].gc+=h;if(h>a){table[m.home].pg++;table[m.away].pp++;table[m.home].pts+=3}else if(a>h){table[m.away].pg++;table[m.home].pp++;table[m.away].pts+=3}else{table[m.home].pe++;table[m.away].pe++;table[m.home].pts++;table[m.away].pts++}});Object.values(table).forEach(t=>t.dg=t.gf-t.gc);return Object.values(table).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||a.team.localeCompare(b.team));}
function renderStandings(){const box=$('#standings');if(!box)return;box.innerHTML=teamsData.map(g=>`<div class="card"><h3>Grupo ${g.group}</h3><table><thead><tr><th>Equipo</th><th>PTS</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th></tr></thead><tbody>${calcGroup(g.group).map((r,i)=>`<tr><td>${i<2?'🏆 ':''}${r.team}</td><td><b>${r.pts}</b></td><td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td><td>${r.gf}</td><td>${r.gc}</td><td>${r.dg}</td></tr>`).join('')}</tbody></table></div>`).join('');}
function renderPlayers(){const box=$('#players');if(!box)return;box.innerHTML=players.map(p=>`<div class="player"><b>${p.team}</b><span>${p.name}</span><span class="badge">${p.position}</span><span class="badge">${p.status}</span></div>`).join('')||'<p class="mini">No hay jugadores cargados.</p>';}
document.addEventListener('click',e=>{if(e.target.classList.contains('tab')){document.querySelectorAll('.tab,.section').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');const target=document.getElementById(e.target.dataset.tab);if(target)target.classList.add('active');}});
window.resetSim=()=>{localStorage.removeItem('wc26_matches');location.reload();};
load();
