# Constitución — libs/producer-tools

> Versión 1.0 | Última actualización: cycle-0 (inicial, abierto por spec-e-burgos-017-desktop-app cycle-01)

## 1. Propósito

- **Tipo:** lib TypeScript (Node)
- **Rol en el sistema:** fuente única de las herramientas del productor conversacional: contrato
  (nombres, schemas Zod de entrada y salida, errores tipados), handlers sobre un puerto
  `RenderApiClient`, servidor MCP stdio acotado a un proyecto y prompt del productor. Lo consumen
  `apps/render-api` (lanza `claude -p` con este servidor) y el runtime OpenRouter de `cycle-04`.

## 2. Stack tecnológico

- TypeScript + Zod (contrato), `@modelcontextprotocol/sdk` (servidor stdio), Vitest.

## 3. Estructura y patrones

- `contract/` puro y sin I/O: es lo que se congela en
  `sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-01/plan.md` § Contrato MCP.
- `handlers/` y `mcp/` hablan con `render-api` solo por el puerto `RenderApiClient`.
- `prompt/` construye el system prompt del productor contra las herramientas, nunca contra shell.

## 4. Convenciones propias

- Ninguna herramienta recibe el slug del proyecto ni rutas absolutas: el alcance lo fija el
  proceso del servidor al arrancar.
- Todo error sale como `{ code, hint }` de la lista cerrada del contrato, sin rutas del host ni stderr.
- La lib no importa `apps/*`; `render-api` depende de ella, nunca al revés.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
