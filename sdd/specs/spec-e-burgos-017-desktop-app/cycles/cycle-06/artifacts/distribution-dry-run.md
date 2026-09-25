# cycle-06 · TASK-004 — Verificación real (dry-run de distribución)

> Fecha: 2026-09-25 · Rama: `spec-e-burgos-017-desktop-app` · Todo lo de acá corrió en modo
> dry-run: no se creó ningún repo, no se hizo ningún push ni release real. `pnpm desktop:release`
> y `apps/docs-site/scripts/publish-docs.mjs` corrieron **sin** `--publish`.

## 1) Build del sitio de documentación

`pnpm exec nx run docs-site:build` genera 7 páginas en `dist/apps/docs-site/` (Inicio,
Instalación, Primer arranque, Conectar la IA, Usar el estudio, Preguntas frecuentes, Licencias),
más `assets/style.css` y `assets/screenshots/*.png`. Las capturas de la app (ver §7) salen de la
**app instalada real** (`/Applications/Video Maker.app`), no de ciclos anteriores; todas ≤1440 px
de ancho, no hizo falta reescalarlas.

## 2) Chequeo de links (`apps/docs-site/scripts/check-links.mjs`)

| Chequeo | Resultado |
| --- | --- |
| Links/assets internos rotos | **0** de los 7 HTML generados |
| Botón de descarga apunta a la forma esperada (`.../releases/latest/download/<archivo>`) | ✅ `https://github.com/e-burgos/video-maker-app/releases/latest/download/Video-Maker-arm64.dmg` |
| Links externos encontrados | 21 (HEAD/GET real, sin fallar por red) |
| Links externos con status ≠ 200 | **1**, esperado: el botón de descarga (**404** — el repo público todavía no existe) |

Los 20 links externos restantes (docs.claude.com, openrouter.ai ×3, GitHub/HuggingFace/Chrome for
Testing/electron de `THIRD_PARTY_NOTICES.md`) devolvieron **200**.

## 3) Capturas de pantalla del sitio (1440×900 y 390×844)

`apps/docs-site/scripts/capture-screenshots.mjs` sirve `dist/apps/docs-site/` con un server
estático propio y usa Playwright para las 14 capturas (7 páginas × 2 anchos), guardadas en esta
misma carpeta: `site-inicio-*.png`, `site-instalacion-*.png`, `site-primer-arranque-*.png`,
`site-conectar-ia-*.png`, `site-usar-el-estudio-*.png`, `site-preguntas-frecuentes-*.png`,
`site-licencias-*.png`.

**Revisadas una por una.** Encontré y corregí un problema real:

- **Overflow horizontal de página completa en Licencias, a 390 px** (`bodyScrollWidth: 635` contra
  un viewport de `390`) — las URLs largas y sin espacios de `THIRD_PARTY_NOTICES.md` dentro de
  `<li>` no tenían ningún punto de corte y estiraban toda la página. Fix: `overflow-wrap: anywhere`
  en `p`, `li`, `td` (`apps/docs-site/src/styles.css`). Reverifiqué programáticamente las 7
  páginas × 2 anchos después del fix — **0 overflows** — y volví a tomar las 14 capturas.
- El resto de las páginas no tuvo hallazgos: nav con wrap correcto en mobile, tablas con scroll
  horizontal propio (`.table-wrap`) en vez de romper la página, bloque de código de la alternativa
  por Terminal con su propio scroll interno (`pre { overflow-x: auto }` — confirmado con
  `scrollWidth`/`clientWidth` del propio `<pre>`, no es un bug), `<details>` de las preguntas
  frecuentes con buen contraste en claro y oscuro.

## 4) `pnpm desktop:release` en dry-run

Corrida real completa (build + hash + notas), sin `--publish`:

| Archivo | Tamaño | sha256 |
| --- | --- | --- |
| `dist/desktop/Video-Maker-0.1.0-arm64.dmg` | **254.4 MB** | `a7edcd72778708945c9e6008c2206e6c5c2a09ec1cb1408ba6bbdf99bbbcb01d` |
| `dist/desktop/Video-Maker-arm64.dmg` (nombre estable) | **254.4 MB** (copia idéntica) | `a7edcd72778708945c9e6008c2206e6c5c2a09ec1cb1408ba6bbdf99bbbcb01d` |

- `.app` empaquetado: **775.2 MB** (medido en el build report de `build-desktop.mjs`).
- `dist/desktop/release-notes.md`: la sección `## 0.1.0` de `CHANGELOG.md`, extraída
  automáticamente.
- Comando que **crearía** el release (no se ejecutó):

  ```
  gh release create v0.1.0 dist/desktop/Video-Maker-0.1.0-arm64.dmg dist/desktop/Video-Maker-arm64.dmg --repo e-burgos/video-maker-app --title "Video Maker 0.1.0" --notes-file dist/desktop/release-notes.md
  ```

- El tamaño real (254.4 MB) coincide con el que ya usa la web (`≈254 MB` en Inicio) — no hizo
  falta ajustar la copy después de esta corrida.

## 5) `apps/docs-site/scripts/publish-docs.mjs` en dry-run

Corrida sin `--publish`: solo imprime el plan (clonar `e-burgos/video-maker-app`, reemplazar
`site/`, copiar el workflow de Pages, commit y push). No tocó git ni la red de escritura.

## 6) Cosas para decidir antes de publicar (TASK-005)

- **Repo de distribución `e-burgos/video-maker-app`**: hoy no existe (`gh repo view` fallaría), por
  eso el link de descarga da 404 en el chequeo de arriba — es lo esperado hasta TASK-005.
- **Costo de Claude Haiku en "Conectar la IA" es una estimación**, no una medición real (se calculó
  aplicando el precio por token de Haiku a los mismos tokens que midió la corrida real con
  DeepSeek) — está aclarado en la propia web, pero avisalo si preferís correr la Receta Tutorial
  real con Haiku antes de publicar para tener un número medido.
- **Versiones pinneadas en `apps/docs-site/deploy/pages-workflow.yml`**
  (`actions/checkout@v4.2.2`, `actions/configure-pages@v5.0.0`, `actions/upload-pages-artifact@v3.0.1`,
  `actions/deploy-pages@v4.0.5`) — revisalas contra las últimas versiones publicadas antes de la
  primera corrida en el repo público, por si salió algo más nuevo.
- **CHANGELOG.md** en español está redactado para tus amigos — revisalo por si querés otro tono.
- **Precios de OpenRouter cambian**: el 25/09/2026 DeepSeek V4.1 Flash subió de US$0.15/US$0.60 a
  US$0.30/US$1.20 por 1M tokens (verificado en vivo, ver §7) — la web ya muestra el precio y el
  costo recalculados a esa fecha, pero si volvés a cambiar de modelo por defecto conviene
  reverificar el número antes de cada release.

## 7) Segunda pasada — capturas reales de la app instalada, copy y verificación de macOS mínimo

Pedido del dev después de revisar `site-inicio-1440x900.png`: las capturas de "Así se ve" eran de
una UI vieja (ciclo 3, badges `raw/catalog`, slugs monoespaciados). Se reemplazaron por capturas
reales de la **app instalada** (`/Applications/Video Maker.app`), nunca de un servidor de
desarrollo.

- **Cómo se armaron**: `apps/desktop/e2e/capture-app-screenshots.mjs` (nuevo, mismo patrón CDP
  crudo que `packaged-app-smoke.mjs`) cerró la app real del dev (`osascript … quit`), levantó la
  app instalada con un `VIDEO_MAKER_USER_DATA` temporal — modelos clonados por APFS
  (`cp -Rc`) desde `~/Library/Application Support/Video Maker/models`, un `setup.json` completo
  reescrito a las nuevas rutas, y clones APFS de tres proyectos reales de `media/`
  (`display-ads-analiticas`, `display-ads-creacion-campana-full-desktop`, `optica-siochana`) — y
  con `--remote-debugging-port` tomó 5 capturas a 1440×900: **home-projects.png** (Tus videos, con
  miniaturas reales), **workspace-preview.png** (chat del productor + Vista previa mostrando un
  render terminado de `optica-siochana`), **proposal-card.png** (tarjeta de rol propuesto tras
  adjuntar un clip nuevo por `DOM.setFileInputFiles`), **material-tab.png** (pestaña Material) y
  **settings-openrouter.png** (Configuración → Productor con OpenRouter y los modelos
  recomendados — la key sigue enmascarada, `"Key cargada ••••56f7"`, nunca se vio ni se logueó el
  valor completo). Cerró esa instancia y, con `VIDEO_MAKER_USER_DATA` fresco (sin `setup.json`),
  abrió una segunda vez solo para **first-run-setup.png** (paso de descargas en 0 %, sin esperar a
  que terminen — se cerró la app apenas se tomó la captura). Al final relanzó la app real del dev
  (`open -a "Video Maker"`, entorno limpio) contra su propio `userData` — proyectos y conversación
  intactos, cero huérfanos (`render-api`, `chrome-headless-shell`, `ffmpeg`, `whisper-cli`,
  `sherpa-onnx-offline-tts`) después de cada corrida.
  - Nota operativa: la primera corrida del script chocó con `ELECTRON_RUN_AS_NODE=1` heredado del
    shell al reabrir la app del dev (falla silenciosa, Electron arranca como Node y sale) — se
    resolvió relanzando con `env -u ELECTRON_RUN_AS_NODE` y agregando reintentos a
    `relaunchDevApp()`. Ninguna corrida imprimió ni leyó el contenido de `.env`.
  - Se borraron los screenshots viejos (`home-chat.png`, `home-deliveries.png`, `role-proposal.png`,
    `library-advanced.png`); Inicio, Usar el estudio, Primer arranque y Conectar la IA ahora usan
    las 6 capturas nuevas (`gatekeeper-not-opened.png` no cambia, es el diálogo real de macOS).
- **Copy de Inicio corregido** al texto pedido: *"Todo el trabajo — guion, cortes, subtítulos,
  locución y música — pasa en tu Mac y vos confirmás cada paso; solo la conversación con el
  productor sale de tu máquina (a Claude o a OpenRouter)."*
- **macOS mínimo verificado**: `LSMinimumSystemVersion` en el `Info.plist` de la app instalada y
  del Electron de dev es **`13.0`** (Electron 44.4.5 lo fija así), igual que la propia app
  vendored — la afirmación "macOS 13 Ventura o posterior" de Inicio es correcta, no hizo falta
  cambiarla.
- **Tamaños del primer arranque corregidos** a los números reales que muestra la propia ventana de
  setup (capturados en `first-run-setup.png`, todos en MB decimales redondeados por la UI):
  whisperModel 547 MB, voice es_AR-daniela-high 110 MB, es_ES-davefx-medium 64 MB,
  es_MX-claude-high 64 MB, chromeHeadlessShell 94 MB — total **≈879 MB** (antes decía ≈920 MB,
  calculado a mano desde `manifest.json` en bytes decimales; ahora coincide con lo que el usuario
  ve en pantalla).
- **Precio de DeepSeek actualizado** a lo que muestra hoy `settings-openrouter.png` (ver §6).
- Sitio reconstruido, `check-links.mjs` reverificado (0 rotos, mismos 2 no-200 esperados) y las 14
  capturas `site-*.png` retomadas y revisadas de nuevo — sin overflows (chequeo automatizado en
  las 7 páginas × 2 anchos).
