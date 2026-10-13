# Context Prompt — tools/render-cli

> Entry point para agentes que trabajen sobre `tools/render-cli`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

- **Tipo:** tool Node ejecutable (CLI headless)
- **Estado:** existe y está completo, y creció en cada spec/fix posterior sin romper el contrato
  original. Primer proyecto bajo `tools/` del repo. Base de `spec-002` (52 archivos, 151 tests en
  17 archivos, cobertura 98.26 % stmts / 92.37 % branches / 100 % funcs / 98.24 % lines, umbral
  85 %) más lo agregado por `FIX-002-002` (etapas correctas en errores de uso, salida en inglés),
  `spec-014` cycle-01 (`--script`, `--no-logo`), `spec-015` cycle-01 (el render entrega la mezcla
  masterizada, no el audio muteado de Remotion), `FIX-007-001` (`--format`) y `FIX-007-002`
  (`--voice`, `--prune-silences`). Los cuatro comandos (`ingest`, `plan`, `render`, `run`) están
  implementados y verificados: CA-013 a CA-016 en PASS (CA-015/CA-016 con dos renders reales,
  evidencia en
  `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/artifacts/smoke-ca015-ca016.md`).
  Con esto `spec-e-burgos-002-auto-montage-pipeline` quedó `completed` (3 ciclos); los cambios
  posteriores llegaron por `spec-005`, `spec-007`, `spec-014`, `spec-015` y sus fixes.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
  (RF-10 a RF-12, CA-013 a CA-016) — spec cerrada; las specs posteriores extendieron la superficie
  sin reabrirla (ver `constitution.md` §4 para el detalle de cada extensión).
- **Depende de:** `@video-maker/auto-montage`, `@video-maker/media-local` (import **estático**,
  no puede volverse perezoso — ver `constitution.md` §2), `@video-maker/timeline-core` (incluye
  `OUTPUT_PRESETS`, la lista de formatos de salida) y `@video-maker/composition-remotion/render`
  (subpath `/render` exclusivamente, único import perezoso de la CLI). Ningún paquete npm nuevo.
- **Comandos:** `ingest` · `plan` · `render` · `run` (los tres encadenados) — los cuatro
  implementados. `plan`/`run` aceptan además `--script`, `--no-logo`, `--format`, `--voice` y
  `--prune-silences`; `ingest`/`render` los rechazan todos.
- **Consumidor:** el dev, en su máquina, y (desde `spec-005`) `apps/render-api`, que invoca el
  binario directo — no el target `nx run render-cli:cli`, que no propaga el exit code real. No se
  publica como paquete npm.
