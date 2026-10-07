# Functional — Cycle 4: Motion Mode (studio-motion)

> **Input:** sdd/specs/spec-e-burgos-020-motion-mode/cycles/cycle-04/brief.yaml
> **Generado por:** sdd-functional (actor único)

## Contexto de negocio

Las cycles 02-03 dejaron el modo motion andando por CLI. Quien usa el estudio (en el navegador o en la app
de escritorio) no abre una terminal: el modo tiene que aparecer en el mismo lugar donde hoy se crea un
proyecto, y el video tiene que salir con un par de clics o pidiéndoselo al productor.

## Historias

- **HU-01 — Elegir el camino al crear.** Como quien produce, al crear un proyecto elijo "Motion graphics"
  (guion e imágenes) o "Material crudo" (grabaciones).
  - CA-01: `POST /projects {slug, mode}` guarda el modo; sin `mode` es `footage`. Los proyectos que ya
    existían quedan `footage` (migración v4).
  - CA-02: la lista de proyectos muestra el modo de cada uno y un proyecto motion abre su página Motion.
- **HU-02 — Escribir el brief.** CA-03: en la página Motion elijo marca, formato (16:9 / 9:16), música
  (automática, un tema de la marca o ninguna), golpes, objetivo, público y guion; subo imágenes y les escribo
  qué muestran. El brief se guarda en el proyecto y se valida contra `MotionBrief` con el campo que falla.
- **HU-03 — Storyboard y video.** CA-04: "Armar storyboard" corre la IA (job `motion` fase `storyboard`) y
  muestra las escenas (tipo y voz) con tokens y costo. CA-05: "Hacer video" (fase `video`) sintetiza la voz,
  planifica, compone y renderiza, con progreso por etapa, y deja el MP4 en `out/` con su reproductor.
  CA-06: sin storyboard, "Hacer video" corre las dos fases (`all`).
- **HU-04 — El productor sabe del modo.** CA-07: en un proyecto motion el productor escribe el brief desde
  la conversación, arma el storyboard, lo resume y hace el video con `start_job {kind: "motion"}`.
- **HU-05 — Corre en la app de escritorio.** CA-08: la app instalada hace un video motion sin `npx` ni
  Node del sistema: HyperFrames y los assets viajan en la app y el render usa su chrome-headless-shell.
- **HU-06 — Vertical.** CA-09: un brief 9:16 sale bien de punta a punta (cuadros revisados: nada cortado ni
  superpuesto).
