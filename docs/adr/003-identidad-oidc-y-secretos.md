# ADR-003: OIDC para el pipeline y manejo de secretos

- **Estado:** aceptado
- **Fecha:** 2026-11-18

## Contexto

El pipeline de GitHub Actions crea la infraestructura con Bicep y despliega la app en Azure, así que necesita
credenciales de Azure. La API, a su vez, necesita acceso a Cosmos DB.

Requisitos: **secretos fuera del código** y **mínimo privilegio**. El repositorio y los logs de Actions son
**públicos**, así que cualquier secreto que se filtre en un archivo, un commit o una salida del pipeline queda expuesto
para siempre.

## Alternativas

1. **Service principal con secreto de cliente guardado en los secretos de GitHub.**
   Ventajas: es el método clásico y funciona en cualquier sistema de CI. Desventajas: el secreto vive en GitHub, vence
   y hay que rotarlo; si se filtra, sirve desde cualquier lugar hasta que alguien lo revoque.
2. **Token de despliegue de Static Web Apps guardado como secreto de GitHub** (lo que genera la plantilla por defecto).
   Ventajas: cero configuración. Desventajas: es un secreto de larga duración; solo sirve para subir la app, así que
   igual se necesita otra credencial para Bicep.
3. **OIDC (credenciales federadas) con una identidad administrada de Azure.**
   Ventajas: **no hay ningún secreto guardado**. En cada ejecución, GitHub emite un token de corta duración que Azure
   acepta solo si viene de este repositorio y de un environment concreto. Desventajas: la configuración inicial es más
   larga (identidad, credenciales federadas, asignación de rol).

## Decisión

**Opción 3: OIDC con la identidad administrada `id-pandelacasa-github`**, creada por `scripts/bootstrap.sh`:

- **Credenciales federadas solo para los environments `dev` y `prod`** del repositorio. Hay 4: dos con el formato de
  nombres (`repo:<owner>/<repo>:environment:<env>`) y dos con el formato de IDs inmutables, que es el que GitHub emite
  hoy en el *subject* del token.
- **Rol Contributor solo sobre el grupo `rg-pandelacasa`**, no sobre la suscripción.
- **El token de Static Web Apps no se guarda:** el pipeline lo pide en cada ejecución con la identidad OIDC y lo
  enmascara en los logs. Lo mismo con la clave de Cosmos DB que usa la sincronización del catálogo.
- **La clave de Cosmos DB de la API** la escribe Bicep directamente en la configuración de Static Web Apps; nunca pasa
  por el repositorio ni por los logs.
- **El correo de alertas** va como secreto de GitHub (`ALERT_EMAIL`), porque el repositorio es público.

**En producción**, la API corre en una Function App propia (ADR-001) con **identidad administrada** y acceso a Cosmos
DB por **RBAC**, sin clave. Los secretos que queden (por ejemplo, de un proveedor externo) van en **Key Vault**, y la
autenticación por clave de Cosmos DB se desactiva.

## Consecuencias

- **Nada que rotar ni que se pueda filtrar** desde GitHub. Un fork o un PR no obtiene acceso a Azure: Azure solo
  acepta tokens de los environments `dev` y `prod` de este repositorio, y los dos environments solo aceptan
  despliegues desde ramas protegidas, es decir, desde `main` (que exige PR con CI en verde, también para los
  administradores). `prod` además exige aprobación manual.
- **Radio de impacto limitado:** si el pipeline se compromete, solo puede tocar el grupo de recursos del proyecto.
- **En el MVP queda una clave de Cosmos DB** en la configuración de Static Web Apps, porque las managed functions no
  tienen identidad administrada. Por eso Checkov reporta "autenticación local habilitada"; es un riesgo aceptado del
  MVP que desaparece en producción.
- **Contributor es amplio dentro del grupo:** puede crear y borrar cualquier recurso del grupo. Un rol a medida sería
  más estricto, pero no se justifica para un grupo que solo contiene este proyecto.
