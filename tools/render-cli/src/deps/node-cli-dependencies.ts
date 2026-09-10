import { nodeDirectoryReader, nodeEnsureDirectory, nodeFileStatReader, nodeWriteTextFile } from '@video-maker/auto-montage';
import {
  ExecaCommandRunner,
  mixTimelineAudio,
  muxAudioIntoVideo,
  nodeReadTextFile,
  resolveBinaries,
  systemClock,
  verifyMixLoudness,
} from '@video-maker/media-local';

import { StageFailedError } from '../errors/stage-failed-error';

import type { CliDependencies } from './cli-dependencies';
import type {
  AudioVideoMuxer,
  MixLoudnessVerifier,
  TimelineAudioMixer,
  TimelineRenderer,
} from './timeline-renderer';

const nodeTimelineRenderer: TimelineRenderer = async (timeline, request) => {
  const { renderTimeline, RenderTimelineError } = await import('@video-maker/composition-remotion/render');
  try {
    const result = await renderTimeline(timeline, {
      outPath: request.outPath,
      publicDir: request.publicDir,
      audio: 'muted',
    });
    return {
      outPath: result.outPath,
      width: result.width,
      height: result.height,
      fps: result.fps,
      durationInFrames: result.durationInFrames,
    };
  } catch (cause) {
    if (cause instanceof RenderTimelineError) {
      throw new StageFailedError({ stage: 'render', resource: request.outPath, reason: cause.code, cause });
    }
    throw cause;
  }
};

function createNodeTimelineAudioMixer(env: NodeJS.ProcessEnv): TimelineAudioMixer {
  return async (timeline, request) => {
    const { ffmpeg } = await resolveBinaries(env);
    const result = await mixTimelineAudio(timeline, request.outPath, new ExecaCommandRunner(), {
      ffmpegPath: ffmpeg,
      runOptions: { cwd: request.projectRoot },
    });
    return { outputPath: result.outputPath };
  };
}

function createNodeAudioVideoMuxer(env: NodeJS.ProcessEnv): AudioVideoMuxer {
  return async (request) => {
    const { ffmpeg, ffprobe } = await resolveBinaries(env);
    const result = await muxAudioIntoVideo(
      request.videoPath,
      request.audioPath,
      request.outPath,
      new ExecaCommandRunner(),
      { ffmpegPath: ffmpeg, ffprobePath: ffprobe },
    );
    return { outputPath: result.outputPath };
  };
}

function createNodeMixLoudnessVerifier(env: NodeJS.ProcessEnv): MixLoudnessVerifier {
  return async (timeline, path) => {
    const { ffmpeg } = await resolveBinaries(env);
    const verification = await verifyMixLoudness(
      path,
      timeline.audioMix.voice,
      new ExecaCommandRunner(),
      { ffmpegPath: ffmpeg },
    );
    return {
      withinTolerance: verification.withinTolerance,
      integratedLufs: verification.measured.integratedLufs,
      truePeakDbtp: verification.measured.truePeakDbtp,
      integratedDeltaLu: verification.integratedDeltaLu,
      truePeakDeltaDb: verification.truePeakDeltaDb,
    };
  };
}

export function createNodeCliDependencies(env: NodeJS.ProcessEnv): CliDependencies {
  return {
    runner: new ExecaCommandRunner(),
    resolveBinaries: () => resolveBinaries(env),
    readDirectory: nodeDirectoryReader,
    statFile: nodeFileStatReader,
    readTextFile: nodeReadTextFile,
    writeTextFile: nodeWriteTextFile,
    ensureDirectory: nodeEnsureDirectory,
    clock: systemClock,
    renderTimeline: nodeTimelineRenderer,
    mixTimelineAudio: createNodeTimelineAudioMixer(env),
    muxAudioIntoVideo: createNodeAudioVideoMuxer(env),
    verifyMixLoudness: createNodeMixLoudnessVerifier(env),
  };
}
