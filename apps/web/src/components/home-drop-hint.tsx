import { LucideIcons } from '@e-burgos/tucu-ui';

import { useT } from '../i18n/language-context';

export type HomeDropHintProps = {
  hero?: boolean;
};

export function HomeDropHint({ hero = false }: HomeDropHintProps) {
  const t = useT();

  if (hero) {
    return (
      <div
        data-testid="home-drop-hint"
        data-hero="true"
        className="flex flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed border-[var(--tucu-glass-sub-line)] px-6 py-14 text-center"
      >
        <LucideIcons.Film aria-hidden size={30} className="text-[var(--cl-ink-3)]" />
        <p className="text-base font-medium text-[var(--cl-ink-2)]">{t('projects.dropHint')}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="home-drop-hint"
      data-hero="false"
      className="flex items-center gap-2 text-xs text-[var(--cl-ink-3)]"
    >
      <LucideIcons.ArrowDownToLine aria-hidden size={14} />
      <p>{t('projects.dropHint')}</p>
    </div>
  );
}
