# SPEC-e-burgos-012: Caption Styles: Catálogo de Estilos por Proyecto y por Escena

> Estado: **draft** — esqueleto redactado al registrar el backlog generativo (2026-09-09).
> Se detalla al abrir su `cycle-01`.

## Resumen Ejecutivo

`spec-e-burgos-003` entregó **un** estilo de kinetic captions: 1-3 palabras por pantalla con
resaltado de impacto, safe zones por red y presets tipográficos. Funciona, pero todos los videos
del producto se ven iguales, y las captions son la firma visual más reconocible de un video para
redes. Esta spec convierte ese estilo único en un **catálogo de 4-5 estilos** más la opción `off`,
elegible por proyecto y sobrescribible por escena, seleccionable tanto desde el storyboard (la IA
propone uno) como desde la UI.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev (2026-09-09): *"catálogo de 4-5 estilos sobre spec-003 + `off`, por proyecto
y por escena, selector en UI y en el storyboard"*.

## Evidencia y decisiones

- **Evidencia (`libs/composition-remotion`, `spec-003`):** el componente de captions cinéticas ya
  separa el cálculo de agrupación de palabras (en `libs/timeline-core`) del render. Un catálogo de
  estilos es una **variación de render**, no un motor nuevo: el cálculo se comparte.
- **Evidencia (referencia analizada: "AI Code King clone with Remotion, Gemini & TTS", Ambsd):**
  el estilo de captions es parte de la identidad del canal y se elige una vez por proyecto, no por
  video; la excepción por escena existe para los momentos que piden otra cosa.
- **Evidencia (`spec-e-burgos-008` → `StoryboardDocument`):** el documento ya lleva `captionsStyle`
  a nivel de proyecto y opcional por escena. Esta spec le da un catálogo real a ese campo, que
  hasta entonces es un string libre.
- **Evidencia (`sdd/memory/lessons.md`):** declarar como `type` (nunca `interface`) los props de
  componentes de librerías genéricas y **omitir** las claves opcionales en vez de asignar
  `undefined` (`exactOptionalPropertyTypes`).
- **Decisión prevista:** `off` es un valor del catálogo, no un booleano aparte: un video sin
  captions es una elección de estilo, y modelarlo como flag duplicaría el estado.

## Plan de ciclos (previsto)

| Ciclo | Fase | Flow | Qué entrega |
| --- | --- | --- | --- |
| **cycle-01** | `caption-style-catalog` | `lite` | En `libs/composition-remotion` + `libs/timeline-core`: el catálogo de estilos con sus tokens tipográficos y de animación, `off` incluido, resolución por escena con fallback al estilo del proyecto, y su registro en el contrato de la `Timeline`. |
| **cycle-02** | `caption-style-studio` | `lite` | En `apps/web`: selector de estilo con vista previa real en el Player, por proyecto y por escena, y el mismo selector dentro del editor de storyboard. |

## Requisitos Funcionales previstos (RF)

- **RF-1:** El catálogo expone 4-5 estilos con nombre estable más `off`, cada uno con sus tokens de
  tipografía, color, resaltado y animación.
- **RF-2:** El estilo se fija por proyecto y se sobrescribe por escena; la resolución tiene un
  único orden documentado (escena gana sobre proyecto).
- **RF-3:** `off` produce un render sin captions, sin ramas especiales en el resto del pipeline.
- **RF-4:** Las safe zones por red (`spec-003`) se respetan en **todos** los estilos.
- **RF-5:** El storyboard puede proponer un estilo, y el usuario puede cambiarlo sin regenerar.

## Requisitos No-Funcionales previstos (RNF)

- **RNF-1:** Cero dependencias npm nuevas salvo justificación escrita.
- **RNF-2:** `lint test build` en verde sin warnings; cobertura por encima del piso.
- **RNF-3:** Ningún estilo cambia el contrato de agrupación de palabras ya cerrado por `spec-003`.
- **RNF-4:** Sin comentarios en el código; payloads y README en inglés.

## Dependencias

- Subproyectos previstos: `libs/composition-remotion`, `libs/timeline-core`, `apps/web`.
- `spec-e-burgos-003-kinetic-captions` — completed (el estilo base y las safe zones).
- `spec-e-burgos-008-ai-storyboard` — el campo `captionsStyle` del documento.

## Criterios de Aceptación previstos (CA)

- **CA-001:** Un test por estilo verifica sus tokens y su render dentro de las safe zones.
- **CA-002:** Un test verifica el orden de resolución escena → proyecto.
- **CA-003:** Un test verifica que `off` no emite captions y no altera ninguna otra pista.
- **CA-004:** Smoke real ejecutado: un render por estilo, comparado contra el `sha256` del
  artefacto y con el oráculo probado sensible.
