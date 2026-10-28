# FIX-e-burgos-036 — Storyboard fallido por respuesta del CLI sin structured_output, tildes perdidas en el productor, y skills de producción (grabado y motion)

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-036 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-27 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- El job `motion` fallaba siempre en la fase `storyboard` con `AI_AGENT_INVALID_OUTPUT` (6 veces seguidas, con Sonnet y con Opus). Reproducido fuera del studio: el CLI de Claude descarta en silencio el `--json-schema` completo (89 KB) si alguna de sus 17 variantes de escena usa `prefixItems`, `format` o `default` (feature, product, step, ui-walkthrough). Sin esquema el modelo contesta con claves inventadas, en un bloque ```json dentro de `result`, y el agente lo descartaba.
- El prompt del productor decía que "cualquier texto que escribas queda en inglés/ASCII": el productor le sacaba tildes y eñes a la propuesta, el guion y los subtítulos ("manana", "locution", "titulos").
- El modo de tutorial grabado de Display Ads (UI real con Playwright) y el flujo de brief de motion no estaban en este repo, así que el productor y las sesiones de Claude Code no los conocían.

## Solución
- `to-agent-json-schema`: sanea el esquema que va al agente (quita `format`/`default`, convierte `prefixItems` en `items`); la validación con zod no cambia. Con eso el CLI vuelve a devolver `structured_output`.
- `claude-cli-ai-agent`: si `structured_output` no es un objeto, se intenta leer el JSON de `result` (con o sin cerco ```json). La validación contra el esquema sigue en `generateMotionStoryboard`; si tampoco hay JSON, se mantiene `AI_AGENT_INVALID_OUTPUT`.
- Prompt del productor: sólo los argumentos técnicos (nombres de archivo, ids, claves) van en inglés/ASCII; todo texto para el usuario o para el video conserva el idioma con sus tildes y eñes.
- Fotos de stock importadas: el nombre de archivo se guarda en ASCII (sin tildes, espacios ni paréntesis), como pide el contrato de material.
- Skills nuevos: `screen-recording-tutorial` (modo A, librería Playwright sin login ni credenciales, plantilla y flujo del studio) y `motion-video-brief` (modo B y decisión A/B); `@playwright/test` como devDependency.

## Verificación
- Tests del agente CLI y del prompt del productor.
- Ensayo de grabación del studio: A-roll 1920×1080, 30 fps, yuv420p, sin audio, 11 frases con marca.

## Pendiente (mejora, no incluida)
- El título de un video se deriva del slug (`humanizeSlug`) y pierde las tildes («Cafe aroma»): guardar un nombre para mostrar requiere una columna nueva y cambios en API y web.
