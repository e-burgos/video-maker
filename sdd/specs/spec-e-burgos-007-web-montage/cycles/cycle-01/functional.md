# Functional — Cycle 1: Web Montage (montage-job-api)

> **Input:** sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El producto es local y de un solo usuario. Hoy el Web Studio (`spec-e-burgos-006`) ya permite crear
un proyecto y subir el material crudo, y ya sabe previsualizar, editar y renderizar una `Timeline`
una vez que existe — pero esa `Timeline` sólo la produce hoy una herramienta de línea de comandos
(`tools/render-cli`). Un proyecto creado desde la web queda entonces varado: sin `Timeline` no hay
preview, no hay edición y no hay render, y el dev tiene que abrir una terminal para desatascarlo. El
pedido de negocio de este ciclo es cerrar exactamente ese hueco: que el mismo servicio HTTP que ya
sabe renderizar (`apps/render-api`) aprenda también a **montar** — es decir, a mirar el material
crudo, transcribirlo y producir la `Timeline` y su lista de decisiones de edición — para que todo el
recorrido "subir material → generar el montaje → ajustarlo → renderizar → descargar" quede disponible
sin tocar la terminal.

Este ciclo tiene dos consumidores, y las historias de este documento están escritas desde ellos:

- **El dev, operando por HTTP directamente en su máquina** (con `curl`, con un cliente HTTP
  cualquiera): hoy es quien corre `render-cli ingest` y `render-cli plan` a mano, y quiere poder
  disparar y seguir ese mismo trabajo sin salir de la terminal a la que ya está acostumbrado o, en el
  futuro cercano, sin necesitarla.
- **`apps/web` como consumidor de máquina**: no ve este ciclo (el botón y la pantalla son
  `cycle-02`), pero es quien en el próximo ciclo va a disparar estos jobs y seguirlos, y todo lo que
  hoy manda al crear un job de render tiene que seguir significando exactamente lo mismo que
  significa hoy.

Dos particularidades del dominio gobiernan el diseño de las historias y las reglas de negocio:

1. **La etapa de transcripción (Whisper) es lenta** — del orden de minutos, no de segundos — así que
   saber en qué etapa está un montaje en curso no es un detalle cosmético: es lo único que le permite
   a un consumidor explicar una espera larga en vez de dejar al dev mirando una rueda girar sin
   información.
2. **Regenerar un montaje sobre un proyecto que el dev ya editó a mano desde el studio destruye ese
   trabajo.** La `Timeline` es, hoy, el único documento del proyecto que se edita directamente desde
   la web. Por eso pisarla nunca puede ser el comportamiento por default: tiene que pedirse a
   propósito.

Y una garantía transversal, que no es un detalle técnico sino la razón de negocio por la que este
ciclo existe: el montaje que produce la API tiene que ser el **mismo** montaje que produce
`tools/render-cli` para el mismo material — nunca una segunda implementación "parecida". Eso es lo
que le permite al dev seguir usando la terminal cuando quiera y la web cuando quiera, sobre el mismo
proyecto, sin que una herramienta contradiga a la otra.

---

## Historias de usuario

### HU-01: Que nada de lo que ya funciona hoy cambie de significado

**Como** consumidor existente del servicio (`apps/web` tal como está hoy, o el dev por HTTP)
**Quiero** que un pedido de nuevo job que no menciona para nada el tipo de trabajo siga significando
exactamente lo que significa hoy
**Para** no tener que cambiar una sola línea del cliente HTTP que ya existe el día que el servicio
aprenda a montar

**Criterios de aceptación:**

- [ ] CA-001: Un pedido de nuevo job sin body produce el mismo job de render que produce hoy, con el
      mismo comportamiento (incluido el rechazo si el proyecto todavía no tiene `Timeline`).
- [ ] CA-002: Un pedido de nuevo job con body vacío produce exactamente lo mismo que CA-001.
- [ ] CA-003: Un pedido de nuevo job cuyo body no menciona el tipo de trabajo (así traiga otros datos
      que el servicio ya ignoraba antes de este ciclo) produce exactamente lo mismo que CA-001.
- [ ] CA-004: Todo campo que el servicio ya devolvía hoy al consultar un job o el listado de jobs de
      un proyecto sigue presente, con el mismo nombre y el mismo significado; el único agregado
      observable es poder distinguir de qué tipo es cada job.

---

### HU-02: Producir el montaje de un proyecto nuevo sin salir de la web

**Como** dev operando por HTTP (y, desde `cycle-02`, `apps/web` en mi nombre)
**Quiero** poder pedir el montaje de un proyecto que todavía no tiene `Timeline`, con los mismos
parámetros con los que hoy lo pido desde la terminal
**Para** que un proyecto creado en el Web Studio deje de estar varado sin abrir una consola

**Criterios de aceptación:**

- [ ] CA-005: Pedir un montaje sobre un proyecto sin `Timeline` previa registra un job (con la misma
      forma general que un job de render: se puede consultar, tiene progreso, termina en un estado
      final) que, al terminar con éxito, deja el proyecto con su catálogo de material, su `Timeline`
      y su lista de decisiones de edición recién producidos.
- [ ] CA-006: Si no se indica el estilo de montaje (`preset`), se usa el estilo por default del
      producto (`software-demo`).
- [ ] CA-007: Si no se indica la semilla de aleatoriedad (`seed`), se usa `0`.
- [ ] CA-008: Pedir el mismo montaje dos veces, con el mismo material, el mismo `preset` y el mismo
      `seed`, deja en ambos casos el catálogo, la `Timeline` y la lista de decisiones de edición
      indistinguibles entre sí byte a byte (ver RN-4) — y también indistinguibles de lo que deja
      `tools/render-cli` corriendo `ingest` y después `plan` sobre el mismo material.

---

### HU-03: No perder nunca una edición manual por accidente

**Como** dev que ya ajustó a mano la `Timeline` de un proyecto desde el Web Studio
**Quiero** que un nuevo pedido de montaje sobre ese proyecto se rechace en vez de pisar mi edición,
salvo que yo confirme explícitamente que quiero reemplazarla
**Para** no perder trabajo de edición manual por un clic (o un pedido automático de `apps/web`)
hecho sin darme cuenta de que ya existía un montaje

**Criterios de aceptación:**

- [ ] CA-009: Pedir un montaje sobre un proyecto que ya tiene `Timeline` persistida, sin confirmar el
      reemplazo, se rechaza con un error identificable por código (no un mensaje libre) y con un
      estado HTTP que indica que el pedido en sí es válido pero el estado actual del proyecto lo
      bloquea.
- [ ] CA-010: Ese rechazo es inmediato: no aparece ningún job nuevo al consultar el proyecto (ni en
      el listado ni por id) y ningún archivo del proyecto se modifica.
- [ ] CA-011: El mismo pedido, confirmando explícitamente el reemplazo, sí registra el job, corre, y
      al terminar reemplaza el catálogo, la `Timeline` y la lista de decisiones de edición
      anteriores por los nuevos.
- [ ] CA-012: Un proyecto que todavía no tiene `Timeline` (HU-02) nunca dispara este rechazo, se pida
      o no se pida el reemplazo explícito.

---

### HU-04: Saber en qué etapa está un montaje en curso

**Como** `apps/web` (y, a mano, el dev que consulta el estado de un job)
**Quiero** poder consultar en qué etapa del proceso está un montaje que todavía no terminó, con un
progreso que nunca retrocede
**Para** poder mostrarle al dev por qué la espera es larga, en vez de una rueda girando sin
información durante varios minutos de transcripción

**Criterios de aceptación:**

- [ ] CA-013: Mientras un montaje está en curso, se puede consultar en cuál de sus etapas propias
      está (descubrimiento de material, sondeo técnico, transcripción o planificación del montaje).
- [ ] CA-014: A lo largo de la vida de un mismo job, las etapas observadas nunca retroceden a una
      etapa anterior a la ya alcanzada.
- [ ] CA-015: Un proyecto cuyo material ya estaba completo en un catálogo previo (nada nuevo que
      sondear ni transcribir) puede terminar exitosamente sin haber pasado nunca por la etapa de
      sondeo ni por la de transcripción — eso es el comportamiento esperado, no una falla del
      seguimiento de progreso (ver RN-3).
- [ ] CA-016: Durante las etapas donde se procesa material de a un archivo por vez, si se sabe de
      antemano cuántos archivos hay en total, el progreso incluye cuántos ya se procesaron sobre
      cuántos en total; si ese total todavía no se conoce, esa información no se informa como un
      número (aparece explícitamente vacía, nunca como un cero o un porcentaje engañoso).
- [ ] CA-017: Al terminar con éxito la última etapa, el job pasa a su estado final exitoso y su
      resultado queda disponible para consultarlo.

---

### HU-05: Distinguir un montaje de un render sin ambigüedad

**Como** `apps/web`
**Quiero** que tanto el listado de jobs de un proyecto como el detalle de un job digan siempre de qué
tipo de trabajo se trata
**Para** poder mostrar la pantalla correcta (progreso de montaje o progreso de render) sin tener que
adivinarlo por otra señal

**Criterios de aceptación:**

- [ ] CA-018: Cada elemento del listado de jobs de un proyecto indica de qué tipo es ese job.
- [ ] CA-019: El detalle de un job indica el mismo tipo con el que se lo pidió, sin importar en qué
      estado esté (en curso, terminado con éxito, fallado o cancelado).
- [ ] CA-020: Todo lo que el listado y el detalle ya informaban de un job de render antes de este
      ciclo lo siguen informando exactamente igual (ver también CA-004).

---

### HU-06: Poder desistir de un montaje que ya no hace falta

**Como** dev (y `apps/web` en mi nombre)
**Quiero** poder cancelar un montaje que todavía no terminó
**Para** no tener que esperar varios minutos de transcripción por un job que pedí por error o que ya
no necesito

**Criterios de aceptación:**

- [ ] CA-021: Cancelar un montaje que todavía no empezó a correr lo deja cancelado de inmediato, sin
      que llegue a ejecutar ninguna de sus etapas.
- [ ] CA-022: Cancelar un montaje que ya está corriendo no lo termina en el acto: queda marcado como
      "cancelándose" hasta que la etapa en curso llega a su próximo punto de control natural, momento
      en el que recién pasa a cancelado. Ningún proceso externo en ejecución (transcripción, sondeo)
      es interrumpido a la fuerza.
- [ ] CA-023: Un montaje cancelado durante la transcripción o la planificación no deja un catálogo,
      una `Timeline` o una lista de decisiones de edición a medio escribir: lo que haya quedado
      escrito corresponde siempre a un punto de control completo, nunca a uno interrumpido a mitad
      de camino.
- [ ] CA-024: Un montaje ya terminado (con éxito, fallado o ya cancelado) no admite un nuevo pedido
      de cancelación que lo cambie de estado.

---

### HU-07: Enterarme de por qué falló un montaje sin que la consulta en sí falle

**Como** `apps/web` (y el dev consultando a mano)
**Quiero** poder leer, con la misma consulta que uso para ver el progreso, por qué falló un montaje
**Para** mostrarle al dev un motivo entendible sin que la propia petición HTTP se caiga con un error

**Criterios de aceptación:**

- [ ] CA-025: Consultar un montaje que terminó fallando responde con éxito de transporte (la consulta
      en sí no falla); el motivo del fallo viaja identificado por un código, nunca como el mensaje
      crudo de una herramienta interna ni con una ruta de archivo del disco del dev.
- [ ] CA-026: Un `preset` que no es ninguno de los estilos de montaje soportados, o un `seed` que no
      es un entero mayor o igual a cero, rechazan el pedido antes de registrar ningún job (no llega a
      existir un job que después falle por este motivo).
- [ ] CA-027: El proyecto o la referencia al proyecto siguen validándose exactamente igual que para
      un job de render (mismo rechazo si el proyecto no existe, mismo rechazo si la referencia al
      proyecto no tiene una forma válida): pedir un montaje no relaja ni duplica esas validaciones.

---

### HU-08: Entender por qué mi pedido quedó esperando

**Como** `apps/web`
**Quiero** saber que nunca hay dos jobs corriendo a la vez, sea cual sea su tipo
**Para** poder explicarle al dev que su pedido quedó en espera porque hay otro trabajo corriendo, en
vez de que parezca que el servicio no respondió

**Criterios de aceptación:**

- [ ] CA-028: Si ya hay un job corriendo (de cualquier tipo) y se registra un job nuevo (de
      cualquier tipo), ese job nuevo queda en espera, nunca corriendo en simultáneo con el anterior.
- [ ] CA-029: Un job en espera pasa a correr recién cuando el que estaba corriendo llega a un estado
      final (con éxito, fallado o cancelado) — nunca antes.
- [ ] CA-030: Se puede distinguir, consultando el job, si está esperando su turno o si ya está
      corriendo (ver también RN-7).

---

### HU-09: Saber si el servicio puede transcribir antes de lanzar un montaje largo

**Como** dev (y `apps/web` consultando en mi nombre antes de ofrecer el botón de montar)
**Quiero** poder saber si el servicio tiene resuelto todo lo necesario para transcribir **antes** de
pedir un montaje
**Para** no descubrir recién a los tres minutos, con un job fallado, que faltaba algo que se podía
haber sabido de entrada

**Criterios de aceptación:**

- [ ] CA-031: Se puede consultar el estado general de salud del servicio y, en ese mismo lugar,
      saber si el servicio sabe montar (no sólo renderizar).
- [ ] CA-032: Si a la máquina le falta cualquiera de las capacidades que un montaje necesita para
      transcribir, el estado general de salud lo refleja como degradado — no como saludable con una
      advertencia aparte, y no en silencio.
- [ ] CA-033: Un dev que lanza igualmente un montaje con el servicio degradado por ese motivo ve el
      job terminar en fallado con un error identificable (ver HU-07), nunca colgado indefinidamente
      ni corriendo un motor que no tiene con qué transcribir.

---

## Reglas de negocio

- **RN-1 (Default de compatibilidad):** un pedido de nuevo job cuyo body está ausente, vacío, o no
  trae la indicación de tipo de trabajo significa, siempre y sin excepción, un job de render con el
  comportamiento vigente hoy — byte por byte del payload que ya manda `apps/web`. Ningún campo que
  el servicio ya publica hoy para un job de render cambia de nombre ni de significado; la única
  información nueva es la que permite distinguir de qué tipo es cada job, y está disponible para
  ambos tipos por igual (RF-1, RF-7 de la spec).

- **RN-2 (Sobreescritura no es el default):** si el proyecto ya tiene su `Timeline` persistida, un
  pedido de montaje que no confirma explícitamente el reemplazo se rechaza — con un código de error
  propio y un estado HTTP que señala que el bloqueo es por el estado actual del recurso, no por un
  dato mal formado — **sin registrar ningún job y sin tocar un solo archivo del proyecto**. Con la
  confirmación explícita, el job se registra, corre, y reemplaza lo anterior. El fundamento es que
  la `Timeline` puede llevar edición manual del dev hecha desde el studio, y regenerarla la destruye
  (D-6 de la spec).

- **RN-3 (Etapas monotónicas y salteables):** un montaje reporta su avance en cuatro etapas propias
  — descubrimiento de material, sondeo técnico, transcripción y planificación del montaje — que a lo
  largo de un mismo job **nunca retroceden**. Que un job no pase por sondeo o por transcripción
  (porque todo el material ya estaba resuelto en un catálogo previo) es **contrato explícito, no un
  defecto**: no todo montaje visita las cuatro etapas, pero ninguno visita una etapa fuera de ese
  orden. Durante las etapas que procesan material archivo por archivo, el porcentaje de avance sólo
  se informa como número cuando se conoce de antemano el total de archivos a procesar; cuando ese
  total todavía no se conoce, el campo se informa explícitamente vacío en vez de asumir un valor
  (RF-5 de la spec).

- **RN-4 (Byte-identidad con la CLI):** para el mismo material de entrada, el mismo `preset` y el
  mismo `seed`, lo que un montaje escribe en el proyecto (catálogo, `Timeline` y lista de decisiones
  de edición) tiene que ser indistinguible, byte a byte, de lo que produce hoy `tools/render-cli`
  corriendo su equivalente de terminal sobre el mismo material. No es una optimización interna: es
  lo que le permite al dev alternar libremente entre la terminal y la web sobre el mismo proyecto sin
  que una herramienta contradiga a la otra (RF-2, RF-4 de la spec).

- **RN-5 (Defaults y validación de parámetros):** los parámetros de un montaje son el estilo del
  montaje (`preset`, default el estilo `software-demo`), la semilla de aleatoriedad (`seed`, un
  entero mayor o igual a cero, default `0`) y la confirmación de reemplazo (`overwrite`, default
  "no confirmado"). Un valor que no respeta esa forma (un estilo que no existe, una semilla que no es
  un entero no negativo) se rechaza **antes de registrar el job** — nunca como un job que se crea y
  después falla por ese motivo (RF-3 de la spec).

- **RN-6 (Estados observables de un montaje):** un montaje pasa por los mismos estados observables
  que ya tiene un job de render hoy: en espera, corriendo, cancelándose, terminado con éxito,
  fallado, o cancelado. La cancelación es **cooperativa**: nunca se interrumpe a la fuerza un proceso
  en ejecución; un job cancelado mientras corre una etapa larga se liquida recién en el próximo punto
  de control de esa etapa. Un job fallado se consulta con éxito de transporte y el motivo del fallo
  viaja identificado por código dentro de la respuesta, nunca como un estado de error de la propia
  consulta (RF-8, RF-9 de la spec).

- **RN-7 (Una sola cola para los dos tipos de trabajo):** el servicio nunca corre una transcripción y
  un render al mismo tiempo, ni dos montajes entre sí, ni dos jobs de ningún tipo mezclado: hay como
  máximo un job corriendo a la vez, y todo pedido adicional queda en espera hasta que ese termina.
  Esta garantía no es un detalle de rendimiento: es lo que le permite a `apps/web` explicarle al dev
  por qué su pedido está esperando en vez de mostrar un fallo (D-2 de la spec; garantía de operación
  ya vigente para los jobs de render, extendida sin cambios a los de montaje).

- **RN-8 (Whisper es una capacidad, no un supuesto):** transcribir depende de que la máquina tenga
  resueltas las herramientas necesarias, incluido el modelo de Whisper, que — a diferencia de las
  demás — no tiene una forma automática de encontrarse sola si falta la configuración explícita para
  ella. Si algo de eso falta, el servicio se reporta a sí mismo como degradado, y esa señal tiene que
  poder consultarse **antes** de lanzar un montaje. Lanzarlo igual con el servicio degradado por este
  motivo termina en un job fallado con motivo identificable, nunca en un montaje colgado ni en una
  transcripción que arranca sin con qué transcribir (RF-10, RF-11 de la spec).

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| **Montage job** | El trabajo, encolado por el servicio, que a partir del material crudo de un proyecto produce su catálogo, su `Timeline` y su lista de decisiones de edición — el equivalente, por HTTP, de correr `ingest` y después `plan` desde la terminal. |
| **Render job** | El trabajo, ya existente hoy, que a partir de una `Timeline` ya producida genera el video final descargable. No produce la `Timeline`: la consume. |
| **Catalog** | El inventario del material crudo de un proyecto una vez descubierto, sondeado técnicamente y transcrito — la base de datos sobre la que se decide cómo montar. |
| **Timeline** | El documento editable que describe el video final: qué clips van, en qué orden, con qué recortes y qué efectos. Es lo único del proyecto que hoy se edita a mano desde el Web Studio, y por eso regenerarlo sin querer es el riesgo que gobierna RN-2. |
| **EDL (lista de decisiones de edición)** | El registro de las decisiones de montaje que explican cómo se llegó a esa `Timeline` — dónde se cortó, dónde se hizo zoom, cómo se agruparon los subtítulos — producido junto con ella en la misma etapa de planificación. |
| **Preset** | El estilo de montaje a aplicar (por ejemplo, el default `software-demo`): un conjunto de reglas ya cerrado que decide cómo se corta, se agrupa y se ritma el material. |
| **Seed** | El número que fija el comportamiento de las decisiones del montaje que dependen de aleatoriedad, de forma que el mismo material, el mismo preset y el mismo seed siempre producen el mismo resultado (base de RN-4). |
| **Overwrite** | La confirmación explícita, en el pedido de montaje, de que se acepta reemplazar una `Timeline` que ya existía. Sin ella, un proyecto con `Timeline` previa rechaza el montaje (RN-2). |
| **Stage (etapa)** | Cada uno de los cuatro momentos observables del progreso de un montaje: descubrir el material, sondearlo técnicamente, transcribirlo, y planificar el montaje a partir de lo anterior. Monotónicas y salteables (RN-3). |
| **Degraded (degradado)** | El estado general de salud del servicio cuando le falta alguna capacidad necesaria para hacer su trabajo por completo — en este ciclo, específicamente, cualquiera de las herramientas que un montaje necesita para transcribir (RN-8). |

---

## Notas para el Arquitecto

Este documento describe comportamiento observable por HTTP; deliberadamente no fija forma de
payload, nombres de campos, rutas ni nombres de código de error — eso es su decisión. Quedan
abiertas, en particular:

- El nombre concreto y el mapeo HTTP exacto de cada código de error nuevo (el rechazo de RN-2, el de
  parámetro inválido de RN-5, el de fallo por capacidad faltante de RN-8): este documento sólo
  describe en prosa el rechazo que hace falta, nunca un nombre de código.
- La forma exacta en la que el discriminante de tipo de trabajo, los parámetros del montaje y las
  etapas de progreso viajan en el body de la petición y de la respuesta.
- Cómo se representa "total todavía no conocido" en el campo de conteo de assets de CA-016 (¿ausente?
  ¿`null`? lo decide el contrato).
- Si D-2 (un solo endpoint con discriminante) se ratifica tal como lo asume este documento, o si el
  arquitecto encuentra evidencia para rebatirlo.
