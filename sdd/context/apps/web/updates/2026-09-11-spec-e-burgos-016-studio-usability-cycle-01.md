# spec-e-burgos-016-studio-usability cycle-01 — 2026-09-11

## Estado
Las dos pantallas donde el studio hablaba el idioma del motor ahora se explican solas.
`/projects/:slug/voice` ofrece **tarjetas de voz audibles** (`VoicePicker`, COMP-045) en lugar del
`<select>` de ids Piper: etiqueta legible, idioma, calidad, descripción y un botón que reproduce la
demo de `EP-026` en el navegador; la seleccionada queda marcada y es la que usa el job `voice`. El
selector de rol del `AssetUploader` pasa a tarjetas con nombre legible, el directorio `raw/<rol>/`
destino, una línea de **qué le hace ese rol al video final**, la marca de obligatorio en A-roll y la
regla de matching de B-roll escrita en pantalla. Se aplicaron además los textos de arranque del
productor que dejó escritos `FIX-e-burgos-007-002`. Suite: **78 archivos / 742 tests**, 98,71 % stmts ·
95,96 % branch · 98,73 % funcs · 98,96 % lines, piso 80 % y `coverage.include` sin recortar. Cero
dependencias npm nuevas.

## Estructura
- `src/api/asset-roles.ts`: nombre, impacto, orden por importancia y obligatoriedad de los seis roles,
  más `BROLL_MATCHING_HINT`. Es **el único lugar con ese copy** (precedente `montage-presets.ts`), y
  es lo que hace que `cycle-02` traduzca un módulo en vez de seis componentes. `orderedAssetRoles()`
  impone el orden del catálogo, no el que le pase el llamador.
- `src/api/artifact-url.ts` gana `servicePathUrl(path)`: el `previewUrl` que publica el servicio es
  **relativo** y la app lo resuelve same-origin por el proxy `/api`, igual que `artifactUrl`.
- `src/api/render-api-types.ts`: `VoiceModel` gana `language`/`quality`/`label`/`description`/
  `previewUrl`, con `VOICE_QUALITIES` como union cerrado; `parse-voice.ts` rechaza una voz sin esos
  campos y una `quality` fuera del union.
- `voice-picker.tsx` monta **un `<audio preload="none">` por tarjeta**. El estado
  (`idle|loading|playing|error`) vive en cada tarjeta y el id que suena, en el picker: arrancar una
  voz pausa la anterior. El estado también se guarda en un `ref` para que el efecto de "pausá si ya
  no sos la activa" **no llame `pause()` en el montaje** (jsdom no implementa `pause` y ensuciaba la
  salida de toda la suite). Un `play()` rechazado por el navegador deja la tarjeta en `error`, nunca
  trabada en `loading`.
- `AssetUploader` conserva el camino de rol fijo (`roles={['voice']}`/`['logo']}`) con su `<label
  htmlFor>` intacto: es el contrato que asera `logo-overlay-editor.spec`.

## Dependencias
Ninguna npm nueva. Consume de `apps/render-api` `EP-019` (forma nueva) y `EP-026` (nuevo). El
`<audio>` apunta a `/api/voices/<id>/preview`: **el preview no es un artefacto de proyecto** y no
pasa por `EP-011`.

## Qué sigue
- **Los `data-*` nuevos son contrato de Playwright**: `voice-picker`, `voice-card` (con
  `data-voice-id`, `data-selected`, `data-preview-state`), `voice-preview-audio`,
  `asset-role-choices`, `asset-role-choice` (con `data-role`, `data-selected`), `asset-role-required`
  y `asset-role-hint`. `voice-smoke.mjs` ya se migró del `<select>` a estos.
- **La frase del preview es siempre la misma y en español**, así que una voz de otro idioma se
  escucharía con fonética cruzada. Hoy las tres instaladas son `es_*`.
- El picker sigue siendo **del proyecto, no por escena** (laguna abierta desde `spec-009` c02), y no
  ofrece volumen ni velocidad del demo.
- El copy de `asset-roles.ts` y el de `voice-picker.tsx` está en inglés y **sin extraer a un
  catálogo de traducción**: eso es exactamente el trabajo de `cycle-02`.
