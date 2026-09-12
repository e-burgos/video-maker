import { useT } from '../i18n/language-context';

export type ProducerScriptPanelProps = {
  script: string;
};

export function ProducerScriptPanel({ script }: ProducerScriptPanelProps) {
  const t = useT();

  return (
    <section data-testid="producer-script-panel" className="space-y-2">
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
        {t('storyboard.producerScript')}
      </h2>
      <p className="text-sm text-slate-400">{t('storyboard.producerScriptHint')}</p>
      <pre
        data-testid="producer-script-text"
        className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/40 p-4 font-mono text-xs text-slate-200"
      >
        {script}
      </pre>
    </section>
  );
}
