# spec-e-burgos-017-desktop-app — cycle-05 · plan (lite)

> Módulo: desktop-app | Subproyectos: apps/web, apps/render-api, libs/local-store, libs/producer-tools,
> apps/desktop | Fecha: 2026-09-24
> Flow: **lite** — perfil `solo`. El dev pidió avanzar sin esperar su aprobación ("hacé lo que más puedas
> sin mi ayuda"): este plan lo decide el orquestador y se ejecuta directo; lo irreversible sigue frenado.
> Objetivo: que usar el estudio sea **hablar con el productor y arrastrarle el material**. Cada proyecto
> pasa a ser un solo espacio de trabajo; las pantallas de edición avanzada siguen existiendo, pero dejan
> de ser el camino principal.
> Fuera de alcance: cambiar el motor, las recetas o el pipeline; el repo público y la web de
> documentación (`cycle-06`).

## Estado actual

Un proyecto se reparte en cinco pantallas (`producer`, `library`, `storyboard`, `voice`, `preview`) con una
barra de navegación. Para subir material hay que ir a la biblioteca, elegir un rol entre seis tarjetas y
usar el input de archivos nativo ("Choose File", en inglés). El QA de `cycle-03` y los ciclos siguientes
dejaron pendientes: descripciones de voz sin traducir, 404 especulativos en storyboard y voz, y el chunk
inicial en 533,9 kB.

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C5-01 | **Espacio de trabajo único** en `/projects/:slug`: chat a la izquierda (60%), panel a la derecha con pestañas **Vista previa** (último render o la timeline en el player), **Material** (assets por rol, compactos) y **Entregas** (renders con descarga) | Es lo que la spec pide (US de interfaz centrada en el chat). El panel acompaña lo que el productor va haciendo sin sacar al usuario de la conversación |
| D-C5-02 | Las pantallas actuales quedan como **"Edición avanzada"** (menú del espacio de trabajo), sin borrarlas | Tienen editores que el chat no reemplaza (trim, captions, niveles de música) y tests E2E que las cubren; borrarlas sería perder funciones |
| D-C5-03 | **Bandeja de entrada** `raw/inbox/`: lo que se arrastra entra ahí; el pipeline no la lee | Un archivo sin rol confirmado no puede terminar en un montaje por accidente |
| D-C5-04 | La **propuesta de rol es determinista** y la calcula `render-api` con `ffprobe`: video con voz → A-roll; video sin audio o con audio sin voz → B-roll; imagen con canal alfa → logo; otra imagen → imagen; audio largo sin voz → música; audio con voz → voz. El nombre del archivo desempata | Rápida, gratis, sin gastar tokens y sin depender del motor; el productor la ve y puede opinar en la conversación |
| D-C5-05 | Nueva tabla `assets` en `local-store` (migración 3): ruta, rol propuesto, rol confirmado, estado (`pending` / `confirmed`), resumen del probe | Es el índice de assets que `cycle-02` dejó para acá (D-C2-04): nace con un consumidor real |
| D-C5-06 | Confirmar **mueve** el archivo de `raw/inbox/` a `raw/<rol>/` (dentro del proyecto) y actualiza el catálogo como hoy lo hace un upload | Una sola verdad para el pipeline: las carpetas de rol |
| D-C5-07 | `get_project_overview` suma `pendingAssets` (aditivo); el prompt le dice al productor que pida confirmación de lo pendiente antes de producir | El agente no produce con material sin confirmar |
| D-C5-08 | Diseño visual: el mismo Tailwind actual, con tokens de color y espaciado centralizados y componentes consistentes (botones, tarjetas, badges, pestañas); nada de librerías de UI nuevas | Mantiene el bundle y la licencia simples |

## Historias

- **US-017-401 — Arrastrar al chat.** CA: soltar uno o varios archivos sobre el chat (o usar el botón de
  adjuntar) los sube a `raw/inbox/` con progreso por archivo; un archivo de un tipo no soportado se rechaza
  con el motivo; no hay ningún input de archivos nativo visible.
- **US-017-402 — Proponer y confirmar el rol.** CA: cada archivo subido muestra una tarjeta con la miniatura,
  duración/resolución y el rol propuesto con su razón ("tiene voz", "tiene transparencia"); el usuario
  confirma o elige otro rol; recién ahí el archivo pasa a `raw/<rol>/` y aparece en Material; el productor ve
  los pendientes en `get_project_overview`.
- **US-017-403 — Un solo espacio de trabajo.** CA: abrir un proyecto muestra el chat y el panel lateral; las
  pestañas se actualizan cuando el productor termina un job (montaje → Vista previa; render → Entregas); la
  edición avanzada está a un clic; en una ventana angosta el panel pasa abajo del chat.
- **US-017-404 — Pendientes de interfaz.** CA: las voces se describen en el idioma de la interfaz; las páginas
  de storyboard y voz no generan 404 en la consola para documentos que todavía no existen; el inicio permite
  crear un proyecto soltando un video.
- **US-017-405 — Web liviana.** CA: el chunk inicial queda por debajo de 500 kB sin el aviso de Vite.

## Tasks (detalle en tasks.json)

- **TASK-001** — Bandeja de entrada, propuesta de rol y tabla `assets`.
- **TASK-002** — Espacio de trabajo centrado en el chat.
- **TASK-003** — Arrastrar y soltar al chat con tarjetas de propuesta.
- **TASK-004** — Inicio y pendientes de interfaz.
- **TASK-005** — Chunk inicial por debajo de 500 kB.
- **TASK-006** — Verificación real (navegador y app empaquetada, con revisión visual).
- **TASK-007** — Cierre.

## Verificación

- `pnpm nx run-many -t lint test build` en verde, cobertura ≥ 80%, sin aviso de chunk de 500 kB.
- **E2E en el navegador** (Playwright, patrón de `apps/web/e2e/`): crear un proyecto soltando una grabación;
  soltar un logo con transparencia, una foto y una pista de música; confirmar las propuestas (una cambiando el
  rol); comprobar en disco que cada archivo quedó en `raw/<rol>/`; un turno barato del productor con OpenRouter
  (DeepSeek, US$ < 0,02) preguntando qué material hay, que tiene que listar lo confirmado.
- **QA visual** de la app empaquetada: capturas por CDP del inicio, el espacio de trabajo con chat y panel,
  las tarjetas de propuesta, la edición avanzada y Configuración, en español; el orquestador las revisa y lo
  que se vea mal se corrige dentro del ciclo.

## Riesgos del ciclo

| Riesgo | Mitigación |
| --- | --- |
| La heurística propone mal el rol de un archivo | El usuario siempre confirma; la tarjeta muestra la razón y permite cambiarlo; el productor también lo ve |
| Detectar "voz" en un audio o video sin transcribir | Primera versión: presencia y nivel de audio por `ffprobe` más el nombre; si hace falta, una pasada corta de whisper sobre los primeros segundos (queda medida en TASK-001) |
| Romper los E2E de las pantallas actuales | Se mantienen como edición avanzada; sus E2E se corren en TASK-006 |
| El chunk no baja de 500 kB con cambios chicos | TASK-005 mide primero con el análisis de Vite y ataca lo más grande (catálogo inglés ansioso, cliente, Remotion player fuera del chunk inicial) |

## Pendiente de documentar en contexto

- **TASK-001** tocó `libs/auto-montage` (`src/index.ts` + `discover-assets.spec.ts`), un subproyecto que no
  estaba en la lista `apps` de este ciclo. Cambio aditivo y de bajo riesgo: exporta `mediaKindForExtension` e
  `isSupportedExtension` (ya existían y estaban testeados en `ingest/supported-extensions.ts`, solo faltaba el
  export público) para que `apps/render-api` valide la extensión de un archivo dropeado antes de invocar
  `ffprobe` (`UNSUPPORTED_MEDIA_TYPE`, EP-042). Se agregó además un test que fija que `raw/inbox/` se ignora
  como `unknown-directory` en `discoverAssets` (ya era el comportamiento, ahora está bloqueado explícitamente).
  Ningún contrato de `auto-montage` cambió de forma incompatible. El reviewer debería sumar `libs/auto-montage`
  a la fila de subproyectos tocados en el cierre del ciclo si `sdd/context/constitution.md` lo exige.
- Se extrajo `apps/render-api/src/store/ingest-asset-into-catalog.ts` (probe + merge de catálogo) desde
  `assets-handler.ts` para reusarlo tal cual en el confirm del inbox (`asset-inbox-handler.ts`), sin duplicar
  la lógica de probe-failure. Es un refactor interno del subproyecto, no un patrón nuevo a documentar aparte.
