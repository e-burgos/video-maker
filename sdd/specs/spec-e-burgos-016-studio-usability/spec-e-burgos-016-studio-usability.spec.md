# SPEC-e-burgos-016: Studio Usability: voces con preview, roles explicados, i18n y guía

> Estado: **in-progress** — registrada el 2026-09-11. Dos ciclos, flow `lite`.
> `cycle-01 voices-and-roles` (puntos 1 y 3 del pedido) · `cycle-02 i18n-and-guide` (puntos 2 y 4).
> Depende de `spec-006-web-studio` (la app), `spec-009-voice-over` (`GET /voices`, job `voice`) y
> `spec-015-studio-producer` (el productor como punto de partida).

## Resumen Ejecutivo

El Web Studio ya hace todo lo que el motor puede hacer, pero **no se explica**. El dev lo usó de
punta a punta y trajo cuatro fricciones concretas de usabilidad, todas del mismo tipo: la app expone
la potencia del motor con el vocabulario del motor, y el usuario tiene que saber de antemano qué
significa cada opción para elegir bien.

Los síntomas: el selector `Upload to` ofrece seis roles con su id crudo (`aroll`, `broll`, `image`,
`audio`, `voice`, `logo`) sin decir qué le hace cada uno al video final; el selector de voz ofrece
un id de archivo Piper (`es_AR-daniela-high`) y una sola voz, sin forma de escucharla antes de
gastar una síntesis completa; la interfaz está en inglés sin alternativa; y no hay ningún lugar que
cuente cómo se usa cada sección.

Esta spec no agrega capacidad al motor: **hace legible la que ya existe**.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

### Pedido literal del dev (2026-09-11)

> 1. "En el selector de Upload to dentro de library, las opciones deben ir acompañadas por una
>    descripción de qué significa esa opción y cómo impacta en el video final."
> 2. "En el header debe haber un switch de idioma `en` y `es` para que la plataforma esté en español
>    e inglés."
> 3. "En voice solo tenemos la opción de es_AR-daniela-high, debemos tener al menos 3 opciones de
>    diferentes voces con un preview/demo de la voz para ver si al usuario le gusta."
> 4. "Agregá una sección de guía indicando al usuario cómo se utiliza cada sección."

Los cuatro puntos son de la misma familia (el producto no se explica) pero de dos naturalezas
técnicas distintas, y por eso van en dos ciclos:

- **1 y 3** tocan contenido de dominio: qué significa cada rol para el motor de montaje, y qué voces
  hay instaladas con qué timbre. El 3 además **necesita backend**: el catálogo de voces hoy publica
  el id del archivo y nada más, y escuchar una voz exige sintetizar.
- **2 y 4** son transversales a toda la app: un mecanismo de traducción que alcanza cada pantalla, y
  una sección nueva que describe todas las secciones. El 2 necesita que los textos del 1 y del 3 ya
  estén centralizados en un módulo para poder traducirlos.

El orden es forzado: **el ciclo 1 deja los textos en un solo lugar y el ciclo 2 los traduce.**

## Alcance

### `cycle-01 voices-and-roles` — puntos 1 y 3

**Backend (`apps/render-api`)**

- `GET /voices` (`EP-019`, `updated`) enriquece cada voz: además de `id`, `fileName` e `isDefault`,
  publica `language { code, region }`, `quality`, `label` legible, `description` y `previewUrl`.
  Los metadatos salen del `.onnx.json` que acompaña a cada modelo Piper; sin él, se derivan del
  nombre del archivo. **Nada se inventa**: ni edad, ni género, ni carácter de la voz.
- `GET /voices/:id/preview` (endpoint nuevo) sintetiza con Piper una frase fija en español de unos
  cuatro segundos la primera vez, la cachea fuera de `media/` y la sirve como `audio/wav` con
  `Cache-Control`. `404 VOICE_NOT_FOUND` para un id que no existe, `503 VOICE_MODEL_UNAVAILABLE` si
  Piper no está. **Fuera de la cola de jobs** (es una síntesis corta y la cola tiene concurrencia 1:
  un preview detrás de un render de diez minutos no es un preview), con exclusión por voz.

**Frontend (`apps/web`)**

- La página de voz muestra **tarjetas** de voz con su etiqueta, idioma/región, calidad y un botón de
  reproducción que suena en el navegador, en lugar del `<select>` de ids crudos. La seleccionada
  queda marcada y es la que usa el job `voice`.
- El selector de rol del `AssetUploader` muestra, para cada rol, un nombre legible y una línea de
  qué es y cómo impacta en el video final, ordenados por importancia (A-roll primero) y marcando
  cuáles son obligatorios, más la ayuda contextual del matching de B-roll por nombre de archivo.
- **Todo ese copy vive en un solo módulo** para que `cycle-02` lo traduzca sin tocar componentes.
- Se aplican los textos de las sugerencias iniciales del productor que dejó escritos
  `FIX-e-burgos-007-002` (preguntar plataforma antes que material).

### `cycle-02 i18n-and-guide` — puntos 2 y 4

- Switch `en`/`es` en el header, con la preferencia persistida, alcanzando todo el copy de la app.
- Sección de guía que explica cada sección del studio (productor, biblioteca, storyboard, voz,
  preview y render) y cómo encadenarlas.

## Fuera de alcance

- Cualquier cambio en el motor de montaje, la composición o la mezcla.
- Descargar o instalar voces Piper desde la app: las voces se instalan en la máquina y el servicio
  las descubre. La app las lista y las explica, no las administra.
- Elegir la voz **por escena** (el selector sigue siendo del proyecto, laguna anotada en el contexto
  de `apps/web` desde `spec-009` c02).
- Traducir los documentos SDD, los payloads de máquina, los `code` de error o los logs: la
  traducción del `cycle-02` es de copy de UI, nada más.
- Dependencias npm nuevas, en los dos ciclos.

## Requisitos no funcionales

- **RNF-1** — Cero dependencias npm nuevas: ni de i18n, ni de reproducción de audio.
- **RNF-2** — La cobertura de los dos subproyectos se mantiene sobre el piso de 80 % **sin recortar
  `coverage.include`**.
- **RNF-3** — El chunk inicial de Vite sigue sin el aviso de 500 kB.
- **RNF-4** — El preview de voz no bloquea la cola de jobs ni deja archivos dentro de `media/`.
- **RNF-5** — Cada ciclo cierra con evidencia real de Playwright contra un `render-api` real, y una
  UI se verifica midiendo el estado del medio en el navegador, nunca la captura.
- **RNF-6** — Copy, identificadores y commits en inglés; documentos SDD en español. El copy en
  español del `cycle-02` es dato del catálogo de traducción, no identificadores.

## Criterios de aceptación de la spec

- **CA-S1** — `GET /voices` publica las tres voces instaladas con etiqueta legible, idioma, calidad
  y `previewUrl`, y ningún dato que el modelo no documente.
- **CA-S2** — El usuario escucha una voz desde la app antes de generar la locución, y la segunda
  reproducción de la misma voz sale del caché.
- **CA-S3** — Cada opción de `Upload to` llega acompañada de qué es y cómo impacta en el video.
- **CA-S4** — (`cycle-02`) Toda la app se ve en español o en inglés según el switch del header.
- **CA-S5** — (`cycle-02`) Existe una sección que explica cómo se usa cada sección del studio.
