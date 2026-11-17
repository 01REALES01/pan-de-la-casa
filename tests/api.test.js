'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApi, createMemoryStore } = require('../src/api/src/lib/handlers');
const { validateCatalog } = require('../src/api/src/lib/catalog');

const catalog = require('../data/catalog.json');
const NOW = new Date('2026-11-11T15:00:00Z'); // 10:00 en Bogotá

function setup(products = catalog) {
  const store = createMemoryStore(products);
  const api = createApi(store, { now: () => NOW });
  return { store, api };
}

const order = {
  customerName: 'Ana Pérez',
  phone: '3001234567',
  pickupAt: '2026-11-11T12:00:00-05:00',
  items: [
    { productId: 'pandebono', qty: 6 },
    { productId: 'baguette', qty: 1 },
  ],
};

test('el catálogo semilla es válido', () => {
  assert.deepEqual(validateCatalog(catalog), []);
});

test('cada producto del catálogo tiene su foto en src/web', () => {
  for (const p of catalog) {
    const file = path.join(__dirname, '..', 'src', 'web', p.image);
    assert.ok(fs.existsSync(file), `falta la foto ${p.image}`);
  }
});

test('GET /api/products devuelve el catálogo ordenado por categoría', async () => {
  const { api } = setup();
  const res = await api.listProducts();
  assert.equal(res.status, 200);
  assert.equal(res.jsonBody.products.length, catalog.length);
  const cats = res.jsonBody.products.map((p) => p.category);
  assert.deepEqual(cats, [...cats].sort((a, b) => ['amasijos', 'panes', 'dulces'].indexOf(a) - ['amasijos', 'panes', 'dulces'].indexOf(b)));
});

test('POST /api/orders registra el pedido y responde con código y total', async () => {
  const { api, store } = setup();
  const res = await api.createOrder(order);
  assert.equal(res.status, 201);
  assert.match(res.jsonBody.code, /^[2-9A-HJ-NP-Z]{5}$/);
  assert.equal(res.jsonBody.total, 6 * 2500 + 6500);
  assert.equal(store.orders.length, 1);
  assert.equal(store.orders[0].pickupDate, '2026-11-11');
});

test('POST /api/orders rechaza un pedido inválido con 400 sin guardar nada', async () => {
  const { api, store } = setup();
  const res = await api.createOrder({ ...order, items: [] });
  assert.equal(res.status, 400);
  assert.ok(res.jsonBody.errors.length > 0);
  assert.equal(store.orders.length, 0);
});

test('los logs del pedido no incluyen nombre ni teléfono', async () => {
  const { api } = setup();
  const lines = [];
  await api.createOrder(order, { log: (m) => lines.push(m) });
  const all = lines.join('\n');
  assert.ok(lines.length > 0);
  assert.ok(!all.includes('Ana') && !all.includes('3001234567'));
});

test('si la base de datos falla, la API responde 503', async () => {
  const store = {
    listProducts: async () => {
      throw new Error('timeout');
    },
    saveOrder: async () => {},
  };
  const api = createApi(store, { now: () => NOW });
  assert.equal((await api.listProducts()).status, 503);
  assert.equal((await api.createOrder(order)).status, 503);
});

test('el catálogo se guarda en caché por 30 s para aguantar los picos', async () => {
  let reads = 0;
  let t = NOW.getTime();
  const store = {
    listProducts: async () => {
      reads++;
      return catalog;
    },
    saveOrder: async () => {},
  };
  const api = createApi(store, { now: () => new Date(t) });
  await api.listProducts();
  await api.listProducts();
  assert.equal(reads, 1);
  t += 31 * 1000;
  await api.listProducts();
  assert.equal(reads, 2);
});
