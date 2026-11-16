# spec-e-burgos-025-liquid-glass-rebrand — cycle-03 · plan (lite)

> Módulo: liquid-glass-rebrand | Subproyectos: apps/web | Fecha: 2026-11-13
> Objetivo: biblioteca de material con grilla de imágenes y visor ampliado con comparación, storyboard y voz migrados al Cristal Líquido.
> Fuera de alcance: vista previa completa, motion, marcas (ciclo 04); publicación, ajustes, guía y limpieza del modo heredado (ciclo 05); cambios de API.
> Referencias visuales: `design/rebranding/vistas/biblioteca-*.png`, `visor-*.png`, `storyboard-*.png`, `voz-*.png`.

## Historias
- US-025-301 — Como usuario quiero ver y ordenar el material del video por rol. CA: toolbar con «Subir material» como acción y «Generar montaje» secundario; resumen por rol con StateBadge (completo/falta/revisar); filtro por rol; grilla de miniaturas opacas con el rol en un chip sólido; selección múltiple con barra pegajosa (asignar rol, comparar, borrar con confirmación); subida y arrastre como hoy; archivos generados en su propio panel.
- US-025-302 — Como usuario quiero ver una imagen o video del material en grande y compararlos. CA: visor ampliado opaco (sin blur) con navegación por teclado (← → Esc), comparación lado a lado de dos elementos (tecla C), tira de miniaturas y panel de detalle (archivo, peso, rol, revisión del productor si existe); foco atrapado y devuelto al cerrar.
- US-025-303 — Como usuario quiero editar el storyboard escena por escena sin perderme. CA: «Proponer storyboard» como acción del toolbar; lista de escenas con estado a la izquierda y editor de la escena a la derecha; guardado en barra pegajosa inferior con estado «cambios sin guardar»; hoja de prompts y guion del productor accesibles; modo motion sin romper.
- US-025-304 — Como usuario quiero elegir la voz y revisar las tomas. CA: «Regenerar con la voz elegida» como acción del toolbar; voces como tarjetas `glass-sub` con reproducción; dirección de voz y tomas por escena con su marca de narración cambiada; modo motion sin romper.

## Tasks (detalle en tasks.json)
- TASK-001 — Biblioteca de material y visor: `asset-library-page` y sus componentes migrados, visor ampliado nuevo en `components/media-viewer/`, ruta `/projects/:slug/library` en `isMigratedRoute`. Valida: specs de la página, del visor (teclado, comparación, foco) y de la selección; capturas.
- TASK-002 — Storyboard: `storyboard-page` y sus componentes migrados, barra de guardado pegajosa, ruta en `isMigratedRoute`. Valida: specs y capturas.
- TASK-003 — Voz: `voice-page` y sus componentes migrados, ruta en `isMigratedRoute`. Valida: specs y capturas.
- TASK-004 — Verificación del ciclo: `contrast-audit.mjs` sobre las tres pantallas en claro y oscuro (0 fallas, sin desborde), capturas y revisión del visor por teclado.

## Decisiones técnicas
- Sin cambios de `schema.json`, `api.json` ni `components.json`.
- El visor es un componente propio (tucu-ui no trae galería ni lightbox) sobre `Modal` de tucu-ui o un diálogo propio con `role="dialog"`, siempre opaco: los medios nunca van bajo vidrio.
- TASK-002 y TASK-003 van en un mismo subagente (comparten el patrón de barra pegajosa y las piezas de escenas).
