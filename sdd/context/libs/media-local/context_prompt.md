# Context Prompt — libs/media-local

> Entry point para agentes que trabajen sobre `libs/media-local`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 (spec-e-burgos-001) | Fecha: 2026-09-07

- **Tipo:** lib Node TypeScript (wrappers de binarios locales)
- **Estado:** completa para su alcance, sin ciclo abierto. `cycle-02` de
  `spec-e-burgos-001-core-composition-media-pipeline` cerrado.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/spec-e-burgos-001-core-composition-media-pipeline.spec.md` (sección "Wrappers locales (libs/media-local)")
- **Depende de:** `@video-maker/timeline-core` (ver `sdd/context/libs/timeline-core/` + `updates/`)
- **Cómo correr y testear:** `pnpm nx test media-local`, `pnpm nx lint media-local`, `pnpm nx build media-local`
- **Consumidores previstos:** `libs/auto-montage`, `apps/render-api`, `tools/render-cli`
- **Vuelve a tocarse en:** `spec-004` (audio-mix-mastering) — reusa `normalizeVoice`/
  `DEFAULT_VOICE_TARGET` y agrega el mux final multi-pista, que este ciclo no cubre.

## Qué sigue

- Regrabar las fixtures de `ffmpeg/` y `whisper/` en una máquina con los binarios instalados
  (`ffmpeg`, `ffprobe`, `whisper-cli`), manteniendo los mismos valores numéricos que arrastran los
  `toEqual` exactos de CA-018/CA-019/CA-020. El README (sección "Fixtures: procedencia y cómo
  regrabarlas") trae el comando exacto de cada una. Dos diferencias conocidas a verificar al
  regrabar: `loudnorm.stderr.txt` incluye el resumen legible que `print_format=json` no emite, y
  `ffprobe/image.json` declara `format_name: "jpeg_pipe"` cuando una corrida real sobre un `.jpg`
  suele reportar `image2` (el parser acepta ambos).
- `ExecaCommandRunner.run()` sigue siendo la única ruta de código sin test por diseño.
