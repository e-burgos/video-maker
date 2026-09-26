# spec-e-burgos-018-producer-free-tier cycle-04 — 2026-09-26

## Estado
Sin scroll horizontal en la página del proyecto.

## Estructura
- Grid del workspace `grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` y `min-w-0` en el panel de conversación y en la
  actividad del turno: con `fr` a secas, el mínimo automático dejaba crecer la columna del chat.
- Eventos del turno y bloques de código de los mensajes con `whitespace-pre-wrap break-words [overflow-wrap:anywhere]`
  (antes `truncate` / `overflow-x-auto`).

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente.
