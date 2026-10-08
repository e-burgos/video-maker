# cycle-04 — verificación punta a punta

Con `pnpm studio` y la API real (2026-10-08), marca de prueba **Cafe Aroma** (logo SVG provisorio, Playfair Display,
paleta marrón/ámbar, voz es_AR-daniela-high 1,08):

1. `POST /projects {slug: cafe-aroma-crudo, mode: footage, brand: cafe-aroma}` → `raw/logo/brand-cafe-aroma.png`
   rasterizado (PNG con alfa), 4 fuentes en `work/brand/fonts/`, `captionTheme` en el detalle.
2. Subida de una grabación de pantalla muda de 45 s como aroll.
3. Job `voice` con `scriptText` y `voiceId: null` → usó `es_AR-daniela-high` (la de la marca), pista de 10,2 s.
4. Job `montage {voice: script, captionStyle: brand, logo: auto}` → timeline con `captionStyle: brand`, `captionTheme`
   de la marca, logo `raw/logo/brand-cafe-aroma.png` abajo a la derecha, 13 captions.
5. Job `render` → MP4 1080×1920, 306 cuadros, loudness dentro de tolerancia. Cuadros revisados
   (`cafe-aroma-crudo-sheet.jpg`): subtítulos en Playfair Display, palabra destacada en ámbar, cajas marrón.
6. Smoke real del rasterizador (`apply-project-brand.real.spec.ts`): wordmark SVG → PNG 1600×350 RGBA con fondo
   transparente.

Observaciones: el logo provisorio (texto blanco) casi no se ve sobre grabaciones claras — con el logo real de la marca no
aplica. "repotes" en un subtítulo es un error de transcripción de Whisper, previo a este ciclo. Un primer render falló
porque la prueba pidió el montaje sin `voice: script` sobre un aroll mudo (uso, no defecto).
