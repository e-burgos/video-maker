# Context Prompt — tools/render-cli

> Entry point para agentes que trabajen sobre `tools/render-cli`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-002 cycle-03 | Fecha: 2026-09-08

- **Tipo:** tool Node ejecutable (CLI headless)
- **Estado:** existe y está completo. Primer proyecto bajo `tools/` del repo. 52 archivos, 151
  tests en 17 archivos, cobertura 98.26 % stmts / 92.37 % branches / 100 % funcs / 98.24 % lines
  (umbral 85 %). Cero dependencias npm nuevas — el parseo es `node:util parseArgs`. Los cuatro
  comandos (`ingest`, `plan`, `render`, `run`) están implementados y verificados: CA-013 a CA-016
  en PASS (CA-015/CA-016 con dos renders reales, evidencia en
  `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/artifacts/smoke-ca015-ca016.md`).
  Con esto `spec-e-burgos-002-auto-montage-pipeline` queda `completed` (3 ciclos).
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
  (RF-10 a RF-12, CA-013 a CA-016) — spec cerrada; próximos cambios llegan por `spec-005` u otra.
- **Depende de:** `@video-maker/auto-montage`, `@video-maker/media-local`, `@video-maker/timeline-core`
  y `@video-maker/composition-remotion/render` (subpath `/render` exclusivamente). Ningún paquete
  npm nuevo.
- **Comandos:** `ingest` · `plan` · `render` · `run` (los tres encadenados) — los cuatro implementados.
- **Consumidor:** el dev, en su máquina, y (desde `spec-005`) `apps/render-api`, que invoca el
  binario directo — no el target `nx run render-cli:cli`, que no propaga el exit code real. No se
  publica como paquete npm.
