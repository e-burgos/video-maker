import { useState } from 'react';

import { galleryImageUrl } from '../../content/learn/learn-content';
import type { CreationPath } from '../../content/learn/learn-content';
import { useT } from '../../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS } from '../ui/cl-controls';
import { ImageLightbox } from './image-lightbox';
import type { LightboxImage } from './lightbox-model';

export type PathWalkthroughProps = {
  path: CreationPath;
};

function lightboxImagesOf(path: CreationPath): LightboxImage[] {
  return path.steps.map((step) => ({
    src: galleryImageUrl(step.screenshot.file),
    caption: step.screenshot.alt,
  }));
}

export function PathWalkthrough({ path }: PathWalkthroughProps) {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const images = lightboxImagesOf(path);

  return (
    <article data-testid="learn-path" data-learn-path={path.id} className="flex flex-col gap-3">
      <div className="px-1">
        <h3 className="m-0 text-lg font-bold tracking-tight text-[var(--cl-ink)]">{path.title}</h3>
        <p className="mt-2 max-w-3xl text-sm text-[var(--cl-ink-2)]">{path.intro}</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {path.steps.map((step, index) => (
          <li
            key={step.title}
            data-testid="learn-path-step"
            className="glass-sub grid min-w-0 items-center gap-4 rounded-[16px] p-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
          >
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-data m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cl-ink-3)]">
                {t('guide.step', { current: index + 1, total: path.steps.length })}
              </p>
              <h4 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{step.title}</h4>
              <p className="m-0 text-sm text-[var(--cl-ink-2)]">{step.text}</p>
            </div>
            <button
              type="button"
              aria-label={t('learn.viewer.enlarge', { caption: step.screenshot.alt })}
              onClick={() => setOpenIndex(index)}
              className={`focus-cl block w-full cursor-zoom-in border-0 p-0 ${OPAQUE_MEDIA_FRAME_CLASS}`}
            >
              <img
                src={galleryImageUrl(step.screenshot.file)}
                alt={step.screenshot.alt}
                loading="lazy"
                className="block aspect-[16/10] w-full object-cover object-top"
              />
            </button>
          </li>
        ))}
      </ol>
      <ImageLightbox
        images={images}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </article>
  );
}
