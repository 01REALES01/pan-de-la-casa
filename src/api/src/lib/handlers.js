'use strict';

const { validateOrder, buildOrder } = require('./orders');

// Orden en que se muestran las categorías del catálogo.
const CATEGORY_ORDER = ['amasijos', 'panes', 'dulces'];

// Caché corta del catálogo por instancia: en los picos de fin de semana (3x) casi todas las
// visitas leen el catálogo; así la mayoría no consume RU de Cosmos DB.
const CATALOG_TTL_MS = 30 * 1000;

function sortProducts(products) {
  const rank = (p) => {
    const i = CATEGORY_ORDER.indexOf(p.category);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...products].sort((a, b) => rank(a) - rank(b) || (a.sort ?? 0) - (b.sort ?? 0));
}

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    unit: p.unit,
    description: p.description,
    image: p.image,
    available: p.available !== false,
  };
}

/**
 * Crea los handlers de la API sobre un almacén (Cosmos DB en Azure, memoria en pruebas y local).
 * El almacén expone: listProducts() y saveOrder(order).
 */
function createApi(store, { now = () => new Date(), ttlMs = CATALOG_TTL_MS } = {}) {
  let cache = null;

  async function catalog() {
    const t = now().getTime();
    if (!cache || t - cache.at > ttlMs) {
      cache = { at: t, products: sortProducts(await store.listProducts()) };
    }
    return cache.products;
  }

  async function listProducts({ log = () => {} } = {}) {
    try {
      const products = (await catalog()).map(publicProduct);
      return {
        status: 200,
        jsonBody: { products },
        headers: { 'Cache-Control': 'public, max-age=30' },
      };
    } catch (err) {
      log(`Error leyendo el catálogo: ${err.message}`);
      return { status: 503, jsonBody: { error: 'El catálogo no está disponible. Intenta de nuevo.' } };
    }
  }

  async function createOrder(body, { log = () => {} } = {}) {
    const at = now();
    const check = validateOrder(body, at);
    if (!check.ok) return { status: 400, jsonBody: { errors: check.errors } };

    let built;
    try {
      const byId = new Map((await catalog()).map((p) => [p.id, p]));
      built = buildOrder(body, byId, at);
    } catch (err) {
      log(`Error leyendo el catálogo: ${err.message}`);
      return { status: 503, jsonBody: { error: 'No pudimos registrar el pedido. Intenta de nuevo.' } };
    }
    if (!built.ok) return { status: 400, jsonBody: { errors: built.errors } };

    const { order } = built;
    try {
      await store.saveOrder(order);
    } catch (err) {
      log(`Error guardando el pedido ${order.code}: ${err.message}`);
      return { status: 503, jsonBody: { error: 'No pudimos registrar el pedido. Intenta de nuevo.' } };
    }

    // Sin nombre ni teléfono en los logs: solo lo necesario para operar.
    log(`Pedido ${order.code} registrado: ${order.items.length} productos, total ${order.total}`);
    return {
      status: 201,
      jsonBody: {
        code: order.code,
        pickupAt: order.pickupAt,
        items: order.items.map(({ name, qty, unitPrice, subtotal }) => ({ name, qty, unitPrice, subtotal })),
        total: order.total,
        status: order.status,
      },
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  return { listProducts, createOrder };
}

/** Almacén en memoria: pruebas y servidor local. */
function createMemoryStore(products = []) {
  const orders = [];
  return {
    orders,
    async listProducts() {
      return products;
    },
    async saveOrder(order) {
      orders.push(order);
    },
  };
}

module.exports = { createApi, createMemoryStore, sortProducts, CATEGORY_ORDER };
