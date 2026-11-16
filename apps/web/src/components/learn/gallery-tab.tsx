import { useMemo, useState } from 'react';

import { galleryImageUrl } from '../../content/learn/learn-content';
import type { GalleryContent } from '../../content/learn/learn-content';
import { useT } from '../../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS } from '../ui/cl-controls';
import { ImageLightbox } from './image-lightbox';
import { LearnSectionHeading } from './learn-section-heading';

export type GalleryTabProps = {
  content: GalleryContent;
};

export function GalleryTab({ content }: GalleryTabProps) {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const images = useMemo(
    () => content.shots.map((shot) => ({ src: galleryImageUrl(shot.file), caption: shot.caption })),
    [content.shots],
  );

  return (
    <>
      <LearnSectionHeading title={content.title} lede={content.lede} />
      <ul
        data-testid="learn-gallery"
        className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 min-[1100px]:grid-cols-3"
      >
        {content.shots.map((shot, index) => (
          <li key={shot.file} data-testid="learn-gallery-item" className="glass-sub flex min-w-0 flex-col gap-2 rounded-[16px] p-3">
            <button
              type="button"
              aria-label={t('learn.viewer.enlarge', { caption: shot.caption })}
              onClick={() => setOpenIndex(index)}
              className={`focus-cl block w-full cursor-zoom-in border-0 p-0 ${OPAQUE_MEDIA_FRAME_CLASS}`}
            >
              <img
                src={galleryImageUrl(shot.file)}
                alt={shot.caption}
                loading="lazy"
                className="block aspect-[16/10] w-full object-cover object-top"
              />
            </button>
            <p className="m-0 text-xs text-[var(--cl-ink-2)]">{shot.caption}</p>
          </li>
        ))}
      </ul>
      <ImageLightbox
        images={images}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
