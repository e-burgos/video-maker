# spec-e-burgos-017-desktop-app cycle-04 — 2026-09-24

## Estado
Cada turno del productor se rutea al motor efectivo (Claude CLI u OpenRouter). La key de OpenRouter vive en
el llavero de macOS (servicio "Video Maker", cuenta "openrouter") y nunca vuelve en un payload. Catálogo en
vivo de OpenRouter con los modelos que soportan herramientas; recomendados: DeepSeek v4.1 Flash (predeterminado)
y Claude Haiku 4.5, con métricas del benchmark.

## Estructura
- `secrets/keychain-secret-store.ts`: `security add-generic-password -w` leyendo la clave de stdin (nunca en
  argv) y verificando después de escribir, porque ante un stdin mal formado `security` guarda vacío con exit 0.
- `http/handlers/producer-settings-handler.ts` (EP-037..040) y `openrouter-models-handler.ts` (EP-041);
  `producer/openrouter-model-catalog.ts` (caché 1 h, sirve stale); `config/recommended-openrouter-models.ts`
  (datos validados, exactamente un `isDefault`).
- `producer/openrouter-producer-agent.ts` emite el mismo protocolo stream-json que el CLI, así que la
  persistencia y los resúmenes no cambian; `producer/producer-history.ts` reconstruye el historial.
- Migración 2 de `local-store`: `producer_messages.usage` con tokens y costo por mensaje.
- El modo storyboard sigue necesitando Claude (usa su propio agente); las recetas no.

## Dependencias
`@video-maker/producer-tools` runtime OpenRouter.

## Qué sigue
Nada pendiente del motor; el benchmark de gratuitos queda para después.
