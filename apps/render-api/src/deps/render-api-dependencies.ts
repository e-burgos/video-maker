import type { DirectoryReader, FileStatReader } from '@video-maker/auto-montage';
import type {
  AssetsRepository,
  JobsRepository,
  OrganizationRepository,
  ProducerRepository,
  ProjectsRepository,
  PublicationsRepository,
  SettingsRepository,
} from '@video-maker/local-store';
import type {
  CommandRunner,
  MixLoudnessVerification,
  ResolvedBinaries,
  ResolvedVoiceBinaries,
  VoiceModel,
} from '@video-maker/media-local';
import type { MotionPipelinePorts } from '@video-maker/motion-graphics';
import type { MediaAsset, Timeline, Transcription, VoiceTarget } from '@video-maker/timeline-core';

import type { EngineModuleStatus } from '../engine/engine-modules';
import type { ProducerAgentPort } from '../producer/producer-agent';
import type { BinaryStatus } from '../engine/media-binaries';
import type { SecretStore } from '../secrets/keychain-secret-store';
import type { ObjectStorage } from './object-storage';

export type RenderProgressListener = (renderedFrames: number, totalFrames: number) => void;

export interface RenderMutedVideoInput {
  readonly timeline: Timeline;
  readonly outPath: string;
  readonly publicDir: string;
  readonly onProgress?: RenderProgressListener;
}

export interface RenderMutedVideoOutput {
  readonly outPath: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

export type RenderMutedVideoPort = (input: RenderMutedVideoInput) => Promise<RenderMutedVideoOutput>;

export interface MixTimelineAudioInput {
  readonly timeline: Timeline;
  readonly outPath: string;
  readonly projectRoot: string;
}

export interface MixTimelineAudioOutput {
  readonly outputPath: string;
  readonly filterComplex: string;
}

export type MixTimelineAudioPort = (input: MixTimelineAudioInput) => Promise<MixTimelineAudioOutput>;

export interface MuxAudioIntoVideoInput {
  readonly videoPath: string;
  readonly audioPath: string;
  readonly outPath: string;
}

export interface MuxAudioIntoVideoOutput {
  readonly outputPath: string;
}

export type MuxAudioIntoVideoPort = (input: MuxAudioIntoVideoInput) => Promise<MuxAudioIntoVideoOutput>;

export interface VerifyMixLoudnessInput {
  readonly path: string;
  readonly target: VoiceTarget;
}

export type VerifyMixLoudnessPort = (input: VerifyMixLoudnessInput) => Promise<MixLoudnessVerification>;

export type EnsureDirectoryPort = (path: string) => Promise<void>;

export type ProbeMediaBinariesPort = () => Promise<readonly BinaryStatus[]>;

export type PreloadEngineModulesPort = () => Promise<readonly EngineModuleStatus[]>;

export interface ProbeAssetInput {
  readonly path: string;
  readonly assetId: string;
}

export type ProbeAssetPort = (input: ProbeAssetInput) => Promise<MediaAsset>;

export type CreateCommandRunnerPort = () => Promise<CommandRunner>;

export interface FetchRemoteInit {
  readonly method?: 'GET' | 'POST' | 'PUT';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
  readonly timeoutMs: number;
}

export interface FetchRemoteResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: () => AsyncIterable<Uint8Array>;
}

export type FetchRemotePort = (url: string, init: FetchRemoteInit) => Promise<FetchRemoteResponse>;

export interface ExtractFrameInput {
  readonly path: string;
  readonly atSeconds: number;
  readonly outPath: string;
  readonly maxLongSidePx: number;
  readonly projectRoot: string;
}

export type ExtractFramePort = (input: ExtractFrameInput) => Promise<void>;

export interface ResizeImageInput {
  readonly path: string;
  readonly outPath: string;
  readonly maxLongSidePx: number;
  readonly projectRoot: string;
}

export type ResizeImagePort = (input: ResizeImageInput) => Promise<void>;

export interface BuildKenBurnsClipInput {
  readonly photoPath: string;
  readonly frames: number;
  readonly fps: number;
  readonly outPath: string;
  readonly projectRoot: string;
}

export type BuildKenBurnsClipPort = (input: BuildKenBurnsClipInput) => Promise<void>;

export interface ConcatVideoClipsInput {
  readonly listPath: string;
  readonly outPath: string;
  readonly projectRoot: string;
}

export type ConcatVideoClipsPort = (input: ConcatVideoClipsInput) => Promise<void>;

export type ResolveMontageBinariesPort = () => Promise<ResolvedBinaries>;

export interface AiAgentRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly jsonSchema: unknown;
  readonly model?: string | null;
}

export interface AiAgentUsage {
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly costUsd: number | null;
  readonly durationMs: number | null;
  readonly model: string | null;
}

export interface AiAgentResponse {
  readonly json: unknown;
  readonly usage: AiAgentUsage;
}

export type AiAgentPort = (request: AiAgentRequest) => Promise<AiAgentResponse>;

export type ProbeProducerBinaryPort = () => Promise<boolean>;

export type ResolveVoiceBinariesPort = () => Promise<ResolvedVoiceBinaries>;

export type ListVoiceModelsPort = () => Promise<readonly VoiceModel[]>;

export interface VoicePreviewCacheStat {
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
}

export interface VoicePreviewCache {
  readonly directory: string;
  readonly ensureDirectory: (path: string) => Promise<void>;
  readonly stat: (path: string) => Promise<VoicePreviewCacheStat | null>;
  readonly writeTextFile: (path: string, contents: string) => Promise<void>;
  readonly openReadStream: (path: string) => AsyncIterable<Uint8Array>;
}

export interface SynthesizeVoiceInput {
  readonly textPath: string;
  readonly outPath: string;
  readonly modelPath: string;
  readonly lengthScale?: number;
  readonly projectRoot: string;
}

export type SynthesizeVoicePort = (input: SynthesizeVoiceInput) => Promise<void>;

export interface ExtractVoiceAudioInput {
  readonly inputPath: string;
  readonly outPath: string;
  readonly sampleRate: number;
  readonly channels: number;
  readonly projectRoot: string;
}

export type ExtractVoiceAudioPort = (input: ExtractVoiceAudioInput) => Promise<void>;

export interface ConcatVoiceTracksInput {
  readonly inputPaths: readonly string[];
  readonly outPath: string;
  readonly gapMs: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly projectRoot: string;
}

export type ConcatVoiceTracksPort = (input: ConcatVoiceTracksInput) => Promise<void>;

export interface PlaceVoiceSegment {
  readonly path: string;
  readonly startMs: number;
}

export interface PlaceVoiceTracksInput {
  readonly segments: readonly PlaceVoiceSegment[];
  readonly totalMs: number | null;
  readonly outPath: string;
  readonly sampleRate: number;
  readonly channels: number;
  readonly projectRoot: string;
}

export type PlaceVoiceTracksPort = (input: PlaceVoiceTracksInput) => Promise<void>;

export interface TranscribeVoiceInput {
  readonly wavPath: string;
  readonly outBase: string;
  readonly assetId: string;
  readonly language: string;
  readonly projectRoot: string;
}

export type TranscribeVoicePort = (input: TranscribeVoiceInput) => Promise<Transcription>;

export type RandomIdPort = () => string;

export interface Clock {
  nowIso(): string;
}

export interface LogEvent {
  readonly event: string;
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

export interface Logger {
  readonly info: (event: LogEvent) => void;
  readonly error: (event: LogEvent) => void;
}

export interface LocalStorePort {
  readonly projects: ProjectsRepository;
  readonly organization: OrganizationRepository;
  readonly producer: ProducerRepository;
  readonly jobs: JobsRepository;
  readonly settings: SettingsRepository;
  readonly assets: AssetsRepository;
  readonly publications: PublicationsRepository;
  readonly schemaVersion: number;
  readonly close: () => void;
}

export type MotionBrandSource = 'built-in' | 'user';

export interface MotionBrandDocument {
  readonly id: string;
  readonly source: MotionBrandSource;
  readonly manifest: unknown;
}

export type ListMotionBrandsPort = () => Promise<readonly MotionBrandDocument[]>;

export type CreateMotionPortsPort = () => MotionPipelinePorts;

export interface RunHyperframesInput {
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface RunHyperframesOutput {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type RunHyperframesPort = (input: RunHyperframesInput) => Promise<RunHyperframesOutput>;

export interface RasterizeSvgInput {
  readonly svgPath: string;
  readonly outPath: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export type RasterizeSvgPort = (input: RasterizeSvgInput) => Promise<void>;

export type OAuthLoopbackHandler = (query: Readonly<Record<string, string>>) => Promise<string>;

export interface StartOAuthLoopbackInput {
  readonly handler: OAuthLoopbackHandler;
  readonly timeoutMs: number;
}

export interface OAuthLoopbackHandle {
  readonly port: number;
  readonly close: () => void;
}

export type StartOAuthLoopbackPort = (input: StartOAuthLoopbackInput) => Promise<OAuthLoopbackHandle>;

export type HashTextPort = (text: string) => string;

export interface RenderApiDependencies {
  readonly renderMutedVideo: RenderMutedVideoPort;
  readonly mixTimelineAudio: MixTimelineAudioPort;
  readonly muxAudioIntoVideo: MuxAudioIntoVideoPort;
  readonly verifyMixLoudness: VerifyMixLoudnessPort;
  readonly ensureDirectory: EnsureDirectoryPort;
  readonly probeMediaBinaries: ProbeMediaBinariesPort;
  readonly preloadEngineModules: PreloadEngineModulesPort;
  readonly storage: ObjectStorage;
  readonly localStore: LocalStorePort;
  readonly hashText: HashTextPort;
  readonly probeAsset: ProbeAssetPort;
  readonly extractFrame: ExtractFramePort;
  readonly resizeImage: ResizeImagePort;
  readonly fetchRemote: FetchRemotePort;
  readonly buildKenBurnsClip: BuildKenBurnsClipPort;
  readonly concatVideoClips: ConcatVideoClipsPort;
  readonly randomId: RandomIdPort;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly readDirectory: DirectoryReader;
  readonly statFile: FileStatReader;
  readonly createCommandRunner: CreateCommandRunnerPort;
  readonly resolveMontageBinaries: ResolveMontageBinariesPort;
  readonly aiAgent: AiAgentPort;
  readonly producerAgent: ProducerAgentPort;
  readonly probeProducerBinary: ProbeProducerBinaryPort;
  readonly resolveVoiceBinaries: ResolveVoiceBinariesPort;
  readonly listVoiceModels: ListVoiceModelsPort;
  readonly voicePreviewCache: VoicePreviewCache;
  readonly synthesizeVoice: SynthesizeVoicePort;
  readonly extractVoiceAudio: ExtractVoiceAudioPort;
  readonly concatVoiceTracks: ConcatVoiceTracksPort;
  readonly placeVoiceTracks: PlaceVoiceTracksPort;
  readonly transcribeVoice: TranscribeVoicePort;
  readonly secretStore: SecretStore;
  readonly listMotionBrands: ListMotionBrandsPort;
  readonly motionPorts: CreateMotionPortsPort;
  readonly runHyperframes: RunHyperframesPort;
  readonly rasterizeSvg: RasterizeSvgPort;
  readonly startOAuthLoopback: StartOAuthLoopbackPort;
}
