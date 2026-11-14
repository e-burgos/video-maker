# apps/docs-site — spec-e-burgos-025-liquid-glass-rebrand cycle-05 (2026-11-13)

## Estado
Las nueve capturas del studio de `public/screenshots/` (inicio, crear, espacio de trabajo, material, propuesta, ajustes OpenRouter y tres de motion) muestran el diseño Cristal Líquido, en claro. `first-run-setup`, `gatekeeper-not-opened` y `tutorial-poster` no cambiaron. El diseño de la web no cambió.

## Estructura
- `scripts/capture-studio-screenshots.mjs`: captura el studio de solo lectura contra `STUDIO_URL` (por defecto un vite en 4298), con `--out`, `--theme` y `--only`; simula con `page.route` los estados que no existen y aborta toda escritura. `scripts/capture-screenshots.mjs` sigue capturando la web.

## Dependencias
Sin cambios.

## Qué sigue
Ciclo 06 de spec-025: si la web suma secciones nuevas del studio, regenerar con el script nuevo.
