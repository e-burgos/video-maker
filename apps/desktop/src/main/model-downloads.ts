import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';

export const WHISPER_MODEL_FILE_NAME = 'whisper-model.bin';
export const VOICES_DIR_NAME = 'voices';
export const VOICE_DIRECTORY_PREFIX = 'vits-piper-';
export const CHROME_HEADLESS_SHELL_DIR_NAME = 'chrome-headless-shell';
export const CHROME_HEADLESS_SHELL_BINARY_NAME = 'chrome-headless-shell';
const DOWNLOADS_DIR_NAME = '.downloads';
const CHROME_ZIP_TOP_LEVEL_DIR = 'chrome-headless-shell-mac-arm64';

export interface ManifestModel {
  readonly name: string;
  readonly url: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ManifestVoiceModel extends ManifestModel {
  readonly id: string;
}

export interface ManifestModels {
  readonly whisper: ManifestModel;
  readonly chromeHeadlessShell: ManifestModel;
  readonly voices: readonly ManifestVoiceModel[];
}

export interface InstalledArtifact {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ItemProgress {
  readonly id: string;
  readonly bytesDownloaded: number;
  readonly totalBytes: number;
  readonly timestamp: number;
}

export interface OverallProgress extends ItemProgress {
  readonly overallBytesDownloaded: number;
  readonly overallTotalBytes: number;
}

export interface DownloadItem {
  readonly id: string;
  readonly kind: 'whisperModel' | 'voice' | 'chromeHeadlessShell';
  readonly url: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly partPath: string;
  install(partPath: string): Promise<InstalledArtifact>;
}

export interface DownloadResult {
  readonly id: string;
  readonly ok: boolean;
  readonly artifact?: InstalledArtifact;
  readonly error?: string;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface DownloadDeps {
  readonly fetchFn?: typeof fetch;
  readonly clock?: Clock;
}

function sha256OfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function runTar(args: readonly string[]): void {
  const result = spawnSync('/usr/bin/tar', [...args], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`tar ${args.join(' ')} exited with code ${String(result.status)}`);
  }
}

function runUnzip(args: readonly string[]): void {
  const result = spawnSync('/usr/bin/unzip', [...args], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`unzip ${args.join(' ')} exited with code ${String(result.status)}`);
  }
}

async function installWhisperModel(
  partPath: string,
  modelsDir: string,
  expected: ManifestModel,
): Promise<InstalledArtifact> {
  const finalPath = join(modelsDir, WHISPER_MODEL_FILE_NAME);
  mkdirSync(dirname(finalPath), { recursive: true });
  renameSync(partPath, finalPath);
  return { path: finalPath, sizeBytes: expected.sizeBytes, sha256: expected.sha256 };
}

async function installVoiceArchive(
  partPath: string,
  modelsDir: string,
  voiceId: string,
): Promise<InstalledArtifact> {
  const voicesDir = join(modelsDir, VOICES_DIR_NAME);
  mkdirSync(voicesDir, { recursive: true });
  runTar(['-xf', partPath, '-C', voicesDir]);
  rmSync(partPath, { force: true });

  const onnxPath = join(voicesDir, `${VOICE_DIRECTORY_PREFIX}${voiceId}`, `${voiceId}.onnx`);
  const sizeBytes = statSync(onnxPath).size;
  const sha256 = await sha256OfFile(onnxPath);
  return { path: onnxPath, sizeBytes, sha256 };
}

async function installChromeHeadlessShell(partPath: string, modelsDir: string): Promise<InstalledArtifact> {
  const chromeDir = join(modelsDir, CHROME_HEADLESS_SHELL_DIR_NAME);
  const extractDir = `${chromeDir}.extract-tmp`;
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  runUnzip(['-o', '-q', partPath, '-d', extractDir]);
  rmSync(partPath, { force: true });

  rmSync(chromeDir, { recursive: true, force: true });
  renameSync(join(extractDir, CHROME_ZIP_TOP_LEVEL_DIR), chromeDir);
  rmSync(extractDir, { recursive: true, force: true });

  const binaryPath = join(chromeDir, CHROME_HEADLESS_SHELL_BINARY_NAME);
  const sizeBytes = statSync(binaryPath).size;
  const sha256 = await sha256OfFile(binaryPath);
  return { path: binaryPath, sizeBytes, sha256 };
}

export function buildDownloadPlan(models: ManifestModels, modelsDir: string): readonly DownloadItem[] {
  const downloadsDir = join(modelsDir, DOWNLOADS_DIR_NAME);
  const items: DownloadItem[] = [
    {
      id: 'whisperModel',
      kind: 'whisperModel',
      url: models.whisper.url,
      sizeBytes: models.whisper.sizeBytes,
      sha256: models.whisper.sha256,
      partPath: join(downloadsDir, 'whisper-model.bin.part'),
      install: (partPath) => installWhisperModel(partPath, modelsDir, models.whisper),
    },
  ];

  for (const voice of models.voices) {
    items.push({
      id: `voice:${voice.id}`,
      kind: 'voice',
      url: voice.url,
      sizeBytes: voice.sizeBytes,
      sha256: voice.sha256,
      partPath: join(downloadsDir, `${voice.id}.tar.bz2.part`),
      install: (partPath) => installVoiceArchive(partPath, modelsDir, voice.id),
    });
  }

  items.push({
    id: 'chromeHeadlessShell',
    kind: 'chromeHeadlessShell',
    url: models.chromeHeadlessShell.url,
    sizeBytes: models.chromeHeadlessShell.sizeBytes,
    sha256: models.chromeHeadlessShell.sha256,
    partPath: join(downloadsDir, 'chrome-headless-shell.zip.part'),
    install: (partPath) => installChromeHeadlessShell(partPath, modelsDir),
  });

  return items;
}

async function resumableDownload(
  item: DownloadItem,
  onProgress: (progress: ItemProgress) => void,
  deps: Required<DownloadDeps>,
): Promise<void> {
  mkdirSync(dirname(item.partPath), { recursive: true });

  let offset = existsSync(item.partPath) ? statSync(item.partPath).size : 0;
  if (offset > item.sizeBytes) {
    rmSync(item.partPath, { force: true });
    offset = 0;
  }
  if (offset === item.sizeBytes) {
    onProgress({ id: item.id, bytesDownloaded: offset, totalBytes: item.sizeBytes, timestamp: deps.clock.now() });
    return;
  }

  const headers: Record<string, string> = offset > 0 ? { Range: `bytes=${offset}-` } : {};
  const response = await deps.fetchFn(item.url, { headers });
  if (!response.ok && response.status !== 206) {
    throw new Error(`download failed (HTTP ${response.status}) for ${item.url}`);
  }
  if (response.body === null) {
    throw new Error(`download had no response body for ${item.url}`);
  }

  const resumed = response.status === 206;
  const startOffset = resumed ? offset : 0;
  let bytesDownloaded = startOffset;

  const writeStream = createWriteStream(item.partPath, { flags: resumed ? 'r+' : 'w', start: startOffset });
  const reader = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);

  await new Promise<void>((resolve, reject) => {
    reader.on('data', (chunk: Buffer) => {
      bytesDownloaded += chunk.length;
      onProgress({ id: item.id, bytesDownloaded, totalBytes: item.sizeBytes, timestamp: deps.clock.now() });
    });
    reader.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    reader.pipe(writeStream);
  });
}

async function downloadVerifyOnce(
  item: DownloadItem,
  onProgress: (progress: ItemProgress) => void,
  deps: Required<DownloadDeps>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await resumableDownload(item, onProgress, deps);

  const actualSize = statSync(item.partPath).size;
  if (actualSize !== item.sizeBytes) {
    rmSync(item.partPath, { force: true });
    return { ok: false, error: `size mismatch: expected ${item.sizeBytes}, got ${actualSize}` };
  }

  const actualSha256 = await sha256OfFile(item.partPath);
  if (actualSha256 !== item.sha256) {
    rmSync(item.partPath, { force: true });
    return { ok: false, error: 'sha256 mismatch' };
  }

  return { ok: true };
}

export async function downloadAndInstall(
  item: DownloadItem,
  onProgress: (progress: ItemProgress) => void,
  deps: DownloadDeps = {},
): Promise<DownloadResult> {
  const resolvedDeps: Required<DownloadDeps> = { fetchFn: deps.fetchFn ?? fetch, clock: deps.clock ?? systemClock };

  let attempt = await downloadVerifyOnce(item, onProgress, resolvedDeps).catch(
    (error: unknown): { ok: false; error: string } => ({ ok: false, error: (error as Error).message }),
  );
  if (!attempt.ok) {
    attempt = await downloadVerifyOnce(item, onProgress, resolvedDeps).catch(
      (error: unknown): { ok: false; error: string } => ({ ok: false, error: (error as Error).message }),
    );
  }
  if (!attempt.ok) {
    return { id: item.id, ok: false, error: attempt.error };
  }

  try {
    const artifact = await item.install(item.partPath);
    return { id: item.id, ok: true, artifact };
  } catch (error) {
    return { id: item.id, ok: false, error: (error as Error).message };
  }
}

export async function downloadAllModels(
  items: readonly DownloadItem[],
  onProgress: (progress: OverallProgress) => void,
  deps: DownloadDeps = {},
): Promise<readonly DownloadResult[]> {
  const overallTotalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  let completedBytes = 0;
  const results: DownloadResult[] = [];

  for (const item of items) {
    const result = await downloadAndInstall(
      item,
      (progress) => {
        onProgress({
          ...progress,
          overallBytesDownloaded: completedBytes + progress.bytesDownloaded,
          overallTotalBytes,
        });
      },
      deps,
    );
    completedBytes += item.sizeBytes;
    results.push(result);
  }

  return results;
}
