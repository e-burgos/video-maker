import type { DeliveredVideo } from '../components/motion/motion-delivered-video';
import type { MotionJobReport } from './motion-types';
import type { RenderApiClient } from './render-api-client';

const OUTPUT_PREFIX = 'out/';
const VIDEO_EXTENSION = '.mp4';
const CREDITS_EXTENSION = '.credits.txt';
const CREDIT_LABEL = /^Música:\s*/u;

export async function storedVideoOf(client: RenderApiClient, slug: string): Promise<DeliveredVideo | null> {
  const listing = await client.listGenerated(slug);
  const newest = listing.files
    .filter((file) => file.path.startsWith(OUTPUT_PREFIX) && file.path.endsWith(VIDEO_EXTENSION))
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs)[0];
  if (newest === undefined) return null;
  const creditsPath = `${newest.path.slice(0, -VIDEO_EXTENSION.length)}${CREDITS_EXTENSION}`;
  const hasCredits = listing.files.some((file) => file.path === creditsPath);
  const musicCredit = hasCredits ? (await client.getProjectFile(slug, creditsPath)).trim().replace(CREDIT_LABEL, '') : null;
  return { path: newest.path, durationSec: null, musicCredit };
}

export function deliveredVideoOf(report: MotionJobReport | null): DeliveredVideo | null {
  return report !== null && report.path !== null
    ? { path: report.path, durationSec: report.durationSec, musicCredit: report.musicCredit ?? null }
    : null;
}
