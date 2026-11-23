#!/usr/bin/env bash
# Smoke test contra un sitio desplegado.
# Uso: scripts/smoke.sh https://<host> <sha-esperado>
# Falla si el sitio no sirve la versión esperada o si la API no responde.
set -euo pipefail

URL="${1:?Falta la URL}"
SHA="${2:?Falta el SHA esperado}"
ATTEMPTS=20
WAIT=6

echo "Smoke test: $URL (esperando versión $SHA)"

got=""
for i in $(seq 1 "$ATTEMPTS"); do
  got=$(curl -fsS "$URL/version.json?nocache=$RANDOM" 2>/dev/null | jq -r '.sha // empty' || true)
  if [ "$got" = "$SHA" ]; then
    echo "  [ok] versión desplegada ($i/$ATTEMPTS)"
    break
  fi
  echo "  esperando la nueva versión... ($i/$ATTEMPTS, actual: ${got:-ninguna})"
  sleep "$WAIT"
done
[ "$got" = "$SHA" ] || { echo "FALLO: el sitio sirve '${got:-nada}', se esperaba '$SHA'"; exit 1; }

# Con `set -e`, un comando que falla dentro de `cmd && echo` no detiene el script: el fallo se maneja explícitamente.
curl -fsS -o /dev/null "$URL/" || { echo "FALLO: la página principal no responde"; exit 1; }
echo "  [ok] página principal"

for i in $(seq 1 "$ATTEMPTS"); do
  status=$(curl -fsS "$URL/api/health" 2>/dev/null | jq -r '.status // empty' || true)
  if [ "$status" = "ok" ]; then
    echo "  [ok] /api/health"
    break
  fi
  echo "  esperando la API... ($i/$ATTEMPTS)"
  sleep "$WAIT"
done
[ "$status" = "ok" ] || { echo "FALLO: /api/health no respondió ok"; exit 1; }

# MVP 1: el catálogo responde con productos (lee de Cosmos DB).
count=$(curl -fsS "$URL/api/products" | jq '.products | length' || true)
[ "${count:-0}" -gt 0 ] || { echo "FALLO: /api/products no devolvió productos"; exit 1; }
echo "  [ok] /api/products ($count productos)"

# MVP 2: la API de pedidos valida. Se envía un pedido inválido a propósito para no crear pedidos reales.
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d '{"customerName":"x","items":[]}' "$URL/api/orders")
[ "$code" = "400" ] || { echo "FALLO: POST /api/orders con un pedido inválido respondió $code (se esperaba 400)"; exit 1; }
echo "  [ok] POST /api/orders rechaza un pedido inválido"

echo "Smoke test superado."
