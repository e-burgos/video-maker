import { brandFileUrl, fileStemSlug, uniqueKey } from '../api/brand-files';
import { imagesOf, rowsOf } from '../api/brand-photo-rows';
import type { PhotoRow } from '../api/brand-photo-rows';
import { useBrandUpload } from '../hooks/use-brand-upload';
import { useSectionDraft } from '../hooks/use-section-draft';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { BRAND_INPUT_CLASS, BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';
import { BrandSaveBar } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,.svg';

export function BrandPhotosSection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  const savedRows: PhotoRow[] = rowsOf(manifest?.images ?? {});
  const { draft, setDraft, dirty } = useSectionDraft(savedRows);
  const { uploading, error, upload } = useBrandUpload(manifest?.id ?? '');

  if (manifest === null) {
    return null;
  }

  async function onFile(file: File): Promise<void> {
    const stored = await upload('image', file);
    if (stored !== null) {
      setDraft((current) => [
        ...current,
        {
          key: uniqueKey(
            fileStemSlug(file.name),
            current.map((row) => row.key),
          ),
          file: stored,
          caption: '',
        },
      ]);
    }
  }

  const invalid = draft.some((row) => row.caption.trim() === '') ? t('brands.photos.captionRequired') : null;

  return (
    <div data-testid="brand-section-photos" className="space-y-4">
      <p className="text-sm text-ink-muted">{t('brands.photos.hint')}</p>
      {draft.length === 0 && <p className="text-sm text-ink-faint">{t('brands.photos.empty')}</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {draft.map((row) => (
          <li
            key={row.key}
            data-testid={`brand-photo-${row.key}`}
            className="space-y-2 rounded-lg border border-border-subtle p-3"
          >
            <img
              src={brandFileUrl(manifest.id, row.file)}
              alt={row.caption === '' ? row.key : row.caption}
              className="h-32 w-full rounded-md bg-surface-muted object-cover"
            />
            <BrandField label={t('brands.photos.caption')}>
              <textarea
                rows={2}
                data-testid={`brand-photo-caption-${row.key}`}
                value={row.caption}
                disabled={editor.readOnly}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((candidate) =>
                      candidate.key === row.key ? { ...candidate, caption: event.target.value } : candidate,
                    ),
                  )
                }
                className={BRAND_INPUT_CLASS}
              />
            </BrandField>
            {!editor.readOnly && (
              <Button
                data-testid={`brand-photo-remove-${row.key}`}
                onClick={() => setDraft((current) => current.filter((candidate) => candidate.key !== row.key))}
              >
                {t('brands.remove')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!editor.readOnly && (
        <BrandFileInput
          label={t('brands.photos.upload')}
          accept={PHOTO_ACCEPT}
          testId="brand-photo-upload"
          busy={uploading}
          onFile={(file) => void onFile(file)}
        />
      )}
      {error !== null && <ErrorNotice error={error} />}
      <BrandSaveBar
        editor={editor}
        dirty={dirty}
        testId="brand-photos-save"
        invalidMessage={invalid}
        onSave={() => void editor.update((current) => ({ ...current, images: imagesOf(draft) }), 'silent')}
      />
    </div>
  );
}
