# spec-e-burgos-008-ai-storyboard cycle-02 — 2026-09-09

## Qué pasó
Dos hallazgos, los dos invisibles para `lint`, `test` y `build`, y los dos caros de encontrar tarde.

1. **Un `import` de Zod en la frontera HTTP mudó toda una lib al chunk inicial.** El cliente
   (`render-api-client.ts`, que vive en el shell porque lo monta el provider) importó
   `parseStoryboardDocument`, que importa `StoryboardDocumentSchema` de `libs/timeline-core`. Los
   ocho proyectos quedaron verdes; el único síntoma fue el chunk inicial pasando de 466 kB a
   580 kB y el aviso "chunks larger than 500 kB" de Vite mezclado entre los warnings de siempre.
   La app ya tenía el precedente resuelto y no lo vi: `getTimeline` devuelve el cuerpo con un
   chequeo superficial y la **página perezosa** valida con Zod. Corregido copiando ese patrón.

2. **React rompe el nombre accesible de un control envuelto en su `<label>`.** El valor de un
   `<textarea>` y las `<option>` de un `<select>` se renderizan como hijos del `<label>`, así que
   el nombre accesible termina siendo "Narration for scene-01" **más el texto narrado**. Los tests
   de jsdom pasaron (Testing Library normaliza distinto), y el que falló fue el E2E de Playwright
   con `getByLabel(..., { exact: true })`: primero por ambigüedad (`Title` matcheó tres `<select>`
   cuyo valor era `title`) y después por no encontrar nada. Cada corrida costaba una llamada real
   a `claude -p` de ~70 s. Lo resolví con una **sonda barata**: sembré `work/storyboard.json` con
   el artefacto del ciclo anterior y probé los tres selectores sin llamar al agente; en un intento
   quedó claro que la etiqueta traía el valor pegado. Arreglado en el origen con `aria-label`
   explícito en cada control.

## Lección
El síntoma de "una lib entró al bundle equivocado" y el de "el nombre accesible no es el que
escribí" no aparecen en ningún target: el primero está en la salida de `vite build` y el segundo
sólo en un navegador real. Cuando verificar cuesta una llamada paga, la sonda que reproduce el
entorno real **con el resultado caro sembrado desde un artefacto anterior** vale más que otra
corrida completa.

## Costo evitable
Una corrida entera del E2E (~70 s de `claude -p` más el arranque de dos servidores y Chrome) se
gastó en descubrir un problema de selectores que la sonda sembrada resolvió después en 20 s y sin
consumir cuota. Haberla escrito antes de la primera corrida habría ahorrado esa llamada y la
segunda. Regla: si el guion E2E depende de un artefacto caro, primero sembrar el artefacto y
validar la mecánica del guion, y recién después correrlo de punta a punta.
