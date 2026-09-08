# Functional — Cycle 01: render-service-foundation

> **Input:** sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Cuatro librerías del monorepo ya saben renderizar un video mudo, mezclar y masterizar su audio,
muxearlo y verificar su loudness. Lo que falta es la puerta de entrada que permite operar ese motor
desde afuera del proceso: un servicio HTTP local que reciba una `Timeline` y devuelva un MP4
masterizado en una sola llamada.

Este ciclo no tiene todavía un creador de contenido como usuario final. Los dos actores que
consumen este servicio son:

- **El frontend de `spec-e-burgos-006`**, que en un ciclo futuro le va a enviar timelines y leer
  sus respuestas — en este ciclo, el contrato que ese frontend necesita ya tiene que estar cerrado
  y ser observable (qué responde el servicio, qué dice cuando algo falla).
- **El dev que opera el servicio en su propia máquina**: lo instala, lo levanta, lo apaga, lee su
  README y confía en que su suite de tests lo protege sin depender de binarios reales.

`apps/render-api` es el único subproyecto del monorepo habilitado a depender a la vez de las dos
librerías que resuelven el motor completo (render y mezcla/masterización), así que la orquestación
`render → mix → mux → verify` en una sola llamada vive acá o no vive en ningún lado. Este primer
ciclo entrega la app ejecutable, la orquestación de esas cuatro llamadas en orden fijo, la
traducción de cualquier fallo del motor a un payload de máquina en inglés y un servidor mínimo con
`GET /health`. No entrega cola de jobs, ni endpoints de assets, ni MinIO — eso queda para los
ciclos 02 y 03.

## Historias de usuario

### HU-1-01: Contar con la app render-api lista para desarrollar y ejecutar

**Como** dev que opera el monorepo
**Quiero** que `apps/render-api` exista como proyecto Nx completo, integrado al workspace pnpm, sin
placeholders del generador
**Para** poder lintearla, testearla y compilarla con las mismas herramientas que uso en el resto del
repo

**Criterios de aceptación:**

- [ ] CA-001: la corrida conjunta de lint, test y build del workspace incluye a `render-api` y
  termina en verde, sin warnings nuevos respecto del comportamiento ya conocido del resto del
  monorepo.

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-02: Levantar el servicio como proceso real y apagarlo limpio

**Como** dev que opera el servicio
**Quiero** arrancar el proceso real de `render-api`, ver que resuelve sus dos dependencias pesadas
sin error y apagarlo ante una señal del sistema operativo
**Para** confirmar que el servicio funciona fuera de la suite de tests, en las condiciones en las
que realmente se lo va a operar

**Criterios de aceptación:**

- [ ] CA-002 (parte proceso): al ejecutar el binario del servicio, este arranca, resuelve sin error
  sus dos dependencias pesadas y, ante una señal de apagado, termina con exit code 0. El exit code
  se observa invocando el proceso directamente, nunca a través del ejecutor de tareas del monorepo.

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-03: Consultar el estado del servicio antes de enviarle trabajo

**Como** frontend de `spec-e-burgos-006` (o cualquier consumidor HTTP del servicio)
**Quiero** consultar un endpoint de salud y recibir un JSON con el estado del servicio y de sus
binarios resueltos
**Para** decidir si el servicio está en condiciones de recibir una `Timeline` antes de enviarla

**Criterios de aceptación:**

- [ ] CA-002 (parte HTTP): una petición `GET /health` contra el proceso en ejecución responde con
  status 200 y un cuerpo JSON válido que describe el estado del servicio.

**Prioridad:** Alta
**Estimación:** S

---

### HU-1-04: Obtener un entregable masterizado en una sola llamada

**Como** frontend de `spec-e-burgos-006`
**Quiero** que, a partir de una `Timeline`, el servicio ejecute render mudo, mezcla, muxeo y
verificación de loudness en ese orden exacto, sin que yo tenga que orquestar cada paso
**Para** recibir un entregable coherente (video con el audio masterizado ya incorporado) con una
única invocación

**Criterios de aceptación:**

- [ ] CA-003: existe un test que demuestra que las cuatro operaciones del pipeline se ejecutan en
  ese orden exacto y que el paso de render se invoca pidiendo explícitamente audio mudo — la
  evidencia es un registro de llamadas, no el título del test.

**Prioridad:** Alta
**Estimación:** L

---

### HU-1-05: Conservar los archivos intermedios de cada render

**Como** dev que opera el servicio
**Quiero** que el pipeline cree su directorio de trabajo antes de empezar y no borre ninguno de los
archivos intermedios que produce (el video mudo, el audio masterizado)
**Para** poder depurar un render, inspeccionar un intermedio o re-mezclarlo sin repetir el pipeline
completo desde cero

**Criterios de aceptación:**

- [ ] CA-005: existe un test que demuestra que el directorio de trabajo existe antes de la primera
  operación del pipeline y que ningún camino de ejecución (con éxito o con error) elimina los
  archivos intermedios generados.

**Prioridad:** Media
**Estimación:** S

---

### HU-1-06: Recibir un error procesable por máquina cuando el pipeline falla

**Como** frontend de `spec-e-burgos-006`
**Quiero** que, ante cualquier falla del motor durante el pipeline, el servicio me devuelva un
payload en inglés con un código propio, la etapa donde falló y el status HTTP correspondiente
**Para** poder manejar el error programáticamente (reintentar, mostrar un mensaje, escalar) sin
parsear texto libre ni depender de detalles internos del servidor

**Criterios de aceptación:**

- [ ] CA-004: cada fila de la tabla de errores heredada del motor tiene un test que verifica el
  código propio, la etapa del pipeline y el status HTTP resultantes; ninguno de esos payloads
  contiene texto en castellano ni el stack trace del error original.

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-07: Recibir el entregable aunque el loudness quede fuera de tolerancia

**Como** frontend de `spec-e-burgos-006`
**Quiero** que, si la verificación de loudness da `withinTolerance: false`, el servicio igual me
entregue el resultado exitoso con el delta medido, en lugar de fallar o reintentar por su cuenta
**Para** poder decidir yo, como consumidor, si esa desviación amerita una re-edición de la mezcla —
sin pagar el costo de un segundo render automático que no garantiza converger

**Criterios de aceptación:**

- [ ] CA-006: con `withinTolerance: false`, el pipeline devuelve un reporte exitoso con el delta
  poblado; no lanza excepción y el registro de llamadas no muestra una segunda invocación del paso
  de render.

**Prioridad:** Alta
**Estimación:** S

---

### HU-1-08: Confiar en la suite de tests sin depender de binarios reales

**Como** dev que opera y mantiene el servicio
**Quiero** que toda la lógica del servicio esté cubierta por tests que no requieran ffmpeg, ffprobe,
whisper-cli ni Chrome instalados
**Para** poder iterar rápido en mi máquina y correr la suite completa en CI sin esas dependencias

**Criterios de aceptación:**

- [ ] CA-007: el reporte de cobertura de `apps/render-api` alcanza al menos 80 % de statements,
  medido sobre el conjunto de archivos propios del proyecto que el propio proyecto declara cubrir.

**Prioridad:** Media
**Estimación:** M

---

### HU-1-09: Operar el servicio sin tener que leer su código

**Como** dev que opera el servicio (yo mismo u otro integrante del equipo)
**Quiero** un README del subproyecto con los comandos para levantarlo, las variables de entorno que
acepta y qué quedó explícitamente fuera de este ciclo
**Para** poder instalarlo y correrlo sin depender de memoria ni de leer el código fuente

**Criterios de aceptación:**

- [ ] CA-008: el README del subproyecto documenta comandos, variables de entorno y el listado
  explícito de lo descopado en este ciclo (MinIO, cola de jobs, endpoints de assets, bundle webpack
  de Remotion, `eslint.config.mjs`).

**Prioridad:** Baja
**Estimación:** XS

---

## Requisitos funcionales

### RF-1-01: Proyecto ejecutable e integrado al workspace

**Deriva de:** RF-1 de la spec.
**Descripción:** `apps/render-api` existe como aplicación Nx (no como librería), con los targets
`lint`, `test`, `build` y un target de arranque, integrada al pnpm workspace, sin ninguno de los
archivos placeholder que deja el generador sin editar.
**Reglas de negocio:**

- RN-1: la app se identifica con las etiquetas de dominio `scope:engine` y `type:app` (define su
  posición en los límites de dependencias del monorepo; el detalle de esas etiquetas lo cierra el
  Arquitecto).

**Casos de error:**

- CE-1: si algún target obligatorio falta o algún placeholder del generador quedó sin resolver, la
  corrida conjunta de lint/test/build no puede terminar en verde — eso es lo que CA-001 audita.

### RF-1-02: Arranque real, resolución de dependencias y salud del servicio

**Deriva de:** RF-1 (target de arranque), RF-2 (resolución de las dos libs pesadas) y RF-5
(servidor HTTP y `GET /health`) de la spec.
**Descripción:** El servicio arranca como proceso independiente, resuelve sus dos dependencias
pesadas sin error, responde `GET /health` con el estado del servicio y de esos binarios, y termina
con exit code 0 ante una señal de apagado del sistema operativo. Host y puerto se configuran por
variable de entorno con un valor por defecto local.
**Reglas de negocio:**

- RN-2: toda respuesta HTTP del servicio, en cualquier camino, es JSON — nunca texto plano ni HTML.
- RN-3: el servicio no escucha fuera de `127.0.0.1` por defecto.

**Casos de error:**

- CE-2: si una de las dos dependencias pesadas no resuelve, el proceso no debe quedar en un estado
  ambiguo — arranca reportando el problema o no arranca; cualquiera de los dos es observable desde
  afuera del proceso.
- CE-3: ante una señal de apagado, el proceso no puede quedar colgado ni terminar con un exit code
  distinto de 0 en el camino feliz.

### RF-1-03: Orquestación del pipeline en orden fijo

**Deriva de:** RF-3 de la spec.
**Descripción:** Una sola operación orquesta, en este orden y sin excepción, render con audio mudo,
mezcla, muxeo y verificación de loudness, y devuelve un reporte con las rutas producidas y la
medición de loudness del entregable final.
**Reglas de negocio:**

- RN-4: el orden del pipeline no es negociable por el llamador — el servicio no expone forma de
  saltear o reordenar un paso.
- RN-5: el paso de render siempre pide audio mudo; el audio del entregable final proviene
  exclusivamente de la mezcla masterizada, nunca del render de Remotion.

**Casos de error:**

- CE-4: si cualquiera de los cuatro pasos falla, el pipeline no continúa con los pasos siguientes —
  el fallo se traduce según RF-1-04.

### RF-1-04: Traducción de errores del motor a payload de máquina en inglés

**Deriva de:** RF-4 de la spec (decisión D-4).
**Descripción:** Todo fallo que el motor produce durante el pipeline se traduce a un código propio
del servicio, la etapa del pipeline donde ocurrió y un status HTTP, con el cuerpo de la respuesta
enteramente en inglés.
**Reglas de negocio:**

- RN-6 (D-4): todo payload de máquina — código, etapa, recurso, valor esperado, sugerencia — se
  redacta en inglés, igual que el resto de los identificadores y el código del repo. Los documentos
  SDD siguen en español; el payload de API no.
- RN-7: ningún payload de error expone el stack trace original ni una ruta absoluta del sistema de
  archivos del host.

**Casos de error:**

- CE-5: un error del motor que no tenga fila correspondiente en la tabla heredada no puede quedar
  sin traducir — el mapeo tiene que cubrir el conjunto completo de errores documentados.

### RF-1-05: Conservación de intermedios

**Deriva de:** RF-3 de la spec (decisión D-8).
**Descripción:** El pipeline crea su directorio de trabajo antes de ejecutar el primer paso y no
elimina, en ningún camino de ejecución, los archivos intermedios que produce.
**Reglas de negocio:**

- RN-8 (D-8): los intermedios (el video mudo, el audio masterizado) se conservan siempre — tanto en
  el camino exitoso como en cualquier camino de error del pipeline.

**Casos de error:**

- CE-6: un fallo a mitad de pipeline no puede dejar el directorio de trabajo sin crear ni borrar lo
  que ya se había producido antes del fallo.

### RF-1-06: Política ante loudness fuera de tolerancia

**Deriva de:** RF-6 de la spec (decisión D-7).
**Descripción:** Cuando la verificación de loudness informa que el entregable está fuera de
tolerancia, el pipeline igual publica el entregable como resultado exitoso y reporta el delta
medido; no reintenta el render automáticamente ni lanza una excepción.
**Reglas de negocio:**

- RN-9 (D-7): estar fuera de tolerancia es información editorial, no una falla del servicio — la
  decisión de volver a mezclar es del consumidor, nunca automática.

**Casos de error:**

- CE-7: no aplica un caso de error propio — este es, por decisión explícita, un camino exitoso con
  información adicional, no una rama de fallo.

### RF-1-07: Testabilidad sin binarios reales

**Deriva de:** RF-2 de la spec.
**Descripción:** Todo el I/O del servicio (render, mezcla, muxeo, verificación, filesystem, reloj,
log) entra por puntos de extensión inyectables, de forma que la suite de tests puede ejercitar toda
la lógica sin ffmpeg, ffprobe, whisper-cli ni Chrome instalados.
**Reglas de negocio:**

- RN-10: la suite de tests no depende de binarios externos ni de las libs pesadas por su entrada
  real.

**Casos de error:**

- CE-8: no aplica — este requisito se verifica por cobertura (CA-007), no por un caso de error de
  runtime.

### RF-1-08: Documentación operativa del subproyecto

**Deriva de:** RF-7 de la spec.
**Descripción:** El README de `apps/render-api` documenta los comandos para operarlo, las variables
de entorno que acepta y, explícitamente, qué quedó fuera de este ciclo.
**Reglas de negocio:**

- RN-11: el listado de alcance descopado en el README tiene que nombrar, como mínimo, MinIO, la
  cola de jobs, los endpoints de assets, el bundle webpack de Remotion y `eslint.config.mjs`.

**Casos de error:**

- CE-9: no aplica — es un entregable documental, verificado por inspección de contenido (CA-008).

---

## Trazabilidad RF → HU → CA

| RF (spec) | RF (funcional) | HU | CA | Evidencia que lo hace verificable |
| --- | --- | --- | --- | --- |
| RF-1 | RF-1-01 | HU-1-01 | CA-001 | La corrida conjunta de lint, test y build del workspace incluye a `render-api` y termina en verde, sin warnings nuevos. |
| RF-1, RF-2, RF-5 | RF-1-02 | HU-1-02 | CA-002 | Ejecutando el binario del proceso real: arranca, resuelve sus dos dependencias pesadas sin error y, ante una señal de apagado, termina con exit code 0 observado invocando el proceso directamente. |
| RF-5 | RF-1-02 | HU-1-03 | CA-002 | Una petición `GET /health` contra el proceso en ejecución responde 200 con un cuerpo JSON válido. |
| RF-3 | RF-1-03 | HU-1-04 | CA-003 | Un test demuestra, sobre un registro de llamadas, que las cuatro operaciones se invocan en ese orden exacto y que el render pide audio mudo. |
| RF-4 | RF-1-04 | HU-1-06 | CA-004 | Cada fila de la tabla de errores heredada tiene un test que verifica código, etapa y status HTTP, y confirma ausencia de texto en castellano y de stack trace. |
| RF-3 (D-8) | RF-1-05 | HU-1-05 | CA-005 | Un test verifica que el directorio de trabajo existe antes de la primera operación y que ningún camino (éxito o error) borra los intermedios. |
| RF-6 (D-7) | RF-1-06 | HU-1-07 | CA-006 | Con `withinTolerance: false`, el pipeline devuelve un reporte exitoso con el delta poblado, sin excepción y sin una segunda invocación de render en el registro de llamadas. |
| RF-2 | RF-1-07 | HU-1-08 | CA-007 | El reporte de cobertura de `apps/render-api` alcanza ≥ 80 % de statements sobre el `include` que el propio proyecto declara. |
| RF-7 | RF-1-08 | HU-1-09 | CA-008 | El contenido de `apps/render-api/README.md` enumera comandos, variables de entorno y el alcance descopado del ciclo. |

Las nueve filas cubren `CA-001` a `CA-008` sin huecos; `CA-002` aparece dos veces porque un mismo
criterio de aceptación certifica tanto el arranque del proceso (actor dev) como la respuesta del
endpoint de salud (actor frontend de `spec-e-burgos-006`) — no hay ningún CA sin fila ni ninguna
fila sin CA.

---

## Reglas de negocio

Las tres decisiones del orquestador que cambian el comportamiento observable del servicio en este
ciclo:

1. **RN-6 / D-4 — Todo payload de máquina en inglés.** `code`, `stage`, `resource`, `expected` y
   `hint` de cualquier respuesta de error se redactan en inglés, igual que identificadores, commits
   y documentación técnica del repo. Los documentos SDD (este incluido) siguen en español; lo que
   el servicio le devuelve por HTTP a un consumidor de máquina, no. Un consumidor externo
   (`spec-006`) no debería tener que traducir ni acoplarse a un idioma humano para manejar un error.
2. **RN-9 / D-7 — `withinTolerance: false` publica y reporta el delta.** El servicio nunca reintenta
   un render por su cuenta ni lanza una excepción cuando la mezcla queda fuera de tolerancia de
   loudness: entrega el resultado como exitoso y dentro del reporte informa cuánto se desvió. Bajar
   o subir la cama musical para entrar en tolerancia es una decisión de edición humana, no una
   decisión que el servicio pueda tomar sola, y un reintento automático duplicaría el costo del
   render sin ninguna garantía de converger.
3. **RN-8 / D-8 — Los intermedios se conservan.** El pipeline crea su directorio de trabajo antes
   del primer paso y no borra, en ningún camino (éxito o error), el video mudo ni el audio
   masterizado que produce. Esto habilita, en ciclos futuros, re-mezclar sin repetir el render
   completo y depurar un fallo mirando el intermedio exacto donde ocurrió.

Reglas de negocio adicionales del ciclo (ver detalle en cada RF-1-0N):

- RN-1 a RN-11 quedan enumeradas junto a la RF que las origina en la sección anterior.

---

## Fuera de alcance

Copiado del `out_of_scope` del brief de este ciclo — ninguna de estas piezas se implementa,
verifica ni documenta como resuelta en `cycle-01`:

- Cola de jobs, concurrencia, progreso y cancelación — se entregan en `cycle-03`.
- Endpoints de assets, upload, probe y persistencia de Timeline/EDL — se entregan en `cycle-02`.
- MinIO, docker-compose y cualquier cliente S3 — se entregan en `cycle-02` (decisión D-3).
- Dependencias npm nuevas de cualquier tipo (RNF-1, decisión D-2).
- Crear `apps/render-api/eslint.config.mjs` — descopado por el hook `config-protection` del harness
  del dev (decisión D-9).
- Tocar `tsconfig.base.json` — una app no necesita alias propio; si hiciera falta, se escala con el
  diff correspondiente (RNF-5).
- Tocar `tools/render-cli` — su superficie de errores con token genérico y su salida bilingüe se
  agendan para `cycle-03` (decisión D-5).
- Tocar `coverage.include` de `libs/composition-remotion` — se amplía en `cycle-03` (decisión D-6).
- **Bundlear Remotion con webpack: queda declarado explícitamente como NO verificado en este
  ciclo (decisión D-10).** Se ejercita recién en el smoke E2E de `cycle-03`, cuando exista un job
  real que dispare el bundle. Ningún CA de `cycle-01` certifica que el bundle de Remotion compile o
  corra — CA-002 certifica la resolución por `await import()` de los módulos, no la ejecución de un
  render real.
- Re-master del integrado del bus completo — fuera del alcance de la spec por ahora (spec-004,
  decisión D-K).

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Timeline | Estructura de datos que describe la composición de un video a renderizar (clips, audio, transiciones); la produce `spec-e-burgos-002` y la consume `renderTimeline`. |
| Pipeline | La secuencia fija render (audio mudo) → mix → mux → verify que `render-api` orquesta en una sola llamada. |
| Intermedio | Un archivo producido por un paso del pipeline que no es el entregable final (el video mudo, el audio masterizado) y que este ciclo conserva en disco. |
| `withinTolerance` | Campo del resultado de verificación de loudness que indica si el integrado del entregable cae dentro del margen aceptado; `false` no es un error, es información editorial. |
| Payload de máquina | El cuerpo JSON de una respuesta HTTP pensado para ser leído por código, no por una persona — en este servicio, siempre en inglés. |
| Puerto inyectable | Punto de extensión por el que el servicio recibe una implementación de I/O (render, mezcla, filesystem, reloj, log) en vez de resolverla por su cuenta; permite testear sin binarios reales. |
