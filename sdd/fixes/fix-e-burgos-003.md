# FIX-e-burgos-003 — Kit DisplayAds al día: Easy Pro reemplaza a Core Pro

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-003 |
| **Tipo**      | IMPROVEMENT |
| **Severidad** | medium |
| **Fecha**     | 2026-10-07 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-020-motion-mode |
| **Origen**    | display-ads cambió su línea de productos (spec 070) y sus fotos oficiales. |

## Problema

El kit de marca de los videos mostraba Core Pro (sin stock), fotos de ambiente no validadas y el tagline
"Cada pantalla, bajo control. Con IA.", que no usa la web.

## Solución aplicada

- `BrandManifest`: `retired` (la IA no ofrece el equipo y la verificación lo rechaza), `plate` (placa clara
  detrás de un equipo oscuro), `spokenName` del equipo (cómo se escribe en la voz: "Isi Pro") y
  `images` con `{file, caption}` (la IA elige por la descripción).
- Kit DisplayAds: Easy Pro (`img/easy-pro.png`, con placa), Core Pro retirado, 19 fotos aprobadas en
  `img/scenes/` con los textos de la landing, tagline "Tus pantallas, bajo control.".
- Instructivo nuevo `storyboards/displayads/easy-pro.json`; el de Core Pro pasa a `archivo/`.
  Presentación y Counter 15 actualizados y re-renderizados.

- Crédito de la música (CC BY): ya no se dibuja en el video. `renderProject` escribe
  `<video>.credits.txt` al lado del MP4, el job `motion` lo devuelve como `musicCredit` y la página Motion
  lo muestra "para la descripción de la publicación" (la licencia exige atribución en algún lugar visible).
- App de escritorio 0.3.0 con el modo motion.

## Verificación

Lint, test y build de motion-graphics, motion-studio y render-api en verde; renders revisados cuadro a
cuadro. Guion de Easy Pro validado contra display-ads: sin PIN de salida, sin Ethernet, sin pantalla
vertical, sin nombrar al fabricante; el Wi-Fi se resuelve con el soporte.
