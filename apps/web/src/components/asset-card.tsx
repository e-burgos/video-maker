import { formatBytes, formatDuration } from '../api/asset-media-kind';
import { AssetPreview } from './asset-preview';
import type { AssetListEntry } from '../api/render-api-types';

export type AssetCardProps = {
  slug: string;
  asset: AssetListEntry;
};

function mediaFacts(asset: AssetListEntry): string[] {
  const media = asset.media;
  if (media === null) {
    return ['not probed'];
  }

  const facts: string[] = [media.kind];
  if (media.width !== undefined && media.height !== undefined) {
    facts.push(`${media.width}×${media.height}`);
  }
  if (media.kind !== 'image') {
    facts.push(formatDuration(media.durationMs));
  }
  if (media.fps !== undefined) {
    facts.push(`${media.fps} fps`);
  }
  if (media.audio !== undefined) {
    facts.push(`${media.audio.codec} ${media.audio.channels}ch`);
  }
  return facts;
}

export function AssetCard({ slug, asset }: AssetCardProps) {
  return (
    <li className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <AssetPreview slug={slug} path={asset.path} />
      <p className="truncate font-mono text-xs text-slate-200" title={asset.path}>
        {asset.path}
      </p>
      <p className="font-mono text-[11px] text-slate-500">
        {[formatBytes(asset.fingerprint.sizeBytes), ...mediaFacts(asset)].join(' · ')}
      </p>
    </li>
  );
}
