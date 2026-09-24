# spec-e-burgos-017-desktop-app cycle-03 — 2026-09-24

## Estado
piper se reemplazó por sherpa-onnx 1.13.8 (`src/tts/`); la resolución de binarios suma una carpeta
empaquetada y una carpeta de modelos de la app.

## Estructura
- `synthesizeSpeech` mantiene su contrato pero pasa `--vits-model/--vits-tokens/--vits-data-dir/
  --vits-length-scale/--output-filename` y el texto como argumento (lo lee de `textPath`).
- `VoiceModel.directory` (`vits-piper-<id>/`), `DEFAULT_VOICE_ID = 'es_AR-daniela-high'`; los ids no cambiaron.
- Precedencia: variable específica > `VIDEO_MAKER_BIN_DIR/<comando>` > `PATH`; modelos:
  `VIDEO_MAKER_MODELS_DIR/whisper-model.bin` y `.../voices/`.
- `ExecaCommandRunner` acepta `env` y lo usa con `extendEnv: false`.

## Dependencias
Sin dependencias npm nuevas. `pnpm fetch:dev-voices` baja sherpa-onnx y las voces para desarrollo.

## Qué sigue
Las descripciones de voz siguen sin i18n.
