# spec-e-burgos-002 cycle-03 — 2026-09-08

> Filtro anti-ruido aplicado. **Deliberadamente NO se escribe acá** la lección "un alias de
> workspace hay que declararlo en cada resolvedor del stack": ya está en
> `journal/2026-09-08-fix-e-burgos-001-001.md` y parcialmente en `lessons.md`. Lo único que la
> destilación tiene que corregir es que la línea vigente de `lessons.md` dice **"en los DOS lados"**
> (`tsconfig.base.json` + `vite.config.ts`) y este ciclo confirmó que son **TRES**: falta el
> `webpackOverride` de `@remotion/bundler`.

## Qué pasó

**1. `nx run <proyecto>:<target>` no propaga el exit code real del proceso.** La CLI implementa un
mapa de exit codes con significado (2 uso/argumento, 3 input de etapa faltante, 4/5/6 fallo de
ingest/plan/render), probado en unit tests. Al verificarlo end-to-end vía
`pnpm nx run render-cli:cli -- ingest <ruta-inexistente>`, el shell devolvía `1`, no `3`. No es un
bug de la CLI: `nx:run-commands` normaliza **cualquier** fallo a su propio `1`. Invocando el binario
directo (`node -r ./tools/render-cli/src/cli-register.cjs tools/render-cli/src/main.ts …`) el
`$?` es `3`, el correcto.

**2. `format.duration` de `ffprobe` no es la duración del video.** Verificando CA-015, el MP4 daba
`format.duration = 17.984 s` contra `nb_frames/fps = 538/30 = 17.9333 s`: 50 ms de más, suficiente
para parecer un bug de timeline. No lo era. El nivel `format` reporta el **máximo entre streams**, y
la pista AAC es más larga que el video por el padding/priming del encoder. El stream de video da
`duration = 17.933333`, exacto, sin tolerancia. Mismo origen que la otra fila sospechosa del mismo
`ffprobe`: `pix_fmt = yuvj420p` en vez de `yuv420p` es un rótulo de **rango de color**
(`color_range=pc`), el submuestreo 4:2:0 es el mismo.

**3. El hook `config-protection` matchea por `basename`, y eso descopó un entregable planificado.**
El architect especificaba `tools/render-cli/eslint.config.mjs` con 8 guardrails ejecutables
(§2.5). El hook del harness del dev bloquea `Write`/`Edit` sobre **cualquier** archivo cuyo
basename sea `eslint.config.mjs`, sin distinguir la config raíz —que es la que quiere proteger— de
la de un proyecto nuevo, que es aditiva e inocua. El implementador paró y reportó en vez de
rodearlo con `Bash` (correcto), pero el ciclo cerró con las 8 reglas sostenidas **a mano**.

## Lección

- Verificar un exit code exacto invocando el **binario**, nunca a través de `nx run`: Nx normaliza
  todo fallo a `1` y un criterio de aceptación sobre códigos distintos de 0 pasa igual con el
  código equivocado.
- Comparar la duración de un render contra el **stream de video** (`nb_frames`/`r_frame_rate`) y
  nunca contra `format.duration`, que es el máximo entre streams y el AAC lo infla por padding.
- Cuando un hook de protección de configs bloquea un archivo **no-raíz**, tratarlo como alcance
  descopado y explícito (registrarlo como pendiente), no como detalle de implementación: lo que se
  pierde es el refuerzo ejecutable de decisiones del architect, y sin él las reglas se sostienen
  solo mientras alguien las recuerde.

## Costo evitable

- (1) y (2) costaron cada una una investigación de "esto debería andar y no anda" sobre código que
  estaba **correcto**: el diagnóstico entero fue contra la herramienta de medición, no contra el
  entregable. Saberlo de antemano ahorra la bisección completa en ambos casos, y (2) va a volver a
  aparecer sí o sí en **spec-004** (mezcla de audio), donde el desfase AAC/video es el objeto de
  trabajo, no un artefacto.
- (3) es barato hoy y caro después: la próxima task que agregue `node:fs` o `child_process` a
  `tools/render-cli` va a pasar `lint`, `test` y `build` en verde, y el defecto se va a descubrir
  en runtime o en review, no en el pipeline.
