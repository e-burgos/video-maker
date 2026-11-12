# FIX-e-burgos-084 — Maquetas animadas sin hueco en 9:16

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Origen** | Detalle pendiente del FIX-e-burgos-083 (escena «Listo para usar» del video para locales) |

## Qué falló
- En 9:16 las animaciones `publish` (editor) y `domain` (navegador) se escalaban como las SVG y dejaban unos 350 px vacíos en el área visual.

## Solución
- `animations.ts`: `isMockupAnimation` marca `publish` y `domain`; `scene-html.ts` agrega la clase `mockup` al envoltorio.
- `scenes.css`: en 9:16 la maqueta no se escala, ocupa todo el alto, el bloque principal crece y textos y botones son más grandes.
- El short publicado no se re-renderiza (decisión del dev).
