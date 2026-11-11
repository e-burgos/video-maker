# FIX-e-burgos-070 — La vista previa del studio suena con los efectos de los bumpers

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-070 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
Los efectos de los bumpers (FIX-e-burgos-057/060) solo se mezclan en el máster que arma render-api. En la vista previa del studio (Remotion Player) los bumpers se veían mudos, así que el usuario no escuchaba lo que iba a salir en el video.

## Solución
- **composition-remotion.** `TimelineComposition` acepta `bumperSfx` (cues `{ src, atMs, durationMs, volume }`) y los reproduce con `BumperSfxTrack` solo cuando el audio no está muteado. Los renders de render-api y render-cli van siempre con `audio: 'muted'` y no pasan `bumperSfx`, así que el efecto nunca se duplica en el máster.
- **web.** `previewBumperSfx` arma los cues con la misma lógica que la mezcla:
  - `planBumperSfx` define qué suena y cuándo;
  - la variante sale de la misma semilla `${seed}:${edge}:${index}`, sin repetir las ya usadas;
  - la ganancia relativa al target de voz se pasa a volumen lineal.
- **Banco empaquetado.** La web empaqueta el banco con Vite (`import.meta.glob`, 18 archivos, unos 780 KB) y no depende de una ruta nueva de render-api. `TimelinePlayer` le pasa los cues a la composición.
- **Paridad.** La elección de variante está replicada en la web porque importar `motion-graphics` hace que la web typechequee toda la lib. Un test fija la paridad con valores medidos con el `pickSfxVariant` real.

## Verificación
- `nx test`, `lint` y `build` en verde: composition-remotion 380, web 1657.
- Tests:
  - la pista solo existe con audio y con cues; el render muteado nunca la incluye;
  - los cues del intro, el outro y el remate salen con url, momento y volumen;
  - la elección de variante coincide con la de la mezcla.
- Sin verificar de oído en el navegador (la vista previa no se probó con audio real).
