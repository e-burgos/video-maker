# spec-e-burgos-008-ai-storyboard cycle-02 — 2026-09-09

## Estado
El Web Studio gana su **segundo punto de partida**: además de "grabé a cámara" (montaje), ahora se
arranca desde una **idea**. `/projects/:slug/storyboard` propone el storyboard con el agente local
(`EP-012` `kind: 'storyboard'`, brief **o** guion pegado/subido), muestra las tres etapas
`collect|propose|persist` con el aviso en pantalla de que `propose` es una llamada real al modelo y
tarda más de un minuto, edita el documento entero escena por escena y lo persiste con un único `PUT`
(`EP-017`), y entrega la hoja numerada de prompts (`EP-018`) al portapapeles **tal cual la emite el
servicio**. El 409 se maneja como confirmación de sobreescritura (mismo patrón que el montaje) y los
cuatro códigos del agente se traducen a lenguaje de usuario junto a su código. La spec cierra acá.
Suite: **57 archivos / 468 tests**, 99,19 % stmts · 95,46 % branch · 98,96 % funcs · 99,48 % lines,
piso 80 % y `coverage.include` sin recortar. Cero dependencias npm nuevas.

## Estructura
- `src/api/render-api-types.ts`: tercera rama de la unión `Job` (`StoryboardJob`,
  `STORYBOARD_STAGES`, `StoryboardJobProgress`, `StoryboardJobReport` con su `usage`),
  `storyboardQueue` en `ServiceCapabilities` y la etapa de storyboard en `RenderJobSummary`.
  `parse-render-job.ts` suma `parseStoryboardJob`, que **rechaza** los otros dos `kind`.
- `src/api/storyboard-capability.ts`: `storyboardBlockers(health)` (sólo `storyboardQueue`: el
  agente no usa ningún binario de media) y `storyboardFailureExplanation(code)`, el único lugar que
  traduce un código del agente a una frase para el usuario.
- **`StoryboardDocument`/`StoryboardDocumentSchema` se importan de `@video-maker/timeline-core`, no
  se replican.** D-5 prohíbe importar de otra app o de una lib Node; `timeline-core` es Zod puro y
  ya era la fuente de `Timeline`. Lo que sí se declara acá es el contrato **HTTP** (job, etapas,
  reporte, capabilities).
- `src/api/parse-storyboard.ts` (validación de la respuesta) y `src/api/storyboard-edit/` (editores
  inmutables + `storyboardIssues`, espejo de cliente del 422) **entran sólo por el chunk perezoso**:
  `render-api-client.getStoryboard` usa el mismo chequeo superficial que `getTimeline` y la página
  valida. Medido con `vite build`: importar Zod desde el cliente subió el chunk inicial de 466 kB a
  **580 kB** y reapareció el aviso de "chunks larger than 500 kB"; con la corrección quedó en
  470 kB · `storyboard-page` 33 kB · `project-preview-page` 364 kB · 110 kB compartidos.
- Componentes nuevos: `StoryboardTrigger` (COMP-027), `StoryboardJobPanel` (COMP-028),
  `StoryboardHeaderEditor` (029), `StoryboardCharacterSheet` (030), `StoryboardSceneEditor` (031),
  `StoryboardSaveBar` (032), `StoryboardPromptSheet` (033), `StoryboardPage` (034).
  `src/api/clipboard.ts` es el único acceso al portapapeles y nunca lanza.
- `StudioLayout` gana un **nav por proyecto** (`library · storyboard · preview`) derivado del
  `pathname` con `projectSlugFromPathname` (el layout es padre de las rutas `:slug`, así que
  `useParams` no lo ve); la biblioteca suma "open storyboard".
- **Cada control lleva `aria-label` explícito.** React renderiza el valor de un `<textarea>` y las
  `<option>` de un `<select>` como hijos del `<label>` que los envuelve: sin `aria-label` el nombre
  accesible es el texto de la etiqueta **más el valor actual**, y `getByLabel(..., { exact: true })`
  de Playwright deja de encontrarlo (costó una corrida del E2E).
- E2E: `e2e/storyboard-smoke.mjs` sobre `smoke-helpers.mjs`, con `claude -p` real.

## Dependencias
Ninguna nueva. Consume de `apps/render-api` el contrato de `cycle-01` **sin modificarlo**:
`EP-001` (`capabilities.storyboardQueue`), `EP-012` (`kind: 'storyboard'`, `brief` XOR `scriptText`,
`overwrite`, 409/422/429/502/503), `EP-014` (etapas y reporte del job), `EP-016`, `EP-017` y
`EP-018`. `sdd/api.json` no se tocó. El E2E no necesita `loadRootEnv()`: el agente no usa ffmpeg ni
whisper.

## Qué sigue
- **`captionsStyle`, `musicTags` y `sfxTags` se editan como texto libre**: quedan a la espera del
  catálogo de estilos (`spec-012`) y del banco de audio (`spec-011`), que los cerrarán a un enum.
- **No hay reordenar, agregar ni borrar escenas** desde la UI: sólo se editan las que el agente
  propuso. El `index` es la posición y el schema lo verifica, así que agregar una escena obliga a
  reindexar todo el documento; es trabajo de `spec-010` o `spec-013`.
- **La hoja de prompts se lee del documento guardado**, así que con cambios sin guardar copia los
  prompts previos. La UI lo avisa en pantalla en vez de guardar sola.
- **`StoryboardJobPanel` no cancela** el job (`EP-015` lo soporta), y una llamada al agente en curso
  sigue corriendo aunque se abandone la página.
- El `usage` del reporte (tokens y costo del agente) llega a la UI pero no se muestra: candidato a
  una vista de costos del proyecto.
