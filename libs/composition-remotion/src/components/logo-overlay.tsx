import type { CSSProperties, FC } from 'react';
import { Img } from 'remotion';
import type { LogoSequenceProps } from '../helpers/timeline-to-sequence-props';
import { logoOverlayStyle } from '../helpers/logo-overlay-style';

export type LogoOverlayProps = {
  logo: LogoSequenceProps;
};

const LOGO_IMAGE_STYLE: CSSProperties = { width: '100%', height: 'auto', display: 'block' };

export const LogoOverlay: FC<LogoOverlayProps> = ({ logo }) => (
  <div style={logoOverlayStyle(logo.overlay, logo.format) as CSSProperties}>
    <Img src={logo.src} style={LOGO_IMAGE_STYLE} />
  </div>
);
