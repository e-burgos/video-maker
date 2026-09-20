# FIX-e-burgos-015-005 — No hay receta predefinida que repita un video que ya salió bien

| Campo         | Valor                             |
| ------------- | --------------------------------- |
| **ID**        | FIX-e-burgos-015-005              |
| **Tipo**      | IMPROVEMENT                       |
| **Severidad** | low                               |
| **Keyword**   | [IMPROVEMENT]                     |
| **Fecha**     | 2026-09-20                        |
| **Autor**     | e-burgos                          |
| **Estado**    | implemented                       |
| **Spec**      | spec-e-burgos-015-studio-producer |
| **Origen**    | Pedido del dev tras producir `media/display-ads`. |

## Problema

La versión buena de `crear-campana-display-ads` salió de una combinación concreta de parámetros
(formato, preset, voz, estilo de subtítulos, música, logo, placas de inicio y cierre) que el dev
fue acordando con el productor a lo largo de varios turnos y de cinco fixes. Para repetirla en el
próximo tutorial hay que acordarse de todo eso otra vez: el tab productor sólo ofrece sugerencias
sueltas de una línea.

## Solución

1. **Recetas en la web.** La bienvenida del productor suma una fila **Recetas** encima de las
   sugerencias sueltas, con un chip destacado **Tutorial**. Al tocarlo el compositor se rellena con
   el prompt completo de la receta **en el idioma de la UI**, editable, con un hueco explícito para
   lo único que el productor no puede saber: la tabla de escenas con tiempos.
2. **El productor entiende la receta.** Las reglas de la app y la skill `video-producer` (§9)
   definen la receta Tutorial: nombrada, el agente aplica `youtube-16x9`, preset `educational`,
   `voice: script`, `captionStyle: subtle-lower`, voz `es_AR-daniela-high` con marcas de tiempo,
   música libre suave acreditada, el logo con alfa `bottom-right` 0.18/0.5 y los bumpers de 2 s
   blancos (intro `slide-up`, outro `zoom`) por `PUT` de la timeline, **sin volver a preguntar**.
   Sólo pide lo que falta: el guion con tiempos (o permiso para mirar el video y proponerlo) y, si
   hay más de un logo con transparencia, cuál.

## Por qué la receta vive en dos lados

El chip escribe el pedido en lenguaje común (regla FIX-015-003: el usuario nunca ve un id de preset
ni de formato), y el system prompt es quien traduce ese pedido a parámetros. Si la receta viviera
sólo en la web, el prompt tendría que enumerar ids y rompería esa regla; si viviera sólo en el
prompt, el usuario tendría que adivinar la palabra que la dispara.

## Coste del bundle

Los textos largos de la receta **no entran al chunk inicial**: viven en
`apps/web/src/api/producer-recipe-prompts.ts`, un módulo que `loadRecipePrompt` importa con
`await import()` recién al tocar el chip. Al catálogo `en` (que sí está en el chunk inicial) sólo
se suman el nombre y la descripción del chip; el resto del catálogo `es` ya era perezoso.

## Justificación del bypass del SPEC GATE

Perfil `solo`. Copy de UI más texto de prompt y de skill: no crea endpoints, entidades ni
contratos. No hay ciclo abierto sobre spec-015.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
