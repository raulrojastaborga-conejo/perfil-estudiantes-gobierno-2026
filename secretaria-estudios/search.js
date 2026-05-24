const fallbackSearchIndex = [
  {title:'Reconocimiento de asignaturas Postgrado',url:'../flujo_reconocimiento_asignaturas_postgrado_facgob.html',tags:'reconocimiento asignaturas actividades curriculares homologacion convalidacion postgrado magister flujo'},
  {title:'Reconocimiento de asignaturas Pregrado',url:'pregrado-reconocimiento.html',tags:'reconocimiento asignaturas homologacion convalidacion pregrado'},
  {title:'Protocolo de corresponsabilidad y salud mental Postgrado',url:'../protocolos_corresponsabilidad_salud_mental_postgrado_facgob.html',tags:'corresponsabilidad salud mental postgrado protocolo apoyo estudiantes'},
  {title:'Bachiller General con mencion en Ciencias Sociales',url:'pregrado-licenciatura-titulo.html',tags:'bachiller general ciencias sociales 120 creditos sct administracion publica ciencia politica grado intermedio'},
  {title:'Pregrado',url:'pregrado.html',tags:'pregrado administracion publica ciencia politica toma de ramos solicitudes tui tne licenciatura titulo'},
  {title:'Postgrado',url:'postgrado.html',tags:'postgrado magister matricula defensas expediente grado solicitudes permanencia'},
  {title:'Toma de Ramos',url:'pregrado-toma-ramos.html',tags:'toma de ramos inscripcion academica modifica prioridades pregrado'},
  {title:'Solicitudes academicas Pregrado',url:'pregrado-solicitudes.html',tags:'solicitudes academicas justificacion postergacion reincorporacion renuncia permanencia excepcion pregrado'},
  {title:'Solicitudes Postgrado',url:'postgrado-solicitudes.html',tags:'solicitudes postgrado postergacion reincorporacion permanencia prestaciones servicios'},
  {title:'Defensas Postgrado',url:'postgrado-defensas.html',tags:'defensa examen grado tesis afe verificacion academica postgrado'},
  {title:'Normativa',url:'normativa.html',tags:'reglamentos normativa estudiantes facultades magister doctor carrera programa'},
  {title:'Calendarios academicos',url:'calendarios.html',tags:'calendario fechas plazos solicitudes matricula toma de ramos'},
  {title:'Derivacion guiada',url:'derivacion-guiada.html',tags:'derivacion guia no se donde consultar unidad tramite consulta'},
  {title:'Avisos',url:'avisos.html',tags:'avisos noticias novedades recordatorios comunicaciones plazos'},
  {title:'FAQ interactivo',url:'faq-interactivo.html',tags:'faq preguntas frecuentes dudas orientacion estudiantes'}
];

let searchIndex = fallbackSearchIndex;

function normalize(text){return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

function renderResults(query){
  const resultsContainer=document.getElementById('search-results');
  const emptyMessage=document.getElementById('search-empty');
  const q=normalize(query.trim());
  resultsContainer.innerHTML='';
  if(!q){emptyMessage.textContent='Escribe una palabra clave para buscar dentro del portal.';return;}
  const results=searchIndex.filter(item=>normalize(item.title+' '+item.tags).includes(q));
  if(!results.length){emptyMessage.textContent='No encontramos coincidencias. Intenta con otra palabra o usa la derivación guiada.';return;}
  emptyMessage.textContent='';
  results.forEach(item=>{
    const card=document.createElement('a');
    card.className='action-card';
    card.href=item.url;
    card.innerHTML=`<span class="badge">Resultado</span><strong>${item.title}</strong><small>${item.tags}</small>`;
    resultsContainer.appendChild(card);
  });
}

async function loadSearchIndex(){
  try{
    const response=await fetch('search-index.json',{cache:'no-store'});
    if(!response.ok) throw new Error('No se pudo cargar search-index.json');
    const data=await response.json();
    if(Array.isArray(data)&&data.length){searchIndex=data;}
  }catch(error){
    console.warn('Se usara indice local de respaldo.',error);
    searchIndex=fallbackSearchIndex;
  }
}

document.addEventListener('DOMContentLoaded',async()=>{
  await loadSearchIndex();
  const input=document.getElementById('site-search');
  if(!input)return;
  input.addEventListener('input',event=>renderResults(event.target.value));
  renderResults(input.value||'');
});