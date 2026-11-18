# ADR-002: Azure Cosmos DB for NoSQL con free tier para catálogo y pedidos

- **Estado:** aceptado
- **Fecha:** 2026-11-18

## Contexto

El sistema guarda dos tipos de datos:

- **Catálogo:** 9 productos en 3 categorías. Se lee en cada visita y cambia poco (un precio, un producto nuevo).
- **Pedidos:** documentos de ~1 KB con nombre, teléfono, productos, total y hora de recogida. Se escriben uno a uno y
  la panadería los consulta por día de recogida.

Requisitos: costo mínimo en el MVP y menos de USD 150/mes en producción; soportar el 3x de los fines de semana;
respaldo con RPO 24 h y RTO 4 h; dos ambientes (dev y prod) aislados; y una región permitida por la suscripción
(Central US).

## Alternativas

1. **Azure SQL Database (serverless).**
   Ventajas: modelo relacional, consultas SQL completas, el equipo lo conoce. Desventajas: hay que diseñar y migrar un
   esquema para datos que son documentos simples; en modo serverless la base se pausa sin tráfico y la primera
   petición después de la pausa espera a que reanude, justo cuando llega el primer cliente del día.
2. **Azure Table Storage.**
   Ventajas: muy barato y sin capacidad que administrar. Desventajas: solo guarda propiedades planas (los productos de
   un pedido tendrían que serializarse a mano) y las consultas son limitadas. No tiene restauración a un punto en el
   tiempo como Cosmos DB.
3. **Cosmos DB for NoSQL en modo serverless.**
   Ventajas: se paga por operación, sin capacidad fija. Desventajas: **el free tier no aplica a cuentas serverless**,
   así que toda operación se cobra.
4. **Cosmos DB for NoSQL con throughput aprovisionado y free tier.**
   Ventajas: el free tier regala **1000 RU/s y 25 GB** de por vida de la cuenta; los pedidos se guardan como el mismo
   JSON que usa la API, sin esquema que migrar; latencia baja y estable; respaldo continuo con restauración a un punto
   en el tiempo (ADR-004). Desventajas: solo una cuenta con free tier por suscripción, y la capacidad aprovisionada es
   un techo que hay que vigilar.

## Decisión

**Opción 4: Cosmos DB for NoSQL con free tier**, configurado en `infra/main.bicep`:

- **Una cuenta** con free tier y un **tope de throughput de 1000 RU/s** en la cuenta, para que nunca se cobre
  capacidad por encima de lo gratuito.
- **Una base por ambiente**, `panaderia-dev` y `panaderia-prod`, con **400 RU/s compartidas** cada una (800 de las
  1000 gratuitas). Dev nunca escribe en los datos de prod.
- Contenedor **`products`** con clave de partición `/category`: el catálogo se lee completo y se agrupa por categoría.
- Contenedor **`orders`** con clave de partición `/pickupDate` (fecha de recogida en hora de Bogotá): la consulta
  principal de la panadería es "los pedidos de hoy", que así se resuelve dentro de una sola partición.

## Consecuencias

- **Costo:** USD 0 en el MVP mientras se respeten los 1000 RU/s y los 25 GB. Con pedidos de ~1 KB, los 25 GB alcanzan
  para millones de pedidos.
- **Capacidad ante el 3x:** las 400 RU/s de prod son un techo fijo. La API guarda el catálogo en caché 30 s, así que
  las visitas del pico casi no leen la base; el consumo real lo concentran las escrituras de pedidos. Si el techo se
  alcanzara, Cosmos DB responde 429 y la API responde 503 con un mensaje para reintentar; cualquier respuesta 5xx
  dispara la alerta. Si hiciera falta, prod puede subir a 600 RU/s (parámetro `databaseThroughput`) y seguir dentro
  de los 1000 gratuitos (400 de dev + 600 de prod).
- **Una sola cuenta para dos ambientes:** los cambios de configuración de la cuenta (como el respaldo) afectan a dev y
  prod a la vez y se aplican con el despliegue a dev.
- **Autenticación por clave en el MVP:** las managed functions no tienen identidad administrada, así que la API usa la
  clave de la cuenta, inyectada por Bicep en la configuración de Static Web Apps (nunca en el repositorio). En
  producción se reemplaza por identidad administrada (ADR-003).
- **Dependencia del proveedor:** el SDK y el modelo de RU son propios de Azure. El riesgo es bajo porque los datos son
  JSON plano y la API accede a ellos a través de una interfaz pequeña (`listProducts` y `saveOrder`), fácil de
  reimplementar sobre otra base.
