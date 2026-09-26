# spec-e-burgos-018-producer-free-tier cycle-04 — 2026-09-26

## Estado
18 tools. Salido de 13 producciones reales desde la app: `patch_timeline`, guarda en `put_timeline`, `wait_for_job`
que deja pasar el error real del job y prompt corregido.

## Estructura
- `patch_timeline`: reemplaza solo `logo`, `bumpers`, `audioMix`, `captionStyle`, `safeZone` y `tracks.music`
  (get → merge → `TimelineSchema` → put); los subtítulos nunca viajan. Motivo: con `put_timeline` (reemplazo total)
  el modelo re-escribía 12 KB de JSON y perdía todas las tildes.
- `put_timeline`: acepta el timeline como string JSON y rechaza (`INVALID_INPUT`) un cambio en el texto de los
  subtítulos salvo `editCaptions: true`. La guarda vive en la tool, no en `PUT /timeline` (lo usa el editor de la web).
- `wait_for_job.error` = `RenderApiJobErrorSchema` (`z.looseObject`: `code`, `stage`, `message`, opcionales
  `resource`/`expected`/`hint`); antes reusaba el schema de errores propios de la tool y todo error sin `hint` salía
  como `STUDIO_UNAVAILABLE`.
- Prompt: pestañas por su nombre en el idioma del usuario (Vista previa / Entregas / Material); la despedida de la
  receta solo si entra antes del final del A-roll (~2,5 palabras/s + gap); una falla determinista nunca es "transitoria".
- `e2e/openrouter-model-bench.mjs`: cuota diaria solo por error explícito; `--backoff-ms`, `--rate-limit-retries`.

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente de esta spec.
