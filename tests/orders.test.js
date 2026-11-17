'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrder, buildOrder, orderCode, bogotaHour, bogotaDate } = require('../src/api/src/lib/orders');

// "Ahora" fijo: 11 nov 2026, 10:00 hora de Bogotá (15:00 UTC).
const NOW = new Date('2026-11-11T15:00:00Z');

function validOrder(overrides = {}) {
  return {
    customerName: 'Ana Pérez',
    phone: '3001234567',
    pickupAt: '2026-11-11T12:00:00-05:00',
    items: [{ productId: 'pandebono', qty: 6 }],
    ...overrides,
  };
}

const CATALOG = new Map([
  ['pandebono', { id: 'pandebono', name: 'Pandebono', price: 2500 }],
  ['baguette', { id: 'baguette', name: 'Baguette', price: 6500 }],
  ['focaccia', { id: 'focaccia', name: 'Focaccia', price: 12000, available: false }],
]);

test('acepta un pedido válido', () => {
  assert.deepEqual(validateOrder(validOrder(), NOW), { ok: true, errors: [] });
});

test('rechaza un pedido vacío o que no es un objeto', () => {
  assert.equal(validateOrder(null, NOW).ok, false);
  assert.equal(validateOrder([], NOW).ok, false);
});

test('rechaza recogida con menos de 30 minutos de anticipación', () => {
  const r = validateOrder(validOrder({ pickupAt: '2026-11-11T10:10:00-05:00' }), NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /30 minutos/);
});

test('rechaza recogida a más de 7 días', () => {
  const r = validateOrder(validOrder({ pickupAt: '2026-11-20T10:00:00-05:00' }), NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /7 días/);
});

test('rechaza recogida fuera del horario 07:00–19:00', () => {
  const r = validateOrder(validOrder({ pickupAt: '2026-11-11T20:00:00-05:00' }), NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /07:00 y las 19:00/);
});

test('rechaza cantidades inválidas', () => {
  const r = validateOrder(validOrder({ items: [{ productId: 'pandebono', qty: 0 }] }), NOW);
  assert.equal(r.ok, false);
});

test('rechaza productos repetidos y pedidos con demasiadas líneas', () => {
  const dup = validateOrder(
    validOrder({ items: [{ productId: 'pandebono', qty: 1 }, { productId: 'pandebono', qty: 2 }] }),
    NOW,
  );
  assert.match(dup.errors.join(' '), /repetido/);
  const many = Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, qty: 1 }));
  assert.match(validateOrder(validOrder({ items: many }), NOW).errors.join(' '), /20 productos/);
});

test('rechaza teléfono inválido', () => {
  const r = validateOrder(validOrder({ phone: 'abc' }), NOW);
  assert.equal(r.ok, false);
});

test('convierte UTC a hora y fecha de Bogotá', () => {
  assert.equal(bogotaHour(new Date('2026-11-11T03:00:00Z')), 22);
  // 02:00 UTC del 12 nov todavía es 11 nov en Bogotá: el pedido queda en la partición del 11.
  assert.equal(bogotaDate(new Date('2026-11-12T02:00:00Z')), '2026-11-11');
});

test('el total sale del catálogo, no del navegador', () => {
  const input = validOrder({
    items: [
      { productId: 'pandebono', qty: 6, price: 1 },
      { productId: 'baguette', qty: 2 },
    ],
  });
  const r = buildOrder(input, CATALOG, NOW, { id: 'x', code: 'ABC23' });
  assert.equal(r.ok, true);
  assert.equal(r.order.total, 6 * 2500 + 2 * 6500);
  assert.equal(r.order.items[0].unitPrice, 2500);
  assert.equal(r.order.pickupDate, '2026-11-11');
  assert.equal(r.order.pickupAt, '2026-11-11T17:00:00.000Z');
  assert.equal(r.order.status, 'recibido');
});

test('rechaza productos que no existen o no están disponibles', () => {
  const r = buildOrder(
    validOrder({ items: [{ productId: 'pizza', qty: 1 }, { productId: 'focaccia', qty: 1 }] }),
    CATALOG,
    NOW,
  );
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /no existe/);
  assert.match(r.errors.join(' '), /no está disponible/);
});

test('el código de pedido tiene 5 caracteres sin letras ambiguas', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(orderCode(), /^[2-9A-HJ-NP-Z]{5}$/);
  }
});
