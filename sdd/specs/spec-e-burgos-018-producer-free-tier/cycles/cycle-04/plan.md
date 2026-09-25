# spec-e-burgos-018-producer-free-tier — cycle-04 · plan (lite)

> Módulo: producer-free-tier | Subproyectos: apps/render-api, apps/docs-site, apps/desktop | Fecha: 2026-09-25
> Flow: **lite** — perfil `solo`. **Publicar es irreversible**: TASK-005 corre solo con la confirmación del dev.
> Objetivo: la corrida de modelos gratuitos que cycle-01 no pudo hacer (O-1) y el cierre de la spec con la 0.2.0 (D-07).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C4-01 | El bench corre solo a las 00:05 UTC del 2026-09-26 con `--discover-free` y escribe en `artifacts/` de este ciclo | La cuota de la cuenta se reinicia a las 00:00 UTC |
| D-C4-02 | Entra como `free` lo que pasa 2/2; el default sigue en `deepseek/deepseek-v4.1-flash` | D-C1-03 |
| D-C4-03 | Versión **0.2.0**: storyboard sin Claude, material libre, ver fotos, modelos gratis (si alguno pasó) | Cambió la app |
| D-C4-04 | Web: sección de modelos con los gratuitos medidos y sus límites (1000 pedidos/día con saldo ≥ US$10, 50 sin saldo; privacidad), y las funciones nuevas en "Usar el estudio" y FAQ (la FAQ decía que el storyboard necesita IA; ahora anda con cualquiera de los dos motores) | Que la web diga lo que la app hace |

## Historias

- **US-018-401 — Medir los gratuitos** (cycle-01 US-018-101).
- **US-018-402 — Recomendarlos** (cycle-01 US-018-102).
- **US-018-403 — Sacar la 0.2.0.** CA: dry-run con el `.dmg` 0.2.0, sus sha256 y notas desde el CHANGELOG; la app
  empaquetada arranca y su servidor MCP lista las 17 tools; con OK del dev, publicada en R2 y `main` desplegado.

## Tasks (detalle en tasks.json)

- **TASK-001** — Benchmark real (programado).
- **TASK-002** — Lista recomendada y sección de modelos.
- **TASK-003** — Web y CHANGELOG 0.2.0.
- **TASK-004** — Dry-run y arranque real.
- **TASK-005** — Publicar (**confirmación del dev**).
- **TASK-006** — Cierre del ciclo y de la spec.
