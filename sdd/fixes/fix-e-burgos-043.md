# FIX-e-burgos-043 — Carpetas y categorías plegables en el studio

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-043 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-10 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Con muchas carpetas y categorías, la lista de proyectos del studio se volvía larga y costaba encontrar un video.

## Solución
- Cada encabezado de carpeta y de categoría suma un botón (`CollapseToggle`) para contraerla o expandirla, con textos «Contraer/Expandir {nombre}» en español e inglés.
- `useCollapsedSections` guarda en `localStorage` qué secciones están contraídas, con claves por carpeta y por categoría. Si el almacenamiento no está disponible, todo arranca expandido.

## Verificación
- `nx test` y `lint` de web en verde.
