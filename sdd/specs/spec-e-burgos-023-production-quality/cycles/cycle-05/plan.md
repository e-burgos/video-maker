# spec-e-burgos-023-production-quality — cycle-05 · plan (lite)

> Módulo: production-quality | Subproyectos: libs/media-local, libs/timeline-core, libs/auto-montage, apps/render-api,
> libs/producer-tools, apps/web | Fecha: 2026-10-12
> Objetivo: "un video como este": de un archivo local de referencia sale un brief (transcripción, escenas, ritmo,
> cuadros clave) que el productor usa para proponer. Sólo archivos locales (D-06). Sin código de OpenMontage.

## Historias
- US-023-501 — Como dev quiero subir un video de referencia. CA: rol de asset `reference` (`raw/reference/`), aceptado
  por la subida, la bandeja de entrada y el catálogo; el montaje automático y la revisión lo ignoran. No hay descarga
  por URL.
- US-023-502 — Como dev quiero que la referencia se analice sola. CA: job `reference` `{file}` deja
  `work/reference/<nombre>.brief.json` (`ReferenceBrief`): duración, formato (ancho, alto, fps, orientación), escenas
  por detección de cortes de ffmpeg (inicio, fin, duración, cuadro clave `work/reference/<nombre>/scene-NN.jpg` en la
  mitad de cada escena), ritmo (cortes por minuto, duración media/mediana de escena), voz (transcripción whisper con
  tiempos por frase, palabras por minuto, proporción del video con habla), audio (loudness integrado, silencios
  largos) y un resumen textual armado sin IA. Etapas `probe`/`scenes`/`transcribe`/`keyframes`/`persist` con progreso.
- US-023-503 — Como dev quiero que el productor lo use. CA: tool `get_reference_brief` (lista los briefs del proyecto
  o devuelve uno) y `start_job` acepta `reference`; el prompt indica analizar la referencia si existe y basar la
  propuesta (`propose_production`) en su ritmo, duración y estructura, nombrando la referencia en el `angle`.
- US-023-504 — Como dev quiero ver el análisis. CA: en la Biblioteca, la referencia tiene "Analizar" y, una vez
  analizada, un panel con el resumen, el ritmo, la voz y la tira de escenas con su cuadro clave y tiempos.

## Tasks (detalle en tasks.json)
- TASK-001 — media-local: `detectSceneCuts` (ffmpeg `select='gt(scene,T)',showinfo`) y helpers de keyframes;
  timeline-core: `ReferenceBrief` + schema; rol `reference` en catálogo/ingesta/store.
- TASK-002 — render-api: job `reference`, `GET /projects/:slug/references` y `GET .../references/:name`.
- TASK-003 — producer-tools: tool `get_reference_brief`, `start_job` reference, prompt.
- TASK-004 — web: rol en subida/bandeja, "Analizar" y panel del brief.
- TASK-005 — verificación con un video real del estudio.

## Decisiones técnicas
- Umbral de corte 0,3 con escena mínima de 0,4 s (cortes más cercanos se funden).
- El resumen es determinista (plantilla con los números), no lo escribe una IA: el productor ya interpreta.
