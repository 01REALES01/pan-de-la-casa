# Supuestos del negocio

> Responsable: compañero. Estos números alimentan el HLD (§2) y la estimación de costos.
> Cifras razonables inventadas están bien, siempre que estén escritas y justificadas.

## Tabla de supuestos

| Supuesto | Valor | Justificación |
|---|---|---|
| Horario comercial | 07:00–19:00, todos los días (12 h/día, 360 h/mes) | Coincide con el horario de recogida del MVP. Es la ventana donde se mide el 99,5 %. |
| Visitas al sitio por día (entre semana) | 150 | Panadería de barrio con unos 300–400 clientes diarios en tienda; se asume que cerca de la mitad consulta el sitio antes de ir. |
| Visitas al sitio por día (fin de semana, 3x) | 450 | Regla del enunciado: el fin de semana triplica un día entre semana. |
| Pedidos por día (entre semana) | 30 | Conversión del 20 % de las visitas: muchos solo miran precios y van a la tienda. |
| Pedidos por día (fin de semana, 3x) | 90 | Misma conversión sobre 450 visitas. |
| Productos en el catálogo | 9 hoy (3 categorías); hasta 30 en 12 meses | Los 9 de `data/catalog.json` (amasijos, panes, dulces). El catálogo de una panadería de barrio rara vez pasa de 30 referencias. |
| Fotos por producto / tamaño promedio | 1 foto / ≈ 81 KB (50–130 KB, 800 × 600 px) | Las 9 fotos del MVP suman ≈ 0,73 MB. Con 30 productos serían ≈ 2,5 MB. |
| Administradores del panel | 2 | La dueña y el encargado de turno. El panel está fuera del MVP. |
| Tamaño promedio de un pedido (KB) | ≈ 1 KB | Documento JSON del MVP: nombre, teléfono, ítems y totales. |
| Crecimiento esperado en 12 meses | +50 % en visitas y pedidos | Efecto de dar a conocer el sitio en la tienda y en redes; se usa para el escenario de producción. |
| Región de Azure | Central US (impuesta por la suscripción) | Es la única región permitida por Azure for Students donde existe Static Web Apps. |

## Datos derivados (base para los costos)

Mes de referencia: **22 días entre semana + 8 de fin de semana**.

| Dato | Cálculo | Valor mensual |
|---|---|---|
| Visitas | 22 × 150 + 8 × 450 | **6 900** |
| Pedidos | 22 × 30 + 8 × 90 | **1 380** |
| Ejecuciones de la API | 1 `GET /api/products` por visita + 1 `POST /api/orders` por pedido | **≈ 8 300** |
| Transferencia de datos | ≈ 0,9 MB por visita sin caché (peso de `src/web`, con fotos) × 6 900 | **≈ 6,2 GB** |
| Datos nuevos en Cosmos DB | 1 380 pedidos × 1 KB | **≈ 1,4 MB** (≈ 17 MB al año) |
| Pico de carga | Sábado 07:00–09:00 concentra ≈ 30 % del día: 135 visitas en 2 h | **≈ 1 visita/min** |

Con el crecimiento del 50 % (escenario de producción a 12 meses): **≈ 10 350 visitas, 2 070 pedidos,
≈ 12 400 ejecuciones de la API y ≈ 9,3 GB de transferencia al mes**.

Conclusión: incluso con 3x y +50 %, la carga es muy baja. Por eso conviene un modelo de pago por uso con escala a
cero, y los free tiers cubren casi todo el MVP.
