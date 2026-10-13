# Verificación — spec-e-burgos-022 cycle-03 (2026-10-13)

## Automática
- lint/test/build verde: producer-tools (445), render-api (2220), desktop (121).

## Turno real del productor (proyecto de prueba `zz-prueba-publicar`, copia del v2, ya borrado)
- Turno 1 «Preparame la publicación… todavía no lo encoles»: llamó `list_publications` y `draft_publication`, mostró título/descripción/etiquetas, avisó que la cola está pausada y NO encoló.
- Fallas halladas y corregidas en el ciclo:
  - `list_publications` devolvía la cola de todos los proyectos sin el slug: el productor dijo que este video ya estaba en la cola (era el ítem del v2). Ahora el cliente filtra los ítems por el proyecto.
  - El borrador escribía «Isi Pro»: el guion de voz deletrea los nombres como suenan. Ahora el borrador recibe los textos en pantalla (títulos, globos, ítems) y la regla de escribir los nombres como aparecen en pantalla.
- Turno 2 con confirmación explícita: rearmó el borrador (Easy Pro y Counter 15 bien escritos), volvió a consultar la cola, llamó `queue_publication` (público, `userConfirmation` con la cita) y avisó que la cola está pausada. El ítem quedó `queued`; se quitó después de la prueba.
- No se llamó nunca a un job `publish`; la cola siguió pausada con sus 9 videos.

## App de escritorio
- `externalUrlToOpen` (tests): la URL de consentimiento de Google y cualquier http/https de otro origen se abren con `shell.openExternal`; mismo origen y esquemas `file:`/`javascript:`/`data:` se bloquean. `setWindowOpenHandler` siempre niega ventanas hijas; `will-navigate` a otro origen se cancela y se abre afuera. No se probó el clic real en la app empaquetada.
