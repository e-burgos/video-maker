# Context Prompt — libs/media-local

> Entry point para agentes que trabajen sobre `libs/media-local`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 (spec-e-burgos-004) | Fecha: 2026-09-08

- **Tipo:** lib Node TypeScript (wrappers de binarios locales + mezcla/mastering de audio)
- **Estado:** completa para su alcance, sin ciclo abierto. `cycle-02` de
  `spec-e-burgos-001-core-composition-media-pipeline` y `cycle-02` de
  `spec-e-burgos-004-audio-mix-mastering` cerrados: la lib cubre wrappers de ffprobe/ffmpeg/whisper,
  la capa pura de mezcla (`src/mix/`) y su ejecución (`mixTimelineAudio`, `verifyMixLoudness`,
  `muxAudioIntoVideo`).
- **Specs que la gobiernan:**
  - `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (sección "Wrappers locales (libs/media-local)")
  - `sdd/specs/spec-e-burgos-004-audio-mix-mastering/spec-e-burgos-004-audio-mix-mastering.spec.md`
    (capa de mezcla/mastering; contrato de API pública en `cycles/cycle-02/architect.md` §15)
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test media-local`, `pnpm nx lint media-local`,
  `pnpm nx build media-local`; smoke manual (fuera de CI, requiere ffmpeg real):
  `pnpm nx smoke-audio media-local`
- **Consumidores previstos:** `libs/auto-montage`, `apps/render-api`, `tools/render-cli`
- **Vuelve a tocarse en:** `spec-e-burgos-005-render-service` (`apps/render-api`) — es quien
  orquesta `renderTimeline(timeline, { audio: 'muted' })` (de `libs/composition-remotion`) →
  `mixTimelineAudio` → `verifyMixLoudness` → `muxAudioIntoVideo` en una sola llamada. Ninguna de
  las dos libs puede hacer esa orquestación: los boundaries Nx (`type:util` solo depende de
  `type:domain`) impiden que `media-local` y `composition-remotion` se importen entre sí, así que
  `apps/render-api` (`type:app`) es el único subproyecto habilitado para depender de ambas.

## Qué sigue

- **Entrada obligatoria de `spec-e-burgos-005`:** implementar en `apps/render-api` la cadena
  `render → mix → mux` (ver "Vuelve a tocarse en" arriba) y, si hiciera falta, un re-master de dos
  pasadas sobre el bus completo — el master bus limiter de esta lib garantiza el true peak pero no
  re-normaliza el integrado de voz+música.
- Regrabar las fixtures de `ffmpeg/` y `whisper/` en una máquina con los binarios instalados
  (`ffmpeg`, `ffprobe`, `whisper-cli`), manteniendo los mismos valores numéricos que arrastran los
  `toEqual` exactos de CA-018/CA-019/CA-020. El README (sección "Fixtures: procedencia y cómo
  regrabarlas") trae el comando exacto de cada una. Dos diferencias conocidas a verificar al
  regrabar: `loudnorm.stderr.txt` incluye el resumen legible que `print_format=json` no emite, y
  `ffprobe/image.json` declara `format_name: "jpeg_pipe"` cuando una corrida real sobre un `.jpg`
  suele reportar `image2` (el parser acepta ambos).
- **Deuda de test en `src/mix/`:** todos los fixtures usan clips con `from: 0` y `trimStartMs: 0`,
  así que `adelay` solo está verificado en el valor degenerado `0`. La implementación
  (`framesToMs(clip.from, fps)`) es correcta por inspección, pero falta un fixture con `from > 0`
  que pruebe numéricamente ese valor y los `st` absolutos de los `afade`.
- **Mantenimiento de paridad:** cualquier cambio en `gainDbToVolume` (`src/mix/gain-db-to-volume.ts`)
  tiene que replicarse en `libs/composition-remotion/src/helpers/audio-gain.ts` (y viceversa) o el
  master deja de sonar como el preview de Remotion — contrato en `cycle-01/architect.md` §7.2.
- `ExecaCommandRunner.run()` sigue siendo la única ruta de código sin test por diseño.
