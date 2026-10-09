# FIX-e-burgos-010 — Volumen de entrega en -14 LUFS, subtítulos legibles y mensaje de límite de YouTube

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-010 |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-10-08 |
| **Estado** | implemented |
| **Spec** | spec-e-burgos-022-youtube-publishing |

## Problema
- Los videos de material crudo con voz desde guion salían a ~-18 LUFS (objetivo -14): la voz se normaliza sola a -14
  sin contar los silencios entre líneas, la música suena en esos silencios y baja el integrado del máster, y nada
  normalizaba el máster mezclado.
- `subtle-lower` (texto blanco con sombra, sin fondo) no se leía sobre interfaces claras o fotos; en 9:16 el margen
  lateral de 20 % lo partía en cinco líneas de dos palabras.
- El error de YouTube `uploadLimitExceeded` (límite diario del canal) se mostraba como "cuota del proyecto".

## Solución
- `normalizeMasterLoudness` (media-local) mide el máster mezclado y, si está a más de 0,5 LU del objetivo o con el pico
  alto, aplica un loudnorm lineal de segunda pasada (sin `atrim`) con 0,5 dB de margen de pico para el AAC del MP4.
  Medido: -18,1 LUFS / -3,2 dBTP → -14,1 LUFS / -1,45 dBTP con `withinTolerance: true`.
- `subtle-lower` con caja oscura semitransparente redondeada y, en cuadros verticales, margen lateral tope de 6 %.
- Mensajes y guía hablan de límite del canal o cuota de la API, con el dato de verificar el canal.
