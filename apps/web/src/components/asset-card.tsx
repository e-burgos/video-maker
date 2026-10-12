import { formatBytes, formatDuration } from '../api/asset-media-kind';
import { AssetDeleteControl } from './asset-delete-control';
import { AssetPreview } from './asset-preview';
import { ReferenceAnalysis } from './reference-analysis';
import type { AssetDeletion, AssetListEntry } from '../api/render-api-types';

export type AssetCardProps = {
  slug: string;
  asset: AssetListEntry;
  onDeleted: (deletion: AssetDeletion) => void;
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

export function AssetCard({ slug, asset, onDeleted }: AssetCardProps) {
  return (
    <li
      data-testid="asset-card"
      data-asset-path={asset.path}
      className="min-w-0 space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
    >
      <AssetPreview slug={slug} path={asset.path} />
      <p className="truncate font-mono text-xs text-slate-200" title={asset.path}>
        {asset.path}
      </p>
      <p className="font-mono text-[11px] text-slate-500">
        {[formatBytes(asset.fingerprint.sizeBytes), ...mediaFacts(asset)].join(' · ')}
      </p>
      {asset.role === 'reference' && <ReferenceAnalysis slug={slug} assetPath={asset.path} />}
      <AssetDeleteControl slug={slug} role={asset.role} path={asset.path} onDeleted={onDeleted} />
    </li>
  );
}
