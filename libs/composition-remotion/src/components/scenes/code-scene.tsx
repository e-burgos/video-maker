import type { FC } from 'react';
import type { OutputFormat } from '@video-maker/timeline-core';
import { codeLayout, columnsThatFit } from '../../helpers/code-lines';
import { sceneTheme } from '../../helpers/scene-theme';
import { SceneFrame } from './scene-frame';

export type CodeSceneProps = {
  code: string;
  codeLanguage: string;
  format: OutputFormat;
};

const CARD_RADIUS = 20;
const CARD_BACKGROUND = 'rgba(255, 255, 255, 0.04)';
const CARD_BORDER = '1px solid rgba(255, 255, 255, 0.1)';

export const CodeScene: FC<CodeSceneProps> = ({ code, codeLanguage, format }) => {
  const theme = sceneTheme('code', format);
  const cardInnerWidth = format.width - 2 * theme.paddingX - 2 * theme.fontSize;
  const layout = codeLayout({
    code,
    baseFontSize: theme.fontSize,
    maxColumns: columnsThatFit(cardInnerWidth, theme.fontSize),
  });

  return (
    <SceneFrame theme={theme} align="flex-start">
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: layout.fontSize,
          borderRadius: CARD_RADIUS,
          backgroundColor: CARD_BACKGROUND,
          border: CARD_BORDER,
        }}
      >
        <div
          style={{
            fontFamily: theme.monoFontFamily,
            fontSize: layout.fontSize * 0.72,
            color: theme.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: layout.fontSize * 0.8,
          }}
        >
          {codeLanguage}
        </div>
        <pre
          style={{
            margin: 0,
            fontFamily: theme.monoFontFamily,
            fontSize: layout.fontSize,
            lineHeight: theme.lineHeightEm,
            color: theme.color,
            whiteSpace: 'pre',
          }}
        >
          {layout.lines.map((line, index) => (
            <div key={`code-line-${index}`}>{line.length === 0 ? ' ' : line}</div>
          ))}
        </pre>
      </div>
    </SceneFrame>
  );
};
