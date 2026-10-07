# spec-e-burgos-019-motion-studio cycle-01 — 2026-10-07

## Qué pasó
Tres cosas costaron corridas largas: (1) Piper es estocástico y la misma frase salía bien o trabada
("franja horaria" → "Franco Auraria"); se resolvió eligiendo la mejor de N tomas por transcripción.
(2) `hyperframes beats` devuelve golpes sueltos e irregulares (bpm 234 para un tema de 122); hubo que
ajustar una grilla regular encima, que además clavó el BPM oficial donde librosa erraba por 1 BPM (casi
un segundo de desfase al final). (3) Un `throw` en el JS de una plantilla (una palabra que Whisper no
reconoció) dejó la composición sin registrar y `snapshot` mostró escenas vacías sin ningún error.

## Lección
Abrir toda plantilla en Chromium y verificar que `window.__timelines[id]` exista antes de un render
largo: HyperFrames no falla cuando el script de la composición tira, renderiza escenas vacías.

## Costo evitable
Un render de 20 min con los logos viejos y dos rondas de snapshots sobre una composición rota.
