import { useCallback, useId, useState } from 'react';

import { slugifyFileName, uniqueProjectSlug } from '../api/project-slug';
import { useRenderApi } from '../api/render-api-context';
import type { ProjectMode } from '../api/render-api-types';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { BrandPicker } from './brand-picker';
import { FIELD_CLASS, FIELD_LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './ui/cl-controls';
import { ErrorNotice } from './error-notice';

const MODE_OPTIONS = [
  {
    value: 'motion',
    titleKey: 'createProject.mode.motion',
    hintKey: 'createProject.mode.motionHint',
  },
  {
    value: 'footage',
    titleKey: 'createProject.mode.footage',
    hintKey: 'createProject.mode.footageHint',
  },
] as const;

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
  const [mode, setMode] = useState<ProjectMode>('footage');
  const [chosenBrand, setChosenBrand] = useState<string | null>(null);
  const t = useT();
  const modeLabelId = useId();
  const brandLabelId = useId();
  const brands = useAsyncResource(
    useCallback(() => client.listBrands(), [client]),
    'create-project-brands',
  );
  const brandList = brands.data ?? [];
  const brand = chosenBrand ?? (mode === 'motion' ? (brandList[0]?.id ?? null) : null);

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
      const detail = await client.createProject({ slug, title: trimmed, mode, ...(brand === null ? {} : { brand }) });
      setName('');
      onCreated(detail.slug);
    } catch (cause) {
      setServiceError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-[var(--cl-ink)]">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="project-name" className={FIELD_LABEL_CLASS}>
          {t('createProject.label')}
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('createProject.placeholder')}
          className={`${FIELD_CLASS} w-64 max-w-full`}
        />
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={submitting}>
          {submitting ? t('createProject.submitting') : t('createProject.submit')}
        </button>
        {onCancel !== undefined && (
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onCancel}>
            {t('createProject.cancel')}
          </button>
        )}
      </div>
      <div className="space-y-2">
        <p id={modeLabelId} className={FIELD_LABEL_CLASS}>
          {t('createProject.mode.label')}
        </p>
        <div role="radiogroup" aria-labelledby={modeLabelId} className="grid gap-2 sm:grid-cols-2">
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="glass-sub flex cursor-pointer items-start gap-2 rounded-[12px] p-3 text-sm has-[:checked]:border-[var(--cl-action)] has-[:checked]:bg-[color-mix(in_srgb,var(--cl-action)_10%,transparent)]"
            >
              <input
                type="radio"
                name="project-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-[var(--cl-ink)]">{t(option.titleKey)}</span>
                <span className="block text-xs text-[var(--cl-ink-3)]">{t(option.hintKey)}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p id={brandLabelId} className={FIELD_LABEL_CLASS}>
          {t('createProject.brand.label')}
        </p>
        <BrandPicker
          brands={brandList}
          value={brand}
          allowNone={mode !== 'motion'}
          name="project-brand"
          labelledBy={brandLabelId}
          onChange={setChosenBrand}
        />
      </div>
      {localProblem && (
        <p role="alert" className="text-sm text-[var(--tucu-state-orange-ink)]">
          {t('createProject.nameRequired')}
        </p>
      )}
      {serviceError !== null && <ErrorNotice error={serviceError} />}
    </form>
  );
}
