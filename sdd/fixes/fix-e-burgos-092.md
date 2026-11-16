# FIX-e-burgos-092 — Orden de los videos según las listas de YouTube

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-16 |
| **Estado** | implemented |

## Qué cambia
- `placements` guarda la posición del video dentro de su categoría; Mis videos ordena por esa posición y deja al final los que no tienen.
- Acción «Ordenar como en YouTube»: lee los ítems de la lista asociada a cada categoría y escribe las posiciones.
- Verificado con una API aparte sobre una copia de studio.db: 15 categorías ordenadas desde YouTube; 3 videos de «Conocé Display Ads» no están en su lista y quedan al final.
