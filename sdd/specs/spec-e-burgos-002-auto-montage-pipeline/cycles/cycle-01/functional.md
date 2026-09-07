# Functional — Cycle 1: Ingesta y catálogo del proyecto de medios

> **Input:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-002-auto-montage-pipeline/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El dev que edita sus propios videos arranca siempre igual: tiene una carpeta con el material
crudo de una grabación — clips de cámara o de pantalla con su voz, clips de apoyo sin voz,
algunas fotos, y quizás audio o música separada. Hoy, antes de poder armar el video, tiene que
mirar todo ese material a mano para saber qué hay y qué se dijo en cada clip.

Este ciclo automatiza ese primer paso. El sistema recibe un **proyecto de medios**: una carpeta
con una estructura fija (`raw/`, `work/`, `out/`) que ya vive fuera del repositorio de código. A
partir de ahí:

1. Recorre el material crudo (`raw/`) y entiende qué es cada archivo (clip con locución, clip de
   apoyo, foto, audio).
2. Sondea cada archivo para conocer sus datos técnicos (duración, formato).
3. Transcribe la locución de los clips principales, para saber qué se dijo y en qué momento.
4. Guarda todo ese conocimiento en un catálogo, sin tocar nunca el material original.

El costo que hay que evitar es concreto: transcribir con whisper-cli usando un modelo de 574 MB
tarda minutos por clip. Si el dev vuelve a correr la ingesta sobre el mismo material —porque
agregó un clip nuevo, por ejemplo— el sistema no puede volver a pagar ese costo por los clips que
ya transcribió antes. Esa incrementalidad es el corazón de valor de este ciclo, no un detalle
técnico secundario.

El actor de todas las historias es el propio dev, operando su máquina local. No hay más de un
usuario, no hay interfaz gráfica y no hay red: todo pasa por invocar funciones de una librería
sobre carpetas del filesystem local.

Fuera de este ciclo (se resuelven en ciclos o specs posteriores, no se abordan acá): detectar
conceptos clave en lo transcripto, elegir automáticamente qué B-roll usar, los presets por tipo
de video, y la CLI que encadena ingesta con render.

## Historias de usuario

### HU-01: Descubrir y clasificar el material crudo

**Como** dev que tiene una carpeta con el material crudo de una grabación
**Quiero** que el sistema recorra `media/<project-slug>/raw/` y clasifique cada archivo según su
subcarpeta (`aroll`, `broll`, `images`, `audio`)
**Para** no tener que revisar manualmente carpeta por carpeta qué material tengo disponible antes
de empezar a editar

**Criterios de aceptación:**

- [ ] CA-001 (spec): dado un árbol `raw/` de fixture con `aroll/`, `broll/`, `images/`, `audio/`,
      un archivo oculto y un archivo de extensión no soportada, el catálogo resultante contiene
      exactamente los assets esperados de cada subcarpeta, y reporta el archivo oculto y el de
      extensión no soportada como ignorados (no como error).

### HU-02: Sondear cada asset sin que uno roto arruine el resto

**Como** dev
**Quiero** que cada asset descubierto se sondee automáticamente para conocer sus datos técnicos
(duración, formato) y quede en el catálogo como un asset válido
**Para** tener esa información sin abrir cada archivo a mano, y sin que un archivo corrupto o
ilegible me impida ingerir el resto del material

**Criterios de aceptación:**

- [ ] CA-002 (spec): si el sondeo de un asset falla, el catálogo igual incluye el resto de los
      assets sondeados correctamente, y el fallido queda reportado con su ruta — la ingesta no
      se aborta.

### HU-03: Catálogo portable con rutas relativas

**Como** dev
**Quiero** que el catálogo (`work/catalog.json`) guarde siempre rutas relativas a la raíz del
proyecto de medios, nunca rutas absolutas de mi máquina
**Para** poder mover o copiar la carpeta `media/<project-slug>` a otra ubicación o a otra máquina
sin que el catálogo quede roto

**Criterios de aceptación:**

- [ ] CA-003 (spec): en el catálogo serializado, ninguna ruta de asset empieza con `/` — todas son
      relativas a la raíz del proyecto de medios.

### HU-04: Transcribir el A-roll sin repetir trabajo ya hecho

**Como** dev
**Quiero** que el sistema transcriba la locución de los clips de A-roll y guarde el resultado en
`work/transcripts/`, y que una segunda corrida sobre material que no cambió no vuelva a
transcribir
**Para** no pagar de nuevo minutos de cómputo transcribiendo clips que ya transcribí en una corrida
anterior, y solo esperar ese costo cuando de verdad agregué o modifiqué algo

**Criterios de aceptación:**

- [ ] CA-004 (spec): una segunda ingesta sobre un proyecto sin cambios en su A-roll no genera
      ninguna invocación nueva a whisper-cli.
- [ ] CA-005 (spec): un cambio detectado en un clip de A-roll (tamaño o fecha de modificación)
      invalida su transcripción existente y dispara una nueva transcripción para ese clip.

### HU-05: Nunca poner en riesgo el material original

**Como** dev
**Quiero** que ninguna etapa del pipeline pueda escribir dentro de `raw/`
**Para** tener la garantía de que en cualquier momento puedo borrar `work/` y `out/` sin miedo,
sabiendo que mi material original está intacto y el sistema puede reconstruir todo desde `raw/`

**Criterios de aceptación:**

- [ ] CA-006 (spec): cualquier intento de escritura dentro de `raw/`, desde cualquier etapa,
      resulta en un error tipado y no produce ningún efecto sobre el filesystem.

### HU-06: Confirmar que la ingesta funciona con material real

**Como** dev
**Quiero** poder correr la ingesta completa sobre un proyecto real de mi máquina, con whisper-cli
y las herramientas de sondeo instaladas
**Para** confirmar, antes de dar el ciclo por cerrado, que el catálogo y la transcripción que
genera el sistema son coherentes sobre material real y no solo sobre fixtures de test

**Criterios de aceptación:**

- [ ] CA-007 (spec): un smoke manual de ingesta sobre un proyecto real en `media/`, con los
      binarios instalados, produce un `catalog.json` y transcripciones coherentes con el
      contenido real del material.

## Reglas de negocio

1. **RN-01:** `raw/` es de solo lectura por contrato — ninguna etapa del pipeline escribe ahí bajo
   ninguna circunstancia.
2. **RN-02:** Un asset cuyo sondeo falla se reporta con su ruta y no aborta la ingesta del resto
   del proyecto.
3. **RN-03:** Re-transcribir material de A-roll que no cambió es el desperdicio principal a
   evitar: el sistema nunca vuelve a invocar whisper-cli sobre un clip cuyo tamaño y fecha de
   modificación son los mismos que en la última corrida exitosa.
4. **RN-04:** Un cambio en el tamaño o la fecha de modificación de un clip de A-roll invalida
   únicamente la transcripción de ese clip — no fuerza a re-transcribir el resto del A-roll.
5. **RN-05:** El catálogo persiste solo rutas relativas a la raíz del proyecto de medios; nunca
   rutas absolutas de la máquina del dev.
6. **RN-06:** Los archivos ocultos y las extensiones no soportadas se ignoran durante el
   descubrimiento — se reportan como ignorados, nunca como error.
7. **RN-07:** Transcripción y render nunca corren en paralelo: comparten los 16 GB de RAM de la
   máquina del dev, y correrlos a la vez compromete ambos procesos. (El render es de un ciclo
   posterior, pero la regla aplica a todo el pipeline desde ahora.)

## Glosario del dominio

| Término              | Definición                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Proyecto de medios    | Carpeta `media/<project-slug>/` con estructura fija `raw/`, `work/`, `out/`; unidad de trabajo del pipeline.  |
| A-roll                | Clips de cámara o de pantalla con locución — el material principal, el que se transcribe.                    |
| B-roll                | Clips de apoyo sin voz, usados para cubrir cortes o ilustrar lo que se dice (fuera de alcance en este ciclo). |
| Catálogo              | `work/catalog.json`: registro de los assets descubiertos y sondeados, con rutas relativas al proyecto.       |
| Ingesta incremental   | Volver a correr la ingesta sobre un proyecto ya procesado sin repetir trabajo (sondeo o transcripción) sobre material que no cambió. |
| `raw/`                | Material crudo, irreemplazable. Solo lectura para el pipeline.                                                |
| `work/`               | Todo lo regenerable a partir de `raw/`: catálogo, transcripciones, y en ciclos futuros EDL y timeline.        |
| `out/`                | Renders finales (fuera de alcance en este ciclo).                                                             |
