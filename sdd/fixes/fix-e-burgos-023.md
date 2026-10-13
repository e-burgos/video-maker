# FIX-e-burgos-023 — La bandeja de arrastrar y soltar propone el rol reference para videos de referencia

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-023 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-13 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- Al soltar un video que parece una referencia (no material propio) la bandeja no ofrecía el rol reference ni explicaba qué hace.

## Solución
- La tarjeta de propuesta de archivos del chat (`asset-proposal-card.tsx`) ofrece `reference` sólo para videos, con explicación visible, y lo sugiere (con motivo) cuando el nombre parece de ejemplo, el borrador pide «un video como este» o el proyecto es motion (`apps/web/src/api/reference-suggestion.ts`). La bandeja de crear proyecto soltando archivos no asigna roles y no cambió.

## Verificación
- web lint/test/build verde (5 casos nuevos en asset-proposal-card).
