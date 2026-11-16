import { SegmentedControl } from '@e-burgos/tucu-ui';

import { assetRoleCopy } from '../../api/asset-roles';
import { useT } from '../../i18n/language-context';
import type { AssetRole } from '../../api/render-api-types';
import type { RoleFilter, ThumbnailSize } from './library-model';

export type LibraryFilterBarProps = {
  total: number;
  roles: readonly AssetRole[];
  filter: RoleFilter;
  onFilterChange: (filter: RoleFilter) => void;
  size: ThumbnailSize;
  onSizeChange: (size: ThumbnailSize) => void;
};

export function LibraryFilterBar({
  total,
  roles,
  filter,
  onFilterChange,
  size,
  onSizeChange,
}: LibraryFilterBarProps) {
  const t = useT();
  const filterOptions = [
    {
      value: 'all',
      label: t('library.filter.all', { count: total }),
      'data-testid': 'library-filter-all',
    },
    ...roles.map((role) => ({
      value: role,
      label: t(assetRoleCopy(role).shortNameKey),
      'data-testid': `library-filter-${role}`,
    })),
  ];
  const sizeOptions = [
    {
      value: 'm',
      label: t('library.size.medium'),
      'data-testid': 'library-size-m',
    },
    {
      value: 'l',
      label: t('library.size.large'),
      'data-testid': 'library-size-l',
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="glass-thin max-w-full overflow-x-auto rounded-[10px] p-[3px]">
        <SegmentedControl
          size="xs"
          aria-label={t('library.filter.label')}
          options={filterOptions}
          value={filter}
          onChange={(next) => onFilterChange(next as RoleFilter)}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--cl-ink-2)]">
          {t('library.size.label')}
        </span>
        <div className="glass-thin rounded-[10px] p-[3px]">
          <SegmentedControl
            size="xs"
            aria-label={t('library.size.label')}
            options={sizeOptions}
            value={size}
            onChange={(next) => onSizeChange(next as ThumbnailSize)}
          />
        </div>
      </div>
    </div>
  );
}
