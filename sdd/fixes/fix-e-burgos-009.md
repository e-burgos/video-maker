# FIX-e-burgos-009 — Subtítulos con el texto del guion, no con lo que transcribe Whisper

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-009 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-10-08 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
Con voz desde guion, los subtítulos salían de transcribir con Whisper la voz sintetizada: "Displayance" por
"Display Ads", "franca horaria" por "franja horaria", palabras perdidas ("Creada,"). Visto en el tutorial
display-ads-crear-ubicacion antes de publicarlo; los tutoriales anteriores tenían el mismo defecto.

## Solución
`alignScriptTextToWords` alinea (LCS sobre tokens normalizados, sin tildes ni puntuación) las palabras del guion de cada
línea con las que reconoció Whisper: cada palabra del guion toma el tiempo de su pareja y las no escuchadas se reparten
en el hueco entre vecinas o comparten la palabra vecina si no hay hueco. El texto de los subtítulos es siempre el del
guion.
