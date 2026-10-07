# spec-e-burgos-020-motion-mode — cycle-01 · plan (lite)

> Módulo: motion-mode | Subproyecto: apps/motion-editor (nuevo, mudado) | Fecha: 2026-10-07
> Flow: **lite** — app nueva sin contratos consumidos por otro subproyecto.

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C1-01 | Se renombra a `motion-editor` | "video-manager" al lado de "video-maker" confunde; el nombre describe lo que es: el editor visual de videos animados |
| D-C1-02 | Se copia tal cual (motor vendorizado, editor, tres videos, guías `SKILLS/`) y solo se ajusta lo que el workspace exige | El dev pidió no perder nada |
| D-C1-03 | Los textos que mencionan display-ads, sus puertos o sus scripts se actualizan; la historia (ciclos de display-ads citados) se conserva como referencia | Las guías siguen siendo la fuente para agentes |

## Historias

- **US-020-101 — El editor vive en el Video Maker.** CA: `nx typecheck|test|lint|build motion-editor` verdes; los
  tres videos y sus guiones presentes.
- **US-020-102 — Funciona igual que antes.** CA: en un navegador real cada video carga sin el banner de errores
  del registro y el editor permite moverse por la línea de tiempo.
