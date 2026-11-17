'use strict';

// Almacén sobre Cosmos DB. Solo lo cargan las funciones de Azure (las pruebas usan el de memoria).
const { CosmosClient } = require('@azure/cosmos');

let database;

function getDatabase(env = process.env) {
  if (!database) {
    if (!env.COSMOS_ENDPOINT || !env.COSMOS_KEY || !env.COSMOS_DATABASE) {
      throw new Error('Cosmos DB no está configurado');
    }
    const client = new CosmosClient({ endpoint: env.COSMOS_ENDPOINT, key: env.COSMOS_KEY });
    database = client.database(env.COSMOS_DATABASE);
  }
  return database;
}

function createCosmosStore(env = process.env) {
  return {
    async listProducts() {
      const { resources } = await getDatabase(env)
        .container('products')
        .items.query(
          'SELECT c.id, c.name, c.category, c.price, c.unit, c.description, c.image, c.available, c.sort FROM c',
        )
        .fetchAll();
      return resources;
    },
    async saveOrder(order) {
      await getDatabase(env).container('orders').items.create(order);
    },
  };
}

module.exports = { createCosmosStore };
