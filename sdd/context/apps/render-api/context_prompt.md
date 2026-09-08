# Context Prompt — apps/render-api

> Entry point para agentes que trabajen sobre `apps/render-api`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-005 cycle-01 (apertura) | Fecha: 2026-09-08
> Creado por el orquestador al abrir `cycle-01` de `spec-e-burgos-005-render-service`.

- **Tipo:** app Node (servicio HTTP local, headless, mono-usuario)
- **Estado:** **en construcción** — `cycle-01` de `spec-e-burgos-005` la está creando. Hasta que ese
  ciclo cierre, el estado real del subproyecto es el que describa el fragmento de `updates/`.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-005-render-service/spec-e-burgos-005-render-service.spec.md`
- **Rol en el sistema:** la puerta HTTP del motor. Es **el único subproyecto del monorepo que puede
  depender a la vez de `libs/media-local` (`type:util`) y `libs/composition-remotion` (`type:ui`)**:
  los `depConstraints` del `eslint.config.mjs` raíz impiden que esas dos libs se importen entre sí, y
  el tag `type:app` cae en el fallback `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }`. Por eso
  la orquestación `render → mix → mux → verify` en una sola llamada vive acá y en ningún otro lado.
- **Depende de:** `@video-maker/timeline-core`, `@video-maker/media-local`,
  `@video-maker/composition-remotion/render` (subpath `/render` exclusivamente, vía `await import()`)
  y `@video-maker/auto-montage`. **Cero dependencias npm nuevas** en `cycle-01`.
- **No contiene lógica de motor propia:** si un cálculo hace falta, va a una lib. Acá vive sólo el
  transporte HTTP, la orquestación de llamadas y la traducción de errores a payload de máquina.
- **Consumidor:** el dev en su máquina y, desde `spec-e-burgos-006`, `apps/web`.
- **Plan de ciclos de la spec:** `cycle-01` fundación + pipeline · `cycle-02` store de assets sobre
  `media/` y persistencia de Timeline/EDL · `cycle-03` cola de jobs, progreso, cancelación y smoke
  E2E real.
