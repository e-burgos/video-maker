# Constitución — apps/web

> Versión 2.3 | Última actualización: spec-e-burgos-016 cycle-01 | Fecha: 2026-09-11
> Consolidada por el orquestador al abrir `cycle-02` de `spec-e-burgos-016-studio-usability`
> (fundió el fragmento de `spec-016` c01 sobre la 2.2, que ya traía `spec-008` c02, `spec-009` c02,
> `spec-015` c02, `FIX-015-001` y `FIX-009-001`).
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).

## 1. Propósito

- **Tipo:** app React 19 (SPA local, mono-usuario, sin auth ni despliegue)
- **Rol en el sistema:** el Web Studio — la interfaz con la que el dev opera el motor desde el
  navegador de su propia máquina. Cubre el producto entero: el **productor conversacional** como
  punto de partida, biblioteca de assets crudos, **generación del montaje**, **storyboard
  generativo**, **voz** (síntesis por escena o locución propia), preview de la `Timeline` en el
  `<Player>` de Remotion con la composición real, edición del documento persistido y disparo,
  seguimiento y descarga de renders locales.
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
                clipboard, RenderApiProvider,
                parse-timeline · player-timeline · preview-format,
                render-api-types · parse-render-job · render-job-poll-plan · render-job-artifact,
                montage-capability · montage-presets,
                parse-storyboard · storyboard-capability · storyboard-edit/,
                parse-voice · voice-capability,
                parse-producer · producer-capability · producer-markdown · producer-turn-poll-plan,
                timeline-edit/  (toda la máquina de edición: reglas, layout de a-roll,
                                rescale de automation, presets, severidad, logo-overlay, reducer)
  hooks/        useAsyncResource (único primitivo de estado de servidor) · use-api-action ·
                use-render-job-poll · use-producer-turn-poll
  components/   studio-layout · service-health-badge · error-notice · create-project-form ·
                voice-picker ·
                asset-card · asset-preview · asset-uploader · timeline-player ·
                clip-track-editor · caption-editor · music-mix-editor · output-preset-selector ·
                timeline-issue-list · timeline-save-bar · render-trigger · render-job-list ·
                render-job-panel · montage-trigger · montage-job-panel ·
                storyboard-trigger · storyboard-job-panel · storyboard-header-editor ·
                storyboard-character-sheet · storyboard-scene-editor · storyboard-save-bar ·
                storyboard-prompt-sheet · voice-trigger · voice-job-panel · voice-scene-card ·
                producer-message-list · producer-composer · producer-turn-activity ·
                producer-welcome · logo-overlay-editor
  pages/        projects-page · asset-library-page · producer-page · storyboard-page ·
                voice-page · project-preview-page
  app/app.tsx   router (`/`, `/projects/:slug`, `/projects/:slug/{producer,storyboard,voice,preview}`)
                y provider
e2e/            smoke-helpers.mjs (compartido) · studio-smoke.mjs · montage-smoke.mjs ·
                storyboard-smoke.mjs · voice-smoke.mjs · voices-smoke.mjs · producer-smoke.mjs ·
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
- **La capacidad del servicio se decide en funciones puras de `src/api/`**
  (`montageBlockers`, `storyboardBlockers`, `voiceBlockers`, `producerBlockers`): el botón se
  deshabilita con el motivo escrito, nunca en silencio. `voiceBlockers` mira `voiceQueue` **y los
  seis binarios**; `montageBlockers` sólo cuatro; `storyboardBlockers` ninguno (el agente no usa
  binarios de media).
- **Cada familia de códigos de error tiene un único traductor a frase de usuario**
  (`montageFailureExplanation`, `storyboardFailureExplanation`, `voiceFailureExplanation`,
  `producerFailureExplanation`) y la UI muestra **el code y la frase**, nunca una sola de las dos.
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
  chunk inicial de 466 kB a 580 kB y reapareció el aviso de "chunks larger than 500 kB". Medición
  vigente: inicial **479,33 kB**, `producer-page` 23,1 kB, `voice-page` 19,9 kB, `storyboard-page`
  33,1 kB, `project-preview-page` 366 kB, **sin** el aviso de 500 kB.
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
  `asset-role-required` y `asset-role-hint`. Si se renombran, hay que actualizar los guiones.
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
