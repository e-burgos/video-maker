# spec-e-burgos-016-studio-usability cycle-02 — 2026-09-11

## Qué pasó

Migrar 44 componentes y 6 páginas a un catálogo de traducción parecía un ciclo de reescribir 78
suites de test: casi todas aseran texto en inglés (`getByRole('button', { name: 'Save' })`). No hubo
que tocar ninguna. El default del contexto de idioma es el **catálogo inglés completo**, así que un
componente montado sin provider renderiza exactamente el mismo DOM que antes: la migración cambia de
dónde sale el texto, no qué texto sale. Sólo cambiaron los 8 specs que importaban el literal
exportado (`assetRoleCopy(...).impact`, `STARTER_SUGGESTIONS_*`, `voiceFailureExplanation`) y el
único caso donde el copy inglés cambió a propósito (los chips del productor, que estaban en
español). Los tres errores que sí costaron fueron de tipos y de bundle, no de texto: `tsc` frenó un
`string | null` que Vitest no ve, el chunk inicial se comió 9 kB con sólo el shell migrado, y el
spec del scanner no compilaba con `node:fs` en un proyecto tipado para el navegador.

El catálogo plano compartido tiene un costo que no es obvio: **mueve hacia el chunk inicial el copy
que hoy vive en las rutas perezosas**. Con el shell migrado el bundle pasó de 479,33 a 488,63 kB
contra un tope de 500, y faltaban 340 claves. La salida no fue tocar la config: volver perezosa la
última ruta que se importaba estática sin ser la de aterrizaje (`/projects/:slug`) devolvió 22 kB, y
cargar el catálogo `es` con `await import()` lo dejó afuera del todo. Cierre: 490,17 kB.

## Lección

Cuando un cambio transversal toca el texto que los tests aseran, hacer que el camino por defecto
(sin provider, sin config) devuelva **el valor de hoy**: la migración se vuelve mecánica y la suite
existente pasa a ser la red que prueba que no cambió nada.

## Costo evitable

Escribir el scanner de copy literal como `*.spec.ts` con `node:fs` costó una corrida entera de
`build`: en `apps/web` los specs SÍ se typechequean y el proyecto no tiene los tipos de Node. La
salida —`import.meta.glob(..., { query: '?raw', eager: true })`— además no necesita saber dónde está
el disco. Antes de leer archivos desde un test, mirar para qué runtime está tipado ese proyecto.
