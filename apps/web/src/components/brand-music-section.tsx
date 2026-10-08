import { brandFileUrl, fileStemSlug, uniqueKey } from '../api/brand-files';
import type { BrandTrack } from '../api/brand-types';
import { useBrandUpload } from '../hooks/use-brand-upload';
import { useSectionDraft } from '../hooks/use-section-draft';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { BRAND_INPUT_CLASS, BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';
import { BrandSaveBar } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

const MUSIC_ACCEPT = '.mp3,.wav,.m4a';

function trackIsComplete(track: BrandTrack): boolean {
  return track.credit.trim() !== '' && track.mood.trim() !== '' && track.bpm > 0;
}

function normalizedTrack(track: BrandTrack): BrandTrack {
  const { drop, ...rest } = track;
  return {
    ...rest,
    credit: track.credit.trim(),
    mood: track.mood.trim(),
    ...(drop === undefined ? {} : { drop }),
  };
}

export function BrandMusicSection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  const savedTracks: BrandTrack[] = manifest?.music ?? [];
  const { draft, setDraft, dirty } = useSectionDraft(savedTracks);
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

  const invalid = draft.some((track) => !trackIsComplete(track)) ? t('brands.music.incomplete') : null;

  return (
    <div data-testid="brand-section-music" className="space-y-4">
      <p className="text-sm text-ink-muted">{t('brands.music.hint')}</p>
      {draft.length === 0 && <p className="text-sm text-ink-faint">{t('brands.music.empty')}</p>}
      <ul className="space-y-4">
        {draft.map((track, index) => (
          <li
            key={track.id}
            data-testid={`brand-track-${track.id}`}
            className="space-y-3 rounded-lg border border-border-subtle p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-ink-muted">{track.file}</span>
              {!editor.readOnly && (
                <Button
                  data-testid={`brand-track-remove-${track.id}`}
                  onClick={() => setDraft((current) => current.filter((_, position) => position !== index))}
                >
                  {t('brands.remove')}
                </Button>
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
                  className={BRAND_INPUT_CLASS}
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
                  className={BRAND_INPUT_CLASS}
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
      {error !== null && <ErrorNotice error={error} />}
      <BrandSaveBar
        editor={editor}
        dirty={dirty}
        testId="brand-music-save"
        invalidMessage={invalid}
        onSave={() => void editor.update((current) => ({ ...current, music: draft.map(normalizedTrack) }), 'silent')}
      />
    </div>
  );
}
