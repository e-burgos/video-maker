# FIX-e-burgos-093 — Una sola base para la app y el studio web

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-16 |
| **Estado** | implemented |

## Qué cambia
- La app de escritorio usa `<carpeta de proyectos>/.studio/studio.db`, la misma base que `pnpm studio` sobre esa carpeta.
- Al arrancar, si la carpeta no tiene base y existe la anterior en la carpeta de datos de la app, la copia (con su `-wal`).
- No conviene tener la app y `pnpm studio` abiertos a la vez sobre la misma carpeta.
- Verificado con la app instalada: abre media/.studio/studio.db (migrada a v9), muestra las 6 carpetas del studio web y «Ordenar como en YouTube» ordenó 15 categorías.
