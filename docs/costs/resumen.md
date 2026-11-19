# Resumen de costos

> Fuente: Azure Pricing Calculator, consultada el 19/11/2026 · región **Central US** · **USD** · precios de lista
> pay-as-you-go. Detalle por servicio en [costos.xlsx](costos.xlsx); exports oficiales en
> [calculadora-mvp.xlsx](calculadora-mvp.xlsx) y [calculadora-produccion.xlsx](calculadora-produccion.xlsx).
> Supuestos de uso en [../supuestos.md](../supuestos.md).

## Totales

| Escenario | Mensual | Anual |
|---|---|---|
| **MVP** (lo desplegado hoy) | **USD 0,10** | USD 1,20 |
| **Producción** (+50 % de tráfico) | **USD 9,39** | USD 112,71 |

## Margen frente al tope

| | Mensual | Anual |
|---|---|---|
| Tope del enunciado | USD 150,00 | USD 1 800,00 |
| Producción | USD 9,39 | USD 112,71 |
| **Margen** | **USD 140,61** | **USD 1 687,29** |

Producción usa el **6,3 %** del tope. El margen queda para crecer (más tráfico, backup continuo de 30 días o
una segunda región) sin rediseñar.

## Costo de producción por servicio

| Servicio | Mensual | Nota |
|---|---|---|
| Static Web Apps Standard (prod) | USD 9,00 | Lo único que cuesta: se paga por el SLA que exige el 99,5 %. Dev sigue en Free. |
| Function App (Flex Consumption) | USD 0,00 | ≈ 12 400 ejecuciones/mes, dentro del free grant. |
| Cosmos DB (free tier) | USD 0,00 | 800 RU/s y 1 GB dentro de 1000 RU/s y 25 GB gratis; backup continuo 7 días. |
| Azure Monitor | USD 0,20 | 2 reglas de alerta; la ingesta (≈ 3 GB/mes) cabe en los 5 GB gratis. |
| Blob Storage (fotos) | USD 0,16 | 1 GB Hot LRS y ≈ 100 000 lecturas/mes. |
| Key Vault | USD 0,03 | ≈ 10 000 operaciones/mes. |

## Las 2 optimizaciones FinOps

| Optimización | Sin optimizar | Optimizado | Ahorro mensual | Ahorro anual |
|---|---|---|---|---|
| **1. Serverless** (Static Web Apps + Functions) en vez de App Service S1 Linux encendido 24/7 | USD 69,35 | USD 9,00 | **USD 60,35** | **USD 724,20** |
| **2. Free tier de Cosmos DB** en vez de pagar 800 RU/s + 1 GB | USD 46,97 | USD 0,00 | **USD 46,97** | **USD 563,64** |
| **Total** | USD 116,32 | USD 9,00 | **USD 107,32** | **USD 1 287,84** |

Sin estas dos decisiones, producción costaría cerca de **USD 116/mes**. Seguiría por debajo del tope, pero
con un margen mucho menor, y App Service necesitaría una segunda instancia para el 3x del fin de semana.

## Para la sustentación (idea en una frase)

"Pagamos por uso y aprovechamos los free tiers: producción cuesta USD 9,39 al mes, el 6 % del tope, y lo único
que pagamos de verdad es el SLA de Static Web Apps que necesitamos para el 99,5 %."
