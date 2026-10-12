# Verificación — spec-e-burgos-023 cycle-03 (2026-10-12)

## Web (studio real, rama feat/production-quality-voice)
- `/projects/display-ads-subir-medios/voice`: barra "Dirección de voz" con contador, "Guardar dirección", "Regenerar
  voz con la dirección" y, por línea, ritmo / energía / pausa / chips de énfasis (captura `web-direccion-voz.jpg`).
  No se guardó nada sobre el proyecto aprobado.
- `/projects/display-ads-presentacion/storyboard` (motion): selector "Modo de música" (Cama continua / Por tramos) y
  editor de dirección en las 11 escenas, con "Guardar cambios" y "Regenerar video con los cambios".
- `GET /projects/display-ads-subir-medios/voice/direction` → 7 líneas, `directions: {}`.

## A/B real (copia de la presentación en `.motion-work/c3-ab/`, CLI de motion)
- Escena `hook` con `{pace: slow, energy: lively, pauseAfterMs: 400}`: `vo-hook.wav` pasó de 5,01 s a 5,90 s
  (lengthScale ×1,12 + 0,4 s de pausa); Whisper la transcribió con 0,973.
- `music.mode: segments`, `floorDb: -30`: la automatización deja la música en 0,0158 (= 0,5 × -30 dB) mientras se
  habla y la sube a 0,5 en los huecos ≥ 2 s con fundidos de 0,6 s.
- Render final 84,4 s, máster -14,8 LUFS. Tramos medidos sobre el MP4: con voz -11,1 y -14,6 LUFS; hueco sin voz
  (música sola) -17,8 LUFS → la música acompaña sin tapar.
- Sin dirección y con `bed`, la línea de comando de sherpa, el manifiesto de voz y la automatización son idénticos a
  los previos (tests); VITS no es determinista en bytes, por eso el invariante se fija sobre los parámetros.
