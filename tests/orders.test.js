'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrder, bogotaHour } = require('../src/api/src/lib/orders');

// "Ahora" fijo: 11 nov 2026, 10:00 hora de Bogotá (15:00 UTC).
const NOW = new Date('2026-11-11T15:00:00Z');

function validOrder(overrides = {}) {
  return {
    customerName: 'Ana Pérez',
    phone: '3001234567',
    pickupAt: '2026-11-11T17:00:00Z', // 12:00 en Bogotá
    items: [{ productId: 'pan-bono', qty: 6 }],
    ...overrides,
  };
}

test('acepta un pedido válido', () => {
  assert.deepEqual(validateOrder(validOrder(), NOW), { ok: true, errors: [] });
});

test('rechaza un pedido vacío', () => {
  assert.equal(validateOrder(null, NOW).ok, false);
});

test('rechaza recogida con menos de 30 minutos de anticipación', () => {
  const r = validateOrder(validOrder({ pickupAt: '2026-11-11T15:10:00Z' }), NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /30 minutos/);
});

test('rechaza recogida fuera del horario 07:00–19:00', () => {
  const r = validateOrder(validOrder({ pickupAt: '2026-11-12T01:00:00Z' }), NOW); // 20:00 Bogotá
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /07:00 y las 19:00/);
});

test('rechaza cantidades inválidas', () => {
  const r = validateOrder(validOrder({ items: [{ productId: 'pan-bono', qty: 0 }] }), NOW);
  assert.equal(r.ok, false);
});

test('rechaza teléfono inválido', () => {
  const r = validateOrder(validOrder({ phone: 'abc' }), NOW);
  assert.equal(r.ok, false);
});

test('convierte UTC a hora de Bogotá', () => {
  assert.equal(bogotaHour(new Date('2026-11-11T03:00:00Z')), 22);
});
