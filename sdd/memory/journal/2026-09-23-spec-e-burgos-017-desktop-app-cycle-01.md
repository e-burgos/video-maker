# spec-e-burgos-017-desktop-app cycle-01 — 2026-09-23

## Qué pasó
Al pasar el productor a herramientas MCP, `extract_frames` devolvía bien sus bloques de imagen (verificado
con el cliente del SDK), pero el modelo contestaba que no podía ver imágenes. En el `stream-json` del CLI
se vio que el `tool_result` que recibe el modelo trae solo el `structuredContent` como texto: cuando una
tool declara `outputSchema`, Claude Code 2.1.123 manda eso y descarta `content`. Quitando el
`outputSchema` de esa tool, el modelo describió el frame. En el mismo ciclo, el SDK publicó
`{"type":"object","properties":{}}` para `start_job` porque su input es una unión discriminada, y el
modelo tuvo que adivinar la forma (5 rechazos en una corrida).

## Lección
Probar cada tool MCP nueva mirando el `tool_result` que ve el MODELO en el `stream-json` del CLI, no la
respuesta del servidor: `outputSchema` tapa los bloques de imagen y un input que no es `z.object` en la
raíz llega vacío.

## Costo evitable
Una corrida de receta con 5 `start_job` rechazados y una sonda de visión fallida; las dos cosas se ven
en segundos listando tools con `InMemoryTransport` y leyendo un turno `stream-json` de un solo mensaje.
