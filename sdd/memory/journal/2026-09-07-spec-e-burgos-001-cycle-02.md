# spec-e-burgos-001-core-composition-media-pipeline cycle-02 — 2026-09-07

## Qué pasó

1. **Vitest no lee los `paths` de `tsconfig.base.json`: el alias entre libs hay que declararlo
   además en el `vite.config.ts` de cada lib.** `libs/media-local` fue el primer proyecto del repo
   que importa un **valor** (no solo un `type`) desde otra lib — `MediaAssetSchema`,
   `TranscriptionSchema`, `normalizeTranscriptionWords` de `@video-maker/timeline-core`. `tsc`
   resuelve el alias por `paths`, así que `lint` y `build` quedaron **verdes**, y sin embargo todo
   spec que importara un valor reventaba en runtime con `ERR_MODULE_NOT_FOUND`. Se resolvió con
   `resolve.alias` apuntando a `../timeline-core/src/index.ts`. Los imports de solo-tipo no lo
   necesitan (`verbatimModuleSyntax` los borra en la transformación), lo que hace el fallo
   intermitente y confuso: aparece recién en la primera task que importa un valor, no al scaffoldear.
2. **Dos implementadores en paralelo funcionaron, pero las reglas de convivencia por directorio
   dejaron dos costos concretos.** TASK-003 (`src/ffprobe/**`) y TASK-004 (`src/ffmpeg/**`)
   corrieron a la vez con zonas de archivos disjuntas. (a) El helper compartido `readFixture()`
   (`src/__fixtures__/load-fixture.ts`, D-15) caía en zona común: TASK-004 no podía crearlo sin
   arriesgar colisión, así que duplicó la carga de fixtures con `readFileSync` inline y dejó la
   deuda anotada para el cierre — llegó hasta el reviewer, que la migró. (b) El criterio de done
   de cada task incluía el umbral de cobertura **global** de la lib, que con otra task en vuelo
   mide 79.03 % de ramas por archivos ajenos: TASK-004 no tenía forma de saber si su propio
   trabajo pasaba el gate y tuvo que argumentarlo a mano en sus notas.
3. **Ninguna de las fixtures de `ffmpeg` y `whisper` pudo grabarse: el entorno de implementación no
   tiene los binarios.** Se reconstruyeron a mano desde el formato documentado en `architect.md`
   §6. Funciona para el ciclo —los parsers se prueban igual y RNF-3 se cumple— pero deja los
   `toEqual` exactos de CA-018/CA-019/CA-020 anclados a un formato *documentado*, no *observado*:
   dos diferencias contra una corrida real se detectaron recién en la revisión.

## Lección

- Al crear una lib nueva que importe **valores** de otra lib del repo, declarar el alias en los dos
  lados: `tsconfig.base.json → paths` (para `tsc`) y `resolve.alias` del `vite.config.ts` de la lib
  (para Vitest). `lint` y `build` verdes no prueban que la suite resuelva los imports.
- Antes de despachar implementadores en paralelo: crear la infraestructura compartida
  (helpers, ports, fixtures comunes) en una task serializada previa, y no poner un umbral de
  cobertura **global** en el criterio de done de una task que corre en paralelo — medir por archivo
  propio o dejar el umbral para la task de cierre.
- Cuando el entorno no permite grabar una fixture de un binario externo, dejar en el README el
  comando exacto para regrabarla y anotar las diferencias sospechadas contra la salida real: sin
  eso la fixture reconstruida se lee después como si fuera una captura.

## Costo evitable

- El alias de Vitest se descubrió con un test fallando en TASK-003 tras haber dado por bueno el
  scaffold de TASK-001 (lint+build verdes). Un solo spec que importe un valor de la otra lib en la
  task de scaffold lo habría detectado antes de que hubiera código encima.
- La deuda del `readFixture()` duplicado sobrevivió cuatro tasks y el cierre de TASK-008 (que sí
  auditó el barrel) hasta llegar a la revisión: una task previa de infraestructura compartida la
  habría evitado por completo.
