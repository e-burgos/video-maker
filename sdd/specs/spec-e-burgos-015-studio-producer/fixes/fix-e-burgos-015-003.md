# FIX-e-burgos-015-003 — El productor traduce el lenguaje común del usuario; nunca le pide parámetros técnicos

| Campo         | Valor                              |
| ------------- | ---------------------------------- |
| **ID**        | FIX-e-burgos-015-003               |
| **Tipo**      | IMPROVEMENT                        |
| **Severidad** | medium                             |
| **Keyword**   | [IMPROVEMENT]                      |
| **Fecha**     | 2026-09-11                         |
| **Autor**     | e-burgos                           |
| **Estado**    | implemented                        |
| **Spec**      | spec-e-burgos-015-studio-producer  |
| **Origen**    | Feedback del dev sobre el mensaje sugerido para `display-ads` |

## Problema

El mensaje que le sugerimos al usuario para retomar `display-ads` nombraba jobs, flags y formatos
(`voice` con `scriptText`, `voice: script`, `youtube-16x9`). Un usuario no conoce nada de eso: "El video
es para YouTube. Generá la voz automáticamente, corré el montaje con voz, buscá una música libre suave,
logo abajo a la derecha, y renderizá" tiene que alcanzar.

## Solución

Regla nueva en el prompt del sistema del productor y sección "2 bis" en la skill `video-producer`: tabla
de traducción de lo que dice el usuario a lo que ejecuta el agente (plataforma → formato, "voz
automática" → job `voice` con el guion, "montaje con voz" → `voice: script`/`aroll` según la grabación,
mood de música → búsqueda libre con crédito, esquina del logo → posición, "renderizá" → `render` +
`ffprobe`, ritmo → preset), prohibición de exponer o pedir parámetros técnicos, y la instrucción de no
volver a preguntar lo que una instrucción completa ya decidió.

## Verificación

Test nuevo en `build-producer-system-prompt.spec.ts`; suite de `render-api` verde; turno real del
productor sobre una copia temporal de `display-ads` con la frase literal del dev.
