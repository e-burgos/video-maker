# spec-e-burgos-018-producer-free-tier cycle-03 — 2026-09-25

## Estado
`settings-page.spec.tsx` "shows the masked key…" fallaba de forma intermitente con la suite de 7 proyectos en
paralelo: su `waitFor` usaba el timeout por defecto de 1 s. Ahora espera hasta 5 s.

## Estructura
Sin cambios.

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente.
