import type { DirectoryReader, EnsureDirectory, FileStatReader, WriteTextFile } from '@video-maker/auto-montage';
import type { Clock, CommandRunner, ReadTextFile, ResolvedBinaries } from '@video-maker/media-local';

import type {
  AudioVideoMuxer,
  MixLoudnessVerifier,
  TimelineAudioMixer,
  TimelineRenderer,
} from './timeline-renderer';

export interface CliDependencies {
  readonly runner: CommandRunner;
  readonly resolveBinaries: () => Promise<ResolvedBinaries>;
  readonly readDirectory: DirectoryReader;
  readonly statFile: FileStatReader;
  readonly readTextFile: ReadTextFile;
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
  readonly clock: Clock;
  readonly renderTimeline: TimelineRenderer;
  readonly mixTimelineAudio: TimelineAudioMixer;
  readonly muxAudioIntoVideo: AudioVideoMuxer;
  readonly verifyMixLoudness: MixLoudnessVerifier;
}
