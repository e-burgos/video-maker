import { BRAND_ASSET_DIR, RUNTIME_ASSET_DIR } from '../compose/compose-storyboard';
import { brandCss } from '../brand/brand-css';
import { brandCssFile, parseBrandManifest } from '../brand/brand-manifest';
import type { BrandManifest } from '../brand/brand-manifest';
import { MotionStudioError } from '../errors/motion-studio-error';
import { parseMotionScript } from '../script/motion-script';
import type { MotionScript } from '../script/motion-script';
import type { SceneWords } from '../template/motion-timeline';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';

export const SCRIPT_FILE = 'script.json';
export const TIMELINE_FILE = 'timeline.json';
export const WORDS_FILE = 'words.json';
const BRAND_MANIFEST = 'brand.json';

export const toJson = (value: unknown, indent: number): string => `${JSON.stringify(value, null, indent)}\n`;

export async function readScript(ports: MotionPipelinePorts, project: string): Promise<MotionScript> {
  return parseMotionScript(JSON.parse(await ports.readText(joinPath(project, SCRIPT_FILE))));
}

export async function readExistingWords(ports: MotionPipelinePorts, project: string): Promise<SceneWords> {
  const path = joinPath(project, WORDS_FILE);
  return (await ports.exists(path)) ? (JSON.parse(await ports.readText(path)) as SceneWords) : {};
}

export function brandRoots(ports: MotionPipelinePorts): string[] {
  const builtIn = joinPath(ports.assetsRoot, 'brands');
  return ports.userBrandsRoot === undefined ? [builtIn] : [ports.userBrandsRoot, builtIn];
}

async function requireBrandDir(ports: MotionPipelinePorts, brand: string): Promise<string> {
  const roots = brandRoots(ports);
  for (const root of roots) {
    const brandDir = joinPath(root, brand);
    if (await ports.exists(joinPath(brandDir, BRAND_MANIFEST))) return brandDir;
  }
  throw new MotionStudioError('ASSET_MISSING', `brand "${brand}" not found in ${roots.join(' nor in ')}`);
}

export async function readBrand(ports: MotionPipelinePorts, brandId: string): Promise<BrandManifest> {
  const brandDir = await requireBrandDir(ports, brandId);
  return parseBrandManifest(JSON.parse(await ports.readText(joinPath(brandDir, BRAND_MANIFEST))));
}

export async function copySharedAssets(ports: MotionPipelinePorts, brand: string, project: string): Promise<void> {
  const brandDir = await requireBrandDir(ports, brand);
  await ports.copyTree(joinPath(ports.assetsRoot, 'runtime'), joinPath(project, RUNTIME_ASSET_DIR));
  await ports.copyTree(brandDir, joinPath(project, BRAND_ASSET_DIR));
  await writeGeneratedBrandCss(ports, brandDir, project);
}

async function writeGeneratedBrandCss(ports: MotionPipelinePorts, brandDir: string, project: string): Promise<void> {
  const brand = parseBrandManifest(JSON.parse(await ports.readText(joinPath(brandDir, BRAND_MANIFEST))));
  if (brand.css !== undefined && brand.tokens === undefined) return;
  const authored = brand.css === undefined ? undefined : await ports.readText(joinPath(brandDir, brand.css));
  await ports.writeText(joinPath(project, BRAND_ASSET_DIR, brandCssFile(brand)), brandCss(brand, authored));
}

export async function copyMusic(ports: MotionPipelinePorts, project: string, source: string, file: string): Promise<void> {
  await ports.copyFile(joinPath(project, source), joinPath(project, 'assets', 'music', file));
}
