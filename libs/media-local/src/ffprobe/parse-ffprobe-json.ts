import { z } from 'zod';

import { MediaAssetSchema } from '@video-maker/timeline-core';
import type { AssetId, MediaAsset, MediaKind } from '@video-maker/timeline-core';

import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { FfprobeOutputSchema } from './ffprobe-output.schema';
import type { FfprobeOutput, FfprobeStream } from './ffprobe-output.schema';

export interface ParseFfprobeContext {
  path: string;
  probedAt: string;
  assetId?: AssetId;
}

type Rotation = 0 | 90 | 180 | 270;

const COMMAND = 'ffprobe';
const VALID_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
const IMAGE_FORMAT_NAME_PATTERN = /(^|,)(image2|image2pipe|[a-z0-9]+_pipe)(,|$)/;

interface AudioInfo {
  sampleRate: number;
  channels: number;
  codec?: string;
}

interface BuildAssetParams {
  kind: MediaKind;
  ctx: ParseFfprobeContext;
  id: AssetId;
  videoStream: FfprobeStream | undefined;
  audioStream: FfprobeStream | undefined;
  hasAudio: boolean;
  output: FfprobeOutput;
  raw: string;
}

function unparseable(reason: string, raw: string, cause?: unknown): UnparseableOutputError {
  return new UnparseableOutputError({ command: COMMAND, reason, sample: raw, cause });
}

function basename(path: string): string {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] ?? path;
}

function parseProbeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw unparseable('La salida de ffprobe no es JSON válido.', raw, cause);
  }
}

function isValidRotation(value: number): value is Rotation {
  return VALID_ROTATIONS.includes(value as Rotation);
}

function rotationFromSideData(raw: number): number {
  return ((-Math.round(raw) % 360) + 360) % 360;
}

function rotationFromTag(raw: string): number {
  return ((Math.round(Number(raw)) % 360) + 360) % 360;
}

export function resolveRotation(stream: FfprobeStream | undefined): Rotation {
  if (stream === undefined) {
    return 0;
  }

  const sideDataEntry = stream.side_data_list?.find((entry) => typeof entry.rotation === 'number');
  if (sideDataEntry?.rotation !== undefined) {
    const resolved = rotationFromSideData(sideDataEntry.rotation);
    return isValidRotation(resolved) ? resolved : 0;
  }

  const tagRotate = stream.tags?.rotate;
  if (tagRotate !== undefined && Number.isFinite(Number(tagRotate))) {
    const resolved = rotationFromTag(tagRotate);
    return isValidRotation(resolved) ? resolved : 0;
  }

  return 0;
}

export function parseRational(text: string | undefined): number | undefined {
  if (text === undefined) {
    return undefined;
  }

  const [numText, denText] = text.split('/');
  const numerator = Number(numText);
  const denominator = denText === undefined ? 1 : Number(denText);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0 || numerator <= 0) {
    return undefined;
  }

  return numerator / denominator;
}

function findVideoStream(streams: readonly FfprobeStream[]): FfprobeStream | undefined {
  return streams.find((stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
}

function findAudioStream(streams: readonly FfprobeStream[]): FfprobeStream | undefined {
  return streams.find((stream) => stream.codec_type === 'audio');
}

export function classifyKind(
  formatName: string | undefined,
  videoStream: FfprobeStream | undefined,
  audioStream: FfprobeStream | undefined,
  raw: string,
): MediaKind {
  if (formatName !== undefined && IMAGE_FORMAT_NAME_PATTERN.test(formatName)) {
    return 'image';
  }

  if (
    videoStream !== undefined &&
    videoStream.nb_frames === '1' &&
    parseRational(videoStream.avg_frame_rate) === undefined
  ) {
    return 'image';
  }

  if (videoStream !== undefined) {
    return 'video';
  }

  if (audioStream !== undefined) {
    return 'audio';
  }

  throw unparseable('El archivo no tiene streams de video ni de audio.', raw);
}

function durationToMs(text: string | undefined, raw: string): number {
  const value = Number(text);
  if (text === undefined || !Number.isFinite(value) || value < 0) {
    throw unparseable('La duración informada por ffprobe no es un número válido.', raw);
  }
  return Math.round(value * 1000);
}

function buildAudioInfo(stream: FfprobeStream): AudioInfo {
  return {
    sampleRate: Number(stream.sample_rate),
    channels: stream.channels ?? 0,
    ...(stream.codec_name !== undefined ? { codec: stream.codec_name } : {}),
  };
}

function buildImageAsset(params: BuildAssetParams): Record<string, unknown> {
  const { id, ctx, videoStream } = params;
  return {
    id,
    kind: 'image',
    path: ctx.path,
    durationMs: 0,
    ...(videoStream?.width !== undefined ? { width: videoStream.width } : {}),
    ...(videoStream?.height !== undefined ? { height: videoStream.height } : {}),
    hasAudio: false,
    probedAt: ctx.probedAt,
  };
}

function buildVideoAsset(params: BuildAssetParams): Record<string, unknown> {
  const { id, ctx, videoStream, audioStream, hasAudio, output, raw } = params;
  if (videoStream === undefined) {
    throw unparseable('Falta el stream de video.', raw);
  }

  const rotation = resolveRotation(videoStream);
  const swap = rotation === 90 || rotation === 270;
  const durationMs = durationToMs(output.format?.duration ?? videoStream.duration, raw);
  const fps = parseRational(videoStream.avg_frame_rate ?? videoStream.r_frame_rate);

  return {
    id,
    kind: 'video',
    path: ctx.path,
    durationMs,
    ...(fps !== undefined ? { fps } : {}),
    ...(videoStream.width !== undefined
      ? { width: swap ? videoStream.height : videoStream.width }
      : {}),
    ...(videoStream.height !== undefined
      ? { height: swap ? videoStream.width : videoStream.height }
      : {}),
    rotation,
    hasAudio,
    ...(audioStream !== undefined ? { audio: buildAudioInfo(audioStream) } : {}),
    ...(videoStream.codec_name !== undefined ? { videoCodec: videoStream.codec_name } : {}),
    probedAt: ctx.probedAt,
  };
}

function buildAudioAsset(params: BuildAssetParams): Record<string, unknown> {
  const { id, ctx, audioStream, output, raw } = params;
  if (audioStream === undefined) {
    throw unparseable('Falta el stream de audio.', raw);
  }

  const durationMs = durationToMs(output.format?.duration ?? audioStream.duration, raw);

  return {
    id,
    kind: 'audio',
    path: ctx.path,
    durationMs,
    hasAudio: true,
    audio: buildAudioInfo(audioStream),
    probedAt: ctx.probedAt,
  };
}

function buildAsset(params: BuildAssetParams): Record<string, unknown> {
  switch (params.kind) {
    case 'image':
      return buildImageAsset(params);
    case 'video':
      return buildVideoAsset(params);
    case 'audio':
      return buildAudioAsset(params);
  }
}

export function parseFfprobeJson(raw: string, ctx: ParseFfprobeContext): MediaAsset {
  const probe = parseProbeJson(raw);
  const parsedOutput = FfprobeOutputSchema.safeParse(probe);
  if (!parsedOutput.success) {
    throw unparseable(z.prettifyError(parsedOutput.error), raw, parsedOutput.error);
  }

  const output = parsedOutput.data;
  const videoStream = findVideoStream(output.streams);
  const audioStream = findAudioStream(output.streams);
  const kind = classifyKind(output.format?.format_name, videoStream, audioStream, raw);
  const hasAudio = audioStream !== undefined;
  const id = ctx.assetId ?? basename(ctx.path);

  const asset = buildAsset({ kind, ctx, id, videoStream, audioStream, hasAudio, output, raw });

  const result = MediaAssetSchema.safeParse(asset);
  if (!result.success) {
    throw unparseable(z.prettifyError(result.error), raw, result.error);
  }

  return result.data;
}
