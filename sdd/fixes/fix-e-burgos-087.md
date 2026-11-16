# FIX-e-burgos-087 — El productor ofrece Fable y avisa cuando el CLI es viejo

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-14 |
| **Estado** | implemented |

## Qué faltaba
- El selector de modelo del productor solo listaba `sonnet`, `opus` y `haiku`; Fable 5.2 no se podía elegir.
- Con un `claude` viejo (2.1.123), Fable y Opus 5.5 devuelven `claude_code_version_too_old` y el turno caía como `PRODUCER_TURN_FAILED` («mandá el mensaje de nuevo»), que no sirve.

## Solución
- `DEFAULT_PRODUCER_MODELS` = `sonnet, fable, opus, haiku` (las cuatro familias; el CLI resuelve cada alias a su versión actual).
- Código nuevo `PRODUCER_CLI_OUTDATED` (503) con mensaje que pide `claude update`.
