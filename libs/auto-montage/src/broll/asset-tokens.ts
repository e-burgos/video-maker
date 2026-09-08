import type { ProjectRelativePath } from '../catalog/catalog.schema';
import { normalizeTerm } from '../concepts/normalize-term';

const NON_ALPHANUMERIC_PATTERN = /[^\p{L}\p{N}]+/u;
const PURELY_NUMERIC_PATTERN = /^\p{N}+$/u;

function dropRoleSegments(assetPath: string): string {
  return assetPath.split('/').slice(2).join('/');
}

function stripExtension(pathTail: string): string {
  const lastDotIndex = pathTail.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return pathTail;
  }
  return pathTail.slice(0, lastDotIndex);
}

function isPurelyNumeric(token: string): boolean {
  return PURELY_NUMERIC_PATTERN.test(token);
}

export function assetTokens(
  assetPath: ProjectRelativePath,
  minTermLength: number,
): ReadonlySet<string> {
  const pathWithoutRole = dropRoleSegments(assetPath);
  const pathWithoutExtension = stripExtension(pathWithoutRole);
  const rawTokens = pathWithoutExtension.split(NON_ALPHANUMERIC_PATTERN);

  const tokens = rawTokens
    .map(normalizeTerm)
    .filter(
      (token) => token.length > 0 && token.length >= minTermLength && !isPurelyNumeric(token),
    );

  return new Set(tokens);
}
