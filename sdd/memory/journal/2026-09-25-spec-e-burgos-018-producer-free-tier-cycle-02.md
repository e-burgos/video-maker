# spec-e-burgos-018-producer-free-tier cycle-02 — 2026-09-25

## Qué pasó
El storyboard con OpenRouter fallaba 5/5 con un brief común: DeepSeek omitía `remotionScene`, que era
`.optional()` en el JSON Schema porque el "requerido si visualSource=remotion-scene" vivía solo en el
`superRefine` de Zod. El primer smoke "pasó" forzando en el brief `visualSource: upload`.

## Lección
Derivar el JSON Schema para un modelo de un schema Zod con `superRefine` esconde las reglas condicionales: en el schema para el modelo, lo condicional va requerido + nullable (o unión discriminada) y se normaliza antes del parse real — y nunca aceptar un smoke que pasa ajustando la entrada.

## Costo evitable
Una segunda vuelta del implementador (~200 k tokens) por aceptar primero un smoke con el brief dirigido.
