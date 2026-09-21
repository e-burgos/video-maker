# FIX-e-burgos-015-006 — La receta Tutorial y el productor usan el guion con tiempos que dejó el agente externo

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-015-006 · IMPROVEMENT · low · 2026-09-20 · implemented |
| **Spec** | spec-e-burgos-015-studio-producer |
| **Origen** | El dev: "¿la tabla de escenas del prompt es lo que ya entrega el agente externo en `work/`?" — sí: `work/producer/script.txt` con marcas `[m:ss]` (contrato de material §3). |

## Problema
El prompt de la receta pedía pegar la tabla de escenas aunque el guion con tiempos ya estuviera en el proyecto, y el prompt del sistema del productor no declaraba ese archivo.

## Solución
- Web: `loadRecipePrompt(id, language, { hasTimedScript })` reemplaza la frase del guion por "usá el que ya está en el proyecto (`work/producer/script.txt`)" cuando el listado de generados lo incluye.
- API: el contexto del productor reporta `producerScript: none | plain | timed` (leyendo el archivo y buscando marcas) y la sección del proyecto del prompt lo declara como EL guion, prohibiendo pedir la tabla de nuevo; sin marcas, el productor propone los tiempos mirando frames.

## Verificación
`web` 1006 tests, `render-api` 999; casos nuevos para las dos variantes de la frase y para las tres formas del guion.
