# Paridad de encuadre a los 8 s — spec-e-burgos-006 cycle-03 (TASK-028, D-12, CA-238)

> Ejecutado el 2026-09-09 contra `apps/render-api` real (puerto 4399) y `apps/web` real (puerto 4207,
> proxy apuntado al servicio) sobre `media/smoke-ingest` **sin editar**. Los tres números de abajo
> salieron de esta corrida; ninguno es una reconstrucción teórica.

## Por qué no se usó el MCP de Playwright

Igual que en `cycle-01`/`cycle-02`: las tools `mcp__…_playwright__*` de este arnés hablan con un
navegador real a través de la extensión **Playwright MCP Bridge**, no instalada en esta máquina.
Se usa la librería Playwright ya cacheada, resuelta en tiempo de ejecución
(`resolvePlaywright()` en el script del paso 4 — intenta `import('playwright')` y, si falla,
recorre `~/.npm/_npx/*/node_modules/playwright` sin asumir el hash de ninguna máquina en
particular, el mismo criterio de portabilidad que `studio-smoke.mjs`), sin agregar nada a
`package.json`, lanzando el Chrome instalado con `chromium.launch({ channel: 'chrome' })`.

> **TASK-032 (revisión de ciclo):** el script del paso 4 vivía en el scratchpad y no era
> repetible con un comando — hueco encontrado por el reviewer. Ahora está commiteado en
> `apps/web/e2e/capture-frame-240.mjs`, con el mismo resolver portable de Playwright que
> `studio-smoke.mjs` (antes importaba la librería desde un hash de `~/.npm/_npx` hardcodeado).
> Re-corrido para confirmar que el archivo commiteado reproduce el mismo estado que esta medición
> (`readyState: 4`, `currentTime: 9.666666`, `videoWidth: 1280`, `duration: 22.5` — idéntico),
> **sin disparar ningún render** — el script sólo abre el Player contra `render-api`/`media/`
> reales sin editar, gate de memoria propio incluido en el script.

## Gate de memoria (antes de arrancar, compartido con `render-non-regression.md`)

```
$ pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'   # sin salida
$ memory_pressure | tail -2                         # System-wide memory free percentage: 59%
$ npx remotion browser ensure                       # Has browser at .../chrome-headless-shell
```

## Guion (copiable)

```bash
# 1. el servicio contra media/ real (mismo proceso que render-non-regression.md, 4310 ocupado por
#    `pnpm sdd:docs` en esta máquina)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. la app, con el proxy apuntado al servicio
WEB_PORT=4207 RENDER_API_URL=http://127.0.0.1:4399 \
  pnpm exec vite --config apps/web/vite.config.ts &

# 3. EP-007 llega same-origin por el proxy
curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" \
  http://localhost:4207/api/projects/smoke-ingest/timeline      # 200 application/json 7943

# 4. captura del frame 240 (t = 8 s a 30 fps) — sin controles, vía ?frame= (TASK-024)
node apps/web/e2e/capture-frame-240.mjs sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/artifacts player-frame-240.png

# 5. reescalado a 1080x1920 (el contenedor del Player en el DOM mide 448x795 por el max-w-md de la
#    UI, misma proporción 9:16)
ffmpeg -y -i player-frame-240.png -vf scale=1080:1920 player-frame-240-scaled-1080x1920.png

# 6. la métrica, contra la referencia de cycle-02 (no se regeneró)
ffmpeg -hide_banner -i player-frame-240-scaled-1080x1920.png \
  -i cycles/cycle-02/artifacts/render-frame-reference-8s.png \
  -lavfi "psnr=stats_file=-" -f null -
```

El script del paso 4 navega a `/projects/smoke-ingest/preview?frame=240`, espera
`[data-testid="timeline-player"]`, espera a que el `<video>` del DOM tenga `readyState === 4` y
`videoWidth > 0` (medido en el navegador, nunca por la captura ni por el `src`), y recién ahí
captura el contenedor del Player.

## Riesgo documentado en el architect (§4.5) — qué pasó realmente

`initialFrame=240` con el Player pausado dio `currentTime: 9.666666` en el `<video>` montado, **no**
`8.0`. Esto **no es el fallo que el architect anticipaba** (el Player no pintando el frame pedido):
`currentTime` es la posición dentro del **archivo fuente** del clip de a-roll que está activo en el
frame de composición 240, desplazada por el `trimBefore` de Remotion — no es, ni tiene por qué ser,
el tiempo absoluto de la composición. `duration: 22.5` en el estado capturado coincide exactamente
con la duración del asset fuente (`22500 ms`), confirmando que el `<video>` es el clip correcto. La
prueba de que el frame pintado es el correcto no es leer `currentTime`, es la métrica de píxeles de
abajo — que es justamente lo que este documento mide. No hizo falta la salida alternativa de
reproducir-y-pausar que el architect dejó documentada como plan B.

Estado completo capturado en el navegador: `readyState: 4`, `paused: true`, `videoWidth: 1280`,
`videoHeight: 720`, `duration: 22.5`, `currentTime: 9.666666`.

## Resultado — los tres gates de CA-238

| Gate | Criterio | Medido | |
| --- | --- | --- | --- |
| **G-A** (sin bandas) | luma media de las 96 filas superiores y de las 96 inferiores ≥ 16/255 | superior **70.85/255**, inferior **70.85/255** | **pasa** |
| **G-B** (equivalencia numérica) | `mse_avg ≤ 1500` **y** `mse_avg ≤ 0,35 × mse_avg(antes)` | `mse_avg = 174.24` (`psnr_avg 25.72 dB`); `0,35 × 5424.57 = 1898.6` | **pasa** (174.24 ≤ 1500 y ≤ 1898.6) |
| **G-C** (sensibilidad del oráculo, obligatorio) | quitar `PLAYER_MEDIA_STYLE` y confirmar que **falla** G-A y G-B | luma top/bottom **1.21/255** y **1.20/255** (letterbox real); `mse_avg = 5424.57`, `psnr_avg = 10.79 dB` | **G-A falla, G-B falla** — el oráculo es sensible |

`mse_avg(antes)` para G-B es el número de **esta misma corrida** con el estilo quitado (G-C), no el
valor reconstruido geométricamente por el architect (`6164.68`, calculado sin renderizar nada, sobre
`clip01.mp4` que es un degradado casi uniforme). El medido acá con contenido real
(`5424.57`) es del mismo orden y confirma la misma conclusión: el letterbox es varias veces peor que
el estirado con `fill`, y el `mse_avg` con el fix puesto (`174.24`) queda muy por debajo de ambos
techos.

## Cómo se decidió `fill` vs `cover` (§4.6) — no se resolvió por captura

Como anticipa el architect, la comparación de píxeles **no puede** discriminar `fill` de `cover`
sobre `clip01.mp4` (un degradado azul horizontalmente uniforme). Esa distinción está cerrada por
**código**, no por esta medición: `libs/composition-remotion/src/components/timeline-video.spec.tsx`
(TASK-023) asevera el literal `objectFit: 'fill'` en la rama `player` cuando el llamador no lo
declara, y que el `objectFit` del llamador gana cuando sí lo declara (caso b-roll `cover`/`contain`).
Esta captura prueba la **paridad de encuadre con el render** (que es lo que D-12 y CA-238 piden);
la capa 2 recomendada de §4.6 (material `testsrc2` no uniforme) se omitió por presupuesto del
ciclo, como el architect autoriza explícitamente — la capa 1 (código) ya cierra el criterio.

## Restauración del archivo tras G-C

`libs/composition-remotion/src/components/timeline-video.tsx` se editó **temporalmente** para G-C
(se quitó el spread `{ ...PLAYER_MEDIA_STYLE, ...style }` de la rama `player`, dejando `style={style}`
tal como estaba antes de D-12) y se restauró **inmediatamente después** de la captura. Confirmado con
`git diff` contra el commit de TASK-023: el archivo quedó **exactamente** en el estado que dejó esa
task (el mismo diff de `+3 −1` sobre la versión pre-D-12, sin líneas adicionales). Ningún render real
corrió mientras el archivo estaba en el estado temporal — la captura del Player no dispara ningún job
de `render-api`.

## Conclusión

El preview del Player, con D-12 aplicado, reproduce el mismo encuadre que el render a los 8 s de
`media/smoke-ingest`: sin bandas (G-A), con una diferencia de píxeles muy por debajo del techo y de
la cuarta parte del caso sin el fix (G-B), y se confirmó que la métrica realmente distingue el caso
correcto del incorrecto (G-C). US-3-011 queda cumplido: el dev ve en el preview exactamente el
encuadre que va a salir en el MP4, defecto de estiramiento incluido — ese defecto (`fill` en vez de
`cover`) queda descopado a un `[FIX]` posterior, tal como decide D-12 en `architect.md` §4.2.
