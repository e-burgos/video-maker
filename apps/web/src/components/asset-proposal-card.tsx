import { useState } from 'react';

import { artifactUrl } from '../api/artifact-url';
import { orderedAssetRoles } from '../api/asset-roles';
import { inboxReasonKey } from '../api/inbox';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';
import type { AssetRole, InboxAsset } from '../api/render-api-types';

export type AssetProposalCardProps = {
  slug: string;
  asset: InboxAsset;
  onConfirm: (assetId: string, role: AssetRole) => Promise<void>;
  onDiscard: (assetId: string) => Promise<void>;
};

function ProposalThumbnail({ slug, asset }: { slug: string; asset: InboxAsset }) {
  const src = artifactUrl(slug, asset.path);

  if (asset.probe.kind === 'image') {
    return (
      <img
        src={src}
        alt={asset.fileName}
        className="h-16 w-24 shrink-0 rounded-control bg-black object-cover"
      />
    );
  }

  if (asset.probe.kind === 'video') {
    return (
      <video
        data-testid="asset-proposal-video"
        src={`${src}#t=0.5`}
        muted
        preload="metadata"
        className="h-16 w-24 shrink-0 rounded-control bg-black object-cover"
      />
    );
  }

  return (
    <div
      data-testid="asset-proposal-audio-icon"
      className="flex h-16 w-24 shrink-0 items-center justify-center rounded-control border border-border-subtle text-[10px] uppercase text-ink-faint"
    >
      {asset.probe.kind}
    </div>
  );
}

export function AssetProposalCard({ slug, asset, onConfirm, onDiscard }: AssetProposalCardProps) {
  const t = useT();
  const [role, setRole] = useState<AssetRole>(asset.proposedRole);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);

  async function confirm() {
    setError(null);
    setConfirming(true);
    try {
      await onConfirm(asset.id, role);
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setConfirming(false);
    }
  }

  async function discard() {
    setError(null);
    setDiscarding(true);
    try {
      await onDiscard(asset.id);
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setDiscarding(false);
    }
  }

  const busy = confirming || discarding;

  return (
    <div
      data-testid="asset-proposal-card"
      data-asset-id={asset.id}
      className="flex gap-3 rounded-panel border border-border-subtle bg-surface-raised/60 p-3"
    >
      <ProposalThumbnail slug={slug} asset={asset} />

      <div className="min-w-0 flex-1 space-y-2">
        <p className="truncate text-sm text-ink" title={asset.fileName}>
          {asset.fileName}
        </p>
        <p className="text-xs text-ink-faint">{t(inboxReasonKey(asset.proposalReason))}</p>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`asset-proposal-role-${asset.id}`} className="text-xs text-ink-faint">
            {t('inbox.card.role')}
          </label>
          <select
            id={`asset-proposal-role-${asset.id}`}
            data-testid="asset-proposal-role"
            value={role}
            disabled={busy}
            onChange={(event) => setRole(event.target.value as AssetRole)}
            className="rounded-control border border-border-strong bg-surface px-2 py-1 text-xs text-ink"
          >
            {orderedAssetRoles().map((choice) => (
              <option key={choice.role} value={choice.role}>
                {t(choice.shortNameKey)}
              </option>
            ))}
          </select>

          <Button
            data-testid="asset-proposal-confirm"
            variant="primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {confirming ? t('inbox.card.confirming') : t('inbox.card.confirm')}
          </Button>
          <Button
            data-testid="asset-proposal-discard"
            variant="secondary"
            disabled={busy}
            onClick={() => void discard()}
          >
            {discarding ? t('inbox.card.discarding') : t('inbox.card.discard')}
          </Button>
        </div>

        {error !== null && <ErrorNotice error={error} />}
      </div>
    </div>
  );
}
