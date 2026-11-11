'use strict';

const { app } = require('@azure/functions');
const { buildHealth } = require('../lib/health');

// GET /api/health — lo usa el smoke test del pipeline.
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => ({
    status: 200,
    jsonBody: buildHealth(),
    headers: { 'Cache-Control': 'no-store' },
  }),
});
