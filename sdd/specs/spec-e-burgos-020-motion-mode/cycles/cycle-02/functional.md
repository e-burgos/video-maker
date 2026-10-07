# Functional — Cycle 2: Motion Mode (scene-catalog)

> **Input:** sdd/specs/spec-e-burgos-020-motion-mode/cycles/cycle-02/brief.yaml
> **Generado por:** sdd-functional (actor único, perfil solo)

## Contexto de negocio

Los videos de la spec-019 salieron bien porque cada escena se escribió a mano. Para que el Video Maker los
haga solo, la pieza que falta es un vocabulario de escenas que una persona —o la IA del ciclo siguiente—
pueda elegir y completar con textos e imágenes, sin tocar código. Este ciclo construye ese vocabulario y
prueba que alcanza: los tres videos existentes se vuelven a hacer describiendo solo sus escenas.

## Historias

- **HU-01 — Describir un video sin código.** Como quien produce, quiero escribir un storyboard (escenas del
  catálogo con su voz y sus campos) y obtener un video con la marca, voz, música y cortes al golpe.
  - CA-01: `motion-studio storyboard <proyecto>` convierte `storyboard.json` en `index.html.tpl` + `script.json`;
    `voice → plan → compose → render` produce el MP4 sin pasos manuales.
  - CA-02: un storyboard con un tipo de escena inexistente, un campo faltante o una imagen que no existe se
    rechaza nombrando la escena y el campo.
- **HU-02 — Un catálogo que cubre lo que ya hicimos.** Como dueño de la marca, quiero que la presentación y los
  dos instructivos se puedan expresar solo con escenas del catálogo.
  - CA-03: existen `presentacion`, `counter-15` y `core-pro` como storyboards y se renderizan a 1080p30 con
    `hyperframes lint` sin errores y cuadros revisados.
- **HU-03 — La marca aparte.** Como quien produce para otro cliente, quiero cambiar de marca sin tocar el catálogo.
  - CA-04: la marca se elige con `brand` en el storyboard y vive en `assets/brands/<marca>/brand.json`; el
    catálogo no contiene colores ni logos de DisplayAds.
- **HU-04 — Nada se rompe.** CA-05: los tests que tenía Motion Studio siguen pasando desde la lib y la CLI sigue
  armando las plantillas a mano de la spec-019.
