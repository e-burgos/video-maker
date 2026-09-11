# spec-e-burgos-016-studio-usability — cycle-02 · plan (lite)

> Módulo: studio-usability | Subproyectos: apps/web | Fecha: 2026-09-11
> Flow: **lite** — forzado por el dev (prefijo `[LITE]`, perfil `solo`) aunque `sdd:validate`
> sugiera `full` para la spec: este ciclo **no crea ni toca ningún contrato** (cero endpoints,
> cero tablas, cero cambios en `apps/render-api`), es UI pura de `apps/web`. Un solo actor con
> tres sombreros: escribe este plan, implementa task por task y cierra como reviewer. Sin fan-out.
> Objetivo: que la plataforma se pueda usar **en español o en inglés** con un switch en el header
> que persiste, y que exista una **sección de guía** que explique para qué sirve cada pantalla y
> en qué orden encadenarlas. Cierra la spec.
> Fuera de alcance: dependencias npm nuevas (ni i18n ni markdown), traducir los mensajes del
> agente productor (vienen en el idioma del usuario), traducir ids técnicos, `code` de error,
> payloads, logs o documentos SDD, y cualquier cambio en `apps/render-api` o en el motor.

## Historias

- **US-016-005** — Como usuario quiero cambiar la plataforma entre inglés y español desde el header
  para leerla en mi idioma. CA: un control `en | es` junto al health badge, con `aria-label` y
  operable por teclado, cambia toda la UI al instante; la elección sobrevive a un reload; sin
  elección previa, un navegador `es-*` abre la app en español y cualquier otro, en inglés.
- **US-016-006** — Como usuario quiero que **toda** la copy visible esté traducida, no sólo el
  menú. CA: header, nav, las seis páginas, formularios, `aria-label`, placeholders, chips iniciales
  del productor, descripciones de rol de subida, etiquetas de presets, editor de timeline y de logo
  y las explicaciones de los códigos de error del servicio salen del catálogo; los ids técnicos
  (`youtube-16x9`, `software-demo`, `VOICE_MODEL_UNAVAILABLE`) se siguen mostrando tal cual **junto
  a** su traducción. Un test falla si al `es` le falta una clave del `en`, y otro falla si un
  archivo de `src/pages/` o `src/components/` vuelve a escribir copy literal en vez de `t()`.
- **US-016-007** — Como usuario nuevo quiero una guía que me diga cómo se usa cada sección y en qué
  orden. CA: `/guide` explica Projects, Library, Producer, Storyboard, Voice y Preview con lo que
  cada una decide sobre el video final, más tres flujos típicos y una tabla de presets con nombre
  legible; existe en los dos idiomas con la misma estructura y se llega desde el header, desde el
  estado vacío de projects y desde el productor.

## Tasks (detalle en tasks.json)

- **TASK-001** — `src/i18n/`: catálogo `en` (fuente de verdad tipada), catálogo `es`, `t(key, params)`
  con interpolación `{param}` y `tn(key, count, params)` para el plural mínimo, `LanguageProvider`
  + `useT()`, detección `localStorage → navigator.language → en` y persistencia. Se migra el shell
  (`app.tsx`, `studio-layout`, `service-health-badge`, `error-notice`, `projects-page`,
  `create-project-form`, `project-slug`) y se monta el `LanguageSwitch` en el header. Lo validan el
  spec de paridad `en`/`es`, el de `t`/`tn` (interpolación, clave faltante, plural), el de
  detección/persistencia y el del switch (teclado y `aria-label`).
- **TASK-002** — Biblioteca y montaje: `asset-library-page`, `asset-uploader`, `asset-roles`,
  `asset-card`, `asset-preview`, `asset-media-kind` (unidades formateadas), `montage-trigger`,
  `montage-job-panel`, `montage-presets`, `montage-capability` y los blockers de
  `timeline-edit/logo-overlay`. Los catálogos de copy (`asset-roles`, `montage-presets`) dejan de
  llevar texto y pasan a llevar **claves**; lo validan sus specs actualizados.
- **TASK-003** — Productor: `producer-page`, `producer-welcome` (chips iniciales por idioma),
  `producer-composer`, `producer-message-list`, `producer-turn-activity`, `producer-capability`.
  El texto que escribe el agente **no** se toca: sólo el chrome alrededor.
- **TASK-004** — Storyboard y voz: `storyboard-page`, `storyboard-trigger`, `storyboard-job-panel`,
  `storyboard-header-editor`, `storyboard-character-sheet`, `storyboard-scene-editor`,
  `storyboard-prompt-sheet`, `storyboard-save-bar`, `storyboard-capability`, `voice-page`,
  `voice-trigger`, `voice-picker`, `voice-job-panel`, `voice-scene-card`, `voice-capability`.
- **TASK-005** — Preview y render: `project-preview-page`, `output-preset-selector`,
  `logo-overlay-editor`, `music-mix-editor`, `clip-track-editor`, `caption-editor`,
  `timeline-issue-list`, `timeline-save-bar`, `render-trigger`, `render-job-list`,
  `render-job-panel`. Las etiquetas de preset de salida pasan a nombre legible traducido + el id.
- **TASK-006** — `/guide`: ruta perezosa nueva, contenido en los dos idiomas (una sección por
  pantalla, tabla de presets, tres flujos típicos) renderizado con el markdown mínimo que ya existe
  para el productor, entrada en el header y link "How does this work?" en el estado vacío de
  projects y en el welcome del productor. Acá aterriza el **lint casero repo-wide** de copy literal,
  que recién puede estar en verde cuando no queda ningún archivo sin migrar.
- **TASK-007** — `apps/web/e2e/i18n-smoke.mjs` contra un `render-api` real: cambiar a `es` en el
  header, medir nav, welcome del productor, roles de la biblioteca y tarjetas de voz en español,
  recargar y comprobar que persiste, y abrir `/guide` en los dos idiomas verificando que están
  todas las secciones. Capturas a `artifacts/`. Cierre: README de `apps/web`, `components.json`,
  fragmento de contexto, `global.json`, `specs/index.json` y journal.

## Decisiones técnicas

- **D-1 — El catálogo `en` es el tipo, no un archivo hermano.** `messages-en.ts` se declara
  `as const satisfies Record<string, string>`, `TranslationKey = keyof typeof EN` y el catálogo
  español se declara `Record<TranslationKey, string>`. La paridad la garantiza **`tsc`** en las dos
  direcciones (una clave que falte y una de más son errores de compilación, no de test), y el spec
  de paridad la vuelve a aserar en runtime porque los specs de esta app no se typechequean
  (lección: `tsconfig.lib.json` los excluye y Vitest no tipa). → no toca ningún registro SDD.
- **D-2 — `useT()` sin provider devuelve el catálogo `en`.** El default del contexto es el catálogo
  inglés, así que un componente montado en un test se renderiza exactamente como hoy y **las 78
  suites existentes siguen verdes sin tocarlas**: la migración cambia de dónde sale el texto, no
  qué texto sale. Sólo cambian los specs cuyo copy inglés cambia a propósito (los chips del
  productor, hoy en español) o que importaban el literal exportado.
- **D-3 — El catálogo `es` se carga perezoso (`await import('./messages-es')`).** El chunk inicial
  mide 479,33 kB contra el aviso de 500 kB: un segundo catálogo completo no entra (RNF-3). El
  provider arranca en `en`, dispara el import cuando el idioma efectivo es `es` y reemplaza el
  catálogo al resolver; `t()` sigue siendo **síncrono** en todo momento y nunca devuelve la clave
  cruda. Consecuencia aceptada y documentada: con `es` persistido hay un parpadeo en inglés en el
  primer frame, y el E2E espera el texto en español en vez de leerlo inmediatamente.
- **D-4 — Los blockers y las explicaciones de error dejan de ser `string[]` y pasan a ser
  `{ key, params? }`.** `voiceBlockers` emite `${binary.name} is not resolved (${binary.envVar})`:
  una frase con datos adentro no se traduce con una tabla de strings. Las funciones puras de
  `src/api/` siguen decidiendo **qué** bloquea (siguen siendo el único lugar que lee `health`) y el
  componente decide **cómo se dice**. Los cuatro traductores de códigos (`producerFailure…`,
  `storyboardFailure…`, `voiceFailure…` y los de transporte) pasan a devolver la clave, no la
  frase; el patrón "la UI muestra el code **y** la frase" de la constitución se conserva intacto.
- **D-5 — Ningún identificador técnico se traduce.** `youtube-16x9`, `software-demo`, `aroll`,
  `es_AR-daniela-high`, los `stage` de los jobs y los `code` de error se muestran literales, con la
  traducción al lado (el precedente ya está en `montage-presets` y en `asset-roles`, que tienen
  `name` legible junto al id). Traducir un id rompería la trazabilidad contra el servicio y los logs.
- **D-6 — El "no hay copy literal" se verifica con un scanner propio, no con un plugin de ESLint.**
  `eslint.config.mjs` está protegido por el hook `config-protection` y crear un
  `apps/web/eslint.config.mjs` está prohibido por D-9 de la constitución. La salida es
  `src/i18n/literal-copy-scan.ts`: una función pura que recibe el fuente de un `.tsx` y devuelve las
  ofensas (texto JSX y `placeholder`/`title`/`aria-label`/`alt` con tres o más letras seguidas fuera
  de una lista cerrada de tokens técnicos), con su spec de unidad sobre fixtures, más un spec
  repo-wide que la corre sobre los `.tsx` reales de `src/pages/` y `src/components/`. Al ser una
  función pura suma cobertura en vez de restarla.
- **D-7 — La guía es una ruta perezosa que reusa `producer-markdown.ts`.** El parser propio ya
  soporta encabezados, listas, **tablas**, negritas y código inline, que es exactamente lo que la
  guía necesita: el contenido de los dos idiomas viaja como texto md-like y queda **fuera del chunk
  inicial** junto con el resto del chunk de la ruta. Cero markdown nuevo, cero dependencias.
  → `sdd/components.json`: `GuidePage` y `LanguageSwitch` nuevos, `StudioLayout` `updated`.
- **D-9 — `/projects/:slug` pasa a ser una ruta perezosa, medido.** Un catálogo plano compartido
  vive por definición en el chunk inicial, así que migrar el copy de las pantallas perezosas lo
  **mueve hacia** la entrada: con sólo el shell migrado el chunk inicial ya había pasado de
  479,33 kB a **488,63 kB** contra el tope de 500 kB, y faltaban unas 340 claves. La biblioteca de
  assets era la última ruta que se importaba de forma estática sin ser la de aterrizaje: volverla
  `lazy` como las otras cuatro (la unidad de bundle documentada de esta app) sacó
  `asset-uploader`, `asset-card`, `montage-trigger`, `asset-roles` y `montage-presets` de la
  entrada y la dejó en **466,25 kB**, con `asset-library-page` (14,71 kB) y `asset-uploader`
  (6,98 kB) como chunks propios. Es el margen real con el que entra el catálogo completo.
- **D-8 — Los mensajes del productor no se traducen; los chips sí.** Lo que escribe el agente ya
  viene en el idioma del usuario y reescribirlo sería inventar. Los chips de arranque, en cambio,
  son copy de la UI que *se convierte* en un mensaje: se emiten en el idioma activo, así que en
  inglés dejan de estar en español (es el único texto que cambia a la vista en el idioma `en`).
