# FIX-e-burgos-016 — El storyboard automático de motion ya no agota el tiempo pensando

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-016 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-12 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En el video de prueba "comprar producto" (16 escenas, 12 capturas) el job `motion` falló tres veces seguidas con
  `AI_AGENT_FAILED` a los 10 minutos exactos. La llamada `claude --print` con el esquema del storyboard (77 KB) pasó
  más de 13 minutos razonando (dos bloques de ~30.000 caracteres) sin escribir el JSON, y el límite de 10 minutos la
  cortaba. El productor, para salir del paso, achicó el brief: sacó las posiciones de las capturas y las tildes del
  guion, y su turno también agotó los 30 minutos.

## Solución
- CLI `motion-studio`: `claudeCliArgs` pasa `--effort low` por defecto (`MOTION_STUDIO_EFFORT` lo cambia) y el límite
  por llamada sube a 15 minutos.
- Job `motion` del studio (render-api): `AiAgentRequest` acepta `effort`, el adaptador motion pide `low`, el agente de
  Claude lo pasa como `--effort` y el límite por defecto de `CLAUDE_CLI_TIMEOUT_MS` sube de 10 a 15 minutos. Medido con el mismo pedido: 3 min 42 s, 16 escenas válidas.

## Verificación
- motion-studio y render-api lint/test/build verde; storyboard real en el studio con el brief completo.
