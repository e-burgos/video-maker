# Functional — Cycle 3: Motion Mode (auto-storyboard)

> **Input:** sdd/specs/spec-e-burgos-020-motion-mode/cycles/cycle-03/brief.yaml
> **Generado por:** sdd-functional (actor único)

## Contexto de negocio

Con la cycle-02 un video de motion graphics se describe sin código, pero alguien tiene que elegir las
escenas. El pedido del dueño es que "con un buen guion e imágenes" el Video Maker haga el resto. Este ciclo
pone a la IA a elegir y completar escenas del catálogo, con las mismas reglas que se aplicaron a mano.

## Historias

- **HU-01 — Del guion al storyboard.** Como quien produce, quiero dar un guion, imágenes con su descripción y
  la marca, y recibir un storyboard listo para renderizar.
  - CA-01: `motion-studio auto <brief.json> <proyecto>` escribe `storyboard.json` válido y deja el proyecto
    compuesto (`index.html.tpl` + `script.json`) con las imágenes del brief copiadas.
  - CA-02: la voz de cada escena sale del guion (puede partirlo o ajustar su redacción para la voz) y los
    `cue` son palabras de esa voz.
- **HU-02 — Lo que pido se respeta.** CA-03: marca, formato, golpes y música fijados en el brief se imponen
  sobre la respuesta; con `music: "auto"` la IA elige un tema de la marca.
- **HU-03 — Errores claros.** CA-04: si la respuesta no cumple el contrato o la verificación cruzada (imagen
  no listada, equipo inexistente, cue ausente, tema inexistente), se reintenta una vez con los errores por
  campo; si vuelve a fallar, el comando falla nombrando escena y campo.
- **HU-04 — Costo visible.** CA-05: el comando informa tokens de entrada/salida y costo si el proveedor lo da.
- **HU-05 — Prueba real.** CA-06: un guion nuevo de DisplayAds se convierte en video con el comando, sin
  editar el storyboard a mano.
