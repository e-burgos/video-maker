# Functional — Cycle 2: Core Composition & Media Pipeline Engine (media-local)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El creador tiene, en una carpeta de su MacBook Pro, el material crudo de una pieza: clips grabados
con la cámara o con la pantalla, fotos de apoyo y una locución grabada aparte. Antes de que el motor
de decisiones (entregado en `cycle-01`) pueda cortar silencios, alternar punch-ins o armar
subtítulos, alguien tiene que **mirar cada archivo y convertirlo en datos**: cuánto dura, si es
video, foto o audio, si trae sonido, en qué orientación quedó grabado, dónde están los huecos de
silencio, a qué volumen está la voz y qué palabras dijo el creador, con su tiempo exacto.

Hoy ese trabajo de "escuchar y anotar" lo hace un editor a mano o un SaaS pago que sube el material
a la nube. Este ciclo lo automatiza por completo, en la máquina del propio creador, apoyándose en
herramientas locales ya probadas en la industria (FFmpeg para sondear y medir audio, whisper.cpp
para transcribir con aceleración Metal del chip M2) y sin que ningún archivo salga del equipo.

El ciclo tiene dos usuarios:

- **El creador/operador**, que no interactúa todavía con una interfaz (eso llega en ciclos
  posteriores) pero es quien recibe el beneficio final: cada dato que este ciclo extrae de sus
  archivos es el insumo exacto que el motor de decisiones necesita para automatizar su edición.
- **El desarrollador que integra la librería** (`libs/auto-montage`, `apps/render-api` y las specs
  posteriores), que necesita poder confiar en que la lectura de cada archivo y binario externo es
  predecible, que un binario ausente o un comando que falla se explica con claridad, y que la
  librería se puede probar por completo sin instalar ni ejecutar un solo binario real.

Fuera de este ciclo queda todo lo que ocurre después de tener estos datos: componer y renderizar el
video (Remotion, `cycle-03`), mezclar las pistas de audio final y cualquier interfaz de usuario.

---

## Historias de usuario

### US-2-001: Reconocer automáticamente qué es cada archivo de la carpeta

**Como** creador que junta el material de una pieza
**Quiero** que el sistema identifique, para cada archivo, si es un video, una imagen o un audio, y
extraiga sus datos técnicos (duración, si tiene sonido, y en el caso de video también sus cuadros
por segundo y sus dimensiones)
**Para** no tener que abrir cada archivo a mano para saber con qué estoy trabajando antes de armar
la edición

**Criterios de aceptación:**

- [ ] Dado un archivo de video, el sistema informa su duración, sus cuadros por segundo, su ancho y
      alto, y si tiene o no pista de audio (CA-017)
- [ ] Dado un archivo de imagen, el sistema lo reconoce como tal, sin exigirle duración ni cuadros
      por segundo (CA-017)
- [ ] Dado un archivo de audio, el sistema informa su duración y sus datos de sonido (CA-017)

**Prioridad:** Alta
**Estimación:** S

---

### US-2-002: Ver un clip grabado con el celular en la orientación correcta

**Como** creador que graba con el celular en vertical
**Quiero** que las dimensiones que el sistema informa de un clip ya reflejen cómo se ve el video
(vertical), y no las del sensor de la cámara antes de rotarlo
**Para** que el resto del sistema calcule zonas seguras y subtítulos sobre las dimensiones reales,
sin que el video termine con las medidas cambiadas

**Criterios de aceptación:**

- [ ] Un clip grabado en vertical con el celular, cuyo archivo trae marcada una rotación de 90°,
      informa su ancho y alto ya intercambiados como se ve en pantalla, no como los grabó el sensor
      (CA-017)

**Prioridad:** Alta
**Estimación:** XS

---

### US-2-003: Detectar los tramos sin voz de un clip mediante análisis de audio

**Como** creador que edita un clip hablado
**Quiero** que el sistema encuentre, escuchando el propio audio del clip, los tramos donde no hay
ningún sonido relevante
**Para** tener una segunda fuente de silencios (además de los huecos entre palabras de la
transcripción) que cubra los casos donde no hay una palabra clara marcando el corte, como una pausa
antes de empezar a hablar

**Criterios de aceptación:**

- [ ] Sobre un clip con varios tramos de silencio, incluido uno que sigue en silencio hasta el final
      del archivo, el sistema reporta cada tramo con su inicio y su fin, y el que llega hasta el
      final queda cerrado exactamente en la duración total del clip (CA-018)

**Prioridad:** Alta
**Estimación:** S

---

### US-2-004: Dejar la voz al volumen estándar de las plataformas sociales

**Como** creador que graba su locución con un micrófono casero
**Quiero** que el sistema ajuste automáticamente el volumen de mi locución al estándar que usan las
plataformas de redes sociales, sin que queden picos que se distorsionen ni tramos que se escuchen
más bajo que otro contenido
**Para** que mi video suene parejo frente al de otros creadores, sin tener que ajustar el volumen a
oído en un editor de audio

**Criterios de aceptación:**

- [ ] El sistema primero mide el volumen real de la locución y, con esa medición, aplica un segundo
      ajuste que deja la voz al nivel de sonoridad y de pico estándar del producto (CA-020)
- [ ] El ajuste final usa siempre la medición hecha en el primer paso, nunca un valor genérico, para
      no sobrecorregir ni quedarse corto (CA-020)

**Prioridad:** Alta
**Estimación:** M

---

### US-2-005: Preparar automáticamente el audio de un clip para ser transcripto

**Como** creador que quiere subtítulos automáticos
**Quiero** que el sistema convierta el audio de mi clip al formato que el motor de transcripción
necesita, sin que yo tenga que exportar nada a mano
**Para** que la transcripción funcione sobre cualquier clip que yo entregue, sin importar en qué
formato de audio haya quedado grabado

**Criterios de aceptación:**

- [ ] Dado un clip con audio en cualquier formato o cantidad de canales, el sistema entrega un
      archivo de audio de un solo canal, listo para transcribir
- [ ] El audio preparado es el que después usan las historias de transcripción de este mismo ciclo

**Prioridad:** Media
**Estimación:** XS

---

### US-2-006: Obtener la transcripción palabra por palabra de la locución

**Como** creador que quiere subtítulos automáticos y detección de silencios por lo que se dijo
**Quiero** que el sistema transcriba mi locución usando un motor de reconocimiento de voz que corre
en mi propia máquina, con el tiempo exacto de inicio y fin de cada palabra
**Para** poder armar subtítulos y detectar silencios sin escribir ni corregir a mano una sola letra,
y sin que mi audio salga de mi computadora

**Criterios de aceptación:**

- [ ] Dado un audio de locución, el sistema entrega la transcripción con una entrada por cada
      palabra dicha, cada una con su instante de inicio y de fin (CA-019)
- [ ] Ninguna palabra de la transcripción agrupa varias palabras dichas ni fragmentos de una sola
      palabra: es siempre una palabra completa por entrada (CA-019)

**Prioridad:** Alta
**Estimación:** M

---

### US-2-007: Confiar en que cambiar el motor de transcripción no cambie el resultado

**Como** desarrollador que integra la librería
**Quiero** que leer una transcripción generada por el motor de transcripción por defecto o por el
motor alternativo produzca, para el mismo audio, la misma cantidad de palabras y los mismos tiempos
(con una diferencia mínima tolerable)
**Para** poder ofrecer el motor alternativo como respaldo sin que el resto del sistema (subtítulos,
detección de silencios por transcripción) tenga que tratarlo distinto

**Criterios de aceptación:**

- [ ] Para un mismo audio de referencia, la transcripción leída del motor por defecto y la leída del
      motor alternativo tienen la misma cantidad de palabras (CA-019)
- [ ] El tiempo de inicio y fin de cada palabra equivalente entre ambos motores difiere, como mucho,
      en una cantidad de milisegundos acotada y documentada (CA-019)

**Prioridad:** Media
**Estimación:** S

---

### US-2-008: Ubicar los binarios locales sin instalación global ni descargas automáticas

**Como** desarrollador que integra la librería
**Quiero** poder indicarle al sistema, mediante configuración explícita del entorno, dónde están
instalados los binarios y el modelo de transcripción que va a usar, con un respaldo automático si no
los indico
**Para** poder correr el sistema en cualquier máquina (la mía, la de otro desarrollador, un servidor
sin binarios) sabiendo exactamente qué va a usar y sin que el sistema intente bajar nada por su
cuenta

**Criterios de aceptación:**

- [ ] Cuando indico explícitamente dónde está un binario o el modelo, el sistema usa esa ubicación
      antes que cualquier otra (CA-021)
- [ ] Cuando no indico nada, el sistema busca el binario en las ubicaciones estándar de la máquina
      (CA-021)
- [ ] Cuando un binario no aparece en ninguna de esas ubicaciones, el sistema avisa con claridad cuál
      es el binario que falta, en vez de fallar con un error genérico (CA-021)
- [ ] En ningún caso el sistema descarga o instala un binario o un modelo por su cuenta

**Prioridad:** Alta
**Estimación:** S

---

### US-2-009: Diagnosticar rápido por qué falló un comando externo

**Como** desarrollador que integra la librería
**Quiero** que, cuando un comando externo (sondeo de medios, detección de silencio, medición de
volumen, transcripción) falla, el error me diga exactamente qué comando se intentó ejecutar y qué
dijo esa herramienta sobre el fallo
**Para** poder diagnosticar el problema (un archivo corrupto, un argumento mal formado, una versión
incompatible del binario) sin tener que reproducir la ejecución a mano para ver qué pasó

**Criterios de aceptación:**

- [ ] Cuando un comando externo termina en error, el error resultante identifica el comando y sus
      argumentos, y conserva la salida de error de esa herramienta hasta un tamaño acotado, para no
      volcar registros de error interminables (CA-022)

**Prioridad:** Media
**Estimación:** XS

---

## Reglas de negocio

1. **RN-1 — Qué archivos se reconocen y qué datos entrega cada uno:** el sistema reconoce tres tipos
   de archivo — video, imagen y audio. De un video informa duración, cuadros por segundo, ancho,
   alto y si tiene pista de sonido; de una imagen solo su tipo (sin duración ni cuadros por
   segundo, porque una imagen no tiene tiempo propio); de un audio, su duración y sus datos de
   sonido (frecuencia de muestreo y canales).
2. **RN-2 — Orientación de celular:** cuando un archivo de video trae metadata de rotación (90°,
   180° o 270°), las dimensiones informadas son siempre las de la imagen ya rotada tal como se ve
   en pantalla, nunca las crudas del sensor antes de aplicar esa rotación.
3. **RN-3 — Umbral de silencio del analizador de audio:** un tramo del audio se reporta como
   silencio cuando el volumen cae por debajo de −35 dB durante al menos 0.5 segundos continuos; un
   tramo de silencio que continúa hasta el final del archivo se cierra exactamente en la duración
   total de ese archivo, nunca queda abierto.
4. **RN-4 — Normalización de la voz en dos pasadas:** la voz se lleva a −14 LUFS de sonoridad
   integrada y −1 dBTP de pico verdadero mediante dos pasadas: la primera mide el volumen real de
   la locución tal como está grabada, y la segunda aplica la corrección usando esa medición como
   punto de partida, nunca un valor genérico.
5. **RN-5 — Formato del audio para transcribir:** cualquiera sea el formato o la cantidad de
   canales del audio original, el audio que se entrega al motor de transcripción es siempre de un
   solo canal (mono) a 16 000 Hz de frecuencia de muestreo.
6. **RN-6 — Una palabra por unidad de la transcripción:** cada entrada de la transcripción
   corresponde exactamente a una palabra dicha, con su instante de inicio y de fin; ninguna entrada
   agrupa varias palabras ni representa un fragmento de una sola palabra.
7. **RN-7 — Equivalencia entre motores de transcripción:** para el mismo audio, la transcripción
   obtenida con el motor de transcripción por defecto y la obtenida leyendo el resultado del motor
   alternativo tienen la misma cantidad de palabras, con tiempos por palabra equivalentes dentro de
   una diferencia mínima tolerable.
8. **RN-8 — Ubicación de binarios por configuración explícita:** cada binario externo (sondeo y
   procesamiento de medios, transcripción) y el modelo de transcripción se ubican primero por una
   variable de entorno dedicada a cada uno; si no está configurada, se busca en las ubicaciones
   estándar de la máquina. El sistema nunca descarga ni instala un binario o un modelo por su
   cuenta.
9. **RN-9 — Sin binarios reales en integración continua:** la suite de pruebas de este ciclo no
   ejecuta en ningún caso un binario real; toda la lógica de lectura e interpretación de resultados
   se prueba contra grabaciones de ejecuciones previas de esos binarios.
10. **RN-10 — Diagnóstico de un comando que falla:** cuando un comando externo termina en error o un
    binario no se encuentra, el error resultante identifica siempre qué comando se intentó ejecutar
    (y con qué argumentos) y conserva la salida de error relevante de esa herramienta, acotada a un
    tamaño máximo.

---

## Glosario del dominio

| Término              | Definición                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ffprobe**           | Herramienta de línea de comandos (parte de FFmpeg) que inspecciona un archivo de video, imagen o audio y describe sus propiedades técnicas sin modificarlo.          |
| **loudnorm**          | Filtro de FFmpeg que mide y ajusta la sonoridad percibida de un audio hacia un objetivo de LUFS y de pico verdadero, en una o dos pasadas.                            |
| **LUFS**              | Unidad de sonoridad integrada (Loudness Units Full Scale) que mide cómo percibe el oído humano el volumen de un audio a lo largo del tiempo, usada como objetivo de normalización. |
| **dBTP**              | Decibelios de pico verdadero (dB True Peak): el nivel más alto que alcanza la señal de audio, incluso entre muestras, usado para evitar distorsión al reproducir en distintos equipos. |
| **silencedetect**     | Filtro de FFmpeg que analiza un audio y reporta los tramos donde el volumen cae por debajo de un umbral configurado durante un tiempo mínimo.                        |
| **whisper.cpp**       | Motor de transcripción de voz a texto que corre localmente, sin conexión a internet, con aceleración por hardware (Metal en Apple Silicon).                          |
| **Faster-Whisper**    | Motor alternativo de transcripción de voz a texto; en este ciclo el sistema solo interpreta su resultado, no lo ejecuta.                                              |
| **Runner**            | Componente que ejecuta un comando externo (real o, en las pruebas, simulado a partir de una grabación) y devuelve su salida estándar, su salida de error y su código de resultado. |
| **Fixture**           | Grabación real, guardada como archivo de prueba, de la salida de un binario externo en una ejecución previa; se usa para probar la interpretación de esa salida sin tener que ejecutar el binario de nuevo. |

---

## Trazabilidad

| Historia   | Requisito(s) funcional(es) de la spec | Criterios de aceptación de la spec |
| ---------- | -------------------------------------- | ------------------------------------ |
| US-2-001   | RF-8                                    | CA-017                               |
| US-2-002   | RF-8                                    | CA-017                               |
| US-2-003   | RF-3                                    | CA-018                               |
| US-2-004   | RF-10                                   | CA-020                               |
| US-2-005   | RF-9 (soporte)                          | — (prerrequisito de CA-019)          |
| US-2-006   | RF-9                                    | CA-019                               |
| US-2-007   | RF-9                                    | CA-019                               |
| US-2-008   | RNF-3 (soporte transversal)             | CA-021                               |
| US-2-009   | RNF-8                                   | CA-022                               |

Este ciclo no cubre RF-1, RF-2, RF-4, RF-5, RF-6, RF-7 (motor de decisiones, cerrado en `cycle-01`)
ni RF-11, RF-12 (composición y render, `cycle-03`).
