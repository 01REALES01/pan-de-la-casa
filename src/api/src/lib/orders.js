'use strict';

const crypto = require('node:crypto');

// Reglas de negocio del pedido. Supuestos (ver docs/supuestos.md):
// - La panadería atiende de 07:00 a 19:00, hora de Colombia (UTC-5, sin horario de verano).
// - Un pedido se recoge al menos 30 minutos después de hacerse y como máximo 7 días después.
const BUSINESS_OPEN_HOUR = 7;
const BUSINESS_CLOSE_HOUR = 19;
const MIN_LEAD_MINUTES = 30;
const MAX_DAYS_AHEAD = 7;
const BOGOTA_OFFSET_HOURS = -5;
const MAX_QTY_PER_ITEM = 50;
const MAX_LINES = 20;

const HOUR_MS = 60 * 60 * 1000;

function bogotaHour(date) {
  return (date.getUTCHours() + 24 + BOGOTA_OFFSET_HOURS) % 24;
}

/** Fecha de recogida (AAAA-MM-DD) en hora de Bogotá. Es la clave de partición de `orders`. */
function bogotaDate(date) {
  return new Date(date.getTime() + BOGOTA_OFFSET_HOURS * HOUR_MS).toISOString().slice(0, 10);
}

/**
 * Valida la forma del pedido (sin consultar el catálogo). Devuelve { ok, errors }.
 * @param {object} order { customerName, phone, pickupAt (ISO), items: [{ productId, qty }] }
 * @param {Date} now
 */
function validateOrder(order, now = new Date()) {
  const errors = [];
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return { ok: false, errors: ['El pedido es obligatorio.'] };
  }

  const name = typeof order.customerName === 'string' ? order.customerName.trim() : '';
  if (name.length < 2 || name.length > 80) {
    errors.push('El nombre debe tener entre 2 y 80 caracteres.');
  }

  if (typeof order.phone !== 'string' || !/^\+?\d{7,15}$/.test(order.phone)) {
    errors.push('El teléfono debe tener entre 7 y 15 dígitos.');
  }

  const pickup = new Date(order.pickupAt);
  if (typeof order.pickupAt !== 'string' || Number.isNaN(pickup.getTime())) {
    errors.push('La hora de recogida no es válida.');
  } else {
    const ahead = pickup.getTime() - now.getTime();
    if (ahead < MIN_LEAD_MINUTES * 60 * 1000) {
      errors.push(`La recogida debe ser al menos ${MIN_LEAD_MINUTES} minutos después de ahora.`);
    } else if (ahead > MAX_DAYS_AHEAD * 24 * HOUR_MS) {
      errors.push(`La recogida debe ser en los próximos ${MAX_DAYS_AHEAD} días.`);
    }
    const hour = bogotaHour(pickup);
    if (hour < BUSINESS_OPEN_HOUR || hour >= BUSINESS_CLOSE_HOUR) {
      errors.push('La recogida debe estar entre las 07:00 y las 19:00.');
    }
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    errors.push('El pedido debe tener al menos un producto.');
  } else if (order.items.length > MAX_LINES) {
    errors.push(`El pedido puede tener como máximo ${MAX_LINES} productos distintos.`);
  } else {
    const seen = new Set();
    order.items.forEach((item, i) => {
      if (!item || typeof item.productId !== 'string' || item.productId.length === 0) {
        errors.push(`Producto ${i + 1}: falta el identificador.`);
      } else if (seen.has(item.productId)) {
        errors.push(`Producto ${i + 1}: está repetido.`);
      } else {
        seen.add(item.productId);
      }
      if (!item || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > MAX_QTY_PER_ITEM) {
        errors.push(`Producto ${i + 1}: la cantidad debe ser un entero entre 1 y ${MAX_QTY_PER_ITEM}.`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

// Código corto para que el cliente lo diga en la tienda. Sin 0/O ni 1/I para evitar confusiones.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function orderCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

/**
 * Construye el documento del pedido. Los precios salen del catálogo, nunca del navegador.
 * Devuelve { ok: true, order } o { ok: false, errors }.
 * @param {object} input pedido ya validado con validateOrder
 * @param {Map<string, object>} productsById catálogo vigente
 */
function buildOrder(input, productsById, now = new Date(), ids = {}) {
  const errors = [];
  const items = [];
  for (const { productId, qty } of input.items) {
    const product = productsById.get(productId);
    if (!product) {
      errors.push(`El producto "${productId}" no existe.`);
    } else if (product.available === false) {
      errors.push(`${product.name} no está disponible por ahora.`);
    } else {
      items.push({
        productId,
        name: product.name,
        unitPrice: product.price,
        qty,
        subtotal: product.price * qty,
      });
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const pickup = new Date(input.pickupAt);
  return {
    ok: true,
    order: {
      id: ids.id || crypto.randomUUID(),
      code: ids.code || orderCode(),
      pickupDate: bogotaDate(pickup),
      pickupAt: pickup.toISOString(),
      customerName: input.customerName.trim(),
      phone: input.phone,
      items,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
      status: 'recibido',
      createdAt: now.toISOString(),
    },
  };
}

module.exports = {
  validateOrder,
  buildOrder,
  orderCode,
  bogotaHour,
  bogotaDate,
  MAX_LINES,
};
