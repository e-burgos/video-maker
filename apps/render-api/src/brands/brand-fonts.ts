import type { BrandManifest } from '@video-maker/motion-graphics';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { collectBytes } from '../media-search/commons-shared';
import { assertWritable, describeBrand, locateBrand, readManifest, writeManifest } from './brand-library';
import type { BrandDetail } from './brand-library';

const FAMILY_NAME = /^[A-Za-z0-9 ]{2,60}$/u;
const GOOGLE_FONTS_CSS_HOST = 'fonts.googleapis.com';
const GOOGLE_FONTS_FILE_HOST = 'fonts.gstatic.com';
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const KEPT_SUBSETS = ['latin', 'latin-ext'];
const CSS_TIMEOUT_MS = 10_000;
const FILE_TIMEOUT_MS = 20_000;
const MAX_CSS_BYTES = 1024 * 1024;
const MAX_FONT_BYTES = 5 * 1024 * 1024;
const WOFF2_MAGIC = [0x77, 0x4f, 0x46, 0x32];
const VARIABLE_RANGE = '100 900';
const UPLOADS_DIRECTORY = '.uploads';
const WEIGHT_AXES = ['wght@100..900', 'wght@400;700', null] as const;
const FONT_FACE_BLOCK = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/gu;

interface RemoteFontFace {
  readonly family: string;
  readonly subset: string;
  readonly weight: string;
  readonly unicodeRange: string | undefined;
  readonly url: string;
}

type CssAttempt = { readonly kind: 'css'; readonly css: string } | { readonly kind: 'rejected' };

function downloadFailed(resource: string, expected: string, cause?: unknown): PipelineStageError {
  return new PipelineStageError({ code: 'BRAND_FONT_DOWNLOAD_FAILED', stage: null, resource, expected, cause });
}

function googleFontsCssUrl(family: string, axis: string | null): string {
  const encoded = family.trim().replace(/\s+/gu, '+');
  return `https://${GOOGLE_FONTS_CSS_HOST}/css2?family=${encoded}${axis === null ? '' : `:${axis}`}&display=swap`;
}

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

async function attemptCss(deps: RenderApiDependencies, family: string, axis: string | null): Promise<CssAttempt> {
  const url = googleFontsCssUrl(family, axis);
  let response;
  try {
    response = await deps.fetchRemote(url, { headers: { 'user-agent': CHROME_USER_AGENT }, timeoutMs: CSS_TIMEOUT_MS });
  } catch (cause) {
    throw downloadFailed(family, 'Google Fonts to answer the stylesheet request', cause);
  }
  if (response.status === 400 || response.status === 404) {
    return { kind: 'rejected' };
  }
  if (response.status !== 200) {
    throw downloadFailed(family, `Google Fonts to answer 200, got ${response.status}`);
  }
  try {
    return { kind: 'css', css: new TextDecoder('utf-8').decode(await collectBytes(response.body(), MAX_CSS_BYTES, 'Google Fonts stylesheet')) };
  } catch (cause) {
    throw downloadFailed(family, 'a readable Google Fonts stylesheet', cause);
  }
}

async function fetchFontStylesheet(deps: RenderApiDependencies, family: string): Promise<string> {
  for (const axis of WEIGHT_AXES) {
    const attempt = await attemptCss(deps, family, axis);
    if (attempt.kind === 'css') {
      return attempt.css;
    }
  }
  throw new PipelineStageError({ code: 'BRAND_FONT_UNKNOWN', stage: null, resource: family });
}

function declaration(block: string, property: string): string | undefined {
  return new RegExp(`${property}\\s*:\\s*([^;]+);`, 'u').exec(block)?.[1]?.trim();
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/gu, '');
}

function parseFontFaces(css: string): RemoteFontFace[] {
  const faces: RemoteFontFace[] = [];
  for (const match of css.matchAll(FONT_FACE_BLOCK)) {
    const subset = match[1] ?? '';
    const block = match[2] ?? '';
    const url = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/u.exec(block)?.[1];
    const family = declaration(block, 'font-family');
    if (!KEPT_SUBSETS.includes(subset) || url === undefined || family === undefined || declaration(block, 'font-style') === 'italic') {
      continue;
    }
    faces.push({
      family: unquote(family),
      subset,
      weight: declaration(block, 'font-weight') ?? '400',
      unicodeRange: declaration(block, 'unicode-range'),
      url,
    });
  }
  return faces;
}

function familySlug(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

function fontFileName(face: RemoteFontFace): string {
  const weight = face.weight === VARIABLE_RANGE ? '' : `-${face.weight.replace(/\s+/gu, '-')}`;
  return `fonts/${familySlug(face.family)}-${face.subset}${weight}.woff2`;
}

function hasWoff2Magic(bytes: Uint8Array): boolean {
  return WOFF2_MAGIC.every((value, index) => bytes[index] === value);
}

async function* singleChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

async function downloadFontBytes(deps: RenderApiDependencies, url: string): Promise<Uint8Array> {
  if (hostOf(url) !== GOOGLE_FONTS_FILE_HOST) {
    throw downloadFailed(url, `a file served from ${GOOGLE_FONTS_FILE_HOST}`);
  }
  try {
    const response = await deps.fetchRemote(url, { headers: { 'user-agent': CHROME_USER_AGENT }, timeoutMs: FILE_TIMEOUT_MS });
    if (response.status !== 200) {
      throw new Error(`status ${response.status}`);
    }
    const bytes = await collectBytes(response.body(), MAX_FONT_BYTES, 'Google Fonts file');
    if (!hasWoff2Magic(bytes)) {
      throw new Error('the file is not woff2');
    }
    return bytes;
  } catch (cause) {
    throw downloadFailed(url, 'a woff2 font file', cause);
  }
}

async function saveFontBytes(deps: RenderApiDependencies, store: StoreConfig, brandDir: string, relativePath: string, bytes: Uint8Array): Promise<void> {
  const uploads = join(store.brandsRoot, UPLOADS_DIRECTORY);
  await deps.storage.ensureDirectory(join(brandDir, 'fonts'));
  await deps.storage.ensureDirectory(uploads);
  const outcome = await deps.storage.writeTemporary({
    directory: uploads,
    source: singleChunk(bytes),
    expectedBytes: bytes.length,
    limitBytes: MAX_FONT_BYTES,
  });
  if (outcome.kind !== 'written') {
    throw downloadFailed(relativePath, 'the font file to be stored');
  }
  await deps.storage.promoteTemporary(outcome.temporaryPath, join(brandDir, relativePath));
}

function replaceFamilyFonts(manifest: BrandManifest, family: string, replacements: BrandManifest['fonts']): BrandManifest['fonts'] {
  const kept = manifest.fonts.filter((font) => font.family !== family);
  return [...kept, ...replacements];
}

async function removeUnreferencedFiles(deps: RenderApiDependencies, brandDir: string, previous: BrandManifest, next: BrandManifest): Promise<void> {
  const stillUsed = new Set(next.fonts.map((font) => font.file));
  for (const font of previous.fonts) {
    if (!stillUsed.has(font.file)) {
      await deps.storage.removeFile(join(brandDir, font.file));
    }
  }
}

export function parseFontFamily(value: unknown): string {
  const family = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)['family'] : undefined;
  if (typeof family !== 'string' || !FAMILY_NAME.test(family)) {
    throw new PipelineStageError({ code: 'INVALID_INPUT', stage: null, expected: 'an object with a family of 2 to 60 letters, digits and spaces' });
  }
  return family.trim().replace(/\s+/gu, ' ');
}

export async function addGoogleFont(deps: RenderApiDependencies, store: StoreConfig, id: string, family: string): Promise<BrandDetail> {
  const brand = await locateBrand(deps, store, id);
  assertWritable(brand);
  const faces = parseFontFaces(await fetchFontStylesheet(deps, family));
  if (faces.length === 0) {
    throw downloadFailed(family, 'a stylesheet with latin or latin-ext faces');
  }

  const downloaded: BrandManifest['fonts'] = [];
  for (const face of faces) {
    const file = fontFileName(face);
    await saveFontBytes(deps, store, brand.dir, file, await downloadFontBytes(deps, face.url));
    downloaded.push({ family: face.family, file, weight: face.weight, ...(face.unicodeRange === undefined ? {} : { unicodeRange: face.unicodeRange }) });
  }

  const manifest = await readManifest(deps, brand);
  const canonicalFamily = faces[0]?.family ?? family;
  const next: BrandManifest = { ...manifest, fonts: replaceFamilyFonts(manifest, canonicalFamily, downloaded) };
  await writeManifest(deps, brand.dir, next);
  await removeUnreferencedFiles(deps, brand.dir, manifest, next);
  return describeBrand(deps, brand);
}
