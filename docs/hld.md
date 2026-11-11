# HLD: Pan de la Casa

> Documento de diseño de alto nivel. Se exporta a PDF para la entrega.
> Cada sección indica su responsable. Borra estas notas al terminar.

## 1. Contexto del negocio y alcance
<!-- Responsable: compañero. Quién es la panadería, qué problema resuelve el sistema, qué entra y qué NO entra en el alcance. -->

## 2. Requisitos funcionales, no funcionales y supuestos
<!-- Responsable: yo, a partir de docs/supuestos.md.
     Requisitos no funcionales del enunciado: USD 150/mes máx. en producción · 99,5 % en horario comercial ·
     HTTPS, secretos fuera del código, mínimo privilegio · RPO 24 h / RTO 4 h · 3x carga en temporada alta ·
     logs centralizados, métricas y al menos una alerta. -->

## 3. Arquitectura propuesta y servicios por capa
<!-- Responsable: yo. Diagrama de arquitectura + tabla de servicios por capa. -->

## 4. Seguridad e identidad
<!-- Responsable: yo. HTTPS, OIDC, identidad del pipeline, secretos, mínimo privilegio, autenticación del panel admin. -->

## 5. Disponibilidad, respaldo y recuperación
<!-- Responsable: yo. SLA compuesto vs 99,5 %, backups de Cosmos DB, RPO/RTO, runbook de restauración. -->

## 6. Observabilidad y operación
<!-- Responsable: yo. Application Insights, Log Analytics, alertas, presupuesto. -->

## 7. Riesgos y mitigaciones
<!-- Responsable: compañero. Tabla: riesgo · probabilidad · impacto · mitigación. -->

## 8. Decisiones de arquitectura
Ver [docs/adr/](adr/).
