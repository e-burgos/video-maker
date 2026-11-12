# FIX-e-burgos-083 — Arreglos de la prueba de oro del plugin

| Campo | Valor |
| --- | --- |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Origen** | Prueba de aceptación del plugin en display-ads (video de venta 9:16) |

## Qué falló
- En 9:16 hook, feature, product, ai-generate y schedule dejaban vacía la mitad de abajo; la galería de 3 dejaba una fila libre.
- El título `scramble` mostraba glifos antes de su turno y se encimaba con la otra línea del hook.
- En feature, un ítem sin `cue` salía antes que el anterior con `cue`.
- Schedule cortaba los rótulos largos.
- Con `beatSync` un reel de 40 s planeado salió de 77 s (mínimo de 3 compases por escena).
- `get_render_review` devolvía la review del render anterior mientras corría la nueva.

## Solución
- `scenes.css`: en 9:16 el visual ocupa el alto libre y crecen foto, pantalla del hook, resultado de IA y animaciones; schedule centrado y más grande, rótulos en hasta dos líneas, fila 2 por clase `row-1`; grillas de galería sin huecos para 2, 3 y 4.
- `motion-runtime.js`: `scramble` arranca oculto; un ítem sin `cue` sale después del hermano anterior.
- `compose-storyboard.ts`: mínimo de compases por defecto 2 en 9:16 (3 en 16:9).
- `get_render_review` espera siempre la review en curso.
- Skill de motion: `brand:<key>`, galería de 2 a 4, costo de `beatSync`, revisar cada `vo`, guardar antes de renderizar, aprobación que no llegó.

## Descartados
- Caída del studio: fue el panel de vista previa del arnés (SIGTERM), no el studio.
- Aprobación invisible: el clic se guardó 1 min 44 s después del primer intento.
- Galería de 5 aceptada: el guardado la rechazó; el render usó el storyboard anterior.
