import { SegmentedControl } from '@e-burgos/tucu-ui';

import { MUSIC_AUTO, MUSIC_NONE, musicAfterBrandChange } from '../api/motion-brief-form';
import type { BriefDraft } from '../api/motion-brief-form';
import { MOTION_FORMATS } from '../api/motion-types';
import type { MotionBrand } from '../api/motion-types';
import { useT } from '../i18n/language-context';
import { CHECKBOX_CLASS, FIELD_CLASS, FIELD_LABEL_CLASS, TEXTAREA_CLASS } from './ui/cl-controls';

const LABEL_CLASS = `flex min-w-0 flex-col gap-1 ${FIELD_LABEL_CLASS}`;

export type MotionBriefFormProps = {
  draft: BriefDraft;
  brands: readonly MotionBrand[];
  scriptProblem: boolean;
  onChange: (draft: BriefDraft) => void;
};

export function MotionBriefForm({ draft, brands, scriptProblem, onChange }: MotionBriefFormProps) {
  const t = useT();
  const brand = brands.find((candidate) => candidate.id === draft.brand);
  const formats = brand?.formats ?? MOTION_FORMATS;
  const musicTracks = brand?.music ?? [];

  function patch(change: Partial<BriefDraft>): void {
    onChange({ ...draft, ...change });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 min-[1280px]:grid-cols-3">
        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.brand')}</span>
          <select
            value={draft.brand}
            onChange={(event) =>
              patch({
                brand: event.target.value,
                music: musicAfterBrandChange(
                  draft.music,
                  brands.find((candidate) => candidate.id === event.target.value),
                ),
              })
            }
            className={FIELD_CLASS}
          >
            {brands.map((option) => (
              <option key={option.id} value={option.id}>
                {option.source === 'user' ? t('motion.brief.brandUser', { name: option.name }) : option.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex min-w-0 flex-col gap-1">
          <p className={`m-0 ${FIELD_LABEL_CLASS}`}>
            {t('motion.brief.format')}
          </p>
          <div className="glass-thin h-10 w-fit rounded-[10px] p-[3px]">
            <SegmentedControl
              size="sm"
              label={t('motion.brief.format')}
              options={formats.map((format) => ({ value: format, label: format, 'data-testid': `motion-format-${format}` }))}
              value={draft.format}
              onChange={(format) => patch({ format })}
            />
          </div>
        </div>

        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.music')}</span>
          <select value={draft.music} onChange={(event) => patch({ music: event.target.value })} className={FIELD_CLASS}>
            {musicTracks.length > 0 && <option value={MUSIC_AUTO}>{t('motion.brief.music.auto')}</option>}
            {musicTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {t('motion.brief.music.track', { mood: track.mood, bpm: track.bpm })}
              </option>
            ))}
            <option value={MUSIC_NONE}>{t('motion.brief.music.none')}</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--cl-ink)]">
        <input
          type="checkbox"
          className={CHECKBOX_CLASS}
          checked={draft.beatSync}
          onChange={(event) => patch({ beatSync: event.target.checked })}
        />
        {t('motion.brief.beatSync')}
      </label>

      <label className={LABEL_CLASS}>
        <span>{t('motion.brief.title')}</span>
        <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} className={`${FIELD_CLASS} w-full`} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.goal')}</span>
          <input value={draft.goal} onChange={(event) => patch({ goal: event.target.value })} className={`${FIELD_CLASS} w-full`} />
        </label>
        <label className={LABEL_CLASS}>
          <span>{t('motion.brief.audience')}</span>
          <input
            value={draft.audience}
            onChange={(event) => patch({ audience: event.target.value })}
            className={`${FIELD_CLASS} w-full`}
          />
        </label>
      </div>

      <label className={LABEL_CLASS}>
        <span>{t('motion.brief.script')}</span>
        <textarea
          value={draft.script}
          onChange={(event) => patch({ script: event.target.value })}
          rows={10}
          aria-invalid={scriptProblem}
          className={`${TEXTAREA_CLASS} w-full`}
        />
      </label>
      {scriptProblem && (
        <p role="alert" className="m-0 text-sm text-[var(--tucu-state-orange-ink)]">
          {t('motion.brief.scriptRequired')}
        </p>
      )}
    </div>
  );
}
