import type { CSSProperties, FC } from 'react';
import { AbsoluteFill } from 'remotion';
import type { OutputFormat } from '@video-maker/timeline-core';
import { CAPTION_PRESET_IDS } from '../helpers/caption-preset';
import type { CaptionPlatform } from '../helpers/caption-safe-zone';
import type { CaptionSequenceProps } from '../helpers/timeline-to-sequence-props';
import { KineticCaptions } from './kinetic-captions';

export const CAPTION_PRESET_GALLERY_ID = 'CaptionPresetGallery';

export type CaptionPresetGalleryProps = {
  clips: readonly CaptionSequenceProps[];
  format: OutputFormat;
  platform?: CaptionPlatform | undefined;
};

const PANEL_BACKGROUND = '#111318';

const PANEL_LABEL_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: '16px 24px',
  color: '#ffffff',
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
};

function panelStyleFor(index: number, format: OutputFormat): CSSProperties {
  return {
    position: 'absolute',
    left: index * format.width,
    top: 0,
    width: format.width,
    height: format.height,
    overflow: 'hidden',
    backgroundColor: PANEL_BACKGROUND,
  };
}

export const CaptionPresetGallery: FC<CaptionPresetGalleryProps> = ({
  clips,
  format,
  platform,
}) => (
  <AbsoluteFill style={{ backgroundColor: PANEL_BACKGROUND }}>
    {CAPTION_PRESET_IDS.map((presetId, index) => (
      <div key={presetId} style={panelStyleFor(index, format)}>
        <div style={PANEL_LABEL_STYLE}>{presetId}</div>
        <KineticCaptions clips={clips} format={format} preset={presetId} platform={platform} />
      </div>
    ))}
  </AbsoluteFill>
);
