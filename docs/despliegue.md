# Diseño del despliegue

> Borrador; se completa con tiempos medidos y capturas del pipeline.

## Etapas

| Etapa | Cuándo corre | Qué hace | Si falla |
|---|---|---|---|
| Lint y pruebas | PR y push a `main` | ESLint + pruebas unitarias (`node:test`) | Bloquea el merge y el despliegue |
| Validación de IaC | PR y push a `main` | Compila Bicep + Checkov (informativo) | Bloquea si Bicep no compila |
| CodeQL | PR, push y semanal | Análisis de seguridad del código | Reporta en Security |
| Desplegar dev | Push a `main` | Bicep (dev) → app → smoke test | Rollback de dev; prod no se despliega |
| Desplegar prod | Tras dev, con aprobación | Bicep (prod) → app → smoke test | Rollback de prod |

## Ambientes

Dos recursos de Static Web Apps separados (`swa-pandelacasa-dev` y `swa-pandelacasa-prod`), cada uno con su
base de datos en la misma cuenta de Cosmos DB (`panaderia-dev` y `panaderia-prod`, 400 RU/s cada una, dentro de
los 1000 RU/s gratuitos). Un cambio se promueve haciendo merge a `main`: llega primero a dev y, si el smoke test pasa
y se aprueba, a prod. El mismo commit se despliega en ambos.

No usamos los entornos de preview de Static Web Apps: con recursos separados, dev tiene su propia configuración y su
propia base de datos sin depender de cómo el servicio maneje la configuración de los previews, y ningún cambio en
prueba puede escribir en los datos de producción.

## Secretos e identidad

- GitHub Actions entra a Azure con **OIDC**: una identidad administrada con credenciales federadas, una por
  environment (`repo:<owner>/<repo>:environment:dev` y `...:prod`). No hay contraseñas guardadas.
- La identidad tiene rol **Contributor solo sobre `rg-pandelacasa`**, no sobre la suscripción.
- El token de despliegue de Static Web Apps se pide en cada ejecución con esa identidad y se enmascara en los logs.
- La clave de Cosmos DB la inyecta Bicep en la configuración de Static Web Apps; nunca está en el repositorio.
  (Las managed functions no soportan identidad administrada; en producción se usaría una Function App propia
  con identidad administrada y Key Vault. Ver ADR-003.)

## Rollback

> Estado: implementado en `deploy.yml`, **pendiente de prueba** con un commit que rompa `/api/health` en dev.

1. **Automático:** si el smoke test falla, el pipeline busca el commit de la última ejecución exitosa de `ci-cd.yml`
   en `main`, lo vuelve a desplegar y verifica con otro smoke test. La ejecución queda en rojo para que se vea.
2. **Manual:** en GitHub Actions, abrir una ejecución anterior exitosa y usar "Re-run all jobs", o hacer
   `git revert` del commit problemático y hacer merge.

## Smoke test

`scripts/smoke.sh` comprueba que el sitio sirve exactamente el commit desplegado (`/version.json`), que la página
principal responde y que `/api/health` devuelve `ok`.

## Pendiente

- [ ] Medir la duración total del pipeline (la demo dura 5 minutos). Primera medición: CI + dev ≈ 3 min.
- [ ] Probar el rollback automático en dev y guardar la captura.
- [ ] Justificar los hallazgos de Checkov aceptados.
- [ ] Capturas de una ejecución bloqueada por pruebas y de un rollback.
