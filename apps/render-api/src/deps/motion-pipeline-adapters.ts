import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { MotionStudioError } from '@video-maker/motion-graphics';
import type { MotionPipelinePorts } from '@video-maker/motion-graphics';

import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isElevenLabsVoiceId } from '../voice/elevenlabs-voice';
import type { MotionBrandDocument, MotionBrandSource, RenderApiDependencies } from './render-api-dependencies';

const TRANSCRIPTION_LANGUAGE = 'es';
const HYPERFRAMES_BEATS_PROJECT =
  '<!doctype html><html><body><div id="root" data-composition-id="beats" data-start="0" data-width="1920" data-height="1080" data-duration="1"><audio id="music" src="music.mp3" data-start="0"></audio></div></body></html>';

async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

function withoutSchemaMarkers(schema: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema' && key !== '$id'));
}

const FAILURE_DETAIL_CHARS = 800;
const MOTION_STORYBOARD_EFFORT = 'low';
const ERROR_LINE = /✗/u;

function hyperframesFailureDetail(stdout: string, stderr: string): string {
  const errorLines = `${stdout}\n${stderr}`.split('\n').map((line) => line.trim()).filter((line) => ERROR_LINE.test(line));
  const detail = errorLines.length > 0 ? errorLines.join(' · ') : (stderr.trim() || stdout.trim()).slice(-FAILURE_DETAIL_CHARS);
  return detail.slice(0, FAILURE_DETAIL_CHARS);
}

export function createMotionPipelinePorts(deps: RenderApiDependencies, assetsRoot: string, userBrandsRoot: string): MotionPipelinePorts {
  const hyperframes = async (args: readonly string[], cwd: string): Promise<void> => {
    const result = await deps.runHyperframes({ args, cwd });
    if (result.exitCode !== 0) {
      throw new MotionStudioError('STAGE_FAILED', `hyperframes ${args[0] ?? ''} failed: ${hyperframesFailureDetail(result.stdout, result.stderr)}`);
    }
  };

  return {
    assetsRoot,
    userBrandsRoot,
    readText: (path) => readFile(path, 'utf8'),
    readBytes: async (path) => new Uint8Array(await readFile(path)),
    writeText: async (path, content) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },
    exists: pathExists,
    copyTree: async (from, to) => {
      await mkdir(to, { recursive: true });
      await cp(from, to, { recursive: true });
    },
    copyFile: async (from, to) => {
      await mkdir(dirname(to), { recursive: true });
      await copyFile(from, to);
    },
    removeFile: (path) => rm(path, { force: true }),
    synthesize: async ({ text, voice, lengthScale, outPath, noiseScale, noiseScaleW, trailingPauseMs }) => {
      const elevenLabs = isElevenLabsVoiceId(voice);
      const [{ ttsVoicesDir }, models] = elevenLabs
        ? [{ ttsVoicesDir: '' }, []]
        : await Promise.all([deps.resolveVoiceBinaries(), deps.listVoiceModels()]);
      const model = elevenLabs ? undefined : models.find((candidate) => candidate.id === voice);
      if (!elevenLabs && model === undefined) {
        throw new PipelineStageError({
          code: 'VOICE_ASSET_NOT_FOUND',
          stage: null,
          resource: voice,
          expected: models.map((candidate) => candidate.id).join(', '),
        });
      }
      const textPath = join(await mkdtemp(join(tmpdir(), 'motion-voice-')), 'line.txt');
      await writeFile(textPath, text);
      await mkdir(dirname(outPath), { recursive: true });
      await deps.synthesizeVoice({
        textPath,
        outPath,
        modelPath: model === undefined ? '' : join(ttsVoicesDir, model.directory),
        ...(elevenLabs ? { voiceId: voice } : {}),
        lengthScale,
        ...(noiseScale === undefined ? {} : { noiseScale }),
        ...(noiseScaleW === undefined ? {} : { noiseScaleW }),
        ...(trailingPauseMs === undefined ? {} : { trailingPauseMs }),
        projectRoot: dirname(outPath),
      });
    },
    transcribe: async (wavPath) => {
      const transcription = await deps.transcribeVoice({
        wavPath,
        outBase: join(await mkdtemp(join(tmpdir(), 'motion-whisper-')), 'take'),
        assetId: basename(wavPath),
        language: TRANSCRIPTION_LANGUAGE,
        projectRoot: dirname(wavPath),
      });
      return {
        text: transcription.words.map((word) => word.text).join(' '),
        words: transcription.words.map((word) => ({
          text: word.text,
          start: word.startMs / 1000,
          end: word.endMs / 1000,
        })),
      };
    },
    detectBeats: async (musicPath) => {
      const directory = await mkdtemp(join(tmpdir(), 'motion-beats-'));
      await copyFile(musicPath, join(directory, 'music.mp3'));
      await writeFile(join(directory, 'index.html'), HYPERFRAMES_BEATS_PROJECT);
      await hyperframes(['beats', '.', '--json'], directory);
      return readFile(join(directory, 'beats', 'music.mp3.json'), 'utf8');
    },
    measureLoudness: async (wavPath) => {
      const [{ ffmpeg }, runner, { measureLoudness }] = await Promise.all([deps.resolveMontageBinaries(), deps.createCommandRunner(), import('@video-maker/media-local')]);
      return (await measureLoudness(wavPath, runner, { ffmpegPath: ffmpeg })).integratedLufs;
    },
    trimAudio: async ({ from, to, durationSec, targetLufs }) => {
      const [{ ffmpeg }, runner] = await Promise.all([deps.resolveMontageBinaries(), deps.createCommandRunner()]);
      await mkdir(dirname(to), { recursive: true });
      const result = await runner.run(ffmpeg, [
        '-v',
        'error',
        '-y',
        '-i',
        from,
        '-t',
        String(durationSec),
        '-ar',
        '48000',
        to,
      ]);
      if (result.exitCode !== 0) {
        throw new MotionStudioError('STAGE_FAILED', `ffmpeg trim failed: ${result.stderr.slice(-400)}`);
      }
      const { normalizeAudioLoudness } = await import('@video-maker/media-local');
      await normalizeAudioLoudness(to, targetLufs, runner, { ffmpegPath: ffmpeg });
    },
    render: async ({ projectDir, outPath, fps, quality }) => {
      await mkdir(dirname(outPath), { recursive: true });
      await hyperframes(['lint'], projectDir);
      await hyperframes(['render', '-f', String(fps), '-q', quality, '-o', outPath], projectDir);
      const [{ DEFAULT_VOICE_TARGET, normalizeVideoMasterLoudness }, { ffmpeg }, runner] = await Promise.all([
        import('@video-maker/media-local'),
        deps.resolveMontageBinaries(),
        deps.createCommandRunner(),
      ]);
      await normalizeVideoMasterLoudness(outPath, DEFAULT_VOICE_TARGET, runner, { ffmpegPath: ffmpeg });
    },
    askAgent: async (request) => {
      const response = await deps.aiAgent({
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        jsonSchema: withoutSchemaMarkers(request.jsonSchema),
        effort: MOTION_STORYBOARD_EFFORT,
      });
      return {
        json: response.json,
        usage: {
          inputTokens: response.usage.tokensIn,
          outputTokens: response.usage.tokensOut,
          costUsd: response.usage.costUsd,
        },
      };
    },
  };
}

export interface MotionBrandRoots {
  readonly builtInAssetsRoot: string;
  readonly userBrandsRoot: string;
}

export interface MotionBrandListingReport {
  readonly skipped: (reason: { readonly id: string; readonly why: 'collides-with-built-in' | 'unreadable' }) => void;
}

async function readBrandDocuments(
  brandsRoot: string,
  source: MotionBrandSource,
  tolerateInvalid: boolean,
  report: MotionBrandListingReport | undefined,
): Promise<MotionBrandDocument[]> {
  const entries = await readdir(brandsRoot, { withFileTypes: true }).catch(() => []);
  const documents: MotionBrandDocument[] = [];

  for (const entry of entries.filter((candidate) => candidate.isDirectory() && !candidate.name.startsWith('.'))) {
    const manifestPath = join(brandsRoot, entry.name, 'brand.json');
    if (!(await pathExists(manifestPath))) {
      continue;
    }
    try {
      documents.push({ id: entry.name, source, manifest: JSON.parse(await readFile(manifestPath, 'utf8')) as unknown });
    } catch (cause) {
      if (tolerateInvalid) {
        report?.skipped({ id: entry.name, why: 'unreadable' });
        continue;
      }
      throw new PipelineStageError({
        code: 'SERVER_CONFIG_INVALID',
        stage: null,
        resource: `brands/${entry.name}/brand.json`,
        expected: 'a JSON document',
        cause,
      });
    }
  }

  return documents;
}

export async function listMotionBrandDocuments(
  roots: MotionBrandRoots,
  report?: MotionBrandListingReport,
): Promise<readonly MotionBrandDocument[]> {
  const builtIn = await readBrandDocuments(join(roots.builtInAssetsRoot, 'brands'), 'built-in', false, report);
  const builtInIds = new Set(builtIn.map((document) => document.id));
  const user = (await readBrandDocuments(roots.userBrandsRoot, 'user', true, report)).filter((document) => {
    if (!builtInIds.has(document.id)) {
      return true;
    }
    report?.skipped({ id: document.id, why: 'collides-with-built-in' });
    return false;
  });

  return [...builtIn, ...user];
}
