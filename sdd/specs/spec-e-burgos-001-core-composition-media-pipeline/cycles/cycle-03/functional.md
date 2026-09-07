# Functional — Cycle 3: Core Composition & Media Pipeline Engine (composition-remotion)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-03/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-03/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Al llegar a este ciclo, el creador ya tiene resuelto todo lo difícil: `cycle-01` calculó dónde
cortar los silencios, cuándo alternar un punch-in, cómo agrupar las palabras en captions y cómo
automatizar el volumen de la música bajo la voz; `cycle-02` convirtió sus archivos crudos en esos
datos. Todo ese trabajo vive en un documento de datos, la `Timeline`, que todavía nadie puede ver ni
escuchar. Falta el último paso: mostrar esa Timeline en pantalla y entregarla como un archivo MP4
listo para subir a Instagram, TikTok o YouTube.

Ese último paso es lo que construye este ciclo: la librería que sabe **leer una Timeline y
convertirla en video**. Toma cada pista — el clip principal (A-roll), los clips de apoyo (B-roll), la
locución, la música y los captions — y los ubica en pantalla exactamente donde y cuánto tiempo la
Timeline dice que deben estar. Cuando dos clips de A-roll se encuentran, muestra la transición que la
Timeline pidió (un fundido, un deslizamiento o un efecto de barrido tipo "whip pan"), con el
movimiento natural de un resorte físico o con una velocidad constante, según lo que la Timeline haya
decidido. Cuando un clip tiene un punch-in planificado, lo acerca visualmente en la proporción exacta
que se calculó. Ubica los captions siempre dentro de la zona segura del formato elegido, para que
ninguna app de red social los tape con su propia interfaz. Y hace sonar la voz y la música juntas,
respetando la automatización de volumen que ya viene calculada.

El ciclo tiene dos usuarios:

- **El creador**, que en su MacBook Pro M2 quiere dos cosas: poder previsualizar su pieza mientras la
  ajusta (con `remotion studio`, de forma local) y, cuando está conforme, obtener el archivo MP4 final
  en las dimensiones y cuadros por segundo del formato elegido. Sabe que su máquina tiene memoria
  compartida entre el renderizador de video, ffmpeg y el modelo de transcripción, así que el render
  solo debe correr después de haber transcrito, nunca al mismo tiempo, y con un límite de trabajos en
  paralelo para no saturar la RAM.
- **El desarrollador que integra la librería** (`apps/render-api`, `tools/render-cli` y las specs
  posteriores), que necesita helpers puros —que traducen los datos de la Timeline a lo que la
  composición necesita— probables sin levantar un navegador ni renderizar un solo frame, y una
  garantía dura: ni los tests ni la integración continua ejecutan jamás un render real ni descargan
  el navegador que Remotion usa para renderizar.

Quedan fuera de este ciclo el diseño visual y las fuentes de los captions (llega con el componente de
kinetic typography), el efecto real de light-leak (se muestra como un fundido simple mientras tanto),
la mezcla final de audio con mastering, la selección automática de B-roll y cualquier interfaz de
usuario tipo reproductor.

---

## Historias de usuario

### US-3-001: Ver cada pista de mi pieza en su lugar exacto

**Como** creador que ya tiene su Timeline calculada
**Quiero** que al abrir la composición cada pista (el clip principal, los clips de apoyo, la voz, la
música y los captions) aparezca exactamente en el instante y durante la duración que la Timeline
indica para ella
**Para** confiar en que lo que veo en pantalla es una lectura fiel de las decisiones de edición ya
tomadas, sin tener que revisar manualmente que cada pista quedó bien ubicada

**Criterios de aceptación:**

- [ ] CA-1: Dada una Timeline con clips de A-roll, B-roll, voz, música y captions, cada uno aparece en
      pantalla desde el instante que le corresponde y durante exactamente la duración indicada,
      ni un frame antes ni después (referencia técnica: CA-023)
- [ ] CA-2: Los datos que traducen la Timeline a lo que la composición necesita mostrar se pueden
      verificar sin necesidad de renderizar ni un solo frame de video (referencia técnica: CA-023)

**Prioridad:** Alta
**Estimación:** M

---

### US-3-002: Ver transiciones que se sienten naturales entre dos clips

**Como** creador que edita su A-roll
**Quiero** que, cuando la Timeline indica una transición entre dos clips (fundido, deslizamiento o
barrido), el cambio se vea con el movimiento que la Timeline pidió — o bien con la suavidad física de
un resorte, o bien a velocidad constante
**Para** que mi pieza tenga transiciones prolijas sin tener que ajustar a mano ni un solo fotograma de
la animación

**Criterios de aceptación:**

- [ ] CA-3: Dada una transición marcada con física de resorte, la duración de la animación coincide
      exactamente con los cuadros que la Timeline le asignó (referencia técnica: CA-024)
- [ ] CA-4: Dada una transición marcada como lineal, el cambio ocurre a velocidad constante durante
      esos mismos cuadros, sin el rebote propio del resorte (referencia técnica: CA-024)
- [ ] CA-5: Una transición de tipo "efecto de luz" (light-leak) se muestra en este ciclo como un
      fundido simple, sin que la pieza quede sin transición ni el sistema falle por no reconocerla

**Prioridad:** Alta
**Estimación:** M

---

### US-3-003: Acercar la imagen en los momentos de punch-in planificados

**Como** creador que dejó que el sistema alternara acercamientos digitales en su A-roll
**Quiero** que, en cada clip marcado con un punch-in, la imagen se vea acercada en la proporción
exacta que se calculó, sin que el sistema reinterprete ni redondee esa escala
**Para** que el efecto de "cámara en mano" que buscaba al automatizar los punch-ins se vea igual de
consistente en el video final que en la decisión que tomé al planificarlos

**Criterios de aceptación:**

- [ ] CA-6: Dado un clip con un punch-in de una escala y un desplazamiento determinados, la imagen se
      muestra acercada y desplazada exactamente en esos valores, con el punto de anclaje del
      acercamiento coincidiendo con el que la Timeline definió (referencia técnica: CA-026)

**Prioridad:** Media
**Estimación:** S

---

### US-3-004: Leer los captions sin que la interfaz de la red social los tape

**Como** creador que sube su pieza a Instagram o TikTok
**Quiero** que los captions siempre aparezcan dentro del área que queda visible una vez que se
descuentan los márgenes que cada red social tapa con sus propios botones e íconos
**Para** no perder texto detrás de la interfaz de la app ni tener que reeditar el video después de
subirlo y descubrir que el subtítulo quedó tapado

**Criterios de aceptación:**

- [ ] CA-7: Dado el margen de zona segura del formato elegido, el área calculada para ubicar los
      captions queda siempre dentro de esos márgenes, en ambos ejes (referencia técnica: CA-025)
- [ ] CA-8: El caption mínimo de este ciclo (texto plano) respeta esa área calculada; el diseño visual
      con resaltado y tipografía cinética queda para un ciclo posterior

**Prioridad:** Alta
**Estimación:** S

---

### US-3-005: Escuchar la voz y la música mezcladas como fueron planificadas

**Como** creador que grabó su locución y eligió una música de fondo
**Quiero** que, al reproducir o renderizar mi pieza, el volumen de la música suba y baje exactamente
según la automatización de ganancia que ya viene calculada, sin que la pista de audio suene plana ni
tape la voz
**Para** que el resultado final suene profesional sin tener que mezclar el audio a mano en un editor
aparte

**Criterios de aceptación:**

- [ ] CA-9: Dada una Timeline con automatización de ganancia para la música, el volumen de la pista de
      música en cada instante sigue esa automatización, no un volumen fijo
- [ ] CA-10: La pista de voz se reproduce con la ganancia que la Timeline le asignó, en el instante y
      la duración que le corresponden

**Prioridad:** Media
**Estimación:** M

---

### US-3-006: Previsualizar mi pieza en mi propia máquina antes de renderizar

**Como** creador que quiere revisar su edición antes de exportar el archivo final
**Quiero** poder abrir un estudio de previsualización local con ejemplos de mi pieza en formato
vertical (9:16) y horizontal (16:9)
**Para** confiar en cómo se ve y se escucha el resultado antes de gastar tiempo de máquina en un
render completo

**Criterios de aceptación:**

- [ ] CA-11: El estudio de previsualización local muestra al menos un ejemplo en formato 9:16 y otro
      en 16:9, cada uno con sus propias dimensiones y cuadros por segundo
- [ ] CA-12: Previsualizar la pieza no requiere generar ningún archivo de video ni descargar
      componentes adicionales más allá de los ya instalados para el estudio

**Prioridad:** Media
**Estimación:** S

---

### US-3-007: Obtener el archivo MP4 final en el formato elegido

**Como** creador que ya revisó su pieza en el estudio de previsualización
**Quiero** poder generar el archivo MP4 final de mi pieza, con las dimensiones y los cuadros por
segundo del formato que elegí (vertical para Reels/TikTok, horizontal para YouTube)
**Para** tener el archivo listo para subir a la red social correspondiente, sin tener que ajustar
resolución ni framerate después con otra herramienta

**Criterios de aceptación:**

- [ ] CA-13: El archivo MP4 generado tiene exactamente el ancho, el alto y los cuadros por segundo del
      formato de la Timeline que lo originó (referencia técnica: CA-027)
- [ ] CA-14: Esta verificación se hace mediante un procedimiento manual, documentado paso a paso, que
      el creador o el desarrollador puede correr en su propia máquina cuando lo necesite; nunca se
      ejecuta automáticamente como parte de la integración continua (referencia técnica: CA-027)

**Prioridad:** Alta
**Estimación:** M

---

### US-3-008: Renderizar sin agotar la memoria de mi máquina

**Como** creador que trabaja en una MacBook con memoria compartida entre varias herramientas
**Quiero** que el render final se ejecute después de haber transcrito mi locución (nunca al mismo
tiempo) y con un número acotado de trabajos en paralelo
**Para** no quedarme sin memoria disponible ni que el render se cuelgue o falle a mitad de camino por
falta de recursos

**Criterios de aceptación:**

- [ ] CA-15: El procedimiento de render documentado indica explícitamente que la transcripción debe
      haber terminado antes de iniciar el render, nunca en simultáneo
- [ ] CA-16: El procedimiento de render documentado fija un límite de trabajos en paralelo (no un
      valor que la máquina elija libremente sin tope)

**Prioridad:** Alta
**Estimación:** XS

---

### US-3-009: Confiar en los cálculos de composición sin depender de un navegador

**Como** desarrollador que integra la librería en `apps/render-api` y en `tools/render-cli`
**Quiero** que la lógica que traduce una Timeline en lo que la composición necesita (ubicación de
clips, timing de transiciones, estilo de punch-in, área de captions) se pueda probar por completo sin
levantar un navegador, sin renderizar video y sin depender de que Chrome o ffmpeg estén instalados en
la máquina que corre las pruebas
**Para** poder integrar la librería en cualquier entorno, incluida la integración continua, sin que la
suite de pruebas se vuelva lenta, frágil o dependiente de binarios externos

**Criterios de aceptación:**

- [ ] CA-17: Cada una de las funciones que traducen datos de la Timeline (ubicación de clips, timing
      de transición, estilo de punch-in, área de captions) tiene una prueba automatizada que no monta
      ni renderiza la composición (referencia técnica: CA-023 a CA-026)
- [ ] CA-18: Ninguna prueba automatizada de la librería descarga ni ejecuta el navegador que usa el
      renderizador, ni genera un archivo de video real

**Prioridad:** Alta
**Estimación:** S

---

## Requisitos funcionales

### RF-3-01: Renderizado de pistas en su lugar y duración exactos

**Descripción:** la composición ubica cada clip de cada pista (A-roll, B-roll, voz, música,
captions) de una Timeline exactamente en el instante de inicio y durante la duración que esa
Timeline le asigna.

**Reglas de negocio:**

- RN-1: cada clip de cada pista se ve u oye únicamente durante el rango de tiempo que su entrada en
  la Timeline define; ningún clip aparece antes de su instante de inicio ni se extiende más allá de
  su duración asignada.
- RN-2: la traducción de una Timeline a lo que la composición necesita mostrar (ubicación y duración
  de cada clip, transiciones asociadas) se puede calcular y verificar de forma independiente, sin
  necesidad de renderizar ni un solo frame.

**Casos de error:**

- CE-1: si una Timeline referencia un recurso que no puede resolverse en el momento de mostrarla, la
  pista correspondiente no rompe el resto de la composición; el resto de las pistas se sigue viendo
  y escuchando con normalidad.

---

### RF-3-02: Transiciones entre clips de A-roll

**Descripción:** cuando la Timeline define una transición entre dos clips de A-roll, la composición
la muestra con el tipo (fundido, deslizamiento o barrido) y el timing (resorte o lineal) que esa
Timeline indica.

**Reglas de negocio:**

- RN-3: una transición con timing de resorte anima con el comportamiento físico de un resorte
  (aceleración y desaceleración naturales) durante exactamente los cuadros de solape que la Timeline
  le asigna; una transición con timing lineal cambia a velocidad constante durante esos mismos
  cuadros, sin el rebote propio del resorte.
- RN-4: una transición de tipo "efecto de luz" (light-leak) se muestra en este ciclo como un fundido
  simple; el efecto visual propio de light-leak queda pendiente para un ciclo posterior, pero la
  Timeline puede declararlo sin que el sistema falle.

**Casos de error:**

- CE-2: si la Timeline declara un tipo de transición no reconocido por este ciclo, el sistema no deja
  la composición sin transición visible; aplica el comportamiento de reserva (fundido) documentado.

---

### RF-3-03: Acercamiento digital (punch-in) según transformación planificada

**Descripción:** todo clip de A-roll con un punch-in planificado en la Timeline se muestra acercado
y desplazado según la escala y el desplazamiento (transform) que esa Timeline define para él.

**Reglas de negocio:**

- RN-5: el punch-in aplicado a un clip refleja exactamente la escala y el desplazamiento definidos en
  su transform dentro de la Timeline, con el punto de anclaje del acercamiento coincidiendo con el
  que la Timeline especifica; el sistema no reinterpreta, redondea ni recalcula esos valores.

**Casos de error:**

- CE-3: no aplica un caso de error de negocio propio; un transform ausente o inválido en la Timeline
  es responsabilidad de la validación resuelta en `cycle-01`.

---

### RF-3-04: Captions dentro de la zona segura del formato

**Descripción:** el área donde se ubican los captions de una Timeline queda siempre dentro de los
márgenes de zona segura definidos para el formato de esa Timeline.

**Reglas de negocio:**

- RN-6: el área calculada para ubicar cualquier caption respeta, en ambos ejes, los márgenes de zona
  segura del formato (los espacios donde la interfaz de la red social tapa el video); ningún caption
  se ubica fuera de esa área.
- RN-7: el caption de este ciclo es texto plano dentro de esa área; el diseño visual con resaltado y
  tipografía cinética se entrega en un ciclo posterior y no forma parte de este alcance.

**Casos de error:**

- CE-4: no aplica un caso de error de negocio propio; que un caption caiga fuera del safe zone es una
  violación de invariantes que `validateTimeline` (de `cycle-01`) ya rechaza antes de llegar a este
  ciclo.

---

### RF-3-05: Automatización de ganancia de música y voz

**Descripción:** las pistas de voz y música se reproducen respetando la ganancia y la automatización
que la Timeline ya trae calculadas.

**Reglas de negocio:**

- RN-8: la pista de música sigue, en cada instante, la automatización de ganancia definida en la
  Timeline (subidas y bajadas de volumen ya calculadas), en vez de sonar a un volumen fijo.
- RN-9: la pista de voz se reproduce con la ganancia asignada a cada uno de sus clips, en el instante
  y la duración que la Timeline les asigna.

**Casos de error:**

- CE-5: no aplica un caso de error de negocio propio en este ciclo; el cálculo de la automatización
  de ganancia (attack/hold/release) es responsabilidad de `cycle-01`, este ciclo solo la reproduce
  fielmente.

---

### RF-3-06: Previsualización local en el estudio de Remotion

**Descripción:** el creador puede abrir un estudio de previsualización local con al menos una
composición de ejemplo en formato 9:16 y otra en 16:9.

**Reglas de negocio:**

- RN-10: el estudio de previsualización local expone ejemplos en ambos formatos objetivo del
  producto (9:16 y 16:9), cada uno con las dimensiones y los cuadros por segundo que le corresponden.
- RN-11: el estudio de previsualización es una herramienta de uso local del creador; no forma parte
  de la integración continua ni de ningún flujo automatizado.

**Casos de error:**

- CE-6: no aplica un caso de error de negocio propio; el estudio de previsualización es una
  herramienta de desarrollo local, fuera de cualquier flujo que el sistema automatice.

---

### RF-3-07: Render final a MP4 en el formato de la Timeline

**Descripción:** el sistema produce, a partir de una Timeline, un archivo MP4 con las dimensiones y
los cuadros por segundo del formato de esa Timeline.

**Reglas de negocio:**

- RN-12: el archivo MP4 producido tiene exactamente el ancho, el alto y los cuadros por segundo que
  el formato de la Timeline que lo originó define; ninguna otra combinación de dimensiones o
  framerate es válida como resultado.
- RN-13: nada de este ciclo renderiza un video real ni descarga el navegador que usa el renderizador
  dentro de una prueba automatizada ni de la integración continua; la única forma de verificar un
  render real es un procedimiento manual, documentado, que el creador o el desarrollador ejecuta
  explícitamente en su propia máquina.
- RN-14: en la máquina del creador, el render final se ejecuta siempre después de haber terminado la
  transcripción de la locución, nunca en simultáneo con ella, y con un límite fijo de trabajos en
  paralelo, para no agotar la memoria compartida de la máquina.

**Casos de error:**

- CE-7: si el procedimiento manual de render no encuentra el navegador que necesita para renderizar,
  el error indica con claridad que falta ese componente, sin que el sistema intente descargarlo por
  su cuenta durante una prueba automatizada.

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| **Remotion** | Framework que permite construir videos como componentes de React; cada fotograma se calcula a partir del tiempo transcurrido, en vez de grabarse en vivo. |
| **Composición** | En Remotion, la definición de un video: sus dimensiones, sus cuadros por segundo, su duración total y el árbol de componentes que dibuja cada fotograma. |
| **Sequence** | Componente de Remotion que ubica a sus hijos dentro de una ventana de tiempo específica (un instante de inicio y una duración), de modo que solo se muestran durante ese rango. |
| **TransitionSeries** | Componente de Remotion, provisto por su paquete de transiciones, que encadena varias escenas con un efecto de transición entre cada par, consumiendo una cantidad de cuadros de solape entre una escena y la siguiente. |
| **spring (resorte)** | Tipo de animación cuyo movimiento imita el comportamiento físico de un resorte real, con aceleración y desaceleración naturales, en vez de una velocidad constante. |
| **whip pan** | Efecto de transición que simula un giro rápido de cámara, combinando desenfoque de movimiento con un desplazamiento veloz de la imagen. |
| **safe zone (zona segura)** | Área de la pantalla, dentro del formato de video, que no queda tapada por los botones, íconos o textos propios de la interfaz de cada red social; los elementos importantes (como los captions) deben ubicarse dentro de ella. |
| **headless** | Modo de ejecución de un navegador o de un programa sin interfaz gráfica visible, pensado para automatización y no para que una persona lo mire directamente. |
| **Chrome Headless Shell** | Versión de Chrome sin interfaz gráfica que Remotion utiliza para dibujar cada fotograma durante el render; se descarga y usa únicamente en un render real, nunca durante pruebas automatizadas. |
| **smoke (prueba de humo)** | Verificación manual, rápida y de alto nivel que confirma que el flujo principal funciona de punta a punta (en este caso, que un render real produce el archivo esperado); no reemplaza a las pruebas automatizadas y no corre en la integración continua. |

---

## Trazabilidad

| Historia | Requisito(s) funcional(es) | Criterios de aceptación de la spec |
| --- | --- | --- |
| US-3-001 | RF-3-01 (RF-11 de la spec) | CA-023 |
| US-3-002 | RF-3-02 (RF-11 de la spec) | CA-024 |
| US-3-003 | RF-3-03 (RF-11 de la spec) | CA-026 |
| US-3-004 | RF-3-04 (RF-11 de la spec) | CA-025 |
| US-3-005 | RF-3-05 (RF-11 de la spec) | — (reproducción fiel del `AudioMixPlan` de `cycle-01`) |
| US-3-006 | RF-3-06 (soporte, RF-11 de la spec) | — (herramienta de uso local, sin CA propio) |
| US-3-007 | RF-3-07 (RF-12 de la spec) | CA-027 |
| US-3-008 | RF-3-07 (RNF-3, RNF-6 de la spec) | CA-027 (procedimiento documentado) |
| US-3-009 | RF-3-01 a RF-3-04 (RNF-2, RNF-3 de la spec) | CA-023, CA-024, CA-025, CA-026 |

Este ciclo no cubre RF-1 a RF-10 (motor de decisiones y wrappers de medios, cerrados en `cycle-01` y
`cycle-02`) ni el diseño visual de captions, el light-leak real, la mezcla final con mastering, el
matching de B-roll o cualquier interfaz de usuario tipo Player (specs posteriores).
