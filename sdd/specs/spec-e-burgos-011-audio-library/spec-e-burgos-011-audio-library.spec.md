# SPEC-e-burgos-011: Audio Library: Música y Efectos de Banco Libre

> Estado: **draft** — esqueleto redactado al registrar el backlog generativo (2026-09-09).
> Se detalla al abrir su `cycle-01`.

## Resumen Ejecutivo

Hoy la música de un proyecto es un archivo que el dev deja a mano en `raw/audio/`, y los efectos
de sonido no existen. Esta spec crea una **biblioteca de audio compartida entre proyectos** en
`media/_library/audio/`, con un índice etiquetado, sincronizada desde **Pixabay** (cuenta
gratuita, key en `.env`), y agrega la pista `sfx` a la `Timeline`, a la composición Remotion y a la
mezcla. La IA del storyboard ya emite etiquetas de música y de efectos por escena
(`musicTags`, `sfxTags`): esta spec las convierte en selección real de pistas, con la última
palabra siempre del usuario, que puede fijar una pista o vetarla.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev (2026-09-09): *"música y efectos de un banco libre"*, con **Pixabay**
(cuenta gratuita, key en `.env`, nunca en el chat). **HeartMuLa** (generación musical open source)
quedó **descartado** por requerir GPU NVIDIA, que esta máquina no tiene.

## Evidencia y decisiones

- **Decisión del dev (2026-09-09):** el banco es Pixabay con cuenta gratuita; la key vive en el
  `.env` raíz, **nunca** en el repo ni en un documento. La generación musical local se descartó por
  requisito de hardware, no por licencia.
- **Evidencia (referencia analizada: "Automatiza la Creación de Videos con IA", Camino Digital):**
  la música y los efectos se eligen **por etiqueta/mood**, no por nombre de archivo, y es lo que
  permite automatizar la selección sin que el resultado suene siempre igual.
- **Evidencia (`libs/media-local`, `spec-004`):** el grafo de mezcla ya sostiene voz + música con
  ducking automático a -24 dB y máster limitado. Una tercera pista entra por el mismo constructor
  de filtergraph, no por una mezcla nueva.
- **Evidencia (`libs/timeline-core`):** las pistas de la `Timeline` son un contrato Zod: agregar
  `sfx` es un cambio de contrato que obliga a revisar composición, mezcla y los dos productores de
  `Timeline`.
- **Evidencia (`sdd/memory/lessons.md`):** nunca copiar el union de códigos de error de otra lib;
  derivarlo o estrecharlo en la frontera con un type guard sobre una lista propia.
- **Decisión prevista:** la biblioteca es **compartida entre proyectos** y vive fuera de
  `media/<slug>/` para no duplicar megabytes por proyecto; su índice es un documento versionado con
  schema propio, igual que el catálogo.

## Plan de ciclos (previsto)

| Ciclo | Fase | Flow | Qué entrega |
| --- | --- | --- | --- |
| **cycle-01** | `library-and-sfx-track` | `lite` | `media/_library/audio/index.json` con schema propio y etiquetas; pista `sfx` en `Timeline`, composición y mezcla; sincronización desde Pixabay por un puerto inyectable, con la key leída del entorno. |
| **cycle-02** | `library-studio` | `lite` | En `apps/web`: navegación de la biblioteca por etiqueta, escucha previa, selección de música por proyecto y de efectos por escena, y fijar/vetar lo que eligió la IA. |

## Requisitos Funcionales previstos (RF)

- **RF-1:** `media/_library/audio/index.json` describe cada pista con id, ruta, tipo
  (`music | sfx`), duración, etiquetas, fuente y licencia.
- **RF-2:** La sincronización desde Pixabay entra por un puerto inyectable; la key se lee del
  entorno y **nunca** se persiste, se loguea ni aparece en un payload.
- **RF-3:** La `Timeline` gana la pista `sfx`, y la composición Remotion y el grafo de mezcla la
  respetan con su propio nivel y sin romper el ducking vigente de la música.
- **RF-4:** La selección automática elige por las etiquetas que el storyboard ya emite
  (`musicTags`, `sfxTags`).
- **RF-5:** El usuario puede **fijar** una pista (la IA no la cambia) o **vetarla** (nunca se
  elige), y esa decisión se persiste.
- **RF-6:** Un proyecto sin biblioteca sincronizada sigue funcionando: la ausencia de banco no es
  un error del render.

## Requisitos No-Funcionales previstos (RNF)

- **RNF-1:** **Ningún secreto en el repo.** La key de Pixabay se documenta por nombre en el README
  y en el contexto del subproyecto, nunca con su valor.
- **RNF-2:** La suite corre sin red: la sincronización se testea contra un doble del puerto.
- **RNF-3:** Cero dependencias npm nuevas salvo justificación escrita.
- **RNF-4:** `lint test build` en verde sin warnings; cobertura por encima del piso.
- **RNF-5:** Sin comentarios en el código; payloads y README en inglés.

## Dependencias

- Subproyectos previstos: `libs/timeline-core`, `libs/media-local`, `libs/composition-remotion`,
  `apps/render-api`, `apps/web`.
- `spec-e-burgos-010-scene-assembly` — los dos productores de `Timeline` que deben emitir la pista.
- `spec-e-burgos-004-audio-mix-mastering` — completed (mezcla, ducking, máster).
- Servicio externo: Pixabay (cuenta gratuita).

## Criterios de Aceptación previstos (CA)

- **CA-001:** Un test verifica el schema del índice y su rechazo ante entradas inválidas.
- **CA-002:** Un test verifica que la key nunca sale en un payload, un log ni un archivo del repo.
- **CA-003:** Un test verifica el grafo de mezcla con las tres pistas y el ducking intacto.
- **CA-004:** Un test verifica que fijar y vetar ganan sobre la elección automática.
- **CA-005:** Smoke real ejecutado: un render con música y efectos, verificado con loudness real.
