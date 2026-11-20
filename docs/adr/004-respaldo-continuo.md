# ADR-004: Respaldo continuo de 7 días en Cosmos DB

- **Estado:** aceptado
- **Fecha:** 2026-11-17

## Contexto

El enunciado exige **RPO 24 h** (perder como máximo un día de pedidos) y **RTO 4 h** (volver a operar en menos de
4 horas). Los datos que importan están en Cosmos DB: el catálogo se puede recrear desde `data/catalog.json`, pero los
pedidos solo existen en la base.

La cuenta se creó con el respaldo **periódico**: una copia cada 4 h y 8 h de retención (las dos copias gratuitas). Eso
cumple el RPO, pero tiene dos problemas:

- **Restaurar requiere abrir un ticket a soporte de Azure.** El tiempo de respuesta no depende de nosotros, así que no
  podemos garantizar el RTO de 4 h. Además, el equipo no quiere depender de soporte para operar.
- **Solo hay 8 h hacia atrás.** Un error que se descubra al día siguiente (por ejemplo, un cambio que borra pedidos un
  viernes en la noche y se nota el sábado) ya no se puede recuperar.

Restricciones: suscripción Azure for Students (sin plan de soporte de pago), presupuesto de USD 150/mes en producción y
el mínimo costo posible en el MVP.

## Alternativas

1. **Mantener el respaldo periódico (cada 4 h, 8 h de retención).**
   Ventajas: ya está configurado y es gratis. Desventajas: restaurar exige un ticket a soporte (RTO fuera de nuestro
   control) y la ventana de 8 h es corta. Subir la retención genera cobro por copia adicional.
2. **Respaldo continuo de 7 días (`Continuous7Days`).**
   Ventajas: restauración **autoservicio** (portal o CLI) a cualquier segundo de los últimos 7 días; el almacenamiento
   del respaldo **no tiene costo** en este nivel; las bases o contenedores borrados se pueden restaurar dentro de la
   misma cuenta. Desventajas: cada restauración cuesta USD 0,15 por GB restaurado; el cambio desde periódico es
   **irreversible**; una restauración completa crea una **cuenta nueva**.
3. **Respaldo continuo de 30 días (`Continuous30Days`).**
   Igual que la opción 2 con más historial, pero cobra el almacenamiento del respaldo por GB al mes. Una semana es
   suficiente para detectar un error en una panadería que opera todos los días.
4. **Exportación propia programada** (un workflow nocturno que lee los contenedores y guarda JSON en Blob Storage).
   Ventajas: sin soporte y con retención a elección. Desventajas: es código y almacenamiento que hay que mantener y
   proteger, el RPO sería de 24 h justas y restaurar implica escribir y probar un script de importación.

## Decisión

**Opción 2: respaldo continuo de 7 días.** Es la única que cumple RPO y RTO sin depender de soporte ni agregar costo
fijo. Se configura en `infra/main.bicep` (`backupPolicy.type: 'Continuous'`, `tier: 'Continuous7Days'`) y se aplica
con el pipeline, como el resto de la infraestructura.

Con esta decisión:

- **RPO:** Cosmos DB copia cada cambio al respaldo de forma asíncrona, en menos de 100 segundos. En el peor caso se
  pierden unos 2 minutos de pedidos, muy por debajo de las 24 h exigidas.
- **RTO:** una restauración completa crea una cuenta nueva; tarda más cuanto más datos haya, pero con los datos actuales
  (menos de 1 MB) casi todo el tiempo es crear la cuenta. **Medido en un simulacro el 19 nov: la cuenta restaurada estuvo lista en 10 min 33 s y
  los pedidos volvieron a la cuenta original en unos 12 minutos** (detalle en `docs/despliegue.md`).

### Procedimiento de restauración

El pipeline siempre apunta a la cuenta original (su nombre es fijo en Bicep) y en cada despliegue recrea
`panaderia-<ambiente>`, `products` y `orders`. Por eso **los datos vuelven a la cuenta original** y no se reapuntan las
apps a mano: el siguiente despliegue desharía ese cambio.

1. **Congelar despliegues:** no hacer merge a `main` hasta terminar. Un despliegue recrearía los contenedores vacíos y
   ocuparía los nombres que se quieren restaurar.
2. **Si se borró una base o un contenedor:** restaurarlo en la misma cuenta, al instante anterior al borrado
   (`az cosmosdb sql database restore` o `az cosmosdb sql container restore`). Las apps no cambian.
3. **Si se borraron o dañaron pedidos** (los contenedores siguen existiendo): restaurar la cuenta a una cuenta temporal,
   al instante anterior al error (`az cosmosdb restore`), copiar los documentos de `orders` de vuelta a la cuenta
   original con `scripts/restore-orders.js` y borrar la cuenta temporal. El catálogo no hace falta: el pipeline lo recarga desde `data/catalog.json`.
4. Verificar con el smoke test y reanudar los despliegues.

## Consecuencias

- **Costo:** USD 0 al mes por el respaldo. Una restauración de los datos actuales (menos de 1 MB) cuesta menos de un
  centavo. La cuenta temporal del paso 3 no tiene free tier (la suscripción solo admite una cuenta con free tier), así
  que cobra su throughput a precio normal mientras exista; por eso se borra apenas termina la copia.
- **No hay vuelta atrás** al modo periódico, y Azure rechaza cualquier despliegue que lo intente. Revertir este cambio
  con `git revert` bloquearía el pipeline: si alguna vez hubiera que deshacer el PR, se conserva el bloque
  `backupPolicy`. Lo aceptamos porque el modo continuo es superior en todo lo que nos importa.
- **El cambio se aplica con el despliegue a dev**, antes de la aprobación de prod, porque dev y prod comparten la
  cuenta de Cosmos DB. La aprobación de prod no lo frena: la decisión se toma al aprobar este PR.
- **La migración corre en segundo plano.** Mientras no termine, Azure puede rechazar otro despliegue sobre la cuenta.
  Hay que aprobar prod solo cuando la migración figure como completada
  (`az cosmosdb show --query backupPolicy.migrationState`).
- El respaldo vive en la misma región (Central US). Una caída regional completa no está cubierta: es un riesgo aceptado
  para una PyME con un solo local, que se registra en la tabla de riesgos del HLD.
