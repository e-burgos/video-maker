# SPEC-e-burgos-023: Calidad de producción — control automático, escena de UI, dirección de voz, propuesta y referencia

> Estado: **in-progress** — registrada el 2026-10-11; reabierta el 2026-10-12 para el ciclo 06 (criterio visual), tras
> el video de prueba «cómo comprar un equipo de Display Ads».
> Pedido del dev: incorporar a video-maker las ideas que suman de la revisión de OpenMontage (calesthio/OpenMontage,
> AGPL-3.0). **Ninguna línea de código de OpenMontage entra al repo**: video-maker se distribuye como app de escritorio
> y la AGPL obligaría a liberarlo. Sólo se reimplementan ideas con diseño propio.

## Situación actual

- El control de calidad es manual: hojas de contacto, `check-todos-listos.py` fuera del repo y escucha del dueño. Se
  publicaron 5 videos motion con la música tapando la voz (FIX-e-burgos-015) porque sólo se medía el máster.
- El catálogo motion (16 escenas) no tiene una escena para explicar una interfaz con cursor, clics y resaltados.
- La voz (Piper) se sintetiza frase por frase sin intención, ritmo ni pausas dirigidas.
- El productor arma guion y storyboard sin presentar alternativas, costo ni una muestra antes del render completo.
- No hay forma de pedir "un video como este" a partir de un video de referencia.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Revisión automática de cada render (pre y post): niveles de voz y música por tramo, máster y pico, duración, cuadros negros o congelados, silencios largos, subtítulos fuera de la zona segura, recursos faltantes; hallazgos con severidad (crítico / sugerencia / detalle) y arreglo propuesto, visibles en el estudio y para el productor | cycle-01 |
| O-2 | Contrato de entrega del video (tutorial con grabación, motion animado, etc.): lo que se promete en el plan se verifica en la revisión y no se degrada en silencio | cycle-01 |
| O-3 | Escena de interfaz en motion: captura de UI con cursor que se mueve, clics, escritura, resaltado y globo explicativo, en coordenadas normalizadas | cycle-02 |
| O-4 | Dirección de voz por frase (intención, ritmo, energía, pausas, énfasis) escrita por el productor y aplicada al motor de voz; música por tramos con fundidos en lugar de una cama continua | cycle-03 |
| O-5 | Propuesta con aprobación: el productor presenta 2–3 enfoques con duración, costo y tiempo estimados y genera una muestra corta antes del render completo | cycle-04 |
| O-6 | Video de referencia: a partir de un archivo local, transcripción, escenas, ritmo y cuadros clave en un brief que el productor usa para proponer | cycle-05 |
| O-7 | Criterio visual: el productor mira y califica todo el material antes de proponer y avisa si no encaja con la idea, usa las posiciones dadas sin estimarlas, revisa el render escena por escena con evidencia, resaltados sobrios y lecciones del video de prueba | cycle-06 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | Reimplementación propia, sin copiar ni traducir código de OpenMontage | Licencia AGPL-3.0 vs. app de escritorio distribuida |
| D-02 | El análisis de audio mide **cada pista por separado** (voz y música con su ganancia/automatización declarada en la Timeline o en la timeline motion) y exige ≥15 dB de margen voz/música bajo la voz | Lección de FIX-e-burgos-015: el integrado del máster no ve el balance |
| D-03 | La revisión es un job `review` de la cola de render-api que deja `out/<render>.review.json`; el render la dispara solo al terminar | Mismo modelo que render/montaje; queda junto al MP4 |
| D-04 | Severidades `critical` / `suggestion` / `nitpick`; un `critical` bloquea la publicación desde el estudio y la cola (con override explícito del dev) | Evita publicar algo roto sin depender de la memoria del operador |
| D-05 | Todas las mediciones con ffmpeg/ffprobe/whisper ya presentes en el toolchain local; sin servicios nuevos | Local-first, sin costo |
| D-06 | El video de referencia sólo se acepta como archivo local (sin descargar de plataformas) | Términos de servicio de YouTube/TikTok |
| D-07 | Ciclos `lite` verificados contra renders reales de la tanda Display Ads | Igual que spec-021/022 |
