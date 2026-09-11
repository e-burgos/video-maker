# FIX-e-burgos-015-002 — El productor no puede generar voz, pierde el modelo del turno y culpa a una API key inexistente

| Campo         | Valor                                                        |
| ------------- | ------------------------------------------------------------ |
| **ID**        | FIX-e-burgos-015-002                                         |
| **Tipo**      | BUGFIX                                                       |
| **Severidad** | high                                                         |
| **Keyword**   | [BUGFIX]                                                     |
| **Fecha**     | 2026-09-11                                                   |
| **Autor**     | e-burgos                                                     |
| **Estado**    | implemented                                                  |
| **Spec**      | spec-e-burgos-015-studio-producer                            |
| **Origen**    | Caso real `media/display-ads`: el productor se trabó, habló de una "API key" y planificó vertical una grabación 16:9. |

## Problema

Tres defectos del turno del productor, todos vistos en la misma producción real:

1. **Piper no está en la lista blanca.** El agente no podía sintetizar voz de ninguna forma: ni
   corriendo el binario (denegado) ni por el job `voice`, que hasta `FIX-e-burgos-009-001` exigía un
   storyboard.
2. **El modelo del turno no llegaba a los jobs.** El usuario elige el modelo en el chat
   (`FIX-e-burgos-015-001`), pero el `storyboard` que el agente encolaba seguía corriendo con el del
   servidor.
3. **El texto del sistema no decía de dónde sale la IA.** Ante un `AI_AGENT_FAILED` el productor le
   inventó al usuario que faltaba una API key —no existe ninguna: el CLI usa la suscripción de Claude
   Code— y no tenía ninguna regla sobre el formato de salida, así que una grabación de pantalla 16:9
   se planificó 9:16.

## Solución

- **(a) Lista blanca.** `producerAllowedTools(piperPath)` agrega `Bash(<PIPER_PATH absoluto> *)`
  cuando el binario resuelve (si `PIPER_PATH` es sólo `piper`, la regla queda `Bash(piper *)` por
  construcción). La lista viaja en `ProducerTurnStart.allowedTools`, ya no es una constante global.
  **Sonda real** (abajo): el CLI **sí** autoriza el binario por comodín, incluso escribiendo un
  archivo. La regla `mkdir`/`cp`/`mv`/`rm` no cambia: esos siguen sin poder concederse.
- **(b) Modelo del turno.** `buildProducerSystemPrompt(..., model)` inyecta el valor concreto y el
  prompt exige que **todo** `POST /jobs` de `storyboard` o `voice` lleve `"model": "<ese modelo>"`.
- **(c) Texto del sistema.** La IA corre con la suscripción de Claude Code y **nunca** se habla de API
  key; ante `AI_AGENT_FAILED`/`AI_AGENT_RATE_LIMITED` hay que mostrar el `result` literal del error y
  ofrecer reintentar o cambiar de modelo; el formato sigue al A-roll (`youtube-16x9` apaisado,
  `9x16` vertical) y se manda con `format`; la voz sin storyboard es el job `voice` con
  `scriptPath`/`scriptText`.
- La skill `sdd/skills/video-producer/SKILL.md` acompaña: §0 (herramientas, suscripción, modelo y
  errores), §1 (tabla de herramientas), §5 (nueva sección de formato) y §6 (el job `voice` primero,
  Piper a mano después).

## Sonda de la lista blanca (ejecutada, no supuesta)

```
claude --print "Run exactly this one Bash command …: $PIPER_PATH -m $PIPER_MODEL_PATH -i <tmp>/in.txt -f <tmp>/out.wav" \
  --permission-mode dontAsk --model haiku --output-format json --add-dir <tmp> \
  --allowedTools "Bash($PIPER_PATH *)" Read
```

Resultado: `is_error: false`, `num_turns: 2`, `result: "DONE"` y `out.wav` de 109 612 bytes en el
directorio temporal (`ffprobe`: `pcm_s16le, 22050 Hz, 1 canal, 2.484535 s`). El CLI autoriza el
binario de Piper por regla comodín, así que la opción (a) queda implementada y documentada; no hizo
falta el plan B de dejar al productor sólo con el job `voice`.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec cerrada, a partir de una producción real fallida. No crea
endpoints, módulos ni entidades: una entrada más en la lista blanca, un valor inyectado en el system
prompt y prosa en el prompt y la skill. Perfil `solo`, sin ciclo abierto.

## Archivos

`build-producer-system-prompt`, `claude-code-producer-agent`, `producer-agent`, `run-producer-turn` y
el fixture del turno en `apps/render-api`; más `sdd/skills/video-producer/SKILL.md` y
`sdd/catalog.json`. Lista completa en `affected_files` de `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
