import { LucideIcons } from '@e-burgos/tucu-ui';

import { artifactUrl } from '../../api/artifact-url';
import type { PublishQueueItem } from '../../api/publish-queue-types';
import { useT } from '../../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS } from '../ui/cl-controls';

export function PublishQueueThumbnail({ item }: { item: PublishQueueItem }) {
  const t = useT();
  const thumbnail = item.metadata.thumbnail;

  return (
    <div
      data-testid="publish-queue-thumbnail"
      className={`${OPAQUE_MEDIA_FRAME_CLASS} flex aspect-video w-24 shrink-0 items-center justify-center`}
    >
      {thumbnail === undefined || thumbnail === '' ? (
        <LucideIcons.Film aria-hidden size={18} className="text-white/60" />
      ) : (
        <img
          src={artifactUrl(item.slug, thumbnail)}
          alt={t('publishQueue.thumbnailAlt', { title: item.metadata.title })}
          loading="lazy"
          className="size-full object-cover"
        />
      )}
    </div>
  );
}
