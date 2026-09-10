import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, Loop, Sequence } from 'remotion';
import type { OutputFormat, RemotionScene } from '@video-maker/timeline-core';
import { DEFAULT_IMAGE_KEN_BURNS } from '../helpers/ken-burns';
import { punchInStyle } from '../helpers/punch-in-style';
import type { SceneAssetPlan, SceneSequenceProps } from '../helpers/timeline-to-sequence-props';
import { CodeScene } from './scenes/code-scene';
import { ImageKenBurnsScene } from './scenes/image-ken-burns-scene';
import { PlaceholderScene } from './scenes/placeholder-scene';
import { TextScene } from './scenes/text-scene';
import { TitleScene } from './scenes/title-scene';
import { TimelineVideo } from './timeline-video';

export type SceneTrackProps = {
  scenes: readonly SceneSequenceProps[];
  format: OutputFormat;
};

const COVER_MEDIA_STYLE: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
const CONTAIN_MEDIA_STYLE: CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' };

function mediaStyleFor(plan: SceneAssetPlan): CSSProperties {
  const base = plan.fit === 'contain' ? CONTAIN_MEDIA_STYLE : COVER_MEDIA_STYLE;
  return { ...base, ...punchInStyle(plan.transform, plan.transform.anchor) };
}

export function sceneLoopFrames(plan: SceneAssetPlan, durationInFrames: number): number | null {
  if (plan.mediaKind !== 'video' || plan.assetDurationInFrames === null) {
    return null;
  }
  const playableFrames = plan.assetDurationInFrames - plan.trimBefore;
  return playableFrames > 0 && playableFrames < durationInFrames ? playableFrames : null;
}

const SceneAssetVisual: FC<{
  plan: SceneAssetPlan;
  durationInFrames: number;
  sceneId: string;
  format: OutputFormat;
}> = ({ plan, durationInFrames, sceneId, format }) => {
  if (plan.mediaKind === 'audio') {
    return <PlaceholderScene prompt={plan.assetId} sceneId={sceneId} format={format} />;
  }

  if (plan.mediaKind === 'image') {
    return (
      <ImageKenBurnsScene
        src={plan.src}
        move={plan.kenBurns ?? DEFAULT_IMAGE_KEN_BURNS}
        durationInFrames={durationInFrames}
      />
    );
  }

  const media = <TimelineVideo src={plan.src} trimBefore={plan.trimBefore} style={mediaStyleFor(plan)} />;
  const loopFrames = sceneLoopFrames(plan, durationInFrames);

  return (
    <AbsoluteFill>
      {loopFrames === null ? media : <Loop durationInFrames={loopFrames}>{media}</Loop>}
    </AbsoluteFill>
  );
};

const NativeScene: FC<{
  scene: RemotionScene;
  src: string | null;
  durationInFrames: number;
  sceneId: string;
  format: OutputFormat;
}> = ({ scene, src, durationInFrames, sceneId, format }) => {
  if (scene.kind === 'title') {
    return (
      <TitleScene
        title={scene.title ?? sceneId}
        format={format}
        {...(scene.subtitle === undefined ? {} : { subtitle: scene.subtitle })}
      />
    );
  }
  if (scene.kind === 'text') {
    return <TextScene text={scene.text ?? sceneId} format={format} />;
  }
  if (scene.kind === 'code') {
    return <CodeScene code={scene.code ?? ''} codeLanguage={scene.codeLanguage ?? 'text'} format={format} />;
  }
  if (src === null) {
    return (
      <PlaceholderScene
        prompt={`image-kenburns without image (${sceneId})`}
        sceneId={sceneId}
        format={format}
      />
    );
  }
  return (
    <ImageKenBurnsScene
      src={src}
      move={{ zoomFrom: scene.zoomFrom ?? 1, zoomTo: scene.zoomTo ?? 1 }}
      durationInFrames={durationInFrames}
    />
  );
};

const SceneVisual: FC<{ scene: SceneSequenceProps; format: OutputFormat }> = ({ scene, format }) => {
  if (scene.visual.kind === 'placeholder') {
    return <PlaceholderScene prompt={scene.visual.prompt} sceneId={scene.sceneId} format={format} />;
  }
  if (scene.visual.kind === 'remotion') {
    return (
      <NativeScene
        scene={scene.visual.scene}
        src={scene.visual.src}
        durationInFrames={scene.durationInFrames}
        sceneId={scene.sceneId}
        format={format}
      />
    );
  }
  return (
    <SceneAssetVisual
      plan={scene.visual}
      durationInFrames={scene.durationInFrames}
      sceneId={scene.sceneId}
      format={format}
    />
  );
};

export const SceneTrack: FC<SceneTrackProps> = ({ scenes, format }) => (
  <>
    {scenes.map((scene) => (
      <Sequence key={scene.clipId} name={scene.sceneId} from={scene.from} durationInFrames={scene.durationInFrames}>
        <SceneVisual scene={scene} format={format} />
      </Sequence>
    ))}
  </>
);
