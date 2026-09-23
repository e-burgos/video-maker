# TASK-001 — Packaging spike (Apple Silicon, sin Homebrew)

> Máquina: macOS 26.4, arm64 (Apple Silicon), Xcode CLT 26.6. Homebrew presente en la máquina del
> dev, usado solo como **toolchain de build** (`cmake`, `ninja`) — ninguna de sus rutas queda en las
> piezas empaquetadas. Todo el trabajo corrió en un scratchpad fuera del repo; nada de lo probado
> toca `apps/` ni `libs/`.

## Veredicto por pieza

| # | Pieza | Veredicto |
| --- | --- | --- |
| 1 | ffmpeg / ffprobe | ✅ **OK** — build estática, misma forma de comando que el pipeline |
| 2 | whisper.cpp (`whisper-cli`) | ✅ **OK** — estático, Metal embebido, JSON idéntico al que espera el parser |
| 3 | piper (standalone / pip) | ❌ **BLOQUEADO** — ninguna de las dos vías probadas sintetiza voz en Apple Silicon |
| 3b | sherpa-onnx (`sherpa-onnx-offline-tts`, voces `vits-piper-*`) | ✅ **OK** — alternativa que sí funciona, mismas voces, sin Homebrew |
| 4 | Remotion (bundle + render separados) | ✅ **OK** — bundle una vez, render en otro proceso solo con `serveUrl` + Chrome propio |
| 5 | better-sqlite3 en Electron | ✅ **OK** — recompilado con `@electron/rebuild`, funciona en ambos modos |
| 6 | Bonus: matar el grupo de procesos | ✅ **OK** — `process.kill(-pgid)` mata el árbol completo |

**Consecuencia directa de D-C3-01: la pieza 3 (piper, tal como lo usa hoy `synthesizeSpeech`) está
bloqueada.** Pero la sección 3b prueba una alternativa que **sí funciona de punta a punta** con las
tres voces del proyecto: `sherpa-onnx-offline-tts`. El resto de las piezas (1, 2, 4, 5, 6, y ahora
3b) están probadas y listas para que TASK-002 las vendorice. Falta que el dev decida entre migrar
`synthesizeSpeech`/`resolve-binaries.ts` a sherpa-onnx (cambio de contrato del binario) o invertir en
arreglar piper (sección 3, opción 1).

---

## 1) ffmpeg / ffprobe

| Campo | Valor |
| --- | --- |
| Fuente | martin-riedl.de, redirect `latest/macos/arm64/release` (build resuelta y fijada abajo) |
| Versión resuelta | **9.0.2** (`https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/`) |
| URL ffmpeg | `https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffmpeg.zip` |
| URL ffprobe | `https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffprobe.zip` |
| sha256 ffmpeg.zip | `c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924` |
| sha256 ffprobe.zip | `fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6` |
| sha256 ffmpeg (binario extraído) | `2e11c6f90993cdb79fff84d3f90044d28316b310e75b3e030cfc9a54f2c9d384` |
| sha256 ffprobe (binario extraído) | `2738aa46a7f9acbc8ab09a6715554c90f7de603171ac403726765685df6a0059` |
| Tamaño | ffmpeg 63.3 MB, ffprobe 63.1 MB (sin comprimir) |
| Licencia | **GPL** (confirma D-C3 del plan: `--enable-gpl --enable-libx264 --enable-libx265`, no LGPL) |
| Firma | Firmado (`codesign -dv` muestra `flags=0x10000(runtime)`, formato `Mach-O thin (arm64)`) |

`otool -L` en ambos binarios: solo frameworks de sistema (`Foundation`, `AudioToolbox`, `CoreAudio`,
`libSystem.B.dylib`, `AVFoundation`, etc.) — **cero rutas de Homebrew**.

`-filters` / `-encoders` confirman todo lo que usa el pipeline: `loudnorm`, `amix`, `adelay`,
`apad`, `alimiter`, `zoompan`, `concat`, `libx264`, `aac`.

Mini pipeline corrida con la misma forma de comando que usan `ken-burns-clip.ts`,
`build-audio-mix-graph.ts` y `mux-audio-into-video.ts`:

1. `testsrc`+`sine` → `loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json` → `-c:v libx264 -c:a aac` →
   mp4 de 60 frames, 640×360, `codec_name=h264`/`aac`. **OK**, 0.24s.
2. Ken Burns sobre un jpg: `scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,
   zoompan=z=min(zoom+0.0015\,1.25):d=60:s=1080x1920:fps=30,format=yuv420p` → mp4 1080×1920,
   `nb_frames=60`. **OK**, 0.5s.
3. Mix `amix`/`adelay`/`apad`: dos tonos con `adelay=500:all=1` y `adelay=0:all=1` →
   `amix=inputs=2:duration=longest:normalize=0,apad=whole_dur=3000ms` → `aac`, `duration=3.000000`.
   **OK**, 0.04s.

**Decisión:** vendorizar esta build fijada (9.0.2, ambos sha256 arriba) en TASK-002. Ojo con el
aviso GPL en `THIRD_PARTY_NOTICES.md` (ya lo anticipaba D-C3 del plan).

---

## 2) whisper.cpp (`whisper-cli`)

| Campo | Valor |
| --- | --- |
| Fuente | `github.com/ggml-org/whisper.cpp`, tag fijo |
| Tag / commit | **v1.7.6** / `a8d002cfd879315632a579e73f0148d06959de36` |
| Build | `cmake -DBUILD_SHARED_LIBS=OFF -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_EXAMPLES=ON`, target `whisper-cli` |
| sha256 binario | `242f4630b9bcb0103c4cb6ccba27066ceb7a3d3a4ea294541b1d87e391c8347a` |
| Tamaño | 2.4 MB |
| Licencia | MIT |
| Tiempo de build | 26.9s (10 cores) |
| cmake / Xcode CLT | **cmake no estaba instalado** (se instaló vía Homebrew solo como herramienta de build, `brew install cmake` → 4.4.3; Xcode CLT 26.6 ya estaba). Ninja no hizo falta para whisper.cpp. |

`otool -L build/bin/whisper-cli`: solo `Accelerate.framework`, `Metal.framework`, `MetalKit.framework`,
`Foundation`, `CoreFoundation`, `libc++`, `libobjc`, `libSystem.B.dylib` — **cero Homebrew**, y el
binario quedó ad-hoc firmado (`Format=Mach-O thin (arm64)`).

Transcripción corrida con los mismos args que `transcribe-with-whisper-cpp.ts`
(`-m <model> -f <wav> -oj -ml 1 -l auto -of <outBase>`), contra `WHISPER_MODEL_PATH` del `.env`
(`ggml-large-v3-turbo-q5_0.bin`, 547 MB) y un wav de prueba en español de 5.5s generado con
`say -v Paulina` + resample a 16kHz mono con la propia ffmpeg de la sección 1:

- `system_info` confirma `Metal : EMBED_LIBRARY = 1` y `ACCELERATE = 1` activos.
- Detección automática de idioma: `es` (p = 0.999352).
- JSON de salida con la forma exacta que espera `parseWhisperCppJson` (`model`, `params`,
  `result.language`, `transcription[].{timestamps,offsets,text}`).
- **Tiempo total: 25.8s** para 5.5s de audio (carga del modelo 547 MB desde disco + encode
  2.5s + decode). El grueso es I/O de carga del modelo, no cómputo — relevante para UX del primer
  render tras abrir la app.

**Decisión:** vendorizar el binario compilado en TASK-002 (tag v1.7.6 fijo, sha256 arriba). cmake
queda documentado como dependencia de **build** (Homebrew, en la máquina del dev), no de runtime.

---

## 3) piper — BLOQUEADO

Se probaron las dos vías que contempla el plan. Ninguna sintetiza voz en Apple Silicon sin
Homebrew.

### Intento A — release C++ standalone (`rhasspy/piper`, `2023.11.14-2`, `piper_macos_aarch64.tar.gz`)

| Campo | Valor |
| --- | --- |
| URL | `github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz` |
| sha256 | `6b1eb03b3735946cb35216e063e7eebcc33a6bbf5dd96ec0217959bf1cdcb0cc` |
| Tamaño | 18.3 MB |

Falla en dos frentes independientes:

1. **Arquitectura mal etiquetada**: `lipo -info` en `piper`, `piper_phonemize` y `espeak-ng`
   reporta **`x86_64`**, no `arm64`, pese al nombre del archivo (`*_aarch64.tar.gz`). Solo corre
   bajo Rosetta 2 (confirmado disponible en esta máquina), lo cual ya de por sí contradice "sin
   depender de Rosetta para un binario nativo".
2. **Faltan las dylibs**: el binario `piper` linkea `@rpath/libespeak-ng.1.dylib` y
   `@rpath/libpiper_phonemize.1.dylib` (`otool -L`), pero **el `.tar.gz` no trae ningún `.dylib`**
   (`tar tzf ... | grep .dylib` → vacío, ni siquiera el `.dSYM` de onnxruntime tiene el binario
   real). Al ejecutar: `dyld[…]: Library not loaded: @rpath/libespeak-ng.1.dylib` → exit 134.

Este release está roto para macOS arm64: ni la arquitectura ni el paquete de dependencias son los
que promete el nombre del archivo.

### Intento B — `pip install piper-tts` (piper1-tts, el rewrite activo en OHF-voice/piper1-gpl)

| Campo | Valor |
| --- | --- |
| Python | `python-build-standalone` `20260901`, `cpython-3.11.16-aarch64-apple-darwin-install_only_stripped.tar.gz` |
| sha256 python | `768f05cf200273bbdda9a5955a5a6892a4b22f2a0b1e4b0a9160f5c7fce86816` |
| Tamaño python | 27.0 MB |
| piper-tts | `1.8.0` (wheel `piper_tts-1.8.0-cp39-abi3-macosx_11_0_arm64.whl`, nativo arm64, 34.1 MB) |
| Args CLI | `-m/--model`, `-i/--input-file`, `-f/--output-file`, `--length-scale` → **coinciden exacto** con `synthesizeSpeech` |

Falla en runtime con las tres voces (`es_AR-daniela-high`, `es_ES-davefx-medium`,
`es_MX-claude-high`):

```
Error processing file '/Users/runner/work/piper1-gpl/piper1-gpl/_skbuild/macosx-11.0-arm64-3.9/
cmake-build/espeak_ng-install/share/espeak-ng-data/phontab': No such file or directory.
```

**Causa raíz:** `espeakbridge.so` (extensión nativa compilada) tiene **hardcodeada la ruta del CI**
donde se generó la wheel. La ruta Python-side es correcta (`piper/phonemize_espeak.py` calcula
`ESPEAK_DATA_DIR = Path(__file__).parent / "espeak-ng-data"`, que sí existe y apunta bien), pero
`espeakbridge.initialize()` la ignora — el string de la ruta rota está embebido en el `.so`
(confirmado con `strings espeakbridge.so`).

Se probaron dos mitigaciones, ninguna viable:

- **Variable `ESPEAK_DATA_PATH`**: el símbolo existe en el binario pero no tiene efecto — el mismo
  error persiste.
- **Recrear la ruta rota** (`mkdir -p /Users/runner/work/piper1-gpl/...`): `Permission denied` —
  requiere root para escribir bajo `/Users/runner`, y aun si funcionara en la máquina del dev, **no
  es viable en la máquina de un amigo** (no tiene ese usuario ni permisos de escritura ahí).

El mismo bug aparece igual en `piper-tts==1.7.0` (versión anterior), así que no es una regresión
puntual de `1.8.0`.

### Intento C — compilar `piper-tts` desde el sdist (`pip install --no-binary`)

Con `cmake` y `ninja` instalados (Homebrew, solo build), `pip install --no-binary piper-tts
piper-tts==1.8.0` **no compila la extensión nativa**: produce una wheel `piper_tts-1.8.0-py3-none-any.whl`
(pura Python, sin `espeakbridge.so` — se verificó que el archivo no existe en el `site-packages`
resultante). Al ejecutar, la fonemización falla en silencio y el WAV queda vacío:
`wave.Error: # channels not specified`. Este build no completa el compilado nativo de espeak-ng con
las herramientas disponibles sin más investigación (probablemente falten dependencias de autotools
para compilar espeak-ng desde cero, fuera del alcance de este spike).

### Qué significa esto para el ciclo

Las tres vías previstas en el riesgo del plan ("no acepta los argumentos" / "no carga las voces")
se confirman, pero por una razón distinta a la esperada: **no es un problema de argumentos ni de
carga de modelo — es el propio artefacto de piper (en sus dos distribuciones oficiales para macOS
arm64) el que está roto**. No hay una tercera opción evidente sin invertir en compilar piper1-gpl +
espeak-ng desde cero contra una ruta de datos relativa (trabajo de build no trivial, requiere
autotools/libtool para espeak-ng además de cmake/ninja).

**Recomendación para decidir con el dev antes de TASK-002** (actualizada tras probar la sección
3b — ver ahí el detalle de por qué sherpa-onnx pasó de ser "una alternativa a evaluar" a "una
alternativa que ya está probada y funcionando"):

1. **[Recomendada] Migrar a `sherpa-onnx-offline-tts` con las voces `vits-piper-*`** (sección 3b):
   arm64 nativo, estático, sin Homebrew, sin Rosetta, las tres voces del proyecto disponibles,
   `--vits-data-dir` relativo confirmado relocalizable, e inteligibilidad equivalente a piper por
   transcripción cruzada con whisper-cli. El costo es un cambio de contrato en
   `synthesizeSpeech`/`resolve-binaries.ts` (forma de argumentos distinta, ver decisión al final de
   la sección 3b) — no es gratis, pero es una task acotada de TASK-003, no un yak-shave de build.
2. Compilar `piper1-gpl` (y su espeak-ng vendorizado) desde el código fuente real del proyecto
   (no vía `pip`), fijando `ESPEAKNG_DEFAULT_DATA_PATH` en el propio `cmake configure` a una ruta
   relativa válida — esto es trabajo de build serio, no una task de una tarde, y no se ganaría nada
   frente a la opción 1 salvo mantener la firma de argumentos actual de `synthesizeSpeech`.
3. Compilar `rhasspy/piper` C++ (el repo clásico, no `piper1-gpl`) desde fuente con su flag
   `--espeak_data` — evaluado sin construirlo (ver sección 3b, "Fallback descartado"): en principio
   viable (CMake trae espeak-ng vía `FetchContent`), pero sherpa-onnx ya resuelve lo mismo hoy,
   probado, así que no se justifica invertir ahí primero.
4. Aceptar Rosetta 2 como dependencia del `.dmg` únicamente si se resuelve el problema de dylibs
   faltantes del release C++ oficial — contradice el objetivo "sin depender de nada instalado" si
   Rosetta no está presente en la máquina del amigo, y ya no hace falta con la opción 1 disponible.

---

## 3b) sherpa-onnx — alternativa de síntesis de voz (funciona)

`sherpa-onnx-offline-tts` (k2-fsa/sherpa-onnx) ejecuta modelos VITS de Piper vía ONNX Runtime, con
binarios prebuilt para macOS y licencia Apache-2.0. Se probó como alternativa a piper dado que la
sección 3 quedó bloqueada.

### CLI

| Campo | Valor |
| --- | --- |
| Fuente | `github.com/k2-fsa/sherpa-onnx`, release `v1.13.8` |
| Asset | `sherpa-onnx-v1.13.8-osx-arm64-static.tar.bz2` (**static**, incluye TTS — hay variantes `-shared`/`-no-tts` que no sirven acá) |
| URL | `https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-arm64-static.tar.bz2` |
| sha256 (tar.bz2) | `d97d56f677168b0a35cf96e587f65e4f036fe5776e40476e4f84e3f47cd4d978` |
| sha256 (`bin/sherpa-onnx-offline-tts`) | `1c586d73f0ac440f19ee02e3198fdcd45db5406d78c0d143715c797dac299198` |
| Tamaño binario | 28 MB (`arm64` puro, `lipo -info` confirma) |
| Licencia | **Apache-2.0** (confirmado en el repo de GitHub) |

`otool -L` en `sherpa-onnx-offline-tts`: solo `libSystem.B.dylib`, `Foundation.framework`,
`libc++.1.dylib`, `CoreFoundation.framework` — **cero Homebrew**. El paquete trae todas las libs
(`libonnxruntime.a`, `libespeak-ng.a`, `libpiper_phonemize.a`, etc.) como **estáticas** (`.a`), no
hay ningún `.dylib` propio que gestionar.

### Voces (`vits-piper-<voz>`, release `tts-models` del mismo repo)

Las tres voces del proyecto están publicadas, ninguna falta:

| Voz | Archivo | URL | sha256 | Tamaño (comprimido / extraído) | Licencia (de su `MODEL_CARD`) |
| --- | --- | --- | --- | --- | --- |
| es_AR-daniela-high | `vits-piper-es_AR-daniela-high.tar.bz2` | `github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_AR-daniela-high.tar.bz2` | `71cbf6b7f646ab74f3c51336151abef41e6c54467ac929ffdb19ed706a07dd7b` | 115.5 MB / 131 MB | Dataset **CC-BY-SA 4.0** (openslr.org/61) — modelo entrenado por `larcanio/piper-voices` |
| es_ES-davefx-medium | `vits-piper-es_ES-davefx-medium.tar.bz2` | `github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-davefx-medium.tar.bz2` | `a3f6beb54a9cb893279f72978a22f807a4d9fc9c7848157b524d5cc7b7f58b22` | 67.2 MB / 79 MB | Dataset **CC0** (NabuCasa/voice-datasets) |
| es_MX-claude-high | `vits-piper-es_MX-claude-high.tar.bz2` | `github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2` | `ec33fb689c248fe64810aab564cba97babf0f506672cfd404928d46e751a4721` | 67.2 MB / 79 MB | **Apache-2.0** (HirCoir/Piper-TTS-Spanish) |

Cada archivo trae su propio `<voz>.onnx` (61–113 MB, tamaño casi idéntico al `.onnx` crudo que ya
usa el proyecto), `tokens.txt` y una copia de `espeak-ng-data` — las tres copias de
`espeak-ng-data` son redundantes entre sí (mismo contenido), TASK-002 puede deduplicarlas y quedarse
con una sola copia compartida para ahorrar ~30 MB en el vendor final.

### Prueba de ejecución

Comando (misma forma para las tres voces, `--vits-length-scale` en 1.0 y 0.85):

```
sherpa-onnx-offline-tts \
  --vits-model=<voz>.onnx --vits-tokens=tokens.txt --vits-data-dir=espeak-ng-data \
  --vits-length-scale=<1.0|0.85> --output-filename=out.wav "<oración>"
```

Las 6 combinaciones (3 voces × 2 `length-scale`) corrieron **OK**. `es_AR-daniela-high` (voz "high",
modelo más grande) tarda ~2.8–2.9s con RTF≈0.92; `es_ES-davefx-medium` y `es_MX-claude-high` (voces
"medium") tardan ~0.4–0.5s con RTF≈0.13 — mucho más rápidas, consistente con ser modelos más chicos.

**Ruta relativa/relocalizable confirmada:** se movió la carpeta completa de la voz
`es_AR-daniela-high` (modelo + `tokens.txt` + `espeak-ng-data`) a otra ubicación del scratchpad
(`relocated/moved-daniela/`) y se corrió el mismo comando con `--vits-data-dir` apuntando a la
nueva ubicación relativa — **funcionó igual**, mismo audio (69120 samples). Esto es exactamente lo
que piper (sección 3) no puede hacer: acá `--vits-data-dir` sí es una ruta real que se respeta en
runtime, sin nada hardcodeado en el binario.

### Comparación contra Python piper (referencia)

La sección 3 no dejó ningún WAV válido de piper para comparar (las tres vías fallaron con audio
vacío o no corrieron). Se usó como referencia la instalación **existente y hoy funcional** del dev
(`PIPER_PATH=/Users/macbookprom2/Library/Python/3.11/bin/piper` del `.env`, el paquete Python que
usa `pnpm studio` hoy vía Homebrew Python — no forma parte de lo que se está empaquetando, pero es
la única fuente de verdad disponible para comparar) con la misma oración y `--length-scale 1.0`:

| Voz | Duración sherpa-onnx | Duración piper (ref.) | Diferencia | Sample rate (ambos) |
| --- | --- | --- | --- | --- |
| es_AR-daniela-high | 3.135s | 3.181s | 1.4% | 22050 Hz, mono |
| es_ES-davefx-medium | 3.460s | 3.495s | 1.0% | 22050 Hz, mono |
| es_MX-claude-high | 4.027s | 4.168s | 3.4% | 22050 Hz, mono |

Duraciones y sample rate prácticamente iguales (diferencias de 1-3%, esperables entre dos runtimes
ONNX distintos para el mismo modelo VITS).

**Chequeo "escucha-proxy" con `whisper-cli` (sección 2, mismo modelo y args):** se transcribieron
los 6 WAV (3 voces × sherpa-onnx / piper-referencia). El texto coincide **palabra por palabra**
entre ambos motores para las tres voces (incluyendo los mismos aciertos/errores de whisper en
"síntesis" y en el nombre propio "video maker", que ninguno de los dos motores/voces pronuncia de
forma que whisper reconozca como esas dos palabras — comportamiento esperado, no es un problema de
sherpa-onnx). Ejemplo (`es_AR-daniela-high`):

- sherpa-onnx: *"Hola, esto es una prueba de sintesis de voz para el video Macar."*
- piper (ref.): *"Hola, esto es una prueba de sintesis de voz para el videomacar."*

Mismo patrón en las otras dos voces. **Conclusión: inteligibilidad equivalente entre sherpa-onnx y
piper para las tres voces del proyecto.**

### Fallback descartado (no se construyó, solo evaluado)

Compilar `rhasspy/piper` C++ desde código fuente para arm64 (tiene un flag `--espeak_data` que
recibiría una ruta relativa real, evitando el bug de la sección 3) es **viable en principio** —su
CMake trae espeak-ng como dependencia de build vía `FetchContent`, no requiere autotools a mano—
pero es un yak-shave de build completo sin garantía de éxito a la primera, y sherpa-onnx ya resuelve
el mismo problema hoy, probado y andando: no se justifica invertir ahí antes de decidir con el dev.

### Decisión propuesta para sherpa-onnx

Vendorizar `sherpa-onnx-offline-tts` v1.13.8 (arm64, sha256 arriba) + las tres voces
`vits-piper-*` (sha256 arriba, con `espeak-ng-data` deduplicado) como el motor de síntesis de voz
del `.dmg`, sujeto a que el dev apruebe el cambio de contrato en `synthesizeSpeech`/
`resolve-binaries.ts` (deja de ser `piper -m -i -f --length-scale`, pasa a ser
`sherpa-onnx-offline-tts --vits-model --vits-tokens --vits-data-dir --vits-length-scale
--output-filename <texto>` — firma de argumentos distinta, texto como argumento posicional en vez
de archivo `-i`, y sin flag de output negativo). Eso es trabajo de TASK-003, no de este spike.

---

## 4) Remotion — bundle una vez, render en otro proceso

| Campo | Valor |
| --- | --- |
| Versión | Remotion / `@remotion/bundler` / `@remotion/renderer` `4.0.522` (fijada en el repo) |
| Chrome headless shell | Chrome for Testing **149.0.7790.0** (mac-arm64) — versión exacta que `@remotion/renderer` 4.0.522 declara como `TESTED_VERSION` en `get-chrome-download-url.js` |
| URL | `https://storage.googleapis.com/chrome-for-testing-public/149.0.7790.0/mac-arm64/chrome-headless-shell-mac-arm64.zip` |
| sha256 | `17ef152eba8ffcfebc42e25ab295eb040d8e62455cff7dfcc735b652456d6899` |
| Tamaño | 98.1 MB comprimido / 201 MB extraído |
| Licencia | Chromium (BSD-ish, ver LICENSE de Chrome for Testing) |

`chrome-headless-shell` corre standalone (`--version` → `Google Chrome for Testing 149.0.7790.0`);
`otool -L` solo muestra frameworks de sistema (`AppKit`, `CoreGraphics`, `CFNetwork`, etc.) — sin
Homebrew.

**Paso 1 — bundle (proceso A, con webpack, una sola vez):** script en el scratchpad que llama a
`bundle()` de `@remotion/bundler` sobre `libs/composition-remotion/src/remotion-entry.ts`, con el
mismo `webpackOverride` que usa `render.ts` (`withWorkspaceAliases`, que resuelve
`@video-maker/timeline-core` a su `src/index.ts`) y un `publicDir` con placeholders (`aroll.mp4`,
`broll.jpg`, `music.mp3`, generados con la ffmpeg de la sección 1) para que `buildExampleTimeline`
tenga algo que leer. **2.0s**, produce `bundle-output/` (24 MB: `index.html`, `bundle.js` +
chunks).

**Paso 2 — render (proceso B, separado, SIN bundler):** script distinto que solo usa
`@remotion/renderer` (`selectComposition` + `renderMedia`) apuntando a `serveUrl` = la carpeta
`bundle-output/` de arriba (rutas absolutas `file://` implícitas, ningún `require` de
`@remotion/bundler`) y `browserExecutable` = el `chrome-headless-shell` descargado en el paso
anterior. Timeline: `buildExampleTimeline('reels-9x16')` (fixture real del repo, mismo que usa
`render.spec.ts`), `frameRange: [0, 59]` para acotar a 2s.

Resultado: **`RENDER_OK`** en **8.5s**, `spike-render.mp4`: `h264`/`aac`, 1080×1920, `nb_frames=60`,
`duration=2.048000`. Confirma que el proceso de render **no necesita** `@remotion/bundler` ni
webpack en runtime — solo la carpeta ya bundleada + el ejecutable de Chrome.

**Compositor nativo (`@remotion/compositor-darwin-arm64`):** vive en
`node_modules/.pnpm/@remotion+compositor-darwin-arm64@4.0.522/node_modules/@remotion/compositor-darwin-arm64/`
(17 MB): un binario Rust (`remotion`) + su propia `ffmpeg`/`ffprobe` (build minimalista, 297 KB /
165 KB, no confundir con la de la sección 1) + 7 `.dylib` de `libav*`/`libsw*`. `otool -L` sobre el
binario `remotion` muestra que las `libav*.dylib` se referencian **sin prefijo de ruta** (resueltas
por convención al mismo directorio, típico de `@rpath`/`@loader_path`) — es decir, **tienen que
seguir siendo archivos reales en disco junto al binario**. Un `.asar` es un filesystem virtual: dyld
no puede hacer `dlopen` de una dylib ni ejecutar un binario dentro de él. **Confirma la necesidad de
`asarUnpack` para `@remotion/compositor-darwin-arm64` completo** (como ya anticipaba el riesgo del
plan), y por la misma razón para `@remotion/renderer`'s uso de un `chrome-headless-shell` fuera del
asar.

**Decisión:** en TASK-003, separar el bundle (paso de build de la app, no de runtime) del render
(runtime), y en TASK-007 marcar `@remotion/compositor-darwin-arm64` con `asarUnpack`. El
`browserExecutable` se pasa explícito apuntando a la carpeta de datos donde se descarga
`chrome-headless-shell` en el primer arranque (D-C3-05) — **no** se usa el mecanismo interno de
`ensureBrowser`/`getDownloadsCacheDir` de Remotion, porque ese cae por defecto en
`<repo o cwd>/node_modules/.remotion` (resuelto caminando hacia arriba desde `cwd` buscando un
`package.json`), que no es controlable de forma limpia desde una app empaquetada.

---

## 5) better-sqlite3 en Electron

| Campo | Valor |
| --- | --- |
| Electron | `44.4.5` |
| Node embebido en Electron | `24.21.0` (via `process.versions.node` dentro de `ELECTRON_RUN_AS_NODE=1`) |
| better-sqlite3 | `13.0.3` |
| `@electron/rebuild` | `4.2.0` |

`pnpm add electron@latest better-sqlite3@^13.0.3` en un proyecto standalone del scratchpad, luego
`electron-rebuild -f -w better-sqlite3` (nota: la flag documentada `--version`/`-v` del CLI de
`@electron/rebuild` 4.2.0 está rota — lanza `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` al querer leer la
versión objetivo desde `node_modules/electron`; no hizo falta pasarla, el rebuild normal con `-f -w`
funcionó igual). Rebuild: **"✔ Rebuild Complete"**.

Dos verificaciones:

- **`ELECTRON_RUN_AS_NODE=1 <electron> -e "..."`**: `SELECT 1 as ok` → `{"ok":1}`. OK.
- **Desde el proceso main real** (`<electron>.app/Contents/MacOS/Electron main.js`, sin
  `ELECTRON_RUN_AS_NODE`, con `app.whenReady()`): mismo `SELECT 1` → `{"ok":1}`. OK.

Nota operativa (no bloqueante, documentada porque costó diagnosticarla): al invocar el binario real
de Electron para probar el modo "app", si `ELECTRON_RUN_AS_NODE=1` sigue exportada en el shell
desde una prueba anterior, `require('electron')` devuelve un **string** (la ruta al binario) en vez
del objeto API — silencioso, sin error, hasta que se intenta usar `app.whenReady`. Hay que limpiar
esa variable de entorno explícitamente entre el modo "Node" y el modo "app" real.

**Decisión:** TASK-002/TASK-005 deben correr `@electron/rebuild` contra la versión de Electron que
finalmente se fije en `apps/desktop/package.json`, como paso del build (no en runtime).

---

## 6) Bonus — matar el grupo de procesos

Con Electron como Node (`ELECTRON_RUN_AS_NODE=1`), se creó un árbol: `bash` (detached, su propio
grupo) → `sleep 60` + subshell (`(sleep 60 & wait) &`) → otro `sleep 60` nieto. `spawn(..., {detached:
true})` + `process.kill(-child.pid, 'SIGKILL')` (PID negativo = grupo):

- Antes del kill: 4 procesos vivos en el grupo (`pgrep -g <pid>`).
- Después del kill: 0.

**Confirma D-C3-02**: matar por grupo de procesos (PID negativo) alcanza a los nietos sin tener que
rastrear el árbol a mano. Aplica directo a cómo `apps/desktop` debe lanzar y cerrar `render-api`
(que a su vez lanza `chrome-headless-shell`, `ffmpeg`, `whisper-cli`, `piper`).

---

## Resumen de versiones para el manifiesto de TASK-002

| Pieza | Versión/tag fijado | sha256 (binario final) |
| --- | --- | --- |
| ffmpeg | 9.0.2 (martin-riedl.de release/macos/arm64) | `2e11c6f90993cdb79fff84d3f90044d28316b310e75b3e030cfc9a54f2c9d384` |
| ffprobe | 9.0.2 (martin-riedl.de release/macos/arm64) | `2738aa46a7f9acbc8ab09a6715554c90f7de603171ac403726765685df6a0059` |
| whisper-cli | whisper.cpp v1.7.6 (`a8d002c`), build propia | `242f4630b9bcb0103c4cb6ccba27066ceb7a3d3a4ea294541b1d87e391c8347a` |
| chrome-headless-shell | Chrome for Testing 149.0.7790.0 (mac-arm64) | (zip) `17ef152eba8ffcfebc42e25ab295eb040d8e62455cff7dfcc735b652456d6899` |
| piper (motor original) | **sin fijar — bloqueado, ver sección 3** | — |
| sherpa-onnx-offline-tts | v1.13.8 (osx-arm64-static) | `1c586d73f0ac440f19ee02e3198fdcd45db5406d78c0d143715c797dac299198` |
| voz es_AR-daniela-high (sherpa) | `tts-models` / `vits-piper-es_AR-daniela-high.tar.bz2` | `71cbf6b7f646ab74f3c51336151abef41e6c54467ac929ffdb19ed706a07dd7b` (tar.bz2) |
| voz es_ES-davefx-medium (sherpa) | `tts-models` / `vits-piper-es_ES-davefx-medium.tar.bz2` | `a3f6beb54a9cb893279f72978a22f807a4d9fc9c7848157b524d5cc7b7f58b22` (tar.bz2) |
| voz es_MX-claude-high (sherpa) | `tts-models` / `vits-piper-es_MX-claude-high.tar.bz2` | `ec33fb689c248fe64810aab564cba97babf0f506672cfd404928d46e751a4721` (tar.bz2) |
| Electron | 44.4.5 (a confirmar cuál fija TASK-005) | — |
| better-sqlite3 | 13.0.3 | — |

**Nota sobre "sin fijar" de piper:** el motor original (piper, secciones 3/A/B/C) queda sin pin
porque está bloqueado — no porque falte elegir una versión. Si el dev aprueba la migración a
sherpa-onnx (recomendación 1 de la sección 3), la fila de piper de esta tabla queda directamente
reemplazada por las cuatro filas de sherpa-onnx de arriba.

## Pendiente de documentar en contexto

Ninguno todavía. El patrón de `asarUnpack` para binarios nativos + dylibs ya está anticipado en el
plan de este ciclo (riesgos), así que no es un patrón nuevo no documentado. Si el dev aprueba migrar
a sherpa-onnx en TASK-003, ese cambio de motor de síntesis de voz (y su nueva forma de argumentos)
sí debería sumarse al contexto de `libs/media-local` al cerrar el ciclo — no es un detalle interno,
es un cambio de contrato visible para quien mantenga ese módulo después.
