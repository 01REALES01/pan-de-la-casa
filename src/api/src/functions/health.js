'use strict';

const { app } = require('@azure/functions');
const { buildHealth } = require('../lib/health');

// GET /api/health — lo usa el smoke test del pipeline.
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health-roto', // PRUEBA DE ROLLBACK: rompe /api/health a propósito; se revierte enseguida
  handler: async () => ({
    status: 200,
    jsonBody: buildHealth(),
    headers: { 'Cache-Control': 'no-store' },
  }),
});
