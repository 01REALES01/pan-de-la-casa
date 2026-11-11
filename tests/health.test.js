'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHealth } = require('../src/api/src/lib/health');

test('health responde ok y el ambiente', () => {
  const h = buildHealth({ APP_ENVIRONMENT: 'dev' }, new Date('2026-11-11T00:00:00Z'));
  assert.equal(h.status, 'ok');
  assert.equal(h.environment, 'dev');
  assert.equal(h.time, '2026-11-11T00:00:00.000Z');
});

test('health indica si la base de datos está configurada', () => {
  assert.equal(buildHealth({}).databaseConfigured, false);
  assert.equal(
    buildHealth({ COSMOS_ENDPOINT: 'https://x', COSMOS_DATABASE: 'panaderia-dev' }).databaseConfigured,
    true,
  );
});

test('health nunca expone la clave de la base de datos', () => {
  const h = buildHealth({ COSMOS_KEY: 'secreto' });
  assert.ok(!JSON.stringify(h).includes('secreto'));
});
