# voice-fit-repro — the resynthesis path for a line that needs to speed up

Date: 2026-09-25T22:02:52.632Z
Project: display-ads-editar-campana (temp clone, discarded after the run)
Script: work/producer/script.txt, voice es_AR-daniela-high, gapMs 900

## What this reproduces

Three real productions from the app (display-ads-editar-campana, display-ads-solapamiento-campanas,
display-ads-linea-de-tiempo, all under media/) failed 3/3 on their voice job with
`VOICE_SYNTHESIS_FAILED` at the `synthesize` stage. In every case the failing `resource` was the one
line whose window before the next `[m:ss]` mark (or, for linea-de-tiempo, before the next line) is
too tight for its natural speech duration, so `planVoiceScriptPlacements` schedules a resynthesis at a
slower `lengthScale` (clipped at `VOICE_SCRIPT_MIN_LENGTH_SCALE = 0.85`).

## Root cause (confirmed by instrumenting translateVoiceError and re-running the exact job)

`libs/media-local/src/tts/synthesize-speech.ts` passed `--vits-length-scale` and its value as two
separate argv entries (`['--vits-length-scale', String(opts.lengthScale)]`), the only flag in that
function not using the `--flag=value` form every other sherpa-onnx-offline-tts flag already uses.
sherpa-onnx-offline-tts's option parser (kaldi-style `parse-options.cc`) only accepts `--flag=value`
for its options; given two separate tokens it silently reads an empty string as the value and exits
255 with `Invalid floating-point option ""`. That real `CommandFailedError` was then swallowed by
`translateVoiceError`, which maps every failure of the `synthesize` stage to the generic
`VOICE_SYNTHESIS_FAILED` — hiding the argument bug behind a message that reads like a content problem.

This is deterministic: the FIRST synthesis pass never sets `lengthScale` (natural speed), so every
line's initial .wav always succeeds — that is why every project's `work/voice/sources/` already had
every line. The bug only fires on the SECOND pass, `fitTimedLinesIntoTheirWindows`, and only for the
one line that actually needs to shrink — matching "failed 3/3, same resource every time" exactly.

## Why the fix is "make it work", not a new error code

The pipeline already treats an unavoidable overflow as data, not failure: `planVoiceScriptPlacements`
reports `overflowMs` per line instead of throwing, `fitTimedLinesIntoTheirWindows` already falls back
to `VOICE_SCRIPT_MIN_LENGTH_SCALE` instead of refusing an extreme compression, and the constitution
documents the same "report the delta, do not fail" contract elsewhere (`withinTolerance: false` is
not a failure, D-7). A line that cannot fully fit even at 0.85 should still synthesize at 0.85 and
report the leftover via `overflowMs` — which is exactly what happens once the CLI call itself stops
failing. No new error code was needed.

## The fix

```diff
- opts.lengthScale === undefined || opts.lengthScale === 1
-   ? []
-   : ['--vits-length-scale', String(opts.lengthScale)];
+ opts.lengthScale === undefined || opts.lengthScale === 1
+   ? []
+   : [`--vits-length-scale=${opts.lengthScale}`];
```

## Before / after (this exact script, only that one line changed in between)

### Before the fix — swallowed error

```
job.state:  "failed"
job.error:  {"code":"VOICE_SYNTHESIS_FAILED","stage":"synthesize","message":"The speech synthesizer failed while producing a scene track.","resource":"line-07"}

# with translateVoiceError instrumented to log its `cause` before mapping it:
CommandFailedError: ... sherpa-onnx-offline-tts --vits-model=... --vits-length-scale 0.85 --output-filename=.../line-07.wav "La tarjeta vuelve a mostrar el horario de siempre." terminó con código 255.
  stderr: "/…/parse-options.cc:ToFloat:622 Invalid floating-point option \"\"\n"
```

### After the fix — this run

```
job.state:  "succeeded"
job.error:  null
manifest lines: 8
```

Media root of this run (discarded on exit): `/var/folders/lw/gy7lfk_52gq0fv1yvph2fb100000gn/T/vm-voice-fit-repro-xYTMZw`

- Voice job over a script whose tight line (`line-07`) needs the resynthesis path: **PASSED**