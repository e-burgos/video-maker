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
        className="flex flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed border-border-strong px-6 py-16 text-center"
      >
        <span aria-hidden="true" className="text-3xl">
          🎬
        </span>
        <p className="text-base font-medium text-ink-muted">{t('projects.dropHint')}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="home-drop-hint"
      data-hero="false"
      className="flex items-center gap-2 rounded-panel border border-dashed border-border-strong px-4 py-3 text-sm text-ink-faint"
    >
      <span aria-hidden="true">↓</span>
      <p>{t('projects.dropHint')}</p>
    </div>
  );
}
