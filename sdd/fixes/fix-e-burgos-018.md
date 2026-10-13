# FIX-e-burgos-018 — get_render_review espera la revisión que todavía corre

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-018 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-12 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-023-production-quality |

## Problema
- En el video de prueba "comprar producto" el productor pidió la revisión apenas terminó el job `motion`, mientras el
  job `review` seguía en cola. La tool devolvió `FILE_NOT_FOUND` con un hint que sólo nombraba `start_job render`, y el
  productor le dijo al dev que los proyectos motion no tienen revisión automática (falso: `out/video.review.json`
  existía un minuto después).

## Solución
- `get_render_review`, si no encuentra la revisión, busca un job `review` sin terminar entre los últimos 10 y lo espera
  (hasta 3 minutos) antes de volver a leer; el hint de error aclara que todo render completo o video motion se revisa en
  un job `review` que arranca justo después.

## Verificación
- producer-tools lint/test/build verde (test nuevo con el job de revisión en curso).
