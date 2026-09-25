import { useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { Button } from './ui/button';
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
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="folder-name" className="text-sm text-ink-faint">
          {t('createFolder.label')}
        </label>
        <input
          id="folder-name"
          data-testid="create-folder-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('createFolder.placeholder')}
          className="w-52 rounded-control border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
        <Button type="submit" data-testid="create-folder-submit" disabled={submitting}>
          {submitting ? t('createFolder.submitting') : t('createFolder.submit')}
        </Button>
      </div>
      {error !== null && <ErrorNotice error={error} />}
    </form>
  );
}
