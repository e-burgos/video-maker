# spec-e-burgos-018-producer-free-tier cycle-04 — 2026-09-26

## Estado
La voz fallaba siempre que una línea tenía que acelerarse para entrar en su ventana (defecto previo, presente en 0.1.0).

## Estructura
`tts/synthesize-speech.ts`: `--vits-length-scale=<n>` en un solo argumento. sherpa-onnx (parser estilo kaldi) solo
acepta `--flag=valor`: con dos argumentos lee un valor vacío y sale 255. Todo flag nuevo de sherpa va con `=`.

## Dependencias
Sin cambios.

## Qué sigue
Nada pendiente.
