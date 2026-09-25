const HTML_TAG_PATTERN = /<[^>]*>/g;
const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function stripHtml(value: string): string {
  const withoutTags = value.replace(HTML_TAG_PATTERN, '');
  const withoutEntities = withoutTags.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity] ?? entity);
  return withoutEntities.replace(/\s+/g, ' ').trim();
}

const FREE_COMMERCIAL_LICENSE_PATTERN = /^CC[\s-]?BY(-SA)?\s+\d/;

export function isFreeCommercialLicense(licenseShortName: string | undefined): boolean {
  if (licenseShortName === undefined) {
    return false;
  }

  const normalized = licenseShortName.trim().toUpperCase();
  if (normalized.length === 0) {
    return false;
  }
  if (normalized.startsWith('CC0')) {
    return true;
  }
  if (
    normalized.includes('PUBLIC DOMAIN') ||
    normalized.startsWith('PDM') ||
    normalized.startsWith('PD-') ||
    normalized === 'PD'
  ) {
    return true;
  }
  return FREE_COMMERCIAL_LICENSE_PATTERN.test(normalized);
}

export function stableResultId(prefix: string, seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(index)) | 0;
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

export async function collectBytes(
  source: AsyncIterable<Uint8Array>,
  limitBytes: number,
  sourceLabel: string,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of source) {
    totalBytes += chunk.length;
    if (totalBytes > limitBytes) {
      throw new Error(`${sourceLabel} response exceeded the size limit`);
    }
    chunks.push(chunk);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
