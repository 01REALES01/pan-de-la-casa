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

curl -fsS -o /dev/null "$URL/" && echo "  [ok] página principal"

for i in $(seq 1 "$ATTEMPTS"); do
  status=$(curl -fsS "$URL/api/health" 2>/dev/null | jq -r '.status // empty' || true)
  if [ "$status" = "ok" ]; then
    echo "  [ok] /api/health"
    echo "Smoke test superado."
    exit 0
  fi
  echo "  esperando la API... ($i/$ATTEMPTS)"
  sleep "$WAIT"
done

echo "FALLO: /api/health no respondió ok"
exit 1
