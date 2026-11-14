import { useT } from '../../i18n/language-context';
import { ALL_FOLDERS, folderIdOf } from '../../api/video-filter';
import type { VideoGroup } from '../../api/video-grouping';

export type VideoFolderChipsProps = {
  groups: readonly VideoGroup[];
  totalVideos: number;
  selected: string;
  onSelect: (folderId: string) => void;
};

const CHIP_BASE = 'focus-cl inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold';
const CHIP_IDLE = 'glass-thin text-[var(--cl-ink-2)] hover:text-[var(--cl-ink)]';
const CHIP_SELECTED = 'border border-transparent bg-[var(--cl-ink)] text-[var(--cl-canvas)]';

function Chip({ folderId, label, count, selected, onSelect }: {
  folderId: string;
  label: string;
  count: number;
  selected: boolean;
  onSelect: (folderId: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-testid="folder-chip"
        data-chip={folderId}
        aria-pressed={selected}
        onClick={() => onSelect(folderId)}
        className={`${CHIP_BASE} ${selected ? CHIP_SELECTED : CHIP_IDLE}`}
      >
        <span className="truncate">{label}</span>
        <span className="font-data text-[11px] opacity-80">{count}</span>
      </button>
    </li>
  );
}

export function VideoFolderChips({ groups, totalVideos, selected, onSelect }: VideoFolderChipsProps) {
  const t = useT();

  return (
    <ul aria-label={t('projects.filters.label')} className="flex flex-wrap gap-2">
      <Chip folderId={ALL_FOLDERS} label={t('projects.filter.all')} count={totalVideos} selected={selected === ALL_FOLDERS} onSelect={onSelect} />
      {groups.map((group) => {
        const folderId = folderIdOf(group);
        return (
          <Chip
            key={folderId}
            folderId={folderId}
            label={group.folder === null ? t('projects.unassigned') : group.folder.name}
            count={group.total}
            selected={selected === folderId}
            onSelect={onSelect}
          />
        );
      })}
    </ul>
  );
}
