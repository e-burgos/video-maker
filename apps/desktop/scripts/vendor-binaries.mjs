import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const VENDOR_DIR = join(DESKTOP_ROOT, 'vendor');
const BIN_DIR = join(VENDOR_DIR, 'darwin-arm64', 'bin');
const MANIFEST_PATH = join(VENDOR_DIR, 'manifest.json');
const NOTICES_PATH = join(VENDOR_DIR, 'THIRD_PARTY_NOTICES.md');
const CACHE_DIR = process.env.VENDOR_CACHE_DIR
  ? resolve(process.env.VENDOR_CACHE_DIR)
  : join(homedir(), '.cache', 'video-maker-vendor');

const SYSTEM_LINK_PREFIXES = ['/usr/lib/', '/System/Library/'];

const FFMPEG_BASE_URL = 'https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2';
const FFMPEG_LICENSE = 'GPL-3.0-or-later (built with --enable-gpl --enable-libx264 --enable-libx265)';

const FFMPEG_PIN = {
  key: 'ffmpeg',
  binaryName: 'ffmpeg',
  version: '9.0.2',
  archiveUrl: `${FFMPEG_BASE_URL}/ffmpeg.zip`,
  archiveSha256: 'c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924',
  outputSha256: '2e11c6f90993cdb79fff84d3f90044d28316b310e75b3e030cfc9a54f2c9d384',
  license: FFMPEG_LICENSE,
};

const FFPROBE_PIN = {
  key: 'ffprobe',
  binaryName: 'ffprobe',
  version: '9.0.2',
  archiveUrl: `${FFMPEG_BASE_URL}/ffprobe.zip`,
  archiveSha256: 'fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6',
  outputSha256: '2738aa46a7f9acbc8ab09a6715554c90f7de603171ac403726765685df6a0059',
  license: FFMPEG_LICENSE,
};

const SHERPA_ONNX_PIN = {
  key: 'sherpaOnnx',
  version: '1.13.8',
  archiveUrl: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-arm64-static.tar.bz2',
  archiveSha256: 'd97d56f677168b0a35cf96e587f65e4f036fe5776e40476e4f84e3f47cd4d978',
  outputSha256: '1c586d73f0ac440f19ee02e3198fdcd45db5406d78c0d143715c797dac299198',
  license: 'Apache-2.0',
};

const WHISPER_CLI_PIN = {
  key: 'whisperCli',
  tag: 'v1.7.6',
  commit: 'a8d002cfd879315632a579e73f0148d06959de36',
  repoUrl: 'https://github.com/ggml-org/whisper.cpp.git',
  license: 'MIT',
};

const WHISPER_MODEL_PIN = {
  name: 'ggml-large-v3-turbo-q5_0',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
  sizeBytes: 574041195,
  sha256: null,
  license: 'MIT (whisper.cpp weights, ggerganov/whisper.cpp) — derived from OpenAI Whisper (MIT)',
};

const CHROME_HEADLESS_SHELL_PIN = {
  name: 'chrome-headless-shell-mac-arm64',
  version: '149.0.7790.0',
  url: 'https://storage.googleapis.com/chrome-for-testing-public/149.0.7790.0/mac-arm64/chrome-headless-shell-mac-arm64.zip',
  sizeBytes: null,
  sha256: '17ef152eba8ffcfebc42e25ab295eb040d8e62455cff7dfcc735b652456d6899',
  license: 'Chromium (BSD-3-Clause) + Chrome for Testing terms (https://googlechromelabs.github.io/chrome-for-testing/)',
};

const VOICE_PINS = [
  {
    id: 'es_AR-daniela-high',
    name: 'vits-piper-es_AR-daniela-high',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_AR-daniela-high.tar.bz2',
    sizeBytes: null,
    sha256: '71cbf6b7f646ab74f3c51336151abef41e6c54467ac929ffdb19ed706a07dd7b',
    license: 'CC-BY-SA-4.0 (dataset openslr.org/61; model trained by larcanio/piper-voices)',
  },
  {
    id: 'es_ES-davefx-medium',
    name: 'vits-piper-es_ES-davefx-medium',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-davefx-medium.tar.bz2',
    sizeBytes: null,
    sha256: 'a3f6beb54a9cb893279f72978a22f807a4d9fc9c7848157b524d5cc7b7f58b22',
    license: 'CC0-1.0 (dataset github.com/NabuCasa/voice-datasets)',
  },
  {
    id: 'es_MX-claude-high',
    name: 'vits-piper-es_MX-claude-high',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2',
    sizeBytes: null,
    sha256: 'ec33fb689c248fe64810aab564cba97babf0f506672cfd404928d46e751a4721',
    license: 'Apache-2.0 (huggingface.co/spaces/HirCoir/Piper-TTS-Spanish)',
  },
];

function log(message) {
  process.stdout.write(`[vendor] ${message}\n`);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd,
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) {
    throw new Error(`${cmd} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = opts.capture ? `\n${result.stderr}` : '';
    throw new Error(`${cmd} ${args.join(' ')} exited with code ${result.status}${detail}`);
  }
  return result;
}

function verifyArm64Binary(path) {
  const result = run('/usr/bin/lipo', ['-archs', path], { capture: true });
  const archs = result.stdout.trim().split(/\s+/);
  if (archs.length !== 1 || archs[0] !== 'arm64') {
    throw new Error(`${path} is not a pure arm64 binary (lipo -archs: "${result.stdout.trim()}")`);
  }
}

function verifyOnlySystemLinks(path) {
  const result = run('/usr/bin/otool', ['-L', path], { capture: true });
  const dependencyLines = result.stdout.split('\n').slice(1);
  for (const line of dependencyLines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const libPath = trimmed.split(' ')[0];
    const isSystemLib = SYSTEM_LINK_PREFIXES.some((prefix) => libPath.startsWith(prefix));
    if (!isSystemLib) {
      throw new Error(`${path} links against a non-system library: ${libPath}`);
    }
  }
}

function verifyVendoredBinary(path) {
  verifyArm64Binary(path);
  verifyOnlySystemLinks(path);
}

async function streamDownload(url, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`download failed (HTTP ${response.status}) for ${url}`);
  }
  const partPath = `${destPath}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partPath));
  renameSync(partPath, destPath);
}

function loadExistingManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

const existingManifest = loadExistingManifest();

function reuseBinaryIfUnchanged(key, outputPath) {
  const prior = existingManifest?.binaries?.[key];
  if (prior && existsSync(outputPath) && sha256File(outputPath) === prior.sha256) {
    log(`skip ${key} (unchanged, sha256 matches manifest)`);
    return prior;
  }
  return null;
}

function findModelEntry(key) {
  const models = existingManifest?.models;
  if (!models) return null;
  if (key.startsWith('voice:')) {
    const id = key.slice('voice:'.length);
    return (models.voices ?? []).find((voice) => voice.id === id) ?? null;
  }
  return models[key] ?? null;
}

function cacheFileNameFor(url) {
  return new URL(url).pathname.split('/').filter(Boolean).pop();
}

function reuseModelIfUnchanged(key) {
  const prior = findModelEntry(key);
  if (!prior) return null;
  const cachePath = join(CACHE_DIR, 'models', cacheFileNameFor(prior.url));
  if (existsSync(cachePath) && sha256File(cachePath) === prior.sha256) {
    log(`skip model ${key} (unchanged, sha256 matches manifest)`);
    return prior;
  }
  return null;
}

async function downloadArchiveToCache(url, cacheFileName, expectedSha256) {
  const cachePath = join(CACHE_DIR, 'archives', cacheFileName);
  if (existsSync(cachePath) && sha256File(cachePath) === expectedSha256) {
    return cachePath;
  }
  log(`downloading ${url}`);
  await streamDownload(url, cachePath);
  const actualSha256 = sha256File(cachePath);
  if (actualSha256 !== expectedSha256) {
    rmSync(cachePath);
    throw new Error(`sha256 mismatch for ${url}\n  expected ${expectedSha256}\n  actual   ${actualSha256}`);
  }
  return cachePath;
}

async function vendorZipBinary(pin) {
  const outputPath = join(BIN_DIR, pin.binaryName);
  const reused = reuseBinaryIfUnchanged(pin.key, outputPath);
  if (reused) return reused;

  const archivePath = await downloadArchiveToCache(pin.archiveUrl, `${pin.key}-${pin.version}.zip`, pin.archiveSha256);
  const extractDir = join(CACHE_DIR, 'extract', pin.key);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  run('/usr/bin/unzip', ['-o', '-q', archivePath, '-d', extractDir]);

  mkdirSync(BIN_DIR, { recursive: true });
  copyFileSync(join(extractDir, pin.binaryName), outputPath);
  chmodSync(outputPath, 0o755);
  verifyVendoredBinary(outputPath);

  const sha256 = sha256File(outputPath);
  if (sha256 !== pin.outputSha256) {
    throw new Error(`${pin.binaryName} sha256 mismatch after extraction\n  expected ${pin.outputSha256}\n  actual   ${sha256}`);
  }
  log(`vendored ${pin.binaryName} ${pin.version} (${formatBytes(statSync(outputPath).size)})`);
  return { name: pin.binaryName, version: pin.version, sourceUrl: pin.archiveUrl, sourceSha256: pin.archiveSha256, sha256, license: pin.license };
}

async function vendorSherpaOnnx(pin) {
  const binaryName = 'sherpa-onnx-offline-tts';
  const outputPath = join(BIN_DIR, binaryName);
  const reused = reuseBinaryIfUnchanged(pin.key, outputPath);
  if (reused) return reused;

  const archivePath = await downloadArchiveToCache(pin.archiveUrl, `sherpa-onnx-${pin.version}-osx-arm64-static.tar.bz2`, pin.archiveSha256);
  const extractDir = join(CACHE_DIR, 'extract', pin.key);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  run('/usr/bin/tar', ['-xf', archivePath, '-C', extractDir]);

  mkdirSync(BIN_DIR, { recursive: true });
  const extractedPath = join(extractDir, `sherpa-onnx-v${pin.version}-osx-arm64-static`, 'bin', binaryName);
  copyFileSync(extractedPath, outputPath);
  chmodSync(outputPath, 0o755);
  verifyVendoredBinary(outputPath);

  const sha256 = sha256File(outputPath);
  if (sha256 !== pin.outputSha256) {
    throw new Error(`${binaryName} sha256 mismatch after extraction\n  expected ${pin.outputSha256}\n  actual   ${sha256}`);
  }
  log(`vendored ${binaryName} ${pin.version} (${formatBytes(statSync(outputPath).size)})`);
  return { name: binaryName, version: pin.version, sourceUrl: pin.archiveUrl, sourceSha256: pin.archiveSha256, sha256, license: pin.license };
}

function checkBuildToolchain() {
  const xcodeSelect = spawnSync('/usr/bin/xcode-select', ['-p'], { stdio: 'pipe' });
  if (xcodeSelect.status !== 0) {
    throw new Error('Xcode Command Line Tools not found. Run `xcode-select --install` and retry — needed only to build whisper-cli, never bundled in the app.');
  }
  const cmake = spawnSync('cmake', ['--version'], { stdio: 'pipe' });
  if (cmake.error || cmake.status !== 0) {
    throw new Error('cmake not found on PATH. Install it (e.g. `brew install cmake`) and retry — it is a build-time tool only, never bundled in the app.');
  }
}

function gitArchiveSha256(srcDir) {
  const result = run('sh', ['-c', 'git archive --format=tar HEAD | shasum -a 256'], { cwd: srcDir, capture: true });
  return result.stdout.trim().split(/\s+/)[0];
}

async function vendorWhisperCli(pin) {
  const outputPath = join(BIN_DIR, 'whisper-cli');
  const reused = reuseBinaryIfUnchanged(pin.key, outputPath);
  if (reused) return reused;

  checkBuildToolchain();

  const srcDir = join(CACHE_DIR, 'whisper.cpp');
  const clonedAtPin = existsSync(join(srcDir, '.git')) && run('git', ['rev-parse', 'HEAD'], { cwd: srcDir, capture: true }).stdout.trim() === pin.commit;
  if (!clonedAtPin) {
    rmSync(srcDir, { recursive: true, force: true });
    log(`cloning whisper.cpp ${pin.tag}`);
    run('git', ['clone', '--branch', pin.tag, '--depth', '1', pin.repoUrl, srcDir]);
    const headCommit = run('git', ['rev-parse', 'HEAD'], { cwd: srcDir, capture: true }).stdout.trim();
    if (headCommit !== pin.commit) {
      throw new Error(`whisper.cpp tag ${pin.tag} resolved to ${headCommit}, expected pinned commit ${pin.commit}`);
    }
  }
  const sourceSha256 = gitArchiveSha256(srcDir);

  const buildDir = join(srcDir, 'build');
  rmSync(buildDir, { recursive: true, force: true });
  log('building whisper-cli (cmake + Metal, static)');
  run('cmake', [
    '-S', srcDir,
    '-B', buildDir,
    '-DBUILD_SHARED_LIBS=OFF',
    '-DGGML_METAL=ON',
    '-DGGML_METAL_EMBED_LIBRARY=ON',
    '-DCMAKE_BUILD_TYPE=Release',
    '-DWHISPER_BUILD_EXAMPLES=ON',
  ]);
  run('cmake', ['--build', buildDir, '--target', 'whisper-cli', '--config', 'Release', '-j']);

  mkdirSync(BIN_DIR, { recursive: true });
  copyFileSync(join(buildDir, 'bin', 'whisper-cli'), outputPath);
  chmodSync(outputPath, 0o755);
  verifyVendoredBinary(outputPath);

  const sha256 = sha256File(outputPath);
  log(`vendored whisper-cli ${pin.tag} (${formatBytes(statSync(outputPath).size)})`);
  return { name: 'whisper-cli', version: pin.tag, commit: pin.commit, sourceUrl: pin.repoUrl, sourceSha256, sha256, license: pin.license };
}

async function vendorModel(key, pin) {
  const reused = reuseModelIfUnchanged(key);
  if (reused) return reused;

  const cachePath = join(CACHE_DIR, 'models', cacheFileNameFor(pin.url));
  const alreadyCached = existsSync(cachePath) && pin.sha256 && sha256File(cachePath) === pin.sha256;
  if (!alreadyCached) {
    log(`downloading model ${pin.name}`);
    await streamDownload(pin.url, cachePath);
  }

  const stat = statSync(cachePath);
  const sha256 = sha256File(cachePath);
  if (pin.sizeBytes && stat.size !== pin.sizeBytes) {
    throw new Error(`${pin.name} size mismatch: expected ${pin.sizeBytes} bytes, got ${stat.size}`);
  }
  if (pin.sha256 && sha256 !== pin.sha256) {
    throw new Error(`${pin.name} sha256 mismatch\n  expected ${pin.sha256}\n  actual   ${sha256}`);
  }
  log(`verified model ${pin.name} (${formatBytes(stat.size)})`);

  const entry = { name: pin.name, url: pin.url, sizeBytes: stat.size, sha256, license: pin.license };
  if (pin.version) entry.version = pin.version;
  if (pin.id) entry.id = pin.id;
  return entry;
}

function manifestBodyEqual(a, b) {
  if (!a || !b) return false;
  const { generatedAt: _a, ...restA } = a;
  const { generatedAt: _b, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

function buildThirdPartyNotices(manifest) {
  const { ffmpeg, ffprobe, sherpaOnnx, whisperCli } = manifest.binaries;
  const { whisper, chromeHeadlessShell, voices } = manifest.models;
  const voiceEntries = voices
    .map((voice) => `- **${voice.name}** (${voice.id}) — ${voice.license}\n  Source: ${voice.url}`)
    .join('\n');

  return `# Third-party notices — Video Maker desktop app (darwin-arm64)

Generated from \`apps/desktop/vendor/manifest.json\`. Do not edit by hand — regenerate with
\`node apps/desktop/scripts/vendor-binaries.mjs\`.

## ffmpeg / ffprobe

- Version: ${ffmpeg.version}
- License: ${ffmpeg.license}
- Built with \`--enable-gpl --enable-libx264 --enable-libx265\`, distributed by ffmpeg.martin-riedl.de.
- Source code offer: the exact FFmpeg source used for this build is FFmpeg ${ffmpeg.version}
  (https://github.com/FFmpeg/FFmpeg, tag n${ffmpeg.version}). Corresponding source is available at
  https://ffmpeg.org and https://github.com/FFmpeg/FFmpeg free of charge under the GPL.
- Prebuilt archive: ${ffmpeg.sourceUrl} (sha256 ${ffmpeg.sourceSha256})
- Prebuilt archive: ${ffprobe.sourceUrl} (sha256 ${ffprobe.sourceSha256})

## whisper.cpp (whisper-cli)

- Version: ${whisperCli.version} (commit ${whisperCli.commit})
- License: ${whisperCli.license}
- Source: ${whisperCli.sourceUrl}
- Built locally from the pinned commit with CMake, static linking, Metal embedded
  (\`-DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON\`).

## sherpa-onnx (sherpa-onnx-offline-tts)

- Version: ${sherpaOnnx.version}
- License: ${sherpaOnnx.license}
- Source: https://github.com/k2-fsa/sherpa-onnx
- Prebuilt static archive: ${sherpaOnnx.sourceUrl} (sha256 ${sherpaOnnx.sourceSha256})
- Statically links onnxruntime (MIT), espeak-ng (GPL-3.0) and piper_phonemize (MIT) as \`.a\`
  archives inside the released binary — no separate dylibs to redistribute.

## espeak-ng (voice data)

- License: GPL-3.0-or-later
- Source: https://github.com/espeak-ng/espeak-ng
- Its phoneme data (\`espeak-ng-data/\`) ships bundled inside each \`vits-piper-*\` voice archive
  below (downloaded at first run, not part of the vendored binaries) and is required at runtime by
  sherpa-onnx-offline-tts. Corresponding source is available free of charge at the URL above.

## Voices (downloaded at first run, sherpa-onnx vits-piper-\\* models)

${voiceEntries}

## whisper model (downloaded at first run)

- ${whisper.name}
- License: ${whisper.license}
- Source: ${whisper.url}

## Chrome for Testing / chrome-headless-shell (downloaded at first run)

- Version: ${chromeHeadlessShell.version}
- License: ${chromeHeadlessShell.license}
- Source: ${chromeHeadlessShell.url}
- Used only to drive Remotion's headless renderer; never launched as a general-purpose browser.

## Remotion

- Version: 4.0.522
- License: Remotion License — free for individuals and small companies under the thresholds in
  https://www.remotion.dev/license; not open source. This app is shared with friends free of
  charge and non-commercially, which the license permits without a company license.

## HyperFrames

- Version: 0.8.139
- License: Apache-2.0 — Copyright HeyGen. Source: https://github.com/heygen-com/hyperframes
- Renders the motion graphics videos (beat detection, frame capture, encoding). Its bundled sound
  effects are part of the same Apache-2.0 package.
- Ships with sharp and libvips (\`@img/sharp-libvips-darwin-arm64\`, LGPL-3.0-or-later; source at
  https://github.com/lovell/sharp-libvips) as a dynamically loaded library.

## GSAP

- Version: 3.14.2
- License: GSAP Standard "No Charge" License — https://gsap.com/standard-license
- Animates the motion graphics scenes inside the rendered videos.

## Fonts (motion graphics brand kit)

- Outfit, Geist and Geist Mono — SIL Open Font License 1.1, via Fontsource.

## Music (motion graphics brand kit)

- "Voxel Revolution" and "Newer Wave" — Kevin MacLeod (incompetech.com), CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/).
- CC BY requires attribution: every render leaves \`<video>.credits.txt\` next to the MP4 with the
  credit line, which must go in the description of the published video.

## Electron

- Version: 44.4.5 (bundles Chromium and Node.js 24)
- License: MIT — Copyright (c) Electron contributors, Copyright (c) 2013-2020 GitHub Inc.
- Source: https://github.com/electron/electron
- Chromium and Node.js inside Electron ship under their own licenses, listed in the app bundle at
  \`Contents/Resources/licenses/\` (\`electron-LICENSE.txt\`, \`LICENSES.chromium.html\`).
`;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(BIN_DIR, { recursive: true });

  const binaries = {
    ffmpeg: await vendorZipBinary(FFMPEG_PIN),
    ffprobe: await vendorZipBinary(FFPROBE_PIN),
    sherpaOnnx: await vendorSherpaOnnx(SHERPA_ONNX_PIN),
    whisperCli: await vendorWhisperCli(WHISPER_CLI_PIN),
  };

  const models = {
    whisper: await vendorModel('whisper', WHISPER_MODEL_PIN),
    chromeHeadlessShell: await vendorModel('chromeHeadlessShell', CHROME_HEADLESS_SHELL_PIN),
    voices: [],
  };
  for (const voicePin of VOICE_PINS) {
    models.voices.push(await vendorModel(`voice:${voicePin.id}`, voicePin));
  }

  const draftManifest = { generatedAt: new Date().toISOString(), platform: 'darwin-arm64', binaries, models };
  const finalManifest = manifestBodyEqual(draftManifest, existingManifest)
    ? { ...draftManifest, generatedAt: existingManifest.generatedAt }
    : draftManifest;

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(finalManifest, null, 2)}\n`);
  writeFileSync(NOTICES_PATH, buildThirdPartyNotices(finalManifest));
  log(`manifest written to ${MANIFEST_PATH}`);
  log(`notices written to ${NOTICES_PATH}`);
}

main().catch((error) => {
  process.stderr.write(`\nvendor-binaries failed: ${error.message}\n`);
  process.exit(1);
});
