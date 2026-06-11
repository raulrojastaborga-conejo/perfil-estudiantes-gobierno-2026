const state = {
  products: [],
  filters: {
    category: 'todas',
    subcategory: 'todas',
    maxPrice: 0,
    minBbb: 0
  }
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

function money(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(value);
}

function stars(score) {
  const rounded = Math.round(score);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= rounded ? '★' : '<span class="empty">★</span>';
  }
  return html;
}

function calculateBbb(product) {
  return Number(((product.ratings.bueno * 0.4) + (product.ratings.barato * 0.4) + (product.ratings.bonito * 0.2)).toFixed(1));
}

function getFilteredProducts() {
  return state.products
    .map(product => ({ ...product, bbb: product.bbb ?? calculateBbb(product) }))
    .filter(product => state.filters.category === 'todas' || product.category === state.filters.category)
    .filter(product => state.filters.subcategory === 'todas' || product.subcategory === state.filters.subcategory)
    .filter(product => !state.filters.maxPrice || product.price <= state.filters.maxPrice)
    .filter(product => product.bbb >= state.filters.minBbb)
    .sort((a, b) => b.bbb - a.bbb || a.price - b.price);
}

function renderSummary(products) {
  const summary = document.querySelector('#summary');
  const best = products[0];
  const cheap = products.filter(p => p.price <= 10000).length;
  const updated = state.products[0]?.updated_at || 'sin fecha';

  summary.innerHTML = `
    <article class="summary-card"><span>Productos visibles</span><strong>${products.length}</strong></article>
    <article class="summary-card"><span>Bajo $10.000</span><strong>${cheap}</strong></article>
    <article class="summary-card"><span>Mejor BBB</span><strong>${best ? best.bbb.toFixed(1) : '-'}</strong></article>
    <article class="summary-card"><span>Actualizado</span><strong>${updated}</strong></article>
  `;
}

function renderProducts() {
  const products = getFilteredProducts();
  const container = document.querySelector('#productos');
  renderSummary(products);

  if (!products.length) {
    container.innerHTML = '<div class="empty-state panel">No hay productos con esos filtros.</div>';
    return;
  }

  container.innerHTML = products.map(product => `
    <article class="product-card">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22%3E%3Crect width=%22600%22 height=%22400%22 fill=%22%23ffe4f1%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2224%22 fill=%22%239f2360%22%3EDato BBB%3C/text%3E%3C/svg%3E'" />
      </div>
      <div class="product-body">
        <div class="badges">
          <span class="badge">${categoryLabels[product.category]}</span>
          <span class="badge">${subcategoryLabels[product.subcategory] || product.subcategory}</span>
          <span class="badge store">${product.store}</span>
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
        <p class="meta">Origen: ${product.store} · Actualizado: ${product.updated_at}</p>
        <a class="btn btn-origin" href="${product.url}" target="_blank" rel="noopener noreferrer">Ver oferta original</a>
      </div>
    </article>
  `).join('');
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

function bindFilters() {
  document.querySelector('#categoryFilter').addEventListener('change', event => {
    state.filters.category = event.target.value;
    updateSubcategoryOptions();
    renderProducts();
  });

  document.querySelector('#subcategoryFilter').addEventListener('change', event => {
    state.filters.subcategory = event.target.value;
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
  renderProducts();
}

init();
