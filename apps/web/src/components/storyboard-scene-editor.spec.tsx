import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { storyboardFixture } from '../api/__fixtures__/storyboard';
import { StoryboardSceneEditor } from './storyboard-scene-editor';
import type { StoryboardDocument } from '@video-maker/timeline-core';

function renderScene(sceneId: string, storyboard: StoryboardDocument = storyboardFixture()) {
  const onChange = vi.fn();
  const onCopyPrompt = vi.fn();
  const scene = storyboard.scenes.find((candidate) => candidate.id === sceneId);
  if (scene === undefined) {
    throw new Error(`unknown scene ${sceneId}`);
  }

  render(
    <ul>
      <StoryboardSceneEditor
        storyboard={storyboard}
        scene={scene}
        onChange={onChange}
        onCopyPrompt={onCopyPrompt}
      />
    </ul>,
  );

  return { onChange, onCopyPrompt, scene };
}

describe('StoryboardSceneEditor', () => {
  it('numbers the scene from 01 so it matches the exported prompt sheet', () => {
    renderScene('scene-01');

    expect(screen.getByText('01 · scene-01')).toBeTruthy();
  });

  it('edits the narration and the visual prompt of the scene', () => {
    const { onChange } = renderScene('scene-01');

    fireEvent.change(screen.getByLabelText('Narration for scene-01'), {
      target: { value: 'Otra narración.' },
    });
    fireEvent.change(screen.getByLabelText('Visual prompt for scene-01'), {
      target: { value: 'Another prompt.' },
    });

    expect(onChange.mock.calls[0]?.[0].scenes[0].narration).toBe('Otra narración.');
    expect(onChange.mock.calls[1]?.[0].scenes[0].visualPrompt).toBe('Another prompt.');
  });

  it('edits the estimated duration and the two tag lists of the scene', () => {
    const { onChange } = renderScene('scene-01');

    fireEvent.change(screen.getByLabelText('Estimated duration for scene-01'), {
      target: { value: '6000' },
    });
    fireEvent.change(screen.getByLabelText('Music tags for scene-01'), {
      target: { value: 'calm, warm' },
    });
    fireEvent.change(screen.getByLabelText('Sfx tags for scene-01'), {
      target: { value: 'click' },
    });

    expect(onChange.mock.calls[0]?.[0].scenes[0].estimatedDurationMs).toBe(6000);
    expect(onChange.mock.calls[1]?.[0].scenes[0].musicTags).toEqual(['calm', 'warm']);
    expect(onChange.mock.calls[2]?.[0].scenes[0].sfxTags).toEqual(['click']);
  });

  it('overrides the caption style of one scene and shows the storyboard style as the placeholder', () => {
    const { onChange } = renderScene('scene-01');
    const input = screen.getByLabelText('Caption style for scene-01') as HTMLInputElement;

    expect(input.placeholder).toBe('bold yellow highlight, one word at a time');
    fireEvent.change(input, { target: { value: 'monospace' } });
    expect(onChange.mock.calls[0]?.[0].scenes[0].captionsStyle).toBe('monospace');
  });

  it('shows the asset id field only for a scene whose visual comes from the catalog', () => {
    renderScene('scene-01');
    expect(screen.queryByLabelText('Asset id for scene-01')).toBeNull();
  });

  it('edits the asset id of a scene that reuses a catalog asset', () => {
    const { onChange } = renderScene('scene-03');

    expect((screen.getByLabelText('Asset id for scene-03') as HTMLInputElement).value).toBe(
      'broll-0001',
    );
    fireEvent.change(screen.getByLabelText('Asset id for scene-03'), {
      target: { value: 'broll-0002' },
    });
    expect(onChange.mock.calls[0]?.[0].scenes[2].assetId).toBe('broll-0002');
  });

  it('switches the visual source and lets the model drop the props of the previous one', () => {
    const { onChange } = renderScene('scene-03');

    fireEvent.change(screen.getByLabelText('Visual source for scene-03'), {
      target: { value: 'upload' },
    });

    const next = onChange.mock.calls[0]?.[0] as StoryboardDocument;
    expect(next.scenes[2]?.visualSource).toBe('upload');
    expect('assetId' in (next.scenes[2] ?? {})).toBe(false);
  });

  it('shows the Remotion scene editor only for a scene that renders natively', () => {
    renderScene('scene-01');
    expect(screen.queryByLabelText('Remotion scene kind for scene-01')).toBeNull();
  });

  it('edits the props a code scene requires and offers the four scene kinds', () => {
    const { onChange } = renderScene('scene-02');

    const kinds = Array.from(
      (screen.getByLabelText('Remotion scene kind for scene-02') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(kinds).toEqual(['title', 'text', 'code', 'image-kenburns']);

    fireEvent.change(screen.getByLabelText('code for scene-02'), { target: { value: 'ls -la' } });
    fireEvent.change(screen.getByLabelText('codeLanguage for scene-02'), {
      target: { value: 'zsh' },
    });

    expect(onChange.mock.calls[0]?.[0].scenes[1].remotionScene.code).toBe('ls -la');
    expect(onChange.mock.calls[1]?.[0].scenes[1].remotionScene.codeLanguage).toBe('zsh');
  });

  it('replaces the whole Remotion scene when its kind changes', () => {
    const { onChange } = renderScene('scene-02');

    fireEvent.change(screen.getByLabelText('Remotion scene kind for scene-02'), {
      target: { value: 'title' },
    });

    expect(onChange.mock.calls[0]?.[0].scenes[1].remotionScene).toEqual({
      kind: 'title',
      title: 'Title',
    });
  });

  it('edits the two zoom factors of a Ken Burns scene as numbers', () => {
    const storyboard = storyboardFixture();
    const scenes = storyboard.scenes.map((scene, position) =>
      position === 1
        ? { ...scene, remotionScene: { kind: 'image-kenburns' as const, zoomFrom: 1, zoomTo: 1.2 } }
        : scene,
    );
    const { onChange } = renderScene('scene-02', { ...storyboard, scenes });

    fireEvent.change(screen.getByLabelText('zoomTo for scene-02'), { target: { value: '2.5' } });

    expect(onChange.mock.calls[0]?.[0].scenes[1].remotionScene.zoomTo).toBe(2.5);
  });

  it('asks its parent to copy the prompt of this scene alone', () => {
    const { onCopyPrompt, scene } = renderScene('scene-01');

    fireEvent.click(screen.getByRole('button', { name: 'copy prompt' }));

    expect(onCopyPrompt).toHaveBeenCalledWith(scene);
  });
});
