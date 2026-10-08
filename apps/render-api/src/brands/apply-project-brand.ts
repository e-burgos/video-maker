import { resolveMediaProject, toAbsolutePath, writeCatalog, writeTimeline } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import type { CaptionTheme, Timeline } from '@video-maker/timeline-core';
import { basename, join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { removeCatalogAsset } from '../store/catalog-merge';
import { ingestAssetIntoCatalog, readCatalogOrThrow } from '../store/ingest-asset-into-catalog';
import { readStoredTimelineIfPersisted } from '../store/project-scope';
import type { KeyedSerializer } from '../store/serialize-by-key';
import { findTimelineAssetReferences } from '../store/timeline-asset-references';
import { BRAND_LOGO_ASSET_NAME, brandLogoAssetId, loadProjectBrandContext, PROJECT_BRAND_FONTS_DIRECTORY } from './project-brand-context';
import type { ProjectBrandContext } from './project-brand-context';
import { brandLogoRasterSize } from './rasterize-svg';

export interface AppliedProjectBrand {
  readonly captionTheme: CaptionTheme | null;
  readonly logoAssetId: string | null;
}

const BRAND_WORK_DIRECTORY = 'work/.brand';
const LOGO_DIRECTORY = 'raw/logo';
const RASTER_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

function extensionOf(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1).toLowerCase();
}

function emptyApplied(): AppliedProjectBrand {
  return { captionTheme: null, logoAssetId: null };
}

async function stageBrandLogo(
  deps: RenderApiDependencies,
  project: MediaProject,
  brand: ProjectBrandContext,
): Promise<{ readonly assetId: string; readonly stagedPath: string } | null> {
  if ((await deps.storage.stat(brand.logoFile))?.kind !== 'file') {
    return null;
  }
  const extension = extensionOf(brand.logoFile);
  const workDirectory = toAbsolutePath(project, BRAND_WORK_DIRECTORY);
  await deps.storage.ensureDirectory(workDirectory);

  if (extension === 'svg') {
    const size = brandLogoRasterSize(await deps.storage.readTextFile(brand.logoFile));
    const stagedPath = join(workDirectory, `${brand.id}.png`);
    await deps.rasterizeSvg({ svgPath: brand.logoFile, outPath: stagedPath, ...size });
    return { assetId: brandLogoAssetId(brand.id), stagedPath };
  }
  if (RASTER_EXTENSIONS.includes(extension)) {
    const stagedPath = join(workDirectory, `${brand.id}.${extension}`);
    await deps.storage.copyFile(brand.logoFile, stagedPath);
    return { assetId: brandLogoAssetId(brand.id, extension === 'jpeg' ? 'jpg' : extension), stagedPath };
  }
  return null;
}

async function copyBrandFonts(deps: RenderApiDependencies, project: MediaProject, brand: ProjectBrandContext): Promise<void> {
  if (brand.fontFiles.length === 0) {
    return;
  }
  const target = toAbsolutePath(project, PROJECT_BRAND_FONTS_DIRECTORY);
  await deps.storage.ensureDirectory(target);
  for (const file of brand.fontFiles) {
    await deps.storage.copyFile(join(brand.brandDir, file), join(target, basename(file)));
  }
}

async function listBrandLogoAssetIds(deps: RenderApiDependencies, project: MediaProject): Promise<string[]> {
  const entries = (await deps.storage.listDirectory(toAbsolutePath(project, LOGO_DIRECTORY))) ?? [];
  return entries
    .filter((entry) => entry.isFile && BRAND_LOGO_ASSET_NAME.test(entry.name))
    .map((entry) => `${LOGO_DIRECTORY}/${entry.name}`);
}

async function removeLogoAsset(deps: RenderApiDependencies, project: MediaProject, assetId: string): Promise<void> {
  await deps.storage.removeFile(toAbsolutePath(project, assetId));
  const catalog = await readCatalogOrThrow(deps, project, true);
  if (catalog === null) {
    return;
  }
  const removal = removeCatalogAsset(catalog, assetId);
  if (removal.entryRemoved) {
    await writeCatalog(project, removal.catalog, {
      writeTextFile: deps.storage.writeTextFile,
      ensureDirectory: deps.storage.ensureDirectory,
    });
  }
}

function withBrandOnTimeline(
  timeline: Timeline,
  replacement: { readonly assetId: string; readonly asset: Timeline['assets'][number] } | null,
  staleAssetIds: ReadonlySet<string>,
  captionTheme: CaptionTheme | null,
): Timeline {
  let next = timeline;
  if (replacement !== null && timeline.logo !== undefined && staleAssetIds.has(timeline.logo.assetId)) {
    const kept = timeline.assets.filter((asset) => asset.id !== replacement.assetId && !staleAssetIds.has(asset.id));
    next = { ...next, assets: [...kept, replacement.asset], logo: { ...timeline.logo, assetId: replacement.assetId } };
  } else if (replacement !== null && timeline.assets.some((asset) => asset.id === replacement.assetId)) {
    next = { ...next, assets: next.assets.map((asset) => (asset.id === replacement.assetId ? replacement.asset : asset)) };
  }
  if (captionTheme !== null && timeline.captionStyle === 'brand') {
    next = { ...next, captionTheme };
  }
  return next;
}

async function applyBrand(
  deps: RenderApiDependencies,
  store: StoreConfig,
  project: MediaProject,
  brandId: string,
): Promise<AppliedProjectBrand> {
  const brand = await loadProjectBrandContext(deps, store, brandId);
  const staged = await stageBrandLogo(deps, project, brand);
  await copyBrandFonts(deps, project, brand);

  let logoAssetId: string | null = null;
  let replacement: { readonly assetId: string; readonly asset: Timeline['assets'][number] } | null = null;
  if (staged !== null) {
    const absolutePath = toAbsolutePath(project, staged.assetId);
    await deps.storage.ensureDirectory(toAbsolutePath(project, LOGO_DIRECTORY));
    await deps.storage.promoteTemporary(staged.stagedPath, absolutePath);
    const entry = await ingestAssetIntoCatalog(deps, { project, assetId: staged.assetId, role: 'logo', absolutePath });
    logoAssetId = staged.assetId;
    replacement = { assetId: staged.assetId, asset: entry.asset };
  }

  const stale = new Set((await listBrandLogoAssetIds(deps, project)).filter((assetId) => assetId !== logoAssetId));
  const timeline = await readStoredTimelineIfPersisted(deps, project);
  if (timeline !== null) {
    const updated = withBrandOnTimeline(timeline, replacement, stale, brand.captionTheme);
    if (updated !== timeline) {
      await writeTimeline(project, updated, { writeTextFile: deps.storage.writeTextFile, ensureDirectory: deps.storage.ensureDirectory });
    }
  }
  await removeUnreferencedLogos(deps, project, stale);
  return { captionTheme: brand.captionTheme, logoAssetId };
}

async function removeUnreferencedLogos(
  deps: RenderApiDependencies,
  project: MediaProject,
  assetIds: ReadonlySet<string>,
): Promise<void> {
  const timeline = await readStoredTimelineIfPersisted(deps, project);
  for (const assetId of assetIds) {
    if (findTimelineAssetReferences(timeline, assetId).length === 0) {
      await removeLogoAsset(deps, project, assetId);
    }
  }
}

export async function applyProjectBrand(
  deps: RenderApiDependencies,
  store: StoreConfig,
  serializer: KeyedSerializer,
  slug: string,
  brandId: string | null,
): Promise<AppliedProjectBrand> {
  const project = resolveMediaProject(join(store.mediaRoot, slug));
  return serializer.run(slug, async () => {
    if (brandId === null) {
      await removeUnreferencedLogos(deps, project, new Set(await listBrandLogoAssetIds(deps, project)));
      return emptyApplied();
    }
    return applyBrand(deps, store, project, brandId);
  });
}
