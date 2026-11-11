import { z } from 'zod';

import { MotionStudioError } from '../errors/motion-studio-error';
import { joinPath } from '../pipeline/join-path';
import { formatIssuePath } from '../storyboard/parse-motion-storyboard';

const Text = z.string().trim().min(1);

export const MUSIC_VIDEO_TYPES = ['tutorial', 'product', 'vertical', 'institutional'] as const;
export type MusicVideoType = (typeof MUSIC_VIDEO_TYPES)[number];

export const LOCAL_MUSIC_DIRECTORY = '.local-music';
export const LOCAL_MUSIC_LIST_FILE = 'music.json';
export const LOCAL_MUSIC_FILE_PREFIX = 'local-music/';

export const BrandTrackSchema = z.strictObject({
  id: z.string(),
  file: Text,
  credit: Text,
  bpm: z.number().positive(),
  mood: Text,
  drop: z.number().nonnegative().optional(),
  videoTypes: z.array(z.enum(MUSIC_VIDEO_TYPES)).min(1).optional(),
});

export type BrandTrack = z.infer<typeof BrandTrackSchema>;

const LocalMusicListSchema = z.array(BrandTrackSchema);

export function parseLocalMusicList(raw: unknown): BrandTrack[] {
  const result = LocalMusicListSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.slice(0, 6).map((issue) => `${formatIssuePath(issue.path) || 'music'}: ${issue.message}`);
  throw new MotionStudioError('BRAND_INVALID', `${LOCAL_MUSIC_DIRECTORY}/${LOCAL_MUSIC_LIST_FILE} is invalid:\n  ${lines.join('\n  ')}`);
}

export function localMusicDirectory(userBrandsRoot: string, brandId: string): string {
  return joinPath(userBrandsRoot, LOCAL_MUSIC_DIRECTORY, brandId);
}

export function isLocalMusicFile(file: string): boolean {
  return file.startsWith(LOCAL_MUSIC_FILE_PREFIX);
}

export function withLocalMusic<Brand extends { music: BrandTrack[] }>(brand: Brand, localTracks: readonly BrandTrack[]): Brand {
  const taken = new Set(brand.music.map((track) => track.id));
  const extra = localTracks
    .filter((track) => !taken.has(track.id))
    .map((track) => ({ ...track, file: `${LOCAL_MUSIC_FILE_PREFIX}${track.file}` }));
  return extra.length === 0 ? brand : { ...brand, music: [...brand.music, ...extra] };
}

export function brandTrackSourcePath(brandDir: string, userBrandsRoot: string | undefined, brandId: string, file: string): string {
  if (!isLocalMusicFile(file)) return joinPath(brandDir, file);
  if (userBrandsRoot === undefined) throw new MotionStudioError('ASSET_MISSING', `local music track "${file}" needs a user brands folder`);
  return joinPath(localMusicDirectory(userBrandsRoot, brandId), file.slice(LOCAL_MUSIC_FILE_PREFIX.length));
}

export const INHERITED_MUSIC_FILE_PREFIX = 'brand-music/';

export interface InheritedMusicFile {
  readonly brandId: string;
  readonly file: string;
}

export interface BrandMusicSource {
  readonly music: BrandTrack[];
  readonly musicFrom?: string | undefined;
}

export interface BrandMusicReaders {
  readonly readBrandMusicSource: (brandId: string) => Promise<BrandMusicSource>;
  readonly readLocalTracks: (brandId: string) => Promise<readonly BrandTrack[]>;
}

export function parseInheritedMusicFile(file: string): InheritedMusicFile | null {
  if (!file.startsWith(INHERITED_MUSIC_FILE_PREFIX)) return null;
  const rest = file.slice(INHERITED_MUSIC_FILE_PREFIX.length);
  const separator = rest.indexOf('/');
  if (separator <= 0 || separator === rest.length - 1) return null;
  return { brandId: rest.slice(0, separator), file: rest.slice(separator + 1) };
}

export function isLocalMusicTrackFile(file: string): boolean {
  const inherited = parseInheritedMusicFile(file);
  return inherited === null ? isLocalMusicFile(file) : isLocalMusicTrackFile(inherited.file);
}

export function withInheritedMusic<Brand extends { music: BrandTrack[] }>(brand: Brand, parentId: string, parentTracks: readonly BrandTrack[]): Brand {
  const taken = new Set(brand.music.map((track) => track.id));
  const extra = parentTracks
    .filter((track) => !taken.has(track.id))
    .map((track) => ({ ...track, file: `${INHERITED_MUSIC_FILE_PREFIX}${parentId}/${track.file}` }));
  return extra.length === 0 ? brand : { ...brand, music: [...brand.music, ...extra] };
}

export async function collectBrandMusic(
  readers: BrandMusicReaders,
  brandId: string,
  source: BrandMusicSource,
  ancestors: readonly string[] = [],
): Promise<BrandTrack[]> {
  const own = withLocalMusic({ music: source.music }, await readers.readLocalTracks(brandId)).music;
  const parentId = source.musicFrom;
  if (parentId === undefined) return own;
  const lineage = [...ancestors, brandId];
  if (lineage.includes(parentId)) {
    throw new MotionStudioError('BRAND_INVALID', `brand "${brandId}" takes its music from "${parentId}", which loops back: ${[...lineage, parentId].join(' → ')}`);
  }
  const parentTracks = await collectBrandMusic(readers, parentId, await readers.readBrandMusicSource(parentId), lineage);
  return withInheritedMusic({ music: own }, parentId, parentTracks).music;
}

export async function resolveBrandTrackSource(
  locateBrandDir: (brandId: string) => Promise<string>,
  userBrandsRoot: string | undefined,
  brandId: string,
  file: string,
): Promise<string> {
  const inherited = parseInheritedMusicFile(file);
  if (inherited !== null) return resolveBrandTrackSource(locateBrandDir, userBrandsRoot, inherited.brandId, inherited.file);
  return brandTrackSourcePath(await locateBrandDir(brandId), userBrandsRoot, brandId, file);
}

export function trackFitsVideoType(track: BrandTrack, videoType: MusicVideoType): boolean {
  return track.videoTypes === undefined || track.videoTypes.includes(videoType);
}
