# spec-e-burgos-004 cycle-02 — 2026-09-08

## Estado

Cambio **aditivo y chico**, pero habilita el entregable final de `spec-e-burgos-004`: el render
puede salir **mudo**.

`renderTimeline(timeline, { outPath, audio: 'muted' })` y `TimelineComposition` aceptan
`audio?: TimelineAudioMode` (`'mix' | 'muted'`). Con `'muted'` la composición **no monta
`AudioTrack`**. Omitida o en `'mix'`, el comportamiento es **idéntico al anterior**.

Por qué existe: el pipeline real necesita un video **sin** audio para muxearle después la mezcla
masterizada de `media-local`. Si Remotion renderizara su propia mezcla en vivo y encima se le
muxeara la masterizada, el entregable saldría con el **audio duplicado**.

Ningún consumidor se rompe: los 8 tests preexistentes de `render.spec.ts` quedaron **intactos**
(el diff del ciclo es de 32 inserciones y **0 borrados**) y siguen pasando. `Root.tsx` no cambia:
sus `defaultProps` no traen `audio`, así que `remotion studio` y el `<Player>` siguen mostrando el
preview **con** audio, que es lo que D-B pide conservar.

Cobertura: **96.77 % stmts / 93.16 % ramas / 98.07 % funcs** sobre 249 tests (eran 247).

## Estructura

- **El default de `audio` es ESTRUCTURAL, no un valor.** `renderTimeline` construye
  `inputProps` como `{ timeline, ...(options.audio === 'muted' ? { audio: options.audio } : {}) }`:
  la clave `audio` **sólo aparece cuando vale `'muted'`**. No hay ningún `?? 'mix'` en el repo. Por
  eso los tests preexistentes que comparan `inputProps: { timeline }` con igualdad estructural
  siguen pasando sin tocarse — y por eso mismo, si alguien introdujera un default explícito, esos
  tests fallarían. **Es una invariante, no una casualidad: no la conviertas en `?? 'mix'`.**
- `TimelineAudioMode` se declara en `src/components/timeline-composition.tsx` y es el **único**
  símbolo nuevo del barrel. `RenderTimelineOptions` y `TimelineInputProps` viven en `src/render.ts`,
  que es la **otra** entrada (`@video-maker/composition-remotion/render`) y ya se exportaban.
- El montaje condicional es un ternario en el JSX
  (`{audio === 'muted' ? null : <AudioTrack … />}`), no un early-return ni una rama en el plan.

## Dependencias

Ninguna nueva.

## Qué sigue

**API pública que `spec-e-burgos-005` consume de esta lib:** `renderTimeline` con
`audio: 'muted'` (paso 1 del pipeline: producir el video sin audio) y el tipo `TimelineAudioMode`.

De `libs/media-local`, los pasos 2 a 4: `mixTimelineAudio`; `verifyMixLoudness` con
`MIX_INTEGRATED_TOLERANCE_LU` y `MIX_TRUE_PEAK_TOLERANCE_DB`; `muxAudioIntoVideo` con
`MUX_AUDIO_CODEC` y `MUX_AUDIO_BITRATE`; `MissingMediaStreamError`; y
`MASTER_BUS_TRUE_PEAK_MARGIN_DB`. **El orden de llamadas y la tabla de errores están en §15 del
`architect.md` de este ciclo**
(`sdd/specs/spec-e-burgos-004-audio-mix-mastering/cycles/cycle-02/architect.md`).

**Límite explícito:** `render → mix → mux` **en una sola llamada NO vive en esta lib** ni en
`media-local`, y no puede vivir en ninguna de las dos. Los boundaries Nx de `eslint.config.mjs`
raíz (`type:ui` y `type:util` → sólo `type:domain`) impiden que se importen entre sí. Esa
orquestación es de **`spec-e-burgos-005`**, en `apps/render-api` (`type:app`), el único subproyecto
que puede depender de las dos. Mientras tanto el procedimiento encadenado está documentado como
pasos manuales en los dos README.

**Master bus (D-21), para entender qué audio llega al mux:** `media-local` aplica siempre un
`alimiter` con `level=disabled` y **1 dB de margen de inter-sample**, lo que garantiza el **true
peak**. Lo que **sigue sin garantizarse** es el **integrado del master** (voz+música, **no
re-normalizado**): queda dentro de la tolerancia y `verifyMixLoudness` lo mide y lo reporta. Un
re-master de dos pasadas sobre el bus completo, si hiciera falta, es de `spec-005`.

**`gainDbToVolume` está duplicada a propósito** entre `src/helpers/audio-gain.ts` (esta lib) y
`libs/media-local/src/mix/gain-db-to-volume.ts`: los mismos boundaries Nx impiden compartirla.
**La tabla de §7.2 de `cycle-01` de `spec-004` es su contrato de paridad** — cualquier cambio en una
obliga a replicarlo en la otra, o el master deja de coincidir con el preview (D-E). Recordar D-J.6:
la paridad se promete para **la curva de ducking de la música**, no para el nivel absoluto de la
voz (el master la normaliza con `loudnorm`; el preview no tiene `loudnorm`).

**Deuda de cobertura que este ciclo dejó a la vista:** `vite.config.ts` mide sólo
`src/helpers/**` y `src/transitions/**`. `src/render.ts` y `src/components/**` están **fuera** del
scope, así que ningún threshold vigila los archivos que más cambian. Fue la causa raíz de que
faltaran los tests de `renderTimeline` para CA-011 sin que nada se pusiera en rojo. Ampliar el
`include` es follow-up de `spec-005`.
