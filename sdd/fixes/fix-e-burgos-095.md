# FIX-e-burgos-095 — Categorías: confirmar antes de borrar y saltar a su sección

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-16 |
| **Estado** | implemented |

## Qué cambia
- La × de una categoría abre un modal que dice cuántos videos quedan en la carpeta sin categoría; antes borraba al instante.
- Tocar el nombre de la categoría hace scroll a su sección y la despliega si estaba plegada.
- Mis videos vuelve a leer videos y organización al volver a la ventana y cada 20 s: la app y el studio web comparten la base (FIX-093) y se ven igual.
- Datos: se recuperaron «Tutoriales - Primeros pasos» y «Tutoriales - Catálogo» (mismos ids, orden y videos) que se habían borrado con la ×.
- Verificado en la app instalada: la × de «Videos comerciales» abre el modal («Tiene 1 video. No se borra…») y Cancelar no toca nada; el nombre hace scroll a su sección.
