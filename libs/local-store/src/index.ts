export { openStudioDatabase, IN_MEMORY_DATABASE_PATH } from './database/open-studio-database';
export type { StudioDatabase } from './database/open-studio-database';

export { applyMigrations, currentUserVersion, MIGRATIONS } from './database/migrations';
export type { Migration } from './database/migrations';

export { PROJECT_MODES } from './schema/project-mode';
export type { ProjectMode } from './schema/project-mode';

export * as studioSchema from './schema/studio-schema';

export { createProjectsRepository } from './repositories/projects-repository';
export type { ProjectRecord, ProjectsClock, ProjectsRepository } from './repositories/projects-repository';

export {
  createOrganizationRepository,
  EMPTY_ORGANIZATION,
  UNPLACED_VIDEO,
} from './repositories/organization-repository';
export type {
  Organization,
  OrganizationRepository,
  VideoCategory,
  VideoFolder,
  VideoPlacement,
} from './repositories/organization-repository';

export {
  createProducerRepository,
  PRODUCER_MESSAGE_ROLES,
} from './repositories/producer-repository';
export type {
  ProducerMessage,
  ProducerMessageRole,
  ProducerMessageUsage,
  ProducerRepository,
  ProducerSession,
} from './repositories/producer-repository';

export {
  createJobsRepository,
  UNFINISHED_JOB_STATES,
} from './repositories/jobs-repository';
export type { JobRecord, JobsRepository, NewJobRecord } from './repositories/jobs-repository';

export { createSettingsRepository } from './repositories/settings-repository';
export type { SettingsClock, SettingsRepository } from './repositories/settings-repository';

export { ASSET_STATUSES, createAssetsRepository } from './repositories/assets-repository';
export type {
  AssetRecord,
  AssetsClock,
  AssetsRepository,
  AssetStatus,
  NewPendingAssetRecord,
} from './repositories/assets-repository';
