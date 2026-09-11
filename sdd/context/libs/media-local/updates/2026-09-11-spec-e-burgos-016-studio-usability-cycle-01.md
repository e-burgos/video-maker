# spec-e-burgos-016-studio-usability cycle-01 — 2026-09-11

## Estado
`buildVoiceCatalog` describe cada voz Piper en vez de sólo nombrarla: además de `id`, `fileName` e
`isDefault`, cada `VoiceModel` lleva `language { code, region }` en BCP47, `quality`
(`x_low|low|medium|high` o `null` cuando nadie la declara), `label` legible y `description` factual.

## Estructura
- La firma cambió: recibe `readonly VoiceModelFile[]` (`{ fileName, config }`) en lugar de
  `readonly string[]`, porque los metadatos viven en el `.onnx.json` que acompaña al modelo y el
  único que puede leerlos es el adaptador que ya lee el directorio.
- `describeVoiceModel(fileName, config)` es la derivación pura y se exporta aparte.
  `voiceModelConfigFileName(fileName)` nombra el sidecar (`<modelo>.onnx.json`).
- **La derivación es total: no hay mapa hardcodeado de nombres.** Una voz nueva copiada al directorio
  se describe sola con `dataset`, `language.name_english`, `language.country_english`,
  `audio.quality` y `audio.sample_rate`. Un `config` que no es objeto se trata como ausente.
- **No se publica género, edad ni carácter de la voz**: el `.onnx.json` de Piper no los documenta y
  deducirlos del nombre del dataset sería inventar.

## Dependencias
Ninguna nueva. El único consumidor es `apps/render-api` (`EP-019`).
