# spec-e-burgos-004 cycle-01 — 2026-09-08

## Qué pasó

La spec (RF-2 / CA-003) pedía, con esas palabras, emitir `baseGainDb` **y después** la curva de
automatización de ducking. El arquitecto no planificó sobre esa letra: fue a leer el código ya
entregado por `spec-001` —`libs/composition-remotion/src/components/audio-track.tsx`— y encontró que
`musicVolume` aplica la curva **en lugar de** `clip.volume`, no encima, porque los keyframes que
produce `planDucking` son **ganancias absolutas** (en reposo valen exactamente `baseGainDb`, no un
delta de 0).

Implementar la letra de la spec habría encadenado dos nodos de ganancia y dejado el master **12 dB
por debajo del preview** en todos los tramos de reposo — rompiendo justo el CA (CA-002, paridad con
`volumeAtFrame`) que la spec declaraba como el valor del ciclo. El defecto habría pasado lint, tipos
y toda la suite: el filtergraph era sintácticamente válido y solo se oye al renderizar. Salió como
divergencia declarada (D-05, §10.2) antes de escribir código, no como bug encontrado después.

Segundo hallazgo del mismo tipo, en TASK-008: `buildVoiceTrack` de `timeline-core` le asigna al clip
de voz el `assetId` del clip de aroll, así que la voz no tiene id propio. Nadie lo había documentado;
solo aparece leyendo el builder.

## Lección

Cuando un RF describe **cómo componer algo que otra lib ya entregó**, la letra del RF no es la
fuente de verdad: leer la función real de esa lib y derivar el contrato de ahí, declarando la
divergencia. Un RF escrito sin abrir el código aguas arriba puede especificar un defecto semántico
que ninguna verificación automática del ciclo (tipos, lint, cobertura) puede detectar.

Corolario para fixtures: un juego de fixtures donde todos los valores posicionales son `0`
(`from: 0`, `trimStartMs: 0`) da 100 % de cobertura sobre la lógica de posicionamiento sin verificar
ninguno de sus cálculos — `f(0)` no distingue la fórmula correcta de casi ninguna incorrecta. Elegir
al menos un valor distinto de cero por eje posicional.

## Costo evitable

Detectarlo después habría costado el ciclo entero de vuelta: implementar 10 tasks contra el contrato
equivocado (~440 K tokens de implementación), más el render manual de `smoke-audio` de `cycle-02`
para oír el problema, más rehacer `architect.md` §5/§7 y la tabla de paridad de 26 filas. La lectura
que lo evitó fue **un archivo** de otra lib. En cambio, la deuda del corolario de fixtures sí quedó
abierta (`adelay` verificado solo en `0`): barata ahora, un fixture; caro si en `cycle-02` una
regresión de posicionamiento llega al mux y hay que bisectar sobre audio renderizado.
