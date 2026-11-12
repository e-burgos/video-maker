# Plan: plugin Video Maker para cualquier proyecto

> 2026-11-12 · estado: **aprobado** · rama `feat/video-maker-plugin`

## Objetivo

Abrir **cualquier** repo (una API, una librería, una app móvil, un e-commerce, un backoffice), instalar un plugin y pedir «hacé un video de esto». Video Maker tiene que entender qué es el proyecto, armar la marca, elegir el tipo de video, preparar el material y entregarlo. El usuario solo confirma las decisiones y publica.

Hoy no se puede, por cuatro razones:

| Hueco | Dónde |
|---|---|
| La app de escritorio arranca la API en un puerto libre y con un token aleatorio por sesión. Ningún otro repo sabe dónde está ni cómo autenticarse. | `apps/desktop/src/main/main.ts:341`, `free-port.ts` |
| El MCP del studio exige `--project` y no puede crear proyectos, subir material ni manejar marcas. Solo opera dentro de un video que ya existe. | `libs/producer-tools/src/mcp/studio-mcp-cli-args.ts` |
| Las skills para externos están atrasadas: el contrato es del 28/10 y no menciona SFX, bumpers por piezas, `textOverlays`, `titleStyle` ni `musicFrom`. Además están atadas a Display Ads. | `sdd/skills/video-maker-material-contract`, `screen-recording-tutorial` |
| No hay forma de distribuirlas. Se comparten con un symlink a mano, y display-ads mantiene copias propias que se contradicen con estas. | `display-ads/.claude/skills/` |

## Arquitectura

```
cualquier repo
  └─ plugin "video-maker" (skills + MCP)
        │  lee ~/.video-maker/studio.json  →  { apiUrl, token }
        ▼
  MCP video-maker (npx @e-burgos/video-maker-mcp)
        │  HTTP + x-studio-token
        ▼
  render-api  ←  la app de escritorio instalada  o  `pnpm studio` de este repo
```

## Fases

### F1 · El studio se puede descubrir
- La app de escritorio y `pnpm studio` escriben `~/.video-maker/studio.json` al arrancar, con permisos `0600`. Contiene `apiUrl`, `token`, `version`, `source` (`desktop` o `dev`) y `pid`. Lo borran al cerrar.
- Si el archivo quedó viejo, se detecta con `GET /health` y el `pid`.
- Con la app y el studio de desarrollo corriendo a la vez, gana el que el usuario elija (`VIDEO_MAKER_API_URL` lo fuerza). Por defecto gana la app instalada.
- `GET /health` devuelve también la versión de la API y las capacidades del motor, para que el MCP avise si el plugin y el studio no coinciden.

### F2 · Un MCP para usar desde afuera
- `--project` pasa a ser opcional. Las tools reciben `slug`, y el MCP interno del productor sigue fijo en su proyecto como hasta ahora.
- **Tools nuevas:**
  - `studio_status`
  - `list_projects`
  - `create_project`
  - `upload_asset`: toma un archivo local del repo que lo usa y lo sube a `PUT /projects/:slug/assets/:role/:filename`.
  - `list_brands`, `get_brand`, `create_brand`, `update_brand`, `upload_brand_file`
  - `get_capabilities`: qué presets, transiciones, bumpers, efectos de sonido, estilos de título y voces hay.
- Se reusan las tools que ya existen: brief, storyboard, jobs, `wait_for_job`, review, timeline y música.
- **Quedan afuera del MCP externo:** `queue_publication` y `DELETE`. Publicar y borrar los hace siempre el usuario desde el studio.
- **Distribución:** paquete npm `@e-burgos/video-maker-mcp`. Ya hay un bundle de esbuild en `dist/libs/producer-tools/mcp/main.js`. El plugin lo arranca con `npx -y @e-burgos/video-maker-mcp`.

### F3 · Skills genéricas
Viven en `plugins/video-maker/skills/` y no suponen nada del proyecto que las usa.

| Skill | Qué hace |
|---|---|
| `video-maker` (puerta de entrada) | 1) Busca el studio con `studio_status`; si no hay, explica cómo instalar la app. 2) Lee el proyecto: README, docs, `package.json` o equivalente, logo, colores (CSS, Tailwind, manifest, theme) y si tiene una UI web que se pueda grabar. 3) Traduce el pedido a un tipo de video (tutorial grabado o motion) con una tabla de decisión. 4) Llama a la skill que corresponde. 5) Muestra el storyboard o la revisión antes de renderizar. |
| `video-maker-brand` | Saca la marca de cualquier repo: nombre, nombre hablado, eslogan, paleta de 4 colores con contraste medido, logo con alfa, tipografías, tono, voz y banco de música. La propone, espera el OK y la crea. Reutiliza la marca si ya existe una con el mismo id. |
| `video-maker-motion-brief` | Brief para cualquier tema: guion, escenas e imágenes descriptas, más el catálogo de lo que el motor sabe hacer hoy (sale de F4). Incluye ejemplos para un proyecto sin UI: API, librería, CLI, servicio. |
| `video-maker-screen-capture` | Graba cualquier UI web con Playwright: URL base, archivo de pasos (`flow.mjs`) y marcas `hito()` para el guion cronometrado. El login va por variables del repo, nunca escrito en el archivo. Si el repo no tiene UI web, explica cómo entregar una grabación propia. El script viaja dentro de la skill; se toma la lib actual y se le saca todo lo de Display Ads. |
| `video-maker-raw-material` | Material propio (clips, fotos, locución, música, logo): roles, nombres, specs, formatos 16:9 y 9:16, y licencias de lo que se baja de bancos libres. |

`video-producer` y `motion-studio` siguen siendo internas del studio y no viajan en el plugin.

### F4 · Referencias generadas y test contra el atraso
- Un script genera las tablas de campos de `references/` desde los schemas reales:
  - `timeline.schema.json`, que ya se genera con `nx run timeline-core:schemas`;
  - el storyboard, de zod a JSON Schema;
  - el brief;
  - `brand.json`. Hoy no tiene schema propio: hay que confirmar si ya hay uno de zod en el módulo de manifiesto de marca, y si no, crearlo.
- El catálogo de capacidades (transiciones, revelados, efectos, `titleStyle`) sale de las mismas constantes que usa el motor, no de una lista escrita a mano.
- Un test de Nx falla si lo generado no coincide con lo commiteado, o si una skill nombra un campo entre backticks que no existe en ningún schema.

### F5 · Empaquetado
- `.claude-plugin/marketplace.json` en la raíz del repo, con un plugin `video-maker` cuya fuente es `./plugins/video-maker`. Ahí van `plugin.json`, `.mcp.json`, `skills/` y `README.md`.
- Las versiones del plugin y del MCP van juntas, con un script de release que sube las dos y publica en npm.
- Instalación en cualquier repo:
  ```
  /plugin marketplace add e-burgos/video-maker
  /plugin install video-maker@video-maker
  ```

### F6 · Migración
- `sdd/skills/video-maker-material-contract` queda como redirección al plugin durante una versión y después se borra.
- display-ads borra `video-maker-request`, `platform-video-capture` y su symlink, e instala el plugin. Ese cambio va en una PR de display-ads.

### F7 · Validación de punta a punta (sin publicar)
En dos repos de prueba vacíos de este proyecto, con el plugin instalado desde la ruta local:
1. **Una librería o CLI sin UI** → motion. Tiene que crear la marca desde el repo, escribir el brief y llegar al storyboard.
2. **Una app web chica** → tutorial grabado. Tiene que grabar con `flow.mjs`, subir el material y llegar a la revisión.

Las dos pruebas corren contra la app instalada y contra `pnpm studio`. Nada se publica.

## Orden y paralelismo

| Paso | Depende de | Se puede en paralelo con |
|---|---|---|
| F1 descubrimiento | — | F4 |
| F2 MCP externo | F1 | F3 (si el contrato de tools de F2 se fija primero) |
| F3 skills | contrato de F2 y F4 | F2 |
| F4 referencias | — | F1 |
| F5 empaquetado | F2 y F3 | — |
| F6 migración | F5 | — |
| F7 validación | F5 | — |

Se registra como fixes del FIX GATE, uno por fase, todo en una sola rama y una sola PR al final.

## Decisiones (aprobadas el 2026-11-12)

1. El marketplace vive en este repo, en `plugins/video-maker/`. Si la instalación se vuelve pesada, se pasa a un repo chico.
2. El cuerpo de las skills va en inglés, y la skill le habla al usuario en su idioma.
3. El MCP se publica en npm como `@e-burgos/video-maker-mcp`.
4. Por ahora solo Claude Code.

## Prueba de oro: display-ads

La prueba final la hace display-ads, y antes tiene que quedar sin skills de video propias (F6):
- borra `video-maker-request`, `platform-video-capture` y el symlink a `video-maker-material-contract`;
- instala el plugin genérico.

Con eso solo, un agente abierto en display-ads tiene que producir un **video de venta de Display Ads para un local comercial**: pantallas en vidriera o en el local, campañas y resultados. Tiene que hacerlo usando únicamente el plugin, sin conocimiento previo de cómo funciona Video Maker.

El criterio es que llegue a un render que pase la review y que el dev lo apruebe. Nada se publica sin la orden del dev.
