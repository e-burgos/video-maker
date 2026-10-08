import { useState } from 'react';

import { fontFamilies } from '../api/brand-manifest-edit';
import { GOOGLE_FONT_FAMILIES } from '../api/google-font-families';
import type { BrandTypography } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { brandFontFamilyName, useBrandFontFaces } from '../hooks/use-brand-font-faces';
import { useBrandUpload } from '../hooks/use-brand-upload';
import { useSectionDraft } from '../hooks/use-section-draft';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { BRAND_INPUT_CLASS, BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';
import { BrandSaveBar } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

const ROLES = ['display', 'body', 'mono'] as const;

const ROLE_LABEL: Readonly<Record<(typeof ROLES)[number], TranslationKey>> = {
  display: 'brands.typography.display',
  body: 'brands.typography.body',
  mono: 'brands.typography.mono',
};

const FONT_ACCEPT = '.woff2,.ttf,.otf';

type TypographyDraft = { display: string; body: string; mono: string };

function GoogleFontAdder({ editor, brandId }: { editor: BrandEditor; brandId: string }) {
  const t = useT();
  const client = useRenderApi();
  const [family, setFamily] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);

  async function add(): Promise<void> {
    const wanted = family.trim();
    if (wanted === '') {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await client.addBrandGoogleFont(brandId, wanted);
      editor.applyDetail(next, true);
      setFamily('');
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="brand-google-font" className="space-y-2 rounded-lg border border-border-subtle p-4">
      <h3 className="text-sm font-medium text-ink">{t('brands.typography.google')}</h3>
      <p className="text-xs text-ink-faint">{t('brands.typography.googleHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          list="brand-google-families"
          aria-label={t('brands.typography.googleFamily')}
          data-testid="brand-google-font-family"
          value={family}
          disabled={editor.readOnly || pending}
          onChange={(event) => setFamily(event.target.value)}
          placeholder={t('brands.typography.googlePlaceholder')}
          className={`${BRAND_INPUT_CLASS} max-w-xs`}
        />
        <datalist id="brand-google-families">
          {GOOGLE_FONT_FAMILIES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <Button
          variant="primary"
          data-testid="brand-google-font-add"
          disabled={editor.readOnly || pending || family.trim() === ''}
          onClick={() => void add()}
        >
          {pending ? t('brands.typography.googleAdding') : t('brands.typography.googleAdd')}
        </Button>
      </div>
      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}

function FontUploader({ editor, brandId }: { editor: BrandEditor; brandId: string }) {
  const t = useT();
  const { uploading, error, upload } = useBrandUpload(brandId);
  const [family, setFamily] = useState('');

  async function onFile(file: File): Promise<void> {
    const name = family.trim();
    if (name === '') {
      return;
    }
    const stored = await upload('font', file);
    if (stored !== null) {
      await editor.update((current) => ({
        ...current,
        fonts: [...current.fonts.filter((font) => font.family !== name), { family: name, file: stored }],
      }));
      setFamily('');
    }
  }

  return (
    <div data-testid="brand-font-upload" className="space-y-2 rounded-lg border border-border-subtle p-4">
      <h3 className="text-sm font-medium text-ink">{t('brands.typography.upload')}</h3>
      <BrandField label={t('brands.typography.uploadFamily')} hint={t('brands.typography.uploadHint')}>
        <input
          data-testid="brand-font-upload-family"
          value={family}
          disabled={editor.readOnly}
          onChange={(event) => setFamily(event.target.value)}
          className={`${BRAND_INPUT_CLASS} max-w-xs`}
        />
      </BrandField>
      <BrandFileInput
        label={t('brands.typography.uploadFile')}
        accept={FONT_ACCEPT}
        testId="brand-font-upload-file"
        busy={uploading}
        disabled={editor.readOnly || family.trim() === ''}
        onFile={(file) => void onFile(file)}
      />
      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}

export function BrandTypographySection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  const families = manifest === null ? [] : fontFamilies(manifest);
  const saved: TypographyDraft = {
    display: manifest?.typography?.display ?? families[0] ?? '',
    body: manifest?.typography?.body ?? families[0] ?? '',
    mono: manifest?.typography?.mono ?? '',
  };
  const { draft, setDraft, dirty } = useSectionDraft(saved);
  const ready = useBrandFontFaces(manifest?.id ?? '', manifest?.fonts ?? []);

  if (manifest === null) {
    return null;
  }

  function save(): void {
    const typography: BrandTypography =
      draft.mono === ''
        ? { display: draft.display, body: draft.body }
        : { display: draft.display, body: draft.body, mono: draft.mono };
    void editor.update((current) => ({ ...current, typography }));
  }

  return (
    <div data-testid="brand-section-typography" className="space-y-4">
      {ROLES.map((role) => (
        <div key={role} className="space-y-1">
          <BrandField label={t(ROLE_LABEL[role])}>
            <select
              data-testid={`brand-typography-${role}`}
              value={draft[role]}
              disabled={editor.readOnly}
              onChange={(event) => setDraft((current) => ({ ...current, [role]: event.target.value }))}
              className={BRAND_INPUT_CLASS}
            >
              {role === 'mono' && <option value="">{t('brands.typography.none')}</option>}
              {families.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </BrandField>
          {draft[role] !== '' && (
            <p
              data-testid={`brand-typography-sample-${role}`}
              style={{
                fontFamily: ready.has(draft[role])
                  ? `"${brandFontFamilyName(manifest.id, draft[role])}", sans-serif`
                  : undefined,
              }}
              className="text-lg text-ink"
            >
              {t('brands.typography.sample')}
            </p>
          )}
        </div>
      ))}
      <BrandSaveBar editor={editor} dirty={dirty} onSave={save} testId="brand-typography-save" />
      <GoogleFontAdder editor={editor} brandId={manifest.id} />
      <FontUploader editor={editor} brandId={manifest.id} />
    </div>
  );
}
