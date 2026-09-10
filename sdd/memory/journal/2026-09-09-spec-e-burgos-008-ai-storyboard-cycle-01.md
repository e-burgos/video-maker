# spec-e-burgos-008-ai-storyboard cycle-01 — 2026-09-09

## Qué pasó

Primer ciclo que mete un modelo dentro del producto, y el modelo entró como **binario**: puerto
`AiAgent` + `claude -p` por el `CommandRunner` que ya usaban ffmpeg y whisper. Cero API keys, cero
SDK, cero dependencias npm nuevas. La suite jamás llama al binario ni a la red.

El primer smoke real falló con `AI_AGENT_INVALID_OUTPUT`. Reproduciendo la llamada a mano apareció
la causa: **`--json-schema` se ignora en silencio cuando el JSON Schema declara la clave
`$schema`**. La respuesta vuelve `is_error: false`, `subtype: "success"` y **sin
`structured_output`**, con el JSON en prosa dentro de `result`. O sea: el canal de error del CLI
dice "éxito" mientras el contrato estructurado no se aplicó nunca. `z.toJSONSchema()` la emite por
default, así que el bug nace del generador, no del prompt. La sonda inicial que corrí *antes* de
escribir el adaptador no lo detectó porque su schema era un literal escrito a mano, sin `$schema`.

Segundo susto: el guion del smoke arrancó en el puerto 4399 —el que usa el smoke de `spec-007`— y
ahí había un `render-api` vivo **de otro ciclo**. `curl /health` devolvió `200` con un
`capabilities` sin `storyboardQueue`, y el guion siguió contra el binario equivocado hasta que se
leyó el log del proceso propio (`EADDRINUSE`). Un servidor viejo y un servidor nuevo se ven igual
desde afuera si no se mira un campo que sólo existe en el nuevo.

Tercero, barato pero revelador: el `switch` exhaustivo del tercer `kind` de job hizo estallar dos
tests de ciclos anteriores que creaban un job **sin `kind`**. Pasaban porque el ternario anterior
mandaba todo lo que no fuera `render` a la rama `montage`. Los specs de este subproyecto **no se
typechequean** (`tsconfig.lib.json` los excluye y Vitest no tipa), así que un test puede violar el
contrato declarado durante dos specs sin que nadie lo note.

## Lección

Cuando una herramienta externa acepta un contrato (schema, formato, flag), verificar que lo
**aplicó** mirando el campo que sólo aparece si lo aplicó — nunca su código de éxito.

## Costo evitable

Una corrida real de `claude -p` perdida (~100 s y cuota) y ~15 minutos de bisección, más una
corrida entera del smoke contra un binario ajeno. Las dos se evitaban con la misma regla: la
primera sonda de una herramienta tiene que hacerse con **el artefacto real** que va a viajar (el
schema generado, no uno escrito a mano), y el primer request del smoke tiene que probar que habla
con el build bajo prueba.
