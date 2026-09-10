# SPEC-e-burgos-013: Premium Timeline: Edición Multipista Visual

> Estado: **draft** — esqueleto redactado al registrar el backlog generativo (2026-09-09).
> Se detalla al abrir su `cycle-01`.

## Resumen Ejecutivo

Al cerrar `spec-011` el producto sabe llegar solo desde una idea hasta un MP4, pero la edición fina
sigue siendo la de `spec-006` `cycle-03`: formularios que reordenan escenas y ajustan niveles. Con
cinco pistas en juego (escenas, voz, música, efectos y captions) eso deja de alcanzar. Esta spec
entrega la **timeline multipista visual**: las cinco pistas dibujadas en escala de tiempo, recorte
y reordenamiento por drag, playhead sincronizado en los dos sentidos con el Player de Remotion, un
inspector por escena y subida drag&drop de varios archivos a la vez. Es la última spec del backlog
generativo: la que hace que el producto se sienta un editor y no un formulario.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev (2026-09-09): *"timeline multipista visual (escenas, voz, música, sfx,
captions), drag para recortar/reordenar, playhead sincronizado con el Player, inspector por escena,
subida drag&drop multi-archivo"*.

## Evidencia y decisiones

- **Evidencia (`apps/web`, `spec-006` `cycle-03`):** la edición del documento persistido ya existe
  y ya se refleja en el Player antes de guardar, con **un único `PUT` completo**. Esta spec cambia
  la **superficie de edición**, no el modelo de persistencia: el `PUT` completo se mantiene.
- **Evidencia (`apps/web`, dependencia npm propia):** `@remotion/player` es la única dependencia
  npm propia de la app. El playhead se sincroniza con su API, no con un reloj paralelo.
- **Evidencia (`sdd/memory/lessons.md`):** verificar una UI **midiendo en el navegador** el estado
  del medio (`readyState`, `duration`, `videoWidth/Height`), nunca la captura ni el `src`; y el MCP
  de Playwright de este arnés no abre navegador — anda el Playwright cacheado en `~/.npm/_npx` con
  `chromium.launch({ channel: 'chrome' })`, comprobado al **abrir** el ciclo.
- **Decisión prevista:** la timeline visual es **una vista sobre el documento**, no un segundo
  modelo de datos. Toda interacción se traduce a una mutación del documento persistido; no hay
  estado de edición que sobreviva fuera de él.

## Plan de ciclos (previsto)

| Ciclo | Fase | Flow | Qué entrega |
| --- | --- | --- | --- |
| **cycle-01** | `multitrack-view` | `lite` | Las cinco pistas dibujadas en escala de tiempo con zoom, playhead sincronizado en los dos sentidos con el Player, y selección de clip. |
| **cycle-02** | `multitrack-editing` | `lite` | Drag para recortar y reordenar, inspector por escena, subida drag&drop multi-archivo, y el `PUT` completo del documento editado. Cierra la spec y el backlog generativo. |

## Requisitos Funcionales previstos (RF)

- **RF-1:** Las cinco pistas (escenas, voz, música, sfx, captions) se dibujan en una escala de
  tiempo común, con zoom y scroll horizontal.
- **RF-2:** El playhead está sincronizado en **los dos sentidos** con el Player: mover el playhead
  mueve el Player y reproducir mueve el playhead.
- **RF-3:** Recortar y reordenar por drag produce mutaciones del documento persistido, visibles en
  el Player antes de guardar.
- **RF-4:** El inspector muestra y edita las propiedades de la escena seleccionada.
- **RF-5:** La subida acepta varios archivos a la vez por drag&drop, con la convención numerada de
  `spec-010` cuando aplica.
- **RF-6:** Nada de lo editable hoy deja de serlo: la superficie previa se reemplaza sin perder
  capacidades.

## Requisitos No-Funcionales previstos (RNF)

- **RNF-1:** Sin dependencias npm nuevas salvo justificación escrita: la timeline se dibuja con lo
  que la app ya tiene.
- **RNF-2:** `lint test build` en verde sin warnings; cobertura por encima del piso.
- **RNF-3:** La frontera con el servicio sigue confinada a `src/api/`.
- **RNF-4:** Verificación en navegador real midiendo el estado del medio, no la captura.
- **RNF-5:** Sin comentarios en el código; identificadores y README en inglés.

## Dependencias

- Subproyecto previsto: `apps/web`.
- `spec-e-burgos-010-scene-assembly` — las escenas y su ensamblado.
- `spec-e-burgos-011-audio-library` — la pista `sfx`.
- `spec-e-burgos-012-caption-styles` — la pista de captions y su estilo.

## Criterios de Aceptación previstos (CA)

- **CA-001:** Un test verifica que cada pista dibuja los clips del documento en la escala correcta.
- **CA-002:** Un test verifica la sincronización del playhead en los dos sentidos.
- **CA-003:** Un test verifica que recortar y reordenar produce exactamente la mutación esperada
  del documento.
- **CA-004:** E2E en navegador real: de un storyboard ensamblado a un MP4 descargado, midiendo el
  estado del medio en el DOM.
