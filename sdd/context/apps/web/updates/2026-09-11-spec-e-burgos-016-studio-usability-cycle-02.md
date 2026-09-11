# spec-e-burgos-016-studio-usability cycle-02 — 2026-09-11

## Estado
La app se lee entera en **español o en inglés** y ahora se explica a sí misma. El header suma un
switch `en | es` (junto al health badge) que cambia toda la UI al instante, persiste en
`localStorage` y estampa `documentElement.lang`; el idioma inicial sale de `localStorage` →
`navigator.languages` (`es-*` → `es`) → `en`. **Todo el copy visible** pasó a claves: header, nav,
las seis pantallas, formularios, `aria-label`, placeholders, chips de arranque del productor,
descripciones de rol de subida, presets de montaje y de salida, editor de timeline, panel de logo y
las explicaciones de los códigos de error del servicio. Se suma `/guide`, una ruta perezosa que
explica cada sección del studio, la tabla de presets de salida y tres flujos típicos, en los dos
idiomas. Suite: **86 archivos / 861 tests**, 99,25 % stmts · 95,61 % branch · 99,4 % funcs ·
99,28 % lines, piso 80 % y `coverage.include` sin recortar. **Cero dependencias npm nuevas.**

## Estructura
- `src/i18n/`: `messages-en.ts` es la **fuente de verdad tipada** (`{...} as const satisfies
  Record<string,string>` → `TranslationKey = keyof typeof MESSAGES_EN`); `messages-es.ts` se declara
  `Messages = Readonly<Record<TranslationKey, string>>`, así que **una clave faltante o de más es un
  error de `tsc`**, no un test que puede olvidarse. `messages-parity.spec.ts` lo vuelve a aserar en
  runtime (los specs de esta app SÍ se typechequean en `build`, pero el chequeo en runtime también
  cubre placeholders divergentes y variantes de plural incompletas).
- `translate.ts`: `t(key, params)` con interpolación `{param}` (un placeholder sin valor queda tal
  cual, nunca `undefined`) y `tn(key, count, params)` que elige `<key>.one` / `<key>.other` — las
  dos variantes son claves normales, así que el plural no escapa al chequeo de paridad.
- `language-context.tsx`: `LanguageProvider` + `useLanguage()` + `useT()` + `useTn()`.
  **`useT()` sin provider devuelve el catálogo inglés**: por eso la migración no tocó ninguna de las
  78 suites que aseran texto en inglés — cambió de dónde sale el texto, no qué texto sale.
- **El catálogo `es` se carga perezoso** (`await import('./messages-es')`, 26,38 kB de chunk propio):
  con el `en` completo el chunk inicial ya rozaba el tope. Mientras resuelve, `t()` sigue siendo
  síncrono y cae al inglés — hay un parpadeo de un frame al reabrir en español, y el E2E espera el
  texto en vez de leerlo de inmediato.
- `src/api/blockers.ts`: `Blocker = { key, params? }`. Los cuatro `*Blockers(health)` y los cuatro
  `*FailureKey(code)` devuelven **claves**, no frases: `voiceBlockers` emitía
  `${binary.name} is not resolved (${envVar})` y una frase con datos adentro no se traduce con una
  tabla de strings. Las funciones puras siguen decidiendo *qué* bloquea; el componente decide *cómo
  se dice*. `blockerId()` da la React key cuando dos blockers comparten clave con params distintos.
- `src/guide/`: `guide-content-en.ts` / `guide-content-es.ts` (8,9 y 9,4 kB, **chunks propios**) con
  ocho secciones md-like; `guide-content.ts` las carga por idioma. `pages/guide-page.tsx` las dibuja
  con `ProducerMarkdown` — el parser propio ya soportaba tablas, así que la guía no trajo markdown
  nuevo ni una dependencia.
- `src/i18n/literal-copy-scan.ts` + `no-literal-copy.spec.ts`: el "no hay copy literal" se verifica
  con un scanner propio (borra las expresiones `{...}` y después busca texto JSX y
  `placeholder`/`title`/`aria-label`/`alt` con tres letras seguidas fuera de una lista cerrada de
  tokens técnicos), corrido sobre los 44 `.tsx` de `app`, `components` y `pages` vía
  `import.meta.glob(..., { query: '?raw' })`. **No es un plugin de ESLint** porque
  `eslint.config.mjs` está protegido por el hook y D-9 prohíbe un config propio de la app.
  `literal-copy-scan.spec.ts` prueba el oráculo **rompiéndolo aposta**: seis fixtures con copy
  plantada que tiene que detectar.

## Dependencias
Ninguna npm nueva (RNF-1 de la spec). Ningún cambio en `apps/render-api` ni en el contrato: este
ciclo no tocó `sdd/api.json`.

## Qué sigue
- **`/projects/:slug` es ahora una ruta perezosa.** No era la de aterrizaje y era la última que se
  importaba estática: volverla `lazy` devolvió 22 kB al chunk inicial (488,63 → 466,25 kB) y es lo
  que permitió que entrara el catálogo `en` completo. Medición vigente: inicial **490,17 kB**,
  `messages-es` 26,38 kB, `project-preview-page` 370,75 kB, `storyboard-page` 31,68 kB,
  `voice-page` 21,57 kB, `producer-page` 15,84 kB, `asset-library-page` 14,31 kB,
  `guide-content-es` 9,37 kB, `guide-content-en` 8,90 kB — **sin** el aviso de 500 kB, con ~10 kB de
  margen: **una pantalla nueva que sume muchas claves vuelve a apretar la entrada.**
- **Lo que NO se traduce, a propósito:** el texto que escribe el agente productor (viene en el idioma
  del usuario), el `label` y la `description` que publica `GET /voices` (dato del catálogo del
  servicio, derivado del `.onnx.json`), el `message` de un error del servicio (se muestra como línea
  técnica cuando hay explicación traducida) y las etiquetas de `errorDetailLines`
  (`resource:`/`expected:`/`hint:`/`stage:`, nombres de campo del payload).
- **Los `data-*` nuevos son contrato de Playwright**: `language-switch` (con `data-language` por
  botón), `guide-nav`, `guide`, `guide-index`, `guide-section` (con `data-guide-section` y
  `data-guide-language`) y `error-technical-detail`.
- El switch **no ofrece un tercer idioma**: agregar uno es agregar el módulo, sumarlo a `LANGUAGES`
  y dejar que `tsc` señale cada clave faltante (documentado en el README de la app).
- La guía es **texto fijo**: no se genera de los catálogos, pero `guide-content.spec.ts` falla si un
  preset de montaje o de salida deja de estar tabulado con su id y su etiqueta legible, así que no
  puede derivar en silencio.
