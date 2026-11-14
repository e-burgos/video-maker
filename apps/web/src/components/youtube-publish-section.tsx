import { useState } from 'react';

import { useT } from '../i18n/language-context';
import { PublicationsPanel } from './publications-panel';
import { PRIMARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';
import { YouTubePublishDialog } from './youtube-publish-dialog';

export type YouTubePublishSectionProps = {
  slug: string;
};

export function YouTubePublishSection({ slug }: YouTubePublishSectionProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div data-testid="youtube-publish-section" className="flex flex-col gap-3">
      <button
        type="button"
        data-testid="youtube-publish-open"
        onClick={() => setOpen(true)}
        className={`${PRIMARY_BUTTON_SMALL_CLASS} self-start`}
      >
        {t('youtube.publish.open')}
      </button>
      <PublicationsPanel slug={slug} refreshToken={refreshToken} />
      {open && (
        <YouTubePublishDialog
          slug={slug}
          onClose={() => setOpen(false)}
          onPublished={() => setRefreshToken((token) => token + 1)}
        />
      )}
    </div>
  );
}
