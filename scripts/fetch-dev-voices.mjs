import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';

const CACHE_ROOT = process.env.VIDEO_MAKER_DEV_CACHE ?? join(homedir(), '.cache', 'video-maker');
const BIN_DIR = join(CACHE_ROOT, 'tts', 'bin');
const VOICES_DIR = join(CACHE_ROOT, 'tts', 'voices');

const SHERPA_ONNX = {
  archiveUrl:
    'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-arm64-static.tar.bz2',
  archiveSha256: 'd97d56f677168b0a35cf96e587f65e4f036fe5776e40476e4f84e3f47cd4d978',
  archiveInnerBinaryPath: 'sherpa-onnx-v1.13.8-osx-arm64-static/bin/sherpa-onnx-offline-tts',
  binarySha256: '1c586d73f0ac440f19ee02e3198fdcd45db5406d78c0d143715c797dac299198',
};

const VOICES = [
  {
    id: 'es_AR-daniela-high',
    archiveUrl:
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_AR-daniela-high.tar.bz2',
    archiveSha256: '71cbf6b7f646ab74f3c51336151abef41e6c54467ac929ffdb19ed706a07dd7b',
  },
  {
    id: 'es_ES-davefx-medium',
    archiveUrl:
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-davefx-medium.tar.bz2',
    archiveSha256: 'a3f6beb54a9cb893279f72978a22f807a4d9fc9c7848157b524d5cc7b7f58b22',
  },
  {
    id: 'es_MX-claude-high',
    archiveUrl:
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2',
    archiveSha256: 'ec33fb689c248fe64810aab564cba97babf0f506672cfd404928d46e751a4721',
  },
];

async function sha256OfFile(path) {
  const hash = createHash('sha256');
  const { createReadStream } = await import('node:fs');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`Download failed for ${url}: HTTP ${response.status}`);
  }
  await pipeline(response.body, createWriteStream(destPath));
}

async function fetchVerified(url, expectedSha256, destPath) {
  if (existsSync(destPath) && (await sha256OfFile(destPath)) === expectedSha256) {
    console.log(`cached, sha256 verified: ${basename(destPath)}`);
    return;
  }
  console.log(`downloading ${url}`);
  await downloadFile(url, destPath);
  const actual = await sha256OfFile(destPath);
  if (actual !== expectedSha256) {
    throw new Error(`sha256 mismatch for ${url}\nexpected ${expectedSha256}\nactual   ${actual}`);
  }
}

function extractTarBz2(archivePath, destDir) {
  const result = spawnSync('tar', ['xjf', archivePath, '-C', destDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`tar extraction failed for ${archivePath}`);
  }
}

async function setUpSherpaOnnx(workDir) {
  const outputPath = join(BIN_DIR, 'sherpa-onnx-offline-tts');
  if (existsSync(outputPath) && (await sha256OfFile(outputPath)) === SHERPA_ONNX.binarySha256) {
    console.log(`already installed: ${outputPath}`);
    return;
  }

  const archivePath = join(workDir, 'sherpa-onnx.tar.bz2');
  await fetchVerified(SHERPA_ONNX.archiveUrl, SHERPA_ONNX.archiveSha256, archivePath);

  const extractDir = join(workDir, 'sherpa-onnx-extracted');
  await mkdir(extractDir, { recursive: true });
  extractTarBz2(archivePath, extractDir);

  await mkdir(BIN_DIR, { recursive: true });
  const { copyFile } = await import('node:fs/promises');
  await copyFile(join(extractDir, SHERPA_ONNX.archiveInnerBinaryPath), outputPath);
  await chmod(outputPath, 0o755);

  const actual = await sha256OfFile(outputPath);
  if (actual !== SHERPA_ONNX.binarySha256) {
    throw new Error(`sha256 mismatch for the extracted sherpa-onnx-offline-tts binary`);
  }
  console.log(`ready: ${outputPath}`);
}

async function setUpVoice(workDir, voice) {
  const voiceDir = join(VOICES_DIR, `vits-piper-${voice.id}`);
  if (existsSync(voiceDir)) {
    console.log(`already installed: ${voiceDir}`);
    return;
  }

  const archivePath = join(workDir, `${voice.id}.tar.bz2`);
  await fetchVerified(voice.archiveUrl, voice.archiveSha256, archivePath);

  const extractDir = join(workDir, `voice-${voice.id}`);
  await mkdir(extractDir, { recursive: true });
  extractTarBz2(archivePath, extractDir);

  await mkdir(VOICES_DIR, { recursive: true });
  const { rename } = await import('node:fs/promises');
  await rename(join(extractDir, `vits-piper-${voice.id}`), voiceDir);
  console.log(`ready: ${voiceDir}`);
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), 'video-maker-fetch-dev-voices-'));
  try {
    await setUpSherpaOnnx(workDir);
    for (const voice of VOICES) {
      await setUpVoice(workDir, voice);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  console.log('\nDone. Add these lines to your .env (replacing PIPER_PATH/PIPER_MODEL_PATH):\n');
  console.log(`TTS_CLI_PATH=${join(BIN_DIR, 'sherpa-onnx-offline-tts')}`);
  console.log(`TTS_VOICES_DIR=${VOICES_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
