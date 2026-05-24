let searchIndex = [];

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderResults(query) {
  const resultsContainer = document.getElementById('search-results');
  const emptyMessage = document.getElementById('search-empty');
  const q = normalize(query.trim());

  resultsContainer.innerHTML = '';

  if (!q) {
    emptyMessage.textContent = 'Escribe una palabra clave para buscar dentro del portal.';
    return;
  }

  const results = searchIndex.filter(item =>
    normalize(item.title + ' ' + item.tags).includes(q)
  );

  if (!results.length) {
    emptyMessage.textContent = 'No encontramos coincidencias. Intenta con otra palabra o usa la derivación guiada.';
    return;
  }

  emptyMessage.textContent = '';

  results.forEach(item => {
    const card = document.createElement('a');
    card.className = 'action-card';
    card.href = item.url;
    card.innerHTML = `
      <span class="badge">Resultado</span>
      <strong>${item.title}</strong>
      <small>${item.tags}</small>
    `;
    resultsContainer.appendChild(card);
  });
}

async function loadSearchIndex() {
  try {
    const response = await fetch('search-index.json');
    searchIndex = await response.json();
  } catch (error) {
    console.error('No se pudo cargar el índice de búsqueda.', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSearchIndex();

  const input = document.getElementById('site-search');
  if (!input) return;

  input.addEventListener('input', event => {
    renderResults(event.target.value);
  });

  renderResults('');
});