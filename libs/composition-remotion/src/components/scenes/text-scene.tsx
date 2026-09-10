import type { FC } from 'react';
import type { OutputFormat } from '@video-maker/timeline-core';
import { sceneTheme } from '../../helpers/scene-theme';
import { SceneFrame } from './scene-frame';

export type TextSceneProps = {
  text: string;
  format: OutputFormat;
};

export const TextScene: FC<TextSceneProps> = ({ text, format }) => {
  const theme = sceneTheme('text', format);

  return (
    <SceneFrame theme={theme}>
      <p
        style={{
          margin: 0,
          fontSize: theme.fontSize,
          fontWeight: theme.fontWeight,
          lineHeight: theme.lineHeightEm,
          letterSpacing: `${theme.letterSpacingEm}em`,
        }}
      >
        {text}
      </p>
    </SceneFrame>
  );
};
