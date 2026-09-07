# Functional — Cycle 1: Kinetic Captions & Safe Zones (composition-remotion)

> **Input:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-003-kinetic-captions/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El creador ya tiene resuelta la parte difícil de sus captions: `timeline-core` le entrega, dentro de
la `Timeline`, las palabras agrupadas de a 1 a 3 por pantalla y con la palabra de impacto ya elegida.
Lo que le falta es que se **vean bien** y que **no lo traicione la interfaz de cada red social**.

Hoy los tres formatos verticales (Reels, TikTok, Shorts) comparten el mismo margen de zona segura,
aunque el chrome real de cada app es distinto: TikTok reserva una columna angosta a la derecha para
sus botones de "Me gusta", comentar y compartir; Shorts tapa una franja del título y del canal en la
parte de abajo. Un caption que hoy se ve bien en la vista previa puede terminar tapado por esos
elementos al subirlo a la red social real.

Además, el creador quiere poder elegir el "look" de sus subtítulos —un estilo de impacto grande, uno
limpio, uno con contorno, uno discreto abajo de pantalla— sin tener que escribir una sola línea de
CSS, y confía en que ese look se vea igual sea cual sea la frase: una palabra corta o tres palabras
largas siempre tienen que entrar en el cuadro, sin que el texto se corte ni se salga de la pantalla.
Su máquina rendea en forma local y sin conexión a internet, así que cualquier tipografía que use —la
del sistema o una propia que descargue una sola vez— tiene que seguir funcionando sin salir a buscar
nada afuera.

Este ciclo entrega esa capa de decisión tipográfica y de posicionamiento como funciones puras:
**no** entrega todavía el componente visual que se monta en pantalla ni las animaciones de entrada y
salida de las palabras — eso es el ciclo siguiente. Lo que sí entrega es la base de la que ese
componente va a depender: qué presets existen, cuánto margen extra hay que sumar por plataforma,
dónde se dibuja la caja de texto, qué tamaño de letra le corresponde a una frase dada y cómo se ve
cada palabra según sea normal, de impacto o la que se está diciendo en ese instante.

El desarrollador que integra esta librería (hoy `TimelineComposition`, mañana el componente de
kinetic captions) necesita que toda esa lógica se pueda probar con pruebas automatizadas comunes, sin
levantar un navegador ni generar un solo frame de video, para que la integración continua del
repositorio siga corriendo rápida y sin depender de binarios externos.

Quedan fuera de este ciclo: el componente `<KineticCaptions />` que efectivamente dibuja las palabras
en pantalla, las animaciones de entrada y salida con movimiento de resorte, la previsualización en el
estudio de Remotion y cualquier verificación con un render real.

---

## Historias de usuario

### HU-1-01: Elegir un look de subtítulos sin tocar CSS

**Como** creador que edita mi pieza
**Quiero** poder elegir entre varios estilos de subtítulos ya preparados para distintos casos de uso
(uno de impacto grande, uno limpio, uno con contorno, uno discreto abajo de pantalla)
**Para** darle a mi video el look que busco sin tener que escribir ni ajustar una sola línea de estilos

**Criterios de aceptación:**

- [ ] CA-1: Tengo al menos cuatro estilos de subtítulos ya preparados entre los que elegir, cada uno
      pensado para un caso de uso distinto (referencia técnica: CA-004)
- [ ] CA-2: En cualquiera de esos estilos, la palabra marcada como la más importante de la frase se ve
      claramente distinta de una palabra común dentro del mismo look (referencia técnica: CA-004)

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-02: Que mis subtítulos no queden tapados por la interfaz de cada red social

**Como** creador que sube mi pieza a Instagram, TikTok o YouTube
**Quiero** que el área donde se ubican mis subtítulos descuente, además del margen general de
seguridad, el espacio propio que cada app tapa con sus botones e íconos
**Para** no perder texto detrás de la columna de "Me gusta" de TikTok, del título de Shorts o de
cualquier otro elemento propio de la interfaz de la red social

**Criterios de aceptación:**

- [ ] CA-3: Para TikTok, el margen reservado para mis subtítulos es igual o mayor que el margen
      general de seguridad en los cuatro lados de la pantalla, y aparta al menos 150 px extra del lado
      derecho para no quedar debajo de la columna de acciones de esa app (referencia técnica: CA-001,
      CA-002)
- [ ] CA-4: Si no indico ninguna red social en particular, el área para mis subtítulos es exactamente
      la misma que ya se usaba antes de este ciclo, sin ningún cambio (referencia técnica: CA-001)

**Prioridad:** Alta
**Estimación:** M

---

### HU-1-03: Elegir dónde de la pantalla aparecen mis subtítulos, sin que se salgan del cuadro

**Como** creador que edita mi pieza
**Quiero** poder anclar el bloque de subtítulos arriba, al centro o abajo de la pantalla
**Para** acomodar el texto según cómo esté compuesta cada toma, con la garantía de que nunca queda
fuera de la zona segura ni fuera de la pantalla

**Criterios de aceptación:**

- [ ] CA-5: Cada una de las tres opciones de anclaje (arriba, centro, abajo) me da una ubicación
      distinta para el bloque de subtítulos, y las tres quedan siempre dentro del área segura del
      formato (referencia técnica: CA-003)
- [ ] CA-6: En cualquiera de los tres formatos verticales (Reels, TikTok, Shorts), el bloque de
      subtítulos cae siempre dentro de los 1080×1920 px de la pantalla, nunca se sale del cuadro
      (referencia técnica: CA-002)

**Prioridad:** Alta
**Estimación:** S

---

### HU-1-04: Que mi frase siempre entre en pantalla, sea corta o larga

**Como** creador cuyas frases de captions varían en longitud
**Quiero** que el tamaño de letra de mis subtítulos se ajuste automáticamente para que las palabras
siempre entren en el ancho disponible
**Para** no tener que revisar a mano cada frase larga ni arriesgarme a que el texto se corte o se
superponga

**Criterios de aceptación:**

- [ ] CA-7: Una frase de tres palabras largas se muestra con una letra más chica que una frase de una
      sola palabra corta, priorizando siempre que el texto entre en el cuadro antes que un tamaño fijo
      (referencia técnica: CA-005)
- [ ] CA-8: El tamaño de letra elegido nunca queda por fuera de los límites mínimo y máximo que definí
      al elegir mi estilo, y frente a la misma frase y el mismo espacio disponible siempre obtengo el
      mismo resultado (referencia técnica: CA-005)

**Prioridad:** Alta
**Estimación:** S

---

### HU-1-05: Distinguir a simple vista la palabra clave de la que se está diciendo

**Como** espectador del video
**Quiero** que la palabra marcada como la más importante de la frase se vea distinta de una palabra
común, dentro de cualquiera de los estilos disponibles
**Para** captar de un vistazo cuál es la idea central de cada subtítulo, incluso viendo el video sin
sonido

**Criterios de aceptación:**

- [ ] CA-9: Para cada estilo disponible, existe una diferencia visual definida y verificable entre la
      palabra normal, la palabra marcada como más importante y la palabra que se está diciendo en ese
      instante (referencia técnica: CA-004, cubre la distinción normal / impacto a nivel de registro
      de estilos; no hay un CA numerado propio en la spec para la distinción con la palabra activa en
      este ciclo)

**Prioridad:** Media
**Estimación:** S

---

### HU-1-06: Confiar en que todas estas reglas se pueden verificar sin abrir un navegador

**Como** desarrollador que integra esta librería en la composición de video
**Quiero** que toda la lógica de esta historia (estilos disponibles, margen por red social, ubicación
del bloque, tamaño de letra, estilo por palabra) se pueda probar con pruebas automatizadas comunes
**Para** integrar la librería en cualquier entorno, incluida la integración continua del repositorio,
sin depender de un navegador, de un render de video real ni de conexión a internet

**Criterios de aceptación:**

- [ ] CA-10: Cada una de las reglas de negocio de HU-1-01 a HU-1-05 tiene una prueba automatizada que
      no monta ni renderiza ningún componente visual (sin CA numerado propio en la spec; verifica el
      requisito no funcional de cero red y cero render de la suite)

**Prioridad:** Alta
**Estimación:** S

---

### HU-1-07: Usar una tipografía propia sin depender de internet ni pesar el repositorio

**Como** creador que quiere una identidad tipográfica propia en mis subtítulos
**Quiero** poder colgar en mi propia máquina un archivo de fuente y decirle al sistema que la use
**Para** personalizar el look de mis subtítulos sin que ese archivo viaje dentro del repositorio del
proyecto ni sin que el sistema necesite salir a internet a buscarla al momento de rendear

**Criterios de aceptación:**

- [ ] CA-11: Existe una forma documentada de indicarle al sistema que use una fuente propia colgada
      localmente por el creador, sin que ese archivo de fuente se suba al repositorio (sin CA numerado
      propio en la spec; corresponde a la decisión de "fuentes: stacks del sistema + opt-in local,
      cero binarios en el repo")
- [ ] CA-12: Si el creador no cuelga ninguna fuente propia, todos los estilos disponibles siguen
      funcionando igual usando únicamente tipografías del sistema operativo (sin CA numerado propio en
      la spec; cubre indirectamente CA-004 en cuanto a que todo estilo declara una familia de
      respaldo genérica)

**Prioridad:** Baja
**Estimación:** XS

---

## Requisitos funcionales

### RF-1-01: Registro de estilos de subtítulos disponibles

**Descripción:** el sistema ofrece un conjunto de estilos de subtítulos ya preparados, cada uno
pensado para un caso de uso distinto, entre los que el creador puede elegir sin escribir CSS.

**Reglas de negocio:**

- RN-1: hay al menos cuatro estilos disponibles, cada uno identificado por su caso de uso (uno de
  impacto grande, uno limpio, uno con contorno, uno discreto abajo de pantalla).
- RN-2: en cada estilo disponible, la tipografía elegida sigue funcionando aunque no haya conexión a
  internet ni la fuente propia del creador esté disponible: siempre existe una familia de respaldo
  del sistema operativo.
- RN-3: en ningún estilo disponible la palabra normal y la palabra marcada como más importante se ven
  idénticas entre sí.

**Casos de error:**

- CE-1: no aplica un caso de error de negocio propio; el registro de estilos es una lista fija que no
  depende de un input externo del creador en este ciclo.

---

### RF-1-02: Margen adicional de zona segura por red social

**Descripción:** el área donde se ubican los subtítulos descuenta, sobre el margen general de
seguridad del formato, el espacio adicional que cada red social tapa con su propia interfaz.

**Reglas de negocio:**

- RN-4: para cada red social soportada (Instagram Reels, TikTok, YouTube Shorts, YouTube horizontal),
  el margen reservado para los subtítulos es igual o mayor que el margen general de seguridad del
  formato, en los cuatro lados de la pantalla; nunca lo reduce.
- RN-5: si el creador no indica ninguna red social, el margen para los subtítulos es exactamente el
  margen general de seguridad del formato, sin ningún cambio adicional.
- RN-6: para TikTok en particular, el margen del lado derecho reserva al menos 150 px adicionales
  para no quedar debajo de la columna de acciones propia de esa app.

**Casos de error:**

- CE-2: no aplica un caso de error de negocio propio; una red social no soportada se trata como
  ausencia de red social (comportamiento de RN-5).

---

### RF-1-03: Ubicación del bloque de subtítulos con anclaje elegible

**Descripción:** el bloque donde se dibujan las palabras del subtítulo se ubica, dentro del área
segura calculada, según el anclaje vertical que el creador elija (arriba, centro o abajo).

**Reglas de negocio:**

- RN-7: cada una de las tres opciones de anclaje produce una ubicación distinta para el bloque de
  subtítulos.
- RN-8: sea cual sea el anclaje elegido, el bloque de subtítulos queda siempre contenido dentro del
  área segura calculada para ese formato y esa red social; nunca se sale de ella.
- RN-9: en cualquiera de los tres formatos verticales objetivo, el bloque de subtítulos queda siempre
  contenido dentro de las dimensiones de la pantalla del formato.

**Casos de error:**

- CE-3: no aplica un caso de error de negocio propio; un anclaje no reconocido queda fuera del alcance
  de este ciclo (los únicos anclajes válidos son arriba, centro y abajo).

---

### RF-1-04: Ajuste automático del tamaño de letra

**Descripción:** el tamaño de letra de los subtítulos se calcula automáticamente para que las 1 a 3
palabras de cada pantalla entren siempre en el ancho disponible del bloque de subtítulos.

**Reglas de negocio:**

- RN-10: una frase con palabras más largas o más numerosas se muestra con un tamaño de letra igual o
  menor que una frase con palabras más cortas o menos numerosas, priorizando siempre que el texto
  entre en el ancho disponible.
- RN-11: el tamaño de letra calculado nunca sale de los límites mínimo y máximo que define el estilo
  elegido por el creador.
- RN-12: frente a la misma frase, el mismo espacio disponible y el mismo estilo, el tamaño de letra
  calculado es siempre el mismo; no varía entre una corrida y otra.

**Casos de error:**

- CE-4: no aplica un caso de error de negocio propio; una frase que ni con el tamaño mínimo entraría
  en el ancho disponible queda acotada por ese mínimo (RN-11 tiene prioridad sobre RN-10).

---

### RF-1-05: Estilo visual por tipo de palabra

**Descripción:** cada palabra de un subtítulo recibe un estilo visual distinto según sea una palabra
normal, la palabra marcada como más importante de la frase, o la palabra que se está diciendo en ese
instante.

**Reglas de negocio:**

- RN-13: dentro de un mismo estilo elegido, la palabra normal, la palabra de impacto y la palabra
  activa son visualmente distinguibles entre sí.
- RN-14: la palabra marcada como de impacto conserva su distinción visual de palabra de impacto
  independientemente de si en ese instante es además la palabra activa.

**Casos de error:**

- CE-5: no aplica un caso de error de negocio propio; qué palabra es la de impacto y cuál es la activa
  en cada instante es información que ya trae calculada la `Timeline` (de `timeline-core` y del
  ciclo 2 de este módulo, respectivamente).

---

### RF-1-06: Tipografía local sin dependencia de red ni binarios en el repositorio

**Descripción:** el creador puede usar una tipografía propia, colgada localmente en su propia
máquina, sin que ese archivo de fuente se suba al repositorio del proyecto ni el sistema necesite
salir a buscarla a internet al momento de rendear.

**Reglas de negocio:**

- RN-15: existe una forma documentada de declarar una fuente propia colgada localmente por el
  creador, de modo que los estilos de subtítulos puedan usarla.
- RN-16: ningún archivo de fuente tipográfica se sube al repositorio del proyecto como parte de este
  ciclo.
- RN-17: si el creador no declara ninguna fuente propia, todos los estilos disponibles siguen
  funcionando usando únicamente tipografías ya instaladas en el sistema operativo.

**Casos de error:**

- CE-6: no aplica un caso de error de negocio propio; una fuente propia mal declarada o ausente se
  resuelve mediante la familia de respaldo genérica que todo estilo ya declara (RN-2).

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| **Preset (estilo de subtítulos)** | Combinación ya preparada de tipografía, colores, contorno y fondo pensada para un caso de uso concreto, entre las que el creador elige sin escribir CSS. |
| **Zona segura (safe zone)** | Área de la pantalla que no queda tapada por los márgenes generales del formato de video. |
| **Chrome de la app** | Botones, íconos y textos propios de la interfaz de cada red social (por ejemplo, la columna de "Me gusta"/comentar/compartir de TikTok) que se superponen al video una vez publicado. |
| **Anclaje vertical** | Posición de referencia (arriba, centro o abajo) desde la que se ubica el bloque de subtítulos dentro de la zona segura. |
| **Palabra de impacto (emphasis)** | La palabra que la `Timeline` marca como la más importante de la frase mostrada en pantalla; mantiene su distinción visual durante toda esa frase. |
| **Palabra activa** | La palabra que se está pronunciando en el instante actual del video, según el tiempo que le asignó la `Timeline`. |
| **Familia de respaldo genérica** | El tipo general (`sans-serif` o `serif`) con el que termina la declaración de tipografía de todo preset, para que el subtítulo se siga viendo aunque la fuente preferida no esté disponible. |
| **Fuente local (self-hosted)** | Archivo de tipografía que el creador cuelga en su propia máquina para usar en su render, sin que viaje dentro del repositorio del proyecto ni dependa de una descarga en el momento de rendear. |

---

## Trazabilidad

| Historia | Requisito(s) funcional(es) | Criterios de aceptación de la spec |
| --- | --- | --- |
| HU-1-01 | RF-1-01 (RF-1 de la spec) | CA-004 |
| HU-1-02 | RF-1-02 (RF-2 de la spec) | CA-001, CA-002 |
| HU-1-03 | RF-1-03 (RF-3 de la spec) | CA-002, CA-003 |
| HU-1-04 | RF-1-04 (RF-4 de la spec) | CA-005 |
| HU-1-05 | RF-1-05 (RF-5 de la spec) | CA-004 (indirecto, vía registro de presets) |
| HU-1-06 | transversal a RF-1-01 a RF-1-05 (RNF-1 de la spec) | — (sin CA numerado propio; verifica RNF-1) |
| HU-1-07 | RF-1-06 (D-C y RNF-5 de la spec) | — (sin CA numerado propio; verifica RNF-5 y la decisión D-C) |

Este ciclo no cubre RF-6 a RF-9 de la spec (animación de entrada/salida, resaltado progresivo por
frame, el componente `<KineticCaptions />` ni la previsualización en `remotion studio`), que
corresponden a `cycle-02`.
