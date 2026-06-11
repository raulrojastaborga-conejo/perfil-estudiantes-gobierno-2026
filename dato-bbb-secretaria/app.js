const state = {
  products: [],
  filters: {
    query: '',
    category: 'todas',
    subcategory: 'todas',
    store: 'todas',
    maxPrice: 0,
    minBbb: 0,
    discountOnly: false,
    favoritesOnly: false,
    sort: 'bbb'
  },
  favorites: new Set(JSON.parse(localStorage.getItem('datoBBB:favorites') || '[]')),
  compare: new Set()
};

const categoryLabels = {
  ropa: 'Ropa',
  'make-up': 'Make up',
  capilar: 'Productos capilares',
  zapatos: 'Zapatos'
};

const subcategoryLabels = {
  casual: 'Casual',
  vestir: 'De vestir',
  maquillaje: 'Make up',
  shampoo: 'Shampoo',
  acondicionador: 'Acondicionador',
  tratamiento: 'Tratamiento',
  accesorios: 'Accesorios',
  zapatillas: 'Zapatillas',
  formales: 'Formales',
  sandalias: 'Sandalias',
  botines: 'Botines'
};

const homeUrls = new Set([
  'https://www.mercadolibre.cl/',
  'https://www.mercadolibre.cl',
  'https://mercadolibre.cl/',
  'https://mercadolibre.cl'
]);

function money(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function stars(score) {
  const rounded = Math.round(score || 0);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= rounded ? '★' : '<span class="empty">★</span>';
  }
  return html;
}

function calculateBbb(product) {
  return Number(((product.ratings.bueno * 0.4) + (product.ratings.barato * 0.4) + (product.ratings.bonito * 0.2)).toFixed(1));
}

function isSpecificOfferUrl(url) {
  const cleanUrl = String(url || '').trim();
  return cleanUrl.startsWith('https://') && cleanUrl.length > 35 && !homeUrls.has(cleanUrl);
}

function normalizeProduct(product) {
  return {
    ...product,
    bbb: product.bbb ?? calculateBbb(product),
    hasSpecificOffer: isSpecificOfferUrl(product.url)
  };
}

function getFilteredProducts() {
  const query = state.filters.query.trim().toLowerCase();

  const products = state.products
    .map(normalizeProduct)
    .filter(product => !query || `${product.name} ${product.store} ${product.category} ${product.subcategory}`.toLowerCase().includes(query))
    .filter(product => state.filters.category === 'todas' || product.category === state.filters.category)
    .filter(product => state.filters.subcategory === 'todas' || product.subcategory === state.filters.subcategory)
    .filter(product => state.filters.store === 'todas' || product.store === state.filters.store)
    .filter(product => !state.filters.maxPrice || product.price <= state.filters.maxPrice)
    .filter(product => product.bbb >= state.filters.minBbb)
    .filter(product => !state.filters.discountOnly || Number(product.discount || 0) > 0)
    .filter(product => !state.filters.favoritesOnly || state.favorites.has(product.id));

  return sortProducts(products);
}

function sortProducts(products) {
  const sorted = [...products];
  const mode = state.filters.sort;

  sorted.sort((a, b) => {
    if (mode === 'price-asc') return a.price - b.price;
    if (mode === 'discount-desc') return (b.discount || 0) - (a.discount || 0);
    if (mode === 'recent') return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    if (mode === 'good') return b.ratings.bueno - a.ratings.bueno || b.bbb - a.bbb;
    if (mode === 'pretty') return b.ratings.bonito - a.ratings.bonito || b.bbb - a.bbb;
    return b.bbb - a.bbb || a.price - b.price;
  });

  return sorted;
}

function renderSummary(products) {
  const summary = document.querySelector('#summary');
  const best = products[0];
  const cheap = products.filter(p => p.price <= 10000).length;
  const favorites = state.favorites.size;
  const compared = state.compare.size;

  summary.innerHTML = `
    <article class="summary-card"><span>Productos visibles</span><strong>${products.length}</strong></article>
    <article class="summary-card"><span>Bajo $10.000</span><strong>${cheap}</strong></article>
    <article class="summary-card"><span>Favoritos</span><strong>${favorites}</strong></article>
    <article class="summary-card"><span>Comparando</span><strong>${compared}/3</strong></article>
  `;
}

function offerButton(product) {
  if (!product.hasSpecificOffer) {
    return '<button class="btn btn-origin disabled" type="button" disabled>Oferta específica no disponible</button>';
  }

  return `<a class="btn btn-origin" href="${product.url}" target="_blank" rel="noopener noreferrer">Ver oferta original</a>`;
}

function renderProducts() {
  const products = getFilteredProducts();
  const container = document.querySelector('#productos');
  renderSummary(products);
  renderCompare();

  if (!products.length) {
    container.innerHTML = '<div class="empty-state panel">No hay productos con esos filtros.</div>';
    return;
  }

  container.innerHTML = products.map(product => {
    const isFavorite = state.favorites.has(product.id);
    const isCompared = state.compare.has(product.id);

    return `
      <article class="product-card">
        <div class="product-image">
          <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22%3E%3Crect width=%22600%22 height=%22400%22 fill=%22%23ffe4f1%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2224%22 fill=%22%239f2360%22%3EDato BBB%3C/text%3E%3C/svg%3E'" />
        </div>
        <div class="product-body">
          <div class="badges">
            <span class="badge">${categoryLabels[product.category] || product.category}</span>
            <span class="badge">${subcategoryLabels[product.subcategory] || product.subcategory}</span>
            <span class="badge store">${product.store}</span>
            ${product.discount ? `<span class="badge hot">-${product.discount}%</span>` : ''}
          </div>
          <h3>${product.name}</h3>
          <div class="price-row">
            <span class="price">${money(product.price)}</span>
            ${product.old_price ? `<span class="old-price">${money(product.old_price)}</span>` : ''}
            ${product.discount ? `<span class="discount">-${product.discount}%</span>` : ''}
          </div>
          <div class="stars">
            <div class="star-line"><strong>Bueno</strong><span class="star-icons">${stars(product.ratings.bueno)}</span><span>${product.ratings.bueno}/5</span></div>
            <div class="star-line"><strong>Bonito</strong><span class="star-icons">${stars(product.ratings.bonito)}</span><span>${product.ratings.bonito}/5</span></div>
            <div class="star-line"><strong>Barato</strong><span class="star-icons">${stars(product.ratings.barato)}</span><span>${product.ratings.barato}/5</span></div>
          </div>
          <div class="bbb-total">BBB total: ${product.bbb.toFixed(1)} / 5</div>
          <p class="meta">Origen: ${product.store} · Actualizado: ${product.updated_at || 'sin fecha'}</p>
          ${offerButton(product)}
          <button class="btn btn-soft ${isFavorite ? 'active' : ''}" type="button" data-action="favorite" data-id="${product.id}">${isFavorite ? '★ Guardado' : '☆ Guardar favorito'}</button>
          <button class="btn btn-soft ${isCompared ? 'active' : ''}" type="button" data-action="compare" data-id="${product.id}">${isCompared ? '✓ En comparador' : '+ Comparar'}</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderCompare() {
  const panel = document.querySelector('#comparePanel');
  const table = document.querySelector('#compareTable');
  const selected = state.products.map(normalizeProduct).filter(product => state.compare.has(product.id));

  panel.hidden = selected.length === 0;
  if (!selected.length) {
    table.innerHTML = '';
    return;
  }

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Tienda</th>
          <th>Precio</th>
          <th>Bueno</th>
          <th>Bonito</th>
          <th>Barato</th>
          <th>BBB</th>
          <th>Oferta</th>
        </tr>
      </thead>
      <tbody>
        ${selected.map(product => `
          <tr>
            <td><strong>${product.name}</strong></td>
            <td>${product.store}</td>
            <td>${money(product.price)}</td>
            <td>${product.ratings.bueno}/5</td>
            <td>${product.ratings.bonito}/5</td>
            <td>${product.ratings.barato}/5</td>
            <td><strong>${product.bbb.toFixed(1)}</strong></td>
            <td>${product.hasSpecificOffer ? `<a href="${product.url}" target="_blank" rel="noopener noreferrer">Ver</a>` : 'No disponible'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function updateSubcategoryOptions() {
  const subcategorySelect = document.querySelector('#subcategoryFilter');
  const options = new Set(
    state.products
      .filter(product => state.filters.category === 'todas' || product.category === state.filters.category)
      .map(product => product.subcategory)
  );

  subcategorySelect.innerHTML = '<option value="todas">Todas</option>' +
    Array.from(options).sort().map(value => `<option value="${value}">${subcategoryLabels[value] || value}</option>`).join('');

  if (!options.has(state.filters.subcategory)) {
    state.filters.subcategory = 'todas';
    subcategorySelect.value = 'todas';
  }
}

function updateStoreOptions() {
  const storeSelect = document.querySelector('#storeFilter');
  const stores = Array.from(new Set(state.products.map(product => product.store).filter(Boolean))).sort();
  storeSelect.innerHTML = '<option value="todas">Todas</option>' + stores.map(store => `<option value="${store}">${store}</option>`).join('');
}

function saveFavorites() {
  localStorage.setItem('datoBBB:favorites', JSON.stringify([...state.favorites]));
}

function bindFilters() {
  document.querySelector('#searchInput').addEventListener('input', event => {
    state.filters.query = event.target.value;
    renderProducts();
  });

  document.querySelector('#categoryFilter').addEventListener('change', event => {
    state.filters.category = event.target.value;
    updateSubcategoryOptions();
    renderProducts();
  });

  document.querySelector('#subcategoryFilter').addEventListener('change', event => {
    state.filters.subcategory = event.target.value;
    renderProducts();
  });

  document.querySelector('#storeFilter').addEventListener('change', event => {
    state.filters.store = event.target.value;
    renderProducts();
  });

  document.querySelector('#priceFilter').addEventListener('change', event => {
    state.filters.maxPrice = Number(event.target.value);
    renderProducts();
  });

  document.querySelector('#bbbFilter').addEventListener('change', event => {
    state.filters.minBbb = Number(event.target.value);
    renderProducts();
  });

  document.querySelector('#sortSelect').addEventListener('change', event => {
    state.filters.sort = event.target.value;
    renderProducts();
  });

  document.querySelector('#discountOnly').addEventListener('change', event => {
    state.filters.discountOnly = event.target.checked;
    renderProducts();
  });

  document.querySelector('#favoritesOnly').addEventListener('change', event => {
    state.filters.favoritesOnly = event.target.checked;
    renderProducts();
  });

  document.querySelector('#clearFilters').addEventListener('click', () => {
    state.filters = { query: '', category: 'todas', subcategory: 'todas', store: 'todas', maxPrice: 0, minBbb: 0, discountOnly: false, favoritesOnly: false, sort: 'bbb' };
    document.querySelector('#searchInput').value = '';
    document.querySelector('#categoryFilter').value = 'todas';
    document.querySelector('#storeFilter').value = 'todas';
    document.querySelector('#priceFilter').value = '0';
    document.querySelector('#bbbFilter').value = '0';
    document.querySelector('#sortSelect').value = 'bbb';
    document.querySelector('#discountOnly').checked = false;
    document.querySelector('#favoritesOnly').checked = false;
    updateSubcategoryOptions();
    renderProducts();
  });

  document.querySelector('#clearCompare').addEventListener('click', () => {
    state.compare.clear();
    renderProducts();
  });

  document.querySelector('#productos').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === 'favorite') {
      state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
      saveFavorites();
    }

    if (button.dataset.action === 'compare') {
      if (state.compare.has(id)) {
        state.compare.delete(id);
      } else if (state.compare.size < 3) {
        state.compare.add(id);
      } else {
        alert('Puedes comparar hasta 3 productos a la vez.');
      }
    }

    renderProducts();
  });
}

async function init() {
  bindFilters();
  try {
    const response = await fetch('data/productos.json', { cache: 'no-store' });
    state.products = await response.json();
  } catch (error) {
    console.error(error);
    state.products = [];
  }
  updateSubcategoryOptions();
  updateStoreOptions();
  renderProducts();
}

init();
