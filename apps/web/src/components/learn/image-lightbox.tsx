import { Modal } from '@e-burgos/tucu-ui';
import { useEffect } from 'react';

import { useT } from '../../i18n/language-context';
import { OPAQUE_MEDIA_FRAME_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { stepLightboxIndex } from './lightbox-model';
import type { LightboxImage } from './lightbox-model';

export type ImageLightboxProps = {
  images: readonly LightboxImage[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const t = useT();
  const current = index === null ? undefined : images[index];
  const stepping = images.length > 1;

  useEffect(() => {
    if (index === null || !stepping) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        onIndexChange(stepLightboxIndex(images.length, index, -1));
      } else if (event.key === 'ArrowRight') {
        onIndexChange(stepLightboxIndex(images.length, index, 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [images.length, index, onIndexChange, stepping]);

  return (
    <Modal
      isOpen={current !== undefined}
      setIsOpen={(open) => {
        if (!open) {
          onClose();
        }
      }}
      size="xl"
      hideButtons
      text={{ title: t('learn.viewer.title') }}
      closeLabel={t('modal.close')}
      data-testid="learn-lightbox"
    >
      {current !== undefined && index !== null && (
        <div className="flex flex-col gap-3 pt-1">
          <div className={OPAQUE_MEDIA_FRAME_CLASS}>
            <img
              data-testid="learn-lightbox-image"
              src={current.src}
              alt={current.caption}
              className="mx-auto block max-h-[60vh] w-auto max-w-full object-contain"
            />
          </div>
          <p className="m-0 text-sm text-[var(--cl-ink-2)]">{current.caption}</p>
          {stepping && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid="learn-lightbox-prev"
                className={SECONDARY_BUTTON_SMALL_CLASS}
                onClick={() => onIndexChange(stepLightboxIndex(images.length, index, -1))}
              >
                {t('learn.viewer.prev')}
              </button>
              <span className="font-data text-xs text-[var(--cl-ink-3)]">
                {t('learn.viewer.position', { index: index + 1, total: images.length })}
              </span>
              <button
                type="button"
                data-testid="learn-lightbox-next"
                className={SECONDARY_BUTTON_SMALL_CLASS}
                onClick={() => onIndexChange(stepLightboxIndex(images.length, index, 1))}
              >
                {t('learn.viewer.next')}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
