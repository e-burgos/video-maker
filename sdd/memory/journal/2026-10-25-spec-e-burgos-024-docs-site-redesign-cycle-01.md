# spec-e-burgos-024-docs-site-redesign cycle-01 — 2026-10-25

## Qué pasó

La web rediseñada se veía bien a 1440 px y pasaba tests, build y check-links, pero a 390 px dos páginas tenían scroll
horizontal (506 px en Instalación, 14 px en Código abierto). Causa: listas `display: grid` sin `grid-template-columns`
— la columna implícita es `auto` y crece al ancho intrínseco de un `<pre>` o de un `<code>` largo, aunque el hijo tenga
`min-width: 0`. Sólo apareció porque el script de capturas mide `scrollWidth - innerWidth` por página e idioma y nombra
los elementos que se salen. Además, en capturas `fullPage` de Playwright las imágenes `loading="lazy"` quedaban en
blanco y esperar `image.decode()` sin tope colgó la corrida.

## Lección

Medir el overflow horizontal en el navegador en cada página y viewport móvil (no mirar sólo la captura) y declarar
`grid-template-columns: minmax(0, 1fr)` en todo grid que pueda contener `pre`/`code`; en capturas `fullPage`, recorrer
la página con scroll y acotar con timeout cualquier espera de imágenes.

## Costo evitable

Una ronda de capturas y una corrida colgada (~2 min) por esperar `decode()` sin tope.
