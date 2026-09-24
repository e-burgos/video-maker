# TASK-007 — Check real del motor OpenRouter en la app empaquetada

> Máquina: macOS, arm64 (Apple Silicon). App instalada en `/Applications/Video Maker.app`
> (reconstruida con `pnpm desktop:dist` desde `c221c3b` + el fix de esta task). Driver:
> `apps/desktop/e2e/packaged-app-smoke.mjs --engine=openrouter` (mismo binario CDP-crudo que
> `TASK-008`/cycle-03, extendido — sin duplicar código: reutiliza `driveConversation`,
> `waitForRenderJob`, `ffprobeVideoStream`, `CdpSession`, etc.).
>
> A diferencia del flow por defecto (que monta el `.dmg` en una carpeta efímera y corre el wizard
> de setup completo), el flow `--engine=openrouter` usa la app **ya instalada** y siembra un
> `VIDEO_MAKER_USER_DATA` temporal con `cp -Rc` de `models/` del `userData` real del dev + un
> `setup.json` marcado `completed` (mismo patrón verificado en el hard-kill check de
> `cycle-03/qa-exploratory.md`) — el llavero de macOS es por usuario, así que la instancia
> temporal ve la misma key real sin copiarla a ningún lado.

## Veredicto

| Área | Resultado |
| --- | --- |
| App reconstruida e instalada en `/Applications` | ✅ `pnpm desktop:dist` (254.5 MB), `ditto` sobre la instalación anterior |
| Setup salteado con `userData` sembrado (key real vía llavero, sin setup wizard) | ✅ `render-api` arriba en <10 s, proyecto importado sin acción manual |
| Configuración → Productor: key cargada solo como hint | ✅ `"Key cargada ••••56f7"` — nunca el valor completo |
| Motor = OpenRouter, guardado desde la UI | ✅ `settings-producer-saved` confirmado |
| "Recomendados": 2 modelos con stats reales del benchmark | ✅ DeepSeek V4.1 Flash (default, 100 % éxito, 9.5 pasos, 118 s, US$0.005/corrida) + Claude Haiku 4.5 (100 %, 7 pasos, 71 s, US$0.097/corrida) |
| "Todos los modelos": catálogo completo + búsqueda | ✅ 30 visibles de entrada, búsqueda "gemini" → 28 filas (`google/gemini-*`) |
| Composer del productor: solo motor activo | ✅ `con OpenRouter`, picker limitado a los 2 modelos recomendados |
| Receta Tutorial completa con DeepSeek (modelo por defecto) | ✅ 4 turnos reales, **50/50 tool calls `mcp__studio__*`**, cero llamadas fuera de MCP |
| Render final | ✅ `succeeded`, mp4 h264 **1920×1080**, `nb_frames=2255` (idéntico al run de Claude en cycle-03) |
| Costo total de la conversación real | ✅ **US$ 0,0714** (4 turnos, ≈571k tokens de entrada + 42.6k de salida sumados) |
| Fuga de la key (US-017-305) | ✅ **0 ocurrencias** en 28 archivos/instantáneas escaneados |
| Quit + huérfanos | ✅ 0 procesos (`render-api/main.js`, `chrome-headless-shell`, `ffmpeg`, `whisper-cli`, `sherpa-onnx-offline-tts`) |
| Defecto de producto encontrado | **Sí, uno real — corregido antes de cerrar la task** (ver §6) |

---

## 1) Reconstrucción e instalación

`env -u ELECTRON_RUN_AS_NODE pnpm desktop:dist` → `dist/desktop/Video-Maker-0.0.0-arm64.dmg`
(254.5 MB). Se montó, se reemplazó `/Applications/Video Maker.app` con `ditto` y se sacó la
cuarentena (`xattr -d com.apple.quarantine`) — mismo patrón ad-hoc sin notarizar que
`cycle-03/desktop-smoke.md` documentó (`spctl` marca `rejected`, esperado). El `userData` real
del dev (`~/Library/Application Support/Video Maker`) nunca se tocó: el dev la tenía corriendo,
se cerró con `osascript -e 'quit app "Video Maker"'` antes de reemplazar el binario y se
reabrió normal al final con `open -a "Video Maker"` y env limpio.

## 2) Arranque con `userData` sembrado (sin wizard)

| Campo | Valor |
| --- | --- |
| `VIDEO_MAKER_USER_DATA` | Temp dir dedicado, sembrado antes de arrancar |
| `models/` | `cp -Rc` (clon APFS) desde el `userData` real del dev — mismos 5 artefactos, mismo `sha256` |
| `setup.json` | Copiado del real, con `models.*.path` y `projectsFolder` reescritos al temp dir, `completed: true`, `preferredPort: null` (deja que la app elija puerto libre) |
| Carpeta de proyectos | `cp -Rc` de `media/display-ads-analiticas` (fixture del repo, la misma que cycle-03) |
| Resultado | `render-api` escuchando en <10 s, **CDP fue directo a la ventana del estudio** — cero pasos de setup, el importer legado cargó el proyecto solo |
| Key de OpenRouter | Vino del **llavero de macOS** (`security find-generic-password -s "Video Maker" -a openrouter -w`), no de ningún archivo sembrado — es por usuario, la instancia temporal la vio igual que la real |

## 3) Configuración → Productor

- **Key**: `settings-key-loaded` mostró `"Key cargada ••••56f7"` — nunca el valor completo, ni en
  este check ni en ningún archivo (ver §7).
- **Motor**: cambiado de `Automático` (que hoy resuelve a Claude, porque el CLI está instalado y
  logueado en esta máquina — D-C4-07) a `OpenRouter` explícito, guardado con éxito
  (`settings-producer-saved`).
- **Recomendados** (`openrouter-settings-recommended.png`): dos cards con las stats reales del
  benchmark de `TASK-006`/`TASK-009`:
  - `deepseek/deepseek-v4.1-flash` — Barato, US$0.15/US$0.60 por 1M tok, imágenes sí, 100 % de
    éxito · 9.5 pasos · 118 s · US$0.005/corrida, marcado **Modelo elegido** (default determinista).
  - `anthropic/claude-haiku-4.5` — Referencia, US$1.00/US$5.00 por 1M tok, 100 % de éxito · 7
    pasos · 71 s · US$0.097/corrida.
- **Todos los modelos** (`openrouter-settings-all-models.png`): 30 filas paginadas de entrada;
  búsqueda `"gemini"` → 28 filas, todas `google/gemini-*` — el filtro funciona sobre el catálogo
  en vivo completo, no sobre los recomendados.

## 4) Composer del productor

Con el motor guardado en `openrouter`, `producer-active-engine` mostró **`con OpenRouter`** y el
picker de modelo (`producer-model-picker`) solo ofreció los 2 recomendados
(`deepseek/deepseek-v4.1-flash`, `anthropic/claude-haiku-4.5`) — nunca los 3 modelos de Claude.
El envío usó el modelo por defecto (DeepSeek) sin tocar el picker.

## 5) Conversación real — Receta Tutorial (DeepSeek, modelo por defecto)

Mismo texto inicial y mismos `fallbacks` que `producer-mcp-smoke.mjs`/`CASES.tutorial`
(reutilizados del driver de cycle-03, sin duplicar). 4 turnos reales — el productor terminó el
tutorial en el turno 2 y usó los turnos 3-4 para resolver el logo faltante y afinar el loudness
del audio a pedido propio (auto-QA), igual que habría hecho con cualquier motor.

| Turno | Tool calls (orden real, `mcp__studio__*`) | Tokens in/out | Costo | Wall time |
| --- | --- | --- | --- | --- |
| 1 | `get_project_overview`, `read_project_text`, `probe_media`, `extract_frames` ×8 (inventario + lectura de 7 frames de la grabación) — **11** | 65 094 / 4 448 | US$ 0,0065 | 22,7 s |
| 2 | `get_project_overview`, `read_project_text`, `write_project_text`, `start_job`(voz)+`search_free_music`+`wait_for_job`, `read_project_text`, `import_music`, `get_project_overview`, `start_job`(montaje)+`wait_for_job`, `get_project_overview`, `get_timeline` — **13** | 181 673 / 3 957 | US$ 0,0084 | 90,6 s |
| 3 | `get_project_overview`, `get_timeline`, `read_project_text`, `put_timeline`, `start_job`(render)+`wait_for_job`, `probe_media`, `extract_frames` — **8** | 126 522 / 7 640 | US$ 0,0172 | 131,7 s |
| 4 | `get_project_overview`, `get_timeline`, `read_project_text` ×2, `put_timeline`+`start_job`+`wait_for_job` ×2 (dos re-renders afinando el audio), `probe_media` ×3, `put_timeline`+`start_job`+`wait_for_job`, `probe_media`, `extract_frames` — **18** | 444 700 / 26 606 | US$ 0,0392 | 403,9 s (6 min 44 s) |
| **Total** | **50/50 tool calls, todas `mcp__studio__*`. Cero llamadas fuera de MCP.** | 817 989 / 42 651 | **US$ 0,0714** | 660,1 s (11 min 0 s) |

- `lastStatus: "max-turns-reached"` — igual que el run de Claude en cycle-03, el techo de 4
  turnos del driver se alcanzó con el job de render ya en `succeeded`; no es una falla.
- El modelo **auto-verificó su propio trabajo dos veces**: detectó que el proyecto no tiene
  ningún archivo de logo (preguntó, el driver respondió "seguí sin logo" vía el `fallback` #1) y,
  ya con el video renderizado, notó que el loudness había quedado en -17,3 LUFS contra el
  objetivo implícito de -14, subió el audio y volvió a exportar sin que se lo pidieran
  explícitamente (quedó en -16,4 LUFS, explicando que no podía acercarse más sin desbalancear la
  música bajo la voz) — comportamiento agéntico correcto, no un fallo de receta.

### Cumplimiento de la receta (mismos parámetros que cycle-03)

| Parámetro pedido | Claude (cycle-03) | DeepSeek/OpenRouter (esta task) |
| --- | --- | --- |
| Formato `youtube-16x9` | ✅ | ✅ (1920×1080, detectado de la grabación horizontal) |
| Preset `educational` | ✅ | ✅ ("preset educativo" en el resumen del productor) |
| Guion con voz (Daniela, es-AR) | ✅ | ✅ 7 líneas sincronizadas, ninguna se pasó de ventana |
| Subtítulos clásicos abajo | ✅ | ✅ "no tapan la interfaz", siguen el guion palabra por palabra |
| Música libre suave con crédito | ✅ | ✅ Felipe Ruiz P., CC BY-SA 4.0, mezclada -8 dB / -18 dB bajo voz |
| Logo abajo a la derecha | ✅ (si había logo) | **No aplicado** — el proyecto (mismo fixture que cycle-03) no tiene ningún archivo de logo; el modelo lo detectó, preguntó y siguió sin logo por indicación explícita — mismo escenario que habría enfrentado Claude con este fixture |
| Placas de inicio/cierre 2 s, fondo blanco | ✅ | ✅ con animación (subida al inicio, zoom al cierre) |
| Despedida agregada si falta | ✅ | ✅ "¡Gracias por ver este tutorial! Nos vemos en el próximo." agregada como última línea |

**DeepSeek no rompió ninguna regla de la receta.** La única desviación (logo) es una limitación
del fixture (sin archivo de logo en el proyecto), no del modelo, y el productor la comunicó y
resolvió correctamente pidiendo confirmación antes de continuar — igual que se espera de
cualquier motor.

## 6) Render final

| Campo | Valor |
| --- | --- |
| Ruta | `<projectsFolder>/display-ads-analiticas/out/24ecf1a9-….mp4` |
| `codec_name` | `h264` |
| `width` × `height` | **1920 × 1080** |
| `nb_frames` | **2255** — idéntico al run de Claude en `cycle-03/desktop-smoke.md` (75,2 s a 30 fps: 71,2 s de grabación + 4 s de placas, mismo cálculo en ambos runs) |

## 7) Defecto real de producto encontrado y corregido

**Race condition en `apps/web/src/pages/producer-page.tsx`.** El primer intento de esta task
falló con `PRODUCER_MODEL_INVALID (resource: sonnet)` al enviar el primer turno, a pesar de que
el picker del composer mostraba correctamente solo los 2 modelos de OpenRouter.

**Causa raíz:** `engineDefaultModel` depende de `producerSettings.data?.effectiveEngine` — pero
si el recurso `conversation` resuelve **antes** que `producerSettings` (carrera real entre dos
`useAsyncResource` en paralelo), en ese render `effectiveEngine` todavía es `null` y
`engineDefaultModel` cae al último `else`: `conversation.data.models.default`, que es el default
de Claude (`"sonnet"`) sin importar el motor real. El `useEffect` que fija `model` solo corre
mientras `model === null`, así que ese valor stale queda **trabado** aunque después
`producerSettings` cargue el motor y la lista correctos — el `<select>` muestra los 2 modelos de
OpenRouter (porque `options` sí se recalcula), pero el valor que se envía al backend sigue siendo
`"sonnet"`, que el backend rechaza porque no está en la lista permitida del motor activo.

**Fix** (`apps/web/src/pages/producer-page.tsx`): un segundo `useEffect` que resetea `model` a
`null` en cuanto deja de estar entre las opciones vigentes, lo que dispara de nuevo el primer
efecto con el `engineDefaultModel` ya correcto:

```tsx
useEffect(() => {
  if (model !== null && models.length > 0 && !models.some((option) => option.id === model)) {
    setModel(null);
  }
}, [model, models]);
```

Test de regresión agregado en `apps/web/src/pages/producer-page.spec.tsx`
(`'recovers the model when producer settings resolve after the conversation already locked a
stale default'`): resuelve `getProducer` primero (con `models.default: 'sonnet'`, el fixture por
defecto) y deja `getProducerSettings` pendiente a propósito, confirma que el picker arranca en
`sonnet`, resuelve `producerSettings` con `effectiveEngine: 'openrouter'` y confirma que el
picker se corrige solo al modelo de OpenRouter. `pnpm nx run-many -t lint test build -p web` en
verde: **1144/1144 tests**, cobertura 97 % líneas / 93 % ramas / 96 % funciones (todo ≥ 80 %).

Después del fix se reconstruyó el `.dmg`, se reinstaló y se repitió el check completo — sin este
error en las corridas siguientes.

## 8) Mejora al arnés de prueba (no es un defecto de producto)

El primer re-intento del check (ya con el fix de arriba) reportó **4 "turnos"** desde el driver,
pero el backend solo había corrido **2** turnos reales — los turnos 3 y 4 del log eran el mismo
estado stale del turno 1, re-leído. Causa: `waitForTurnSettled` (compartida por el flow Claude y
el flow OpenRouter) evalúa su condición **inmediatamente** al llamarla (sin esperar el primer
intervalo); si el nuevo turno todavía no cambió `data-status` a `"running"` en ese instante
exacto (una ventana de milisegundos entre el click de enviar y el re-render de React), el driver
lee el estado terminal del turno **anterior** y lo reporta como si el nuevo turno ya hubiera
terminado — cortando la espera real y, en el peor caso, cerrando la app antes de que el mensaje
final del turno real se persista (por eso el primer intento de este check también se quedó sin
`usage`/costo del turno 2, el más pesado).

**Fix en `apps/desktop/e2e/packaged-app-smoke.mjs`:** nueva `waitForTurnRunning(cdp, timeoutMs)`,
llamada entre `sendComposerText` y `waitForTurnSettled` en `driveConversation` — espera (con
`intervalMs: 250`) a que `data-status` pase a `"running"` antes de esperar el asentamiento; si no
lo ve en 20 s (turno demasiado rápido para observarlo) sigue igual, sin bloquear. Beneficia por
igual al flow Claude por defecto y al nuevo `--engine=openrouter`. Con este fix, la corrida final
(§5) coincidió exactamente entre lo que reportó el driver y lo que quedó en
`work/producer/turns/*.jsonl` y en `studio.db` (4 turnos reales, 50 tool calls, 4 mensajes con
`usage`/costo).

## 9) Fuga de la key (US-017-305)

Chequeo hecho **sin imprimir la key en ningún momento**: se leyó una sola vez dentro del proceso
Node con `execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'Video Maker', '-a',
'openrouter', '-w'])`, se buscó su substring en archivos/buffers y solo se registran
cuentas/rutas, nunca el valor.

| Objetivo escaneado | Resultado |
| --- | --- |
| `studio.db`, `studio.db-wal`, `studio.db-shm` (userData temporal) | 0 ocurrencias |
| `logs/` (userData temporal) | 0 ocurrencias |
| `setup.json` (userData temporal) | 0 ocurrencias |
| `work/producer/**` del proyecto (incluye `turns/*.jsonl`, `conversation.md`, `hitos.json`, `script.txt`) | 0 ocurrencias |
| `outerHTML` de la página de Configuración (después de cargar la key) | 0 ocurrencias |
| `outerHTML` de la página del productor (después de la conversación completa) | 0 ocurrencias |
| **Total** | **28 archivos/instantáneas, 0 fugas** |

## 10) Cierre y huérfanos

| Paso | Resultado |
| --- | --- |
| Quit (`osascript -e 'tell application "Video Maker" to quit'`) | Cierra en <1 s |
| Huérfanos (`render-api/main.js`, `chrome-headless-shell`, `ffmpeg`, `whisper-cli`, `sherpa-onnx-offline-tts`) | 0 procesos |
| RSS del árbol completo justo antes del quit | 256 848 KB (250,8 MB) |
| Reapertura de la app del dev | `open -a "Video Maker"` con env limpio, sobre su `userData` real (nunca tocado) |

---

## Resumen de costos (esta task)

| Ítem | Valor |
| --- | --- |
| Benchmark de `TASK-006` (referencia, no de esta task) | US$ 0,22 |
| Receta Tutorial completa con DeepSeek (4 turnos reales, §5) | **US$ 0,0714** |
| Modelo | `deepseek/deepseek-v4.1-flash` (default determinista de la lista recomendada) |
