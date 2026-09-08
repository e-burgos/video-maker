# Functional — Cycle 02: Store de assets y persistencia de proyecto (`render-service`)

> **Input:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/brief.yaml`
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/functional.md`
> **Generado por:** sdd-functional

---

## Contexto de negocio

`apps/render-api` termina `cycle-01` con un solo endpoint (`GET /health`) y una orquestación
`runRenderPipeline` sin disparador HTTP. Este ciclo le agrega la puerta HTTP sobre el store de
medios que hoy sólo lee y escribe `tools/render-cli` a través de `libs/auto-montage`: crear y
listar proyectos, listar y subir assets crudos, leer y escribir `Timeline`/`EditDecisionList`, y
descargar los artefactos del proyecto como bytes.

El servicio sigue siendo local y mono-usuario (sin auth, sin despliegue cloud). El criterio de
éxito no es una API bonita: es que **el dev pueda alternar `tools/render-cli` y `render-api` sobre
la misma carpeta `media/<slug>/` sin que ninguna de las dos rompa lo que la otra escribió**. Por
eso este documento no reimplementa el layout ni el catálogo — los hereda de `libs/auto-montage`
(D-13) — y se concentra en qué le pasa a cada request, sobre todo cuando algo sale mal.

Hay dos consumidores de esta API:

- **El dev que opera el servicio** desde la consola (`curl`, Postman, un script propio) mientras
  no existe todavía ninguna UI.
- **El futuro `apps/web`** (`spec-e-burgos-006-...`, no arrancada), que va a consumir esta misma
  API como cliente de máquina: listar proyectos, subir material, editar la `Timeline` y reproducir
  los artefactos con un `<video>` y el Remotion Player — el motivo concreto detrás de D-17 (soporte
  de `Range`).

Fuera de este ciclo: cola de jobs, cualquier ruta que dispare `runRenderPipeline` (cycle-03),
MinIO (D-11, descopado con fundamento) y autenticación/multiusuario.

## Actores

| Actor | Rol en las historias |
| --- | --- |
| **Dev-operador** | Persona física operando el servicio localmente vía HTTP. Actor por defecto de las historias de creación/administración (crear proyecto, subir asset). |
| **Cliente de máquina (`apps/web`, futuro)** | Consumidor programático que lee y escribe estructuras JSON y reproduce artefactos binarios. Actor por defecto de las historias de lectura/consumo (listar, reproducir con `Range`). |

Varias historias sirven a los dos actores a la vez (p. ej. listar assets); se indica el actor
principal en cada una.

---

## Historias de usuario

### HU-02-01: Listar los proyectos del store de medios

**Como** dev que opera el servicio (y, en preparación de `apps/web`, cualquier cliente de máquina)
**Quiero** obtener la lista de proyectos que viven bajo la raíz de medios configurada
**Para** saber con qué proyectos puedo trabajar sin recorrer el filesystem a mano

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: la raíz de medios tiene proyectos
  Given la raíz de medios configurada (RENDER_API_MEDIA_ROOT, default "media") contiene los
    proyectos "smoke-ingest" y "otro-proyecto"
  When el cliente hace GET /projects
  Then la respuesta es 200
  And el body es un array con un elemento por proyecto
  And cada elemento trae al menos: slug, layout.raw, layout.catalog, layout.timeline,
    layout.edl, layout.out (booleanos de presencia)

Scenario: la raíz de medios está vacía o todavía no existe
  Given la raíz de medios configurada no tiene ningún proyecto, o el directorio de la raíz
    todavía no fue creado
  When el cliente hace GET /projects
  Then la respuesta es 200 con un array vacío
  And no es un error (RN-1)
```

**Trazabilidad:** RF-8 · verificado end-to-end como parte de CA-017
**Prioridad:** Alta · **Estimación:** S

---

### HU-02-02: Ver el detalle de un proyecto

**Como** dev que opera el servicio / cliente de máquina
**Quiero** consultar un proyecto puntual por su slug, con el conteo de assets por rol
**Para** decidir si el proyecto está listo para editar sin tener que listar todos los assets

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: el proyecto existe
  Given existe el proyecto "smoke-ingest" con 1 aroll, 1 broll y 1 audio catalogados
  When el cliente hace GET /projects/smoke-ingest
  Then la respuesta es 200
  And el body incluye slug, las banderas de layout.*, y assetCounts: { aroll, broll, image, audio }
  And assetCounts se calcula con la misma regla de fuente de verdad que HU-02-04 (catálogo si
    existe y valida; recorrido de raw/ si no existe)

Scenario: el proyecto no existe
  Given no hay ningún proyecto con slug "no-existe" bajo la raíz de medios
  When el cliente hace GET /projects/no-existe
  Then la respuesta es 404 PROJECT_NOT_FOUND (camino de error #1)
```

**Trazabilidad:** RF-8 · CA-017
**Prioridad:** Alta · **Estimación:** S

---

### HU-02-03: Crear un proyecto vacío

**Como** dev que opera el servicio
**Quiero** crear el layout canónico de un proyecto nuevo con una sola llamada
**Para** empezar a subir material sin crear carpetas a mano ni divergir del layout que ya usa la CLI

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: slug válido y disponible
  Given "proyecto-nuevo" no existe bajo la raíz de medios
  When el cliente hace POST /projects con body { "slug": "proyecto-nuevo" }
  Then la respuesta es 201
  And el layout queda materializado: raw/aroll, raw/broll, raw/images, raw/audio, work/, out/
    (todos vacíos)
  And el body reporta layout.catalog: false, layout.timeline: false, layout.edl: false (RN-9:
    esos tres se crean recién en el primer upload/PUT, no en la creación)

Scenario: el slug ya existe
  Given "smoke-ingest" ya existe bajo la raíz de medios
  When el cliente hace POST /projects con body { "slug": "smoke-ingest" }
  Then la respuesta es 409 PROJECT_ALREADY_EXISTS (camino de error #3)
  And el proyecto existente no se toca

Scenario: el slug no es portable
  Given el body declara un slug inválido (p. ej. "../fuera", "Mi Proyecto" o "a/b")
  When el cliente hace POST /projects
  Then la respuesta es 422 PROJECT_SLUG_INVALID (camino de error #2, RN-2)
  And ningún puerto de filesystem fue invocado (CA-010)
```

**Trazabilidad:** RF-9 · CA-010, CA-017
**Prioridad:** Alta · **Estimación:** M

---

### HU-02-04: Listar los assets de un proyecto

**Como** dev que opera el servicio / cliente de máquina
**Quiero** ver todos los assets crudos de un proyecto, tenga o no catálogo todavía
**Para** saber qué material está disponible para editar sin adivinar el estado del catálogo

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: el catálogo existe y valida
  Given "smoke-ingest" tiene work/catalog.json válido con 4 assets
  When el cliente hace GET /projects/smoke-ingest/assets
  Then la respuesta es 200
  And el body declara source: "catalog"
  And body.assets es exactamente lo que hay en el catálogo

Scenario: el catálogo todavía no existe
  Given "proyecto-nuevo" no tiene work/catalog.json
  When el cliente hace GET /projects/proyecto-nuevo/assets
  Then la respuesta es 200
  And el body declara source: "raw-scan"
  And body.assets se arma recorriendo raw/aroll, raw/broll, raw/images, raw/audio
  And no se escribe ningún archivo como efecto de esta lectura (RF-10)

Scenario: el catálogo existe pero está corrupto o es de otra versión
  Given work/catalog.json existe pero no parsea como JSON, o no valida contra CatalogSchema,
    o declara un schemaVersion distinto de CATALOG_SCHEMA_VERSION
  When el cliente hace GET /projects/.../assets
  Then la respuesta es 500 CATALOG_UNREADABLE (camino de error #14)
  And el servicio NUNCA cae al raw-scan en este caso (RN-4: distinto de "no existe")
```

**Trazabilidad:** RF-10 · CA-017
**Prioridad:** Alta · **Estimación:** M

---

### HU-02-05: Subir un asset crudo

**Como** dev que opera el servicio
**Quiero** subir un archivo binario a `raw/<role>/<filename>` con una sola llamada `PUT`
**Para** incorporar material nuevo al proyecto sin usar la terminal ni copiar el archivo a mano

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: upload válido
  Given el proyecto "proyecto-nuevo" existe y no tiene raw/aroll/clip02.mp4
  When el cliente hace PUT /projects/proyecto-nuevo/assets/aroll/clip02.mp4 con
    content-length y content-type correctos y el binario completo como body
  Then la respuesta es 201
  And el archivo queda en raw/aroll/clip02.mp4, escrito a un temporal y renombrado al final
    (CA-011)
  And el body de la respuesta es la entrada de catálogo recién escrita (ver HU-02-06)

Scenario: rol inválido
  Given :role vale "video" (no está en aroll | broll | image | audio)
  When el cliente hace el PUT
  Then la respuesta es 422 ASSET_ROLE_INVALID (camino de error #4)
  And ningún puerto de filesystem fue invocado (CA-010)

Scenario: nombre de archivo no portable
  Given :filename vale "../escape.mp4" o "sub/dir.mp4" (más de un segmento)
  When el cliente hace el PUT
  Then la respuesta es 422 ASSET_PATH_INVALID (camino de error #5)
  And ningún puerto de filesystem fue invocado (CA-010)

Scenario: el asset ya existe
  Given raw/aroll/clip01.mp4 ya existe
  When el cliente hace PUT /projects/.../assets/aroll/clip01.mp4
  Then la respuesta es 409 ASSET_ALREADY_EXISTS (camino de error #6, RN-5)
  And el archivo existente no se modifica

Scenario: falta content-length
  When el cliente hace el PUT sin header content-length
  Then la respuesta es 411 ASSET_CONTENT_LENGTH_REQUIRED (camino de error #7)

Scenario: falta content-type
  When el cliente hace el PUT sin header content-type
  Then la respuesta es 400 ASSET_CONTENT_TYPE_REQUIRED (camino de error #7)

Scenario: el body excede el límite configurado
  Given content-length (o los bytes efectivamente recibidos) superan el máximo configurado
  When el cliente hace el PUT
  Then la respuesta es 413 ASSET_TOO_LARGE (camino de error #8)
  And no queda ningún archivo, ni parcial ni completo, en raw/

Scenario: la escritura se corta a mitad de camino
  Given la conexión se interrumpe mientras se escribe el temporal
  When se inspecciona raw/aroll/ después del corte
  Then no hay ningún archivo con el nombre final (CA-011)
  And un reintento posterior del mismo PUT se comporta como un upload válido nuevo
```

**Trazabilidad:** RF-11 · CA-010, CA-011, CA-017
**Prioridad:** Alta · **Estimación:** L

---

### HU-02-06: Mantener el catálogo consistente en la misma request del upload

**Como** dev que opera el servicio
**Quiero** que el upload sondee el asset recién escrito y actualice `work/catalog.json` en la
misma request
**Para** no depender de acordarme de correr un paso aparte para que el asset sea visible para
`autoMontage`

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: el probe del asset nuevo tiene éxito
  Given el upload de HU-02-05 terminó de escribir el archivo
  When el servicio sondea el archivo con probeMedia
  Then work/catalog.json contiene la nueva entrada, ordenada ascendentemente por asset.id
    junto a las preexistentes
  And el catálogo resultante vuelve a validar contra CatalogSchema (CA-012)

Scenario: el probe del asset nuevo falla
  Given el archivo se escribió correctamente en raw/
  And probeMedia falla (binario ausente, comando falla, o salida no parseable)
  Then el archivo sigue en raw/, no se borra
  And la falla queda registrada en catalog.probeFailures con su errorCode (BINARY_NOT_FOUND |
    COMMAND_FAILED | UNPARSEABLE_OUTPUT | UNKNOWN)
  And la respuesta HTTP de ese mismo PUT es un error (reusa el código MEDIA_BINARY_NOT_FOUND,
    MEDIA_COMMAND_FAILED o MEDIA_OUTPUT_UNPARSEABLE ya definido en cycle-01, según la causa)
  And el payload de ese error agrega assetPersisted: true y catalogUpdated: true (camino de
    error #9, RN-8) — el cliente necesita saber que el archivo y el catálogo ya cambiaron pese
    al status de error
```

**Trazabilidad:** RF-12 · CA-012, CA-013
**Prioridad:** Alta · **Estimación:** M

---

### HU-02-07: Leer y escribir la Timeline del proyecto

**Como** cliente de máquina (`apps/web`, futuro editor) / dev que ajusta la edición a mano
**Quiero** obtener y reemplazar la `Timeline` como JSON validado
**Para** editar la composición sin tocar el archivo a mano ni producir un diff espurio contra lo
que ya escribió la CLI

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: GET con Timeline existente y válida
  Given work/timeline.json existe y valida contra TimelineSchema
  When el cliente hace GET /projects/:slug/timeline
  Then la respuesta es 200 con el documento parseado

Scenario: GET sin Timeline
  Given work/timeline.json no existe
  When el cliente hace GET /projects/:slug/timeline
  Then la respuesta es 404 TIMELINE_NOT_FOUND (camino de error #10) — nunca un body null (RF-13)

Scenario: GET con Timeline corrupta
  Given work/timeline.json existe pero no valida contra TimelineSchema
  When el cliente hace GET /projects/:slug/timeline
  Then la respuesta es 422 TIMELINE_INVALID (RN-10: el endpoint tipado valida también en
    lectura; el download genérico de HU-02-09 no)

Scenario: PUT con Timeline válida
  Given el body valida contra TimelineSchema
  When el cliente hace PUT /projects/:slug/timeline
  Then la respuesta indica éxito
  And el archivo queda escrito con exactamente los mismos bytes que produciría writeTimeline
    de auto-montage (comparación byte a byte, no de objeto) (CA-014)

Scenario: PUT con Timeline inválida
  Given el body no valida contra TimelineSchema
  When el cliente hace PUT /projects/:slug/timeline
  Then la respuesta es 422 TIMELINE_INVALID
  And no se escribe nada en disco (CA-014)
```

**Trazabilidad:** RF-13 · CA-014
**Prioridad:** Alta · **Estimación:** M

---

### HU-02-08: Leer y escribir la EditDecisionList del proyecto

**Como** cliente de máquina (`apps/web`, futuro editor) / dev que ajusta la edición a mano
**Quiero** obtener y reemplazar la `EditDecisionList` como JSON validado
**Para** las mismas razones de HU-02-07, aplicadas al segundo documento de edición del proyecto

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: GET con EDL existente y válida
  Given work/edl.json existe y valida contra EditDecisionListSchema
  When el cliente hace GET /projects/:slug/edl
  Then la respuesta es 200 con el documento parseado

Scenario: GET sin EDL
  Given work/edl.json no existe
  When el cliente hace GET /projects/:slug/edl
  Then la respuesta es 404 EDL_NOT_FOUND (camino de error #10)

Scenario: GET con EDL corrupta
  Given work/edl.json existe pero no valida contra EditDecisionListSchema
  When el cliente hace GET /projects/:slug/edl
  Then la respuesta es 422 EDL_INVALID (RN-10)

Scenario: PUT con EDL válida
  Given el body valida contra EditDecisionListSchema
  When el cliente hace PUT /projects/:slug/edl
  Then la respuesta indica éxito
  And el archivo queda escrito con exactamente los mismos bytes que produciría
    writeEditDecisionList de auto-montage (comparación byte a byte) (CA-014)

Scenario: PUT con EDL inválida
  Given el body no valida contra EditDecisionListSchema
  When el cliente hace PUT /projects/:slug/edl
  Then la respuesta es 422 EDL_INVALID
  And no se escribe nada en disco (CA-014)
```

**Trazabilidad:** RF-13 · CA-014
**Prioridad:** Alta · **Estimación:** M

---

### HU-02-09: Descargar un artefacto del proyecto con soporte de reproducción por rangos

**Como** cliente de máquina (el `<video>` del navegador o el Remotion Player de `apps/web`
necesitan hacer seek) / dev que quiere inspeccionar un archivo puntual
**Quiero** descargar cualquier archivo del proyecto (`out/**`, `work/**`, `raw/**`) como bytes,
pudiendo pedir sólo un rango
**Para** reproducir o previsualizar el material sin descargar el archivo entero cada vez

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: descarga completa sin Range
  Given out/smoke-ingest.mp4 existe
  When el cliente hace GET /projects/smoke-ingest/files/out/smoke-ingest.mp4 sin header Range
  Then la respuesta es 200
  And content-type está derivado de la extensión del archivo
  And content-length es el tamaño total del archivo
  And el body es el archivo completo

Scenario: Range válido y satisfacible
  Given el mismo archivo que en el escenario anterior
  When el cliente repite el GET con Range: bytes=0-999
  Then la respuesta es 206
  And content-range vale bytes 0-999/<size>
  And el body son exactamente esos 1000 bytes (CA-015)

Scenario: Range no satisfacible
  When el cliente pide Range: bytes=999999999-
  Then la respuesta es 416
  And content-range vale bytes */<size> (camino de error #12)

Scenario: Range mal formado o con más de un rango
  When el cliente envía Range: bytes=abc, o Range: bytes=0-10,20-30
  Then el header se ignora por completo
  And la respuesta es 200 con el archivo entero, igual que si no se hubiera enviado Range
    (camino de error #11, RN-11 — no es un error, es una degradación intencional)

Scenario: artefacto ausente
  When el cliente pide un path que no existe dentro del proyecto
  Then la respuesta es 404 ARTIFACT_NOT_FOUND (camino de error #10)

Scenario: el path pedido intenta escapar del proyecto
  When el cliente pide un path con ".." o una ruta absoluta como cola de la descarga
  Then la respuesta es 422 ASSET_PATH_INVALID
  And la validación ocurre antes de tocar el filesystem (RN-12, CA-010)
```

**Trazabilidad:** RF-14 · CA-015, CA-017
**Prioridad:** Alta · **Estimación:** L

---

### HU-02-10: Confirmar que el store de assets está disponible antes de integrarlo

**Como** dev que opera el servicio / cliente de máquina que arranca
**Quiero** que `GET /health` declare `capabilities.assetStore`
**Para** saber, antes de llamar a cualquier endpoint nuevo, si esta instancia del servicio ya lo
soporta

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: el servicio incluye el store de assets
  When el cliente hace GET /health
  Then la respuesta es 200
  And body.capabilities.assetStore vale true
  And body.status sigue reflejando "ok" o "degraded" según el estado de motores y binarios,
    sin relación con el store de assets (CA-018)
```

**Trazabilidad:** RF-16 · CA-018
**Prioridad:** Media · **Estimación:** XS

---

### HU-02-11: Recibir errores del store en un formato consistente y traducible

**Como** cliente de máquina (`apps/web`) / dev haciendo debugging
**Quiero** que todo error nuevo del store tenga un `code` en inglés, un status HTTP correcto, y
ningún `.stack` ni ruta absoluta del host
**Para** poder mostrar el error al usuario final de `apps/web` sin traducir texto en castellano
ni filtrar información del filesystem del dev

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: cualquiera de los 14 caminos de error del store
  Given cualquiera de los caminos listados en "Caminos de error observables"
  When ese error ocurre
  Then el payload de la respuesta tiene un code en mayúsculas y en inglés
  And el status HTTP coincide con la tabla de esta sección
  And el payload no contiene texto en castellano, ni .stack, ni una ruta absoluta del host
    (CA-016)
```

**Trazabilidad:** RF-16 · CA-016
**Prioridad:** Alta · **Estimación:** S

---

### HU-02-12: Documentar el store de assets en el README

**Como** dev que opera el servicio (incluido un dev nuevo en el equipo)
**Quiero** encontrar en el README los endpoints nuevos, las variables de entorno nuevas y por qué
no hay MinIO
**Para** operar el servicio sin tener que leer el código fuente para saber qué existe

**Criterios de aceptación (Gherkin):**

```gherkin
Scenario: README actualizado al cerrar el ciclo
  When se abre apps/render-api/README.md
  Then documenta cada endpoint nuevo (método, path, propósito)
  And documenta RENDER_API_MEDIA_ROOT y la variable de límite de tamaño de upload
  And documenta la decisión D-11: por qué no hay MinIO hoy y cómo se agregaría detrás del
    puerto ObjectStorage (CA-020)
```

**Trazabilidad:** RF-17 · CA-020
**Prioridad:** Media · **Estimación:** XS

---

> **Nota sobre RF-15:** no tiene una historia dedicada. Es un requisito de arquitectura interna
> ("todo el I/O nuevo entra por puertos inyectables") sin comportamiento observable propio desde
> afuera del proceso — cada HU de este documento ya asume que el I/O que ejercita entra por un
> puerto doblable en tests; su cumplimiento lo verifican el arquitecto y el implementador, no un
> escenario Gherkin nuevo.

---

## Reglas de negocio y decisiones funcionales

> Numeradas donde la spec o el brief dejaban una elección abierta. Cada una declara fundamento y,
> si corresponde, la alternativa descartada.

**RN-1 — Raíz de medios vacía o inexistente no es un error.**
`GET /projects` sobre una raíz de medios sin proyectos (o que todavía no fue creada como
directorio) responde 200 con un array vacío. La raíz se crea recién cuando hace falta (primer
`POST /projects`). *Fundamento:* "no hay proyectos todavía" es un estado válido de un servicio
recién instalado, no una falla. *Alternativa descartada:* 404 sobre la raíz — obligaría al primer
uso del servicio a fallar por diseño.

**RN-2 — Validez del slug de proyecto.**
Un slug de proyecto es un único segmento de path (sin `/`), no vacío, en kebab-case
(`[a-z0-9]+(-[a-z0-9]+)*`), y no puede ser `.` ni `..`. *Fundamento:* reusa la misma convención que
ya usa el repo para slugs de spec (`sdd-file-structure` §2.1) y evita colisiones entre sistemas de
archivos con distinta sensibilidad a mayúsculas o normalización Unicode. *Alternativa descartada:*
aceptar cualquier string que pase la validación de portabilidad de `ProjectRelativePathSchema` —
esa validación permite espacios, mayúsculas y Unicode arbitrario, y sobre todo **no** exige un
único segmento (`"a/b"` pasa), lo que crearía subdirectorios anidados bajo la raíz de medios sin
que nada en el layout previsto lo espere.

**RN-3 — Creación de proyecto duplicado.**
`POST /projects` sobre un slug que ya existe en disco rechaza con 409 `PROJECT_ALREADY_EXISTS`
(RF-9 ya lo exige como error tipado; esta regla sólo fija el status y el nombre del código).

**RN-4 — El catálogo es la fuente de verdad sólo si existe y valida; si existe pero está roto, es
un error, no un fallback silencioso.**
`GET /projects/:slug/assets` usa `work/catalog.json` cuando el archivo existe y valida contra
`CatalogSchema`. Si el archivo **no existe** (`ENOENT`), la respuesta se arma recorriendo `raw/**` y
lo declara con `source: "raw-scan"` (RF-10). Si el archivo **existe** pero no parsea como JSON,
no valida contra `CatalogSchema`, o declara un `schemaVersion` distinto de
`CATALOG_SCHEMA_VERSION`, la respuesta es un error (`CATALOG_UNREADABLE`) — nunca cae al
raw-scan. *Fundamento:* un catálogo corrupto es un problema de estado del store distinto de "no
se generó todavía"; tratarlo igual que la ausencia lo escondería en silencio justo en el escenario
que más le importa a D-13 (alternar CLI y API sin que ninguna vea algo distinto). *Alternativa
descartada:* tratar cualquier fallo de lectura del catálogo como equivalente a "no existe" — más
simple de implementar, pero oculta corrupción real del store.

**RN-5 — Upload sobre un asset existente: se rechaza, nunca se sobrescribe.**
`PUT` a `raw/<role>/<filename>` cuando ese archivo ya existe en disco responde 409
`ASSET_ALREADY_EXISTS`; el archivo existente no se toca. *Fundamento:* simétrico con RN-3 y
D-3 — el material crudo del dev es irremplazable y el store no tiene forma de confirmar que un
sobrescritura silenciosa fue intencional. El dev conserva acceso directo al filesystem de
`media/` (D-3/D-12 sólo restringen la escritura **por HTTP**), así que puede borrar el archivo a
mano si de verdad quiere reemplazarlo, sin que este ciclo necesite un `DELETE` HTTP para eso.
*Alternativas descartadas:* (a) sobrescribir siempre — permitiría "reparar" en un solo `PUT` un
asset con probe fallido (HU-02-06), pero arriesga perder una toma real sin que el HTTP lo
confirme explícitamente; (b) exigir un header explícito de tipo `overwrite: true` — queda como
candidato natural de un ciclo futuro si la fricción de (a) resulta real en el uso del dev.

**RN-6 — Validez de rol y de nombre de archivo del asset.**
`:role` debe ser uno de `aroll | broll | image | audio` (los valores de `AssetRoleSchema`).
`:filename` debe ser exactamente un segmento de path (sin `/`), no vacío, y portable con el mismo
criterio que `ProjectRelativePathSchema` (sin `..`, no absoluto, sin separador de Windows, sin
esquema de URI). Las tres validaciones corren, y fallan, **antes** de cualquier llamada a un
puerto de filesystem (CA-010).

**RN-7 — Transporte del upload.**
`content-length` y `content-type` son obligatorios en el `PUT`. El tamaño se valida contra el
máximo configurado por variable de entorno (nombre exacto a fijar en `architect.md`) a partir del
header, **antes** de escribir el primer byte al temporal; si el header subestima el tamaño real y
el cuerpo lo supera durante la escritura, la transferencia se corta y el temporal se descarta sin
renombrarse.

**RN-8 — Un probe fallido no deshace un upload exitoso, pero sí se reporta como error.**
Un `PUT` cuyo archivo se escribió correctamente pero cuyo `probeMedia` posterior falla: (a) deja
el archivo en `raw/`, (b) agrega la falla a `catalog.probeFailures`, y (c) responde con el
código de error correspondiente (reusando `MEDIA_BINARY_NOT_FOUND` / `MEDIA_COMMAND_FAILED` /
`MEDIA_OUTPUT_UNPARSEABLE` de `cycle-01`, según la causa) — pero ese payload de error agrega
`assetPersisted: true` y `catalogUpdated: true`, porque el cliente necesita distinguir "no pasó
nada" de "pasó, pero con una falla que hay que revisar" (D-15).

**RN-9 — `catalog.json`, `timeline.json` y `edl.json` se crean recién en el primer uso, no en la
creación del proyecto.**
`POST /projects` nunca escribe esos tres archivos. Aparecen sólo después del primer upload exitoso
(`catalog.json`) o del primer `PUT` exitoso de cada documento (`timeline.json`, `edl.json`). Por
eso, justo después de crear un proyecto, `GET /projects/:slug` reporta esas tres banderas en
`false`.

**RN-10 — El endpoint tipado valida también en lectura; el download genérico nunca valida.**
`GET /projects/:slug/timeline` (y `/edl`) parsea y valida el documento almacenado contra su
schema antes de responder; si no valida, es el mismo error que en el `PUT` (`TIMELINE_INVALID` /
`EDL_INVALID`). El download genérico de artefactos (HU-02-09, que también cubre `work/**` y por
lo tanto puede servir el mismo `timeline.json`/`edl.json` como bytes crudos) **nunca** parsea
nada: siempre transmite los bytes tal cual están en disco. *Fundamento:* son dos contratos con dos
consumidores distintos — uno tipado para editar, uno de bytes para servir o depurar — y D-16 exige
"los mismos bytes que la CLI", garantía que sólo se sostiene si la ruta de bytes nunca reserializa.

**RN-11 — Semántica de `Range`: un solo rango, RFC 7233 para los casos raros.**
Sólo se soporta un rango por request (D-17). Un header `Range` sintácticamente inválido, o que
pide más de un rango, se **ignora**: el request se sirve exactamente como si no hubiera `Range`
(200, archivo completo) — no es un error. Un rango sintácticamente válido pero fuera de
`[0, size-1]` responde 416 con `content-range: bytes */<size>`. Un rango válido y satisfacible
responde 206 con `content-range` y exactamente los bytes pedidos. *Fundamento:* sigue el estándar
HTTP (RFC 7233 §3.1: un `Range` inválido se ignora, no se rechaza) en vez de inventar un rechazo
propio para el caso raro, y mantiene el contrato simple para el único consumidor previsto
(`<video>`/Remotion Player).

**RN-12 — El guard de escape de path se aplica a toda ruta nueva, no sólo al upload.**
Todo segmento recibido por HTTP en este ciclo — slug, `:filename` del upload, y la cola de la
ruta de descarga de artefactos — se valida como portátil y no-escapante **antes** de que cualquier
puerto toque el filesystem. Esto extiende D-12/RNF-8 (hoy verificado explícitamente sólo por
CA-010 sobre el upload) a los endpoints nuevos de este ciclo por igual.

---

## Caminos de error observables

> Los catorce caminos que el brief pide cubrir explícitamente. El `code` es una propuesta (D-4:
> inglés, mayúsculas) — el arquitecto fija la enumeración definitiva y la tabla completa
> código → etapa → status en `architect.md` (RF-16), reusando los códigos de `cycle-01` donde
> aplica (fila #9).

| # | Escenario | Cuándo ocurre | Status HTTP | Código propuesto | Comportamiento observable |
| - | --- | --- | --- | --- | --- |
| 1 | Proyecto inexistente | Cualquier ruta con `:slug` cuyo directorio no existe bajo la raíz de medios | 404 | `PROJECT_NOT_FOUND` | `resource` = slug pedido; sin efectos secundarios |
| 2 | Slug inválido o no portable | `POST /projects` con slug que no cumple RN-2 | 422 | `PROJECT_SLUG_INVALID` | Rechazado antes de tocar el filesystem (CA-010) |
| 3 | Proyecto que ya existe | `POST /projects` con slug ya presente en disco | 409 | `PROJECT_ALREADY_EXISTS` | El proyecto existente no se modifica |
| 4 | Rol de asset inválido | `PUT .../assets/:role/...` con `:role` fuera de `aroll\|broll\|image\|audio` | 422 | `ASSET_ROLE_INVALID` | Rechazado antes de tocar el filesystem (CA-010) |
| 5 | Nombre de archivo no portable o con `..` | `:filename` no cumple RN-6 | 422 | `ASSET_PATH_INVALID` | Rechazado antes de tocar el filesystem (CA-010); mismo código para el path de descarga (RN-12) |
| 6 | Asset que ya existe | `PUT` a `raw/<role>/<filename>` ya presente | 409 | `ASSET_ALREADY_EXISTS` | Nada se escribe ni se sobrescribe (RN-5) |
| 7 | Body sin `content-length` o `content-type` | Falta cualquiera de los dos headers en el `PUT` de asset | 411 (sin length) / 400 (sin type) | `ASSET_CONTENT_LENGTH_REQUIRED` / `ASSET_CONTENT_TYPE_REQUIRED` | Verificado antes de abrir el archivo temporal |
| 8 | Body más grande que el límite | `content-length` (o bytes recibidos) supera el máximo configurado | 413 | `ASSET_TOO_LARGE` | El temporal se descarta; nada queda en `raw/` |
| 9 | Probe fallido tras un upload exitoso | `probeMedia` falla después de un `rename` exitoso | heredado de `cycle-01` (503 si falta binario, 500 si falla el comando o la salida no parsea) | `MEDIA_BINARY_NOT_FOUND` / `MEDIA_COMMAND_FAILED` / `MEDIA_OUTPUT_UNPARSEABLE` (reusados) | El archivo queda escrito; `probeFailures` se actualiza; payload agrega `assetPersisted: true`, `catalogUpdated: true` (RN-8) |
| 10 | Artefacto ausente | `GET` de `timeline`/`edl`/descarga sobre un path que no existe en disco | 404 | `TIMELINE_NOT_FOUND` / `EDL_NOT_FOUND` / `ARTIFACT_NOT_FOUND` | Nunca un body `null` (RF-13) |
| 11 | `Range` mal formado | Header `Range` sintácticamente inválido, o con más de un rango | 200 (no es un error) | — | Se sirve como si no hubiera `Range`: archivo completo (RN-11) |
| 12 | `Range` no satisfacible | Rango sintácticamente válido pero fuera de `[0, size-1]` | 416 | `RANGE_NOT_SATISFIABLE` | `content-range: bytes */<size>` |
| 13 | Documento `Timeline`/`EDL` que no valida | `PUT` con body inválido, o `GET` que encuentra un documento almacenado inválido | 422 | `TIMELINE_INVALID` / `EDL_INVALID` | En el `PUT`, nada se escribe (CA-014); en el `GET`, no se sirve el documento roto (RN-10) |
| 14 | Catálogo ilegible o con `schemaVersion` distinto | `work/catalog.json` existe pero no parsea, no valida, o declara otro `schemaVersion` | 500 | `CATALOG_UNREADABLE` | Nunca cae al raw-scan (RN-4) |

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Raíz de medios | Directorio configurable (`RENDER_API_MEDIA_ROOT`, default `media`) bajo el cual viven todos los proyectos. |
| Proyecto / slug | Un proyecto de edición, identificado por un único segmento de path (`media/<slug>/`). |
| Layout | La estructura canónica de un proyecto: `raw/{aroll,broll,images,audio}`, `work/{catalog.json,timeline.json,edl.json}`, `out/`. La define `libs/auto-montage`, no este ciclo. |
| Catálogo | `work/catalog.json`: inventario de assets crudos con su fingerprint, su rol y el resultado de `probeMedia`, más las fallas de probe (`probeFailures`) y las entradas ignoradas. |
| Rol de asset | Uno de `aroll`, `broll`, `image`, `audio` — determina en qué subcarpeta de `raw/` vive el archivo. |
| Fingerprint | Par `{ sizeBytes, modifiedAtMs }` que el catálogo usa para saber si un archivo cambió desde la última vez que se catalogó. |
| Probe | Sondeo de un archivo de medios con `probeMedia` (de `libs/media-local`) para extraer duración, resolución, códecs, etc. |
| Fuente (`source`) | Campo del payload de `GET /projects/:slug/assets` que declara si la respuesta viene del catálogo (`"catalog"`) o de un recorrido de `raw/` (`"raw-scan"`). |
| Timeline / EditDecisionList | Los dos documentos JSON de edición del proyecto (`work/timeline.json`, `work/edl.json`), validados por `@video-maker/timeline-core` y serializados con los helpers de `auto-montage`. |
| Artefacto | Cualquier archivo del proyecto servible como bytes por HTTP: `out/**`, `work/**` y `raw/**`. |
| Path portable | Un path relativo POSIX sin `..`, sin ser absoluto, sin separador de Windows y sin esquema de URI — el mismo criterio de `ProjectRelativePathSchema`. |
| `Range` | Header HTTP estándar para pedir un subrango de bytes de un recurso; este ciclo soporta exactamente un rango por request (D-17). |

---

## Trazabilidad (RF ↔ HU ↔ CA)

| RF | Historias | CAs |
| --- | --- | --- |
| RF-8 | HU-02-01, HU-02-02 | CA-017 |
| RF-9 | HU-02-03 | CA-010, CA-017 |
| RF-10 | HU-02-04 | CA-017 |
| RF-11 | HU-02-05 | CA-010, CA-011, CA-017 |
| RF-12 | HU-02-06 | CA-012, CA-013 |
| RF-13 | HU-02-07, HU-02-08 | CA-014 |
| RF-14 | HU-02-09 | CA-015, CA-017 |
| RF-15 | — (sin HU, ver nota tras HU-02-12) | — |
| RF-16 | HU-02-10, HU-02-11 | CA-016, CA-018 |
| RF-17 | HU-02-12 | CA-020 |

CA-009 (lint/test/build/validate en verde, sin dependencias npm nuevas) y CA-019 (cobertura
≥ 80 %) son criterios de cierre del ciclo completo, no de una historia puntual: los evalúa el
reviewer sobre el output final, no un escenario Gherkin de este documento.

---

## Contradicciones detectadas

Ninguna bloqueante. Dos notas no bloqueantes, a título informativo:

- El "Resumen Ejecutivo" de la spec todavía describe el servicio como si gestionara "assets
  crudos en MinIO" — texto anterior a D-11, que descopó MinIO con fundamento explícito más abajo
  en el mismo documento. La propia spec ya lo resuelve (D-11 prevalece); no requiere una decisión
  nueva de este documento, sólo se deja registrado por si la consolidación futura del resumen
  ejecutivo lo pasa por alto.
- RF-9 pide que el slug "no sea portable" como único criterio de rechazo, pero
  `ProjectRelativePathSchema` (la validación de portabilidad ya existente en `auto-montage`) no
  exige que el valor sea un único segmento de path — permitiría un slug como `"a/b"`. RN-2 de este
  documento resuelve la ambigüedad exigiendo explícitamente un único segmento en kebab-case; se
  deja registrado porque no es una repetición de una regla ya escrita en la spec, sino una
  precisión que este documento agrega.
