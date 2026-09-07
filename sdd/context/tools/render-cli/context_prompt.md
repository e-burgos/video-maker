# Context Prompt — tools/render-cli

> Entry point para agentes que trabajen sobre `tools/render-cli`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07

- **Tipo:** tool Node ejecutable (CLI headless)
- **Estado:** **todavía no existe en Nx** — lo crea `cycle-03` de
  `spec-e-burgos-002-auto-montage-pipeline`. `cycle-01` solo deja este contexto sembrado.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-002-auto-montage-pipeline/spec-e-burgos-002-auto-montage-pipeline.spec.md`
  (RF-10 a RF-12, CA-013 a CA-016)
- **Depende de:** `@video-maker/auto-montage` y `@video-maker/composition-remotion/render`
- **Comandos previstos:** `ingest` · `plan` · `render` · `run` (los tres encadenados)
- **Consumidor:** el dev, en su máquina. No se publica como paquete.
