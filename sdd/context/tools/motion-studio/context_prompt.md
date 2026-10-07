# Contexto — tools/motion-studio

> Última actualización: 2026-10-07 (creación, spec-e-burgos-019 cycle-01)

## Estructura

```
tools/motion-studio/
  src/beats/       → grilla regular sobre los golpes de `hyperframes beats`
  src/timeline/    → escenas sobre la grilla (o libres) y ducking de la música
  src/voice/       → puntaje de inteligibilidad y mejor toma
  src/template/    → plantilla → index.html (tiempos, pistas, sfx, crédito)
  src/script/      → contrato de script.json
  src/deps/        → puertos y su implementación Node
  templates/<marca>/_brand + templates/<marca>/<video>/
```

## Comandos

`nx run motion-studio:cli -- <voice|plan|compose|render> <proyecto>`
