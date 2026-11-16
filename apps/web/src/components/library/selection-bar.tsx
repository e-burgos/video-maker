import { useT, useTn } from '../../i18n/language-context';
import {
  DANGER_BUTTON_SMALL_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
} from '../ui/cl-controls';

export type SelectionBarProps = {
  count: number;
  onClear: () => void;
  onCompare: (trigger: HTMLElement) => void;
  onDelete: () => void;
};

export function SelectionBar({
  count,
  onClear,
  onCompare,
  onDelete,
}: SelectionBarProps) {
  const t = useT();
  const tn = useTn();

  return (
    <div
      role="toolbar"
      aria-label={t('library.selection.bar')}
      data-testid="library-selection-bar"
      className="glass-thick sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-3"
    >
      <p
        data-testid="library-selection-count"
        className="m-0 text-sm font-bold text-[var(--cl-ink)]"
      >
        {tn('library.selection.count', count)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="library-selection-clear"
          onClick={onClear}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {t('library.selection.clear')}
        </button>
        <button
          type="button"
          data-testid="library-selection-compare"
          disabled={count !== 2}
          onClick={(event) => onCompare(event.currentTarget)}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {t('library.selection.compare')}
        </button>
        <button
          type="button"
          data-testid="library-selection-delete"
          onClick={onDelete}
          className={DANGER_BUTTON_SMALL_CLASS}
        >
          {t('library.selection.delete')}
        </button>
      </div>
    </div>
  );
}
