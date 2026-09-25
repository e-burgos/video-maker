# cycle-06 · TASK-004 — Verificación real (dry-run de distribución)

> Fecha: 2026-09-25 · Rama: `spec-e-burgos-017-desktop-app` · Todo lo de acá corrió en modo
> dry-run: no se creó ningún repo, no se hizo ningún push ni release real. `pnpm desktop:release`
> y `apps/docs-site/scripts/publish-docs.mjs` corrieron **sin** `--publish`.

## 1) Build del sitio de documentación

`pnpm exec nx run docs-site:build` genera 7 páginas en `dist/apps/docs-site/` (Inicio,
Instalación, Primer arranque, Conectar la IA, Usar el estudio, Preguntas frecuentes, Licencias),
más `assets/style.css` y `assets/screenshots/*.png` (7 capturas reales, copiadas de `cycle-04` y
`cycle-05`, todas ≤1440 px de ancho — no hizo falta reescalarlas).

## 2) Chequeo de links (`apps/docs-site/scripts/check-links.mjs`)

| Chequeo | Resultado |
| --- | --- |
| Links/assets internos rotos | **0** de los 7 HTML generados |
| Botón de descarga apunta a la forma esperada (`.../releases/latest/download/<archivo>`) | ✅ `https://github.com/e-burgos/video-maker-app/releases/latest/download/Video-Maker-arm64.dmg` |
| Links externos encontrados | 20 (HEAD/GET real, sin fallar por red) |
| Links externos con status ≠ 200 | **2**, ambos esperados hoy: el botón de descarga (**404** — el repo público todavía no existe) y (antes del fix de autolink) `remotion.dev/license` — ya corregido, ahora **200** |

Los 18 links externos restantes (docs.claude.com, openrouter.ai ×3, GitHub/HuggingFace/Chrome for
Testing de `THIRD_PARTY_NOTICES.md`) devolvieron **200**.

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

- **`apps/desktop/vendor/THIRD_PARTY_NOTICES.md` tiene un placeholder viejo** en la sección
  "Electron" (`"MIT (placeholder — TASK-007 fills in the exact Electron version pinned by
  TASK-005 in apps/desktop/package.json)"`) que quedó de un ciclo anterior — y la web de
  Licencias lo renderiza tal cual, con números de task internos, a la vista de tus amigos. El dato
  real ya existe (`build-desktop.mjs` pinnea `ELECTRON_VERSION = '44.4.5'`, licencia MIT) — conviene
  reemplazar ese texto por algo como `"Electron 44.4.5 — MIT"` antes de publicar. No lo toqué yo
  porque ese archivo no es parte de los tasks de este ciclo (`TASK-001..004`).
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
