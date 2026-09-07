import { Fragment } from 'react';
import { Img, OffthreadVideo } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';
import type { TransitionPresentation } from '@remotion/transitions';
import type { Fps, TimelineTransition } from '@video-maker/timeline-core';
import type { ArollPresentation } from '../transitions/presentation-for';
import type { ArollTransitionPlan, VideoSequenceProps } from '../helpers/timeline-to-sequence-props';
import { punchInStyle } from '../helpers/punch-in-style';
import { transitionTiming } from '../helpers/transition-timing';
import { presentationFor } from '../transitions/presentation-for';

export interface ArollSeriesProps {
  scenes: readonly VideoSequenceProps[];
  transitions: readonly ArollTransitionPlan[];
  fps: Fps;
}

function findTransitionBetween(
  transitions: readonly ArollTransitionPlan[],
  outgoingClipId: VideoSequenceProps['clipId'],
  enteringClipId: VideoSequenceProps['clipId'],
): ArollTransitionPlan | undefined {
  return transitions.find(
    (plan) => plan.betweenClipIds[0] === outgoingClipId && plan.betweenClipIds[1] === enteringClipId,
  );
}

function toTimelineTransition(plan: ArollTransitionPlan): TimelineTransition {
  const base = {
    betweenClipIds: [...plan.betweenClipIds],
    kind: plan.kind,
    durationFrames: plan.durationInFrames,
    timing: plan.timing,
  };

  return plan.direction === null ? base : { ...base, direction: plan.direction };
}

function widenPresentation(presentation: ArollPresentation): TransitionPresentation<Record<string, unknown>> {
  return presentation as unknown as TransitionPresentation<Record<string, unknown>>;
}

function ArollScene({ scene }: { scene: VideoSequenceProps }) {
  const style = punchInStyle(scene.transform);

  if (scene.kind !== 'video') {
    return <Img src={scene.src} style={style} />;
  }

  return <OffthreadVideo src={scene.src} trimBefore={scene.trimBefore} muted style={style} />;
}

export function ArollSeries({ scenes, transitions, fps }: ArollSeriesProps) {
  return (
    <TransitionSeries>
      {scenes.map((scene, index) => {
        const nextScene = scenes[index + 1];
        const transition =
          nextScene === undefined ? undefined : findTransitionBetween(transitions, scene.clipId, nextScene.clipId);

        return (
          <Fragment key={scene.clipId}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <ArollScene scene={scene} />
            </TransitionSeries.Sequence>
            {transition === undefined ? null : (
              <TransitionSeries.Transition
                presentation={widenPresentation(presentationFor(transition.kind, transition.direction))}
                timing={transitionTiming(toTimelineTransition(transition), fps)}
              />
            )}
          </Fragment>
        );
      })}
    </TransitionSeries>
  );
}
