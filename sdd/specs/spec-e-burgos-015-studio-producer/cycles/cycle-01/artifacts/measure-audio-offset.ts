import { spawn } from 'node:child_process';

const SAMPLE_RATE = 48_000;
const WINDOW_MS = 10;
const WINDOW_SAMPLES = (SAMPLE_RATE * WINDOW_MS) / 1000;
const MAX_LAG_WINDOWS = 50;

function decodeToMonoPcm(ffmpegPath: string, path: string): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      ['-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited ${code} for ${path}: ${stderr}`));
        return;
      }
      const buffer = Buffer.concat(chunks);
      resolve(new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.length / 2)));
    });
  });
}

function rmsEnvelope(samples: Int16Array): Float64Array {
  const windows = Math.floor(samples.length / WINDOW_SAMPLES);
  const envelope = new Float64Array(windows);
  for (let window = 0; window < windows; window += 1) {
    let sum = 0;
    const start = window * WINDOW_SAMPLES;
    for (let index = start; index < start + WINDOW_SAMPLES; index += 1) {
      const value = samples[index] ?? 0;
      sum += value * value;
    }
    envelope[window] = Math.sqrt(sum / WINDOW_SAMPLES);
  }
  return envelope;
}

function standardize(envelope: Float64Array): Float64Array {
  const mean = envelope.reduce((total, value) => total + value, 0) / envelope.length;
  const variance =
    envelope.reduce((total, value) => total + (value - mean) * (value - mean), 0) / envelope.length;
  const deviation = Math.sqrt(variance) || 1;
  return envelope.map((value) => (value - mean) / deviation);
}

function correlationAtLag(a: Float64Array, b: Float64Array, lag: number): number {
  const length = Math.min(a.length, b.length) - Math.abs(lag);
  if (length <= 0) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    const left = lag >= 0 ? (a[index + lag] ?? 0) : (a[index] ?? 0);
    const right = lag >= 0 ? (b[index] ?? 0) : (b[index - lag] ?? 0);
    sum += left * right;
  }
  return sum / length;
}

export interface OffsetMeasurement {
  readonly bestLagMs: number;
  readonly bestCorrelation: number;
  readonly correlationAtZeroMs: number;
  readonly windows: number;
}

export function measureOffset(reference: Float64Array, candidate: Float64Array): OffsetMeasurement {
  const a = standardize(candidate);
  const b = standardize(reference);

  let bestLag = 0;
  let bestCorrelation = Number.NEGATIVE_INFINITY;
  for (let lag = -MAX_LAG_WINDOWS; lag <= MAX_LAG_WINDOWS; lag += 1) {
    const correlation = correlationAtLag(a, b, lag);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  return {
    bestLagMs: bestLag * WINDOW_MS,
    bestCorrelation: Number(bestCorrelation.toFixed(4)),
    correlationAtZeroMs: Number(correlationAtLag(a, b, 0).toFixed(4)),
    windows: Math.min(a.length, b.length),
  };
}

async function main(): Promise<void> {
  const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
  const [reference, ...candidates] = process.argv.slice(2);
  if (reference === undefined || candidates.length === 0) {
    throw new Error('usage: measure-audio-offset <reference.wav> <candidate.mp4> [candidate...]');
  }

  const referenceEnvelope = rmsEnvelope(await decodeToMonoPcm(ffmpegPath, reference));

  for (const candidate of candidates) {
    const candidateEnvelope = rmsEnvelope(await decodeToMonoPcm(ffmpegPath, candidate));
    const measurement = measureOffset(referenceEnvelope, candidateEnvelope);
    process.stdout.write(
      `${JSON.stringify({ reference, candidate, ...measurement })}\n`,
    );
  }
}

void main().catch((cause: unknown) => {
  process.stderr.write(`${String(cause)}\n`);
  process.exitCode = 1;
});
