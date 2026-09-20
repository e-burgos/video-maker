# FIX-e-burgos-001 — Los proyectos externos no tienen un contrato escrito del material que el Video Maker necesita

| Campo         | Valor                |
| ------------- | -------------------- |
| **ID**        | FIX-e-burgos-001     |
| **Tipo**      | IMPROVEMENT          |
| **Severidad** | medium               |
| **Keyword**   | [IMPROVEMENT]        |
| **Fecha**     | 2026-09-20           |
| **Autor**     | e-burgos             |
| **Estado**    | implemented          |
| **Spec**      | N/A (repo-level)     |
| **Origen**    | Pedido del dev: "Genera un skill completo del uso de esta plataforma para que otros proyectos generadores de videos y materiales en crudo (como display-ads) puedan generar el material exactamente como este proyecto lo necesita, desktop (YouTube horizontal) o mobile (vertical)". |

## Problema

Todo lo que el motor exige del material (layout de `raw/`, roles, extensiones, un solo A-roll,
nombres de B-roll por concepto, música más larga que el edit, logo con alfa, guion una frase por
línea con marcas `[m:ss]`, formato explícito) vive repartido entre el código, el README de la CLI y
la skill `video-producer`, que está escrita para quien produce el video, no para quien entrega el
material. El caso `display-ads` lo pagó con material rehecho (logo sin alfa, formato vertical por
default sobre una pantalla apaisada, voz más corta que la grabación).

## Solución aplicada

Skill nueva y autocontenida `sdd/skills/video-maker-material-contract/SKILL.md`, escrita para el
proyecto externo: layout y roles, specs por archivo y por formato (`youtube-16x9` vs `*-9x16`, con
safe zones), reglas del guion y del matching de conceptos (tokens del nombre de archivo, frecuencia
mínima por preset), presets, checklist de entrega con `ffprobe`, entrega por filesystem y por HTTP
(endpoints, payloads y códigos de error reales), tres recetas completas, tabla de errores frecuentes,
límites del motor y cómo copiar la skill a otro repo. Cada regla cita el archivo del que sale.
Queda en el catálogo (`pnpm sdd:rebuild-catalog`) y enlazada desde la tabla de documentos de
`sdd/context/context_prompt.md`. Sin cambios de código.

### Archivos modificados

- `sdd/skills/video-maker-material-contract/SKILL.md` — la skill (nueva).
- `sdd/context/context_prompt.md` — fila en la tabla de documentos de referencia.
- `sdd/catalog.json` — regenerado.
- `sdd/fixes.json`, `sdd/fixes/fix-e-burgos-001.md` — registro del fix.

### Test de validación

- **Referencia:** prueba de recuperación con un agente lector (`haiku`) que solo pudo leer la skill y
  tuvo que producir el material de `display-ads` en 16:9 y 9:16; la línea de base sin la skill inventó
  carpetas (`screens/`), un `narration.jsonl`, un formato 1:1 y una CLI inexistente. Con la skill
  devolvió el layout, los nombres, las marcas de tiempo y las llamadas HTTP del contrato. Detalle en
  `sdd/fixes.json → test_reference`.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el próximo ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
