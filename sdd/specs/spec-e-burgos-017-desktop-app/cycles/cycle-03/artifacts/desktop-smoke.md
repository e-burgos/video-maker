# TASK-008 — Check real del .dmg empaquetado

> Máquina: macOS 26.4 (build 25E246), arm64 (Apple Silicon). Driver:
> `apps/desktop/e2e/packaged-app-smoke.mjs` (Node puro, sin dependencias — CDP crudo por
> WebSocket contra el `.app` empaquetado, cero Playwright/Electron de dev). Re-ejecutable con
> `node apps/desktop/e2e/packaged-app-smoke.mjs`; agrega `PACKAGED_SMOKE_DRY_RUN=1` para probar
> setup + import + guard local sin gastar una conversación real del productor.
>
> `.dmg`: `dist/desktop/Video-Maker-0.0.0-arm64.dmg` (254.3 MB), generado por TASK-007.

## Veredicto

| Área | Resultado |
| --- | --- |
| Instalación desde `.dmg` puesto en cuarentena | ✅ Monta, copia y corre; `spctl` marca `rejected` en ambos (esperado: ad-hoc, sin notarizar) |
| Primer arranque en `VIDEO_MAKER_USER_DATA` fresco, con importer real | ✅ 48.7 s (con mirror local seedeado) |
| Import de proyecto legado (`display-ads-analiticas`, clon APFS `cp -Rc`) | ✅ aparece en la lista sin acción manual |
| Guardia local (`Host` + token) desde afuera de la app | ✅ sin token → 403; `Host: evil.example` + token válido → 403 |
| Conversación real con Receta Tutorial (modelo `sonnet`, gasta la suscripción) | ✅ 4 turnos, **39/39 tool calls `mcp__studio__*`**, cero llamadas fuera de MCP |
| Render final | ✅ `succeeded`, mp4 h264 **1920×1080**, `nb_frames=2255` |
| Quit por menú + chequeo de huérfanos | ✅ 0 procesos reales (ver nota metodológica abajo) |
| Reapertura con mismo `VIDEO_MAKER_USER_DATA` | ✅ setup no vuelve a aparecer; proyecto y conversación (5 mensajes) siguen ahí |
| Defecto de producto encontrado | Ninguno. Un solo hallazgo, y era de mi arnés de prueba (ver abajo) |

---

## 1) Instalación y Gatekeeper

| Campo | Valor |
| --- | --- |
| Firma | `codesign -dv`: `flags=0x2(adhoc)`, `Signature=adhoc` — sin identidad de desarrollador, sin notarizar (así se generó en TASK-007: `identity: null` + `codesign --sign -` en `afterPack`) |
| `spctl -a -vv` sobre el `.dmg` | `rejected — source=no usable signature` |
| `spctl -a -vv --type execute` sobre el `.app` copiado | `rejected` |
| Cuarentena | `xattr -w com.apple.quarantine` antes de montar, para reproducir el `.dmg` tal como llega descargado de un browser |

**Camino "Abrir igual" esperado en macOS 26.4** (no se pudo clickear una UI real desde este arnés
headless; esto es lo que predicen `codesign`/`spctl` y el comportamiento de Gatekeeper vigente
desde macOS Ventura, sin cambios hasta Tahoe/26):

1. Doble clic en `Video Maker.app` desde Finder → diálogo **"'Video Maker' No se pudo abrir"**
   ("Apple no pudo verificar que 'Video Maker' esté libre de malware…"), con un solo botón
   **"OK"**/"Mover a la papelera" — **no** hay botón "Abrir igual" en este primer diálogo.
2. **System Settings → Privacy & Security** → bajar hasta la sección "Security" → mensaje
   *"'Video Maker' was blocked from use because it is not from an identified developer"* → botón
   **"Open Anyway"**.
3. Confirmar con Touch ID / contraseña → un segundo diálogo con botón **"Open"** → la app arranca.

Una vez que el usuario pasa por este camino una vez, los arranques siguientes no vuelven a
preguntar (Gatekeeper recuerda la aprobación por ruta+hash).

## 2) Primer arranque (seedeado)

| Campo | Valor |
| --- | --- |
| `VIDEO_MAKER_USER_DATA` | Fresco, temp dir dedicado |
| Descargas | Los 5 modelos (`whisperModel`, 3 voces, `chromeHeadlessShell`) servidos por un mirror HTTP local con `Range` (mismo patrón que TASK-006/007), manifest.json de la copia empaquetada parcheado para apuntar ahí — nunca se tocó el manifest del repo |
| Carpeta de proyectos | Se usó el default (`<userData>/projects`), pre-sembrado con el clon APFS **antes** de arrancar la app — el picker nativo (`dialog.showOpenDialog`) no se puede manejar por CDP, así que en vez de clickearlo se validó el paso "continuar con la carpeta por default" |
| Claude CLI | `found: true`, `/opt/homebrew/bin/claude · 2.1.123 · signed in` |
| **Tiempo total primer arranque** | **48.7 s** (con mirror; sin mirror sería la descarga real de ~870 MB) |

## 3) Import del proyecto legado

El importer de `apps/render-api/src/store/import-legacy-media.ts` corrió al levantar render-api
apuntando `RENDER_API_MEDIA_ROOT` a la carpeta de proyectos pre-sembrada. `display-ads-analiticas`
apareció en la lista (`[data-testid="video-card"][data-video="display-ads-analiticas"]`) sin
ninguna acción manual — el `cp -Rc` (clon APFS, sin duplicar disco) + el import automático en el
arranque de render-api es lo que se esperaba.

## 4) Guardia de la API local

| Request (desde afuera de la app, `curl`/`http.request` crudo) | `Host` enviado | Token | Resultado |
| --- | --- | --- | --- |
| Sin token | `127.0.0.1:<port>` (correcto) | — | **403** |
| Host falso | `evil.example` | `x-studio-token` válido | **403** |

Ambos casos correctos según `evaluateLocalAccess` (`apps/render-api/src/http/local-access-guard.ts`):
el chequeo de `Host` corre primero e ignora cualquier token si el host no matchea
`127.0.0.1:<port>`/`localhost:<port>`; sin token ni cookie de sesión tampoco pasa.

> Nota de método: la primera corrida de este check usó `fetch()` de Node para simular el header
> `Host` falso, y dio 200 en vez de 403 — **no era un bug de la app**, sino que `fetch()` prohíbe
> sobrescribir el header `Host` (lo descarta silenciosamente, spec WHATWG fetch), así que en
> realidad viajaba el host correcto. Se corrigió el arnés para usar `node:http` crudo
> (`http.request` sí respeta un `Host` explícito), y ahí sí se reprodujo el 403 esperado.

## 5) Conversación real — Receta Tutorial

Modelo `sonnet` (default), texto inicial y `fallbacks` copiados literal de
`CASES.tutorial` en `apps/render-api/e2e/producer-mcp-smoke.mjs` (duplicados a propósito en el
driver nuevo — ese script tiene código top-level con efectos secundarios y no es seguro importarlo).

| Turno | Estado | Tool calls |
| --- | --- | --- |
| 1 | `succeeded` | `get_project_overview`, `read_project_text`, `probe_media`, `extract_frames` |
| 2 | `succeeded` | (mismos 4, el productor re-lee tras la respuesta) |
| 3 | `succeeded` | `write_project_text`, `search_free_music` ×3, `import_music`, `start_job`+`wait_for_job` ×3, `read_project_text`, `get_timeline`, `put_timeline`, `probe_media`, `extract_frames` |
| 4 | `succeeded` | (mismo patrón que el turno 3 — el productor iteró la propuesta de música/timeline) |

- **39/39 tool calls con prefijo `mcp__studio__*`. Cero llamadas fuera de MCP.**
- `lastStatus: "max-turns-reached"` — se llegó al techo de 4 turnos del driver (igual que
  `producer-mcp-smoke.mjs`); el job de render ya había terminado en `succeeded` antes de eso, así
  que no es una falla, es el límite de turnos del smoke test.
- **Tiempo de render** (desde el primer envío hasta que `producer-jobs` marcó el job `render` en
  estado terminal): **429.9 s (7 min 10 s)**.

## 6) Verificación del video renderizado

| Campo | Valor |
| --- | --- |
| Ruta | `<projectsFolder>/display-ads-analiticas/out/<uuid>.mp4` |
| `codec_name` | `h264` |
| `width` × `height` | **1920 × 1080** |
| `nb_frames` | `2255` |

## 7) Cierre y reapertura

| Paso | Resultado |
| --- | --- |
| Quit | `osascript -e 'tell application "Video Maker" to quit'` — cierra en <1 s |
| Huérfanos | 0 reales. Ver nota abajo |
| Reapertura, mismo `VIDEO_MAKER_USER_DATA` | Setup **no** vuelve a aparecer; proyecto y conversación (5 mensajes en `producer-message-list`) siguen presentes |

> **Nota de método (no defecto de producto):** el primer chequeo de huérfanos usó un patrón
> `pgrep -f` global para `claude` (sin acotar), que matcheó procesos de `claude` **ajenos a la
> app** ya corriendo en la máquina (la extensión de Claude Code del IDE y Claude Desktop, ninguno
> hijo del proceso probado). Se confirmó con `pgrep -f "<ruta única del temp dir de este run>"` y
> con el patrón de binarios (`render-api/main.js`, `ffmpeg`, `whisper-cli`,
> `sherpa-onnx-offline-tts`, `chrome-headless-shell`) que el árbol de la app deja **cero**
> procesos vivos tras el quit. El driver (`apps/desktop/e2e/packaged-app-smoke.mjs`) quedó
> corregido para acotar el patrón de `claude` a `<ruta de la copia del .app>.*claude -p` en vez de
> `claude ` global.

## 8) Medidas

| Métrica | Valor |
| --- | --- |
| Primer arranque total (seedeado, con mirror local) | 48.7 s |
| Tiempo de render (Receta Tutorial completa) | 429.9 s (7 min 10 s) |
| Memoria RSS del árbol completo de la app (suma `ps`, justo antes del quit) | 291 616 KB (284.8 MB) |

---

## Checklist para la revisión visual del dev

El driver cubre todo lo que se puede probar sin ojos humanos; falta la revisión visual real de:

- [ ] **Ventana de setup**: que las barras de progreso de descarga se vean bien, que el paso de
      carpeta muestre el path legible, que el badge de Claude ("Encontrado"/sesión) tenga buen
      contraste, que los tres puntos de progreso arriba se vean coherentes.
- [ ] **Ventana de estudio**: que la tarjeta del proyecto importado (`display-ads-analiticas`) se
      vea igual que una creada a mano (sin flags raros de layout), que el chat del productor se
      lea bien turno a turno, que los chips de sugerencia no corten texto, que el panel de
      `producer-jobs` muestre el job de render con una barra/estado claro mientras corre los 7 min.
  - [ ] Reproducir el `.mp4` final y confirmar que el resultado visual (voz Daniela, subtítulos,
        música de fondo, logo, placas de inicio/cierre) matchea lo pedido en el texto de la
        Receta Tutorial — el driver solo verifica contenedor/resolución/frames, no el contenido.
- [ ] **Camino de Gatekeeper**: confirmar en un Mac real, con el `.dmg` descargado por Safari/Chrome
      (cuarentena real, no `xattr -w` manual), que el camino documentado en la sección 1
      (`System Settings → Privacy & Security → Open Anyway`) es exactamente el que aparece en
      macOS 26.4.
