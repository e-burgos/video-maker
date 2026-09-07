# Functional — Cycle 1: Core Composition & Media Pipeline Engine (timeline-core)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Un creador que publica Reels, TikToks o videos de YouTube repite en cada pieza el mismo trabajo
mecánico: recortar muletillas y silencios, mantener el ritmo con zooms de cámara (punch-ins),
subtitular palabra por palabra y bajar la música cuando hay voz. Hoy eso se hace a mano o se paga
por minuto a un SaaS en la nube.

Este ciclo entrega el **cerebro de decisiones** de ese trabajo: una librería de dominio, sin acceso
a disco ni a binarios externos, que representa un video como un documento de datos (una `Timeline`)
y una lista de decisiones de edición (`EditDecisionList`, o EDL) y que calcula, de forma
**determinista y verificable**, todo lo que hoy decide un editor a ojo: dónde cortar, dónde hacer
zoom, cómo agrupar las palabras en subtítulos y cómo automatizar el volumen de la música.

El usuario de este ciclo es doble:

- **El creador/operador**, que en ciclos futuros verá el resultado de estas decisiones aplicado a
  su clip, pero que en este ciclo se beneficia indirectamente: cada regla acá definida es la que
  después reproduce su edición manual de forma predecible y revisable antes de gastar tiempo de
  render.
- **El desarrollador que integra la librería** (`libs/media-local`, `libs/composition-remotion` y
  las specs posteriores), que necesita contratos de datos estables y funciones puras cuyo
  comportamiento esté descrito sin ambigüedad, para no tener que adivinar cómo se calculó cada
  decisión.

Fuera de este ciclo queda todo lo que requiere ejecutar binarios (FFmpeg, Whisper) o renderizar
video: el ciclo entrega únicamente los cálculos y los contratos que esos pasos futuros van a
consumir.

---

## Historias de usuario

### US-1-001: Representar el formato de salida y sus zonas seguras

**Como** desarrollador que integra la librería
**Quiero** obtener el formato de salida por defecto de un preset (Reels/TikTok/Shorts en 9:16,
YouTube en 16:9) y las zonas seguras donde la interfaz de la red social tapa el video
**Para** poder ubicar contenido (subtítulos, elementos importantes) sin que quede oculto por la UI
de la plataforma de destino

**Criterios de aceptación:**

- [ ] Dado el preset `reels-9x16`, el formato resultante es 1080×1920 a 30 fps (CA-002)
- [ ] Dado el preset `youtube-16x9`, el formato resultante es 1920×1080 a 30 fps (CA-002)
- [ ] Para un formato 9:16 las zonas seguras devuelven los márgenes de producto (top 220 px,
      bottom 400 px, left 60 px, right 140 px) (CA-002)
- [ ] Para un formato 16:9 las zonas seguras devuelven 60 px en los cuatro bordes (CA-002)

**Prioridad:** Alta
**Estimación:** XS

---

### US-1-002: Convertir tiempos entre milisegundos y frames sin ambigüedad

**Como** desarrollador que integra la librería
**Quiero** convertir cualquier instante o duración entre milisegundos (unidad de los medios
fuente) y frames (unidad de la timeline final) con una regla de redondeo explícita
**Para** que dos cálculos distintos sobre el mismo instante nunca produzcan resultados
inconsistentes por un redondeo implícito

**Criterios de aceptación:**

- [ ] 1000 ms a 30 fps redondean a 30 frames por defecto (CA-001)
- [ ] 999 ms a 30 fps con redondeo hacia abajo dan 29 frames (CA-001)
- [ ] 16 ms a 60 fps con redondeo hacia arriba dan 1 frame (CA-001)
- [ ] La conversión inversa (frames → ms) es consistente con la conversión directa para los mismos
      parámetros de fps y redondeo

**Prioridad:** Alta
**Estimación:** XS

---

### US-1-003: Detectar los silencios de un clip hablado

**Como** creador que edita su clip
**Quiero** que el sistema detecte automáticamente los huecos de silencio entre palabras de la
transcripción, y que pueda combinarlos con los silencios que detecta un analizador de audio
externo
**Para** no tener que escuchar el clip entero buscando manualmente dónde no hablo

**Criterios de aceptación:**

- [ ] Sobre una transcripción con huecos de 300, 500 y 800 ms, con el umbral por defecto (mayor a
      500 ms), solo se reportan como silencio los huecos de 500 y 800 ms (el límite es inclusivo)
      (CA-003)
- [ ] Un silencio detectado por palabras (1000–1600 ms) y uno detectado por un analizador externo
      (1500–2200 ms) que se superponen se fusionan en un único rango (1000–2200 ms) (CA-004)

**Prioridad:** Alta
**Estimación:** S

---

### US-1-004: Podar los silencios y particionar el clip en tramos a conservar/cortar

**Como** creador que edita su clip
**Quiero** que, a partir de los silencios detectados, el sistema decida qué tramos del clip se
conservan y cuáles se cortan, dejando un pequeño margen de aire antes y después de cada corte, y
sin generar fragmentos conservados demasiado cortos como para ser útiles
**Para** obtener un primer corte automático del clip que respete el ritmo natural del habla

**Criterios de aceptación:**

- [ ] Un clip de 10 000 ms con un silencio en 4000–5000 ms, con el margen de aire por defecto (80
      ms), produce: conservar 0–4080, cortar 4080–4920, conservar 4920–10000; la unión de todos los
      tramos cubre exactamente el clip completo sin huecos ni superposiciones (CA-005)
- [ ] Un tramo a conservar que resulte más corto que el mínimo utilizable (300 ms) se absorbe en el
      corte adyacente en vez de dejarse como un fragmento inservible (CA-006)

**Prioridad:** Alta
**Estimación:** M

---

### US-1-005: Planificar punch-ins alternados y deterministas

**Como** creador que edita su clip
**Quiero** que el sistema decida automáticamente dónde aplicar un zoom digital (punch-in) entre
algunos de los cortes conservados, alternando su aparición y usando siempre la misma decisión ante
la misma entrada
**Para** mantener el ritmo visual del video sin que cada corrida del motor produzca un resultado
distinto sobre el mismo material

**Criterios de aceptación:**

- [ ] Sobre 5 tramos conservados, con la configuración por defecto (un punch-in cada 2 tramos,
      escalas 110%/115%, con una semilla fija), el sistema decide punch-in en el 2º y 4º tramo, con
      una escala dentro de 110%–115% (CA-007)
- [ ] Repetir el cálculo con la misma entrada y la misma semilla produce exactamente el mismo
      resultado (CA-007)

**Prioridad:** Alta
**Estimación:** S

---

### US-1-006: Agrupar palabras en subtítulos de impacto con una palabra destacada

**Como** creador que edita su clip
**Quiero** que el sistema agrupe las palabras de la transcripción en subtítulos cortos (1 a 3
palabras), con una duración acotada, y que señale dentro de cada grupo la palabra que merece
destacarse visualmente
**Para** producir captions de alto impacto sin tener que armarlos manualmente palabra por palabra

**Criterios de aceptación:**

- [ ] Sobre 7 palabras consecutivas y habladas seguido, el sistema arma grupos de hasta 3 palabras,
      ninguno de más de 1200 ms de duración (CA-008)
- [ ] Una palabra aislada por un hueco largo respecto a las anteriores/siguientes forma su propio
      grupo en vez de mezclarse con palabras lejanas en el tiempo (CA-008)
- [ ] Si se configura una lista de palabras clave de énfasis (por ejemplo "gratis") y una de ellas
      aparece en el grupo, esa es la palabra destacada (CA-009)
- [ ] Si no hay palabras clave configuradas, la palabra destacada es la de mayor duración hablada
      del grupo, como aproximación al énfasis fonético; en caso de empate se destaca la última
      palabra del grupo (CA-009)

**Prioridad:** Alta
**Estimación:** M

---

### US-1-007: Automatizar el volumen de la música según la presencia de voz

**Como** creador que edita su clip
**Quiero** que el sistema calcule automáticamente cuándo bajar el volumen de la música de fondo
mientras hay locución y cuándo devolverlo a su nivel base, con una transición suave de entrada y
salida
**Para** que la voz siempre se escuche clara sin tener que automatizar el volumen a mano pista por
pista

**Criterios de aceptación:**

- [ ] Para un tramo de voz entre 1000 y 3000 ms a 30 fps, el plan de automatización arranca en -12
      dB, baja a -24 dB al llegar la voz, se mantiene y vuelve a -12 dB con las rampas de
      entrada/mantenimiento/salida por defecto (150/250/400 ms) tal como especifica la spec (CA-010)
- [ ] Dos tramos de voz separados por menos que el tiempo de mantenimiento (hold) por defecto se
      tratan como un único valle de volumen bajo, sin que la música vuelva a subir entre ambos
      (CA-011)

**Prioridad:** Alta
**Estimación:** M

---

### US-1-008: Ubicar cualquier instante del clip original en la timeline ya editada

**Como** desarrollador que integra la librería
**Quiero** convertir un instante expresado en el tiempo del clip original a su instante
equivalente en la timeline resultante, una vez aplicados los cortes
**Para** poder alinear elementos que se calculan sobre el material original (por ejemplo,
marcadores de B-roll) con el resultado final ya editado

**Criterios de aceptación:**

- [ ] Sobre los tramos conservados del caso de poda de silencios de referencia, el instante 6000 ms
      del clip original se remapea a 5160 ms en la timeline resultante, descontando exactamente el
      tiempo cortado (CA-012)

**Prioridad:** Media
**Estimación:** XS

---

### US-1-009: Construir la timeline final a partir de una lista de decisiones de edición

**Como** desarrollador que integra la librería
**Quiero** convertir una lista de decisiones de edición (EDL) validada, junto con sus medios
(assets), en un documento de timeline completo y listo para componer
**Para** tener un único documento de datos que describa el video final sin tener que recalcular
las decisiones de edición en cada paso posterior

**Criterios de aceptación:**

- [ ] A partir de una EDL de referencia (2 tramos conservados, 1 corte, 1 punch-in, 1 superposición
      de B-roll, 1 transición y 3 grupos de subtítulos) se construye una timeline que pasa la
      validación de invariantes y cuya duración en frames es igual a la suma de los tramos
      conservados menos los frames que consumen las transiciones (CA-013)

**Prioridad:** Alta
**Estimación:** M

---

### US-1-010: Detectar inconsistencias antes de intentar renderizar

**Como** desarrollador que integra la librería
**Quiero** que el sistema revise una timeline ya construida y reporte cada violación de sus reglas
de consistencia, señalando dónde ocurre cada una
**Para** detectar un documento inválido antes de gastar tiempo de render con él

**Criterios de aceptación:**

- [ ] La validación detecta, cada uno como un problema (`issue`) independiente con su ubicación:
      un clip que referencia un asset inexistente, un clip que excede la duración de su asset, una
      superposición entre clips de A-roll, y un subtítulo ubicado fuera de la zona segura del
      formato (CA-014)

**Prioridad:** Alta
**Estimación:** S

---

### US-1-011: Rechazar decisiones de edición inconsistentes antes de construir nada

**Como** desarrollador que integra la librería
**Quiero** que una lista de decisiones de edición que viole las reglas del dominio (por ejemplo,
un punch-in ubicado dentro de un tramo cortado) sea rechazada al validarla, señalando qué decisión
falló
**Para** detectar un error de origen (por ejemplo, un bug en quien genera la EDL) antes de que se
propague a la timeline final

**Criterios de aceptación:**

- [ ] Una EDL con un `punch-in` ubicado dentro de un rango marcado como `cut` falla la validación
      del contrato, indicando la ubicación de la decisión inválida (CA-015)

**Prioridad:** Media
**Estimación:** XS

---

### US-1-012: Confiar en que el contrato documentado es el contrato real

**Como** desarrollador que integra la librería
**Quiero** que el JSON Schema publicado de cada contrato de datos sea siempre exactamente el que
describe el comportamiento real de validación de la librería
**Para** poder generar formularios, documentación o validaciones externas sobre esos esquemas sin
que se desincronicen silenciosamente del código

**Criterios de aceptación:**

- [ ] El JSON Schema generado a partir de los contratos vigentes es idéntico, byte a byte, al
      esquema commiteado en el repositorio (CA-016)

**Prioridad:** Media
**Estimación:** XS

---

## Reglas de negocio

1. **RN-1 — Umbral de silencio:** un hueco entre palabras se considera silencio a podar cuando su
   duración es mayor a 500 ms; el límite es inclusivo hacia el lado detectado (un hueco de
   exactamente 500 ms no se reporta, uno mayor sí).
2. **RN-2 — Fusión de silencios:** los silencios detectados por dos fuentes distintas (palabras de
   la transcripción y un analizador de audio externo) que se superponen o son adyacentes se
   fusionan en un único rango antes de podar.
3. **RN-3 — Margen de aire (padding):** al podar un silencio se deja un margen de 80 ms de aire
   pegado al corte, a cada lado, antes de considerar el resto del silencio como material a
   eliminar.
4. **RN-4 — Fragmento mínimo utilizable:** ningún tramo conservado puede quedar por debajo de 300
   ms; si el resultado de podar deja un tramo así de corto, se absorbe en el corte adyacente.
5. **RN-5 — Partición sin huecos ni solapes:** la unión de todos los tramos conservados y cortados
   de un clip cubre exactamente su duración total, sin huecos entre ambos ni superposición.
6. **RN-6 — Rango válido de punch-in:** un punch-in escala la imagen entre 110% y 115%; ningún
   valor fuera de ese rango es un punch-in de producto válido.
7. **RN-7 — Alternancia y determinismo del punch-in:** el punch-in se aplica cada N tramos
   conservados (por defecto, cada 2) y su cálculo depende únicamente de la entrada y de una
   semilla explícita: la misma entrada con la misma semilla siempre produce la misma decisión.
8. **RN-8 — Un punch-in solo puede caer dentro de un tramo conservado:** nunca dentro de un tramo
   marcado para cortar.
9. **RN-9 — Tamaño de un grupo de subtítulos (caption group):** entre 1 y 3 palabras por grupo.
10. **RN-10 — Duración de un grupo de subtítulos:** ningún grupo supera 1200 ms de duración total
    ni queda por debajo de 300 ms; una palabra aislada por un hueco largo respecto a sus vecinas
    forma su propio grupo en vez de forzarse dentro de otro.
11. **RN-11 — Palabra de énfasis del grupo:** si alguna palabra del grupo coincide con la lista de
    palabras clave de énfasis configurada, esa es la palabra destacada; si ninguna coincide, se
    destaca la de mayor duración hablada dentro del grupo; ante un empate de duración, se destaca
    la última palabra del grupo.
12. **RN-12 — Niveles de ducking de música:** la música suena a -12 dB cuando no hay locución
    (nivel base) y baja a -24 dB mientras hay locución (nivel duckeado); estos son los valores por
    defecto del producto.
13. **RN-13 — Curva de transición del ducking:** el descenso hacia el nivel duckeado tiene un
    tiempo de ataque (attack) de 150 ms, se mantiene (hold) 250 ms tras terminar la locución antes
    de empezar a subir, y el regreso al nivel base (release) toma 400 ms.
14. **RN-14 — Fusión de valles de ducking:** dos tramos de locución separados por menos tiempo que
    el hold configurado se tratan como una única bajada de volumen continua, sin que la música
    vuelva a subir entre ambos.
15. **RN-15 — Elementos superpuestos solo dentro de tramos conservados:** un punch-in, una
    superposición de B-roll, un grupo de subtítulos o una decisión de ducking solo son válidos si
    caen completamente dentro de un tramo marcado `keep`; nunca dentro de un tramo `cut`.
16. **RN-16 — Transiciones en los bordes de corte:** una transición solo es válida si su instante
    coincide exactamente con el borde entre dos tramos `keep` consecutivos.
17. **RN-17 — Zonas seguras por formato:** en formato 9:16 la zona segura reserva 220 px arriba,
    400 px abajo, 60 px a la izquierda y 140 px a la derecha; en formato 16:9 reserva 60 px en los
    cuatro bordes. Todo subtítulo debe ubicarse dentro de la zona segura del formato de salida.
18. **RN-18 — Unidades de tiempo y su conversión:** el tiempo sobre el medio fuente se mide en
    milisegundos (`Ms`, enteros ≥ 0); el tiempo sobre la timeline final se mide en frames (`Frame`,
    enteros ≥ 0) al fps del formato de salida; la conversión entre ambas unidades usa una regla de
    redondeo explícita, por defecto "al más cercano".
19. **RN-19 — Determinismo general del motor:** ningún cálculo depende del reloj del sistema, de
    aleatoriedad sin semilla explícita, ni del orden de ejecución; la misma entrada produce siempre
    la misma salida.
20. **RN-20 — Consistencia de la timeline final:** en la timeline resultante, los clips de A-roll
    no se solapan entre sí y cubren la duración total sin huecos (salvo los frames consumidos por
    las transiciones); todo clip referencia un asset existente; ningún clip excede la duración de
    su asset de origen; todo subtítulo cae dentro de la zona segura.

---

## Glosario del dominio

| Término            | Definición                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-roll**          | El metraje principal donde habla el creador (cámara o pantalla); es la pista sobre la que se detectan silencios, se aplican punch-ins y se generan subtítulos. |
| **B-roll**          | Metraje o imagen de apoyo que se superpone sobre el A-roll mientras el creador habla de algo concreto, sin reemplazar su voz.                                    |
| **EDL (Edit Decision List)** | Documento de datos con la lista ordenada de decisiones de edición (qué se conserva, qué se corta, dónde va un punch-in, un B-roll, una transición, un grupo de subtítulos o un ducking) sobre un asset de origen. Es la entrada para construir la `Timeline`. |
| **Timeline**        | Documento final que describe el video completo ya resuelto: sus pistas (A-roll, B-roll, voz, música, subtítulos), sus transiciones y su plan de mezcla de audio, expresado en frames. |
| **Punch-in**        | Zoom digital aplicado sobre un tramo del A-roll (entre 110% y 115% de escala) para reforzar el ritmo visual sin cambiar de plano real.                          |
| **Ducking**         | Automatización que baja el volumen de la música de fondo mientras hay locución y lo devuelve a su nivel base cuando la locución termina.                        |
| **LUFS**            | Unidad de sonoridad integrada (Loudness Units Full Scale) usada para normalizar el volumen percibido de la voz a un nivel objetivo constante.                   |
| **Safe zone (zona segura)** | Márgenes del cuadro, medidos en píxeles, donde la interfaz propia de la red social (íconos, texto, controles) puede tapar el video; los subtítulos y elementos importantes deben ubicarse fuera de esos márgenes. |
| **Keep / Cut**      | Los dos tipos de tramo en que se particiona el asset de origen: `keep` es un tramo que se conserva en el video final, `cut` es un tramo que se descarta (por ejemplo, por ser un silencio).            |
| **Frame**           | Unidad de tiempo de la timeline final: una posición o duración expresada en cuadros a los fps del formato de salida (a diferencia del milisegundo, que mide tiempo sobre el medio fuente).            |
| **Caption group (grupo de subtítulos)** | Agrupación de 1 a 3 palabras consecutivas de la transcripción que se muestran juntas como un subtítulo, con una de ellas marcada como palabra de énfasis. |
| **Transcripción**  | Texto de la locución con marca de tiempo palabra por palabra, usado como base para detectar silencios y armar los subtítulos.                                    |
| **Semilla (seed)** | Valor explícito que fija el resultado de un cálculo que de otro modo podría variar (por ejemplo, qué tramos reciben punch-in), garantizando que se pueda reproducir la misma decisión.               |

---

## Trazabilidad

| Historia    | Requisito(s) funcional(es) de la spec | Criterios de aceptación de la spec |
| ----------- | -------------------------------------- | ------------------------------------ |
| US-1-001    | RF-1                                    | CA-002                               |
| US-1-002    | RF-1                                    | CA-001                               |
| US-1-003    | RF-2, RF-3                              | CA-003, CA-004                       |
| US-1-004    | RF-2                                    | CA-005, CA-006                       |
| US-1-005    | RF-4                                    | CA-007                               |
| US-1-006    | RF-5                                    | CA-008, CA-009                       |
| US-1-007    | RF-6                                    | CA-010, CA-011                       |
| US-1-008    | RF-2, RF-7 (soporte)                    | CA-012                               |
| US-1-009    | RF-7                                    | CA-013                               |
| US-1-010    | RF-7                                    | CA-014                               |
| US-1-011    | RF-1                                    | CA-015                               |
| US-1-012    | RF-1                                    | CA-016                               |

CA-017 en adelante (probeMedia, parsers de Whisper, `normalizeVoice`, wrappers de binarios y
composición Remotion) quedan fuera de este ciclo: pertenecen a `cycle-02` (`libs/media-local`) y
`cycle-03` (`libs/composition-remotion`) según el brief y la tabla "Ciclos planificados" de la spec.
