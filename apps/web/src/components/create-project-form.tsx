import { useState } from 'react';

import { projectSlugProblem, projectSlugProblemMessage } from '../api/project-slug';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { ErrorNotice } from './error-notice';

export type CreateProjectFormProps = {
  onCreated: (slug: string) => void;
};

export function CreateProjectForm({ onCreated }: CreateProjectFormProps) {
  const client = useRenderApi();
  const [slug, setSlug] = useState('');
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<RenderApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServiceError(null);

    const problem = projectSlugProblem(slug);
    if (problem !== null) {
      setLocalProblem(projectSlugProblemMessage(problem));
      return;
    }

    setLocalProblem(null);
    setSubmitting(true);
    try {
      const detail = await client.createProject(slug);
      setSlug('');
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
        <label htmlFor="project-slug" className="text-sm text-slate-400">
          New project
        </label>
        <input
          id="project-slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="my-next-reel"
          className="w-64 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-sm text-slate-100 placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
      {localProblem !== null && (
        <p role="alert" className="text-sm text-amber-300">
          {localProblem}
        </p>
      )}
      {serviceError !== null && <ErrorNotice error={serviceError} />}
    </form>
  );
}
