import type { FC } from 'react';
import type { OutputFormat } from '@video-maker/timeline-core';
import { sceneTheme } from '../../helpers/scene-theme';
import { SceneFrame } from './scene-frame';

export type TitleSceneProps = {
  title: string;
  subtitle?: string | undefined;
  format: OutputFormat;
};

const ACCENT_RULE_WIDTH_RATIO = 0.18;
const ACCENT_RULE_HEIGHT = 8;

export const TitleScene: FC<TitleSceneProps> = ({ title, subtitle, format }) => {
  const theme = sceneTheme('title', format);

  return (
    <SceneFrame theme={theme}>
      <h1
        style={{
          margin: 0,
          fontSize: theme.fontSize,
          fontWeight: theme.fontWeight,
          lineHeight: theme.lineHeightEm,
          letterSpacing: `${theme.letterSpacingEm}em`,
          textTransform: theme.textTransform,
        }}
      >
        {title}
      </h1>
      <div
        style={{
          marginTop: theme.subtitleFontSize * 0.6,
          width: format.width * ACCENT_RULE_WIDTH_RATIO,
          height: ACCENT_RULE_HEIGHT,
          borderRadius: ACCENT_RULE_HEIGHT,
          backgroundColor: theme.accent,
        }}
      />
      {subtitle === undefined ? null : (
        <p
          style={{
            margin: 0,
            marginTop: theme.subtitleFontSize * 0.7,
            fontSize: theme.subtitleFontSize,
            fontWeight: 400,
            lineHeight: theme.lineHeightEm,
            color: theme.mutedColor,
          }}
        >
          {subtitle}
        </p>
      )}
    </SceneFrame>
  );
};
