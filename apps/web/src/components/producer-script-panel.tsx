import { useT } from '../i18n/language-context';

export type ProducerScriptPanelProps = {
  script: string;
  defaultOpen?: boolean;
  explainsMissingStoryboard?: boolean;
};

export function ProducerScriptPanel({
  script,
  defaultOpen = true,
  explainsMissingStoryboard = true,
}: ProducerScriptPanelProps) {
  const t = useT();

  return (
    <details
      data-testid="producer-script-panel"
      open={defaultOpen}
      className="glass flex flex-col gap-2 rounded-[20px] p-4"
    >
      <summary className="focus-cl cursor-pointer list-none rounded-[10px] text-sm font-bold text-[var(--cl-ink)]">
        {t('storyboard.producerScript')}
      </summary>
      {explainsMissingStoryboard && (
        <p className="m-0 mt-2 text-sm text-[var(--cl-ink-2)]">{t('storyboard.producerScriptHint')}</p>
      )}
      <pre
        data-testid="producer-script-text"
        className="font-data glass-sub m-0 mt-2 overflow-x-auto rounded-[12px] p-4 text-xs whitespace-pre-wrap text-[var(--cl-ink)]"
      >
        {script}
      </pre>
    </details>
  );
}
