'use strict';

/**
 * Construye la respuesta de /api/health.
 * Es una función pura para poder probarla sin el runtime de Azure Functions.
 */
function buildHealth(env = process.env, now = new Date()) {
  return {
    status: 'ok',
    environment: env.APP_ENVIRONMENT || 'local',
    databaseConfigured: Boolean(env.COSMOS_ENDPOINT && env.COSMOS_DATABASE),
    time: now.toISOString(),
  };
}

module.exports = { buildHealth };
