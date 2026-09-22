# FIX-e-burgos-015-009 — Receta Publicidad: aviso vertical de producto armado desde fotos

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-015-009 · IMPROVEMENT · medium · 2026-09-22 · implemented |
| **Spec** | spec-e-burgos-015-studio-producer |
| **Origen** | El dev: "una receta para publicitar productos, super energético y atractivo, super animado, dirigido a público mobile". |

## Qué impedía copiar la receta Tutorial
1. **El A-roll tiene que ser un video**: una foto en `raw/aroll/` se ignora (`extension-role-mismatch`) y sin A-roll el montaje tira `no-aroll-asset`. No hay ningún camino de imágenes → video: el job `storyboard` produce un documento y nada construye un timeline a partir de él.
2. **El motor no anima dentro de un clip**: el punch-in es un `scale()` fijo (`punch-in-style.ts`), no un zoom animado. Lo único animado por frame son los captions y la placa del logo.
3. **`voice: script` apaga los cortes**: `auto-montage.ts:227` hace `prune: options.pruneSilences ?? voiceSource === 'aroll'`, y `pruneSilences` **no está expuesto** en el job de la API. Con `voice: script` queda un solo keep → sin punch-ins alternados y sin transiciones (`plan-transitions.ts` las inserta entre keeps).

## Solución
La receta construye su propio A-roll y devuelve el habla al A-roll para que el motor corte de verdad. Seis pasos, en orden: guion corto sin marcas y terminado en llamado a la acción → job `voice` (`gapMs: 500`) → una foto por línea animada con `zoompan` de ffmpeg, con la duración que el `script-manifest.json` da por línea → concat → **mux de la locución dentro del video** → `montage` con `format: shorts-9x16`, `preset: recipe`, `voice: aroll`, `captionStyle: bold-impact` y el `scriptPath` → `PUT` del timeline (música a -4/-12 dB, logo `top-left` opaco, **solo** placa de cierre de 1500 ms) → `render`.

## Verificación del comando ffmpeg (hecha a mano, no asumida)
El primer intento, `-loop 1 -t 3 … d=90`, produjo **6750 frames (225 s)** en vez de 90: `zoompan` expande *cada frame de entrada* a `d` frames. El idioma correcto es `-loop 1` sin `-t` más `-frames:v <frames>`, con el mismo número en `d=`: verificado sobre `media/demo-espacio/raw/images/espacio.jpg` → 1080x1920, 90 frames, `duration=3.000000`, y el md5 del frame 0 distinto del frame 89 (la imagen efectivamente se mueve). El `concat` y el mux también se probaron punta a punta: h264 1080x1920 + aac. La trampa quedó escrita en el prompt.

## Verificación
`pnpm nx run-many -t lint test build -p web render-api` en verde (2026-09-22): web 1012 tests, render-api 1007.
