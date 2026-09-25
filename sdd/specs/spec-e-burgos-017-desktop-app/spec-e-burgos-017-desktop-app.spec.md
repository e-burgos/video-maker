# SPEC-e-burgos-017: Desktop App: el estudio como app de macOS autocontenida

> Estado: **completed** — registrada el 2026-09-23, cerrada el 2026-09-25. Seis ciclos `lite`; versión 0.1.0
> publicada en https://video.estebanburgos.com.ar.

## Resumen Ejecutivo

Hoy video-maker es un **estudio local para el dev**: se levanta con `pnpm studio` desde el monorepo,
depende de binarios instalados con Homebrew, de un modelo de whisper bajado a mano, del login de
Claude Code en la máquina y de un store de archivos JSON sobre `media/`. El productor conversacional
(`spec-015`) ejecuta `claude -p` con permiso para `Bash(curl *)`, `cat`, `ls` y
`pnpm nx run render-cli:*`, así que en runtime necesita el repo entero con sus `node_modules`.

Esta spec convierte ese estudio en **una app de escritorio para macOS (Apple Silicon) instalable por
un cliente**, sin Docker ni terminal:

- **Electron** empaqueta `apps/web` (build estático) y `apps/render-api` (proceso hijo), con ffmpeg,
  ffprobe, whisper-cli y piper incluidos, y descarga los modelos pesados en el primer arranque.
- **Dos motores de agente sobre el mismo set de herramientas**: el CLI `claude` del propio cliente
  (su suscripción) u OpenRouter con API key (Vercel AI SDK). Las herramientas del productor se
  exponen **una sola vez** como servidor MCP y el agente deja de tener shell.
- **SQLite** para el estado y los metadatos; el filesystem queda solo para medios binarios y los
  artefactos que el pipeline lee como archivo.
- **Interfaz centrada en el chat**: se arrastran archivos al chat y el agente propone su rol
  (A-roll, B-roll, imagen, logo, música) para que el usuario confirme.
- Se reparte **entre amigos**: `.dmg` sin firmar publicado en GitHub Releases de un repo público de distribución, con una web de documentación en GitHub Pages para descargarlo e instalarlo.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

### Pedido del dev (2026-09-23)

> "Nos olvidemos de la parte web, pensemos en correrlo siempre en la máquina local del cliente pero
> tenemos que diseñar algo más simple: que sea una app desktop con todo contenido en ella."

Se evaluó primero desplegarlo como web y se descartó: exige autenticación, multi-tenancy, sandbox
del agente, API key pagada por el operador, storage remoto y workers de render. Correr en la máquina
del cliente elimina casi todos esos problemas.

### Decisiones tomadas en la conversación de diseño

| # | Decisión | Descartado y por qué |
| --- | --- | --- |
| D-01 | **Electron** como shell | Docker: obliga a instalar Docker Desktop (virtualización, licencia paga en empresas >250 empleados). Tauri: igual necesitaría Node como sidecar para `render-api` |
| D-02 | **Solo macOS arm64** en esta spec, con código portable | Windows: suma binarios por OS, firma con certificado, CI con runners Windows, rutas partidas por `/` y whisper sin Metal (~30–40% más de empaquetado y distribución). Intel: build universal que duplica binarios |
| D-03 | Claude vía **el CLI `claude` instalado y logueado por el cliente**; la app no hace OAuth ni guarda credenciales de Claude | Login de claude.ai propio: según la documentación del Agent SDK, no está permitido a terceros sin aprobación previa |
| D-04 | Segundo motor: **OpenRouter con Vercel AI SDK**, lista curada de modelos probados | LangChain.js: más abstracción de la necesaria para un solo agente con herramientas. "Cualquier modelo": los baratos fallan en cadenas largas de tool calls |
| D-05 | Herramientas del productor como **servidor MCP** compartido por los dos motores | Definir herramientas por motor: duplica prompts y tools. Shell (`Bash(curl *)`, `cat`): superficie de prompt injection sobre la máquina del cliente |
| D-06 | **SQLite híbrido** (better-sqlite3 + Drizzle) | Todo en archivos JSON: sin consultas ni transacciones, jobs perdidos al reiniciar. Blobs en SQLite: infla la base y rompe la reproducción por rangos. Prisma: motor pesado para empaquetar. `node:sqlite`: no estable en el Node de Electron |
| D-07 | API key de OpenRouter en el **llavero del sistema** (`safeStorage`) | Texto plano en disco o en SQLite |
| D-08 | **Sin trial ni cobro**: la app se reparte entre amigos, no se vende (decisión del dev, 2026-09-23) | Trial local y pago simbólico: no hay a quién cobrarle |
| D-09 | **App sin firmar** (firma ad hoc de Electron, sin cuenta de Apple Developer): la primera apertura se habilita desde Ajustes → Privacidad y seguridad → "Abrir igual", documentado en la web de la app | Firma y notarización (USD 99/año): se suma después sin rehacer nada si la app se abre a más gente. Sin firma no hay auto-actualización en macOS: cada versión se reinstala a mano |
| D-10 | Distribución desde **este mismo repo**: web de documentación en **Cloudflare Pages** (`video.estebanburgos.com.ar`) desplegada por GitHub Actions y `.dmg` en **R2** servido por una Pages Function en `/descargas/*` (cambiado en `cycle-06` a pedido del dev; antes: repo público aparte con GitHub Releases y Pages) | Un repo público aparte: duplica mantenimiento. GitHub Releases del repo privado: los amigos necesitarían acceso. Pages no acepta el `.dmg` (límite de 25 MiB por archivo) |

Esta spec **revierte** una exclusión de `spec-015` ("ejecutar el agente con key propia: es la
suscripción o nada"): la suscripción sigue siendo el camino por defecto y la API key de OpenRouter
se suma como alternativa.

## Alcance

### Dentro

1. **Herramientas del productor como MCP**: un servidor MCP (stdio) con herramientas tipadas sobre
   `render-api` (inventario y catálogo, clasificación de assets, guion, voz, montaje, render,
   estado de jobs, lectura de la conversación). La síntesis con piper y cualquier llamada a ffmpeg
   pasan por herramientas, no por shell. Claude Code lo consume con `--mcp-config` y una lista
   blanca que **no incluye `Bash`**.
2. **Store SQLite**: proyectos (videos), carpetas y categorías, conversaciones y mensajes del
   productor, índice de assets con su rol, jobs con estado persistido y configuración. Los medios y
   los artefactos del pipeline (`catalog.json`, timeline, EDL) siguen en disco y la base guarda su
   ruta. Importador de una sola vez desde los proyectos existentes en `media/`.
3. **App Electron** (`apps/desktop`): arranca `render-api` como proceso hijo, sirve el build de
   `apps/web`, resuelve los binarios desde un manifiesto por plataforma, usa la carpeta de datos de
   la app como `mediaRoot` y ubicación de la base, descarga en el primer arranque los modelos
   (whisper, voces de piper) y el `chrome-headless-shell` de Remotion con verificación de tamaño y
   hash, y detecta el CLI `claude` guiando su instalación y login si falta.
4. **Motor OpenRouter**: runtime del productor sobre Vercel AI SDK que consume el mismo servidor
   MCP; selección de motor y modelo en la configuración; API key en el llavero.
5. **Interfaz nueva centrada en el chat**: chat a la izquierda, vista previa del video y del
   material a la derecha, arrastrar y soltar archivos al chat con propuesta de rol confirmable.
6. **Distribución entre amigos**: `.dmg` sin firmar para Apple Silicon generado con un comando, publicado como release en un repo público de distribución, y una web de documentación en GitHub Pages (requisitos, instalación, cómo habilitar la primera apertura, cómo conectar Claude u OpenRouter, guía de uso) con el botón de descarga.

### Fuera

- Windows, Linux y Macs Intel (el código queda portable; el empaquetado no).
- Despliegue web, multi-usuario, autenticación o cualquier servidor remoto propio.
- Trial, cobro, cuentas de usuario, firma, notarización y auto-actualización.
- Cambiar el motor de edición: el pipeline, la composición y la mezcla no cambian de comportamiento.
- Migrar los artefactos del pipeline (`catalog.json`, timeline, EDL) a SQLite.

## Plan de ciclos

| Ciclo | Alcance | Subproyectos |
| --- | --- | --- |
| `cycle-01` | Servidor MCP de herramientas del productor; `claude -p` pasa a `--mcp-config` sin `Bash` | `libs/producer-tools` (nuevo), `apps/render-api` |
| `cycle-02` | Store SQLite detrás de los puertos actuales, jobs persistidos, importador desde `media/` | `libs/local-store` (nuevo), `apps/render-api` |
| `cycle-03` | Shell Electron: `render-api` embebido, build de la web, manifiesto de binarios, descarga de modelos en el primer arranque, detección del CLI `claude` | `apps/desktop` (nuevo), `apps/render-api`, `apps/web` |
| `cycle-04` | Motor OpenRouter sobre Vercel AI SDK consumiendo el mismo MCP; configuración de motor, modelo y API key | `libs/producer-tools`, `apps/render-api`, `apps/desktop`, `apps/web` |
| `cycle-05` | Interfaz centrada en el chat, arrastrar y soltar con clasificación de assets | `apps/web` |
| `cycle-06` | Distribución entre amigos: script de release, repo público de distribución, web de documentación en GitHub Pages y avisos de licencias de terceros | `apps/desktop`, `apps/docs-site` (nuevo) |

El orden es deliberado: `cycle-01` quita el shell del agente y define el contrato que usan
`cycle-04` y `cycle-05`; `cycle-02` es independiente de Electron y se puede probar con `pnpm studio`.

## Requisitos Funcionales

- **RF-17-001 — Herramientas en un solo lugar.** Toda acción que el productor ejecuta sobre un
  proyecto es una herramienta del servidor MCP con input validado por schema. Ningún motor define
  herramientas propias.
- **RF-17-002 — Agente sin shell.** La lista blanca con la que se lanza `claude -p` no contiene
  `Bash` ni herramientas de lectura fuera de la carpeta del proyecto. Un prompt que pida leer un
  archivo fuera del proyecto o hacer un request a un host externo no tiene herramienta con qué
  cumplirlo.
- **RF-17-003 — Paridad de motores.** El mismo pedido sobre el mismo proyecto produce, con
  cualquiera de los dos motores, la misma secuencia de herramientas invocables y el mismo formato
  de conversación persistida.
- **RF-17-004 — Estado en SQLite.** Proyectos, carpetas, categorías, conversaciones, índice de
  assets, jobs y configuración se leen y escriben en la base. Ningún medio binario se guarda en la
  base.
- **RF-17-005 — Jobs que sobreviven al cierre.** Si la app se cierra con un job en curso, al volver
  a abrirla el job figura como interrumpido y se puede relanzar; nunca desaparece.
- **RF-17-006 — Migración sin pérdida.** El importador lleva a la base todos los proyectos, la
  organización y las conversaciones existentes en `media/` sin modificar los archivos de origen, y
  se puede correr dos veces sin duplicar nada.
- **RF-17-007 — Instalación sin terminal.** Un usuario con una Mac Apple Silicon instala el `.dmg`,
  abre la app y llega al chat sin instalar nada por consola, salvo el CLI `claude` si elige ese
  motor.
- **RF-17-008 — Primer arranque verificable.** La descarga de modelos muestra progreso, se puede
  reanudar y valida tamaño y hash; un archivo truncado nunca queda marcado como listo.
- **RF-17-009 — Motor disponible y declarado.** La app informa qué motores están listos (CLI
  `claude` encontrado y logueado; API key de OpenRouter cargada) y no deja iniciar un turno con un
  motor que no lo está.
- **RF-17-010 — Secretos fuera del disco.** La API key de OpenRouter se guarda solo en el llavero
  del sistema y nunca aparece en la base, en logs ni en payloads de la API.
- **RF-17-011 — Arrastrar y clasificar.** Soltar uno o varios archivos en el chat los sube al
  proyecto; el agente propone un rol por archivo a partir de sus metadatos (duración, resolución,
  presencia de audio, canal alfa, nombre) y el rol se persiste solo cuando el usuario lo confirma.
- **RF-17-012 — Descarga e instalación documentadas.** La web de documentación ofrece el `.dmg` de la última versión y explica, con capturas, cómo abrirlo la primera vez sin firma; un amigo con una Mac Apple Silicon limpia llega al chat siguiendo solo esa página.
- **RF-17-013 — Avisos de licencias.** La app y la web incluyen los avisos de licencia de cada binario, modelo y voz de terceros que se distribuyen (ffmpeg GPL con `libx264`, whisper.cpp, piper y cada voz, Remotion).

## Riesgos y temas a validar antes de distribuir

| Riesgo | Qué hacer | Cuándo |
| --- | --- | --- |
| Uso de la suscripción de Claude desde una app de terceros | Cada amigo usa su propio CLI `claude` logueado en su máquina, sin uso comercial; se vuelve a evaluar si la app se abre al público | Si se publica |
| Licencia de Remotion | Uso personal y no comercial: licencia gratuita; se vuelve a evaluar si se publica | Si se publica |
| ffmpeg es GPL (el pipeline usa `libx264`) | Distribuir la build estática con su aviso de licencia y el link a su código fuente (encontrado al abrir `cycle-03`) | `cycle-03` |
| Licencias de las voces de piper | Revisar voz por voz; excluir las no comerciales | `cycle-03` |
| Tamaño y descarga de modelos (~0,6 GB de whisper más voces y Chromium) | Descarga reanudable con verificación | `cycle-03` |
| better-sqlite3 es nativo | Recompilar para Electron con `@electron/rebuild` en el build | `cycle-02`/`cycle-03` |
| Calidad de tool calling en OpenRouter | Lista curada, probada con un smoke real por modelo | `cycle-04` |
| Primera apertura sin firma | Documentada paso a paso en la web, con capturas | `cycle-06` |
| Repo público de distribución | Crearlo lo confirma el dev en `cycle-06` antes de publicar nada | `cycle-06` |

## Criterios de Aceptación

Cada ciclo fija los suyos en `cycles/cycle-XX/plan.md`. La spec cierra cuando:

1. Una Mac Apple Silicon limpia descarga el `.dmg` desde la web de documentación, lo abre siguiendo sus instrucciones, completa el primer arranque y produce un
   MP4 desde el chat **con cada uno de los dos motores**, usando material arrastrado al chat.
2. Un prompt de inyección sobre el productor que pide leer `~/.ssh` o hacer un request a un host
   externo termina sin haber ejecutado ninguna de las dos cosas, con evidencia en el log del turno.
3. Los proyectos existentes en `media/` aparecen en la app después de la importación, con su
   organización y sus conversaciones.
