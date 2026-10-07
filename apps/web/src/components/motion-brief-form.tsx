import { useId } from 'react';

import { MUSIC_AUTO, MUSIC_NONE, imageFileName } from '../api/motion-brief-form';
import type { BriefDraft } from '../api/motion-brief-form';
import { MOTION_FORMATS } from '../api/motion-types';
import type { MotionBrand } from '../api/motion-types';
import type { AssetListEntry } from '../api/render-api-types';
import { useT } from '../i18n/language-context';
import { AssetUploader } from './asset-uploader';

const FIELD_CLASS =
  'w-full rounded-control border border-border-strong bg-surface px-3 py-1.5 text-sm text-ink';
const LABEL_CLASS = 'block space-y-1 text-sm text-ink-faint';

export type MotionBriefFormProps = {
  slug: string;
  draft: BriefDraft;
  brands: readonly MotionBrand[];
  imageAssets: readonly AssetListEntry[];
  scriptProblem: boolean;
  onChange: (draft: BriefDraft) => void;
  onImageUploaded: () => void;
};

export function MotionBriefForm({
  slug,
  draft,
  brands,
  imageAssets,
  scriptProblem,
  onChange,
  onImageUploaded,
}: MotionBriefFormProps) {
  const t = useT();
  const formatLabelId = useId();
  const brand = brands.find((candidate) => candidate.id === draft.brand);
  const formats = brand?.formats ?? MOTION_FORMATS;
  const files = imageAssets.map((asset) => imageFileName(asset.path));

  function patch(change: Partial<BriefDraft>): void {
    onChange({ ...draft, ...change });
  }

  function patchImage(file: string, change: Partial<{ included: boolean; caption: string }>): void {
    const current = draft.images[file] ?? { included: false, caption: '' };
    patch({ images: { ...draft.images, [file]: { ...current, ...change } } });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.brand')}</span>
          <select
            value={draft.brand}
            onChange={(event) => patch({ brand: event.target.value })}
            className={FIELD_CLASS}
          >
            {brands.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1">
          <p id={formatLabelId} className="text-sm text-ink-faint">
            {t('motion.brief.format')}
          </p>
          <div role="radiogroup" aria-labelledby={formatLabelId} className="flex gap-2">
            {formats.map((format) => (
              <label
                key={format}
                className="cursor-pointer rounded-control border border-border-strong px-3 py-1.5 text-sm text-ink has-[:checked]:border-accent"
              >
                <input
                  type="radio"
                  name="motion-format"
                  value={format}
                  checked={draft.format === format}
                  onChange={() => patch({ format })}
                  className="mr-2"
                />
                {format}
              </label>
            ))}
          </div>
        </div>

        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.music')}</span>
          <select
            value={draft.music}
            onChange={(event) => patch({ music: event.target.value })}
            className={FIELD_CLASS}
          >
            <option value={MUSIC_AUTO}>{t('motion.brief.music.auto')}</option>
            {(brand?.music ?? []).map((track) => (
              <option key={track.id} value={track.id}>
                {t('motion.brief.music.track', { mood: track.mood, bpm: track.bpm })}
              </option>
            ))}
            <option value={MUSIC_NONE}>{t('motion.brief.music.none')}</option>
          </select>
        </label>

        <label className="flex items-center gap-2 self-end text-sm text-ink">
          <input
            type="checkbox"
            checked={draft.beatSync}
            onChange={(event) => patch({ beatSync: event.target.checked })}
          />
          {t('motion.brief.beatSync')}
        </label>
      </div>

      <label className={LABEL_CLASS}>
        <span>{t('motion.brief.title')}</span>
        <input
          value={draft.title}
          onChange={(event) => patch({ title: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.goal')}</span>
          <input
            value={draft.goal}
            onChange={(event) => patch({ goal: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.audience')}</span>
          <input
            value={draft.audience}
            onChange={(event) => patch({ audience: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <label className={LABEL_CLASS}>
        <span>{t('motion.brief.script')}</span>
        <textarea
          value={draft.script}
          onChange={(event) => patch({ script: event.target.value })}
          rows={8}
          aria-invalid={scriptProblem}
          className={FIELD_CLASS}
        />
      </label>
      {scriptProblem && (
        <p role="alert" className="text-sm text-warning">
          {t('motion.brief.scriptRequired')}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-ink">{t('motion.brief.images')}</h3>
        {files.length === 0 ? (
          <p className="text-sm text-ink-faint">{t('motion.brief.imagesEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => {
              const image = draft.images[file] ?? { included: false, caption: '' };
              return (
                <li key={file} className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      aria-label={t('motion.brief.imageInclude', { file })}
                      checked={image.included}
                      onChange={(event) => patchImage(file, { included: event.target.checked })}
                    />
                    <span className="font-mono text-xs">{file}</span>
                  </label>
                  <input
                    aria-label={t('motion.brief.imageCaption', { file })}
                    value={image.caption}
                    onChange={(event) => patchImage(file, { caption: event.target.value })}
                    className={`${FIELD_CLASS} flex-1`}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <AssetUploader
          slug={slug}
          roles={['image']}
          fileInputLabel={t('motion.brief.upload')}
          onUploaded={onImageUploaded}
        />
      </div>
    </div>
  );
}
