# spec-e-burgos-009-voice-over cycle-01 — 2026-09-09

## Estado

Quinto y sexto binario resueltos por la lib: `piperCli` (`PIPER_PATH`, con fallback por `PATH` al
comando `piper`) y `piperModel` (`PIPER_MODEL_PATH`, archivo `.onnx` legible y **sin** fallback por
`PATH`, exactamente el contrato de `whisperModel`). `resolveBinaries` sigue devolviendo los cuatro
de montaje; `resolveVoiceBinaries` devuelve esos cuatro más los dos de Piper.

Wrapper nuevo `synthesizeSpeech(outPath, { modelPath, textPath, piperPath, runOptions }, runner)`
sobre el `CommandRunner` inyectable, y `buildVoiceCatalog(fileNames, configuredModelPath)` puro, que
deriva la lista de voces de los `.onnx` de un directorio (descarta los `.onnx.json` de configuración,
ordena por id y marca el configurado como default).

## Estructura

- `src/binaries/resolve-binaries.ts`: `BinaryName` pasa de cuatro a seis miembros. La distinción
  "binario vs modelo" dejó de ser un `if` sobre `whisperModel` y es ahora la lista
  `MODEL_BINARY_NAMES` con su type guard — agregar otro modelo no vuelve a tocar dos ramas.
- `src/piper/synthesize-speech.ts`: arma `piper -m <onnx> -i <txt> -f <wav>` y lanza
  `CommandFailedError` con exit code y stderr. Exporta `narrationToSingleLine`.
- `src/piper/build-voice-catalog.ts`: `VoiceModel = { id, fileName, isDefault }`.

## Dependencias

Ninguna dependencia npm nueva. El binario `piper` se instala fuera del repo
(`python3 -m pip install --user piper-tts`, 34,1 MB de wheel; en macOS el ejecutable queda en
`~/Library/Python/3.11/bin/piper`) y las voces se bajan de `rhasspy/piper-voices` en Hugging Face.
La suite nunca lo invoca: todo pasa por `FixtureCommandRunner`.

## Qué sigue

- **La narración se le pasa a Piper por archivo, no por stdin.** `CommandOptions` del
  `CommandRunner` no tiene canal de entrada y ensancharlo tocaría los cinco binarios que ya lo usan.
  Piper trata **cada línea** del archivo como una emisión separada, así que el texto se colapsa a una
  sola línea antes de escribirlo (medido: tres oraciones en una línea salen como un único wav).
- Piper entrega **22 050 Hz mono**; quien lo consuma tiene que remuestrear a lo que necesite
  (`AUDIO_MIX_SAMPLE_RATE` para la mezcla, 16 000 para whisper). `extractAudioForTranscription` sirve
  para las dos conversiones.
- `synthesizeSpeech` no expone `--length-scale`, `--noise-scale` ni `--speaker`: si hace falta
  control de velocidad o voces multi-speaker, son opciones nuevas del mismo wrapper.
