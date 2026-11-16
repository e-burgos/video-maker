import { StateBadge } from '@e-burgos/tucu-ui';
import type { StateBadgeTone } from '@e-burgos/tucu-ui';
import type {
  MaterialReviewItem,
  MaterialVerdict,
} from '@video-maker/timeline-core';
import type { ReactNode } from 'react';

import { artifactUrl } from '../../api/artifact-url';
import { formatBytes } from '../../api/asset-media-kind';
import { assetRoleCopy } from '../../api/asset-roles';
import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import type { ViewerItem } from './viewer-model';

export type ViewerDetailProps = {
  slug: string;
  item: ViewerItem;
  review: MaterialReviewItem | undefined;
};

const VERDICT_TONE: Readonly<Record<MaterialVerdict, StateBadgeTone>> = {
  fits: 'green',
  doubtful: 'orange',
  unfit: 'red',
};

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-white/70">{label}</dt>
      <dd className="m-0 text-sm text-white">{children}</dd>
    </div>
  );
}

export function ViewerDetail({ slug, item, review }: ViewerDetailProps) {
  const t = useT();

  return (
    <div
      data-testid="viewer-detail"
      data-asset-path={item.path}
      className="space-y-3"
    >
      <dl className="m-0 space-y-3">
        <DetailRow label={t('viewer.detail.file')}>
          <span
            data-testid="viewer-detail-file"
            className="font-data break-all text-[13px]"
          >
            {item.path}
          </span>
        </DetailRow>
        <DetailRow label={t('viewer.detail.size')}>
          <span className="font-data text-[13px]">
            {formatBytes(item.sizeBytes)}
          </span>
        </DetailRow>
        <DetailRow label={t('viewer.detail.role')}>
          {t(assetRoleCopy(item.role).shortNameKey)}
        </DetailRow>
        {item.facts.length > 0 && (
          <DetailRow label={t('viewer.detail.media')}>
            <span className="font-data text-[13px]">
              {item.facts.join(' · ')}
            </span>
          </DetailRow>
        )}
        {review !== undefined && (
          <DetailRow label={t('viewer.detail.review')}>
            <span
              data-testid="viewer-detail-review"
              className="block space-y-1.5"
            >
              <StateBadge tone={VERDICT_TONE[review.verdict]} dot size="sm">
                {t(`proposal.material.${review.verdict}` as TranslationKey)}
              </StateBadge>
              <span className="block">{review.shows}</span>
              <span className="block text-white/70">{review.reason}</span>
            </span>
          </DetailRow>
        )}
      </dl>
      <a
        href={artifactUrl(slug, item.path)}
        download
        data-testid="viewer-download"
        className="focus-cl inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-white/20 bg-white/10 text-sm font-semibold text-white hover:bg-white/15"
      >
        {t('viewer.detail.download')}
      </a>
    </div>
  );
}
