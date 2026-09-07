# TASK-005 — notas del implementador

- **No hay `ffmpeg` disponible en el entorno de implementación** (`which ffmpeg` no resuelve). Las
  fixtures `src/__fixtures__/ffmpeg/loudnorm.json` y `loudnorm.stderr.txt` (§6.5 architect.md) se
  reconstruyeron a mano a partir del formato documentado de `loudnorm=print_format=json`: el
  `loudnorm.json` es exactamente el objeto de la tabla de §6.5 (mismos valores, mismo tabulado y
  ` : `); el `.stderr.txt` agrega alrededor las líneas de `Input #0`/`Output #0` y los dos bloques
  `[Parsed_loudnorm_0 @ …]` (resumen legible + el JSON final) que documenta el filtro, sin banner de
  compilación ni líneas `frame=`/`size=` de progreso (coherente con `-hide_banner -nostats`). Si en
  algún momento se graba una corrida real, reemplazar ambos archivos manteniendo los mismos valores
  numéricos — son los que ya arrastran los tests de CA-020 (`toEqual` exacto sobre
  `LoudnessMeasurement` y sobre el filtro de la segunda pasada).
- **`buildLoudnormFilter` vive en `normalize-voice.ts`** (tal como fija §2 del architect.md) y
  `measure-loudness.ts` lo importa desde ahí para armar el filtro de la primera pasada (§4.3). Esto
  crea una dependencia circular a nivel de módulo entre `measure-loudness.ts` y
  `normalize-voice.ts` (`normalize-voice` importa `measureLoudness` para la primera pasada de
  `normalizeVoice`, y `measure-loudness` importa `buildLoudnormFilter`). Ninguno de los dos usa el
  símbolo importado en el top-level del módulo — solo dentro de sus funciones exportadas — así que
  no hay problema de inicialización en ESM/TS, y no hay regla de lint (`import/no-cycle`) activa en
  este subproyecto que lo marque. Se documenta igual porque es el único ciclo de imports de la lib.

- **Ajuste del orquestador:** `buildLoudnormFilter` se movió a `src/ffmpeg/build-loudnorm-filter.ts` (re-exportado desde `normalize-voice.ts`) para eliminar el ciclo de módulos `measure-loudness ↔ normalize-voice`.
