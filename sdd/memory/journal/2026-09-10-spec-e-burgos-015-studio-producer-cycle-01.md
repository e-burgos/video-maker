# spec-e-burgos-015-studio-producer cycle-01 — 2026-09-10

## Qué pasó

Montar la skill `video-producer` como proceso `claude -p` headless detrás de `render-api` costó
**tres corridas completas del smoke real** —no una— porque `--allowedTools` no hace lo que dice el
`--help` en tres puntos distintos, y cada uno sólo apareció ejecutando de verdad:

1. Un patrón de ruta **no confina una escritura**: `--allowedTools 'Write(allowed/**)'` denegó una
   escritura del agente con path absoluto adentro de `allowed/`.
2. Un comodín **nunca autoriza un comando de shell que muta archivos**: en la misma corrida,
   `Bash(ls *)` dejó pasar `ls -la` y `Bash(mkdir *)` / `Bash(cp *)` denegaron `mkdir uno` y
   `cp /etc/hosts ./hosts.txt`. Dos entradas de la lista blanca eran letra muerta.
3. El **hook `rtk` del propio repo reescribe el comando antes de que la lista blanca lo mire**:
   como el hijo corre con cwd en la raíz del repo, `.claude/settings.json` le aplica su `PreToolUse`
   y `curl …` llega como `rtk curl …`, `cat X` como `rtk read X`, `ls` como `rtk ls`. Ninguno
   matchea su patrón original y los tres quedan denegados; `ffprobe`, `ffmpeg` y `pnpm nx` pasan
   intactos, que es justo lo que hacía parecer que la lista "funcionaba a medias".

Además, matar el proceso del servicio **no** mataba al hijo `claude` en curso: un agente huérfano
de una corrida anterior siguió escribiendo dentro de la copia temporal del smoke y contaminó la
siguiente medición con un `out/demo-01.mp4` que nadie de esa corrida había producido. Se descubrió
comparando `ls -laT` contra la ventana temporal del turno, no leyendo la salida del turno.

## Lección

Sondear cada permiso de un agente externo con el comando real que se le va a permitir —uno por
clase de efecto (leer, escribir, red, binario propio)— antes de escribir la lista blanca, y liberar
el proceso hijo al cerrar el servicio: un huérfano sigue escribiendo en el mismo directorio y
contamina la corrida siguiente.

## Costo evitable

Dos corridas completas del smoke con Claude real (~10 min de reloj y cuota de suscripción cada una)
y una tercera contaminada. Una sonda de 4 comandos en un directorio temporal —la que finalmente
respondió las tres preguntas— cuesta menos de un minuto y no consume el proyecto de prueba.
