import { useEffect, useState } from 'react';

import { useT } from '../../i18n/language-context';
import { FIELD_LABEL_CLASS, FIELD_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';

export type PublishQueueLimitFormProps = {
  dailyLimit: number;
  busy: boolean;
  onSave: (limit: number) => void;
};

export function PublishQueueLimitForm({ dailyLimit, busy, onSave }: PublishQueueLimitFormProps) {
  const t = useT();
  const [draft, setDraft] = useState(String(dailyLimit));

  useEffect(() => {
    setDraft(String(dailyLimit));
  }, [dailyLimit]);

  const parsed = Number(draft);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 100;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="publish-queue-limit" className={FIELD_LABEL_CLASS}>
        {t('publishQueue.dailyLimit')}
      </label>
      <input
        id="publish-queue-limit"
        type="number"
        min={1}
        max={100}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={`${FIELD_SMALL_CLASS} font-data w-20`}
      />
      <button
        type="button"
        disabled={busy || !valid || parsed === dailyLimit}
        onClick={() => onSave(parsed)}
        className={SECONDARY_BUTTON_SMALL_CLASS}
      >
        {t('publishQueue.saveLimit')}
      </button>
    </div>
  );
}
