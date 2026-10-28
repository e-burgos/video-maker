---
name: screen-recording-tutorial
description: Graba la UI real de una app (web, panel, landing) con Playwright y deja en media/<slug>/ el material crudo que Video Maker convierte en un tutorial — A-roll mudo 1080p@30 + guion cronometrado por hitos. Es el modo A (tutorial grabado): para quien mira y después tiene que repetir un flujo real clic por clic. Usalo cuando se pida un tutorial, screencast, "cómo se hace X en la app" o grabar la pantalla de un producto. Para presentar un producto sin pantalla real (promo, reel, explicativo animado) es el modo B, skill motion-video-brief.
---

# Tutorial grabado (modo A)

Este skill produce **material crudo, no el video final**. El A-roll mudo y el guion cronometrado caen en
`media/<slug>/` y el motor de Video Maker pone voz, subtítulos, logo, música y render (receta "Tutorial" del
skill `video-producer`; contrato de material en `video-maker-material-contract` §1–§11).

## Modo A o modo B

| Si el video… | Modo |
| --- | --- |
| lo mira alguien que **tiene que repetir** un flujo real de la UI | **A — este skill** |
| **presenta** un producto, función, equipo o promo y alcanza con entender la idea | **B — `motion-video-brief`** |

Orden de decisión: 1) ¿hay que repetir clics en una UI real? → A. 2) ¿se vende o presenta algo sin necesitar la
pantalla real? → B. 3) Si no queda claro, **preguntarle al usuario con las dos opciones** y esperar. Un mismo tema
puede tener los dos (promo en B, tutorial en A): son dos proyectos.

## Qué se entrega

```
media/<slug>/
├── raw/aroll/<slug>.mp4          1920×1080 (o 1080×1920), 30 fps, H.264 yuv420p, SIN audio
├── work/producer/script.txt      una frase por línea con marca [m:ss] del A-roll
└── work/producer/hitos.json      hitos con tiempo real, sesión, formato y resultado verificado
```

El slug es kebab-case ASCII (`^[a-z0-9]+(-[a-z0-9]+)*$`). El studio importa las carpetas de `media/` al
arrancar: un proyecto nuevo aparece tras reiniciarlo.

## Antes de grabar

1. **Qué flujo.** Un objetivo por video ("crear una campaña" y "asignarla" son dos videos). La fuente del guion es
   la documentación del producto: no se inventa lo que la UI hace.
2. **Entorno.** Si el flujo crea, paga, borra o da de baja, se graba contra un entorno local o de prueba, nunca
   contra producción con datos reales. Lo creado se anota en el informe.
3. **Login fuera de cámara.** Si la app pide ingreso, `abrirGrabacion({ iniciarSesion })` lo hace en un contexto
   sin grabar y el A-roll arranca ya adentro. Credenciales de entorno o `.env`, nunca en el código ni en el chat.
4. **Datos presentables.** Nada de datos de clientes, correos, claves ni marcas ajenas en pantalla: se enmascaran
   en el flujo (ver `ocultarSecretos` en `estudio-video-maker.mjs`) o se siembra una cuenta de demo.
5. **Formato.** Tutoriales 16:9 (`youtube-16x9`, default). Un reel/short es **otra grabación vertical**
   (`reels-9x16`, viewport de teléfono a 2x), nunca un recorte.

## Procedimiento

1. **Mapear la UI en código, todo junto**, antes del primer ensayo (`grep` sobre los componentes: `aria-label`,
   `title`, textos de botones). Ojo: el texto visible puede venir en minúsculas desde CSS; el nombre accesible es
   el del DOM, así que los selectores van con `/…/i`.
2. **Un solo ensayo** que recorra todo el flujo, imprima qué encontró (`count()`, visible) y cierre sin guardar.
   Sale a un `destino` temporal (`DESTINO=/tmp/ensayo`), no a `media/`.
3. **Escribir el flujo** copiando `scripts/flujos/_plantilla.mjs`. Un `hito()` por escena, en el momento en que
   empieza; su frase va en `NARRACION`, 1:1 y en el mismo orden. `ventana(n)` deja pasar `palabras/2,5 + 0,6` s para
   que la voz entre. Cursor humano (`clic`, `escribir`, `irA`); nunca `fill()` ni `mouse.move` lineal.
4. **Verificar el efecto, no la ausencia de error.** Con `apiUrl` en `abrirGrabacion`, `apiJson` guarda las
   respuestas de la API: el flujo confirma ahí que lo creado existe y lo deja en `resultado`.
5. **Grabar** (toma definitiva) y **mirar frames** (`extraerFrames`): primero, el momento clave y el último.
6. **Rehacer sólo un tramo** si falla: segunda toma desde el mismo estado con un `hito('CORTE')`, y unir con
   `unirTomas()` + `escribirGuion()`.
7. **Producir** con Video Maker: el A-roll se respeta, la voz sale del `script.txt` con las marcas, y el cierre
   `fraseDespedida` deja ~6,5 s de pantalla quieta para el bumper con el logo.

```bash
PLAYWRIGHT_CHROMIUM_PATH=<chromium ya instalado, opcional> \
STUDIO_URL=http://localhost:4407 node sdd/skills/screen-recording-tutorial/scripts/flujos/estudio-video-maker.mjs
```

`@playwright/test` es devDependency del repo. Sin `PLAYWRIGHT_CHROMIUM_PATH`, Playwright usa su propio navegador
(`pnpm exec playwright install chromium` si falta).

## Reglas de guion

- Rioplatense, voseo, una idea por frase, ~2,5 palabras por segundo, abrir con una pregunta o un dolor concreto y
  cerrar con una acción. Sin URLs ni siglas deletreadas en la narración.
- La marca nunca al principio ni al final de una línea (la voz sintética la pronuncia mal); números como se dicen.
- Si el ritmo de la UI no alcanza para la frase, se alarga la pausa (`aire`), no se acelera la voz.

## Grabar es una sesión de QA

Si al grabar aparece algo que no debería (un dato mal dibujado, un error en cámara, un texto que miente), **no se
esquiva el encuadre**: se para, se reporta y se arregla por fix antes de dar el video por bueno. Lo que el video
muestra es documentación.

## Lecciones de costo

Ver `references/lecciones-costo.md`: un solo ensayo completo, timeouts cortos, verificar contenido y no sólo
presencia, y un presupuesto de ~45 min por tutorial.

## Cierre (checklist)

- [ ] A-roll `1920×1080 · 30 fps · yuv420p · sin audio`, arranca adentro y con datos presentables
- [ ] `script.txt` con una frase por hito y marcas `[m:ss]` crecientes dentro del A-roll
- [ ] Efecto del flujo verificado y guardado en `hitos.json → resultado`
- [ ] Frames revisados (primero, clave, último)
- [ ] `informeCierre` pegado al entregar: archivos, guion, conceptos y qué faltó
