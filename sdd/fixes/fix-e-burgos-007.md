# FIX-e-burgos-007 — El productor no retomaba sesiones que el CLI ya no encuentra

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-007 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-08 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-017-desktop-app |

## Problema
El CLI de Claude guarda cada sesión bajo la carpeta de trabajo con que se creó. Las sesiones de proyectos anteriores a
spec-017 (creadas con la raíz del repo como carpeta) o creadas con otro `TMPDIR` no se encuentran desde la carpeta por
proyecto: `--resume` termina con "No conversation found with session ID" y el turno falla en 2 s, siempre, en ese
proyecto (visto en display-ads-asignar-campana desde la app).

## Solución
Si el resultado del CLI informa la sesión perdida, el turno se reintenta una vez con una sesión nueva y el historial de la
conversación al frente del mensaje; la sesión nueva queda guardada y los turnos siguientes la retoman.
