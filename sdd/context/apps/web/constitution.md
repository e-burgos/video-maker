# Constitución — apps/web

> Versión 2.1 | Última actualización: spec-e-burgos-007 cycle-02 | Fecha: 2026-09-09
> Consolidada por el orquestador al abrir `cycle-02` de `spec-e-burgos-008-ai-storyboard`
> (fundió el fragmento de `spec-007` cycle-02).
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).

## 1. Propósito

- **Tipo:** app React 19 (SPA local, mono-usuario, sin auth ni despliegue)
- **Rol en el sistema:** el Web Studio — la interfaz con la que el dev opera el motor desde el
  navegador de su propia máquina: biblioteca de assets crudos, **generación del montaje** (la app
  ya no sólo consume la `Timeline`, la produce: `tools/render-cli` dejó de ser obligatorio),
  preview de la `Timeline` en el `<Player>` de Remotion con la composición real, edición del
  documento persistido y disparo, seguimiento y descarga de renders locales.
- **No tiene lógica de motor ni toca el filesystem.** Todo lo que muestra y todo lo que escribe
  pasa por los endpoints de `apps/render-api` (`sdd/api.json` → `EP-001`..`EP-018`), su único
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
                artifact-url, project-slug, asset-media-kind, RenderApiProvider,
                parse-timeline · player-timeline · preview-format,
                render-api-types · parse-render-job · render-job-poll-plan · render-job-artifact,
                montage-capability,
                timeline-edit/  (toda la máquina de edición: reglas, layout de a-roll,
                                rescale de automation, presets, severidad, reducer)
  hooks/        useAsyncResource (único primitivo de estado de servidor) · use-api-action ·
                use-render-job-poll
  components/   studio-layout · service-health-badge · error-notice · create-project-form ·
                asset-card · asset-preview · asset-uploader · timeline-player ·
                clip-track-editor · caption-editor · music-mix-editor · output-preset-selector ·
                timeline-issue-list · timeline-save-bar · render-trigger · render-job-list ·
                render-job-panel · montage-trigger · montage-job-panel
  pages/        projects-page · asset-library-page · project-preview-page
  app/app.tsx   router (`/`, `/projects/:slug`, `/projects/:slug/preview`) y provider
e2e/            smoke-helpers.mjs (compartido) · studio-smoke.mjs · montage-smoke.mjs ·
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
- **Los tipos del contrato se declaran acá, no se importan** (D-5): `apps/render-api` es otra app y
  `libs/auto-montage` es una lib Node (`node:fs`, `execa`) que no puede entrar a un bundle de
  navegador. La frontera entre las dos apps es el contrato HTTP y su registro es `sdd/api.json`.
- **`Job` es una unión discriminada por `kind`, nunca un tipo con opcionales** (espejo de
  `apps/render-api/src/jobs/render-job.ts`): `RenderJob | MontageJob` con progreso y reporte
  propios de cada rama. Con opcionales, la UI podía leer `renderedFrames` de un job de montaje.
  `parseJob` es la entrada única y `parseRenderJob`/`parseMontageJob` **rechazan** el otro `kind`.
  Un `kind` nuevo se agrega en los tres lugares: el union de tipos, el parser y el panel que lo
  muestra.
- **La capacidad del servicio se decide en una función pura de `src/api/`**
  (`montageBlockers(health)`): el botón se deshabilita con el motivo escrito, nunca en silencio.
- **La suite no tiene `@testing-library/jest-dom`**: `toBeEnabled()`/`toBeDisabled()` fallan con
  `Invalid Chai property`. Aserar sobre `(el as HTMLButtonElement).disabled`.
- **Superficie de errores:** `RenderApiError` conserva el `code` del servicio (37 códigos) y suma
  exactamente **tres** códigos propios de transporte: `SERVICE_UNREACHABLE` (el `fetch` rechaza),
  `RESPONSE_NOT_JSON` (status de error sin payload tipado) y `RESPONSE_SHAPE_UNEXPECTED` (200 con
  un cuerpo fuera del contrato). La UI nunca muestra una excepción cruda.
- **`asset-media-kind.ts` es un espejo declarado de `apps/render-api/src/http/content-type-for.ts`**:
  misma tabla cerrada de extensiones. **Si esa tabla cambia en el servicio, hay que cambiarla acá**:
  son un par y **nada automático lo detecta** (abierto desde `cycle-02`).
- **`artifactUrl` descarta los segmentos `.` y `..`** además de percent-encodear segmento por
  segmento: una URL de artefacto no puede salir del proyecto ni aunque el catálogo mintiera.
- **Estado de servidor sin librería** (D-3, **mantenido con el polling de jobs como consumidor
  real**): `useAsyncResource` (`loading|ready|error` + `reload` + `isRefreshing`, que ya no descarta
  `data` en un refresh fallido) y `useRenderJobPoll` (`setTimeout` re-armado después de cada
  respuesta, **nunca** `setInterval`). Sin TanStack Query, sin store global.
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
- **`timeline-edit/**`, Zod y el Player entran SÓLO por el chunk perezoso** (`React.lazy` de la ruta
  de preview). `@nx/enforce-module-boundaries` prohíbe mezclar import estático y `await import()` de
  la misma lib, así que la salida no es un import dinámico sino mantener a los consumidores dentro
  de la ruta perezosa. **El detector es la salida de `vite build`**: chunk inicial 249 kB y chunk de
  `project-preview-page` 452 kB, sin el aviso de "chunks larger than 500 kB". Si eso se importa
  desde el shell, el aviso reaparece.
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
- **`media/` nunca se copia a `apps/web/public`** (D-6): todo asset se lee por `EP-011`.

## 4. Convenciones propias

- **Copy, identificadores y README en inglés** (D-7, precedente de `FIX-e-burgos-002-002`); los
  documentos SDD en español. **Sin comentarios** en el código de implementación.
- **`apps/web/eslint.config.mjs` no se crea** (D-9, hook `config-protection`): el proyecto lintea
  contra el flat config raíz y sus boundaries se cumplen por el fallback `type:app` → `*`.
- **Los artefactos de despliegue del generador no vuelven** (D-11): sin `Dockerfile` ni
  `nginx.conf` — el producto es local y `render-api` sólo escucha en loopback.
- **Los `data-*` son contrato de los guiones de Playwright, no decoración.** Los cuatro de
  diagnóstico de `timeline-player.tsx` (`data-duration-in-frames`, `data-fps`,
  `data-composition-width/height`) y el `?frame=` de la ruta de preview son el contrato de la
  captura de paridad de encuadre; los `data-testid` (`timeline-player`, `timeline-save-bar`,
  `render-job-panel`, `asset-source`, `montage-trigger`, `montage-job-panel`, `montage-stage`,
  `montage-blockers`, `montage-asset-progress`) y `data-timeline-dirty`/`data-montage-state`, el
  del smoke E2E. Si se renombran,
  hay que actualizar los guiones.
- **Cada ciclo cierra con al menos una captura real de Playwright** de la UI contra un `render-api`
  real, en `cycles/cycle-XX/artifacts/` (D-10, RNF-5). `lint`/`test`/`build` verdes no prueban que
  la pantalla se dibuje, y **una UI se verifica midiendo el estado del medio en el navegador**
  (`readyState`, `duration`, `videoWidth/Height`), nunca la captura ni el `src`.
- **Cobertura sin recortar el `include`** (RNF-3): `src/**/*.{ts,tsx}` con piso 80 %, excluyendo
  sólo `*.spec.*`, `main.tsx` y `test-setup.ts`.
- Los componentes se registran en `sdd/components.json` bajo la app-key `apps/web` con su
  `consumes` de endpoints.
