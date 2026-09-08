# Functional — Cycle 3: CLI headless `render-cli` (ingest → plan → render → run)

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-03/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Los ciclos 1 y 2 dejaron el motor completo en el plano de librerías: `libs/auto-montage` sabe
ingerir una carpeta de material crudo, transcribirla de forma incremental, detectar conceptos
clave, planificar B-roll y armar una `Timeline` válida y determinista. Pero todo eso hoy solo se
usa importando funciones de TypeScript desde un test o desde código nuevo. El dev que quiere pasar
de una grabación cruda a un video terminado no tiene todavía una forma de decirle a la máquina
"hacé esto" sin abrir un editor y escribir un script.

Este ciclo cierra esa brecha con `tools/render-cli`: la primera superficie de uso real del motor.
Es una herramienta de línea de comandos, sin interfaz gráfica, pensada para un único usuario en su
propia máquina. El dev le da una carpeta de proyecto (`media/<slug>/`) y un preset que describe qué
tipo de video es, y la CLI hace el resto: descubre y transcribe el material, arma la decisión de
montaje, y produce el MP4 final.

Internamente el pipeline tiene tres etapas (ingesta, planificación, render) que ya existen como
funciones de librería independientes. La CLI expone esas tres etapas como comandos propios
(`ingest`, `plan`, `render`) para el dev que quiere inspeccionar el resultado intermedio de cada
una, y agrega un cuarto comando (`run`) que las encadena, para el uso más común: "quiero el video,
no me importa el paso intermedio". El dev no debería tener que memorizar en qué orden van las
etapas ni qué archivo deja escrito cada una en `work/` — eso es justamente lo que `run` existe para
evitar.

Dos cosas son no negociables para que esta CLI sea confiable y no solo "otra forma de correr las
libs". La primera: cuando algo sale mal, tiene que decir **qué** salió mal, **en qué etapa** y
**sobre qué archivo o asset** — nunca un stack trace de Node que el dev tenga que interpretar línea
por línea. La segunda: el dev tiene que poder borrar `work/` y `out/` sin miedo, en cualquier
momento, y volver a correr `run` con la confianza de que va a recuperar exactamente el mismo video
— porque `raw/` es la única fuente de verdad y todo lo demás es regenerable por definición (así
quedó establecido desde `cycle-01`).

Fuera de este ciclo: cualquier cambio en cómo se decide el montaje (eso ya cerró en `cycle-01` y
`cycle-02`), el estilo visual de los subtítulos, la mezcla de audio y cualquier API HTTP — esta CLI
es exclusivamente de uso local, invocada a mano por el dev en su terminal.

## Historias de usuario

### HU-12: Ingerir un proyecto de medios con un solo comando

**Requisito relacionado:** RF-10

**Como** dev que tiene una carpeta `media/<slug>/` con material crudo
**Quiero** correr un único comando `ingest <ruta-del-proyecto>` que descubra, sondee y transcriba
el material y deje el catálogo listo en `work/`
**Para** no tener que escribir un script que importe `ingestProject` a mano cada vez que quiero
procesar un proyecto nuevo

**Criterios de aceptación:**

- [ ] CA-013 (spec): el comando `ingest` existe, recibe la ruta del proyecto como argumento
      obligatorio y, antes de tocar el filesystem o invocar cualquier binario, valida que la ruta
      fue provista y que apunta a un proyecto con la estructura mínima esperada (ver RN-20).
- [ ] CA-013 (spec): si la ruta no existe, o existe pero no tiene una carpeta `raw/` con al menos
      una de las subcarpetas reconocidas (`aroll/`, `broll/`, `images/`, `audio/`), el comando
      termina con exit code distinto de 0 y no invoca `ingestProject`.
- [ ] CA-013 (spec): si la validación de argumentos y de precondiciones pasa, `ingest` deja escrito
      `work/catalog.json` y, para el A-roll transcribible, sus transcripciones en
      `work/transcripts/`, exactamente como ya hace `ingestProject` (heredado de `cycle-01`).

### HU-13: Planificar el montaje con un solo comando

**Requisito relacionado:** RF-10

**Como** dev que ya ingirió su proyecto
**Quiero** correr un comando `plan <ruta-del-proyecto> --preset <preset> [--seed <n>]` que arme la
`EditDecisionList` y la `Timeline` a partir del catálogo existente
**Para** poder revisar el resultado editorial (qué conceptos se detectaron, qué B-roll se usó)
antes de gastar tiempo en un render completo

**Criterios de aceptación:**

- [ ] CA-013 (spec): el comando `plan` existe, recibe la ruta del proyecto y el preset como
      argumentos, valida ambos antes de leer el catálogo (ver RN-22, RN-23, RN-24), y devuelve
      exit code distinto de 0 si cualquiera de las dos validaciones falla.
- [ ] CA-013 (spec): si `work/catalog.json` todavía no existe (el proyecto no pasó por `ingest`),
      `plan` termina con exit code distinto de 0 identificando que falta la etapa previa, sin
      intentar adivinar o generar un catálogo vacío.
- [ ] CA-013 (spec): con argumentos válidos y catálogo existente, `plan` deja escritos
      `work/edl.json` y `work/timeline.json`, exactamente como ya hace `autoMontage` (heredado de
      `cycle-02`).

### HU-14: Renderizar el MP4 con un solo comando

**Requisito relacionado:** RF-11

**Como** dev que ya tiene su `Timeline` planificada
**Quiero** correr un comando `render <ruta-del-proyecto>` que produzca el MP4 final en `out/`
**Para** obtener el video sin tener que invocar `renderTimeline` a mano ni recordar qué valor va en
`publicDir`

**Criterios de aceptación:**

- [ ] CA-013 (spec): el comando `render` existe, recibe la ruta del proyecto, valida que
      `work/timeline.json` exista antes de invocar cualquier binario de Remotion, y devuelve exit
      code distinto de 0 si falta.
- [ ] CA-014 (spec): `render` invoca `renderTimeline` con `publicDir` igual a la raíz del proyecto
      de medios (`media/<slug>/`, nunca `media/<slug>/raw/`) y con `outPath` dentro de
      `media/<slug>/out/` (ver RN-29 — es la decisión D-2 de la spec, vinculante).
- [ ] CA-013 (spec): si `renderTimeline` falla (bundle, composición no encontrada, o render en sí),
      `render` traduce ese fallo a exit code distinto de 0 con la etapa `render` y la causa que
      trae el `RenderTimelineErrorCode` correspondiente, nunca un stack pelado.

### HU-15: Ir de carpeta cruda a video con un solo comando

**Requisito relacionado:** RF-10

**Como** dev que solo quiere el video final, sin inspeccionar los pasos intermedios
**Quiero** correr un único comando `run <ruta-del-proyecto> --preset <preset> [--seed <n>]` que
encadene `ingest`, `plan` y `render` en ese orden
**Para** no tener que recordar cuáles son las tres etapas internas del pipeline ni el orden en que
hay que invocarlas

**Criterios de aceptación:**

- [ ] CA-013 (spec): el comando `run` existe, acepta los mismos argumentos que `plan` (ruta del
      proyecto, preset, seed opcional), y ejecuta ingesta, planificación y render en secuencia
      estricta, nunca en paralelo entre sí (ver RN-32).
- [ ] CA-013 (spec): si cualquiera de las tres etapas falla, `run` se detiene ahí — no continúa a
      la siguiente etapa — y devuelve exit code distinto de 0 identificando la etapa real que
      falló (ver RN-21).
- [ ] CA-013 (spec): si las tres etapas completan sin errores, `run` devuelve exit code 0 y deja
      escritos tanto los artefactos intermedios de `work/` como el MP4 final de `out/`.

### HU-16: Elegir preset y semilla sin ambigüedad

**Requisito relacionado:** RF-10

**Como** dev que va a correr `plan` o `run`
**Quiero** que la CLI me obligue a elegir explícitamente el preset y me deje fijar (u omitir) una
semilla de forma clara
**Para** no descubrir después de un render completo que el video se editó con un ritmo que no era
el que yo quería, ni depender de un valor de semilla que no sé cuál es

**Criterios de aceptación:**

- [ ] CA-013 (spec): `--preset` es un argumento obligatorio de `plan` y `run`, sin valor por
      default; si se omite, el comando termina con exit code distinto de 0 antes de tocar el
      filesystem (ver RN-23).
- [ ] CA-013 (spec): un valor de `--preset` que no sea exactamente uno de `software-demo`,
      `hardware`, `recipe` o `educational` termina el comando con exit code distinto de 0, y el
      mensaje de error incluye tanto el valor recibido como la lista de los cuatro valores válidos.
- [ ] CA-013 (spec): `--seed` es opcional en `plan` y `run`; si se omite, se usa el valor por
      default fijado en RN-24 (ver Decisiones funcionales); si se provee, debe ser un entero no
      negativo, y cualquier otro valor termina el comando con exit code distinto de 0.

### HU-17: Enterarme exactamente qué falló y en qué etapa

**Requisito relacionado:** RNF-7

**Como** dev que acaba de ver que un comando terminó con error
**Quiero** que el mensaje me diga en qué etapa pasó, sobre qué asset o recurso, y por qué — nunca
un stack trace de Node que tenga que interpretar
**Para** poder corregir el problema real (un archivo corrupto, un preset mal escrito, una ruta
equivocada) sin tener que leer código fuente de la CLI ni de las libs para entender el error

**Criterios de aceptación:**

- [ ] CA-013 (spec, RNF-7): todo error que termina un comando con exit code distinto de 0 se
      reporta con, como mínimo, tres datos: la etapa (`ingest`, `plan` o `render`), el recurso
      afectado cuando lo hay (ruta de archivo, id de asset, o nombre del preset recibido), y la
      causa (el código o `reason` del error tipado subyacente de `auto-montage` o
      `composition-remotion`, nunca su stack trace de Node).
- [ ] CA-013 (spec, RNF-7): un error de validación de argumentos (preset desconocido, seed
      inválida, ruta faltante) se reporta con la etapa del comando invocado — nunca `run` como
      etapa, aunque el comando efectivamente ejecutado haya sido `run` (ver RN-21, RN-26).

### HU-18: Repetir la corrida sin miedo a perder nada

**Requisito relacionado:** RF-12

**Como** dev que quiere estar seguro de que puede limpiar los artefactos regenerables sin arriesgar
su material
**Quiero** poder borrar `work/` y `out/` de un proyecto y volver a correr `run` con el mismo preset
y la misma semilla, y obtener el mismo video
**Para** confiar en que `work/` y `out/` son verdaderamente descartables en cualquier momento, y
que jamás necesito hacer una copia de seguridad de nada que no sea `raw/`

**Criterios de aceptación:**

- [ ] CA-016 (spec): sobre un proyecto ya corrido, borrar recursivamente `media/<slug>/work/` y
      `media/<slug>/out/` y volver a correr `run` con la misma ruta, el mismo preset y la misma
      semilla produce un nuevo MP4 en `out/` con las mismas dimensiones, la misma duración
      editada y el mismo contenido editorial que el de la corrida original (ver RN-30 para el
      detalle verificable).
- [ ] CA-016 (spec): tras esa segunda corrida, ningún archivo bajo `media/<slug>/raw/` cambió de
      contenido, tamaño ni fecha de modificación respecto de antes de la primera corrida (ver
      RN-31).

### HU-19: Ver qué hizo la CLI y qué quedó pendiente de revisar

**Requisito relacionado:** RF-10, RF-11

**Como** dev que acaba de correr un comando exitoso
**Quiero** que la CLI me muestre qué rutas produjo, la duración del video editado, y si algún asset
individual tuvo un problema que no llegó a frenar la corrida
**Para** poder revisar rápido si el resultado es el que esperaba, sin tener que abrir a mano
`work/catalog.json`, `work/edl.json` o `work/timeline.json` para enterarme

**Criterios de aceptación:**

- [ ] CA-013 (spec): al terminar con exit code 0, `ingest` reporta la ruta del catálogo escrito,
      cuántos assets quedaron catalogados por rol, y si hubo algún asset con sondeo o transcripción
      fallidos (`probeFailures`, `transcriptionFailures`) — sin que esos fallos individuales
      afecten el exit code (ver RN-27).
- [ ] CA-013 (spec): al terminar con exit code 0, `plan` reporta las rutas de `edl.json` y
      `timeline.json`, la duración editada (`editedDurationMs`) y, si el planificador rechazó
      algún concepto para B-roll (`brollRejections`), cuántos y por qué razón — sin que eso afecte
      el exit code (ver RN-28).
- [ ] CA-013 (spec): al terminar con exit code 0, `render` reporta la ruta del MP4 producido y sus
      dimensiones y duración (ancho, alto, fps, cantidad de frames) tal como las devuelve
      `renderTimeline`.
- [ ] CA-013 (spec): `run` reporta, al terminar con exit code 0, la suma de lo que reportarían por
      separado sus tres etapas — el dev no pierde visibilidad de ningún fallo parcial por haber
      usado el atajo en vez de los tres comandos sueltos.

### HU-20: Confirmar que todo el pipeline funciona con un render real

**Requisito relacionado:** RF-10, RF-11, RF-12

**Como** dev
**Quiero** poder correr `run` sobre un proyecto real de mi máquina, con los binarios instalados, y
obtener un MP4 que se reproduce con las dimensiones del formato elegido
**Para** confirmar, antes de dar el ciclo por cerrado, que la cadena completa (ingesta real,
montaje real, render real de Remotion) funciona de punta a punta y no solo contra dobles de test

**Criterios de aceptación:**

- [ ] CA-015 (spec): un smoke manual de `run` sobre un proyecto real en `media/`, con los binarios
      instalados, produce un archivo MP4 en `out/` que un reproductor puede abrir y reproducir, con
      el ancho y el alto correspondientes al formato de salida configurado.
- [ ] CA-015 (spec): ese smoke se corre respetando RN-32 (nunca transcripción y render en
      paralelo) y una sola vez al cierre del ciclo, no en cada corrida de la suite automatizada.

## Reglas de negocio

> Numeración continua a nivel spec: `cycle-01` cerró en RN-07, `cycle-02` en RN-19. Esta sección
> arranca en RN-20.

20. **RN-20:** Cada uno de los 4 comandos valida sus propias precondiciones antes de tocar el
    filesystem o invocar un binario: la ruta del proyecto fue provista y apunta a una carpeta que
    existe y tiene `raw/` con al menos una de las subcarpetas reconocidas (para `ingest`);
    `work/catalog.json` existe (para `plan`); `work/timeline.json` existe (para `render`). Ninguna
    de estas validaciones depende de que `ingestProject` o `autoMontage` lleguen a ejecutarse.
21. **RN-21:** `run` no es una etapa nueva ni tiene su propio vocabulario de error: internamente
    ejecuta `ingest`, `plan` y `render` en ese orden, se detiene en la primera que falla, y el
    error resultante identifica siempre la etapa real que falló — nunca se reporta `run` como la
    etapa de un error.
22. **RN-22:** La ruta del proyecto de medios es un argumento posicional obligatorio en los 4
    comandos; no existe un "proyecto actual" implícito ni una ruta por default.
23. **RN-23:** `--preset` es obligatorio en `plan` y en `run` y no tiene valor por default: el
    preset cambia demasiado el resultado editorial (agresividad de poda, punch-in, densidad de
    B-roll, transiciones — RN-16 de `cycle-02`) como para que la CLI lo adivine. Un valor que no
    sea exactamente uno de los 4 nombres soportados es un error de validación de argumentos.
24. **RN-24:** `--seed` es opcional en `plan` y en `run`, con un valor por default fijo (ver
    Decisiones funcionales de este ciclo). Cuando se provee, debe ser un entero no negativo;
    cualquier otro valor es un error de validación de argumentos.
25. **RN-25:** El exit code de cualquier comando es `0` únicamente cuando la totalidad de su etapa
    (o, en `run`, las tres etapas) completó sin ningún error tipado. Cualquier error — de
    validación de argumentos, de precondición, o propagado desde `auto-montage` o
    `composition-remotion` — produce un exit code distinto de `0`.
26. **RN-26:** Todo mensaje de error identifica, como mínimo, la etapa (`ingest`, `plan` o
    `render`), el recurso afectado cuando lo hay (ruta, id de asset, o valor de argumento
    recibido), y la causa (el código o `reason` del error tipado subyacente). Nunca se expone un
    stack trace de Node como mensaje de error de cara al dev.
27. **RN-27:** Un fallo de sondeo o de transcripción de un asset individual durante `ingest`
    (`probeFailures`, `transcriptionFailures` de `IngestResult`) no es un error de CLI: el comando
    termina con exit code `0` y reporta esos fallos como parte de su salida informativa, porque el
    catálogo resultante sigue siendo utilizable con el resto del material (hereda RN-02 de
    `cycle-01`; la CLI no puede volverse más estricta que la librería que ya decidió tolerarlos).
28. **RN-28:** Un concepto sin B-roll asignado o rechazado por empate (`brollRejections` de
    `AutoMontageResult`) durante `plan` no es un error de CLI, por la misma razón que RN-27: se
    reporta como salida informativa, nunca como causa de exit code distinto de `0` (hereda RN-14 de
    `cycle-02`).
29. **RN-29:** `render` invoca `renderTimeline` con `publicDir` igual a la raíz del proyecto de
    medios (`media/<slug>/`, nunca `media/<slug>/raw/`) y `outPath` dentro de `media/<slug>/out/` —
    es la decisión D-2 de la spec (HC-1 de este ciclo), vinculante: cualquier otra combinación deja
    los assets fuera de la rama `staticFile()` verificada de `assetSrc`.
30. **RN-30:** Idempotencia de `run` (CA-016): sobre el mismo proyecto, el mismo preset y el mismo
    seed, borrar `work/` y `out/` y volver a correr `run` reproduce un MP4 con el mismo contenido
    editorial, las mismas dimensiones y la misma duración en frames que la corrida anterior. El
    mecanismo exacto de verificación (comparación de bytes del archivo completo, o de metadata y
    muestreo de frames) es una decisión técnica que resuelve el arquitecto de este ciclo; esta
    regla fija la reproducibilidad observable del resultado, no el mecanismo de verificación.
31. **RN-31:** Ninguno de los 4 comandos escribe jamás dentro de `raw/`, en ningún escenario,
    incluida una corrida repetida tras borrar `work/` y `out/` — hereda RN-01 de `cycle-01`. Una
    corrida repetida dentro de este ciclo no queda exenta de esa garantía por el solo hecho de ser
    una repetición.
32. **RN-32:** Transcripción (etapa `ingest`) y render (etapa `render`) nunca corren en paralelo
    dentro de una misma invocación de `run`: comparten los mismos 16 GB de RAM de la máquina del
    dev (Chrome Headless Shell, ffmpeg, Whisper) — hereda RN-07 de `cycle-01`. `run` lo garantiza
    por construcción al ejecutar sus tres etapas en secuencia estricta, nunca de forma concurrente.

## Decisiones funcionales tomadas en este ciclo

> La spec y el brief no resuelven todos los detalles del contrato de uso de la CLI. Estas son las
> decisiones tomadas para no bloquear el ciclo, con la opción más conservadora en cada caso.

1. **Valor por default de `--seed`: `0`.** `AutoMontageOptions.seed` es un campo obligatorio en
   `libs/auto-montage` sin ningún default establecido en la librería (los tests internos usan
   valores como `42` o `1`, pero son arbitrarios de fixture, no una convención de producto). Se
   fija `0` como default de la CLI porque es el valor más neutro posible: no está atado a ningún
   fixture de test ni sugiere una preferencia editorial. Si el dev quiere reproducir un resultado
   específico o explorar variaciones, usa `--seed` explícito.
2. **`--preset` sin default en `plan` y `run`.** Decisión conservadora: dado que el preset cambia
   materialmente el resultado editorial (RN-16 de `cycle-02`), forzar la elección explícita es más
   seguro que arriesgar un montaje con el ritmo equivocado sin que el dev lo note hasta ver el
   video terminado.
3. **Los fallos parciales (`probeFailures`, `transcriptionFailures`, `brollRejections`) nunca
   producen exit code distinto de `0`.** Es la única lectura consistente con decisiones ya cerradas
   en ciclos anteriores: RN-02 (`cycle-01`) y RN-14 (`cycle-02`) establecieron, a nivel de
   librería, que estos fallos no abortan el pipeline. Que la CLI los convirtiera en fallo de exit
   code contradiría esa decisión ya tomada y penalizaría al dev por un comportamiento que la propia
   librería diseñó como tolerante.
4. **`render` no recibe `--preset` ni `--seed`.** Opera exclusivamente sobre el
   `work/timeline.json` que ya dejó `plan`; exponer esos flags en `render` sugeriría, falsamente,
   que puede recalcular el montaje con otro preset sin volver a correr `plan`.
5. **Vocabulario de etapas cerrado a `ingest`, `plan`, `render`.** Nunca `run` (que es una
   composición, no una etapa propia) ni `args` (un fallo de validación de argumentos se reporta con
   la etapa del comando invocado, no con una etapa genérica) — así el dev siempre sabe en qué parte
   real del pipeline intervenir.
6. **Mecanismo exacto de verificación de "mismo MP4" (CA-016): fuera de esta decisión.** La regla
   de negocio (RN-30) fija la reproducibilidad observable; si la codificación H.264 resulta no ser
   perfectamente determinista a nivel de bytes (por ejemplo, por metadata de encoding con
   timestamps), es una decisión técnica del arquitecto cómo verificarlo — no cambia el requisito de
   negocio, que sigue siendo "el mismo video, no un video parecido".
7. **La CLI no expone flags para `language`, `transcribeRoles`, `arollAssetId`, `musicAssetId` ni
   `outputPreset`**, aunque `IngestOptions`/`AutoMontageOptions` los admiten como opcionales: el
   brief de este ciclo solo pide ruta, preset y seed como argumentos. Se documenta acá para que
   quede explícito que no es un olvido: si en uso real hiciera falta exponerlos, es alcance de un
   ciclo o fix posterior, no de este.

## Glosario del dominio

| Término                     | Definición                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Etapa                        | Cada una de las tres fases propias del pipeline expuestas como comando: `ingest`, `plan`, `render`. `run` no es una etapa, es su encadenamiento. |
| Comando encadenado (`run`)   | Comando que ejecuta `ingest`, `plan` y `render` en secuencia estricta, deteniéndose en la primera etapa que falla.               |
| Argumento posicional         | La ruta del proyecto de medios, obligatoria en los 4 comandos, sin default.                                                     |
| Flag                         | `--preset` y `--seed`: opciones con nombre, obligatoria la primera en `plan`/`run`, opcional la segunda con default fijo.       |
| Exit code                    | Código de salida del proceso: `0` solo en éxito completo de la etapa o etapas invocadas; distinto de `0` ante cualquier error.  |
| Fallo parcial (dato)         | Un problema sobre un asset o concepto individual que la librería devuelve como parte del resultado (`probeFailures`, `transcriptionFailures`, `brollRejections`), nunca como excepción — no afecta el exit code. |
| Error (excepción)            | Un problema que impide completar la etapa: falta una precondición, un argumento es inválido, o un error tipado de `auto-montage`/`composition-remotion` se propaga sin capturar — sí afecta el exit code. |
| Idempotencia (de `run`)      | Propiedad de que, sobre el mismo proyecto, preset y seed, borrar `work/` y `out/` y repetir `run` reproduce el mismo resultado sin tocar `raw/` (RN-30, RN-31). |
| `publicDir`                  | Raíz del proyecto de medios (`media/<slug>/`) que `render` pasa a `renderTimeline`; nunca `raw/` (D-2 de la spec, RN-29).        |
| `outPath`                    | Ruta del MP4 final, siempre dentro de `media/<slug>/out/`.                                                                      |
| Smoke manual                 | Verificación con binarios reales (ffmpeg, whisper-cli, Chrome/Remotion), fuera de CI y de la suite automatizada; se corre una sola vez al cierre del ciclo (CA-015).|

## Trazabilidad

| HU / RN                                   | RF / RNF     | CA                     |
| ------------------------------------------ | ------------ | ---------------------- |
| HU-12 (Ingerir con `ingest`)                | RF-10        | CA-013                 |
| HU-13 (Planificar con `plan`)               | RF-10        | CA-013                 |
| HU-14 (Renderizar con `render`)             | RF-11        | CA-013, CA-014         |
| HU-15 (Encadenar con `run`)                 | RF-10        | CA-013                 |
| HU-16 (Elegir preset y semilla)             | RF-10        | CA-013                 |
| HU-17 (Contrato de errores)                 | RNF-7        | CA-013                 |
| HU-18 (Idempotencia de `run`)               | RF-12        | CA-016                 |
| HU-19 (Salida informativa)                  | RF-10, RF-11 | CA-013                 |
| HU-20 (Smoke end-to-end)                    | RF-10, RF-11, RF-12 | CA-015          |
| RN-20 a RN-22 (precondiciones y argumentos) | RF-10        | CA-013                 |
| RN-23, RN-24 (preset y seed)                | RF-10        | CA-013                 |
| RN-25, RN-26 (exit code y contrato de error) | RNF-7       | CA-013                 |
| RN-27, RN-28 (fallos parciales vs. error)   | RF-10        | CA-013                 |
| RN-29 (`publicDir`/`outPath`)               | RF-11        | CA-014                 |
| RN-30, RN-31 (idempotencia, `raw/` intacto) | RF-12        | CA-016                 |
| RN-32 (transcripción/render nunca en paralelo) | RNF-7 (heredada de RN-07/`cycle-01`) | CA-015 |
