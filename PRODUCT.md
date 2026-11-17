# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML, CSS y JavaScript sin framework ni paso de build, servidos por Azure Static Web Apps; API en Azure
Functions (Node 22) sobre Cosmos DB. La Content-Security-Policy solo permite recursos propios (`'self'`): nada de
fuentes, scripts ni estilos de terceros, ni estilos en línea.

## Users

Vecinos del barrio que piden desde el celular el pan del desayuno o de las onces y pasan a recogerlo a una hora
elegida. Los fines de semana el tráfico se triplica. Usuario secundario (fuera del MVP): el administrador de la
panadería, que gestiona productos y pedidos.

## Product Purpose

Pan de la Casa es una panadería de barrio (caso de estudio del curso *Paradigmas de Computación en la Nube*). El
sitio permite consultar el catálogo con fotos y precios y registrar un pedido para recoger en la tienda a una hora
dada. Éxito: el cliente encuentra lo que quiere, arma el pedido y sale con una confirmación clara de qué pidió,
cuánto paga y a qué hora lo recoge, en menos de un minuto.

## Positioning

Pedir antes y recoger sin fila: el pan está listo a la hora elegida. Catálogo mixto de amasijos colombianos
(pandebono, almojábana, buñuelo) y panes de estilo europeo (masa madre, focaccia, baguette, croissant).

## Operating Context

- Pedido con al menos 30 minutos de anticipación; recogida entre las 07:00 y las 19:00, hora de Colombia.
- El pago se hace en la tienda al recoger; el MVP no cobra en línea.
- Precios en pesos colombianos (COP), sin decimales.

## Capabilities and Constraints

- MVP: consultar el catálogo y registrar un pedido. El panel de administrador queda fuera del MVP.
- Los precios y el total los calcula el servidor; el navegador solo muestra.
- Sitio público y anónimo: no hay cuentas de cliente.

## Evidence on Hand

- Fotos de producto con licencia libre (Wikimedia Commons), con créditos en `docs/creditos-fotos.md`.
- Los precios y productos del catálogo son **ilustrativos** (caso de estudio); no hay testimonios, clientes ni
  cifras reales, y no se deben inventar.

## Product Principles

1. El pedido se completa en una sola pantalla del celular, sin registro.
2. El precio y la hora de recogida siempre están a la vista antes de confirmar.
3. Ningún dato del cliente se muestra ni se registra más allá de lo necesario para entregar el pedido.

## Accessibility & Inclusion

Uso principal en celular, a veces con una mano y de afán: objetivos táctiles amplios, contraste AA y formularios
que funcionen con el teclado y lectores de pantalla.
