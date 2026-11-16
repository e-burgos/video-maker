import { Skeleton } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';

const PLACEHOLDER_CARDS = ['a', 'b', 'c', 'd'] as const;

export function VideosSkeleton() {
  const t = useT();

  return (
    <div data-testid="videos-skeleton" role="status" aria-label={t('projects.loading')} className="space-y-3">
      <Skeleton width="180px" height="18px" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PLACEHOLDER_CARDS.map((id) => (
          <li key={id} className="glass-sub space-y-2 rounded-[14px] p-2.5">
            <Skeleton width="100%" height="110px" />
            <Skeleton width="70%" height="14px" />
            <Skeleton width="45%" height="12px" />
          </li>
        ))}
      </ul>
    </div>
  );
}
