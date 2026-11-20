# Resumen de costos

> Fuente: Azure Pricing Calculator, consultada el 19 y el 20/11/2026 · región **Central US** · **USD** · precios
> de lista pay-as-you-go. Detalle por servicio en [costos.xlsx](costos.xlsx); exports oficiales en
> [calculadora-mvp.xlsx](calculadora-mvp.xlsx) y [calculadora-produccion.xlsx](calculadora-produccion.xlsx);
> enlaces en [enlaces.md](enlaces.md). Supuestos de uso en [../supuestos.md](../supuestos.md).

## Totales

| Escenario | Mensual | Anual |
|---|---|---|
| **MVP** (lo desplegado hoy) | **USD 0,80** | USD 9,60 |
| **Producción** (+50 % de tráfico) | **USD 10,05** | USD 120,60 |

El anual es el mensual **sin redondear** × 12 (producción: 10,0504 × 12 = 120,60).

## Margen frente al tope

| | Mensual | Anual |
|---|---|---|
| Tope del enunciado | USD 150,00 | USD 1 800,00 |
| Producción | USD 10,05 | USD 120,60 |
| **Margen** | **USD 139,95** | **USD 1 679,40** |

Producción usa el **6,7 %** del tope. El margen queda para crecer (más tráfico, backup continuo de 30 días o
una segunda región) sin rediseñar.

## Costo de producción por servicio

| Servicio | Mensual | Nota |
|---|---|---|
| Static Web Apps Standard (prod) | USD 9,00 | Se paga por el SLA que exige el 99,5 %. Dev sigue en Free. |
| Azure Monitor (alertas) | USD 0,80 | 2 reglas (dev y prod) × 4 series (500, 502, 503, 504) = 8 series. La lista oficial regala las primeras 10, así que el costo real probablemente es USD 0; dejamos el valor de la calculadora por conservador. La ingesta (≈ 3 GB/mes) cabe en los 5 GB gratis. |
| Blob Storage | USD 0,22 | Una sola cuenta para las fotos y para el storage que exige la Function App; 1 GB Hot LRS. |
| Key Vault | USD 0,03 | ≈ 10 000 operaciones/mes. |
| Function App (plan Consumption) | USD 0,00 | ≈ 12 400 ejecuciones/mes, dentro de la cuota gratis (1 millón de ejecuciones y 400 000 GB-s). |
| Cosmos DB (free tier) | USD 0,00 | 800 RU/s y 1 GB dentro de 1000 RU/s y 25 GB gratis; el backup continuo de 7 días (ADR-004) es gratis. |

## Las 2 optimizaciones FinOps

| Optimización | Sin optimizar | Optimizado | Ahorro mensual | Ahorro anual |
|---|---|---|---|---|
| **1. Serverless** (Static Web Apps + Functions Consumption) en vez de App Service S1 Linux encendido 24/7 | USD 69,35 | USD 9,00 | **USD 60,35** | **USD 724,20** |
| **2. Free tier de Cosmos DB** en vez de pagar 800 RU/s + 1 GB | USD 46,97 | USD 0,00 | **USD 46,97** | **USD 563,64** |
| **Total** | USD 116,32 | USD 9,00 | **USD 107,32** | **USD 1 287,84** |

**Por qué serverless:** para que App Service escale solo, sin intervención manual, necesita el plan Standard
(S1), y ese plan se paga las 24 horas aunque no haya tráfico. Con ≈ 1 visita por minuto en el pico una
instancia sobra, pero se pagaría todo el mes. Serverless solo cobra lo que se usa.

## Para la sustentación (idea en una frase)

"Pagamos por uso y aprovechamos los free tiers: producción cuesta unos USD 10 al mes, menos del 7 % del tope, y lo
único que pagamos de verdad es el SLA de Static Web Apps que necesitamos para el 99,5 %."
