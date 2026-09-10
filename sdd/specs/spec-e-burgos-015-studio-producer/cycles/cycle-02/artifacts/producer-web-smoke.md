# E2E real del productor desde el navegador — spec-015 cycle-02

> Corrida del 2026-09-10, 22:04–22:17 UTC. `node apps/web/e2e/producer-smoke.mjs`.
> Log completo y literal: `producer-web-smoke.log` (guion: `apps/web/e2e/producer-smoke.mjs`).

## Montaje de la prueba

- **Copia temporal de `media/demo-01`**: sólo `raw/` y `work/producer/` (sin `out/`, sin
  `catalog.json`, sin `timeline.json`). El `raw/` del dev nunca se toca.
- `apps/render-api` en 4398 contra esa copia (`PRODUCER_MODEL=sonnet`), `apps/web` en 4210 con su
  proxy apuntado ahí. Primera aserción: `capabilities.producer === true` — es lo que prueba que se
  habla con el build bajo prueba y no con un servidor viejo en otro puerto.
- Gate de memoria antes de arrancar: sin `ffmpeg`/`whisper-cli`/`piper`/`chrome-headless` vivos,
  sin `claude -p` huérfano y 48 % de memoria libre.

## Resultado literal

| Paso | Qué se verificó | Resultado |
| --- | --- | --- |
| 4 | El listado de proyectos abre en el productor | `http://localhost:4210/projects/demo-01/producer` |
| 4 | Inventario real en el estado vacío | `aroll · 1  broll · 3  image · 8  audio · 1  logo · 1` |
| 5 | Turno 1 (`Contame qué material hay y proponeme un video de 30 segundos, sin nombrar la marca.`) | **147,3 s · 29 eventos · 4 sugerencias · `succeeded`** |
| 5 | Eventos en vivo a los 12 s | la UI ya mostraba pasos del agente |
| 5 | Chips en pantalla | `["Dale, producí este video","Cambiá el tono del guion","Usá otro preset","Ajustá el guion"]` |
| 6 | Turno 2, disparado con **clic en la chip** "Dale, producí este video" | **442,0 s · 54 eventos · `succeeded`** |
| 6 | Jobs que el agente encoló en esta misma API | `montage:succeeded` (etapas hasta `plan`) y `render:succeeded` (etapas hasta `verify`) |
| 7 | MP4 entregado, medido con `ffprobe` | `out/047f5e6b-…-adce83cd347f.mp4` — **1080x1920 · 778 frames @ 30/1 · audio aac 48000 Hz** (17,3 MB) |
| 8 | Preview refrescado sin recargar a mano | `1 a-roll · 3 b-roll · 1 voice · 1 music · 28 captions` |
| 9 | Logo apagado desde la UI | `work/timeline.json` en disco: `logo=undefined` |
| 9 | Logo encendido en `bottom-right` | `{"assetId":"raw/logo/Logo-ancho-transparente.png","position":"bottom-right","widthRatio":0.32,"marginRatio":0.035,"opacity":1}` y el asset dentro de `timeline.assets` |
| 10 | Cancelación de un tercer turno desde la UI | `data-status="canceled"` en pantalla y **cero procesos `claude` vivos** |

El turno 2 hizo el trabajo completo: escribió `work/producer/plan.md` y `script.txt`, encoló el
`montage`, esperó su resultado, encoló el `render` y verificó el entregable (`-14.19 LUFS`). La
conversación tal cual quedó en disco está en `producer-web-smoke-conversation.md` y la Timeline
producida en `producer-web-smoke-timeline.json`.

## Capturas

| Archivo | Qué muestra |
| --- | --- |
| `producer-smoke-01-empty-state.png` | Estado vacío con el inventario real y las sugerencias iniciales |
| `producer-smoke-02-turn-running.png` | Turno corriendo: eventos en vivo y botón Cancel |
| `producer-smoke-03-answer-and-chips.png` | Respuesta del productor con sus cuatro chips |
| `producer-smoke-04-turn-two-done.png` | Turno 2 cerrado con el video entregado |
| `producer-smoke-05-preview.png` | Preview con la Timeline que el productor construyó |
| `producer-smoke-06-logo.png` | **Byte-idéntica a la 05 a propósito**: el montaje ya traía `logo: auto` en `bottom-right`, así que el estado final del panel coincide con el inicial. La prueba del toggle es la de disco (paso 9) y las capturas 08–10. |
| `producer-smoke-07-canceled.png` | Turno cancelado en pantalla |
| `producer-smoke-08-logo-off.png` | Panel del logo con el check apagado |
| `producer-smoke-09-logo-top-left.png` | Panel con el logo encendido en `top-left` |
| `producer-smoke-10-player-logo-top-left.png` | El `<Player>` dibujando el logo movido a la esquina superior izquierda |
| `producer-smoke-11-rich-markdown.png` | La conversación real con tablas, encabezados, bloques de código y reglas renderizados |

Las capturas 08–11 las produce `capture-logo-and-markdown.mjs` (committeado acá) sobre la **misma
copia temporal ya producida**: no gasta un solo token porque no dispara ningún turno.

## Defecto de producto encontrado por la captura y corregido en el ciclo

La captura `03` mostró que el productor contesta con **tablas markdown, encabezados `##`, reglas
`---` y bloques de código**, y que la primera versión del renderer los imprimía crudos (una pared de
pipes). Se extendió `producer-markdown.ts` con encabezados, reglas, bloques cercados, tablas y
código inline, con sus tests, y se verificó sobre la conversación real: **2 tablas, 2 bloques de
código y 2 reglas** renderizados (captura `11`). Sigue sin agregarse ninguna dependencia npm.

## Un defecto del agente que la UI expuso bien

Los eventos 3–6 del turno 2 fueron `Write work/producer/plan.md` → `tool-failed` y
`Write work/producer/script.txt` → `tool-failed`: como el smoke copia `work/producer/` de `demo-01`,
esos archivos ya existían y Claude Code exige leer antes de sobrescribir. El agente se recuperó solo
(los leyó y siguió), y el usuario **vio** los dos fallos en el feed de actividad, que es exactamente
para lo que está.
