import { useState } from 'react';

import { useT } from '../i18n/language-context';
import { PublicationsPanel } from './publications-panel';
import { Button } from './ui/button';
import { YouTubePublishDialog } from './youtube-publish-dialog';

export type YouTubePublishSectionProps = {
  slug: string;
};

export function YouTubePublishSection({ slug }: YouTubePublishSectionProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div data-testid="youtube-publish-section" className="space-y-3">
      <Button variant="primary" data-testid="youtube-publish-open" onClick={() => setOpen(true)}>
        {t('youtube.publish.open')}
      </Button>
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
