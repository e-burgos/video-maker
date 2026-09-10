# spec-e-burgos-014-production-quality cycle-01 — 2026-09-10

## Qué pasó

El dev reportó tres defectos del primer video entregado a un cliente real, con 8 proyectos en
verde y ~2 900 tests pasando. Los tres eran invisibles para la suite:

1. **La música no se escuchaba.** Dos causas encadenadas. La primera, la de siempre: el
   consumidor real del nivel de música es `audioMix.automation`, y `buildTimeline` lo derivaba de
   `DEFAULT_MUSIC_MIX` hardcodeado — los cuatro presets tenían un bloque `audio` con
   `baseGainDb`/`duckedGainDb` que **nadie leía** para la Timeline (sólo el `gainDb` de las
   decisiones `duck` del EDL, que es decorativo). Cambiar el preset habría sido un no-op silencioso
   con todo en verde. La segunda: nada normalizaba la pista, así que el nivel final dependía de lo
   fuerte que viniera el MP3 del usuario (-22,3 LUFS en este caso → cama a -47,5 LUFS medidos).
2. **El oráculo de no-regresión que traía el pedido estaba obsoleto.** El sha256 de
   `video-muted.mp4` venía de `spec-006 cycle-03`, pero un fix posterior
   (`FIX-e-burgos-003-001`) cambió a propósito el layout de las captions y el proyecto se
   replanificó (556 → 538 frames). Renderizar y comparar contra ese hash habría dado "regresión"
   donde no la había. Se resolvió creando un `git worktree` en el commit base con `node_modules`
   simbolicado y renderizando **la misma** `work/timeline.json` con el código viejo: mismo sha256,
   no-regresión real.
3. **Medir con `ebur128` y quedarse con el primer match del regex da -70 LUFS siempre.** El filtro
   imprime una línea por frame (`t: ... I: -70 LUFS` mientras el gate no abrió) antes del bloque
   `Summary:`. Las tres mediciones dieron exactamente el mismo número absurdo y sólo se notó
   porque el valor no cambiaba entre pistas obviamente distintas.

## Lección

- Un campo de configuración que nadie lee es peor que uno ausente: antes de tocar un preset,
  `grep` el campo y confirmar que llega al artefacto que lo consume.
- Un oráculo byte-exacto heredado de otro ciclo hay que **reproducirlo con el código base** antes
  de usarlo como criterio; si no reproduce, el baseline es un worktree del commit anterior.
- Parsear la salida de una herramienta de medición siempre desde su bloque de resumen, y sospechar
  de inmediato cuando dos entradas distintas dan el mismo número.

## Costo evitable

~15 min en la falsa alarma del sha256 y ~5 min en la medición envenenada. Los dos se habrían
evitado con la misma regla: probar el instrumento antes de creerle. El worktree con
`ln -s $REPO/node_modules` resultó barato (30 s de setup) y es la forma reproducible de tener el
baseline sin tocar el árbol de trabajo.
