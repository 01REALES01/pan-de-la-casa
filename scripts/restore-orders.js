#!/usr/bin/env node
'use strict';

// Copia los pedidos de una cuenta de Cosmos DB restaurada a la cuenta original (ADR-004, paso 3).
// La versión restaurada reemplaza a la actual: así se recuperan pedidos borrados o dañados.
// Pedidos creados después del instante restaurado no existen en el origen, así que no se tocan.
//
// Uso:
//   SOURCE_ENDPOINT=... SOURCE_KEY=... TARGET_ENDPOINT=... TARGET_KEY=... \
//   COSMOS_DATABASE=panaderia-prod node scripts/restore-orders.js [--dry-run]

const { CosmosClient } = require('@azure/cosmos');

const SYSTEM_FIELDS = ['_rid', '_self', '_etag', '_attachments', '_ts'];

async function main() {
  const { SOURCE_ENDPOINT, SOURCE_KEY, TARGET_ENDPOINT, TARGET_KEY, COSMOS_DATABASE } = process.env;
  if (!SOURCE_ENDPOINT || !SOURCE_KEY || !TARGET_ENDPOINT || !TARGET_KEY || !COSMOS_DATABASE) {
    throw new Error('Faltan SOURCE_ENDPOINT, SOURCE_KEY, TARGET_ENDPOINT, TARGET_KEY o COSMOS_DATABASE');
  }
  if (SOURCE_ENDPOINT === TARGET_ENDPOINT) throw new Error('El origen y el destino son la misma cuenta');
  const dryRun = process.argv.includes('--dry-run');

  const source = new CosmosClient({ endpoint: SOURCE_ENDPOINT, key: SOURCE_KEY })
    .database(COSMOS_DATABASE).container('orders');
  const target = new CosmosClient({ endpoint: TARGET_ENDPOINT, key: TARGET_KEY })
    .database(COSMOS_DATABASE).container('orders');

  const { resources: orders } = await source.items.readAll().fetchAll();
  let created = 0;
  let replaced = 0;
  for (const order of orders) {
    const doc = { ...order };
    for (const field of SYSTEM_FIELDS) delete doc[field];

    const { resource: current } = await target.item(doc.id, doc.pickupDate).read();
    if (current) replaced += 1;
    else created += 1;
    if (!dryRun) await target.items.upsert(doc);
  }

  const mode = dryRun ? ' (simulación, no se escribió nada)' : '';
  console.log(`${COSMOS_DATABASE}: ${orders.length} pedidos en el respaldo; ${created} recreados, ${replaced} reemplazados${mode}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
