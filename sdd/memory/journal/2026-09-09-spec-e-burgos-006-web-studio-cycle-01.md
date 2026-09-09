# spec-e-burgos-006-web-studio cycle-01 — 2026-09-09

## Qué pasó

Primer ciclo de UI del repo. Dos cosas que ningún test verde habría detectado:

1. **La verificación visual casi no ocurre.** Las tools `mcp__…_playwright__*` de este harness
   hablan con el navegador por la extensión "Playwright MCP Bridge", que no está instalada:
   `browser_navigate` y `browser_resize` responden `Extension connection timeout`. El plan B fue el
   Playwright ya cacheado en `~/.npm/_npx/<hash>/node_modules/playwright` manejado desde un script
   de Node — sin tocar `package.json`, que el ciclo tenía que dejar sin diff. Ese build espera un
   `chromium_headless_shell` que no está descargado, así que el lanzamiento tuvo que ser
   `chromium.launch({ channel: 'chrome' })` contra el Chrome instalado. Dos intentos fallidos
   antes de la primera captura.

2. **Los `src` correctos no prueban que el medio se reproduzca.** La primera captura mostraba los
   cuatro assets con su URL de `EP-011` bien armada; eso es exactamente lo que un test de
   componente con jsdom ya afirmaba, y no agregaba nada. Lo que sí agregó fue leer en el navegador
   `readyState` (4 = `HAVE_ENOUGH_DATA`), `duration` y `videoWidth/videoHeight` de cada `<video>`:
   ahí quedó probado que el endpoint sirvió bytes decodificables a través del proxy de Vite. Un
   `src` bien escrito y un 404 se ven idénticos en una captura de pantalla.

Como nota menor, un `const facts = [media.kind]` se estrechó a `MediaKind[]` y rompió `build`
después de que `test` estuviera verde: Vitest no tipa.

## Lección

Verificar una UI midiendo el estado del medio en el navegador (`readyState`, `duration`,
dimensiones), no la captura ni el atributo `src`; y antes de prometer una verificación con
Playwright, comprobar que el arnés puede abrir un navegador.

## Costo evitable

~15 min y dos corridas fallidas por dar por disponible el MCP de Playwright sin probarlo al
planificar la task. El chequeo cuesta una llamada: hacerlo al abrir el ciclo, no al llegar a la
última task, que es cuando ya no queda margen para replantear el criterio de cierre.
