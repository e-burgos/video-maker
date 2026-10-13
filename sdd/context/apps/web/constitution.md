# Constitución — apps/web

> Versión 3.0 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** app React 19 (SPA local, mono-usuario, sin auth ni despliegue)
- **Rol en el sistema:** el Web Studio — la interfaz con la que el dev opera el motor desde el
  navegador de su propia máquina. La pantalla principal de un proyecto es un **workspace centrado
  en el chat** (`/projects/:slug`): la conversación con el productor a la izquierda (recetas de
  arranque tipo "Tutorial", archivos que se arrastran al chat o se adjuntan y llegan como tarjeta
  de propuesta de rol) con un panel lateral de pestañas **Vista previa · Material · Entregas** que
  cambia solo al terminar un montaje o un render. Las pantallas previas siguen existiendo como
  **"Edición avanzada"**: biblioteca de assets (con borrado y la sección Generated), **storyboard
  generativo** (con modo de sólo lectura cuando el proyecto se narró desde un guion), **voz**
  (síntesis por escena, locución propia o modo guion), y el preview de la `Timeline` en el
  `<Player>` de Remotion con edición del documento persistido (trim y orden de clips, captions con
  estilo elegible, música, preset de salida, logo con tamaño/opacidad y bumpers de inicio/fin) y
  disparo, seguimiento, **reintento** y descarga de renders locales. El inicio (`/`) lista videos
  en tarjetas con miniatura y una zona para crear uno soltando un archivo; `/settings` (perezosa)
  configura el motor del productor (Claude Code u OpenRouter) y su modelo. **Toda la interfaz está
  en español (default) e inglés** (`src/i18n/`), con una ruta `/guide` que la explica en los dos
  idiomas.
- **No tiene lógica de motor ni toca el filesystem.** Todo lo que muestra y todo lo que escribe
  pasa por los endpoints de `apps/render-api` (`sdd/api.json` → `EP-001`..`EP-025`), su único
  backend. Si hace falta un cálculo, vive en una lib o en la API, nunca acá.

## 2. Stack tecnológico

- React 19 + `react-router-dom` 7 + Tailwind CSS 4 (`@tailwindcss/vite`), Vite 8
- Vitest 4 + jsdom + `@testing-library/react` / `@testing-library/dom`, cobertura `@vitest/coverage-v8`
- **`@testing-library/user-event` NO está instalado**: los tests de interacción usan `fireEvent`.
  No agregarlo sin un motivo que `fireEvent` no cubra.
- **Una sola dependencia npm propia: `@remotion/player@4.0.522`**, y tiene que ser la **versión
  exacta** de `remotion` — comparte el contexto interno de Remotion y una versión distinta rompe en
  runtime sin error de tipos. Todo lo demás sale del manifiesto raíz.
- Libs de workspace: `@video-maker/composition-remotion` y `@video-maker/timeline-core`.
- **`playwright` nunca entra al `package.json`**: los guiones de `apps/web/e2e/` lo resuelven por
  `import('playwright')` y, si falla, recorriendo `~/.npm/_npx` sin hash hardcodeado. Requiere un
  `npx playwright install` una vez por máquina.
- Tags Nx: `["scope:studio", "type:app"]`; targets `dev`, `build`, `preview`, `lint`,
  `test` (`vitest run --coverage`, jsdom, piso 80 %)

## 3. Estructura y patrones

```
src/
  api/          frontera con render-api: tipos del contrato, cliente tipado, superficie de errores,
                artifact-url (+ servicePathUrl), project-slug, asset-media-kind, asset-roles,
                asset-path, clipboard, RenderApiProvider, error-explanations, blockers (Blocker),
                parse-timeline · player-timeline · preview-format,
                render-api-types · parse-render-job · render-job-poll-plan · render-job-artifact,
                montage-capability · montage-presets,
                generated-files · parse-generated,
                parse-storyboard · storyboard-capability · storyboard-edit/,
                parse-voice · voice-capability · parse-voice-script · voice-script-lines,
                parse-producer · producer-capability · producer-markdown · producer-turn-poll-plan ·
                producer-recipes · producer-recipe-prompts · producer-model-i18n · producer-engine-i18n ·
                producer-cost-format · parse-producer-settings,
                storyboard-capability (`AGENT_FAILURE_CODES` incluye `OPENROUTER_KEY_MISSING` y
                `OPENROUTER_FREE_QUOTA_EXHAUSTED`),
                voice-i18n (etiquetas de voz con `Intl.DisplayNames`), project-status,
                timeline-edit/  (toda la máquina de edición: reglas, layout de a-roll,
                                rescale de automation, presets, severidad,
                                logo-overlay, logo-bumpers, caption-style, reducer)
  i18n/         messages-en (fuente de verdad tipada) · messages-es (lazy) · translate ·
                language-context · language (`DEFAULT_LANGUAGE = 'es'`) · literal-copy-scan
  guide/        guide-content-en · guide-content-es · guide-content (selector por idioma)
  hooks/        useAsyncResource (único primitivo de estado de servidor) · use-api-action ·
                use-render-job-poll · use-producer-turn-poll · use-producer-conversation ·
                use-inbox-uploads · use-stick-to-bottom · use-auto-switching-tab ·
                use-video-card-thumbnail
  components/   studio-layout · service-health-badge · error-notice · create-project-form ·
                voice-picker ·
                asset-card · asset-delete-control · asset-preview · asset-uploader ·
                generated-files-panel · timeline-player ·
                clip-track-editor · caption-editor · caption-style-selector · music-mix-editor ·
                output-preset-selector ·
                timeline-issue-list · timeline-save-bar · render-trigger · render-job-list ·
                render-job-panel · job-retry-button · montage-trigger · montage-job-panel ·
                storyboard-trigger · storyboard-job-panel · storyboard-header-editor ·
                storyboard-character-sheet · storyboard-scene-editor · storyboard-save-bar ·
                storyboard-prompt-sheet · voice-trigger · voice-job-panel · voice-scene-card ·
                voice-script-panel · producer-script-panel ·
                producer-message-list · producer-composer · producer-turn-activity ·
                producer-welcome (COMP-042) · logo-overlay-editor · logo-bumper-editor (COMP-048) ·
                folder-heading (renombrado inline) · openrouter-model-picker ·
                workspace-side-panel · producer-conversation-panel · chat-drop-zone ·
                asset-proposal-card · video-card · home-drop-hint · create-project-by-drop ·
                ui/{button,card,badge,tabs} (+ tokens en `index.css` bajo `@theme`)
  pages/        projects-page · asset-library-page · project-workspace-page · storyboard-page ·
                voice-page · project-preview-page · settings-page · guide-page (rutas perezosas)
  app/app.tsx   router (`/`, `/guide`, `/settings`, `/projects/:slug` [workspace de chat],
                `/projects/:slug/library`, `/projects/:slug/producer` [redirect a `/projects/:slug`],
                `/projects/:slug/{storyboard,voice,preview}`) y provider
e2e/            smoke-helpers.mjs (compartido) · studio-smoke.mjs · montage-smoke.mjs ·
                storyboard-smoke.mjs · voice-smoke.mjs · voices-smoke.mjs · producer-smoke.mjs ·
                delete-asset-smoke.mjs · interrupted-job-smoke.mjs ·
                capture-frame-240.mjs (fuera del build, fuera de Vitest)
```

- **`src/api/` es el único lugar que sabe que el servicio existe** (RNF-4). Ningún componente arma
  una URL ni lee un status; nadie fuera de ahí conoce host, puerto ni el prefijo `/api`.
  Verificable: `grep -rn "127.0.0.1\|localhost\|/api/" apps/web/src --include=*.tsx`.
- **El transporte es el proxy de Vite, no una URL absoluta** (D-4): `render-api` **no emite ninguna
  cabecera CORS**, así que un `fetch` de `localhost:4200` a `127.0.0.1:4310` lo bloquea el
  navegador. `vite.config.ts` proxea `/api/*` → `RENDER_API_URL` (default `http://127.0.0.1:4310`)
  quitando el prefijo, en `server` y en `preview`. Consecuencia buscada: las URLs de `EP-011` son
  same-origin, que es lo que necesitan el `<Player>` de Remotion y cualquier `<video>` con `Range`.
- **Los tipos del contrato HTTP se declaran acá, no se importan** (D-5): `apps/render-api` es otra
  app y `libs/auto-montage` es una lib Node (`node:fs`, `execa`) que no puede entrar a un bundle de
  navegador. La frontera entre las dos apps es el contrato HTTP y su registro es `sdd/api.json`.
  **Excepción medida:** los **documentos** que la app edita (`Timeline`, `StoryboardDocument` y sus
  schemas Zod) se importan de `@video-maker/timeline-core`, que es Zod puro. Lo que se declara acá
  es el contrato HTTP (jobs, etapas, reportes, capabilities, manifests que no se editan).
- **`Job` es una unión discriminada por `kind`, nunca un tipo con opcionales** (espejo de
  `apps/render-api/src/jobs/render-job.ts`): `RenderJob | MontageJob | StoryboardJob | VoiceJob`
  con progreso y reporte propios de cada rama. Con opcionales, la UI podía leer `renderedFrames` de
  un job de montaje. `parseJob` es la entrada única y cada `parse<Kind>Job` **rechaza** los otros
  `kind`. Un `kind` nuevo se agrega en los tres lugares: el union de tipos, el parser y el panel.
- **El turno del productor NO entró a la unión `Job`**: no tiene `kind`, ni `state`, ni `progress`,
  y meterlo obligaría a ensanchar con opcionales — el antipatrón que esta app prohíbe.
  `useProducerTurnPoll` es un hook propio con el mismo patrón interno que `useRenderJobPoll`.
- **Un job `failed`/`canceled` es relanzable, no solo diagnosticable**: `JobRetryButton` aparece en
  los cuatro paneles de job y se oculta solo si el job no es relanzable; llama `retryJob` (`EP-036`)
  y reemplaza el job del panel vía el `onRetried` de cada página. Un `failed` con código
  `JOB_INTERRUPTED` se etiqueta "Interrumpido" en vez de "Failed" (tres códigos propios en
  `error-explanations.ts`, claves `job.interrupted`/`job.retry`).
- **La capacidad del servicio se decide en funciones puras de `src/api/`**
  (`montageBlockers`, `storyboardBlockers`, `voiceBlockers`, `producerBlockers`): el botón se
  deshabilita con el motivo escrito, nunca en silencio. `voiceBlockers` mira `voiceQueue` **y los
  seis binarios**; `montageBlockers` sólo cuatro; `storyboardBlockers` ninguno (el agente no usa
  binarios de media).
- **Cada familia de códigos de error tiene un único traductor a frase de usuario**
  (`montageFailureExplanation`, `storyboardFailureExplanation`, `voiceFailureExplanation`,
  `producerFailureExplanation`) y la UI muestra **el code y la frase**, nunca una sola de las dos.
  `storyboardFailureExplanation` explica `OPENROUTER_KEY_MISSING` y
  `OPENROUTER_FREE_QUOTA_EXHAUSTED` (`AGENT_FAILURE_CODES` en `storyboard-capability.ts`);
  `AI_AGENT_RATE_LIMITED` dejó de nombrar a Claude porque vale para los dos motores del productor.
- **Las etiquetas legibles de un union viven en `src/api/`, no en el componente**
  (`montage-presets.ts` es el precedente, `asset-roles.ts` el segundo caso): así un miembro nuevo
  del union rompe el tipo en un solo lugar y no se cuela un `switch` incompleto en JSX.
  `asset-roles.ts` concentra nombre, impacto en el video final, orden por importancia y
  obligatoriedad de los seis roles más `BROLL_MATCHING_HINT`, y `orderedAssetRoles()` impone el
  orden del catálogo, no el que le pase el llamador.
- **`servicePathUrl(path)` resuelve los paths relativos que publica el servicio** (el `previewUrl`
  de una voz) same-origin por el proxy `/api`, igual que `artifactUrl`: el servicio nunca emite su
  propio host. El preview de voz **no es un artefacto de proyecto** y no pasa por `EP-011`.
- **Una tarjeta de voz monta su propio `<audio preload="none">`** (`voice-picker.tsx`): el estado
  `idle|loading|playing|error` vive en la tarjeta y el id que suena, en el picker, así que arrancar
  una voz pausa la anterior. Ese estado también se guarda en un `ref` para que el efecto de "pausá
  si ya no sos la activa" **no llame `pause()` en el montaje** — jsdom no implementa `pause` y
  ensuciaba la salida de toda la suite. Un `play()` rechazado por el navegador deja la tarjeta en
  `error`, nunca trabada en `loading`.
- **`AssetUploader` conserva el camino de rol fijo** (`roles={['voice']}`/`['logo']`) con su
  `<label htmlFor>` intacto: es el contrato que asera `logo-overlay-editor.spec`.
- **La suite no tiene `@testing-library/jest-dom`**: `toBeEnabled()`/`toBeDisabled()` fallan con
  `Invalid Chai property`. Aserar sobre `(el as HTMLButtonElement).disabled`.
- **Superficie de errores:** `RenderApiError` conserva el `code` del servicio y suma exactamente
  **tres** códigos propios de transporte: `SERVICE_UNREACHABLE` (el `fetch` rechaza),
  `RESPONSE_NOT_JSON` (status de error sin payload tipado) y `RESPONSE_SHAPE_UNEXPECTED` (200 con
  un cuerpo fuera del contrato). La UI nunca muestra una excepción cruda.
- **`asset-media-kind.ts` es un espejo declarado de `apps/render-api/src/http/content-type-for.ts`**:
  misma tabla cerrada de extensiones. **Si esa tabla cambia en el servicio, hay que cambiarla acá**:
  son un par y **nada automático lo detecta** (abierto desde `cycle-02` de `spec-006`).
- **`artifactUrl` descarta los segmentos `.` y `..`** además de percent-encodear segmento por
  segmento: una URL de artefacto no puede salir del proyecto ni aunque el catálogo mintiera.
- **Estado de servidor sin librería** (D-3): `useAsyncResource` (`loading|ready|error` + `reload` +
  `isRefreshing`, que ya no descarta `data` en un refresh fallido), `useRenderJobPoll` y
  `useProducerTurnPoll` (`setTimeout` re-armado después de cada respuesta, **nunca**
  `setInterval`). Sin TanStack Query, sin store global.
- **El patrón anti-StrictMode es un contador de secuencia monótono, nunca un booleano latcheable.**
  Un `useRef(true)` con cleanup que lo pone en `false` queda en `false` para siempre (el
  inicializador corre una vez, el cleanup dos): trabó el botón Save en "Saving...". Bumpear el
  contador en el cuerpo del efecto **y** en el cleanup.
- **La composición se envuelve en `<VideoBackendProvider backend="player">`**, que es lo único que
  hace que el árbol monte `<Video>` en vez de `<OffthreadVideo>`. El render nunca monta ese
  proveedor: su default es `'render'` y la salida quedó byte-idéntica.
- **Los assets se reescriben antes de montar** (`playerTimeline`): cada `MediaAsset.path` pasa a una
  URL absoluta de `EP-011`. Sin eso, `assetSrc` de la lib llamaría `staticFile()` contra el
  `public/` vacío de esta app o armaría un `file://` que el navegador no puede cargar.
- **El selector de formato es override de preview, nunca escritura**: cambia `format` **y**
  `safeZone` juntos y no emite ningún request. Al aplicar un preset **se borra la clave `box`** de
  todos los captions (`'box' in clip === false`, no `box: undefined`).
- **Editar un nivel de música reescribe `audioMix.automation`, no sólo los dos campos de nivel**:
  ni el `<Player>` ni el render leen `music.baseGainDb`/`duckedGainDb` para la curva real, así que
  un cambio que sólo tocara esos campos sería inaudible en los dos lados.
- **El logo vive en la página de preview, no en el productor**: ahí ya están el reducer, el `dirty`,
  la severidad de issues y el único `PUT` completo. `timeline-edit/logo-overlay.ts` escribe
  `timeline.logo` **y** mete el `MediaAsset` en `timeline.assets`, y lo saca al apagar el logo si
  ningún clip lo referencia. El control se habilita sólo con un logo **probado** en el catálogo.
- **La ruta perezosa es la unidad de bundle**: `timeline-edit/**`, Zod, el Player, `parse-storyboard`
  y `storyboard-edit/` entran SÓLO por los chunks de las rutas (`React.lazy`).
  `@nx/enforce-module-boundaries` prohíbe mezclar import estático y `await import()` de la misma
  lib, así que la salida no es un import dinámico sino mantener a los consumidores dentro de la ruta
  perezosa. **El detector es la salida de `vite build`**: importar Zod desde el cliente subió el
  chunk inicial de 466 kB a 580 kB y reapareció el aviso de "chunks larger than 500 kB". El mismo
  patrón se usa para copy larga que no se renderiza al abrir la pantalla: `messages-es.ts`
  (catálogo `es` completo) y `guide-content-{en,es}.ts` sólo se alcanzan por `await import()`, y
  `producer-recipe-prompts.ts` (los textos largos de cada receta del productor) igual, desde
  `loadRecipePrompt`. El chunk inicial subió hasta **533,9 kB** (arriba del aviso de 500 kB de
  Vite) sobre `producer-page`/nav clásica en `spec-017 cycle-02`..`cycle-04`; el rediseño del
  workspace de chat (`cycle-05`) lo bajó a **294 kB** reales al reemplazar esa pantalla y demorar
  el resto detrás de rutas perezosas. La próxima pantalla o catálogo de copy que entre al chunk
  inicial (en vez de una ruta o un `await import()` perezoso) probablemente lo vuelve a disparar.
- **`useSearchParams` de `react-router` arrastra al chunk inicial**: la salida es `URLSearchParams`
  nativo. No cambiarlo por el hook del router "por consistencia".
- **La validación de cliente es espejo del servicio y clasifica por severidad**: `SCHEMA_INVALID`
  bloquea el guardado; los otros nueve códigos de `validateTimeline` dejan guardar con advertencia
  pero **deshabilitan el disparo de render**. Fundamento medido: `apps/render-api` no corre
  `validateTimeline` ni en `EP-008` ni en `EP-012`, pero `composition-remotion/src/render.ts` sí —
  un documento con `CLIP_EXCEEDS_ASSET` se acepta con 200, el job se crea con 202 y **falla siempre**.
- **`TimelineIssue.code` de `timeline-core` es un union cerrado**: `VOICE_TRACK_NOT_MIRRORED` vive
  como tipo propio (`VoiceMirrorIssue`) y la UI declara un union más ancho. No ensanchar el tipo de
  la lib ni castear.
- **`TimelineEditState.rejections` se REEMPLAZA en cada dispatch**, nunca acumula: con acumulación,
  un solo valor mal tipeado dejaba `canSaveTimeline` en `false` para siempre.
- **El markdown del productor es propio y a mano** (`producer-markdown.ts`): encabezados, párrafos,
  listas `-`/`1.`, reglas `---`, **tablas**, bloques cercados, negritas, código inline y
  `numberedOptions`, todo puro. La lista de bloques salió de mirar lo que el agente **realmente**
  contesta, no de un subset teórico de CommonMark.
- **`media/` nunca se copia a `apps/web/public`** (D-6): todo asset se lee por `EP-011`.
- **El borrado de assets es una máquina de tres pasos en la propia tarjeta**
  (`asset-delete-control.tsx`: `closed` → `confirm` → `in-use`), no un modal: si el servicio
  contesta `409 ASSET_IN_USE` la confirmación pasa a mostrar los usos reportados y ofrece **Delete
  anyway** (reintento con `force=true`); al confirmar se recarga el listado. `AssetCard` sólo
  expone `onDeleted` y `data-testid="asset-card"` + `data-asset-path` para que el E2E ubique una
  tarjeta concreta. No hay borrado múltiple ni deshacer: un borrado con `force` puede romper la
  timeline y la UI sólo avisa.
- **La sección "Generated" de la biblioteca** (`generated-files-panel.tsx`) lee las rutas conocidas
  del motor (`work/voice/voice.wav`, `work/producer/script.txt`, `work/voice/script-manifest.json`
  y los `out/*.mp4`) vía `listGenerated` (`EP-028`) y `getProjectFile` (`EP-011`, que arma la URL
  **segmento por segmento** descartando `.`/`..`, igual que `artifactUrl`). No hay borrado de
  generados.
- **El estilo de subtítulos se elige desde el preview** (`caption-style-selector.tsx` +
  `timeline-edit/caption-style.ts`): los cinco estilos se muestran por etiqueta de producto, nunca
  por id; un documento sin `captionStyle` se lee como el implícito `bold-impact`.
- **El panel de logo cubre tamaño, opacidad, aviso de transparencia y bumpers de inicio/fin**
  (`timeline-edit/logo-overlay.ts` + `timeline-edit/logo-bumpers.ts`): `LOGO_SIZES`
  (0.12/0.18/0.28) cae al tamaño más cercano para una timeline vieja con otro valor; el aviso de
  transparencia se apoya en `MediaAsset.hasAlpha`, que refleja el `pix_fmt` declarado y no un
  análisis de píxeles (un PNG `rgba` con fondo blanco opaco pintado en el arte no lo dispara). Los
  bumpers (`timeline.bumpers`, editor `logo-bumper-editor.tsx`/COMP-048 montado dentro de
  `LogoOverlayEditor`) tienen cuatro duraciones (1500/2000/3000/4000 ms) y tres tamaños de logo
  (0.3/0.4/0.55); `setTimelineBumperEnabled` no prende nada si la timeline no tiene logo y
  `setTimelineBumperStyle` no inventa un bumper que no existe. La fila DURACIÓN del preview
  muestra contenido + inicio/fin (`computeTimelineMetadata` ya traía `timelineTotalFrames`).
- **`TimelineEditState.warnings` es un array separado de `issues`** (de `timelineWarnings` de
  `timeline-core`): `canStartRender` sigue exigiendo cero issues, y un warning (por ejemplo
  `BUMPER_WITHOUT_LOGO`, severidad `warning`, pintado en azul por `issue-severity.ts`) no bloquea
  nada. La página monta una segunda lista sólo para warnings.
- **Voz y Storyboard reconocen el modo guion** cuando el proyecto se narró desde un script:
  `parseVoiceScriptManifest` devuelve el manifest validado con `VoiceScriptManifestSchema` o
  **null** (JSON inválido, documento ajeno o manifest sin líneas se tratan igual del lado de la
  UI). En `voice-page.tsx` el modo guion se activa con `storyboard.data === null && manifest !==
  null`, reemplaza la lista de escenas y pasa `scriptPath` al `VoiceTrigger` (que cambia su rótulo
  a "Regenerate with the selected voice"). En `storyboard-page.tsx`, con `STORYBOARD_NOT_FOUND` y
  `work/producer/script.txt` legible, se muestra el guion en sólo lectura. El modo guion no edita:
  para cambiar el texto hay que volver al productor — si algún día se edita desde acá, el guion es
  la fuente y el manifest el derivado, nunca al revés.
- **El workspace (`project-workspace-page.tsx`) es la pantalla por defecto de un proyecto**:
  `workspace-side-panel.tsx` con pestañas Vista previa/Material/Entregas (`use-auto-switching-tab.ts`
  cambia de pestaña sola cuando un montaje o un render termina) y `producer-conversation-panel.tsx`
  (lógica en `use-producer-conversation.ts`) con el cuadro de texto fijo abajo y el scroll pegado al
  último mensaje (`use-stick-to-bottom.ts`, solo con mensajes). Un archivo se suelta con
  `chat-drop-zone.tsx` o se adjunta; `use-inbox-uploads.ts` lo sube y aparece como
  `asset-proposal-card.tsx` (rol propuesto + razón) apilada encima del cuadro de texto hasta que el
  usuario confirma, momento en que pasa a su carpeta (`raw/<rol>/`). Biblioteca, storyboard, voz y
  preview quedan como **Edición avanzada**, accesibles desde el panel lateral.
- **El inicio (`/`) lista videos, no proyectos crudos**: `video-card.tsx` con miniatura
  (`use-video-card-thumbnail.ts`) y un solo estado en lenguaje de usuario (`api/project-status.ts`),
  y `create-project-by-drop.tsx`/`home-drop-hint.tsx` crean un video soltando un archivo. Las
  carpetas se listan aunque estén vacías y se renombran inline (`folder-heading.tsx`).
  **Vocabulario propio de esta UI:** lo que `render-api` llama `project` se muestra como **video**;
  lo que agrupa videos en pantalla es una **carpeta** — no confundir en código ni copy nuevos.
- **`/settings` configura el motor del productor, no un modelo suelto** (`settings-page.tsx` +
  `openrouter-model-picker.tsx` + `api/parse-producer-settings.ts` + `api/producer-engine-i18n.ts`):
  motor Claude Code u OpenRouter, key de OpenRouter de sólo escritura (nunca se relee), catálogo
  completo con búsqueda y una lista de recomendados con métricas. El chat muestra el motor activo,
  solo ofrece los modelos recomendados (traducidos por id vía `api/producer-model-i18n.ts`) y el
  costo de cada turno (`message.usage.costUsd`, formateado por idioma con
  `api/producer-cost-format.ts`); si el modelo elegido deja de estar entre las opciones (carrera con
  la configuración), el panel de conversación lo resetea solo.
- **`vite.config.ts` fuerza `NODE_ENV=production` en `build`**: el `.env` raíz trae
  `NODE_ENV=development`, Nx lo inyecta en todas las tasks, y sin el override el build salía con
  React de desarrollo. La salud de servicio agrupa los binarios por categoría (herramientas de
  video, transcripción, motor de voz) y sus textos dicen "motor de voz" en vez de nombrar Piper — el
  motor es intercambiable.
- **Toda la interfaz vive en español e inglés** (`src/i18n/`): `messages-en.ts` es la fuente de
  verdad tipada (`{...} as const satisfies Record<string,string>` → `TranslationKey = keyof typeof
  MESSAGES_EN`), y `messages-es.ts` se declara `Messages = Readonly<Record<TranslationKey,
  string>>` — una clave de más o de menos es error de `tsc`, no un test que se puede olvidar
  (`messages-parity.spec.ts` lo vuelve a aserar en runtime, incluidos placeholders y variantes de
  plural). `translate.ts` da `t(key, params)` (interpolación `{param}`; un placeholder sin valor
  queda tal cual, nunca `undefined`) y `tn(key, count, params)` (elige `<key>.one`/`<key>.other`,
  claves normales dentro del mismo chequeo de paridad). `language-context.tsx` expone
  `LanguageProvider` + `useLanguage()` + `useT()` + `useTn()`; **`useT()` sin provider devuelve el
  catálogo inglés**, así que ninguna suite vieja que aserara texto en inglés tuvo que tocarse — la
  migración cambió de dónde sale el texto, no qué texto sale.
- **El idioma default es español** (`i18n/language.ts`, `DEFAULT_LANGUAGE = 'es'`): gana la
  elección guardada en `localStorage`; sin elección, arranca en `es` — ya **no** se mira
  `navigator.languages`. `useT()` sin provider sigue devolviendo el catálogo inglés (lo usan los
  tests). El switch no ofrece un tercer idioma listo para usar: agregar uno es sumar el módulo,
  sumarlo a `LANGUAGES` y dejar que `tsc` señale cada clave faltante.
- **Los bloqueadores de acción devuelven claves, no frases** (`src/api/blockers.ts`, `Blocker =
  { key, params? }`): `voiceBlockers` (mira `voiceQueue` y los seis binarios), `montageBlockers`
  (cuatro binarios), `storyboardBlockers` (ninguno) y `producerBlockers` deciden *qué* bloquea; el
  componente decide *cómo se dice*. `blockerId()` da la React key cuando dos blockers comparten
  clave con params distintos.
- **`/guide` es una ruta perezosa que explica el studio** (`src/guide/guide-content-{en,es}.ts`,
  ocho secciones md-like, dibujadas con `ProducerMarkdown`), con la tabla de presets de salida y
  tres flujos típicos en los dos idiomas. Es texto fijo: no se genera de los catálogos, pero
  `guide-content.spec.ts` falla si un preset de montaje o de salida deja de estar tabulado con su
  id y su etiqueta legible.
- **El "no hay copy literal" se verifica con un scanner propio** (`src/i18n/literal-copy-scan.ts`:
  borra las expresiones `{...}` y busca texto JSX y `placeholder`/`title`/`aria-label`/`alt` fuera
  de una lista cerrada de tokens técnicos), corrido sobre los `.tsx` de `app`, `components` y
  `pages` vía `import.meta.glob(..., { query: '?raw' })` — no un plugin de ESLint, porque D-9
  prohíbe un config propio de la app. `literal-copy-scan.spec.ts` prueba el oráculo rompiéndolo
  aposta, con fixtures de copy plantada que tiene que detectar.
- **Lo que NO se traduce, a propósito:** el texto que escribe el agente productor (ya viene en el
  idioma del usuario), el `label`/`description` que publica `GET /voices` (dato del catálogo del
  servicio, derivado del `.onnx.json`), el `message` de un error del servicio (se muestra como
  línea técnica cuando hay explicación traducida) y las etiquetas de `errorDetailLines`
  (`resource:`/`expected:`/`hint:`/`stage:`, nombres de campo del payload).
- **La bienvenida del productor ofrece recetas** (`api/producer-recipes.ts`:
  `PRODUCER_RECIPE_IDS`, `PRODUCER_RECIPES` con metadata `{ id, labelKey, descriptionKey }`,
  `recipePromptHasHole` y `loadRecipePrompt(id, language)`): una fila propia encima de las
  sugerencias sueltas, hoy con el chip **Tutorial**. Al tocarlo el compositor se rellena con el
  prompt completo en el idioma de la UI, editable y con un hueco `[…]` para la tabla de escenas del
  usuario. `producer-welcome.tsx` (COMP-042) usa `useLanguage()` además de `useT()`: el prompt
  sigue el idioma de la UI, no el del catálogo por defecto. Para sumar una receta hacen falta
  cuatro lugares: una entrada en `PRODUCER_RECIPES`, su prompt por idioma en
  `producer-recipe-prompts.ts`, sus dos claves de catálogo, y la receta también en el system
  prompt del productor (`apps/render-api`) y en la skill `video-producer` — si no, el agente no
  sabe qué parámetros aplicar al oír su nombre.

## 4. Convenciones propias

- **Copy, identificadores y README en inglés** (D-7, precedente de `FIX-e-burgos-002-002`); los
  documentos SDD en español. **Sin comentarios** en el código de implementación.
- **Cada control lleva `aria-label` explícito.** React renderiza el valor de un `<textarea>` y las
  `<option>` de un `<select>` como hijos del `<label>` que los envuelve: sin `aria-label` el nombre
  accesible es el texto de la etiqueta **más el valor actual**, y `getByLabel(..., { exact: true })`
  de Playwright deja de encontrarlo (costó una corrida del E2E).
- **`apps/web/eslint.config.mjs` no se crea** (D-9, hook `config-protection`): el proyecto lintea
  contra el flat config raíz y sus boundaries se cumplen por el fallback `type:app` → `*`. La deuda
  de lint se salda **cambiando el código, nunca la config** (precedente: `omitKeys()` tipado en vez
  del destructuring-para-omitir con variables `_prefijadas`).
- **Los artefactos de despliegue del generador no vuelven** (D-11): sin `Dockerfile` ni
  `nginx.conf` — el producto es local y `render-api` sólo escucha en loopback.
- **Los `data-*` son contrato de los guiones de Playwright, no decoración.** Los cuatro de
  diagnóstico de `timeline-player.tsx` (`data-duration-in-frames`, `data-fps`,
  `data-composition-width/height`) y el `?frame=` de la ruta de preview son el contrato de la
  captura de paridad de encuadre; los `data-testid` (`timeline-player`, `timeline-save-bar`,
  `render-job-panel`, `asset-source`, `montage-trigger`, `montage-job-panel`, `montage-stage`,
  `montage-blockers`, `montage-asset-progress`) y `data-timeline-dirty`/`data-montage-state`, el
  del smoke E2E. Los de `cycle-01` de `spec-016` se suman a ese contrato: `voice-picker`,
  `voice-card` (con `data-voice-id`, `data-selected`, `data-preview-state`), `voice-preview-audio`,
  `asset-role-choices`, `asset-role-choice` (con `data-role`, `data-selected`),
  `asset-role-required` y `asset-role-hint`. Los de `cycle-02` de `spec-016` (i18n y guía) suman
  `language-switch` (con `data-language` por botón), `guide-nav`, `guide`, `guide-index`,
  `guide-section` (con `data-guide-section` y `data-guide-language`) y `error-technical-detail`.
  `FIX-005-001` suma `asset-card` (con `data-asset-path`) para el borrado. Si se renombran, hay
  que actualizar los guiones.
- **Cada ciclo cierra con al menos una captura real de Playwright** de la UI contra un `render-api`
  real, en `cycles/cycle-XX/artifacts/` (D-10, RNF-5). `lint`/`test`/`build` verdes no prueban que
  la pantalla se dibuje, y **una UI se verifica midiendo el estado del medio en el navegador**
  (`readyState`, `duration`, `videoWidth/Height`), nunca la captura ni el `src`.
- **Todo guion E2E tiene un gate barato antes del paso caro** (`PRODUCER_SMOKE_STOP_AFTER=4`
  ejercita copia, servidores, navegación e inventario sin gastar un token), y el gate va **después**
  del código que se quiere validar, nunca antes.
- **Cobertura sin recortar el `include`** (RNF-3): `src/**/*.{ts,tsx}` con piso 80 %, excluyendo
  sólo `*.spec.*`, `main.tsx` y `test-setup.ts`.
- Los componentes se registran en `sdd/components.json` bajo la app-key `apps/web` con su
  `consumes` de endpoints.

## 5. Superficies añadidas desde spec-018 (rutas, componentes y reglas)

Todos bajo `src/` de la app; copy `es`/`en` en `src/i18n/`; el contrato de cada endpoint está en `sdd/api.json`.

- **Barra única del proyecto** (`StudioLayout` carga el modo): productor · motion (sólo motion) · biblioteca ·
  storyboard · voz · vista previa; ya no hay "Edición avanzada" ni "Abrir Motion graphics". Las páginas clásicas son
  `Classic…Page` detrás de `components/project-mode-gate.tsx`.
- **Modo motion**: al crear un proyecto se elige "Motion graphics" o "Material crudo" (radiogroup, default crudo); la
  tarjeta lleva insignia y va a `/projects/:slug/motion`. `pages/motion-page.tsx` (brief: marca, formato, música,
  golpes, título, objetivo, público, guion, imágenes de `raw/images`; "Armar storyboard"; "Hacer video" con progreso
  "Voz 3/7" y reproductor), `components/{motion-brief-form,motion-job-status,motion-scene-list}.tsx`,
  `api/{motion-types,motion-brief-form,project-mode,null-when-missing,motion-scene-props,producer-suggestions-fence}.ts`.
  En proyectos motion, storyboard, voz y vista previa muestran lo que dejó el pipeline vía `GET /motion/overview`
  (`motion-view-shell`, `motion-storyboard-view`, `motion-voice-view`, `motion-preview-view`,
  `hooks/use-motion-overview.ts`); la biblioteca sólo las fotos. El storyboard motion es editable
  (`use-motion-storyboard-draft.ts`) y lista aparte las «Cajas medidas por el productor (a confirmar)».
  `MotionStoryboard.music` es `{track, volume?} | null`. Las sugerencias del productor cargan la caja de texto (no
  envían) y el bloque `suggestions` no se muestra crudo en la actividad del turno.
- **Marcas**: `/brands` (propias e incluidas, nueva, duplicar, borrar) y `/brands/:id` (identidad, logo, colores —4 base
  + avanzado por variable; cambiar un color base recalcula todos y descarta retoques—, tipografías, voz, música, fotos
  y productos) con vista previa en vivo en un iframe (colores por `postMessage` `mg-brand-tokens` + recompuesta
  diferida). Una incluida es de sólo lectura con "Duplicar". `pages/brands-page.tsx`, `brand-editor-page.tsx`, 17
  `components/brand-*.tsx`, hooks `use-brand-editor`, `use-section-draft`, `use-brand-upload`, `use-brand-font-faces`,
  `use-project-brand-voice`; `api/brand-*.ts`, `google-font-families.ts`. `components/brand-picker.tsx` en el alta
  (crudo: opcional; motion: obligatoria) y `project-brand-control.tsx` en la barra (en motion la marca se cambia en el
  brief; una marca sin música sólo ofrece "Sin música"). El selector de subtítulos ofrece "De la marca" y la página Voz
  preselecciona la voz de la marca.
- **YouTube**: Configuración › YouTube (credencial del cliente, conectar con sondeo, desconectar, "Listas por
  categoría" en `youtube-category-playlists-section.tsx`); diálogo "Publicar en YouTube" en vista previa y Entregas
  (borrador del productor, contadores, visibilidad, programación, lista, miniatura, confirmación con el nombre del canal
  al publicar público, progreso por bytes, enlace, reintento, «Agregar a la cola» con aviso de ya publicado); panel de
  publicaciones e insignia en la tarjeta. `components/youtube-*.tsx`, `publications-panel.tsx`, hooks
  `use-youtube-integration`, `use-youtube-connect-flow`, `use-polled-resource`; `api/youtube-*.ts`,
  `publication-status.ts`. Página `/publish-queue` («Publicación» en el header, polling de 10 s):
  `pages/publish-queue-page.tsx`, `api/{publish-queue-types,parse-publish-queue,publish-queue-view}.ts`.
- **Calidad de producción**: panel "Revisión" por MP4 en Biblioteca › Entregables y en la vista previa motion
  (`render-review-panel.tsx`, `api/review-{types,format}.ts`, `parse-review.ts`); el diálogo de publicar alerta los
  críticos y exige "Publicar igual" para mandar `ignoreReview` (`publish-review-notice.tsx`); `review` es un kind de
  la lista de jobs. «Revisión visual por escena» (`visual-review-section.tsx`, muestra todos los cuadros de cada
  escena); avisos de material arriba de la propuesta (`material-review-block.tsx`). Tarjeta `Propuesta`
  (`proposal-card.tsx`, `proposal-status-badge.tsx`, `api/proposal-*.ts`; «Estimación gruesa» cuando `rough: true`),
  `sample-trigger.tsx` en Vista previa y etiqueta `Muestra` en la Biblioteca; Entregas y Vista previa laterales ocultan
  las muestras (siempre por el dato del API: `file.sample`/`job.sample`). `voice-direction-editor.tsx` (por línea en
  material crudo, por escena en motion) y `music-mode-fields.tsx` (Cama continua / Por tramos). Panel `Referencia`
  (`reference-analysis.tsx`, `reference-brief-view.tsx`, `reference-scene-strip.tsx`, `api/reference-*.ts`,
  `parse-reference.ts`) en la tarjeta de cada asset `reference`; la tarjeta de propuesta de archivos del chat ofrece
  `reference` sólo para videos y lo sugiere con motivo (`api/reference-suggestion.ts`). El chat deja el mensaje en
  espera mientras el productor trabaja y lo envía al terminar.
- **Layout del workspace**: grid `grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` y `min-w-0` en el panel de conversación y en
  la actividad del turno (con `fr` a secas el mínimo automático dejaba crecer la columna del chat); eventos del turno y
  bloques de código de los mensajes con `whitespace-pre-wrap break-words [overflow-wrap:anywhere]`.
- **Tests**: `settings-page.spec.tsx` espera hasta 5 s (con 7 proyectos en paralelo el timeout de 1 s era intermitente).
- **Pendientes vigentes**: copy propio para el uploader de imágenes en la página Motion (hoy usa el del modo crudo);
  el reporte de la fase storyboard trae `path`/`durationSec` null; la bandeja de arrastrar y soltar no propone el
  rol `reference`.
