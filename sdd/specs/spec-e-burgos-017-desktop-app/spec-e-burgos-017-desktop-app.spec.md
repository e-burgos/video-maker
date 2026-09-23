# SPEC-e-burgos-017: Desktop App: el estudio como app de macOS autocontenida

> Estado: **in-progress** — registrada el 2026-09-23. `cycle-01` abierto el 2026-09-23, flow `lite`
> (`profile: solo`), con el contrato MCP que consumen los ciclos siguientes congelado en su `plan.md`.

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
- Distribución firmada y notarizada, con un **trial**; el pago queda fuera de esta spec.

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
| D-08 | **Trial** local; el pago simbólico queda para una spec posterior | Cobro dentro de esta spec |

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
6. **Distribución**: build firmada y notarizada (`.dmg`), auto-actualizaciones y trial local.

### Fuera

- Windows, Linux y Macs Intel (el código queda portable; el empaquetado no).
- Despliegue web, multi-usuario, autenticación o cualquier servidor remoto propio.
- Cobro, cuentas de usuario y verificación de licencias contra un servidor.
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
| `cycle-06` | Firma, notarización, auto-actualizaciones y trial | `apps/desktop` |

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
- **RF-17-012 — App firmada.** El `.dmg` está firmado y notarizado: Gatekeeper lo abre sin avisos.
- **RF-17-013 — Trial.** La app registra la fecha del primer arranque y, vencido el período de
  prueba, bloquea iniciar nuevos renders y turnos del productor sin borrar ni ocultar los proyectos
  del usuario.

## Riesgos y temas a validar antes de distribuir

| Riesgo | Qué hacer | Cuándo |
| --- | --- | --- |
| Uso de la suscripción de Claude desde una app de terceros | Confirmar contra los términos vigentes de Anthropic; validar con Compliance (Ariel Presta) | Antes de `cycle-06` |
| Licencia comercial de Remotion | Confirmar la licencia que corresponde a distribuir la app | Antes de `cycle-06` |
| ffmpeg GPL vs LGPL | Empaquetar una build LGPL o asumir las obligaciones de la GPL | `cycle-03` |
| Licencias de las voces de piper | Revisar voz por voz; excluir las no comerciales | `cycle-03` |
| Tamaño y descarga de modelos (~0,6 GB de whisper más voces y Chromium) | Descarga reanudable con verificación | `cycle-03` |
| better-sqlite3 es nativo | Recompilar para Electron con `@electron/rebuild` en el build | `cycle-02`/`cycle-03` |
| Calidad de tool calling en OpenRouter | Lista curada, probada con un smoke real por modelo | `cycle-04` |
| Trial evitable (es local) | Aceptado para un trial; la verificación remota va con la spec de pago | `cycle-06` |
| Cuenta de Apple Developer (USD 99/año) | Alta a cargo del dev | Antes de `cycle-06` |

## Criterios de Aceptación

Cada ciclo fija los suyos en `cycles/cycle-XX/plan.md`. La spec cierra cuando:

1. Una Mac Apple Silicon limpia instala el `.dmg` firmado, completa el primer arranque y produce un
   MP4 desde el chat **con cada uno de los dos motores**, usando material arrastrado al chat.
2. Un prompt de inyección sobre el productor que pide leer `~/.ssh` o hacer un request a un host
   externo termina sin haber ejecutado ninguna de las dos cosas, con evidencia en el log del turno.
3. Los proyectos existentes en `media/` aparecen en la app después de la importación, con su
   organización y sus conversaciones.
