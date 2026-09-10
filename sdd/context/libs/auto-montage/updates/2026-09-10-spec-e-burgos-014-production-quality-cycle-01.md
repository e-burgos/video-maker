# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Estado
Tres cambios de calidad de producción sobre el pipeline: el ingest **mide** la música, hay un
sexto rol `logo`, y las captions se pueden alinear al guion del productor.

## Estructura
- **Ingest.** `probeAssets` corre `measureLoudness` para los assets de rol `audio` y guarda
  `asset.audio.integratedLufs`. Una medición fallida no pierde el asset ni cuenta como
  `probeFailure`. `planIngestWork` **no reusa** una entrada de catálogo de rol `audio` sin esa
  medición (`isMissingLoudnessMeasurement`), así que los proyectos ya ingestados se actualizan
  solos sin borrar `work/catalog.json`. `ingestProject` pasa `ffmpegPath` además de `ffprobePath`.
- **Rol `logo`.** `raw/logo/` con png/jpg/webp (`.mp4` → `extension-role-mismatch`, `.svg` →
  `unsupported-extension`). `AssetRoleSchema` y `AssetRole` se ensancharon: es un tipo suma, y el
  ripple llegó hasta `apps/render-api` (`AssetListEntry.role`, `ToCatalogAssetInput.role`).
  `resolveMontageInputs` resuelve el logo (`logo-asset-not-found` si se pide uno que no existe) y
  `autoMontage` lo pasa a `buildTimeline` con `logo: 'auto' | 'off'`.
- **Niveles de música por preset.** `hardware` -4/-12 (publicidad), `software-demo`/`educational`/
  `recipe` -8/-18 (tutorial), los cuatro con `referenceLufs: -16`. `preset.audio` viaja ahora como
  `MusicInput.mix`.
- **`src/transcript/`** (nuevo): `tokenizeScript` y `alignTranscriptToScript(words, scriptText)`.
  LCS sobre tokens normalizados con `normalizeTerm`. Un bloque de diferencia es un run de *n*
  palabras de Whisper contra *k* del guion: con `n ≥ 1` el span se reparte en *k* tramos iguales;
  con `n = 0` las *k* entran en el hueco vecino sólo si mide ≥ *k* ms y si no se descartan; con
  `k = 0` se eliminan. `autoMontage` lo aplica **antes** de podar silencios, así que captions,
  conceptos y ducking ven el mismo texto, y vacía `transcription.segments` porque sus `wordRange`
  dejan de ser válidos.

## Dependencias
Ninguna nueva. `AutoMontageResult` gana `logoAssetId` y `scriptAlignment`.

## Qué sigue
`ASSET_ROLE_ORDER` del reporte de `render-cli` sigue sin `voice` ni `logo` (el logo se nombra en
su propia línea). La subida de un logo por HTTP quedó fuera: entra por disco.
