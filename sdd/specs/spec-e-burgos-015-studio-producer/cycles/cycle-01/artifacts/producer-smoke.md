# Smoke real del productor — `claude -p` contra una copia de `media/demo-01`

2026-09-10. Binario real (`claude` 2.1.123, modelo `sonnet`), **sin API key**: la suscripción de la
máquina. Ninguna parte de la suite automática toca `claude`, la red ni un binario de medios.

## Montaje

Copia temporal fuera del repo con `raw/` y `work/producer/` de `media/demo-01` (sin `out/`, sin
`catalog.json`, sin `timeline.json`, sin `conversation.json` ni `session.json`):

```bash
set -a && source .env && set +a
SWC_NODE_PROJECT=tsconfig.base.json RENDER_API_PORT=4399 \
RENDER_API_MEDIA_ROOT=<tmp>/smoke-media RENDER_API_URL=http://127.0.0.1:4399 PRODUCER_MODEL=sonnet \
node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts
```

Gate previo: `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless|piper'` vacío, 52 % de memoria libre,
81 GB de disco.

`GET /health` → `status: "ok"`, `capabilities: {..., "producer": true}`, `jobs: {running:0,queued:0}`.

## Turno 1 — inventario y propuesta

`POST /projects/demo-01/producer/messages` → `202 {"slug":"demo-01","turnId":"519f4cb8-…","startedAt":"2026-09-10T19:31:40.976Z","status":"running"}`

> "Contame qué material hay y proponeme un video de 30 segundos para esta óptica, sin nombrar la marca"

- **224,3 s**, `succeeded`, **44 eventos**, 1 herramienta denegada.
- Herramientas: 6 × `ffprobe` (A-roll, tres B-roll, música), 5 × `ffmpeg` extrayendo frames a
  `work/producer/frames/`, `Write`, `ls`, y 11 × `Read` de las imágenes y de los frames — el agente
  **mira** el material antes de escribir el guion, que es lo que pide la skill.
- Respuesta: inventario tabla por asset con lo que muestra cada uno, propuesta de reel 9:16 de 30 s,
  guion de 8-9 frases con tres conceptos repetidos (`lentes`, `estilo`, `mirada`) y tres preguntas
  numeradas antes de producir.
- `suggestions`: `["Tiene música de fondo, poné voz Piper", "Tiene voz propia, usala tal cual", "Cambiá el guion, tengo ideas", "Dale, avanzá con la propuesta"]`
- Persistencia: `conversation.json` con los dos mensajes, `conversation.md` en el formato de
  viñetas escrito a mano, `session.json` con el `sessionId` que reportó el CLI y
  `turns/519f4cb8-….jsonl` con el stream crudo.

Registro completo: `producer-smoke-turn-01.json`.

## Turno 2 — producción de punta a punta

> "Dale, avanzá con tu propuesta usando voz generada y la música que ya hay"

- **501,4 s**, `succeeded`, **70 eventos**, 6 herramientas denegadas.
- Retomó la sesión (`--resume`): arrancó escribiendo el guion sin volver a preguntar.
- Secuencia real: `Write work/producer/script.txt` + nueve `Write work/producer/lines/NN.txt` →
  Piper por línea → concatenación con `ffmpeg` → `curl http://127.0.0.1:4399/health` →
  **`POST /projects/demo-01/jobs` `montage`** → polling → **`POST … render`** → polling →
  `ffprobe` del entregable → tres frames con `ffmpeg` → `Read` de los tres frames antes de entregar.
- **Los dos jobs quedaron registrados en la cola de la API**: `GET /projects/demo-01/jobs` →
  `montage succeeded (plan)` y `render succeeded (verify)`. El turno **no** aparece en esa lista:
  corre fuera de la cola (D-1).
- Entregable: `out/c4832fe2-8d37-496d-b452-921ddeaffbd5.mp4`, 18 145 810 bytes.
  `ffprobe` del **stream de video**: `codec_name=h264`, `1080x1920`, `r_frame_rate=30/1`,
  `nb_frames=778` (25,9 s); audio `aac` 48 000 Hz. Loudness reportado por el job: **-14,2 LUFS**.
- `suggestions`: `["Quiero la variante seed 1", "Probá preset educational", "Hacé una versión de 20s", "Está perfecto, gracias"]`

Registro completo: `producer-smoke-turn-02.json`.

> En los dos registros guardados, los `summary` de los `curl` de **polling** dicen
> `queued render job`: la heurística marcaba como "encolado" cualquier comando que mencionara
> `/jobs`. Se corrigió después del smoke (ahora exige `-X POST`), igual que el entrecomillado de
> las rutas que el agente cita (`ffprobe "/…"`). Los artefactos quedan tal como salieron.

## Exclusión y cancelación

- `POST` de un segundo mensaje con el turno 2 en curso →
  `409 {"error":{"code":"PRODUCER_TURN_ACTIVE","resource":"<turnId en curso>","hint":"wait for the running turn to finish or cancel it"}}`.
- Turno 3 lanzado a propósito para cortarlo: `DELETE /projects/demo-01/producer/turns/9494f0eb-…`
  → **202** con el registro todavía en `running`; 12 s después `GET` → `status: "canceled"`,
  `error: null`, `assistantMessage: null`. **Cero procesos `claude` vivos** después
  (`ps | grep append-system-prompt` → 0). Un segundo `DELETE` →
  `409 PRODUCER_TURN_NOT_CANCELABLE`.

## Lo que el smoke encontró y se arregló en el ciclo

1. **Comandos compuestos.** El agente arrancaba los `ffprobe` con `BASE="…" ffprobe …`, que no
   matchea ningún patrón: cuatro denegaciones seguidas y cero `ffprobe` en el primer intento. El
   prompt ahora exige un comando por llamada, empezando por el binario.
2. **`Bash(mkdir *)` y `Bash(cp *)` eran letra muerta.** Sonda directa contra el CLI, misma corrida
   y misma sintaxis: `ls -la` permitido, `mkdir uno` y `cp /etc/hosts ./hosts.txt` denegados. Se
   sacaron de la lista y el prompt manda usar `Write` (crea los directorios padre) y
   `ffmpeg -i src -c copy dst`.
3. **El hook `rtk` del repo reescribe el comando antes de la lista blanca.** `curl …` llega como
   `rtk curl …` y queda denegado. Se agregaron `Bash(rtk curl *)`, `Bash(rtk ls *)` y
   `Bash(rtk read *)`.
4. **El agente intentó `cat .env`.** El prompt ahora prohíbe explícitamente leer, abrir o imprimir
   ese archivo: las variables ya viajan en el entorno del hijo.
5. **Matar el servicio dejaba vivo al hijo.** Un agente huérfano de una corrida anterior siguió
   escribiendo en la copia temporal y contaminó la medición siguiente con un `out/demo-01.mp4` que
   nadie de esa corrida produjo. `close()` del servidor ahora cancela todos los turnos vivos.

## Lo que sigue abierto

- Quedan 6 denegaciones por turno: el agente todavía intenta redirecciones (`ffmpeg … 2>/dev/null`)
  y encadenados. Se recupera solo, pero cuesta turnos. La solución de fondo es una herramienta
  propia del studio en vez de `Bash`.
- El agente escribe archivos auxiliares dentro del proyecto (`work/producer/frames/`,
  `work/producer/lines/`) sin limpiarlos.
