# FIX-e-burgos-015-001 — El modelo del productor lo fija `PRODUCER_MODEL`: el usuario no puede elegirlo desde el chat

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| **ID**        | FIX-e-burgos-015-001                     |
| **Tipo**      | IMPROVEMENT                              |
| **Severidad** | medium                                   |
| **Keyword**   | [IMPROVEMENT]                            |
| **Fecha**     | 2026-09-10                               |
| **Autor**     | e-burgos                                 |
| **Estado**    | implemented                              |
| **Spec**      | spec-e-burgos-015-studio-producer        |
| **Origen**    | Pedido literal del dev: "Es importante que permitas elegir el modelo que se usará." |

## Problema

`PRODUCER_MODEL` congela el modelo de todos los turnos al arrancar el servicio: `producerCliArgs`
pasa `config.model` a `--model` y la pantalla del chat no tiene forma de cambiarlo. Una pregunta
barata sobre el material y la decisión del montaje pagan lo mismo, y cambiar de modelo obliga a
reiniciar la API.

## Solución

- `PRODUCER_MODELS` (env, default `sonnet,opus,haiku`) declara la lista permitida; `PRODUCER_MODEL`
  sigue siendo el default y **debe** pertenecer a la lista (si no, `SERVER_CONFIG_INVALID`).
- `POST /projects/:slug/producer/messages` acepta `model?`, validado contra la lista
  (`422 PRODUCER_MODEL_INVALID`), lo pasa a `--model` y lo persiste en `session.json`. Cambiar de
  modelo en un turno posterior es válido: `claude -p --resume <id> --model <m>` lo soporta.
- `GET /projects/:slug/producer` devuelve `models: { default, allowed: [{ id, label, description }] }`;
  el turno (`GET …/turns/:id`) informa `model`, y cada mensaje del asistente queda persistido con el
  modelo que lo produjo.
- Web: selector de modelo junto al compositor (inicializado con `session.model ?? models.default`,
  enviado en cada POST) y badge con el modelo en cada respuesta del productor.

## Justificación del bypass del SPEC GATE

Pedido explícito del dev sobre una spec ya cerrada. No crea endpoints, módulos ni entidades: es
aditivo sobre tres payloads del contrato `studio-producer` y una variable de entorno, y queda
registrado campo a campo en `sdd/api.json` (EP-022, EP-023, EP-024). Perfil `solo`, sin ciclo abierto.

## Archivos

31 archivos: `producer-config`, `producer-agent`/`claude-code-producer-agent`, `producer-documents`,
`producer-turn-registry`, `run-producer-turn`, `producer-handler` y los cuatro archivos de errores en
`apps/render-api`; tipos, parser, cliente, composer, lista de mensajes y página del productor en
`apps/web`; más `sdd/api.json`, el README de la API, el E2E y los dos fragmentos de contexto. Lista
completa en `affected_files` de `sdd/fixes.json`.

## Verificación

`pnpm nx run-many -t lint test build` verde en los 8 proyectos y `pnpm sdd:validate` OK (2026-09-10).
Coberturas sin tocar `coverage.include`: render-api 839 tests (97,99 % stmts / 92,49 % branch), web 713
tests (98,73 % / 96 %), con piso 80 %.

E2E real (`PRODUCER_SMOKE_STOP_AFTER=5`, 2026-09-10 23:33): el selector ofrece exactamente
`["sonnet","opus","haiku"]` —los mismos que publica `EP-022`—, se cambia a `haiku`, el turno real
responde en 9 s con `model: "haiku"` en el registro del turno,
`work/producer/session.json` en disco queda
`{"sessionId":"c6564061-d7d4-46fa-aed8-01430ab115ec","model":"haiku",…}` y el badge del mensaje del
asistente dice `haiku`. Captura:
`sdd/specs/spec-e-burgos-015-studio-producer/cycles/cycle-02/artifacts/producer-smoke-09-model-haiku.png`.
