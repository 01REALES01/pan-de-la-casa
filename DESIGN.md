# Design

Sistema visual de Pan de la Casa, documentado a partir de lo construido (`src/web/styles.css`).

## Mundo

La vitrina de la panadería de barrio colombiana: vidrio frío, tinta azul de marcador y precios escritos a mano en
cartulina fluorescente. El gesto propio es **la cartulina**: cada precio va en una etiqueta del color de su
categoría, levemente torcida y pegada con cinta. Lo demás es una tienda en línea estándar.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--glass` | `#eef3f5` | Fondo de la página |
| `--glass-deep` | `#e2eaee` | Fondo de fotos cargando y esqueletos |
| `--paper` | `#ffffff` | Tarjetas, panel del pedido, barra fija |
| `--line` | `#cfd8e1` | Divisores y bordes suaves |
| `--ink` | `#1b2a8f` | Marca, títulos, botones, foco |
| `--ink-deep` | `#121c63` | Nombres de producto, totales, texto sobre cartulina |
| `--text` | `#18203d` | Texto principal |
| `--text-soft` | `#47507a` | Texto secundario |
| `--amarillo` | `#f6ff3b` | Cartulina de amasijos y selección de texto |
| `--verde` | `#86fb6b` | Cartulina de panes y del código de confirmación |
| `--rosado` | `#ff86c4` | Cartulina de dulces |
| `--danger` / `--danger-bg` | `#b3261e` / `#fdecea` | Errores |

Estrategia: neutros fríos más tinta azul, con las cartulinas como único color saturado. El color de cartulina
codifica la categoría (pestaña, título y precio).

## Tipografía

- **Archivo** (variable, alojada en el sitio), ancho 72–85 %, peso 750–850, en mayúsculas para la marca y los
  títulos de sección y del pedido.
- **Kalam** Bold (alojada en el sitio): solo en la cartulina (precios, código) y la frase "Pide antes, recoge sin
  fila".
- **Sans del sistema** para todo lo demás: texto, etiquetas, botones y formularios.
- Cifras con `font-variant-numeric: tabular-nums` en el carrito y los totales.

## Componentes

- **Cartulina** (`.tag`): fondo `var(--tag)`, rotación `var(--tilt)` entre −3° y 2°, sombra con desplazamiento y
  cinta translúcida (`::before`). Variantes: `.tag-price` sobre la foto, `.tag-code` en la confirmación.
- **Botones**: primario relleno de tinta, secundario con borde de tinta; 44 px de alto mínimo y radio de 10 px.
- **Selector de cantidad** (`.stepper`): reemplaza a "Agregar" cuando el producto ya está en el pedido.
- **Campos**: 48 px de alto, borde `#9aa6bd`, borde rojo y mensaje debajo cuando hay error.
- **Pestañas de categoría**: píldoras fijas arriba; la activa se rellena de tinta.
- **Barra fija** (solo en el celular): unidades, total y "Revisar pedido"; se oculta cuando el pedido está en pantalla.

## Distribución

- Celular (< 640 px): productos en fila (foto cuadrada a la izquierda), pedido debajo del catálogo.
- 640–959 px: productos en tarjetas de dos columnas (foto 4:3).
- ≥ 960 px: catálogo a la izquierda y pedido fijo de 360 px a la derecha.

## Movimiento

Uno solo: la cartulina se sacude al agregar el primer producto (420 ms, salida exponencial). Las transiciones de
estado duran 160–220 ms. Con `prefers-reduced-motion` todo queda instantáneo.
