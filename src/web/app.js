'use strict';

// Pan de la Casa: catálogo, carrito y pedido. Sin dependencias (vanilla JS, sin build).

const CATEGORIES = {
  amasijos: 'Amasijos',
  panes: 'Panes',
  dulces: 'Dulces',
};

// Mismas reglas que la API (src/api/src/lib/orders.js). La API es la que decide; esto solo guía.
const OPEN_HOUR = 7;
const CLOSE_HOUR = 19;
const SLOT_MINUTES = 15;
const MIN_LEAD_MINUTES = 30;
// La API exige los 30 minutos al recibir el pedido, no al abrir la página: se deja margen para llenar el formulario.
const FORM_MARGIN_MINUTES = 10;
const DAYS_AHEAD = 7;
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const MAX_QTY = 50;

const CART_KEY = 'pdlc.cart';
const LAST_ORDER_KEY = 'pdlc.lastOrder';

const $ = (id) => document.getElementById(id);

const state = {
  products: [],
  byId: new Map(),
  cart: new Map(), // productId -> qty
  rows: new Map(), // productId -> elementos de la fila
  orderInView: false, // con el pedido en pantalla, la barra fija sobra
};

// ---------- Utilidades ----------

const money = (n) => '$' + Number(n).toLocaleString('es-CO');

function storageGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento (modo privado): el carrito vive solo en esta pestaña.
  }
}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

/** "Ahora" en Bogotá, expresado con los campos UTC de un Date (Colombia no tiene horario de verano). */
function bogotaNow() {
  return new Date(Date.now() + BOGOTA_OFFSET_MS);
}

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const whenFmt = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

function timeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** Horas de recogida disponibles para un día (minutos desde la medianoche, hora de Bogotá). */
function slotsFor(dayIndex) {
  const now = bogotaNow();
  const first = OPEN_HOUR * 60;
  const last = CLOSE_HOUR * 60 - SLOT_MINUTES;
  let from = first;
  if (dayIndex === 0) {
    // Los segundos cuentan: a las 10:00:40 ya no se puede ofrecer 10:30.
    const started = now.getUTCSeconds() > 0 || now.getUTCMilliseconds() > 0 ? 1 : 0;
    const earliest = now.getUTCHours() * 60 + now.getUTCMinutes() + started + MIN_LEAD_MINUTES + FORM_MARGIN_MINUTES;
    from = Math.max(first, Math.ceil(earliest / SLOT_MINUTES) * SLOT_MINUTES);
  }
  const slots = [];
  for (let m = from; m <= last; m += SLOT_MINUTES) slots.push(m);
  return slots;
}

// ---------- Catálogo ----------

function renderCatalog() {
  const main = $('catalogo');
  const tabs = $('cat-tabs');
  const tpl = $('tpl-product');
  main.textContent = '';
  tabs.textContent = '';

  for (const [cat, label] of Object.entries(CATEGORIES)) {
    const items = state.products.filter((p) => p.category === cat);
    if (items.length === 0) continue;

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'cat-link';
    a.href = `#cat-${cat}`;
    a.dataset.cat = cat;
    const sw = document.createElement('span');
    sw.className = `swatch cat-${cat}`;
    sw.setAttribute('aria-hidden', 'true');
    a.append(sw, label);
    li.append(a);
    tabs.append(li);

    const section = document.createElement('section');
    section.className = 'cat-section';
    section.id = `cat-${cat}`;
    section.setAttribute('aria-labelledby', `cat-${cat}-title`);
    const h2 = document.createElement('h2');
    h2.className = 'cat-title';
    h2.id = `cat-${cat}-title`;
    const sw2 = sw.cloneNode();
    h2.append(sw2, label);
    const list = document.createElement('div');
    list.className = 'products';

    for (const p of items) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.classList.add(`cat-${cat}`);
      const img = node.querySelector('.photo');
      img.src = p.image;
      img.alt = p.name;
      node.querySelector('.price').textContent = money(p.price);
      node.querySelector('.name').textContent = p.name;
      node.querySelector('.unit').textContent = `Precio por ${p.unit}`;
      node.querySelector('.desc').textContent = p.description;

      const add = node.querySelector('.btn-add');
      const stepper = node.querySelector('.stepper');
      const dec = node.querySelector('.step-dec');
      const inc = node.querySelector('.step-inc');
      add.setAttribute('aria-label', `Agregar ${p.name}`);
      dec.setAttribute('aria-label', `Quitar un ${p.name}`);
      inc.setAttribute('aria-label', `Agregar otro ${p.name}`);

      if (!p.available) {
        add.disabled = true;
        add.textContent = 'Agotado';
      }

      add.addEventListener('click', () => {
        changeQty(p.id, 1);
        inc.focus();
      });
      inc.addEventListener('click', () => changeQty(p.id, 1));
      dec.addEventListener('click', () => {
        const left = changeQty(p.id, -1);
        if (left === 0) add.focus();
      });

      state.rows.set(p.id, { add, stepper, inc, qty: node.querySelector('.qty'), tag: node.querySelector('.tag') });
      list.append(node);
    }

    section.append(h2, list);
    main.append(section);
  }

  main.setAttribute('aria-busy', 'false');
  watchCategories();
}

function renderCatalogError() {
  const main = $('catalogo');
  main.textContent = '';
  main.setAttribute('aria-busy', 'false');
  const box = document.createElement('div');
  box.className = 'catalog-error';
  box.setAttribute('role', 'alert');
  const p = document.createElement('p');
  p.textContent = 'No pudimos cargar el catálogo. Revisa tu conexión e intenta de nuevo.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Reintentar';
  btn.addEventListener('click', loadCatalog);
  box.append(p, btn);
  main.append(box);
}

/** Marca la pestaña de la categoría que está en pantalla. */
function watchCategories() {
  if (!('IntersectionObserver' in window)) return;
  const links = [...document.querySelectorAll('.cat-link')];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const cat = e.target.id.replace('cat-', '');
        for (const l of links) l.setAttribute('aria-current', String(l.dataset.cat === cat));
      }
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  document.querySelectorAll('.cat-section').forEach((s) => observer.observe(s));
}

async function loadCatalog() {
  $('catalog-status').textContent = 'Cargando el catálogo…';
  try {
    const { products } = await getJson('/api/products');
    state.products = products;
    state.byId = new Map(products.map((p) => [p.id, p]));
    // Lo guardado que ya no existe o se agotó, se descarta.
    for (const id of [...state.cart.keys()]) {
      const p = state.byId.get(id);
      if (!p || !p.available) state.cart.delete(id);
    }
    renderCatalog();
    renderCart();
    $('catalog-status').textContent = `${products.length} productos en el catálogo.`;
  } catch (err) {
    console.error(err);
    renderCatalogError();
    $('catalog-status').textContent = 'No pudimos cargar el catálogo.';
  }
}

// ---------- Carrito ----------

function changeQty(id, delta) {
  // Agregar algo con una confirmación en pantalla empieza un pedido nuevo.
  if (delta > 0 && !$('confirmation').hidden) closeConfirmation();
  const before = state.cart.get(id) || 0;
  const qty = Math.max(0, Math.min(MAX_QTY, before + delta));
  if (qty === 0) state.cart.delete(id);
  else state.cart.set(id, qty);
  storageSet(CART_KEY, Object.fromEntries(state.cart));

  const row = state.rows.get(id);
  if (row && before === 0 && qty > 0) {
    row.tag.classList.remove('is-bumped');
    void row.tag.offsetWidth; // reinicia la animación
    row.tag.classList.add('is-bumped');
  }
  renderCart();
  return qty;
}

function cartLines() {
  return [...state.cart.entries()]
    .map(([id, qty]) => ({ product: state.byId.get(id), qty }))
    .filter((l) => l.product);
}

function renderCart() {
  const lines = cartLines();
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.product.price, 0);

  for (const [id, row] of state.rows) {
    const qty = state.cart.get(id) || 0;
    row.add.hidden = qty > 0;
    row.stepper.hidden = qty === 0;
    row.qty.textContent = qty;
    row.inc.disabled = qty >= MAX_QTY;
  }

  const list = $('cart-list');
  list.textContent = '';
  for (const l of lines) list.append(cartItem(l.qty, l.product.name, l.qty * l.product.price));

  const empty = lines.length === 0;
  $('cart-empty').hidden = !empty;
  $('cart-total-row').hidden = empty;
  $('order-form').hidden = empty;
  $('cart-total').textContent = money(total);

  $('bar').hidden = empty || !$('confirmation').hidden || state.orderInView;
  $('bar-count').textContent = units === 1 ? '1 producto' : `${units} productos`;
  $('bar-total').textContent = money(total);
}

function cartItem(qty, name, subtotal) {
  const li = $('tpl-cart-item').content.firstElementChild.cloneNode(true);
  li.querySelector('.ci-qty').textContent = `${qty}×`;
  li.querySelector('.ci-name').textContent = name;
  li.querySelector('.ci-sub').textContent = money(subtotal);
  return li;
}

// ---------- Día y hora de recogida ----------

function fillDays() {
  const select = $('f-day');
  const keep = select.value;
  select.textContent = '';
  const today = bogotaNow();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (slotsFor(i).length === 0) continue;
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    const name = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : WEEKDAYS[d.getUTCDay()];
    const opt = new Option(`${name} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, isoDay(d));
    opt.dataset.index = String(i);
    select.append(opt);
  }
  if ([...select.options].some((o) => o.value === keep)) select.value = keep;
  fillTimes();
}

function fillTimes() {
  const day = $('f-day');
  const select = $('f-time');
  const keep = select.value;
  select.textContent = '';
  const opt = day.selectedOptions[0];
  if (!opt) return;
  select.append(new Option('Elige la hora', ''));
  for (const m of slotsFor(Number(opt.dataset.index))) {
    select.append(new Option(timeLabel(m), `${pad(Math.floor(m / 60))}:${pad(m % 60)}`));
  }
  if ([...select.options].some((o) => o.value === keep)) select.value = keep;
}

// ---------- Formulario ----------

const FIELDS = {
  customerName: { input: 'f-name', error: 'e-name' },
  phone: { input: 'f-phone', error: 'e-phone' },
  day: { input: 'f-day', error: 'e-day' },
  time: { input: 'f-time', error: 'e-time' },
};

function setFieldError(field, message) {
  const { input, error } = FIELDS[field];
  const el = $(error);
  el.textContent = message || '';
  el.hidden = !message;
  $(input).setAttribute('aria-invalid', String(Boolean(message)));
}

function clearErrors() {
  for (const f of Object.keys(FIELDS)) setFieldError(f, '');
  const box = $('form-errors');
  box.hidden = true;
  box.textContent = '';
}

function showFormErrors(title, messages = []) {
  const box = $('form-errors');
  box.textContent = '';
  const p = document.createElement('p');
  p.textContent = title;
  box.append(p);
  if (messages.length > 0) {
    const ul = document.createElement('ul');
    for (const m of messages) {
      const li = document.createElement('li');
      li.textContent = m;
      ul.append(li);
    }
    box.append(ul);
  }
  box.hidden = false;
}

function readForm() {
  const name = $('f-name').value.trim();
  const phone = $('f-phone').value.replace(/[\s()-]/g, '');
  const day = $('f-day').value;
  const time = $('f-time').value;
  const errors = {};
  if (name.length < 2) errors.customerName = 'Escribe tu nombre (al menos 2 letras).';
  if (!/^\+?\d{7,15}$/.test(phone)) errors.phone = 'Escribe un celular de 7 a 15 dígitos, sin letras.';
  if (!day) errors.day = 'Elige el día.';
  if (!time) errors.time = 'Elige la hora de recogida.';
  return {
    errors,
    body: {
      customerName: name,
      phone,
      // Hora de Colombia explícita: no depende de la zona horaria del celular.
      pickupAt: `${day}T${time}:00-05:00`,
      items: cartLines().map((l) => ({ productId: l.product.id, qty: l.qty })),
    },
  };
}

async function submitOrder(event) {
  event.preventDefault();
  clearErrors();
  const { errors, body } = readForm();
  const fields = Object.keys(errors);
  if (fields.length > 0) {
    for (const f of fields) setFieldError(f, errors[f]);
    $(FIELDS[fields[0]].input).focus();
    return;
  }

  const btn = $('submit');
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.querySelector('.btn-label').textContent = 'Enviando pedido';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 201) {
      storageSet(LAST_ORDER_KEY, data);
      state.cart.clear();
      storageSet(CART_KEY, null);
      showConfirmation(data);
      return;
    }
    if (res.status === 400 && Array.isArray(data.errors)) {
      fillDays(); // si la hora elegida ya no alcanza, desaparece de la lista
      showFormErrors('Revisa esto antes de enviar:', data.errors);
    } else {
      showFormErrors(data.error || 'No pudimos registrar el pedido. Intenta de nuevo en un momento.');
    }
  } catch {
    showFormErrors('No hay conexión. Revisa tu internet e intenta de nuevo; tu pedido sigue aquí.');
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.querySelector('.btn-label').textContent = 'Hacer pedido';
  }
}

// ---------- Confirmación ----------

function showConfirmation(order, { scroll = true } = {}) {
  $('order-flow').hidden = true;
  const conf = $('confirmation');
  conf.hidden = false;
  $('conf-code').textContent = order.code;
  $('conf-when').textContent = `Recógelo el ${whenFmt.format(new Date(order.pickupAt)).replace(/\.$/, '')}.`;
  const list = $('conf-items');
  list.textContent = '';
  for (const it of order.items) list.append(cartItem(it.qty, it.name, it.subtotal));
  $('conf-total').textContent = money(order.total);
  renderCart();
  if (scroll) {
    conf.scrollIntoView({ behavior: 'smooth', block: 'start' });
    conf.focus({ preventScroll: true });
  }
}

function closeConfirmation() {
  storageSet(LAST_ORDER_KEY, null);
  $('confirmation').hidden = true;
  $('order-flow').hidden = false;
  $('order-form').reset();
  clearErrors();
  fillDays();
}

function newOrder() {
  closeConfirmation();
  renderCart();
  $('catalogo').scrollIntoView({ behavior: 'smooth' });
  $('catalogo').focus({ preventScroll: true });
}

// ---------- Versión ----------

async function loadVersion() {
  try {
    const v = await getJson('/version.json');
    $('version').textContent = (v.sha || 'local').slice(0, 7);
    if (v.environment) $('env').textContent = `· ${v.environment}`;
  } catch {
    // Sin version.json (ambiente local).
  }
}

// ---------- Inicio ----------

function init() {
  const saved = storageGet(CART_KEY);
  if (saved && typeof saved === 'object') {
    for (const [id, qty] of Object.entries(saved)) {
      if (Number.isInteger(qty) && qty > 0) state.cart.set(id, Math.min(qty, MAX_QTY));
    }
  }

  fillDays();
  $('f-day').addEventListener('change', fillTimes);
  $('order-form').addEventListener('submit', submitOrder);
  $('new-order').addEventListener('click', newOrder);
  $('bar-cta').addEventListener('click', (e) => {
    e.preventDefault();
    $('pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('pedido').focus({ preventScroll: true });
  });

  // Si el último pedido todavía no se recoge, se sigue mostrando su código.
  const last = storageGet(LAST_ORDER_KEY);
  if (last && last.code && new Date(last.pickupAt).getTime() > Date.now()) showConfirmation(last, { scroll: false });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      state.orderInView = entries[0].isIntersecting;
      renderCart();
    }).observe($('pedido'));
  }

  // Las horas de hoy se recalculan cada minuto para no ofrecer horas que ya pasaron.
  setInterval(fillDays, 60 * 1000);

  loadCatalog();
  loadVersion();
}

init();
