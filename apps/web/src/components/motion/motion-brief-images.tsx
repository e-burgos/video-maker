import { imageFileName } from '../../api/motion-brief-form';
import type { BriefDraft } from '../../api/motion-brief-form';
import type { AssetListEntry } from '../../api/render-api-types';
import { useT } from '../../i18n/language-context';
import { AssetUploader } from '../asset-uploader';
import { CHECKBOX_CLASS, FIELD_SMALL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';

export type MotionBriefImagesProps = {
  slug: string;
  draft: BriefDraft;
  imageAssets: readonly AssetListEntry[];
  onChange: (draft: BriefDraft) => void;
  onImageUploaded: () => void;
};

export function MotionBriefImages({ slug, draft, imageAssets, onChange, onImageUploaded }: MotionBriefImagesProps) {
  const t = useT();
  const files = imageAssets.map((asset) => imageFileName(asset.path));

  function patchImage(file: string, change: Partial<{ included: boolean; caption: string }>): void {
    const current = draft.images[file] ?? { included: false, caption: '' };
    onChange({ ...draft, images: { ...draft.images, [file]: { ...current, ...change } } });
  }

  return (
    <div data-testid="motion-brief-images" className="flex flex-col gap-3">
      <h2 className={PANEL_HEADING_CLASS}>{t('motion.brief.images')}</h2>
      {files.length === 0 ? (
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('motion.brief.imagesEmpty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {files.map((file) => {
            const image = draft.images[file] ?? { included: false, caption: '' };
            return (
              <li key={file} className="glass-sub flex flex-col gap-2 rounded-[12px] p-2.5">
                <label className="flex items-center gap-2 text-sm text-[var(--cl-ink)]">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    aria-label={t('motion.brief.imageInclude', { file })}
                    checked={image.included}
                    onChange={(event) => patchImage(file, { included: event.target.checked })}
                  />
                  <span className="font-data truncate text-xs">{file}</span>
                </label>
                <input
                  aria-label={t('motion.brief.imageCaption', { file })}
                  value={image.caption}
                  onChange={(event) => patchImage(file, { caption: event.target.value })}
                  className={`${FIELD_SMALL_CLASS} w-full`}
                />
              </li>
            );
          })}
        </ul>
      )}
      <AssetUploader slug={slug} roles={['image']} fileInputLabel={t('motion.brief.upload')} onUploaded={onImageUploaded} />
    </div>
  );
}
