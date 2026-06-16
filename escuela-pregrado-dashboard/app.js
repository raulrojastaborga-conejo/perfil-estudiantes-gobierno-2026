let M = [];
let T = [];
let sourceName = "Cargar Excel";
const fmt = new Intl.NumberFormat('es-CL');
const charts = {};

const ids = ['yearFilter','careerFilter','descFilter','tipoFilter','sexFilter'];
ids.forEach(id => document.getElementById(id).addEventListener('change', render));
document.getElementById('resetFilters').addEventListener('click', () => {
  ids.forEach(id => [...document.getElementById(id).options].forEach(o => o.selected = false));
  render();
});
document.getElementById('fileInput').addEventListener('change', handleFile);

function normalizeKey(k){ return String(k || '').trim(); }
function cleanCareer(s){
  if(!s) return 'Sin dato';
  return String(s).replace(/^\d+\s+/, '').trim();
}
function asInt(v){
  if(v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(',','.'), 10);
  return Number.isFinite(n) ? n : null;
}
function asFloat(v){
  if(v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',','.'));
  return Number.isFinite(n) ? n : null;
}
function yearFromDate(v){
  if(v instanceof Date) return v.getFullYear();
  const s = String(v || '');
  const m = s.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}
function uniq(arr){ return [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ""))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true})); }
function selected(id){ return [...document.getElementById(id).selectedOptions].map(o => o.value); }
function includesOrAll(values, value){ return values.length === 0 || values.includes(String(value)); }
function fillSelect(id, values){
  const el = document.getElementById(id);
  el.innerHTML = values.map(v => `<option value="${String(v).replaceAll('"','&quot;')}">${v}</option>`).join('');
}

async function handleFile(ev){
  const file = ev.target.files[0];
  if(!file) return;
  sourceName = file.name;
  document.getElementById('sourceFile').textContent = file.name;
  document.getElementById('loadStatus').textContent = 'Leyendo archivo...';

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, {type:'array', cellDates:true});
  const matSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('matricula')) || wb.SheetNames[0];
  const titSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('titulado')) || wb.SheetNames[1];

  const matRows = XLSX.utils.sheet_to_json(wb.Sheets[matSheetName], {defval:null});
  const titRows = XLSX.utils.sheet_to_json(wb.Sheets[titSheetName], {defval:null});

  M = matRows.map(r => ({
    anio: asInt(r['AÑO MATRICULA']),
    carrera: cleanCareer(r['carrera']),
    descripcion: normalizeKey(r['descripcion']) || 'Sin dato',
    sexo: normalizeKey(r['SEXO']) || 'Sin dato',
    tipo: normalizeKey(r['TIPO']) || 'Sin dato',
    tipo_ingreso: normalizeKey(r['TIPO INGRESO']) || 'Sin dato',
    tipo_establecimiento: normalizeKey(r['TIPO ESTABLECIMIENTO']) || 'Sin dato',
    cohorte: asInt(r['Cohorte']),
    n: 1
  })).filter(r => r.anio);

  const seen = new Map();
  for(const r of titRows){
    const key = `${r['MATRICULA'] || ''}|${r['RUT'] || ''}|${r['FECHA_RESOLUCION'] || ''}`;
    if(!seen.has(key)){
      seen.set(key, {
        anio: yearFromDate(r['FECHA_RESOLUCION']),
        carrera: cleanCareer(r['CARRERA']),
        sexo: normalizeKey(r['SEXO']) || 'Sin dato',
        cohorte: asInt(r['COHORTE']),
        estado: normalizeKey(r['ESTADO']) || 'Sin dato',
        tesis: normalizeKey(r['TESIS']) || 'Sin dato',
        nota_final: asFloat(r['NOTA_FINAL']),
        n: 1
      });
    }
  }
  T = [...seen.values()].filter(r => r.anio);

  fillFilters();
  document.getElementById('loadStatus').textContent = `Archivo cargado: ${fmt.format(M.length)} registros de matrícula y ${fmt.format(T.length)} titulados/as deduplicados/as.`;
  render();
}

function fillFilters(){
  fillSelect('yearFilter', uniq(M.map(r => r.anio)));
  fillSelect('careerFilter', uniq(M.map(r => r.carrera)));
  fillSelect('descFilter', uniq(M.map(r => r.descripcion)));
  fillSelect('tipoFilter', uniq(M.map(r => r.tipo)));
  fillSelect('sexFilter', uniq(M.map(r => r.sexo)));
}

function filteredMatricula(){
  const years = selected('yearFilter');
  const careers = selected('careerFilter');
  const desc = selected('descFilter');
  const tipos = selected('tipoFilter');
  const sex = selected('sexFilter');
  return M.filter(r =>
    includesOrAll(years, r.anio) &&
    includesOrAll(careers, r.carrera) &&
    includesOrAll(desc, r.descripcion) &&
    includesOrAll(tipos, r.tipo) &&
    includesOrAll(sex, r.sexo)
  );
}
function filteredTitulados(){
  const years = selected('yearFilter');
  const careers = selected('careerFilter');
  const sex = selected('sexFilter');
  return T.filter(r =>
    includesOrAll(years, r.anio) &&
    includesOrAll(careers, r.carrera) &&
    includesOrAll(sex, r.sexo)
  );
}
function sumBy(rows, key){
  const out = {};
  for(const r of rows){ out[r[key] ?? 'Sin dato'] = (out[r[key] ?? 'Sin dato'] || 0) + r.n; }
  return out;
}
function topEntries(obj, n=15){ return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n); }

function chart(id, type, labels, values, title){
  if(charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets: [{ label: title, data: values, borderWidth: 2, tension: .25 }] },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(c)=>`${title}: ${fmt.format(c.raw)}`}}},
      scales: type === 'doughnut' ? {} : { y:{beginAtZero:true,ticks:{callback:v=>fmt.format(v)}} }
    }
  });
}

function renderTables(matRows, titRows){
  const matGrouped = {};
  for(const r of matRows){
    const key = `${r.anio}|${r.carrera}|${r.descripcion}`;
    matGrouped[key] = (matGrouped[key] || 0) + r.n;
  }
  const mat = Object.entries(matGrouped).map(([k,n]) => {
    const [anio,carrera,descripcion] = k.split('|');
    return {anio,carrera,descripcion,n};
  }).sort((a,b)=> Number(b.anio)-Number(a.anio) || a.carrera.localeCompare(b.carrera,'es')).slice(0,150);
  document.querySelector('#tableMatricula tbody').innerHTML = mat.map(r =>
    `<tr><td>${r.anio}</td><td>${r.carrera}</td><td>${r.descripcion}</td><td>${fmt.format(r.n)}</td></tr>`
  ).join('');

  const titGrouped = {};
  const nota = {};
  for(const r of titRows){
    const key = `${r.anio}|${r.carrera}`;
    titGrouped[key] = (titGrouped[key] || 0) + r.n;
    if(r.nota_final){ nota[key] = nota[key] || {sum:0,n:0}; nota[key].sum += r.nota_final; nota[key].n += 1; }
  }
  const tit = Object.entries(titGrouped).map(([k,n]) => {
    const [anio,carrera] = k.split('|');
    const prom = nota[k]?.n ? (nota[k].sum/nota[k].n).toFixed(2) : '—';
    return {anio,carrera,n,prom};
  }).sort((a,b)=> Number(b.anio)-Number(a.anio) || a.carrera.localeCompare(b.carrera,'es')).slice(0,150);
  document.querySelector('#tableTitulados tbody').innerHTML = tit.map(r =>
    `<tr><td>${r.anio}</td><td>${r.carrera}</td><td>${fmt.format(r.n)}</td><td>${r.prom}</td></tr>`
  ).join('');
}

function render(){
  const matRows = filteredMatricula();
  const titRows = filteredTitulados();

  const totalMat = matRows.reduce((a,r)=>a+r.n,0);
  const totalTit = titRows.reduce((a,r)=>a+r.n,0);
  document.getElementById('kpiMatricula').textContent = fmt.format(totalMat);
  document.getElementById('kpiTitulados').textContent = fmt.format(totalTit);
  document.getElementById('kpiCarreras').textContent = fmt.format(uniq(matRows.map(r=>r.carrera)).length);
  const years = uniq(matRows.map(r=>r.anio)).map(Number);
  document.getElementById('kpiPeriodo').textContent = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';

  const byYear = sumBy(matRows,'anio');
  const yearLabels = Object.keys(byYear).sort((a,b)=>Number(a)-Number(b));
  chart('chartMatriculaAnio','line',yearLabels,yearLabels.map(y=>byYear[y]),'Matrícula');

  const byCareer = topEntries(sumBy(matRows,'carrera'),10);
  chart('chartMatriculaCarrera','doughnut',byCareer.map(e=>e[0]),byCareer.map(e=>e[1]),'Matrícula');

  const byDesc = topEntries(sumBy(matRows,'descripcion'),12);
  chart('chartDescripcion','bar',byDesc.map(e=>e[0]),byDesc.map(e=>e[1]),'Matrícula');

  const byTitYear = sumBy(titRows,'anio');
  const titLabels = Object.keys(byTitYear).sort((a,b)=>Number(a)-Number(b));
  chart('chartTituladosAnio','bar',titLabels,titLabels.map(y=>byTitYear[y]),'Titulados/as');

  renderTables(matRows, titRows);
}

fillFilters();
render();
