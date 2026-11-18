# ADR-001: Azure Static Web Apps con Azure Functions para el sitio y la API

- **Estado:** aceptado
- **Fecha:** 2026-11-18

## Contexto

Pan de la Casa necesita un sitio público con el catálogo (fotos y precios) y una API para registrar pedidos con hora de
recogida. La carga es pequeña y desigual: entre semana hay poco tráfico, los fines de semana se triplica (3x) y de
noche casi no hay visitas.

Requisitos que pesan en la decisión:

- **Costo:** máximo USD 150/mes en producción, y el MVP debe costar lo mínimo posible.
- **Escalar ante el 3x** de los fines de semana sin intervención manual.
- **HTTPS** obligatorio.
- **99,5 % de disponibilidad** en horario comercial.
- **Región:** la suscripción Azure for Students solo permite centralus, brazilsouth, canadacentral, westus y westus3.
- **Equipo:** dos estudiantes, sin tiempo para administrar servidores.

## Alternativas

1. **Azure App Service (plan Linux) con la app web y la API en el mismo servidor.**
   Ventajas: modelo conocido, una sola aplicación, sin límites de tipo de trigger. Desventajas: se paga el plan las
   24 horas aunque no haya visitas; el autoescalado solo existe desde el plan Standard, así que cubrir el 3x sin
   intervención exige un plan de pago desde el primer día. HTTPS y dominio se configuran aparte.
2. **Azure Container Apps con un contenedor que sirve el sitio y la API.**
   Ventajas: escala a cero y escala por demanda. Desventajas: hay que escribir y mantener un Dockerfile, un registro
   de imágenes y la configuración de ingreso, solo para servir un catálogo y un formulario. El frontend estático
   pasaría por el mismo contenedor que la API.
3. **Azure Static Web Apps (frontend) con Azure Functions (API).**
   Ventajas: el frontend se sirve desde la red global de Static Web Apps con HTTPS incluido; la API corre en
   Functions, que escala sola y no cobra cuando no hay tráfico; el despliegue desde GitHub Actions viene integrado.
   Desventajas: en el plan Free las funciones son "administradas": solo admiten triggers HTTP, no tienen identidad
   administrada y el plan no tiene SLA.

## Decisión

**Opción 3: Static Web Apps + Azure Functions**, en dos niveles:

- **MVP (lo desplegado):** Static Web Apps **Free** con **managed functions** (Node.js 22, Functions v4), un recurso
  por ambiente (`swa-pandelacasa-dev` y `swa-pandelacasa-prod`) en **Central US**, la única región permitida por la
  suscripción donde existe Static Web Apps.
- **Producción (lo que se costea):** Static Web Apps **Standard** con una **Function App propia** enlazada
  (*bring your own functions*). El plan Standard es el que tiene SLA y el único que permite enlazar una Function App
  propia, y esa Function App sí admite identidad administrada (ver ADR-003).

Es la opción que cubre el 3x sin configurar nada, cuesta casi cero cuando no hay tráfico y no deja servidores que
administrar.

## Consecuencias

- **Costo:** el MVP no paga hosting (plan Free). En producción se paga el plan Standard más el consumo de la Function
  App; el detalle está en `docs/costs/`.
- **Escalado:** el frontend estático no consume cómputo; la API escala con Functions. La caché de 30 s del catálogo en
  la API evita que cada visita del pico lea la base de datos.
- **Disponibilidad:** el plan Free no tiene SLA, así que el MVP no puede prometer el 99,5 %. Por eso producción usa
  Standard. El cálculo de disponibilidad está en el HLD.
- **Arranque en frío:** la primera petición después de un rato sin tráfico tarda más en responder. Para una panadería
  es aceptable, y el smoke test lo tolera con reintentos.
- **Solo HTTP en el MVP:** tareas programadas (por ejemplo, un resumen diario de pedidos) necesitan la Function App
  propia de producción.
- **Dependencia de la región:** si Static Web Apps dejara de estar disponible en Central US para la suscripción, habría
  que cambiar de suscripción, no solo de región.
