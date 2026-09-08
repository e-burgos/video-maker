# spec-e-burgos-003-kinetic-captions cycle-01 — 2026-09-07

## Qué pasó

CA-002 pide que "la caja resultante" quede dentro de 1080×1920 para los tres formatos 9:16. El
ciclo lo daba por cubierto: `caption-safe-zone.spec.ts` tenía un `it.each` que recorría reels,
tiktok y shorts y asertaba contención de la caja. Pero esa caja la calculaba con `captionLayout`
—el helper heredado de `spec-e-burgos-001`— y no con `captionBoxFor`, que es el helper que este
ciclo introduce y del que habla el criterio. La única cobertura de `captionBoxFor` contra el cuadro
estaba en `caption-box.spec.ts` y solo sobre `tiktok-9x16`. Resultado: `reels-9x16` y `shorts-9x16`
nunca ejercitaron la caja nueva, el CA figuraba en verde en un test que lo nombraba, y la cobertura
de líneas no delataba nada porque las ramas ya estaban tocadas por otros casos.

## Lección

Cuando un CA nombra un artefacto ("la caja resultante", "el estilo devuelto"), el test tiene que
llamar al helper que **ese ciclo** introduce: un helper anterior de forma parecida hace pasar el
criterio sin verificarlo, y ni la cobertura ni el nombre del test lo delatan.

## Costo evitable

Cero tokens de implementación —las ramas ya estaban cubiertas, el arreglo fueron 12 casos de un
`describe.each` sobre código que ya andaba— pero el hueco sobrevivió al implementador y al gate de
cobertura, y solo cayó porque la revisión rastreó cada CA hasta el símbolo que invoca su test en
vez de hasta el nombre del test. Verificar el CA por el símbolo llamado, no por el título del
`it`, es lo que separa una revisión de un chequeo de que la suite está verde.
