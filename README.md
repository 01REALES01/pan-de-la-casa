# Pan de la Casa: arquitectura cloud para una PyME

Proyecto final de **Paradigmas de Computación en la Nube** (Escuela Colombiana de Ingeniería Julio Garavito).
La panadería "Pan de la Casa" recibe pedidos web para recoger en tienda. Este repositorio contiene el MVP,
la infraestructura como código, el pipeline de CI/CD y la documentación de arquitectura.

**MVP:** consultar el catálogo y registrar un pedido.

## Arquitectura

| Capa | Servicio | Plan |
|---|---|---|
| Frontend | Azure Static Web Apps | Free (MVP) · Standard (producción) |
| API | Azure Functions (managed, Node.js 22) | incluido en Static Web Apps |
| Datos | Azure Cosmos DB for NoSQL | free tier (1000 RU/s, 25 GB) |
| Observabilidad | Application Insights + Log Analytics | pago por uso |
| IaC | Bicep | — |
| CI/CD | GitHub Actions + OIDC | — |

Región: **Central US** (la única región permitida por la suscripción Azure for Students donde existe Static Web Apps).

Detalle y justificación: [docs/hld.md](docs/hld.md) · decisiones: [docs/adr/](docs/adr/) · despliegue: [docs/despliegue.md](docs/despliegue.md).

## Estructura

```
.github/workflows/   ci-cd.yml (CI + despliegue), deploy.yml (reutilizable), codeql.yml
infra/               main.bicep (por ambiente), budget.bicep (alerta de presupuesto)
scripts/             bootstrap.sh (configuración inicial), smoke.sh (smoke test)
src/web/             frontend estático
src/api/             API (Azure Functions)
tests/               pruebas unitarias (node:test)
docs/                HLD, ADR, supuestos, diagramas, costos, diseño de despliegue
```

## Pipeline

- **Pull request a `main`:** lint, pruebas unitarias, compilación de Bicep, Checkov y CodeQL. Si las pruebas fallan, no se puede hacer merge.
- **Merge a `main`:** CI → despliegue a **dev** → smoke test → aprobación manual → despliegue a **prod** → smoke test.
- **Rollback:** si el smoke test falla, el pipeline vuelve a desplegar automáticamente la última versión que pasó.

## Desarrollo local

```bash
npm ci
npm run lint
npm test
```

## Configuración inicial (una sola vez)

Requiere `az login` (Azure for Students) y `gh auth login`.

```bash
scripts/bootstrap.sh <owner>/<repo> [correo-para-alertas]
```

Crea el grupo de recursos, una identidad administrada con permisos solo sobre ese grupo, las credenciales
federadas OIDC para los environments `dev` y `prod`, y los secretos y variables de GitHub. **No se guarda
ninguna contraseña en el repositorio ni en GitHub.**

## Cómo trabajamos

- Nadie sube directo a `main`: rama → pull request → CI en verde → merge.
- Los documentos también viven aquí (`docs/`), en Markdown y draw.io.
- Nunca subir credenciales. `.env` y `local.settings.json` están en `.gitignore`.

## Limpieza

Después de la sustentación: `az group delete -n rg-pandelacasa`.
