# spec-e-burgos-016 cycle-01 — 2026-09-11

## Qué pasó

1. **El locator de Playwright por texto visible no encuentra un botón con `aria-label`.** El botón de
   preview muestra "▶ Play" pero declara `aria-label="Preview <label>"`; `getByRole('button', { name:
   /^(▶|■) / })` esperó 30 s y murió. El nombre accesible de un control con `aria-label` **es** el
   `aria-label`: el texto visible deja de ser buscable por rol+nombre. Costó una corrida completa del
   E2E (~90 s con dos síntesis de Piper reales).

2. **Un caché invalidado por el `mtime` de su insumo no ve un cambio en el código que lo produce.**
   El preview de voz se invalida comparando el `mtime` del `.onnx` contra el del wav cacheado. Cuando
   acorté la frase fija a los ~4 s pedidos, todo caché ya caliente siguió sirviendo la frase vieja:
   el modelo no cambió. Se resolvió metiendo una revisión en el **nombre** del archivo cacheado
   (`<voz>.v1.wav`), que es lo único que un cambio de código puede mover.

3. Un `useEffect` de "pausá el medio si ya no sos el activo" corre también en el montaje y llamó
   `pause()` sobre cada `<audio>` recién creado: jsdom no lo implementa y escupió un "Not implemented"
   por elemento en **toda** la suite, sin romper ningún test. Se arregló guardando el estado en un
   `ref` y saliendo temprano cuando nunca se reprodujo nada.

## Lección

Verificar en el DOM real cuál es el **nombre accesible** de un control antes de escribir su locator
de Playwright (`aria-label` gana sobre el texto visible), y versionar en el NOMBRE del archivo todo
caché cuyo contenido dependa de una constante del código: el `mtime` del insumo no la ve.

## Costo evitable

Una corrida E2E completa (~90 s, dos síntesis reales de Piper) por el locator, y una tanda de
depuración por la frase cacheada. Las dos se evitaban mirando el DOM/el disco una vez antes de correr.
