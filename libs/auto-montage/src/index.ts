export { resolveMediaProject } from './project/media-project';
export type { MediaProject } from './project/media-project';

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
