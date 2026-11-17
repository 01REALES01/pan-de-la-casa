#!/usr/bin/env node
'use strict';

// Sincroniza data/catalog.json con el contenedor `products` de Cosmos DB.
// Lo ejecuta el pipeline en cada despliegue: un cambio al catálogo en `main` llega a dev y a prod sin pasos a mano.
// Uso: COSMOS_ENDPOINT=... COSMOS_KEY=... COSMOS_DATABASE=panaderia-dev node scripts/seed-catalog.js

const path = require('node:path');
const { CosmosClient } = require('@azure/cosmos');
const { validateCatalog } = require('../src/api/src/lib/catalog');

async function main() {
  const { COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE } = process.env;
  if (!COSMOS_ENDPOINT || !COSMOS_KEY || !COSMOS_DATABASE) {
    throw new Error('Faltan COSMOS_ENDPOINT, COSMOS_KEY o COSMOS_DATABASE');
  }

  const catalog = require(path.join(__dirname, '..', 'data', 'catalog.json'));
  const errors = validateCatalog(catalog);
  if (errors.length > 0) throw new Error(`Catálogo inválido:\n- ${errors.join('\n- ')}`);

  const container = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY })
    .database(COSMOS_DATABASE)
    .container('products');

  for (const product of catalog) {
    await container.items.upsert(product);
  }

  // Lo que ya no está en el catálogo se borra (la clave de partición es la categoría).
  const keep = new Set(catalog.map((p) => p.id));
  const { resources: existing } = await container.items.query('SELECT c.id, c.category FROM c').fetchAll();
  const stale = existing.filter((p) => !keep.has(p.id));
  for (const p of stale) {
    await container.item(p.id, p.category).delete();
  }

  console.log(`Catálogo sincronizado en ${COSMOS_DATABASE}: ${catalog.length} productos, ${stale.length} eliminados.`);
}

main().catch((err) => {
  console.error(`FALLO al sincronizar el catálogo: ${err.message}`);
  process.exit(1);
});
