'use strict';

const { app } = require('@azure/functions');
const { createApi } = require('../lib/handlers');
const { createCosmosStore } = require('../lib/cosmos-store');

// Una sola instancia por proceso: comparte el cliente de Cosmos DB y la caché del catálogo.
const api = createApi(createCosmosStore());

// GET /api/products — catálogo con fotos y precios.
app.http('products', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'products',
  handler: async (_request, context) => api.listProducts({ log: (m) => context.log(m) }),
});

// POST /api/orders — registra un pedido para recoger.
app.http('orders', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { errors: ['El cuerpo debe ser JSON válido.'] } };
    }
    return api.createOrder(body, { log: (m) => context.log(m) });
  },
});
