# Diagramas

Cada diagrama se entrega como fuente editable (`.drawio`) y como imagen (`.png`), con íconos oficiales de Azure (la
biblioteca *Azure* de draw.io).

| Diagrama | Fuente | Imagen |
|---|---|---|
| Contexto (C4 nivel 1) | `c4-contexto.drawio` | `c4-contexto.png` |
| Arquitectura cloud: producción (objetivo) y MVP (desplegado), dos páginas | `arquitectura.drawio` | `arquitectura.png`, `arquitectura-mvp.png` |
| Red y seguridad: zonas, flujos e identidades | `red-seguridad.drawio` | `red-seguridad.png` |
| Pipeline de despliegue | `pipeline.drawio` | `pipeline.png` |

Para regenerar una imagen después de editar la fuente (draw.io de escritorio):

```bash
drawio -x -f png -s 2 -b 20 -o pipeline.png pipeline.drawio
drawio -x -f png -s 2 -b 20 -p 2 -o arquitectura-mvp.png arquitectura.drawio   # página 2
```
