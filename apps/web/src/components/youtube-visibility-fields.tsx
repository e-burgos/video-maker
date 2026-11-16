import { localDateTimeValue } from '../api/youtube-publish-form';
import { YOUTUBE_PRIVACIES } from '../api/youtube-types';
import { useT } from '../i18n/language-context';
import { CHECKBOX_CLASS, CHECK_LABEL_CLASS, FIELD_CLASS, FIELD_LABEL_CLASS } from './ui/cl-controls';
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
    <div className="flex flex-col gap-3">
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0" disabled={disabled}>
        <legend className={`${FIELD_LABEL_CLASS} p-0`}>{t('youtube.publish.privacy')}</legend>
        <div className="flex flex-wrap gap-4">
          {YOUTUBE_PRIVACIES.map((privacy) => (
            <label key={privacy} className={CHECK_LABEL_CLASS}>
              <input
                type="radio"
                className={CHECKBOX_CLASS}
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

      <div className="flex flex-col gap-1">
        <label className={CHECK_LABEL_CLASS}>
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={values.scheduled}
            disabled={disabled}
            onChange={(event) => onChange({ scheduled: event.target.checked })}
          />
          {t('youtube.publish.schedule')}
        </label>
        {values.scheduled && (
          <div className="flex flex-col gap-1">
            <input
              type="datetime-local"
              aria-label={t('youtube.publish.scheduleAt')}
              min={localDateTimeValue(new Date())}
              value={values.publishAtLocal}
              disabled={disabled}
              onChange={(event) => onChange({ publishAtLocal: event.target.value })}
              className={`${FIELD_CLASS} font-data`}
            />
            <p className="m-0 text-xs text-[var(--cl-ink-3)]">{t('youtube.publish.scheduleNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
