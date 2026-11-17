'use strict';

const { CATEGORY_ORDER } = require('./handlers');

/**
 * Valida el catálogo semilla (data/catalog.json) antes de cargarlo a Cosmos DB.
 * Devuelve la lista de errores; vacía si el catálogo es válido.
 */
function validateCatalog(products) {
  if (!Array.isArray(products) || products.length === 0) return ['El catálogo está vacío.'];
  const errors = [];
  const ids = new Set();
  products.forEach((p, i) => {
    const where = `Producto ${i + 1} (${p && p.id})`;
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9-]{2,40}$/.test(p.id)) {
      errors.push(`${where}: id inválido.`);
    } else if (ids.has(p.id)) {
      errors.push(`${where}: id repetido.`);
    } else {
      ids.add(p.id);
    }
    if (!p || typeof p.name !== 'string' || p.name.trim().length === 0) errors.push(`${where}: falta el nombre.`);
    if (!p || !CATEGORY_ORDER.includes(p.category)) errors.push(`${where}: categoría desconocida.`);
    if (!p || !Number.isInteger(p.price) || p.price <= 0) errors.push(`${where}: el precio debe ser un entero positivo.`);
    if (!p || typeof p.image !== 'string' || !/^\/img\/[a-z0-9-]+\.jpg$/.test(p.image)) {
      errors.push(`${where}: la imagen debe ser /img/<nombre>.jpg.`);
    }
  });
  return errors;
}

module.exports = { validateCatalog };
