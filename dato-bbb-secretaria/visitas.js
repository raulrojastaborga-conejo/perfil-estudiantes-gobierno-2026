async function iniciarContadorVisitas() {
  const box = document.createElement('div');
  box.style.marginTop = '14px';
  box.style.display = 'inline-flex';
  box.style.gap = '8px';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.padding = '10px 14px';
  box.style.borderRadius = '999px';
  box.style.background = 'rgba(255,255,255,0.18)';
  box.style.border = '1px solid rgba(255,255,255,0.38)';
  box.style.color = '#fff';
  box.style.fontWeight = '800';
  box.innerHTML = '👀 Visitas: <span id="contadorVisitas">...</span>';

  const hero = document.querySelector('.hero__content');
  if (hero) hero.appendChild(box);

  const output = document.querySelector('#contadorVisitas');
  const localKey = 'datoBBB:visitasLocales';

  function mostrarLocal() {
    const local = Number(localStorage.getItem(localKey) || '0') + 1;
    localStorage.setItem(localKey, String(local));
    if (output) output.textContent = `${local} en este navegador`;
  }

  try {
    const url = 'https://api.countapi.xyz/hit/dato-bbb-secretaria/visitas';
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('contador externo no disponible');
    const data = await response.json();
    if (!data || typeof data.value !== 'number') throw new Error('respuesta invalida');
    if (output) output.textContent = new Intl.NumberFormat('es-CL').format(data.value);
  } catch (error) {
    console.warn('Contador global no disponible, usando contador local.', error);
    mostrarLocal();
  }
}

iniciarContadorVisitas();
