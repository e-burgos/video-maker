# Third-party notices — Video Maker desktop app (darwin-arm64)

Generated from `apps/desktop/vendor/manifest.json`. Do not edit by hand — regenerate with
`node apps/desktop/scripts/vendor-binaries.mjs`.

## ffmpeg / ffprobe

- Version: 9.0.2
- License: GPL-3.0-or-later (built with --enable-gpl --enable-libx264 --enable-libx265)
- Built with `--enable-gpl --enable-libx264 --enable-libx265`, distributed by ffmpeg.martin-riedl.de.
- Source code offer: the exact FFmpeg source used for this build is FFmpeg 9.0.2
  (https://github.com/FFmpeg/FFmpeg, tag n9.0.2). Corresponding source is available at
  https://ffmpeg.org and https://github.com/FFmpeg/FFmpeg free of charge under the GPL.
- Prebuilt archive: https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffmpeg.zip (sha256 c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924)
- Prebuilt archive: https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2/ffprobe.zip (sha256 fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6)

## whisper.cpp (whisper-cli)

- Version: v1.7.6 (commit a8d002cfd879315632a579e73f0148d06959de36)
- License: MIT
- Source: https://github.com/ggml-org/whisper.cpp.git
- Built locally from the pinned commit with CMake, static linking, Metal embedded
  (`-DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON`).

## sherpa-onnx (sherpa-onnx-offline-tts)

- Version: 1.13.8
- License: Apache-2.0
- Source: https://github.com/k2-fsa/sherpa-onnx
- Prebuilt static archive: https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-arm64-static.tar.bz2 (sha256 d97d56f677168b0a35cf96e587f65e4f036fe5776e40476e4f84e3f47cd4d978)
- Statically links onnxruntime (MIT), espeak-ng (GPL-3.0) and piper_phonemize (MIT) as `.a`
  archives inside the released binary — no separate dylibs to redistribute.

## espeak-ng (voice data)

- License: GPL-3.0-or-later
- Source: https://github.com/espeak-ng/espeak-ng
- Its phoneme data (`espeak-ng-data/`) ships bundled inside each `vits-piper-*` voice archive
  below (downloaded at first run, not part of the vendored binaries) and is required at runtime by
  sherpa-onnx-offline-tts. Corresponding source is available free of charge at the URL above.

## Voices (downloaded at first run, sherpa-onnx vits-piper-\* models)

- **vits-piper-es_AR-daniela-high** (es_AR-daniela-high) — CC-BY-SA-4.0 (dataset openslr.org/61; model trained by larcanio/piper-voices)
  Source: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_AR-daniela-high.tar.bz2
- **vits-piper-es_ES-davefx-medium** (es_ES-davefx-medium) — CC0-1.0 (dataset github.com/NabuCasa/voice-datasets)
  Source: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-davefx-medium.tar.bz2
- **vits-piper-es_MX-claude-high** (es_MX-claude-high) — Apache-2.0 (huggingface.co/spaces/HirCoir/Piper-TTS-Spanish)
  Source: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2

## whisper model (downloaded at first run)

- ggml-large-v3-turbo-q5_0
- License: MIT (whisper.cpp weights, ggerganov/whisper.cpp) — derived from OpenAI Whisper (MIT)
- Source: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin

## Chrome for Testing / chrome-headless-shell (downloaded at first run)

- Version: 149.0.7790.0
- License: Chromium (BSD-3-Clause) + Chrome for Testing terms (https://googlechromelabs.github.io/chrome-for-testing/)
- Source: https://storage.googleapis.com/chrome-for-testing-public/149.0.7790.0/mac-arm64/chrome-headless-shell-mac-arm64.zip
- Used only to drive Remotion's headless renderer; never launched as a general-purpose browser.

## Remotion

- Version: 4.0.522
- License: Remotion License — free for individuals and small companies under the thresholds in
  https://www.remotion.dev/license; not open source. This app is shared with friends free of
  charge and non-commercially, which the license permits without a company license.

## Electron

- Version: 44.4.5 (bundles Chromium and Node.js 24)
- License: MIT — Copyright (c) Electron contributors, Copyright (c) 2013-2020 GitHub Inc.
- Source: https://github.com/electron/electron
- Chromium and Node.js inside Electron ship under their own licenses, listed in the app bundle at
  `Contents/Resources/licenses/` (`electron-LICENSE.txt`, `LICENSES.chromium.html`).
