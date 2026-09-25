# spec-e-burgos-018-producer-free-tier — cycle-01 · plan (lite)

> Módulo: producer-free-tier | Subproyectos: libs/producer-tools, apps/render-api, apps/docs-site | Fecha: 2026-09-25
> Flow: **lite** — perfil `solo`, sin aprobaciones intermedias a pedido del dev. Tope de gasto: US$3.
> Objetivo: que un amigo sin saldo en OpenRouter tenga modelos gratuitos probados (O-1 de la spec).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C1-01 | Candidatos: los `:free` vivos del catálogo (`GET /api/v1/models`, sin key) con `tools` y `image`; hoy son 7 | D-01 de la spec; 9 `:free` con tools pero sin imagen quedan afuera |
| D-C1-02 | El bench escribe su reporte en `--out=<dir>` (default: el `artifacts/` de este ciclo) y acepta `--discover-free` | El default viejo pisaba el reporte de cycle-04 |
| D-C1-03 | Entra como `free` solo lo que pasa 2/2; el default sigue siendo `deepseek/deepseek-v4.1-flash` | Un gratuito tiene cuota diaria y privacidad distinta: no debe ser el default silencioso |

## Historias

- **US-018-101 — Medir los gratuitos.** CA: el reporte lista cada candidato vivo con éxito, pasos, segundos,
  costo y rate-limit, desde el estado real del servidor; gasto total ≤ US$3.
- **US-018-102 — Recomendarlos.** CA: los que pasaron 2/2 aparecen en la lista recomendada con tier `free` y sus
  métricas; la web muestra precios vigentes y la sección de modelos gratis actualizada.

## Tasks (detalle en tasks.json)

- **TASK-001** — Bench: descubrir candidatos `:free` y `--out`.
- **TASK-002** — Correr el benchmark real.
- **TASK-003** — Lista recomendada y web.
- **TASK-004** — Cierre del ciclo.
