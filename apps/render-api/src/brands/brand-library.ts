import { effectiveBrandTokens, isMotionStudioError, parseBrandManifest } from '@video-maker/motion-graphics';
import type { BrandManifest, BrandPalette } from '@video-maker/motion-graphics';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { MotionBrandSource, RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { RenderApiErrorCode } from '../errors/render-api-error';
import { brandPaletteFromTokens, DEFAULT_BRAND_PALETTE } from './brand-palette';
import { wordmarkSvg } from './wordmark-svg';

export const BRAND_FILE_KINDS = ['logo', 'image', 'font', 'music', 'device'] as const;
export type BrandFileKind = (typeof BRAND_FILE_KINDS)[number];

export interface BrandListItem {
  readonly id: string;
  readonly name: string;
  readonly source: MotionBrandSource;
  readonly logo: string | null;
  readonly palette: BrandPalette | null;
  readonly updatedAt: string | null;
}

export interface BrandFiles {
  readonly images: readonly string[];
  readonly fonts: readonly string[];
  readonly music: readonly string[];
  readonly logos: readonly string[];
}

export interface BrandDetail {
  readonly id: string;
  readonly source: MotionBrandSource;
  readonly manifest: BrandManifest;
  readonly tokens: Readonly<Record<string, string>>;
  readonly files: BrandFiles;
}

export interface CreateBrandInput {
  readonly name: string;
  readonly id?: string;
  readonly duplicateFrom?: string;
}

export interface BrandFileUpload {
  readonly contentLength: number;
  readonly body: AsyncIterable<Uint8Array>;
}

export interface LocatedBrand {
  readonly id: string;
  readonly source: MotionBrandSource;
  readonly dir: string;
}

interface FileKindRule {
  readonly folder: string;
  readonly extensions: readonly string[];
  readonly limitBytes: number;
}

const MEGABYTE = 1_048_576;
const IMAGE_EXTENSIONS = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const FILE_KIND_RULES: Readonly<Record<BrandFileKind, FileKindRule>> = {
  logo: { folder: 'img', extensions: IMAGE_EXTENSIONS, limitBytes: 15 * MEGABYTE },
  image: { folder: 'img/scenes', extensions: IMAGE_EXTENSIONS, limitBytes: 15 * MEGABYTE },
  device: { folder: 'img/devices', extensions: IMAGE_EXTENSIONS, limitBytes: 15 * MEGABYTE },
  font: { folder: 'fonts', extensions: ['woff2', 'ttf', 'otf'], limitBytes: 5 * MEGABYTE },
  music: { folder: 'music', extensions: ['mp3', 'wav', 'm4a'], limitBytes: 40 * MEGABYTE },
};

const BRAND_ID = /^[a-z][a-z0-9-]*$/u;
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,119}$/u;
const MANIFEST_FILE = 'brand.json';
const TRASH_DIRECTORY = '.trash';
const UPLOADS_DIRECTORY = '.uploads';
const MAX_BRAND_NAME_LENGTH = 80;
const DEFAULT_TAGLINE = 'Tu mensaje, en video.';
const DEFAULT_VOICE = { id: 'es_AR-daniela-high', lengthScale: 1.08 } as const;
const STARTER_BRAND = 'displayads';
const STARTER_FONTS = [
  { family: 'Outfit', file: 'fonts/outfit-latin-wght-normal.woff2' },
  { family: 'Geist', file: 'fonts/geist-latin-wght-normal.woff2' },
  { family: 'Geist Mono', file: 'fonts/geist-mono-latin-wght-normal.woff2' },
] as const;
const STARTER_TYPOGRAPHY = { display: 'Outfit', body: 'Geist', mono: 'Geist Mono' } as const;
const STARTER_LOGO = 'img/logo.svg';
const STARTER_WORDMARK_FONT = STARTER_FONTS[0].file;

function fail(code: RenderApiErrorCode, resource?: string, expected?: string): never {
  throw new PipelineStageError({ code, stage: null, resource: resource ?? null, expected: expected ?? null });
}

function builtInBrandDir(store: StoreConfig, id: string): string {
  return join(store.motionAssetsRoot, 'brands', id);
}

function userBrandDir(store: StoreConfig, id: string): string {
  return join(store.brandsRoot, id);
}

function assertBrandId(id: string): void {
  if (!BRAND_ID.test(id)) {
    fail('INVALID_INPUT', id, 'a brand id of lowercase letters, digits and dashes starting with a letter');
  }
}

export async function fileExists(deps: RenderApiDependencies, path: string): Promise<boolean> {
  return (await deps.storage.stat(path))?.kind === 'file';
}

export async function locateBrand(deps: RenderApiDependencies, store: StoreConfig, id: string): Promise<LocatedBrand> {
  assertBrandId(id);
  const candidates: readonly LocatedBrand[] = [
    { id, source: 'built-in', dir: builtInBrandDir(store, id) },
    { id, source: 'user', dir: userBrandDir(store, id) },
  ];
  for (const candidate of candidates) {
    if (await fileExists(deps, join(candidate.dir, MANIFEST_FILE))) {
      return candidate;
    }
  }
  return fail('BRAND_UNKNOWN', id);
}

function toManifest(raw: unknown, resource: string): BrandManifest {
  try {
    return parseBrandManifest(raw);
  } catch (cause) {
    if (isMotionStudioError(cause)) {
      throw new PipelineStageError({ code: 'BRAND_MANIFEST_INVALID', stage: null, resource, expected: cause.message, cause });
    }
    throw cause;
  }
}

export async function readManifest(deps: RenderApiDependencies, brand: LocatedBrand): Promise<BrandManifest> {
  const path = join(brand.dir, MANIFEST_FILE);
  let raw: unknown;
  try {
    raw = JSON.parse(await deps.storage.readTextFile(path));
  } catch {
    return fail('BRAND_MANIFEST_INVALID', brand.id, 'a JSON document');
  }
  return toManifest(raw, brand.id);
}

async function readAuthoredCss(deps: RenderApiDependencies, brand: LocatedBrand, manifest: BrandManifest): Promise<string | undefined> {
  if (manifest.css === undefined) {
    return undefined;
  }
  const path = join(brand.dir, manifest.css);
  return (await fileExists(deps, path)) ? deps.storage.readTextFile(path) : undefined;
}

function extensionOf(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase();
}

async function listFileNames(deps: RenderApiDependencies, dir: string): Promise<string[]> {
  const entries = (await deps.storage.listDirectory(dir)) ?? [];
  return entries
    .filter((entry) => entry.isFile && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function listBrandFiles(deps: RenderApiDependencies, dir: string): Promise<BrandFiles> {
  const withFolder = async (folder: string, extensions: readonly string[]): Promise<string[]> =>
    (await listFileNames(deps, join(dir, folder)))
      .filter((name) => extensions.includes(extensionOf(name)))
      .map((name) => `${folder}/${name}`);
  const [logos, scenes, devices, fonts, music] = await Promise.all([
    withFolder(FILE_KIND_RULES.logo.folder, FILE_KIND_RULES.logo.extensions),
    withFolder(FILE_KIND_RULES.image.folder, FILE_KIND_RULES.image.extensions),
    withFolder(FILE_KIND_RULES.device.folder, FILE_KIND_RULES.device.extensions),
    withFolder(FILE_KIND_RULES.font.folder, FILE_KIND_RULES.font.extensions),
    withFolder(FILE_KIND_RULES.music.folder, FILE_KIND_RULES.music.extensions),
  ]);
  return { images: [...scenes, ...devices], fonts, music, logos };
}

export async function describeBrand(deps: RenderApiDependencies, brand: LocatedBrand): Promise<BrandDetail> {
  const manifest = await readManifest(deps, brand);
  const css = await readAuthoredCss(deps, brand, manifest);
  return {
    id: brand.id,
    source: brand.source,
    manifest,
    tokens: effectiveBrandTokens(manifest, css),
    files: await listBrandFiles(deps, brand.dir),
  };
}

export async function listBrands(deps: RenderApiDependencies, store: StoreConfig): Promise<readonly BrandListItem[]> {
  const items: BrandListItem[] = [];
  for (const document of await deps.listMotionBrands()) {
    let manifest: BrandManifest;
    try {
      manifest = parseBrandManifest(document.manifest);
    } catch {
      deps.logger.error({ event: 'brand-skipped', detail: { id: document.id, why: 'invalid-manifest' } });
      continue;
    }
    const manifestStat = document.source === 'user' ? await deps.storage.stat(join(userBrandDir(store, document.id), MANIFEST_FILE)) : null;
    items.push({
      id: document.id,
      name: manifest.name,
      source: document.source,
      logo: manifest.logo,
      palette: manifest.palette ?? null,
      updatedAt: manifestStat === null ? null : new Date(manifestStat.modifiedAtMs).toISOString(),
    });
  }
  return items.sort((left, right) =>
    left.source === right.source ? left.name.localeCompare(right.name) : left.source === 'built-in' ? -1 : 1,
  );
}

export async function getBrand(deps: RenderApiDependencies, store: StoreConfig, id: string): Promise<BrandDetail> {
  return describeBrand(deps, await locateBrand(deps, store, id));
}

function slugifyBrandName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (slug === '') {
    return fail('INVALID_INPUT', name, 'a name holding at least one letter or digit');
  }
  return /^[a-z]/u.test(slug) ? slug : `brand-${slug}`;
}

function normalizeBrandName(name: string): string {
  const normalized = name.trim().replace(/\s+/gu, ' ');
  if (normalized === '' || normalized.length > MAX_BRAND_NAME_LENGTH) {
    return fail('INVALID_INPUT', 'name', `a name of 1 to ${MAX_BRAND_NAME_LENGTH} characters`);
  }
  return normalized;
}

async function copyDirectory(deps: RenderApiDependencies, from: string, to: string): Promise<void> {
  await deps.storage.ensureDirectory(to);
  for (const entry of (await deps.storage.listDirectory(from)) ?? []) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    if (entry.isDirectory) {
      await copyDirectory(deps, join(from, entry.name), join(to, entry.name));
    } else if (entry.isFile) {
      await deps.storage.copyFile(join(from, entry.name), join(to, entry.name));
    }
  }
}

export async function writeManifest(deps: RenderApiDependencies, dir: string, manifest: BrandManifest): Promise<void> {
  await deps.storage.writeTextFile(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function readBytes(deps: RenderApiDependencies, path: string): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of deps.storage.openReadStream(path)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function duplicateBrand(deps: RenderApiDependencies, store: StoreConfig, id: string, name: string, sourceId: string): Promise<void> {
  const source = await locateBrand(deps, store, sourceId);
  const sourceManifest = await readManifest(deps, source);
  const sourceTokens = effectiveBrandTokens(sourceManifest, await readAuthoredCss(deps, source, sourceManifest));
  const target = userBrandDir(store, id);

  await copyDirectory(deps, source.dir, target);
  if (sourceManifest.css !== undefined) {
    await deps.storage.removeFile(join(target, sourceManifest.css));
  }
  const withoutCss = Object.fromEntries(Object.entries(sourceManifest).filter(([key]) => key !== 'css'));
  const manifest = toManifest(
    { ...withoutCss, id, name, palette: sourceManifest.palette ?? brandPaletteFromTokens(sourceTokens), tokens: sourceTokens },
    id,
  );
  await writeManifest(deps, target, manifest);
}

async function createStarterBrand(deps: RenderApiDependencies, store: StoreConfig, id: string, name: string): Promise<void> {
  const target = userBrandDir(store, id);
  const starter = builtInBrandDir(store, STARTER_BRAND);

  await deps.storage.ensureDirectory(join(target, 'fonts'));
  for (const font of STARTER_FONTS) {
    await deps.storage.copyFile(join(starter, font.file), join(target, font.file));
  }
  const wordmarkFont = await readBytes(deps, join(starter, STARTER_WORDMARK_FONT));
  await deps.storage.ensureDirectory(join(target, 'img'));
  await deps.storage.writeTextFile(join(target, STARTER_LOGO), wordmarkSvg(name, Buffer.from(wordmarkFont).toString('base64')));

  const manifest = toManifest(
    {
      id,
      name,
      spokenName: name,
      tagline: DEFAULT_TAGLINE,
      logo: STARTER_LOGO,
      palette: DEFAULT_BRAND_PALETTE,
      typography: STARTER_TYPOGRAPHY,
      fonts: STARTER_FONTS,
      devices: {},
      images: {},
      music: [],
      voice: DEFAULT_VOICE,
    },
    id,
  );
  await writeManifest(deps, target, manifest);
}

export async function createBrand(deps: RenderApiDependencies, store: StoreConfig, input: CreateBrandInput): Promise<BrandDetail> {
  const name = normalizeBrandName(input.name);
  const id = input.id ?? slugifyBrandName(name);
  assertBrandId(id);
  const taken = (await fileExists(deps, join(builtInBrandDir(store, id), MANIFEST_FILE))) || (await fileExists(deps, join(userBrandDir(store, id), MANIFEST_FILE)));
  if (taken) {
    fail('BRAND_EXISTS', id);
  }

  if (input.duplicateFrom === undefined) {
    await createStarterBrand(deps, store, id, name);
  } else {
    await duplicateBrand(deps, store, id, name, input.duplicateFrom);
  }
  return getBrand(deps, store, id);
}

export function assertWritable(brand: LocatedBrand): void {
  if (brand.source === 'built-in') {
    fail('BRAND_READ_ONLY', brand.id);
  }
}

function referencedFiles(manifest: BrandManifest): string[] {
  return [
    manifest.logo,
    ...(manifest.isotipo === undefined ? [] : [manifest.isotipo]),
    ...(manifest.css === undefined ? [] : [manifest.css]),
    ...manifest.fonts.map((font) => font.file),
    ...Object.values(manifest.devices).map((device) => device.image),
    ...Object.values(manifest.images).map((image) => (typeof image === 'string' ? image : image.file)),
    ...manifest.music.map((track) => track.file),
  ];
}

export function isSafeRelativePath(path: string): boolean {
  return path !== '' && !path.startsWith('/') && !path.includes('\\') && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

async function assertReferencedFilesExist(deps: RenderApiDependencies, brand: LocatedBrand, manifest: BrandManifest): Promise<void> {
  const missing: string[] = [];
  for (const reference of new Set(referencedFiles(manifest))) {
    if (!isSafeRelativePath(reference) || !(await fileExists(deps, join(brand.dir, reference)))) {
      missing.push(reference);
    }
  }
  if (missing.length > 0) {
    fail('BRAND_MANIFEST_INVALID', brand.id, `files that exist inside the brand folder; missing: ${missing.slice(0, 6).join(', ')}`);
  }
}

export async function updateBrand(deps: RenderApiDependencies, store: StoreConfig, id: string, raw: unknown): Promise<BrandDetail> {
  const brand = await locateBrand(deps, store, id);
  assertWritable(brand);
  const manifest = toManifest(raw, id);
  if (manifest.id !== id) {
    fail('BRAND_MANIFEST_INVALID', id, `a manifest whose id is "${id}"`);
  }
  await assertReferencedFilesExist(deps, brand, manifest);
  await writeManifest(deps, brand.dir, manifest);
  return describeBrand(deps, brand);
}

export async function deleteBrand(deps: RenderApiDependencies, store: StoreConfig, id: string): Promise<void> {
  const brand = await locateBrand(deps, store, id);
  assertWritable(brand);
  const stamp = deps.clock.nowIso().replace(/[:.]/gu, '-');
  await copyDirectory(deps, brand.dir, join(store.brandsRoot, TRASH_DIRECTORY, `${id}-${stamp}`));
  await deps.storage.removeDirectory(brand.dir);
}

export function isBrandFileKind(value: string): value is BrandFileKind {
  return (BRAND_FILE_KINDS as readonly string[]).includes(value);
}

export async function saveBrandFile(
  deps: RenderApiDependencies,
  store: StoreConfig,
  input: { readonly id: string; readonly kind: string; readonly name: string; readonly upload: BrandFileUpload },
): Promise<{ readonly path: string }> {
  const brand = await locateBrand(deps, store, input.id);
  assertWritable(brand);
  if (!isBrandFileKind(input.kind)) {
    return fail('BRAND_FILE_INVALID', input.kind, BRAND_FILE_KINDS.join(', '));
  }
  const rule = FILE_KIND_RULES[input.kind];
  if (!SAFE_FILE_NAME.test(input.name) || input.name.includes('..') || !input.name.includes('.')) {
    return fail('BRAND_FILE_INVALID', input.name, 'a plain file name with an extension');
  }
  if (!rule.extensions.includes(extensionOf(input.name))) {
    return fail('BRAND_FILE_INVALID', input.name, `a ${input.kind} file of type ${rule.extensions.join(', ')}`);
  }
  if (input.upload.contentLength > rule.limitBytes) {
    return fail('ASSET_TOO_LARGE', input.name, `at most ${rule.limitBytes} bytes`);
  }

  const relativePath = `${rule.folder}/${input.name}`;
  const uploads = join(store.brandsRoot, UPLOADS_DIRECTORY);
  await deps.storage.ensureDirectory(join(brand.dir, rule.folder));
  await deps.storage.ensureDirectory(uploads);
  const outcome = await deps.storage.writeTemporary({
    directory: uploads,
    source: input.upload.body,
    expectedBytes: input.upload.contentLength,
    limitBytes: rule.limitBytes,
  });
  if (outcome.kind === 'limit-exceeded') {
    return fail('ASSET_TOO_LARGE', input.name, `at most ${outcome.limitBytes} bytes`);
  }
  if (outcome.kind === 'aborted') {
    return fail('ASSET_UPLOAD_ABORTED', input.name);
  }
  await deps.storage.promoteTemporary(outcome.temporaryPath, join(brand.dir, relativePath));
  return { path: relativePath };
}

export interface BrandFileTarget {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
}

export async function resolveBrandFile(deps: RenderApiDependencies, store: StoreConfig, id: string, relativePath: string): Promise<BrandFileTarget> {
  if (!isSafeRelativePath(relativePath)) {
    fail('ASSET_PATH_INVALID', relativePath, 'a path inside the brand folder');
  }
  const brand = await locateBrand(deps, store, id);
  const absolutePath = join(brand.dir, relativePath);
  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    return fail('FILE_NOT_FOUND', relativePath);
  }
  return { absolutePath, relativePath, sizeBytes: fileStat.sizeBytes };
}
