#!/usr/bin/env node
'use strict';

// Servidor local para desarrollo: sirve src/web con las mismas cabeceras de seguridad que Static Web Apps
// (staticwebapp.config.json) y la API con la misma lógica, sobre un almacén en memoria.
// Uso: npm run dev  ->  http://localhost:4280

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createApi, createMemoryStore } = require('../src/api/src/lib/handlers');
const { buildHealth } = require('../src/api/src/lib/health');

const PORT = Number(process.env.PORT) || 4280;
const WEB = path.join(__dirname, '..', 'src', 'web');
const swaConfig = JSON.parse(fs.readFileSync(path.join(WEB, 'staticwebapp.config.json'), 'utf8'));
const store = createMemoryStore(require('../data/catalog.json'));
const api = createApi(store);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...swaConfig.globalHeaders, ...headers });
  res.end(body);
}

function sendJson(res, { status, jsonBody, headers }) {
  send(res, status, JSON.stringify(jsonBody), { 'Content-Type': 'application/json', ...headers });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const log = (m) => console.log(`  api: ${m}`);

  if (url.pathname === '/api/health') return sendJson(res, { status: 200, jsonBody: buildHealth() });
  if (url.pathname === '/api/products' && req.method === 'GET') return sendJson(res, await api.listProducts({ log }));
  if (url.pathname === '/api/orders' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, { status: 400, jsonBody: { errors: ['El cuerpo debe ser JSON válido.'] } });
    }
    return sendJson(res, await api.createOrder(body, { log }));
  }
  if (url.pathname.startsWith('/api/')) return sendJson(res, { status: 404, jsonBody: { error: 'No existe' } });

  const file = path.join(WEB, path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(WEB)) return send(res, 403, 'Prohibido');
  fs.readFile(file, (err, data) => {
    if (err) {
      // Igual que navigationFallback de SWA: las rutas desconocidas sirven index.html.
      if (path.extname(file)) return send(res, 404, 'No encontrado');
      return send(res, 200, fs.readFileSync(path.join(WEB, 'index.html')), { 'Content-Type': TYPES['.html'] });
    }
    send(res, 200, data, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  });
});

server.listen(PORT, () => console.log(`Pan de la Casa en http://localhost:${PORT} (datos en memoria)`));
