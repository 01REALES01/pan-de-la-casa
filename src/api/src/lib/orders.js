'use strict';

// Reglas de negocio del pedido. Supuestos (ver docs/supuestos.md):
// - La panadería atiende de 07:00 a 19:00, hora de Colombia (UTC-5, sin horario de verano).
// - Un pedido se recoge al menos 30 minutos después de hacerse.
const BUSINESS_OPEN_HOUR = 7;
const BUSINESS_CLOSE_HOUR = 19;
const MIN_LEAD_MINUTES = 30;
const BOGOTA_OFFSET_HOURS = -5;
const MAX_QTY_PER_ITEM = 50;

function bogotaHour(date) {
  return (date.getUTCHours() + 24 + BOGOTA_OFFSET_HOURS) % 24;
}

/**
 * Valida un pedido. Devuelve { ok, errors }.
 * @param {object} order { customerName, phone, pickupAt (ISO), items: [{ productId, qty }] }
 * @param {Date} now
 */
function validateOrder(order, now = new Date()) {
  const errors = [];
  if (!order || typeof order !== 'object') {
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
  if (Number.isNaN(pickup.getTime())) {
    errors.push('La hora de recogida no es válida.');
  } else {
    if (pickup.getTime() - now.getTime() < MIN_LEAD_MINUTES * 60 * 1000) {
      errors.push(`La recogida debe ser al menos ${MIN_LEAD_MINUTES} minutos después de ahora.`);
    }
    const hour = bogotaHour(pickup);
    if (hour < BUSINESS_OPEN_HOUR || hour >= BUSINESS_CLOSE_HOUR) {
      errors.push('La recogida debe estar entre las 07:00 y las 19:00.');
    }
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    errors.push('El pedido debe tener al menos un producto.');
  } else {
    order.items.forEach((item, i) => {
      if (!item || typeof item.productId !== 'string' || item.productId.length === 0) {
        errors.push(`Producto ${i + 1}: falta el identificador.`);
      }
      if (!item || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > MAX_QTY_PER_ITEM) {
        errors.push(`Producto ${i + 1}: la cantidad debe ser un entero entre 1 y ${MAX_QTY_PER_ITEM}.`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateOrder, bogotaHour };
