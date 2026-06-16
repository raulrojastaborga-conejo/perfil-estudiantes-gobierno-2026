let M = [];
let T = [];
let sourceName = "Cargar Excel";
const fmt = new Intl.NumberFormat('es-CL');
const charts = {};

const ids = ['yearFilter','careerFilter','descFilter','tipoFilter','tipoIngresoFilter','regionFilter','sexFilter'];
ids.forEach(id => document.getElementById(id).addEventListener('change', render));
document.getElementById('resetFilters').addEventListener('click', () => {
  ids.forEach(id => [...document.getElementById(id).options].forEach(o => o.selected = false));
  render();
});
document.getElementById('fileInput').addEventListener('change', handleFile);

const REGION_BY_CODE = {
  1:'Región de Tarapacá',
  2:'Región de Antofagasta',
  3:'Región de Atacama',
  4:'Región de Coquimbo',
  5:'Región de Valparaíso',
  6:"Región del Libertador General Bernardo O'Higgins",
  7:'Región del Maule',
  8:'Región del Biobío',
  9:'Región de La Araucanía',
  10:'Región de Los Lagos',
  11:'Región de Aysén del General Carlos Ibáñez del Campo',
  12:'Región de Magallanes y de la Antártica Chilena',
  13:'Región Metropolitana de Santiago',
  14:'Región de Los Ríos',
  15:'Región de Arica y Parinacota',
  16:'Región de Ñuble'
};

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
function normalizeRegion(region, regionPsu){
  const raw = normalizeKey(region);
  if(raw && raw !== '0' && raw.toLowerCase() !== 'nan') return raw;
  const code = asInt(regionPsu);
  return REGION_BY_CODE[code] || 'Sin dato';
}
function isNuevo(tipo){
  return normalizeKey(tipo).toUpperCase().includes('NUEVO');
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
    nuevo: isNuevo(r['TIPO']),
    tipo_ingreso: normalizeKey(r['TIPO INGRESO']) || 'Sin dato',
    tipo_establecimiento: normalizeKey(r['TIPO ESTABLECIMIENTO']) || 'Sin dato',
    region: normalizeRegion(r['REGION'], r['REGION PSU']),
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
  fillSelect('tipoIngresoFilter', uniq(M.map(r => r.tipo_ingreso)));
  fillSelect('regionFilter', uniq(M.map(r => r.region)));
  fillSelect('sexFilter', uniq(M.map(r => r.sexo)));
}

function filteredMatricula(){
  const years = selected('yearFilter');
  const careers = selected('careerFilter');
  const desc = selected('descFilter');
  const tipos = selected('tipoFilter');
  const tipoIngreso = selected('tipoIngresoFilter');
  const regiones = selected('regionFilter');
  const sex = selected('sexFilter');
  return M.filter(r =>
    includesOrAll(years, r.anio) &&
    includesOrAll(careers, r.carrera) &&
    includesOrAll(desc, r.descripcion) &&
    includesOrAll(tipos, r.tipo) &&
    includesOrAll(tipoIngreso, r.tipo_ingreso) &&
    includesOrAll(regiones, r.region) &&
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
      indexAxis: id === 'chartRegion' ? 'y' : 'x',
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(c)=>`${title}: ${fmt.format(c.raw)}`}}},
      scales: type === 'doughnut' ? {} : {
        x:{ticks:{autoSkip:false, maxRotation:id === 'chartTipoIngreso' ? 45 : 0, minRotation:0}},
        y:{beginAtZero:true,ticks:{callback:v=>fmt.format(v)}}
      }
    }
  });
}

function renderTables(matRows, titRows){
  const matGrouped = {};
  for(const r of matRows){
    const key = `${r.anio}|${r.carrera}|${r.descripcion}|${r.tipo_ingreso}|${r.region}`;
    matGrouped[key] = (matGrouped[key] || 0) + r.n;
  }
  const mat = Object.entries(matGrouped).map(([k,n]) => {
    const [anio,carrera,descripcion,tipo_ingreso,region] = k.split('|');
    return {anio,carrera,descripcion,tipo_ingreso,region,n};
  }).sort((a,b)=> Number(b.anio)-Number(a.anio) || a.carrera.localeCompare(b.carrera,'es')).slice(0,150);
  document.querySelector('#tableMatricula tbody').innerHTML = mat.map(r =>
    `<tr><td>${r.anio}</td><td>${r.carrera}</td><td>${r.descripcion}</td><td>${r.tipo_ingreso}</td><td>${r.region}</td><td>${fmt.format(r.n)}</td></tr>`
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
  const nuevosRows = matRows.filter(r => r.nuevo);

  const totalMat = matRows.reduce((a,r)=>a+r.n,0);
  const totalNuevos = nuevosRows.reduce((a,r)=>a+r.n,0);
  const totalTit = titRows.reduce((a,r)=>a+r.n,0);
  document.getElementById('kpiMatricula').textContent = fmt.format(totalMat);
  document.getElementById('kpiNuevos').textContent = fmt.format(totalNuevos);
  document.getElementById('kpiTitulados').textContent = fmt.format(totalTit);
  const years = uniq(matRows.map(r=>r.anio)).map(Number);
  document.getElementById('kpiPeriodo').textContent = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';

  const byYear = sumBy(matRows,'anio');
  const yearLabels = Object.keys(byYear).sort((a,b)=>Number(a)-Number(b));
  chart('chartMatriculaAnio','line',yearLabels,yearLabels.map(y=>byYear[y]),'Matrícula total');

  const byNuevoYear = sumBy(nuevosRows,'anio');
  const nuevoLabels = Object.keys(byNuevoYear).sort((a,b)=>Number(a)-Number(b));
  chart('chartNuevosAnio','bar',nuevoLabels,nuevoLabels.map(y=>byNuevoYear[y]),'Matrícula nueva');

  const byRegion = topEntries(sumBy(matRows,'region'),16).reverse();
  chart('chartRegion','bar',byRegion.map(e=>e[0]),byRegion.map(e=>e[1]),'Matrícula');

  const byTipoIngreso = topEntries(sumBy(matRows,'tipo_ingreso'),14);
  chart('chartTipoIngreso','bar',byTipoIngreso.map(e=>e[0]),byTipoIngreso.map(e=>e[1]),'Matrícula');

  const byCareer = topEntries(sumBy(matRows,'carrera'),10);
  chart('chartMatriculaCarrera','doughnut',byCareer.map(e=>e[0]),byCareer.map(e=>e[1]),'Matrícula');

  const byTitYear = sumBy(titRows,'anio');
  const titLabels = Object.keys(byTitYear).sort((a,b)=>Number(a)-Number(b));
  chart('chartTituladosAnio','bar',titLabels,titLabels.map(y=>byTitYear[y]),'Titulados/as');

  renderTables(matRows, titRows);
}

fillFilters();
render();
