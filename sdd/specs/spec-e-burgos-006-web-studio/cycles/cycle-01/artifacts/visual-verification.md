# Verificación visual real — spec-e-burgos-006 cycle-01 (CA-010)

> Ejecutada el 2026-09-09 contra `apps/render-api` corriendo de verdad. No es un procedimiento
> documentado: las tres capturas de este directorio salieron de esta corrida.

## Por qué no se usó el MCP de Playwright

Las tools `mcp__plugin_everything-claude-code_playwright__*` de este harness hablan con un browser
real a través de la extensión **Playwright MCP Bridge**, que no está instalada en esta máquina:
toda llamada (`browser_resize`, `browser_navigate`) responde
`Error: Extension connection timeout`. La verificación se hizo con la **misma librería Playwright**
ya cacheada en la máquina (`/Users/macbookprom2/.npm/_npx/705bc6b22212b352/node_modules/playwright`)
manejada desde un script de Node en el scratchpad, **sin agregar nada a `package.json`** (RNF-1).

Ese build de Playwright espera `chromium_headless_shell-1217`, que no está en
`~/Library/Caches/ms-playwright`; el lanzamiento usa `chromium.launch({ channel: 'chrome' })`, es
decir el Google Chrome instalado. Es el flag que hay que conservar en cualquier corrida futura.

## Guion (copiable)

```bash
# 0. ningún proceso pesado vivo
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'          # sin salida

# 1. el servicio, contra el media root real (4310 lo ocupa `pnpm sdd:docs` en esta máquina)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. la app, con el proxy apuntado al servicio
WEB_PORT=4207 RENDER_API_URL=http://127.0.0.1:4399 \
  pnpm exec vite --config apps/web/vite.config.ts &

# 3. el proxy resuelve same-origin (D-4)
curl -s http://localhost:4207/api/projects

# 4. capturas
node <scratchpad>/capture.mjs sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-01/artifacts
```

Para el camino de escritura se reinició el servicio con `RENDER_API_MEDIA_ROOT="$(mktemp -d)"` —
`media/` del dev **no se tocó** (`git status --short media/` vacío, `ls media/` con los tres
proyectos originales), y el directorio temporal se borró al terminar.

## Qué probó, medido

### `projects-page.png` — servicio real, `media/` real

| Comprobación | Valor observado |
| --- | --- |
| Badge de salud (EP-001) | `service ok · cycle 3` |
| Proyectos listados (EP-002) | `smoke-ingest`, `video-01`, `video-02` |
| Flags de layout | `smoke-ingest` con los cinco en verde; `video-01`/`video-02` con los cinco apagados |

### `asset-library-smoke-ingest.png` — los assets se reproducen de verdad

| Comprobación | Valor observado |
| --- | --- |
| `source` del listado (EP-005) | `catalog` |
| `src` de los `<video>` | `/api/projects/smoke-ingest/files/raw/aroll/clip01.mp4`, `.../raw/broll/clip01.mp4` |
| `src` del `<img>` | `/api/projects/smoke-ingest/files/raw/images/photo01.jpg` |
| `src` del `<audio>` | `/api/projects/smoke-ingest/files/raw/audio/music01.mp3` |
| **`<video>` decodificado por Chrome** | `readyState: 4` en los dos; `duration` 22.5 s y 5 s; `videoWidth×videoHeight` 1280×720 en ambos |
| Requests con status ≥ 400 | ninguna |

`readyState: 4` (`HAVE_ENOUGH_DATA`) con la duración y las dimensiones reales es la evidencia de
que `EP-011` sirvió bytes decodificables a través del proxy: no alcanza con que el `src` esté bien
escrito. Es la misma ruta que va a consumir el `<Player>` de `cycle-02`.

### `asset-upload-studio-smoke.png` — el camino de escritura (media root temporal)

| Comprobación | Valor observado |
| --- | --- |
| Store vacío (EP-002) | `No projects yet.` |
| Slug inválido rechazado en el cliente (RF-6) | `Not_A_Slug` → `A slug is one lowercase kebab-case segment…`, **sin request al servicio** |
| Creación (EP-003) | `studio-smoke` aparece en el listado sin recargar |
| `source` antes del upload | `raw-scan` |
| Upload (EP-006) | `stored raw/aroll/clip01.mp4` |
| `source` después del upload | `catalog` — el catálogo quedó consistente **en la misma request** (spec-005 D-15) |
| Datos del asset subido | `201.2 kB · video · 1280×720 · 0:23 · 30 fps · aac 1ch` (ffprobe real) |
| Upload repetido | `ASSET_ALREADY_EXISTS` en pantalla; único status ≥ 400 de la corrida (`409 PUT …/assets/aroll/clip01.mp4`), y deliberado |

## Nota sobre un 404 no reproducido

La primera corrida de captura registró un `console.error` genérico
(`Failed to load resource: … 404`) sin URL. Una segunda corrida con listener de `response` sobre
las dos páginas devolvió **cero** respuestas ≥ 400. Hipótesis: `/favicon.ico`, que `index.html` no
declara. Ninguna request de la aplicación falla; queda anotado por honestidad, no como defecto
abierto.
