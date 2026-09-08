# Functional — Cycle 2: Kinetic Captions & Safe Zones (composition-remotion)

> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

`cycle-01` le dejó a esta librería toda la capa de decisión: qué estilos de subtítulos existen, cuánto
margen extra hay que sumar por red social, dónde se dibuja la caja de texto y qué tamaño de letra le
corresponde a una frase. Pero todo eso hoy es una foto fija. El bloque de palabras aparece de golpe
en pantalla, se queda inmóvil mientras dura la frase, y desaparece de golpe cuando termina. Nada se
mueve, nada se ilumina.

Lo que hace que un Reel retenga al espectador es exactamente lo que falta: que la frase entre con
energía, que la palabra que se está diciendo en ese instante se ilumine para que el ojo la siga sin
necesidad de sonido, y que la palabra clave de la frase quede marcada de principio a fin para que la
idea central salte a la vista aunque el espectador entre y salga del video en cualquier momento.

Este ciclo entrega ese movimiento. No repite ni toca nada de lo que ya quedó resuelto en `cycle-01`
—los cuatro estilos, los márgenes por red social, el anclaje de la caja, el ajuste de tamaño de
letra ni los estilos por palabra— eso está cerrado y probado. Lo que agrega es: cómo entra y sale el
bloque de la frase, cómo se ilumina la palabra que se está diciendo, el componente final que efectiva
y visualmente reemplaza al bloque de subtítulos estático de hoy, y una manera de que el creador compare
los cuatro estilos disponibles con sus propios ojos antes de decidir cuál usar.

Ese último punto tiene una razón de negocio concreta: **el render final de un video es una operación
cara** —consume varios minutos de CPU y de disco en una máquina que además hace transcripción de audio
para otros proyectos— así que el creador no puede darse el lujo de renderizar cuatro videos completos
solo para comparar looks. Necesita poder mirar los cuatro estilos lado a lado, montados en pantalla y
en movimiento, sin pagar el costo de un render real. Por el mismo motivo, la única vez que este ciclo sí
ejecuta un render real de verificación —para confirmar que todo lo construido efectivamente compone un
video— tiene que ser un paso manual, deliberado, ejecutado una sola vez al cierre del ciclo, y nunca al
mismo tiempo que la máquina esté transcribiendo audio de otro proyecto: la máquina de trabajo es una
notebook de recursos acotados y compartida entre tareas, no un servidor dedicado.

El desarrollador que integra esta librería (hoy en `TimelineComposition`) necesita, además, que el
bloque de subtítulos estático que usaba hasta `cycle-01` deje de existir una vez que el nuevo
componente animado está en su lugar: no tiene sentido mantener dos caminos para lo mismo.

---

## Historias de usuario

### HU-2-01: Que mis subtítulos entren y salgan de pantalla con energía

**Como** creador que edita mi pieza
**Quiero** que cada bloque de palabras aparezca en pantalla con un movimiento de entrada con rebote
o desplazamiento (según el estilo que elegí) y se retire con un movimiento simétrico al final de la
frase, en lugar de aparecer y desaparecer de golpe
**Para** que mi video transmita energía y retenga la atención del espectador, sin que yo tenga que
animar nada a mano

**Criterios de aceptación:**

- [ ] CA-1: Al arrancar cada frase, el bloque de palabras se ve todavía incompleto (más transparente
      que su estado final, y además más chico si mi estilo es de los que rebotan) y, pasado el
      instante de entrada, se ve exactamente en su estado final (opacidad completa y tamaño normal)
      (referencia técnica: CA-006)
- [ ] CA-2: Hacia el final de la frase, el bloque de palabras repite ese mismo recorrido en sentido
      inverso, hasta desaparecer (referencia técnica: CA-006)
- [ ] CA-3: Si vuelvo a mirar el mismo instante exacto de la misma frase, el bloque de palabras se ve
      siempre igual: la animación es predecible y repetible, no varía de una reproducción a otra
      (referencia técnica: CA-006)

**Prioridad:** Alta
**Estimación:** M

---

### HU-2-02: Seguir con la vista la palabra que se está diciendo

**Como** espectador del video
**Quiero** que la palabra que se está pronunciando en cada instante se ilumine dentro del bloque de
subtítulos
**Para** poder seguir la frase con la vista al ritmo de la voz, incluso viendo el video sin sonido

**Criterios de aceptación:**

- [ ] CA-4: En cualquier instante dentro de la duración de una frase, hay como máximo una palabra
      marcada como la que se está diciendo, y es la que corresponde según el tiempo real de esa
      palabra dentro de la frase (referencia técnica: CA-007)
- [ ] CA-5: En los instantes de silencio de la frase (antes de que empiece la primera palabra, entre
      palabras si hay hueco, o después de que termine la última) ninguna palabra queda marcada como la
      que se está diciendo (referencia técnica: CA-007)

**Prioridad:** Alta
**Estimación:** S

---

### HU-2-03: Que la palabra clave se destaque durante toda la frase

**Como** espectador del video
**Quiero** que la palabra marcada como la más importante de la frase mantenga su estilo distintivo
durante toda la frase, se esté diciendo en ese instante o no
**Para** captar de un vistazo cuál es la idea central del subtítulo sin que ese destaque parpadee o
desaparezca mientras se dicen las otras palabras

**Criterios de aceptación:**

- [ ] CA-6: La palabra marcada como más importante se ve con su estilo de impacto desde que arranca la
      frase hasta que termina, tanto en los instantes en que es la palabra que se está diciendo como
      en los instantes en que no lo es (referencia técnica: CA-008)

**Prioridad:** Alta
**Estimación:** XS

---

### HU-2-04: Ver mis subtítulos animados montados en el video real, sin restos del bloque anterior

**Como** desarrollador que integro esta librería en la composición de video
**Quiero** que el componente final de subtítulos anime cada frase exactamente durante el tramo de
video que le corresponde, y que el bloque de subtítulos estático que se usaba antes de este ciclo
haya desaparecido por completo de la librería
**Para** integrar un único camino de subtítulos en la composición, sin dos implementaciones
conviviendo ni riesgo de que alguien enganche por error la que ya quedó obsoleta

**Criterios de aceptación:**

- [ ] CA-7: Cada frase de subtítulos aparece en pantalla exactamente durante el tramo de video
      (inicio y duración) que le corresponde según el plan de la pieza, ni un frame antes ni un frame
      después (referencia técnica: CA-009)
- [ ] CA-8: El bloque de subtítulos estático que se usaba hasta `cycle-01` ya no existe en ningún
      lugar accesible de la librería; la composición de video usa exclusivamente el componente animado
      (referencia técnica: CA-009)

**Prioridad:** Alta
**Estimación:** M

---

### HU-2-05: Comparar los cuatro estilos de subtítulos lado a lado, sin renderizar un video

**Como** creador que todavía está decidiendo qué look usar
**Quiero** poder abrir una vista de previsualización que me muestre los cuatro estilos disponibles ya
animados y en movimiento, uno al lado del otro
**Para** elegir el que más me convence mirándolos con mis propios ojos, sin tener que pagar el costo
de tiempo y de máquina de renderizar cuatro videos completos solo para comparar

**Criterios de aceptación:**

- [ ] CA-9: Existe una vista de previsualización donde puedo recorrer los cuatro estilos disponibles ya
      animados, sin que eso implique generar un solo archivo de video (referencia técnica: CA-010)
- [ ] CA-10: Esa vista de previsualización no forma parte de lo que se verifica automáticamente en
      cada cambio del proyecto: es una herramienta de inspección visual para el creador, no un chequeo
      de calidad del código (referencia técnica: CA-010)

**Prioridad:** Media
**Estimación:** S

---

### HU-2-06: Que la verificación final por render real no compita por la máquina con otras tareas

**Como** equipo que comparte una sola máquina de trabajo entre edición de video y transcripción de
audio
**Quiero** que la única verificación de este ciclo que genera un video real se ejecute como un paso
manual, deliberado y una sola vez al cerrar el ciclo, y nunca al mismo tiempo que esa máquina esté
transcribiendo audio de otro proyecto
**Para** no saturar la memoria de una notebook de recursos acotados ni arriesgar que ambas tareas
fallen o se degraden por competir por el mismo recurso

**Criterios de aceptación:**

- [ ] CA-11: El render real de verificación de este ciclo se ejecuta una única vez, como paso manual
      posterior a que toda la lógica ya esté verificada sin render (referencia técnica: CA-010, en
      cuanto a que ese render queda fuera de lo que corre automáticamente en cada cambio)
- [ ] CA-12: Antes de arrancar ese render manual, se confirma que la máquina no está en ese momento
      transcribiendo audio de otro proyecto y que tiene memoria disponible suficiente; si cualquiera de
      las dos condiciones no se cumple, el render se pospone en vez de ejecutarse igual (sin CA
      numerado propio en la spec; regla operativa de este ciclo para proteger la máquina compartida)

**Prioridad:** Alta
**Estimación:** XS

---

### HU-2-07: Confiar en que todo el ciclo se puede verificar sin abrir un navegador ni renderizar

**Como** desarrollador que integra esta librería en la composición de video
**Quiero** que la animación de entrada/salida y el resaltado de palabra se puedan probar con pruebas
automatizadas comunes, y que el proyecto completo compile y pase sus verificaciones de calidad
**Para** integrar los cambios de este ciclo con la misma confianza que los de `cycle-01`, sin que la
integración continua del repositorio dependa de un navegador ni de generar un frame de video

**Criterios de aceptación:**

- [ ] CA-13: La lógica de animación de entrada/salida y la de resaltado de palabra tienen pruebas
      automatizadas que no montan ni renderizan ningún componente visual (referencia técnica: CA-011,
      en cuanto a RNF-1 de cero red y cero render en la suite)
- [ ] CA-14: El proyecto completo compila, pasa sus pruebas automatizadas y su verificación de estilo
      de código en verde, y no baja el piso de cobertura heredado de `cycle-01` (referencia técnica:
      CA-011)

**Prioridad:** Alta
**Estimación:** S

---

## Requisitos funcionales

### RF-2-01: Animación de entrada y salida del bloque de subtítulos

**Descripción:** el bloque de palabras de cada frase de subtítulos anima su aparición al comienzo de
la frase y su desaparición al final, con un recorrido de opacidad (y, según el estilo, también de
tamaño o de posición) que va de un estado incompleto a un estado final y de vuelta a un estado
incompleto, con una sensación de rebote o de asentamiento propia de cada estilo.

**Reglas de negocio:**

- RN-1: al comienzo de la frase, el bloque arranca en un estado visualmente incompleto (menos opaco
  que su estado final) y llega a su estado final (opacidad completa) antes de que termine el tramo de
  entrada.
- RN-2: al final de la frase, el bloque recorre el camino inverso: empieza a perder opacidad (y, según
  el estilo, tamaño o posición) hasta desaparecer, en un tramo simétrico al de entrada.
- RN-3: el estilo elegido por el creador determina el tipo de movimiento del tramo de entrada/salida
  (por ejemplo: un rebote de tamaño, un desplazamiento vertical, o solamente un cambio de opacidad),
  pero todo estilo anima al menos la opacidad.
- RN-4: el resultado de la animación en un instante dado depende únicamente de ese instante y de la
  duración de la frase: dos consultas al mismo instante de la misma frase dan siempre el mismo
  resultado.

**Casos de error:**

- CE-1: no aplica un caso de error de negocio propio; la animación es una función determinista del
  instante y de la duración de la frase, sin inputs externos que puedan fallar.

---

### RF-2-02: Resaltado progresivo por palabra

**Descripción:** dentro de cada frase de subtítulos, la palabra que se está pronunciando en el
instante actual recibe el estilo de palabra activa, y la palabra marcada como la más importante de la
frase mantiene su estilo de impacto durante toda la duración de la frase, sea o no la palabra activa
en ese instante.

**Reglas de negocio:**

- RN-5: en cada instante dentro de la duración de la frase, hay como máximo una palabra marcada como
  la que se está diciendo, y corresponde al tiempo real de esa palabra dentro de la frase.
- RN-6: en los instantes de silencio de la frase (antes de la primera palabra, entre palabras, o
  después de la última) ninguna palabra queda marcada como la que se está diciendo.
- RN-7: la palabra marcada como más importante mantiene su estilo de impacto durante toda la frase,
  independientemente de si en ese instante es también la palabra activa.
- RN-8: cuando la palabra más importante es además la palabra activa en ese instante, sigue siendo
  visualmente distinguible como la más importante de la frase.

**Casos de error:**

- CE-2: no aplica un caso de error de negocio propio; qué palabra es la de impacto y el tiempo de cada
  palabra ya vienen calculados por la `Timeline` (herencia de `timeline-core` y de `cycle-01` de este
  módulo); este requisito solo consume esa información ya resuelta.

---

### RF-2-03: Componente final de subtítulos animados

**Descripción:** el bloque de subtítulos estático que se usaba hasta `cycle-01` deja de existir, y en
su lugar la composición de video monta un único componente que dibuja cada frase de subtítulos con su
animación de entrada/salida y su resaltado por palabra, exactamente durante el tramo de video que le
corresponde según el plan de la pieza.

**Reglas de negocio:**

- RN-9: cada frase de subtítulos aparece en pantalla exactamente durante el inicio y la duración que
  le corresponde según el plan de la pieza; ni antes ni después.
- RN-10: el componente final admite indicar el estilo, la red social de destino y el anclaje vertical
  como configuración opcional, con el mismo comportamiento por defecto que ya tenía la composición
  antes de este ciclo cuando no se indica nada.
- RN-11: el bloque de subtítulos estático que se usaba hasta `cycle-01` deja de estar disponible en
  ningún lugar accesible de la librería una vez cerrado este ciclo.

**Casos de error:**

- CE-3: no aplica un caso de error de negocio propio; el reemplazo es una decisión de diseño ya
  tomada (no hay consumidores externos del bloque anterior que deban migrar de forma progresiva).

---

### RF-2-04: Galería de comparación de estilos sin renderizar

**Descripción:** existe una vista de previsualización que recorre los estilos de subtítulos
disponibles ya animados y en movimiento, pensada para inspección visual del creador, sin que su uso
implique generar un archivo de video ni forme parte de las verificaciones automáticas del proyecto.

**Reglas de negocio:**

- RN-12: la vista de previsualización permite recorrer los cuatro estilos disponibles, cada uno con su
  animación de entrada/salida y su resaltado por palabra funcionando.
- RN-13: abrir o recorrer esa vista de previsualización nunca genera un archivo de video.
- RN-14: esa vista de previsualización queda fuera de lo que se ejecuta en cada verificación
  automática del proyecto (compilación, pruebas y verificación de estilo de código).

**Casos de error:**

- CE-4: no aplica un caso de error de negocio propio; es una herramienta de inspección manual, sin
  inputs de usuario que puedan fallar en este ciclo.

---

### RF-2-05: Render de verificación manual sobre una máquina compartida

**Descripción:** el único render real que genera este ciclo para confirmar que la animación y el
resaltado efectivamente componen un video correcto se ejecuta como paso manual, una sola vez al
cerrar el ciclo, y queda condicionado al estado de una máquina de trabajo compartida con la
transcripción de audio.

**Reglas de negocio:**

- RN-15: el render real de verificación se ejecuta una única vez por ciclo, después de que toda la
  lógica de animación y resaltado ya está verificada sin render.
- RN-16: ese render nunca se ejecuta como parte de las verificaciones automáticas del proyecto
  (compilación, pruebas, verificación de estilo de código): es exclusivamente manual.
- RN-17: antes de arrancar ese render manual, se confirma que la máquina no está transcribiendo audio
  de otro proyecto en ese momento y que tiene memoria disponible suficiente.
- RN-18: si la máquina está transcribiendo audio o no tiene memoria suficiente disponible, el render
  se pospone hasta que esa condición deje de darse, en vez de ejecutarse de todas formas.

**Casos de error:**

- CE-5: la máquina está ocupada transcribiendo audio o con memoria insuficiente al momento previsto
  para el render manual → se pospone la ejecución; no se fuerza el render ni se libera memoria de
  forma automática.

---

## Glosario del dominio

> Extiende el glosario de `cycle-01`; solo se listan términos nuevos de este ciclo.

| Término | Definición |
| --- | --- |
| **Tramo de entrada / salida** | Los primeros y los últimos instantes de una frase de subtítulos, durante los cuales el bloque de palabras anima su aparición o su desaparición en vez de mostrarse ya en su estado final. |
| **Estado incompleto** | Cómo se ve el bloque de palabras antes de terminar su animación de entrada (o después de empezar la de salida): menos opaco que su estado final y, en los estilos que rebotan, también más chico. |
| **Galería de comparación (previsualización)** | Vista de inspección visual que recorre los estilos de subtítulos disponibles ya animados, sin generar ningún archivo de video. |
| **Render de verificación (smoke)** | El único render real de video que se genera en el ciclo, para confirmar que la composición funciona de punta a punta; se ejecuta manualmente y una sola vez al cerrar el ciclo. |
| **Máquina compartida** | La notebook de recursos acotados donde corre tanto la edición y render de video como la transcripción de audio de otros proyectos; ambas tareas compiten por la misma memoria disponible. |

---

## Trazabilidad

| Historia | Requisito(s) funcional(es) | Criterios de aceptación de la spec |
| --- | --- | --- |
| HU-2-01 | RF-2-01 (RF-6 de la spec) | CA-006 |
| HU-2-02 | RF-2-02 (RF-7 de la spec) | CA-007 |
| HU-2-03 | RF-2-02 (RF-7 de la spec) | CA-008 |
| HU-2-04 | RF-2-03 (RF-8 de la spec) | CA-009 |
| HU-2-05 | RF-2-04 (RF-9 de la spec) | CA-010 |
| HU-2-06 | RF-2-05 (alcance del ciclo — smoke manual; RF-9 de la spec en cuanto a que `smoke` queda fuera de CI) | CA-010 (indirecto); sin CA numerado propio para la protección de la máquina compartida |
| HU-2-07 | transversal a RF-2-01 y RF-2-02 (RNF-1 de la spec); cierre general del ciclo (RNF-2, RNF-3) | CA-011 |

Este ciclo cierra la spec `spec-e-burgos-003-kinetic-captions`: no queda ningún RF ni CA pendiente de
`spec-e-burgos-003-kinetic-captions.spec.md` sin cubrir entre `cycle-01` y `cycle-02`.
