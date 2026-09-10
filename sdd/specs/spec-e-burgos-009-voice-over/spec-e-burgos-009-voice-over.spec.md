# SPEC-e-burgos-009: Voice Over: Locución Propia y Síntesis Local

> Estado: **draft** — esqueleto redactado al registrar el backlog generativo (2026-09-09).
> Se detalla al abrir su `cycle-01`.

## Resumen Ejecutivo

En el modo generativo no hay A-roll: nadie habló a cámara, así que no hay audio del que sacar
transcripción, duración ni ritmo. Esta spec le da voz al storyboard de `spec-008` por dos caminos
que conviven: **subir la locución propia** (el dev graba con su micrófono) o **sintetizarla
localmente** con Piper TTS, escena por escena, desde el campo `narration` del storyboard.

La voz es además el **reloj del video**: la duración real de cada escena sale del audio de esa
escena, no de la `estimatedDurationMs` que propuso el modelo. Por eso la locución se transcribe
con el Whisper que el repo ya usa, para alinear las captions palabra por palabra con lo que
efectivamente se escucha.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev (2026-09-09): **voz con Piper TTS local (voces español rioplatense)**,
dentro del flujo *guion/storyboard con IA → prompt visual por escena → visuales externos → voz en
off generada localmente → captions alineadas → música → render con Remotion*.

## Evidencia y decisiones

- **Evidencia (pedido del dev, 2026-09-09):** la voz se genera **localmente** con Piper TTS, sin
  API paga. Piper entra como binario configurable por `.env`, con el mismo patrón que
  `whisper-cli` ya usa hoy (`WHISPER_CPP_PATH` + `WHISPER_MODEL_PATH`).
- **Evidencia (referencia analizada: "Automatiza la Creación de Videos con IA", Camino Digital):**
  en el flujo del creador la voz se genera **después** del guion y **antes** del montaje, porque
  es lo que fija la duración de cada escena.
- **Evidencia (referencia analizada: "AI Code King clone with Remotion, Gemini & TTS", Ambsd):**
  el TTS por escena (y no un único archivo largo) es lo que permite regenerar una sola escena sin
  rehacer el video entero.
- **Evidencia (`libs/media-local/src/binaries/resolve-binaries.ts`, medida en `spec-007`):**
  `resolveBinaries(env)` ya resuelve cuatro binarios y el modelo de Whisper **no tiene fallback por
  `PATH`**. Piper y su voz siguen exactamente ese contrato, incluido su efecto en `GET /health`.
- **Evidencia (`libs/timeline-core`, roles de pista):** la `Timeline` ya distingue la pista `voice`
  con su `VoiceTarget` de loudness (`spec-004`). La locución sintetizada entra por esa pista, no
  por una nueva.
- **Decisión heredada:** cero dependencias npm salvo justificación escrita; todo I/O por puertos
  inyectables; la suite corre sin binarios.

## Plan de ciclos (previsto)

| Ciclo | Fase | Flow | Qué entrega |
| --- | --- | --- | --- |
| **cycle-01** | `voice-backend` | `lite` | Rol `voice` en la subida de assets; Piper TTS como binario configurable resuelto por `media-local`; job `kind: 'voice'` que sintetiza una pista por escena desde `work/storyboard.json`, la transcribe con Whisper para alinear captions y deja las pistas en `work/voice/`; errores tipados y contrato en `sdd/api.json`. |
| **cycle-02** | `voice-studio` | `lite` | En `apps/web`: selector de voz, regeneración por escena, uso de la locución subida en lugar de la sintetizada, y reproducción de cada pista antes de ensamblar. |

## Requisitos Funcionales previstos (RF)

- **RF-1:** La biblioteca de assets acepta el rol `voice` para subir locución propia.
- **RF-2:** Piper TTS se resuelve como binario configurable por `.env` (ruta del ejecutable y ruta
  del modelo de voz), con el mismo contrato de `whisper-cli`, y se reporta en `GET /health`.
- **RF-3:** Un job `kind: 'voice'` sintetiza **una pista de audio por escena** desde el campo
  `narration` del storyboard, con la voz elegida y el idioma del documento.
- **RF-4:** Cada pista sintetizada se transcribe con Whisper para producir palabras con timing, de
  modo que las captions de esa escena estén alineadas con lo que se escucha.
- **RF-5:** La duración real de cada pista se persiste en el storyboard y reemplaza a
  `estimatedDurationMs` como fuente de verdad de la duración de la escena.
- **RF-6:** Una escena puede regenerarse sola, sin rehacer las demás.
- **RF-7:** Si el usuario subió locución propia para una escena, esa pista gana sobre la
  sintetizada, y la decisión es explícita y visible.
- **RF-8:** El progreso del job se reporta por escena, y la cancelación es cooperativa.

## Requisitos No-Funcionales previstos (RNF)

- **RNF-1:** Sin APIs pagas ni red: Piper corre local, por `CommandRunner` inyectable.
- **RNF-2:** La suite corre sin Piper, sin Whisper y sin red.
- **RNF-3:** Cero dependencias npm nuevas salvo justificación escrita.
- **RNF-4:** `lint test build` en verde sin warnings; cobertura por encima del piso.
- **RNF-5:** Sin comentarios en el código; payloads y README en inglés.

## Dependencias

- Subproyectos previstos: `apps/render-api`, `apps/web`, `libs/media-local`.
- `spec-e-burgos-008-ai-storyboard` — el documento del que se sintetiza.
- `spec-e-burgos-004-audio-mix-mastering` — completed (pista `voice`, normalización a -14 LUFS).
- Herramienta externa: Piper TTS instalado en la máquina, con al menos una voz en español
  rioplatense.

## Criterios de Aceptación previstos (CA)

- **CA-001:** Un test verifica que la síntesis produce una pista por escena, con el texto de esa
  escena y ninguna otra.
- **CA-002:** Un test verifica que la duración de la escena pasa a derivarse del audio real.
- **CA-003:** Un test verifica que la locución subida gana sobre la sintetizada cuando existe.
- **CA-004:** Un test verifica el progreso monotónico por escena y la cancelación cooperativa.
- **CA-005:** Smoke real ejecutado con Piper y Whisper reales sobre una copia temporal del media
  root, con la evidencia en `artifacts/`.
