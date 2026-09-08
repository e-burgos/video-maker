# Functional — Cycle 2: Conceptos clave, planificador de B-roll y composición del auto-montaje

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El `cycle-01` dejó al sistema sabiendo **qué hay** en la carpeta del proyecto (`raw/`) y **qué se
dijo** en la locución (transcripción incremental). Lo que falta todavía es la parte editorial: la
decisión de cuándo cortar, cuándo acercar la cámara sobre la cara del creador, y sobre todo cuándo
tapar esa cara con un clip de apoyo o una foto que ilustra lo que se está diciendo. Hoy esa decisión
la toma el creador mirando el material entero de punta a punta; este ciclo la automatiza.

La regla de oro del formato es simple de enunciar y exigente de cumplir: **el B-roll ilustra la
palabra**. Si el creador dice "compilador", el clip de apoyo del compilador tiene que aparecer ahí
— no veinte segundos después, ni nunca. Para que el sistema sepa "ahí" tiene que saber primero qué
palabras importan (los **conceptos clave** de la locución) y en qué momento exacto se dijeron; y
después, para cada concepto, si existe un clip o una foto de apoyo que lo ilustra, sin repetir el
mismo recurso todo el tiempo ni pisar un acercamiento de cámara que ya está ocupando la pantalla.

Ese matching es deliberadamente simple: por palabras, no por significado. Nada de modelos de
lenguaje ni de embeddings — sería impredecible y no reproducible dos veces. Es frecuencia de
palabras, listas de palabras vacías (stopwords) y un diccionario de términos propio de cada tipo de
video, comparado letra por letra contra los nombres de archivo del material de apoyo.

Y no todos los videos se editan igual. Una demo de software no tiene el mismo ritmo que una receta
de cocina: la receta corta muchísimo y tapa la cara todo el tiempo con planos de la comida; una
explicación educativa, en cambio, deja respirar la cara del que habla y solo tapa cuando de verdad
hay algo concreto para mostrar. Los cuatro **presets** (`software-demo`, `hardware`, `recipe`,
`educational`) existen exactamente para capturar esa diferencia de ritmo y de vocabulario, sin que
el creador tenga que ajustar nada a mano.

Todo esto converge en una única función, `autoMontage(project, preset, seed)`, que toma el proyecto
ya ingerido y produce la decisión de montaje completa (`EditDecisionList` y `Timeline`) lista para
render. Y como es una decisión que se toma sin intervención humana, tiene que ser objetivamente
verificable: la misma carpeta, el mismo preset y el mismo `seed` tienen que producir exactamente el
mismo resultado, byte a byte, las veces que se corra. Sin esa garantía, "automático" sería
sinónimo de "impredecible".

El actor de todas las historias sigue siendo el propio dev operando su máquina local — no hay
multiusuario, no hay interfaz gráfica, no hay red. Fuera de este ciclo quedan: la CLI que encadena
todo esto (`cycle-03`), el estilo visual de los subtítulos (`spec-003`), la mezcla final de audio
(`spec-004`) y cualquier forma de matching que no sea léxica y determinista.

## Historias de usuario

### HU-07: Detectar los conceptos clave de lo que se dice

**Requisito relacionado:** RF-5

**Como** dev que grabó una locución sobre su material
**Quiero** que el sistema detecte automáticamente qué palabras o términos son los "conceptos clave"
de esa locución, con el momento exacto en que se dijeron
**Para** no tener que escuchar la grabación entera anotando a mano qué se mencionó y cuándo, y
tener esa base lista para decidir después dónde meter B-roll

**Criterios de aceptación:**

- [ ] CA-008 (spec): dada una `Transcription` de fixture, el keyword spotting produce el conjunto
      de conceptos esperado, cada uno con su rango o rangos temporales derivados de las palabras que
      lo componen (ver RN-08 y RN-09 para qué hace concepto a un término y cómo se calcula su
      rango).
- [ ] CA-008 (spec): dos corridas del keyword spotting sobre la misma `Transcription` y el mismo
      preset producen exactamente el mismo conjunto de conceptos, en el mismo orden.
- [ ] CA-008 (spec): el keyword spotting no invoca ningún servicio externo ni modelo de lenguaje —
      es una función pura sobre la `Transcription` y el diccionario del preset.

### HU-08: Ilustrar cada concepto con B-roll sin repetirse ni tapar un acercamiento

**Requisito relacionado:** RF-6

**Como** dev
**Quiero** que el planificador de B-roll asocie cada concepto detectado con, como mucho, un clip o
una foto de apoyo que lo ilustre, sin repetir el mismo recurso de apoyo demasiado seguido ni
mostrarlo encima de un acercamiento de cámara que ya está en pantalla
**Para** que el video se sienta armado con criterio editorial y no como una superposición
automática que repite lo mismo o pisa otras decisiones de montaje

**Criterios de aceptación:**

- [ ] CA-009 (spec): sobre un proyecto de fixture con conceptos y assets de `broll/`/`images/`
      conocidos, el planificador nunca asigna el mismo asset dos veces dentro de la ventana de
      no-repetición del preset (ver RN-12), sin importar si las dos veces vienen del mismo concepto
      mencionado otra vez o de dos conceptos distintos que matchean el mismo archivo.
- [ ] CA-009 (spec): ninguna superposición de B-roll planificada cae, ni total ni parcialmente,
      dentro del rango temporal de un punch-in ya planificado (RN-13).
- [ ] CA-009 (spec): un concepto detectado que no tiene ningún asset de `broll/` o `images/` cuyo
      nombre lo matchee léxicamente no produce ninguna superposición para esa mención, y no
      interrumpe la planificación del resto de los conceptos (RN-14).
- [ ] CA-009 (spec): cuando dos conceptos distintos matchean por igual el mismo asset candidato, el
      planificador se lo asigna a uno solo siguiendo siempre el mismo criterio de desempate — dos
      corridas sobre el mismo proyecto resuelven la competencia exactamente igual (RN-15).

### HU-09: Que cada preset edite el video con un criterio distinto

**Requisito relacionado:** RF-7

**Como** dev que graba distintos tipos de contenido (demo de software, review de hardware, receta,
explicación educativa)
**Quiero** poder elegir entre los cuatro presets del sistema y que cada uno le dé al mismo material
crudo un ritmo de edición reconociblemente distinto
**Para** no tener que reconfigurar a mano la poda, los acercamientos, la cantidad de B-roll y las
transiciones cada vez que cambio de tipo de video

**Criterios de aceptación:**

- [ ] CA-010 (spec): existen exactamente los cuatro presets `software-demo`, `hardware`, `recipe` y
      `educational`.
- [ ] CA-010 (spec): corriendo el mismo proyecto de fixture con cada uno de los cuatro presets, los
      parámetros resultantes son distintos entre sí en, como mínimo, los ejes listados en RN-16
      (agresividad de poda, agresividad del punch-in, densidad de B-roll, transición dominante y
      vocabulario de conceptos) — la prueba compara los cuatro resultados entre sí, no un preset
      contra un literal fijo copiado del código.

### HU-10: Armar la Timeline completa de un proyecto en un solo paso

**Requisito relacionado:** RF-8

**Como** dev
**Quiero** correr una única función (`autoMontage`) sobre mi proyecto ya ingerido y un preset
elegido, y recibir una `Timeline` completa y válida, lista para pasar a render
**Para** no tener que orquestar a mano la poda de silencios, los acercamientos, los conceptos, el
B-roll, los subtítulos y el ducking de audio en el orden correcto

**Criterios de aceptación:**

- [ ] CA-011 (spec): sobre el proyecto de fixture, `autoMontage(project, preset, seed)` produce una
      `Timeline` que pasa `validateTimeline` sin ningún issue.
- [ ] CA-011 (spec): sobre un proyecto de fixture sin ningún asset en `broll/` ni en `images/`,
      `autoMontage` no falla — produce igual una `Timeline` válida, simplemente sin superposiciones
      de B-roll (RN-17).
- [ ] CA-011 (spec): sobre un proyecto de fixture cuya `Transcription` no tiene palabras,
      `autoMontage` no falla — no hay conceptos que detectar ni B-roll que planificar, y el resto
      del montaje (poda, formato) se resuelve igual (RN-17).
- [ ] CA-011 (spec): sobre un proyecto de fixture cuyo A-roll no tiene silencios detectables,
      `autoMontage` no falla — el resultado conserva el A-roll completo sin cortes de poda (RN-17).

### HU-11: Confiar en que el mismo material y el mismo preset dan siempre el mismo resultado

**Requisito relacionado:** RF-9

**Como** dev
**Quiero** que correr `autoMontage` dos veces sobre el mismo proyecto, el mismo preset y el mismo
`seed` me dé siempre exactamente el mismo `timeline.json`
**Para** poder confiar el resultado a control de versiones, comparar corridas, y volver a generar
el mismo montaje sin sorpresas si necesito reproducirlo en otra máquina o más adelante

**Criterios de aceptación:**

- [ ] CA-012 (spec): corriendo `autoMontage` dos veces sobre el mismo proyecto de fixture, el mismo
      preset y el mismo `seed`, el `timeline.json` serializado es byte a byte idéntico entre ambas
      corridas.
- [ ] CA-012 (spec): cambiar el `seed` (con el mismo proyecto y preset) puede cambiar el resultado;
      cambiar cualquier otra cosa del entorno (reloj del sistema, variables de entorno, orden en que
      el filesystem devuelve los assets) nunca lo cambia (RN-18).

## Reglas de negocio

1. **RN-08:** Un término de la `Transcription` es un **concepto clave** cuando, tras normalizarlo
   léxicamente (minúsculas, sin tildes ni signos de puntuación), no es una palabra vacía (stopword)
   y además cumple al menos una de estas dos condiciones: su frecuencia de aparición en la locución
   alcanza el umbral mínimo que define el preset, o el término figura explícitamente en el
   diccionario de conceptos propio del preset — en cuyo caso una sola mención ya alcanza para
   considerarlo concepto clave, precisamente porque el diccionario existe para capturar términos
   editorialmente importantes aunque se digan una sola vez.
2. **RN-09:** El rango temporal de un concepto no es único: cada vez que el término se menciona en
   la locución es una **ocurrencia** distinta, con su propio rango tomado de los timestamps
   (`startMs`/`endMs`) de la palabra o palabras que la componen. Un concepto puede tener una, varias
   o ninguna ocurrencia elegible para B-roll, según lo que decida el planificador (RN-12 a RN-15).
3. **RN-10:** Todo el matching de este ciclo — concepto↔locución y concepto↔asset — es léxico,
   exacto tras la normalización, y determinista. No hay similitud semántica, no hay embeddings, no
   hay ningún modelo de lenguaje involucrado en ninguna etapa.
4. **RN-11:** El planificador de B-roll asocia cada concepto con, como mucho, un asset de `broll/`
   o `images/`, elegido por coincidencia léxica entre el concepto normalizado y el nombre de archivo
   del asset (normalizado con la misma función) — no hay preferencia de negocio declarada entre un
   clip de video y una foto fija cuando ambos matchean por igual; es una decisión abierta para el
   arquitecto (ver ambigüedades reportadas).
5. **RN-12:** La **ventana de no-repetición** es un parámetro del preset expresado en tiempo:
   ningún asset de `broll/` o `images/` puede volver a usarse en una nueva superposición mientras no
   haya transcurrido esa ventana desde la última vez que se usó, sin importar si lo disparó el mismo
   concepto otra vez o uno distinto.
6. **RN-13:** Ninguna superposición de B-roll puede solaparse en el tiempo con un punch-in ya
   planificado — un acercamiento de cámara y un clip de apoyo no compiten nunca por el mismo
   instante de pantalla.
7. **RN-14:** Un concepto (o una ocurrencia suya) sin ningún asset candidato que lo matchee no
   genera ninguna superposición de B-roll para ese instante — no es un error ni interrumpe la
   planificación del resto; el A-roll simplemente sigue mostrándose sin tapar en ese tramo.
8. **RN-15:** Cuando dos o más conceptos matchean por igual el mismo asset candidato, se lo queda
   uno solo según un criterio de prioridad enteramente determinista (el arquitecto de este ciclo lo
   define) e independiente de cualquier orden de iteración del catálogo o de un mapa en memoria; el
   resto de los conceptos que compitieron y perdieron quedan sin asset, con el mismo tratamiento de
   RN-14.
9. **RN-16:** Los cuatro presets (`software-demo`, `hardware`, `recipe`, `educational`) tienen que
   diferir de forma verificable, cada uno con su propia combinación, en estos ejes: agresividad de
   la poda de silencios (cuánto se corta), agresividad y frecuencia del punch-in, densidad de B-roll
   (cuánto se tapa la cara), tipo de transición dominante, y vocabulario propio del diccionario de
   conceptos. Los valores numéricos exactos de cada eje son una decisión técnica del arquitecto, no
   de esta historia.
10. **RN-17:** `autoMontage` nunca lanza una excepción no controlada por falta de material: un
    proyecto sin ningún asset en `broll/` ni `images/`, una `Transcription` sin palabras, o un A-roll
    sin silencios detectables producen igualmente una `Timeline` válida — simplemente con menos o
    ninguna decisión en las etapas que no tienen material sobre el cual operar.
11. **RN-18:** El determinismo por `seed` es absoluto: mismo proyecto (mismo catálogo y misma
    transcripción) + mismo preset + mismo `seed`, corrido las veces que sea, produce siempre el
    mismo `edl.json` y el mismo `timeline.json` byte a byte. En consecuencia, ningún cálculo de este
    ciclo puede leer el reloj del sistema, leer variables de entorno, ni usar aleatoriedad que no
    esté sembrada por ese `seed`; y ningún resultado puede depender del orden en que el filesystem
    devuelve los assets del catálogo.
12. **RN-19:** El `anchor` del punch-in (dónde dentro del cuadro se ubica el acercamiento: centro,
    arriba, o pista de rostro) es una decisión editorial que fija el preset. Si el contrato actual
    de `timeline-core` no lo persiste hasta la `Timeline` final, esa intención editorial puede
    perderse antes de llegar al render — la resolución técnica de este punto (extender el contrato
    de forma aditiva, o resolverlo dentro de `auto-montage` aceptando la pérdida) es una decisión
    del arquitecto de este ciclo (D-4), no de esta historia funcional.

## Glosario del dominio

| Término                    | Definición                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Concepto clave              | Término de la locución que supera el filtro de stopwords y cumple frecuencia mínima o pertenece al diccionario del preset (RN-08).       |
| Ocurrencia (de un concepto) | Cada mención puntual de un concepto en la locución, con su propio rango temporal (RN-09).                                                |
| Matching léxico             | Comparación exacta de texto normalizado (sin significado ni similitud semántica) entre locución, conceptos y nombres de asset (RN-10).   |
| Diccionario del preset      | Lista de términos propios de un tipo de video (ej. "compilador" para `software-demo`) que un preset reconoce como concepto siempre.      |
| Ventana de no-repetición    | Tiempo mínimo que debe pasar antes de volver a usar el mismo asset de B-roll en otra superposición (RN-12).                              |
| Punch-in                    | Decisión de acercamiento de cámara sobre el A-roll, ya definida por `timeline-core` (`planPunchIns`).                                     |
| Anchor (del punch-in)       | Ubicación del acercamiento dentro del cuadro (centro, arriba, pista de rostro); su persistencia hasta el render es la decisión D-4.      |
| B-roll                      | Clip de apoyo sin voz, o foto, que ilustra un concepto tapando momentáneamente el A-roll.                                                |
| Preset                      | Conjunto de parámetros editoriales (poda, punch-in, B-roll, transiciones, vocabulario) propio de un tipo de video (RN-16).               |
| `autoMontage`               | Función que compone `pruneSilences`, `planPunchIns`, el keyword spotting, el planificador de B-roll, `groupWordsForCaptions`, `planDucking` y `buildTimeline` en una `EditDecisionList` y una `Timeline` validada. |
| Determinismo por seed       | Garantía de que el mismo proyecto + preset + `seed` reproduce siempre el mismo resultado byte a byte (RN-18).                            |
