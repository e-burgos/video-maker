import type { MediaAsset, Transcription, VoiceScriptManifest } from '@video-maker/timeline-core';
import {
  TranscriptionSchema,
  VoiceScriptManifestSchema,
  voiceScriptManifestIsTimed,
} from '@video-maker/timeline-core';
import type { ReadTextFile } from '@video-maker/media-local';

import { MontageInputError } from '../errors/montage-input-error';
import type { MediaProject } from '../project/media-project';
import type { ScriptLineWindow } from '../transcript/align-transcript-to-script-lines';
import { toAbsolutePath } from '../project/project-paths';
import { voiceScriptManifestPath } from './voice-script-paths';

export interface ReadVoiceScriptTrackDependencies {
  readonly readTextFile: ReadTextFile;
}

export interface VoiceScriptTrack {
  readonly asset: MediaAsset;
  readonly transcription: Transcription;
  readonly manifestPath: string;
  readonly timed: boolean;
  readonly narrationEndMs: number;
  readonly lineWindows: readonly ScriptLineWindow[];
}

async function readJsonDocument(
  project: MediaProject,
  relativePath: string,
  readTextFile: ReadTextFile,
  missingReason: 'voice-track-missing' | 'voice-track-unreadable',
): Promise<unknown> {
  let raw: string;
  try {
    raw = await readTextFile(toAbsolutePath(project, relativePath));
  } catch {
    throw new MontageInputError({ projectRoot: project.root, reason: missingReason });
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new MontageInputError({ projectRoot: project.root, reason: 'voice-track-unreadable' });
  }
}

function toLineWindows(manifest: VoiceScriptManifest): readonly ScriptLineWindow[] {
  return manifest.lines.map((line) => ({
    startMs: line.startMs,
    endMs: line.endMs ?? line.startMs + line.durationMs,
  }));
}

function narrationEndMs(manifest: VoiceScriptManifest): number {
  return Math.max(0, ...toLineWindows(manifest).map((window) => window.endMs));
}

function toVoiceAsset(manifest: VoiceScriptManifest): MediaAsset {
  return {
    id: manifest.path,
    kind: 'audio',
    path: manifest.path,
    durationMs: manifest.durationMs,
    probedAt: manifest.updatedAt,
  };
}

export async function readVoiceScriptTrack(
  project: MediaProject,
  deps: ReadVoiceScriptTrackDependencies,
): Promise<VoiceScriptTrack> {
  const manifestPath = voiceScriptManifestPath();
  const manifestJson = await readJsonDocument(
    project,
    manifestPath,
    deps.readTextFile,
    'voice-track-missing',
  );

  const manifest = VoiceScriptManifestSchema.safeParse(manifestJson);
  if (!manifest.success) {
    throw new MontageInputError({ projectRoot: project.root, reason: 'voice-track-unreadable' });
  }

  const wordsJson = await readJsonDocument(
    project,
    manifest.data.wordsPath,
    deps.readTextFile,
    'voice-track-unreadable',
  );

  const transcription = TranscriptionSchema.safeParse(wordsJson);
  if (!transcription.success) {
    throw new MontageInputError({ projectRoot: project.root, reason: 'voice-track-unreadable' });
  }

  return {
    asset: toVoiceAsset(manifest.data),
    transcription: transcription.data,
    manifestPath,
    timed: voiceScriptManifestIsTimed(manifest.data),
    narrationEndMs: narrationEndMs(manifest.data),
    lineWindows: toLineWindows(manifest.data),
  };
}
