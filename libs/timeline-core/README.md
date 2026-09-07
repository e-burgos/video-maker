# timeline-core

Lib de dominio TypeScript pura: fuente de verdad de los contratos de datos del motor de video
(`Timeline`, `EditDecisionList`, `Transcription`, `MediaAsset`, `AudioMixPlan`, `OutputFormat`) y
de los cálculos de edición que los producen y validan. Sin I/O, sin React, sin dependencia de
ninguna otra lib del repo.

Se importa por source vía el alias `@video-maker/timeline-core` (no tiene target `build`: no
necesita artefacto en `dist/`).

## Comandos

```bash
pnpm nx test timeline-core
pnpm nx lint timeline-core
```
