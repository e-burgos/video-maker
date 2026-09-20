export { resolveMediaProject } from './project/media-project';
export type { MediaProject } from './project/media-project';

export {
  buildProjectSubdirectories,
  catalogPath,
  editDecisionListPath,
  isInsideRaw,
  timelinePath,
  toAbsolutePath,
  toProjectRelativePath,
  workPath,
} from './project/project-paths';

export { discoverAssets } from './ingest/discover-assets';
export type {
  AssetFinding,
  DiscoverAssetsDependencies,
  DiscoverAssetsResult,
  IgnoredFinding,
} from './ingest/discover-assets';

export {
  CATALOG_SCHEMA_VERSION,
  AssetFingerprintSchema,
  AssetRoleSchema,
  CatalogAssetSchema,
  CatalogSchema,
  IgnoredEntrySchema,
  ProbeFailureSchema,
  ProjectRelativePathSchema,
  TranscriptRefSchema,
} from './catalog/catalog.schema';
export type {
  AssetFingerprint,
  AssetRole,
  Catalog,
  CatalogAsset,
  IgnoredEntry,
  ProbeFailure,
  ProjectRelativePath,
  TranscriptRef,
} from './catalog/catalog.schema';

export { readCatalog } from './catalog/read-catalog';
export { writeCatalog } from './catalog/write-catalog';

export { ingestProject } from './ingest/ingest-project';
export type { IngestDependencies, IngestOptions, IngestResult } from './ingest/ingest-project';

export { AutoMontageError, isAutoMontageError } from './errors/auto-montage-error';
export type { AutoMontageErrorCode } from './errors/auto-montage-error';
export { AssetProbeFailedError } from './errors/asset-probe-failed-error';
export { CatalogUnreadableError } from './errors/catalog-unreadable-error';
export { PathEscapesProjectError } from './errors/path-escapes-project-error';
export { ProjectLayoutError } from './errors/project-layout-error';
export { ReadOnlyRawPathError } from './errors/read-only-raw-path-error';
export { TranscriptionFailedError } from './errors/transcription-failed-error';

export { nodeDirectoryReader } from './fs/directory-reader';
export type { DirectoryEntry, DirectoryReader } from './fs/directory-reader';
export { nodeFileStatReader } from './fs/file-stat-reader';
export type { FileStatReader, FileStats } from './fs/file-stat-reader';
export { nodeWriteTextFile } from './fs/write-text-file';
export type { WriteTextFile } from './fs/write-text-file';
export { nodeEnsureDirectory } from './fs/ensure-directory';
export type { EnsureDirectory } from './fs/ensure-directory';

export { MONTAGE_PRESETS, resolveMontagePreset } from './presets/preset-registry';
export {
  CAPTION_STYLE_BY_MONTAGE_PRESET,
  captionStyleForMontagePreset,
} from './presets/caption-style-defaults';
export type { BrollRolePriority, MontagePreset, MontagePresetName } from './presets/montage-preset';

export { EditDecisionListInvalidError } from './errors/edit-decision-list-invalid-error';
export { MontageInputError } from './errors/montage-input-error';
export { TimelineInvalidError } from './errors/timeline-invalid-error';
export type { MontageInputReason } from './errors/montage-input-error';

export type { Concept, ConceptOccurrence } from './concepts/concept';

export type { BrollOverlayPlan, BrollRejection, BrollRejectionReason } from './broll/plan-broll-overlays';

export { alignTranscriptToScript } from './transcript/align-transcript-to-script';
export { alignTranscriptToScriptLines } from './transcript/align-transcript-to-script-lines';
export type { ScriptLineWindow } from './transcript/align-transcript-to-script-lines';
export type { ScriptAlignmentCounts, ScriptAlignmentResult } from './transcript/align-transcript-to-script';

export { autoMontage } from './auto-montage';
export type {
  AutoMontageOptions,
  AutoMontageResult,
  LogoMode,
  MontageDependencies,
  VoiceSource,
  VoiceTrackSummary,
} from './auto-montage';

export {
  VOICE_DIRECTORY_NAME,
  VOICE_SCRIPT_MANIFEST_FILE_NAME,
  VOICE_SCRIPT_TRACK_ID,
  voiceDirectoryPath,
  voiceScriptManifestPath,
  voiceScriptTrackPath,
  voiceScriptWordsPath,
  voiceTrackPath,
  voiceWordsPath,
} from './voice/voice-script-paths';
export { readVoiceScriptTrack } from './voice/read-voice-script-track';
export type { VoiceScriptTrack } from './voice/read-voice-script-track';

export { serializeMontageDocument } from './montage/serialize-montage-document';
export { writeEditDecisionList } from './montage/write-edit-decision-list';
export { writeTimeline } from './montage/write-timeline';
