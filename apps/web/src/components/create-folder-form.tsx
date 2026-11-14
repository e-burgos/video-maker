import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { FIELD_CLASS, FIELD_LABEL_CLASS, PRIMARY_BUTTON_CLASS } from './ui/cl-controls';
import { ErrorNotice } from './error-notice';

export type CreateFolderFormProps = {
  onCreated: () => void;
};

export function CreateFolderForm({ onCreated }: CreateFolderFormProps) {
  const client = useRenderApi();
  const t = useT();
  const [name, setName] = useState('');
  const [error, setError] = useState<RenderApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (name.trim() === '') {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await client.createFolder(name);
      setName('');
      onCreated();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-[var(--cl-ink)]">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="folder-name" className={FIELD_LABEL_CLASS}>
          {t('createFolder.label')}
        </label>
        <input
          id="folder-name"
          data-testid="create-folder-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('createFolder.placeholder')}
          className={`${FIELD_CLASS} w-52 max-w-full`}
        />
        <button type="submit" data-testid="create-folder-submit" className={PRIMARY_BUTTON_CLASS} disabled={submitting}>
          {submitting ? t('createFolder.submitting') : t('createFolder.submit')}
        </button>
      </div>
      {error !== null && <ErrorNotice error={error} />}
    </form>
  );
}
