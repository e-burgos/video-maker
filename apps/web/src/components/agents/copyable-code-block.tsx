import { useEffect, useRef, useState } from 'react';

import { copyToClipboard } from '../../api/clipboard';
import { useT } from '../../i18n/language-context';
import { FIELD_LABEL_CLASS, SECONDARY_BUTTON_SMALL_CLASS, WARNING_TEXT_CLASS } from '../ui/cl-controls';

export type CopyableCodeBlockProps = {
  id: string;
  label: string;
  code: string;
};

type CopyPhase = 'idle' | 'copied' | 'refused';

const FEEDBACK_MS = 2000;

export function CopyableCodeBlock({ id, label, code }: CopyableCodeBlockProps) {
  const t = useT();
  const [phase, setPhase] = useState<CopyPhase>('idle');
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  async function copy(): Promise<void> {
    const copied = await copyToClipboard(code);
    setPhase(copied ? 'copied' : 'refused');
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => setPhase('idle'), FEEDBACK_MS);
  }

  return (
    <div data-testid={`agent-block-${id}`} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`font-data ${FIELD_LABEL_CLASS}`}>{label}</span>
        <button
          type="button"
          data-testid={`agent-copy-${id}`}
          data-phase={phase}
          onClick={() => void copy()}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {phase === 'copied' ? t('agents.copied') : t('agents.copy')}
        </button>
      </div>
      <pre className="glass-sub font-data m-0 max-w-full overflow-x-auto rounded-[12px] p-3 text-xs text-[var(--cl-ink)]">
        <code>{code}</code>
      </pre>
      {phase === 'refused' && (
        <p role="status" className={WARNING_TEXT_CLASS}>
          {t('agents.copyRefused')}
        </p>
      )}
      {phase === 'copied' && (
        <span role="status" className="sr-only">
          {t('agents.copied')}
        </span>
      )}
    </div>
  );
}
