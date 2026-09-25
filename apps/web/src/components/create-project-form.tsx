import { useState } from 'react';

import { slugifyFileName, uniqueProjectSlug } from '../api/project-slug';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { Button } from './ui/button';
import { ErrorNotice } from './error-notice';

export type CreateProjectFormProps = {
  existingSlugs: readonly string[];
  onCreated: (slug: string) => void;
  onCancel?: () => void;
};

export function CreateProjectForm({ existingSlugs, onCreated, onCancel }: CreateProjectFormProps) {
  const client = useRenderApi();
  const [name, setName] = useState('');
  const [localProblem, setLocalProblem] = useState(false);
  const [serviceError, setServiceError] = useState<RenderApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const t = useT();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServiceError(null);

    const trimmed = name.trim();
    if (trimmed === '') {
      setLocalProblem(true);
      return;
    }

    setLocalProblem(false);
    const slug = uniqueProjectSlug(slugifyFileName(trimmed), existingSlugs);
    setSubmitting(true);
    try {
      const detail = await client.createProject(slug);
      setName('');
      onCreated(detail.slug);
    } catch (cause) {
      setServiceError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="project-name" className="text-sm text-ink-faint">
          {t('createProject.label')}
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('createProject.placeholder')}
          className="w-64 rounded-control border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
        />
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? t('createProject.submitting') : t('createProject.submit')}
        </Button>
        {onCancel !== undefined && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('createProject.cancel')}
          </Button>
        )}
      </div>
      {localProblem && (
        <p role="alert" className="text-sm text-warning">
          {t('createProject.nameRequired')}
        </p>
      )}
      {serviceError !== null && <ErrorNotice error={serviceError} />}
    </form>
  );
}
