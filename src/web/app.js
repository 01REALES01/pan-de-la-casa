'use strict';

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
  return res.json();
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

async function main() {
  try {
    const v = await getJson('/version.json');
    setText('version', (v.sha || 'local').slice(0, 7));
  } catch {
    setText('version', 'local');
  }

  try {
    const h = await getJson('/api/health');
    setText('env', h.environment);
    setText('api', h.status === 'ok' ? 'En línea' : h.status);
    setText('db', h.databaseConfigured ? 'Configurada' : 'Sin configurar');
  } catch (err) {
    setText('api', 'No disponible');
    console.error(err);
  }
}

main();
