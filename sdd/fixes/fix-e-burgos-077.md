# FIX-e-burgos-077 — Tipografía cinética en el modo B

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-077 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
En el modo B (HyperFrames + GSAP) los títulos entraban enteros, casi siempre con `rise`. Es la etapa 3 del informe `docs/research/2026-11-10-motion-graphics-productor.md`.

## Solución
- **Plugin:** el `gsap.min.js` empaquetado es GSAP 3.14.2, idéntico byte a byte al de npm, y no trae SplitText. Se suma `assets/runtime/SplitText.min.js` de la misma versión (npm `gsap@3.14.2`), que la plantilla carga entre gsap y el runtime.
- **Primitivas nuevas del runtime:** `split-chars`, `split-words`, `split-lines`, `mask-up` y `scramble`.
  - `split-lines` y `mask-up` usan `autoSplit`: vuelven a cortar las líneas cuando carga la fuente de la marca.
  - `scramble` es determinista por cuadro: no usa `Math.random`.
  - Los cortes dentro de `.mg-grad` heredan el degradé.
- **Storyboard:** suma `titleStyle` por escena. Compose la rota con semilla sin repetir las dos anteriores, igual que las salidas, y la escribe como `data-title-style`. El runtime la aplica solo a la entrada de los títulos (`.mg-h`).
- **Productor:** el prompt le pide dejar `titleStyle` afuera, salvo pedido explícito.

## Nota legal (pendiente del dev)
GSAP es gratis desde la 3.13, pero su licencia (https://gsap.com/standard-license) excluye los «productos competidores»: herramientas para crear o editar animaciones con una interfaz visual tipo Webflow. **El dev tiene que leer esa cláusula antes de empaquetar SplitText (y GSAP) en el instalador de la app desktop.**

## Verificación
- `nx test`, `lint` y `build` en verde:

| Proyecto | Tests |
| --- | --- |
| motion-graphics | 349 |
| producer-tools | 452 |

- Render de prueba de `media/prueba-titulos-b`, revisado cuadro a cuadro.
