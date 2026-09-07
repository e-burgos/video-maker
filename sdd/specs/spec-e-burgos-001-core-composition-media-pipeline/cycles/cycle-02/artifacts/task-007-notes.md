# TASK-007 — notas del implementador

- **No hay `whisper-cli` ni Faster-Whisper disponibles en el entorno de implementación.** Las
  fixtures `src/__fixtures__/whisper/whisper-cpp.json` y `faster-whisper.json` se reconstruyeron a
  mano, al pie de la letra de §6.6/§6.7 del `architect.md`: los 12 tokens de whisper.cpp (con
  `[_BEG_]` descartado, `" mues"`+`"tro"` → `muestro`, `" completo"`+`"."` → `completo.`) y los 8
  `words[]` de faster-whisper con los mismos `start`/`end` en segundos de la tabla. Ambas describen
  el mismo audio de referencia (`spanishTranscription` de `timeline-core`, primeras 8 palabras). Si
  en algún momento se graba una corrida real de ambos motores sobre el mismo `.wav`, reemplazar los
  dos archivos manteniendo los mismos 8 textos y un drift ≤ 20 ms — son los que arrastran CA-019
  (`toEqual` exacto de `words.map(w => w.text)` y la comparación de equivalencia).

- **`transcribeWithWhisperCpp` no reenvía `language: 'auto'` como override del parser.** El
  `architect.md` (§4.6) escribe literalmente
  `parseWhisperCppJson(raw, opts.assetId, { language, model: basename(modelPath) })`, pero el mismo
  apartado aclara a continuación: "`-l auto` ... activa su detección de idioma. El idioma detectado
  sale en el JSON y es el que termina en `Transcription.language`". Reenviar el literal `'auto'`
  como `opts.language` haría que `parseWhisperCppJson` lo tome como override por sobre
  `result.language`/`params.language` del JSON, y `'auto'` no matchea el regex de
  `TranscriptionSchema.language` (`^[a-z]{2}(-[A-Z]{2})?$`) — el wrapper rompería siempre con el
  default documentado. Implementado así: el wrapper solo incluye `language` en las opciones del
  parser cuando difiere del sentinel `DEFAULT_WHISPER_LANGUAGE` (`'auto'`); con el default, el
  idioma sale del JSON (fixture: `"es"`), que es exactamente el comportamiento que describe la
  segunda oración de §4.6. `model: basename(modelPath)` sí se reenvía siempre, sin condición,
  como pide la firma literal.

- **`src/fs/read-text-file.ts` (`ReadTextFile`, `nodeReadTextFile`) no estaba creado por ninguna
  task anterior** aunque D-13 y el árbol de `libs/media-local/` de §2 del `architect.md` ya lo
  declaran como parte de la estructura de la lib. Se crea en esta task porque es el único
  consumidor (`transcribeWithWhisperCpp`); se agregó también su test de cobertura en
  `src/fs/fs-ports.spec.ts` (mismo archivo que ya cubre `nodeBinaryLookup`, siguiendo D-04).
