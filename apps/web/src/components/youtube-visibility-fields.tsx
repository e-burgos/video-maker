import { localDateTimeValue } from '../api/youtube-publish-form';
import { YOUTUBE_PRIVACIES } from '../api/youtube-types';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import type { YouTubePublishFormValues } from '../api/youtube-publish-form';
import type { YouTubePrivacy } from '../api/youtube-types';

export type YouTubeVisibilityFieldsProps = {
  values: YouTubePublishFormValues;
  disabled: boolean;
  onChange: (patch: Partial<YouTubePublishFormValues>) => void;
};

const PRIVACY_LABEL: Readonly<Record<YouTubePrivacy, TranslationKey>> = {
  public: 'youtube.publish.privacy.public',
  unlisted: 'youtube.publish.privacy.unlisted',
  private: 'youtube.publish.privacy.private',
};

export function YouTubeVisibilityFields({ values, disabled, onChange }: YouTubeVisibilityFieldsProps) {
  const t = useT();

  return (
    <div className="space-y-3">
      <fieldset className="space-y-1" disabled={disabled}>
        <legend className="text-sm text-slate-400">{t('youtube.publish.privacy')}</legend>
        <div className="flex flex-wrap gap-4">
          {YOUTUBE_PRIVACIES.map((privacy) => (
            <label key={privacy} className="flex items-center gap-1.5 text-sm text-slate-200">
              <input
                type="radio"
                name="youtube-privacy"
                value={privacy}
                checked={values.privacy === privacy}
                onChange={() => onChange({ privacy })}
              />
              {t(PRIVACY_LABEL[privacy])}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={values.scheduled}
            disabled={disabled}
            onChange={(event) => onChange({ scheduled: event.target.checked })}
          />
          {t('youtube.publish.schedule')}
        </label>
        {values.scheduled && (
          <div className="space-y-1">
            <input
              type="datetime-local"
              aria-label={t('youtube.publish.scheduleAt')}
              min={localDateTimeValue(new Date())}
              value={values.publishAtLocal}
              disabled={disabled}
              onChange={(event) => onChange({ publishAtLocal: event.target.value })}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
            />
            <p className="text-xs text-slate-500">{t('youtube.publish.scheduleNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
