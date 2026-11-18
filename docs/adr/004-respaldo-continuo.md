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

- **RPO:** segundos (se puede elegir el instante exacto antes del error), muy por debajo de las 24 h exigidas.
- **RTO:** restaurar una cuenta con el volumen de este proyecto (KB o pocos MB) toma minutos. Con el reapuntado de la
  aplicación, el total queda dentro de las 4 h. El procedimiento está en el HLD §5.

## Consecuencias

- **Costo:** USD 0 al mes por el respaldo. Una restauración de los datos actuales (menos de 1 MB) cuesta menos de un
  centavo.
- **No hay vuelta atrás** al modo periódico. Lo aceptamos porque el modo continuo es superior en todo lo que nos
  importa.
- **Una restauración completa crea una cuenta nueva.** La suscripción solo admite una cuenta con free tier, así que
  mientras coexistan las dos, la nueva cobra su throughput a precio normal. Después de restaurar hay que reapuntar las
  apps (`COSMOS_ENDPOINT` y la clave) o copiar los datos de vuelta, y luego borrar la cuenta sobrante.
- **Las bases o contenedores borrados por error se restauran en la misma cuenta**, sin crear otra ni cambiar la
  configuración de las apps.
- El respaldo vive en la misma región (Central US). Una caída regional completa no está cubierta: es un riesgo
  aceptado para una PyME con un solo local, documentado en el HLD §7.
