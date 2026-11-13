import { brandFileUrl, fileStemSlug, uniqueKey } from '../../api/brand-files';
import type { BrandTrack } from '../../api/brand-types';
import { useBrandUpload } from '../../hooks/use-brand-upload';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import type { SectionDraft } from '../../hooks/use-section-draft';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_FILE_NAME_CLASS, BRAND_HINT_CLASS, BRAND_INPUT_CLASS, BRAND_ITEM_CLASS } from './brand-controls';
import { BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';

const MUSIC_ACCEPT = '.mp3,.wav,.m4a';

export type BrandMusicSectionProps = { editor: BrandEditor; draft: SectionDraft<BrandTrack[]> };

export function BrandMusicSection({ editor, draft: { draft, setDraft } }: BrandMusicSectionProps) {
  const t = useT();
  const manifest = editor.manifest;
  const { uploading, error, upload } = useBrandUpload(manifest?.id ?? '');

  if (manifest === null) {
    return null;
  }

  async function onFile(file: File): Promise<void> {
    const stored = await upload('music', file);
    if (stored !== null) {
      setDraft((current) => [
        ...current,
        {
          id: uniqueKey(
            fileStemSlug(file.name),
            current.map((track) => track.id),
          ),
          file: stored,
          credit: '',
          bpm: 120,
          mood: '',
        },
      ]);
    }
  }

  function patch(index: number, change: Partial<BrandTrack>): void {
    setDraft((current) => current.map((track, position) => (position === index ? { ...track, ...change } : track)));
  }

  return (
    <div data-testid="brand-section-music" className="flex flex-col gap-4">
      <p className={BRAND_HINT_CLASS}>{t('brands.music.hint')}</p>
      {draft.length === 0 && <p className={BRAND_HINT_CLASS}>{t('brands.music.empty')}</p>}
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {draft.map((track, index) => (
          <li key={track.id} data-testid={`brand-track-${track.id}`} className={BRAND_ITEM_CLASS}>
            <div className="flex items-center justify-between gap-3">
              <span className={BRAND_FILE_NAME_CLASS}>{track.file}</span>
              {!editor.readOnly && (
                <button
                  type="button"
                  data-testid={`brand-track-remove-${track.id}`}
                  className={SECONDARY_BUTTON_SMALL_CLASS}
                  onClick={() => setDraft((current) => current.filter((_, position) => position !== index))}
                >
                  {t('brands.remove')}
                </button>
              )}
            </div>
            <audio controls preload="none" src={brandFileUrl(manifest.id, track.file)} className="w-full" />
            <BrandField label={t('brands.music.credit')} hint={t('brands.music.creditHint')}>
              <input
                data-testid={`brand-track-credit-${track.id}`}
                value={track.credit}
                disabled={editor.readOnly}
                onChange={(event) => patch(index, { credit: event.target.value })}
                className={BRAND_INPUT_CLASS}
              />
            </BrandField>
            <div className="grid gap-3 sm:grid-cols-3">
              <BrandField label={t('brands.music.bpm')}>
                <input
                  type="number"
                  min={1}
                  data-testid={`brand-track-bpm-${track.id}`}
                  value={track.bpm}
                  disabled={editor.readOnly}
                  onChange={(event) => patch(index, { bpm: Number(event.target.value) })}
                  className={`${BRAND_INPUT_CLASS} font-data`}
                />
              </BrandField>
              <BrandField label={t('brands.music.mood')}>
                <input
                  data-testid={`brand-track-mood-${track.id}`}
                  value={track.mood}
                  disabled={editor.readOnly}
                  onChange={(event) => patch(index, { mood: event.target.value })}
                  className={BRAND_INPUT_CLASS}
                />
              </BrandField>
              <BrandField label={t('brands.music.drop')} hint={t('brands.music.dropHint')}>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  data-testid={`brand-track-drop-${track.id}`}
                  value={track.drop ?? ''}
                  disabled={editor.readOnly}
                  onChange={(event) =>
                    patch(index, {
                      drop: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  className={`${BRAND_INPUT_CLASS} font-data`}
                />
              </BrandField>
            </div>
          </li>
        ))}
      </ul>
      {!editor.readOnly && (
        <BrandFileInput
          label={t('brands.music.upload')}
          accept={MUSIC_ACCEPT}
          testId="brand-music-upload"
          busy={uploading}
          onFile={(file) => void onFile(file)}
        />
      )}
      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </div>
  );
}
