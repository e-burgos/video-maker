# SPEC-e-burgos-018: Productor sin Claude — modelos gratuitos, storyboard con OpenRouter y material libre

> Estado: **completed** — registrada el 2026-09-25, cerrada el 2026-09-26. Cuatro ciclos `lite`; versión 0.2.0
> publicada. Modelos gratuitos: no se recomiendan (decisión del dev tras el benchmark).
> Continúa `spec-e-burgos-017-desktop-app` (0.1.0 publicada en https://video.estebanburgos.com.ar);
> toma tres de sus `follow_ups` de cierre.

## Resumen Ejecutivo

La 0.1.0 deja usar el productor con OpenRouter a quien no tiene Claude, pero con tres huecos:

1. **Solo hay modelos pagos recomendados.** El benchmark de modelos `:free` quedó postergado porque la
   cuota diaria de gratuitos de la cuenta estaba agotada. Un amigo que no quiere cargar saldo no tiene
   una opción probada.
2. **El storyboard no anda sin Claude.** El job `storyboard` usa un agente propio sobre `claude -p` con
   salida estructurada; con OpenRouter como motor falla.
3. **No hay material libre para B-roll ni forma de mirar una foto.** El productor tiene música libre
   (`search_free_music`/`import_music`) pero no video ni imágenes, y `extract_frames` es solo para video:
   en la Receta Publicidad gasta llamadas probando cómo ver una imagen.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Modelos `:free` de OpenRouter recomendados, con métricas de un benchmark real (2/2 corridas) | cycle-01 (bench) + cycle-04 (corrida) |
| O-2 | El job `storyboard` corre sobre el motor efectivo del productor (Claude CLI u OpenRouter con salida estructurada), mismo contrato del documento | cycle-02 |
| O-3 | `search_free_media` + `import_media` (video e imágenes con licencia comercial, crédito automático en `work/credits.json`; Wikimedia Commons y NASA) y una herramienta para mirar una foto | cycle-03 |

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | Candidatos del benchmark = modelos `:free` **vivos** del catálogo con `tools` y entrada `image` | El escenario necesita ver frames; un modelo sin imagen no puede cumplirlo |
| D-02 | Tope de gasto total de la spec: **US$ 3** (benchmark + smokes) | Pedido del dev |
| D-03 | Un modelo entra como `free` solo si pasa **2/2** corridas del escenario real | Mismo criterio que los `cheap` de la 017 |
| D-04 | El storyboard reusa el puerto `AiAgentPort` existente: se suma un adaptador OpenRouter (Vercel AI SDK, salida estructurada) y se elige según `resolveEffectiveProducerEngine` | El contrato del documento (`StoryboardProposalSchema`) no cambia |
| D-05 | Fuentes de material libre sin API key: Wikimedia Commons (licencias CC0/CC BY/CC BY-SA/PD) y NASA Image and Video Library (dominio público) | Si una fuente necesita key, se consulta al dev antes |
| D-06 | Toda tool que devuelve imágenes va **sin `outputSchema`** | Claude Code descarta los bloques de imagen si hay `outputSchema` (lección del proyecto) |
| D-07 | Si la app cambia, la spec cierra con la versión **0.2.0** (`pnpm desktop:release --publish`) y merge a `main` + push, con confirmación del dev antes de publicar | Publicar es irreversible |

### Reordenamiento (2026-09-25)

El dev pidió el orden modelos gratuitos → storyboard → material libre. La cuota diaria de gratuitos de la cuenta
ya estaba en 0 al abrir cycle-01 (reset 00:00 UTC), y el gate no deja abrir otro ciclo con uno abierto: cycle-01
cerró con el bench listo, storyboard y material libre pasan a cycle-02 y cycle-03, y la corrida del benchmark con
la lista recomendada va en cycle-04.

## Fuera de alcance

- Probar la instalación en la Mac de un amigo (queda como follow-up de la 017).
- Fuentes de material que requieran API key o cuenta (Pexels, Pixabay, Unsplash) sin OK del dev.
- Timeline multipista (`spec-e-burgos-013`).
