import { z } from 'zod';

import { MediaAssetSchema, TranscriptionEngineSchema } from '@video-maker/timeline-core';

export const CATALOG_SCHEMA_VERSION = 1;

const WINDOWS_DRIVE_LETTER_PATTERN = /^[A-Za-z]:[\\/]/u;
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

function startsWithPosixRoot(value: string): boolean {
  return value.startsWith('/');
}

function containsWindowsSeparator(value: string): boolean {
  return value.includes('\\');
}

function startsWithWindowsDriveLetter(value: string): boolean {
  return WINDOWS_DRIVE_LETTER_PATTERN.test(value);
}

function startsWithUriScheme(value: string): boolean {
  return URI_SCHEME_PATTERN.test(value);
}

function containsParentDirectorySegment(value: string): boolean {
  return value.split('/').some((segment) => segment === '..');
}

function isPortableProjectRelativePath(value: string): boolean {
  return (
    !startsWithPosixRoot(value) &&
    !containsWindowsSeparator(value) &&
    !startsWithWindowsDriveLetter(value) &&
    !startsWithUriScheme(value) &&
    !containsParentDirectorySegment(value)
  );
}

export const ProjectRelativePathSchema = z
  .string()
  .min(1)
  .refine(isPortableProjectRelativePath, {
    message: 'La ruta debe ser POSIX y relativa a la raíz del proyecto de medios.',
  });

export const AssetRoleSchema = z.enum(['aroll', 'broll', 'image', 'audio', 'voice', 'logo', 'reference']);

export const AssetFingerprintSchema = z.strictObject({
  sizeBytes: z.number().int().nonnegative(),
  modifiedAtMs: z.number().int().nonnegative(),
});

const CatalogAssetObjectSchema = z.strictObject({
  role: AssetRoleSchema,
  fingerprint: AssetFingerprintSchema,
  asset: MediaAssetSchema,
});

function assertAssetIdEqualsPath(
  value: z.infer<typeof CatalogAssetObjectSchema>,
  ctx: z.RefinementCtx,
): void {
  if (value.asset.id !== value.asset.path) {
    ctx.addIssue({
      code: 'custom',
      path: ['asset', 'id'],
      message: 'asset.id debe ser igual a asset.path.',
    });
  }
}

export const CatalogAssetSchema = CatalogAssetObjectSchema.superRefine(assertAssetIdEqualsPath);

export const TranscriptRefSchema = z.strictObject({
  assetId: z.string().min(1),
  transcriptPath: ProjectRelativePathSchema,
  fingerprint: AssetFingerprintSchema,
  engine: TranscriptionEngineSchema,
  model: z.string().min(1),
  language: z.string().min(1),
});

export const IgnoredEntrySchema = z.strictObject({
  path: ProjectRelativePathSchema,
  reason: z.enum([
    'hidden',
    'unsupported-extension',
    'unknown-directory',
    'unexpected-file',
    'extension-role-mismatch',
  ]),
});

export const ProbeFailureSchema = z.strictObject({
  path: ProjectRelativePathSchema,
  errorCode: z.enum(['BINARY_NOT_FOUND', 'COMMAND_FAILED', 'UNPARSEABLE_OUTPUT', 'UNKNOWN']),
  message: z.string().min(1),
});

const CatalogObjectSchema = z.strictObject({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  projectSlug: z.string().min(1),
  assets: z.array(CatalogAssetSchema),
  transcripts: z.array(TranscriptRefSchema),
  ignored: z.array(IgnoredEntrySchema),
  probeFailures: z.array(ProbeFailureSchema),
});

function isSortedAscendingWithoutDuplicates(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous !== undefined && current !== undefined && previous >= current) {
      return false;
    }
  }
  return true;
}

function assertCatalogInvariants(
  catalog: z.infer<typeof CatalogObjectSchema>,
  ctx: z.RefinementCtx,
): void {
  const assetIds = catalog.assets.map((entry) => entry.asset.id);
  if (!isSortedAscendingWithoutDuplicates(assetIds)) {
    ctx.addIssue({
      code: 'custom',
      path: ['assets'],
      message: 'assets debe estar ordenado ascendentemente por asset.id, sin duplicados.',
    });
  }

  const transcriptAssetIds = catalog.transcripts.map((entry) => entry.assetId);
  if (!isSortedAscendingWithoutDuplicates(transcriptAssetIds)) {
    ctx.addIssue({
      code: 'custom',
      path: ['transcripts'],
      message: 'transcripts debe estar ordenado ascendentemente por assetId, sin duplicados.',
    });
  }

  const arollAssetIds = new Set(
    catalog.assets.filter((entry) => entry.role === 'aroll').map((entry) => entry.asset.id),
  );
  catalog.transcripts.forEach((transcript, index) => {
    if (!arollAssetIds.has(transcript.assetId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['transcripts', index, 'assetId'],
        message: 'transcripts.assetId debe referenciar un asset existente con role aroll.',
      });
    }
  });

  const ignoredPaths = catalog.ignored.map((entry) => entry.path);
  if (!isSortedAscendingWithoutDuplicates(ignoredPaths)) {
    ctx.addIssue({
      code: 'custom',
      path: ['ignored'],
      message: 'ignored debe estar ordenado ascendentemente por path, sin duplicados.',
    });
  }

  const probeFailurePaths = catalog.probeFailures.map((entry) => entry.path);
  if (!isSortedAscendingWithoutDuplicates(probeFailurePaths)) {
    ctx.addIssue({
      code: 'custom',
      path: ['probeFailures'],
      message: 'probeFailures debe estar ordenado ascendentemente por path, sin duplicados.',
    });
  }
}

export const CatalogSchema = CatalogObjectSchema.superRefine(assertCatalogInvariants);

export type ProjectRelativePath = z.infer<typeof ProjectRelativePathSchema>;
export type AssetRole = z.infer<typeof AssetRoleSchema>;
export type AssetFingerprint = z.infer<typeof AssetFingerprintSchema>;
export type CatalogAsset = z.infer<typeof CatalogAssetSchema>;
export type TranscriptRef = z.infer<typeof TranscriptRefSchema>;
export type IgnoredEntry = z.infer<typeof IgnoredEntrySchema>;
export type ProbeFailure = z.infer<typeof ProbeFailureSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
