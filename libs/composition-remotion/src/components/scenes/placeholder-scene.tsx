import type { FC } from 'react';
import type { OutputFormat } from '@video-maker/timeline-core';
import { sceneTheme } from '../../helpers/scene-theme';
import { SceneFrame } from './scene-frame';

export type PlaceholderSceneProps = {
  prompt: string;
  sceneId?: string | undefined;
  format: OutputFormat;
};

const CARD_RADIUS = 24;
const CARD_BACKGROUND = 'rgba(255, 255, 255, 0.05)';

export const PlaceholderScene: FC<PlaceholderSceneProps> = ({ prompt, sceneId, format }) => {
  const theme = sceneTheme('placeholder', format);

  return (
    <SceneFrame theme={theme}>
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: theme.fontSize,
          borderRadius: CARD_RADIUS,
          backgroundColor: CARD_BACKGROUND,
          border: `2px dashed ${theme.accent}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSize * 0.6,
            color: theme.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: theme.fontSize * 0.6,
          }}
        >
          {sceneId ?? 'missing visual'}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: theme.fontSize,
            fontWeight: theme.fontWeight,
            lineHeight: theme.lineHeightEm,
            color: theme.color,
          }}
        >
          {prompt}
        </p>
      </div>
    </SceneFrame>
  );
};
