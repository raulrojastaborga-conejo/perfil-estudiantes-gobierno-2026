const DATA = window.DASHBOARD_DATA;
const M = DATA.matricula_agg;
const T = DATA.titulados_agg;
const META = DATA.metadata;

const fmt = new Intl.NumberFormat('es-CL');
const charts = {};

document.getElementById('sourceFile').textContent = META.source_file;

function uniq(arr){ return [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ""))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true})); }
function selected(id){ return [...document.getElementById(id).selectedOptions].map(o => o.value); }
function includesOrAll(values, value){ return values.length === 0 || values.includes(String(value)); }

function fillSelect(id, values){
  const el = document.getElementById(id);
  el.innerHTML = values.map(v => `<option value="${String(v).replaceAll('"','&quot;')}">${v}</option>`).join('');
}

fillSelect('yearFilter', uniq(M.map(r => r.anio)));
fillSelect('careerFilter', uniq(M.map(r => r.carrera)));
fillSelect('descFilter', uniq(M.map(r => r.descripcion)));
fillSelect('tipoFilter', uniq(M.map(r => r.tipo)));
fillSelect('sexFilter', uniq(M.map(r => r.sexo)));

['yearFilter','careerFilter','descFilter','tipoFilter','sexFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', render);
});
document.getElementById('resetFilters').addEventListener('click', () => {
  ['yearFilter','careerFilter','descFilter','tipoFilter','sexFilter'].forEach(id => {
    [...document.getElementById(id).options].forEach(o => o.selected = false);
  });
  render();
});

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
function sumBy2(rows, k1, k2){
  const out = {};
  for(const r of rows){
    const a = r[k1] ?? 'Sin dato', b = r[k2] ?? 'Sin dato';
    const key = `${a}|||${b}`;
    out[key] = (out[key] || 0) + r.n;
  }
  return out;
}
function topEntries(obj, n=15){
  return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n);
}

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
  const mat = topEntries(sumBy2(matRows, 'anio', 'carrera'), 100)
    .map(([k,n]) => {
      const [anio,carrera] = k.split('|||');
      return {anio,carrera,n};
    })
    .sort((a,b)=> Number(b.anio)-Number(a.anio) || a.carrera.localeCompare(b.carrera,'es'));
  document.querySelector('#tableMatricula tbody').innerHTML = mat.map(r =>
    `<tr><td>${r.anio}</td><td>${r.carrera}</td><td>Según filtros</td><td>${fmt.format(r.n)}</td></tr>`
  ).join('');

  const tit = topEntries(sumBy2(titRows, 'anio', 'carrera'), 100)
    .map(([k,n]) => {
      const [anio,carrera] = k.split('|||');
      const detail = titRows.filter(r => String(r.anio)===String(anio) && String(r.carrera)===String(carrera));
      const notaN = detail.reduce((a,r)=>a+(r.n_nota_final||0),0);
      const notaSum = detail.reduce((a,r)=>a+((r.promedio_nota_final||0)*(r.n_nota_final||0)),0);
      const prom = notaN ? (notaSum/notaN).toFixed(2) : '—';
      return {anio,carrera,n,prom};
    })
    .sort((a,b)=> Number(b.anio)-Number(a.anio) || a.carrera.localeCompare(b.carrera,'es'));
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

  const byCareer = sumBy(matRows,'carrera');
  const careerEntries = topEntries(byCareer,10);
  chart('chartMatriculaCarrera','doughnut',careerEntries.map(e=>e[0]),careerEntries.map(e=>e[1]),'Matrícula');

  const byDesc = topEntries(sumBy(matRows,'descripcion'),12);
  chart('chartDescripcion','bar',byDesc.map(e=>e[0]),byDesc.map(e=>e[1]),'Matrícula');

  const byTitYear = sumBy(titRows,'anio');
  const titLabels = Object.keys(byTitYear).sort((a,b)=>Number(a)-Number(b));
  chart('chartTituladosAnio','bar',titLabels,titLabels.map(y=>byTitYear[y]),'Titulados/as');

  renderTables(matRows, titRows);
}
render();
