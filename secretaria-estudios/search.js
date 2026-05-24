const searchIndex = [
  { title: 'Pregrado', url: 'pregrado.html', tags: 'pregrado administracion publica ciencia politica toma de ramos solicitudes tui tne licenciatura titulo' },
  { title: 'Postgrado', url: 'postgrado.html', tags: 'postgrado magister matricula defensas expediente grado solicitudes permanencia' },
  { title: 'Solicitudes académicas Pregrado', url: 'pregrado-solicitudes.html', tags: 'solicitudes academicas justificacion postergacion reincorporacion renuncia permanencia excepcion pregrado' },
  { title: 'Reconocimiento de asignaturas Pregrado', url: 'pregrado-reconocimiento.html', tags: 'reconocimiento asignaturas homologacion convalidacion pregrado' },
  { title: 'Licenciatura y Título', url: 'pregrado-licenciatura-titulo.html', tags: 'licenciatura bachiller titulo egreso grado expediente pregrado' },
  { title: 'TUI y TNE', url: 'pregrado-tui-tne.html', tags: 'tui tne tarjeta universitaria pase escolar pregrado' },
  { title: 'Toma de Ramos', url: 'pregrado-toma-ramos.html', tags: 'toma de ramos inscripcion academica modifica prioridades pregrado' },
  { title: 'Matrícula Postgrado', url: 'postgrado-matricula.html', tags: 'matricula postgrado magister pago formalizacion periodos' },
  { title: 'Solicitudes Postgrado', url: 'postgrado-solicitudes.html', tags: 'solicitudes postgrado postergacion reincorporacion permanencia prestaciones servicios' },
  { title: 'Defensas Postgrado', url: 'postgrado-defensas.html', tags: 'defensa examen grado tesis afe verificacion academica postgrado' },
  { title: 'Expediente de grado Postgrado', url: 'postgrado-expediente-grado.html', tags: 'expediente grado cedula ucampus titulos postgrado' },
  { title: 'Normativa', url: 'normativa.html', tags: 'reglamentos normativa estudiantes facultades magister doctor carrera programa' },
  { title: 'Calendarios académicos', url: 'calendarios.html', tags: 'calendario fechas plazos solicitudes matricula toma de ramos' },
  { title: 'Derivación guiada', url: 'derivacion-guiada.html', tags: 'derivacion guia no se donde consultar unidad tramite consulta' },
  { title: 'Avisos', url: 'avisos.html', tags: 'avisos noticias novedades recordatorios comunicaciones plazos' },
  { title: 'Cuenta UChile y Pasaporte', url: 'cuenta-uchile-pasaporte.html', tags: 'cuenta uchile pasaporte acceso clave sistemas institucionales' }
];

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderResults(query) {
  const resultsContainer = document.getElementById('search-results');
  const emptyMessage = document.getElementById('search-empty');
  const q = normalize(query.trim());
  resultsContainer.innerHTML = '';

  if (!q) {
    emptyMessage.textContent = 'Escribe una palabra clave para buscar dentro de las secciones principales.';
    return;
  }

  const results = searchIndex.filter(item => normalize(item.title + ' ' + item.tags).includes(q));

  if (!results.length) {
    emptyMessage.textContent = 'No encontramos coincidencias. Prueba con otra palabra o usa la derivación guiada.';
    return;
  }

  emptyMessage.textContent = '';
  results.forEach(item => {
    const card = document.createElement('a');
    card.className = 'action-card';
    card.href = item.url;
    card.innerHTML = `<span class="badge">Resultado</span><strong>${item.title}</strong><small>${item.tags}</small>`;
    resultsContainer.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('site-search');
  if (!input) return;
  input.addEventListener('input', event => renderResults(event.target.value));
  renderResults('');
});