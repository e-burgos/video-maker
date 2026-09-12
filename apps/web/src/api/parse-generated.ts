import { responseShapeUnexpected } from './render-api-error';
import type { GeneratedFile, GeneratedListing } from './render-api-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGeneratedFile(value: unknown): value is GeneratedFile {
  return (
    isRecord(value) &&
    typeof value['path'] === 'string' &&
    typeof value['sizeBytes'] === 'number' &&
    typeof value['modifiedAtMs'] === 'number'
  );
}

export function parseGeneratedListing(value: unknown): GeneratedListing {
  if (
    !isRecord(value) ||
    typeof value['slug'] !== 'string' ||
    !Array.isArray(value['roots']) ||
    !value['roots'].every((root) => typeof root === 'string') ||
    !Array.isArray(value['files']) ||
    !value['files'].every(isGeneratedFile)
  ) {
    throw responseShapeUnexpected(200, 'a generated listing');
  }

  return value as GeneratedListing;
}
