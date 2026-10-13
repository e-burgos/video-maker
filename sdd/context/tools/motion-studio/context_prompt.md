# Contexto — tools/motion-studio

> Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## Estructura

```
tools/motion-studio/
  src/deps/        → puertos y su implementación Node (Claude CLI, HyperFrames, marcas)
  src/errors/
  templates/<marca>/_brand + templates/<marca>/<video>/
```

## Comandos

`nx run motion-studio:cli -- <init|voice|plan|compose|render|storyboard|auto> <proyecto>` (la lógica vive en
`libs/motion-graphics`; ver `constitution.md` §4).
