import { useState } from 'react';

import { TUTORIAL_VIDEO_URL, tutorialPosterUrl } from '../../content/learn/learn-content';
import type { TutorialContent } from '../../content/learn/learn-content';
import { useT } from '../../i18n/language-context';
import { LINK_CLASS, OPAQUE_MEDIA_FRAME_CLASS, WARNING_TEXT_CLASS } from '../ui/cl-controls';
import { LearnSectionHeading } from './learn-section-heading';

export type TutorialTabProps = {
  content: TutorialContent;
};

export function TutorialTab({ content }: TutorialTabProps) {
  const t = useT();
  const [failed, setFailed] = useState(false);

  return (
    <>
      <LearnSectionHeading title={content.title} lede={content.lede} />
      <figure className="glass m-0 flex max-w-4xl flex-col gap-3 rounded-[20px] p-4">
        <div className={OPAQUE_MEDIA_FRAME_CLASS}>
          <video
            data-testid="learn-tutorial-video"
            controls
            playsInline
            preload="none"
            poster={tutorialPosterUrl()}
            src={TUTORIAL_VIDEO_URL}
            aria-label={t('learn.tutorial.label')}
            onError={() => setFailed(true)}
            className="block aspect-video w-full"
          />
        </div>
        {failed && (
          <div data-testid="learn-tutorial-offline" role="alert" className="flex flex-col gap-1">
            <p className={WARNING_TEXT_CLASS}>{t('learn.tutorial.offline')}</p>
            <a
              data-testid="learn-tutorial-open"
              href={TUTORIAL_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINK_CLASS} text-sm`}
            >
              {t('learn.tutorial.open')}
            </a>
          </div>
        )}
        <figcaption className="text-xs text-[var(--cl-ink-3)]">{content.credit}</figcaption>
      </figure>
    </>
  );
}
