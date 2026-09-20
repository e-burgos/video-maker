# FIX-e-burgos-006-002 — El panel Logo de la vista previa no puede incorporar inicio ni fin de video

| Campo         | Valor                        |
| ------------- | ---------------------------- |
| **ID**        | FIX-e-burgos-006-002         |
| **Tipo**      | IMPROVEMENT                  |
| **Severidad** | medium                       |
| **Keyword**   | [IMPROVEMENT]                |
| **Fecha**     | 2026-09-20                   |
| **Autor**     | e-burgos                     |
| **Estado**    | in-progress                  |
| **Spec**      | spec-e-burgos-006-web-studio |
| **Origen**    | Pedido del dev: "esto se debe visualizar como opciones con dos tildes, en la sección vista previa, panel Logo". |

## Problema

El panel Logo de la vista previa sólo edita el overlay de esquina. `timeline.bumpers`
(FIX-e-burgos-001-003) no se puede activar ni customizar desde ninguna pantalla.

## Solución

- `LogoBumperEditor`, dentro del panel Logo y debajo de los controles actuales: dos tildes
  ("Incorporar inicio de video" / "Incorporar fin de video"). Al tildar cada una se despliegan sus
  ajustes: color de fondo (`<input type="color">` con default blanco más el hex editable), duración
  (1,5 s / 2 s / 3 s / 4 s), animación (fundido / zoom / deslizar hacia arriba) y tamaño del logo
  (chico / medio / grande = 0.3 / 0.4 / 0.55).
- Sin logo en la timeline las dos tildes quedan deshabilitadas con la ayuda "Subí un logo para usar
  el inicio y el fin".
- Se escribe en el borrador (`bumper-enabled` / `bumper-style` del reducer) y se guarda con el PUT
  completo existente: dirty state y botón Guardar sin cambios. El `<Player>` muestra el bumper al
  instante porque `computeTimelineMetadata` ya devuelve la duración total.
- La fila "DURACIÓN" muestra contenido + inicio/fin ("96,50 s + 2 s + 2 s").
- `timelineWarnings` (código `BUMPER_WITHOUT_LOGO`) se muestra como warning en la lista de issues,
  sin bloquear guardado ni render.
- Todos los textos por i18n (`en` + `es`, paridad verificada por `messages-parity`).

## Justificación del bypass del SPEC GATE

Controles de web sobre un campo opcional del documento, guardados por el PUT que ya reemplaza la
timeline entera. No crea endpoints ni entidades. Perfil `solo`, sin ciclo abierto sobre spec-006.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`; captura en `fixes/artifacts/`.
