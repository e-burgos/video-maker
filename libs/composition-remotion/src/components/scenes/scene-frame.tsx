import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneTheme } from '../../helpers/scene-theme';

export type SceneFrameProps = {
  theme: SceneTheme;
  align?: 'center' | 'flex-start' | undefined;
  children: ReactNode;
};

export function sceneFrameStyle(theme: SceneTheme, align: 'center' | 'flex-start'): CSSProperties {
  return {
    backgroundColor: theme.background,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: align,
    textAlign: align === 'center' ? 'center' : 'left',
    paddingLeft: theme.paddingX,
    paddingRight: theme.paddingX,
    paddingTop: theme.paddingY,
    paddingBottom: theme.paddingBottom,
    fontFamily: theme.fontFamily,
    color: theme.color,
  };
}

export const SceneFrame: FC<SceneFrameProps> = ({ theme, align, children }) => (
  <AbsoluteFill style={sceneFrameStyle(theme, align ?? 'center')}>{children}</AbsoluteFill>
);
