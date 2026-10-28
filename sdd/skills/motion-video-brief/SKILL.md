---
name: motion-video-brief
description: Arma y produce un video de motion graphics (modo B) en Video Maker: decide si corresponde motion o tutorial grabado, escribe el brief (guion + imágenes descriptas), crea el proyecto, revisa el storyboard antes del video y lo renderiza. Usalo cuando se pida un video promocional, reel, presentación de producto o función, explicativo animado o instructivo de un equipo que no necesite la pantalla real. Si hay que repetir clics en una UI real es el modo A, skill screen-recording-tutorial.
---

# Motion graphics (modo B)

El motor arma el storyboard con IA a partir de un catálogo de escenas animadas de la marca, sintetiza la voz,
elige la música, corta al golpe y renderiza. Vos entregás **el qué** (brief), no el cómo. El contrato completo es
`video-maker-material-contract` §12; el catálogo de escenas y las reglas de render están en `motion-studio`.

## Modo A o B

Si el espectador tiene que **repetir** un flujo de la UI clic por clic → modo A (`screen-recording-tutorial`).
Si se **presenta** algo (producto, función, equipo, promo, reel) y alcanza con entender la idea → B. Si no queda
claro, preguntar con las dos opciones y esperar; no elegir por el usuario. Un tema puede tener los dos.

## Paquete del brief

- **Guion** (`brief.script`): texto plano, como se va a decir. ~2,5 palabras por segundo.

  | Destino | `format` | Duración | Palabras |
  | --- | --- | --- | --- |
  | YouTube / web (promo, explicativo) | `16:9` | 45–75 s | 120–180 |
  | Instructivo de un equipo | `16:9` | hasta ~2 min | hasta ~300 |
  | Reels / TikTok / Shorts | `9:16` | 25–40 s | 60–100 |
  | Stories o anuncio corto | `9:16` | 15–25 s | 40–60 |

  El motor pide entre 6 y 12 escenas: un guion de una o dos frases no alcanza.
- **Fuente funcional:** la documentación del producto. Nunca se inventa una función, un precio ni un plazo; cada
  afirmación se puede apuntar a una línea de la fuente.
- **Estilo:** registro y voseo del usuario, frases cortas, una idea por frase, abrir con una pregunta o un dolor y
  cerrar con una acción. La marca con contexto y **nunca al principio ni al final de una línea** (la voz
  sintética la pronuncia mal); números como se dicen. Si la voz lee mal un nombre, se escribe fonético en la voz.
- **Idioma:** el texto del video conserva tildes y eñes. Sólo los nombres de archivo y los ids van en ASCII.
- **Imágenes** (0–12, jpg/png/webp, ≥ 1280 px del lado largo, en `raw/images/`): cada una con `caption` de **una
  línea que diga qué se ve** (la IA no ve las fotos, elige por la descripción). Nombres de archivo en
  minúsculas ASCII sin espacios. Antes de subirlas hay que **mirarlas**: nada de datos de clientes, correos,
  credenciales ni marcas ajenas, y nada que no tenga que ver con el tema.
- **Marca:** `GET /motion/brands` antes de armar el brief; `brand` debe estar instalada.

## Producir

```bash
API=http://127.0.0.1:4399
curl -sS -X POST $API/projects -H 'content-type: application/json' -d '{"slug":"<slug>","mode":"motion"}'
curl -sS -X PUT "$API/projects/<slug>/assets/image/<archivo>" -H 'content-type: image/jpeg' --data-binary @<archivo>
curl -sS -X PUT "$API/projects/<slug>/motion/brief" -H 'content-type: application/json' --data-binary @brief.json
curl -sS -X POST $API/projects/<slug>/jobs -H 'content-type: application/json' -d '{"kind":"motion","phase":"storyboard"}'
curl -sS $API/projects/<slug>/motion/storyboard
curl -sS -X POST $API/projects/<slug>/jobs -H 'content-type: application/json' -d '{"kind":"motion","phase":"video","output":"video.mp4"}'
```

1. **Revisar el storyboard antes del video**: que respete el guion, que ninguna escena invente una función y que
   las imágenes caigan donde corresponde. Es la única vez que corregir sale barato (corregir `brief.json` o el
   storyboard y rehacer con `"overwrite": true`).
2. El storyboard tarda unos 3–6 minutos; el video, ~30 s por línea de voz + ~2,5 min por minuto de video.
3. Re-edición: el job regenera `script.json` desde el storyboard del studio (`GET/PUT /projects/<slug>/motion/storyboard`),
   así que se edita **ese**; una captura reemplazada con el mismo nombre conserva sus cajas viejas: dale un
   nombre nuevo.
4. Errores: tabla en contrato §12.5. `AI_AGENT_INVALID_OUTPUT` ya no se produce por el JSON en `result`
   (FIX-e-burgos-036); si reaparece, mostrar el `result` literal y reintentar, no reducir el brief.

## Al entregar

- Decir duración, formato y en qué pantalla está el video (`vista previa` y `motion`).
- La música de la marca es CC BY: el crédito queda en `out/<video>.credits.txt` y **va en la descripción** de
  cada publicación.
- Medir voz y música por separado antes de publicar (música ≥15 dB bajo la voz); el máster no lo garantiza.
- No inventar que se revisó lo que no se revisó: mirar un contact sheet escena por escena y listar lo que sigue mal.
