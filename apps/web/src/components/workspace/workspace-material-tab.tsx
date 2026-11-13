import { StateBadge } from '@e-burgos/tucu-ui';
import { Link } from 'react-router-dom';

import { artifactUrl } from '../../api/artifact-url';
import { assetMediaKind, formatDuration } from '../../api/asset-media-kind';
import { assetRoleCopy } from '../../api/asset-roles';
import { groupAssetsByRole, materialSummary } from '../../api/workspace-panel';
import type { AsyncResource } from '../../hooks/use-async-resource';
import { useT, useTn } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import type { AssetListing, AssetRole } from '../../api/render-api-types';

export type WorkspaceMaterialTabProps = {
  slug: string;
  assets: AsyncResource<AssetListing>;
  primaryRole: AssetRole;
  reviewPending: boolean;
};

const TILE_CLASS = 'h-16 w-24 shrink-0 rounded-[10px] bg-[#0b0d14] object-cover';

function MaterialThumbnail({ slug, path }: { slug: string; path: string }) {
  const src = artifactUrl(slug, path);
  const kind = assetMediaKind(path);

  if (kind === 'video') {
    return <video src={src} muted preload="metadata" className={TILE_CLASS} />;
  }

  if (kind === 'image') {
    return <img src={src} alt={path} className={TILE_CLASS} />;
  }

  return (
    <div className={`${TILE_CLASS} grid place-items-center text-[10px] uppercase text-white/70`}>{kind}</div>
  );
}

export function WorkspaceMaterialTab({ slug, assets, primaryRole, reviewPending }: WorkspaceMaterialTabProps) {
  const t = useT();
  const tn = useTn();

  if (assets.status === 'loading') {
    return <p className="text-sm text-[var(--cl-ink-2)]">{t('library.loading')}</p>;
  }

  if (assets.status === 'error' && assets.error !== null) {
    return <ErrorNotice surface="glass" error={assets.error} onRetry={assets.reload} />;
  }

  const groups = groupAssetsByRole(assets.data);
  const libraryLink = (
    <Link to={`/projects/${encodeURIComponent(slug)}/library`} className={`${SECONDARY_BUTTON_SMALL_CLASS} self-start`}>
      {t('workspace.material.openLibrary')}
    </Link>
  );

  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p data-testid="workspace-material-empty" className="text-sm text-[var(--cl-ink-2)]">
          {t('workspace.material.empty')}
        </p>
        {libraryLink}
      </div>
    );
  }

  return (
    <div data-testid="workspace-material" className="flex flex-col gap-4">
      <ul data-testid="workspace-material-summary" className="flex flex-wrap gap-1.5">
        {materialSummary(groups, primaryRole).map((entry) => {
          const role = t(assetRoleCopy(entry.role).shortNameKey);
          return (
            <li key={entry.role} data-role={entry.role} data-tone={entry.tone}>
              <StateBadge tone={entry.tone} dot size="sm">
                {entry.count === 0
                  ? t('workspace.material.role.missing', { role })
                  : t('workspace.material.role.complete', { role, count: tn('workspace.material.fileCount', entry.count) })}
              </StateBadge>
            </li>
          );
        })}
        {reviewPending && (
          <li data-testid="workspace-material-review">
            <StateBadge tone="orange" dot size="sm">
              {t('workspace.material.review')}
            </StateBadge>
          </li>
        )}
      </ul>

      {groups.map((group) => (
        <div key={group.role} className="space-y-2">
          <p className="text-xs font-semibold text-[var(--cl-ink-2)]">{t(assetRoleCopy(group.role).shortNameKey)}</p>
          <div className="flex flex-wrap gap-2">
            {group.assets.map((asset) => (
              <div key={asset.path} title={asset.path} className="space-y-1">
                <MaterialThumbnail slug={slug} path={asset.path} />
                {asset.media !== null && asset.media.kind !== 'image' && (
                  <p className="font-data text-[10px] text-[var(--cl-ink-3)]">{formatDuration(asset.media.durationMs)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {libraryLink}
    </div>
  );
}
