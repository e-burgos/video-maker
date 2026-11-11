import { AbsoluteFill } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { lightLeakOverlayStyle, lightLeakSceneStyle } from './light-leak-style';

export type LightLeakProps = {
  maxOpacity?: number;
};

function LightLeakPresentation({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}: TransitionPresentationComponentProps<LightLeakProps>) {
  return (
    <AbsoluteFill style={lightLeakSceneStyle(presentationDirection, presentationProgress)}>
      {children}
      {presentationDirection === 'entering' ? (
        <AbsoluteFill style={lightLeakOverlayStyle(presentationProgress, passedProps.maxOpacity)} />
      ) : null}
    </AbsoluteFill>
  );
}

export function lightLeak(props: LightLeakProps = {}): TransitionPresentation<LightLeakProps> {
  return {
    component: LightLeakPresentation,
    props,
  };
}
