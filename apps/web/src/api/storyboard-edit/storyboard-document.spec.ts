import { describe, expect, it } from 'vitest';

import { storyboardFixture } from '../__fixtures__/storyboard';
import {
  canSaveStoryboard,
  formatTags,
  parseTags,
  setCharacterField,
  setRemotionSceneKind,
  setRemotionSceneText,
  setRemotionSceneZoom,
  setSceneDuration,
  setSceneTags,
  setSceneText,
  setSceneVisualSource,
  setStoryboardHeader,
  setStoryboardMusicTags,
  storyboardIssues,
} from './storyboard-document';

describe('storyboardIssues', () => {
  it('finds nothing wrong with the document the service published', () => {
    const document = storyboardFixture();

    expect(storyboardIssues(document)).toEqual([]);
    expect(canSaveStoryboard(document)).toBe(true);
  });

  it('mirrors the 422 of an empty narration, naming the scene by its path', () => {
    const document = setSceneText(storyboardFixture(), 'scene-01', 'narration', '');

    const issues = storyboardIssues(document);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('scenes.0.narration');
    expect(canSaveStoryboard(document)).toBe(false);
  });

  it('mirrors the cross-field 422 of an asset scene left without an assetId', () => {
    const document = setSceneText(
      setSceneVisualSource(storyboardFixture(), 'scene-01', 'asset'),
      'scene-01',
      'assetId',
      '',
    );

    expect(storyboardIssues(document).map((issue) => issue.path)).toEqual(['scenes.0.assetId']);
  });

  it('mirrors the 422 of a Remotion scene missing the props of its own kind', () => {
    const document = setRemotionSceneText(storyboardFixture(), 'scene-02', 'code', '');

    expect(storyboardIssues(document)[0]?.path).toBe('scenes.1.remotionScene.code');
  });
});

describe('storyboard editors', () => {
  it('never mutates the document it receives', () => {
    const document = storyboardFixture();
    const before = JSON.stringify(document);

    setStoryboardHeader(document, 'title', 'Otro título');
    setSceneText(document, 'scene-01', 'narration', 'Otra narración');
    setCharacterField(document, 'character-01', 'name', 'Otra');
    setSceneVisualSource(document, 'scene-03', 'upload');

    expect(JSON.stringify(document)).toBe(before);
  });

  it('edits the four header fields and leaves the scenes untouched', () => {
    const document = setStoryboardHeader(
      setStoryboardHeader(
        setStoryboardHeader(
          setStoryboardHeader(storyboardFixture(), 'title', 'Nuevo título'),
          'language',
          'en-US',
        ),
        'format',
        '16:9',
      ),
      'captionsStyle',
      'clean white',
    );

    expect(document.title).toBe('Nuevo título');
    expect(document.language).toBe('en-US');
    expect(document.format).toBe('16:9');
    expect(document.captionsStyle).toBe('clean white');
    expect(document.scenes).toEqual(storyboardFixture().scenes);
    expect(canSaveStoryboard(document)).toBe(true);
  });

  it('reads and writes tag lists as a comma separated field', () => {
    expect(parseTags(' upbeat ,  tech ,, ')).toEqual(['upbeat', 'tech']);
    expect(formatTags(['upbeat', 'tech'])).toBe('upbeat, tech');

    const document = setSceneTags(
      setStoryboardMusicTags(storyboardFixture(), 'calm, warm'),
      'scene-01',
      'sfxTags',
      'click',
    );

    expect(document.musicTags).toEqual(['calm', 'warm']);
    expect(document.scenes[0]?.sfxTags).toEqual(['click']);
  });

  it('edits one character of the sheet by id and leaves the others alone', () => {
    const document = setCharacterField(
      storyboardFixture(),
      'character-01',
      'visualDescription',
      'Woman in her thirties, green raincoat.',
    );

    expect(document.characters[0]?.visualDescription).toContain('green raincoat');
    expect(document.characters[0]?.name).toBe('Nina');
  });

  it('edits narration and prompt of one scene, addressed by id and never by position', () => {
    const document = setSceneText(
      setSceneText(storyboardFixture(), 'scene-02', 'narration', 'fzf te busca cualquier archivo.'),
      'scene-02',
      'visualPrompt',
      'Terminal close-up with a fuzzy finder.',
    );

    expect(document.scenes[1]?.narration).toBe('fzf te busca cualquier archivo.');
    expect(document.scenes[1]?.visualPrompt).toBe('Terminal close-up with a fuzzy finder.');
    expect(document.scenes[0]).toEqual(storyboardFixture().scenes[0]);
  });

  it('drops an optional key instead of writing an empty string into it', () => {
    const document = setSceneText(storyboardFixture(), 'scene-02', 'captionsStyle', '');

    expect('captionsStyle' in (document.scenes[1] ?? {})).toBe(false);
    expect(canSaveStoryboard(document)).toBe(true);
  });

  it('sets the estimated duration of a scene', () => {
    const document = setSceneDuration(storyboardFixture(), 'scene-01', 6000);

    expect(document.scenes[0]?.estimatedDurationMs).toBe(6000);
  });

  it('drops assetId and remotionScene when the visual source stops needing them', () => {
    const fromAsset = setSceneVisualSource(storyboardFixture(), 'scene-03', 'upload');
    const fromRemotion = setSceneVisualSource(storyboardFixture(), 'scene-02', 'upload');

    expect('assetId' in (fromAsset.scenes[2] ?? {})).toBe(false);
    expect('remotionScene' in (fromRemotion.scenes[1] ?? {})).toBe(false);
    expect(canSaveStoryboard(fromAsset)).toBe(true);
    expect(canSaveStoryboard(fromRemotion)).toBe(true);
  });

  it('seeds a valid Remotion scene when a scene starts using one', () => {
    const document = setSceneVisualSource(storyboardFixture(), 'scene-01', 'remotion-scene');

    expect(document.scenes[0]?.remotionScene).toEqual({ kind: 'title', title: 'Title' });
    expect(canSaveStoryboard(document)).toBe(true);
  });

  it('replaces the whole Remotion scene when its kind changes, so no prop of the old kind survives', () => {
    const document = setRemotionSceneKind(storyboardFixture(), 'scene-02', 'image-kenburns');

    expect(document.scenes[1]?.remotionScene).toEqual({
      kind: 'image-kenburns',
      zoomFrom: 1,
      zoomTo: 1.2,
    });
    expect(canSaveStoryboard(document)).toBe(true);
  });

  it('edits the props of a Remotion scene and drops an emptied subtitle', () => {
    const withTitle = setRemotionSceneKind(storyboardFixture(), 'scene-02', 'title');
    const withSubtitle = setRemotionSceneText(withTitle, 'scene-02', 'subtitle', 'Second line');
    const withoutSubtitle = setRemotionSceneText(withSubtitle, 'scene-02', 'subtitle', '');

    expect(withSubtitle.scenes[1]?.remotionScene?.subtitle).toBe('Second line');
    expect('subtitle' in (withoutSubtitle.scenes[1]?.remotionScene ?? {})).toBe(false);
    expect(canSaveStoryboard(withoutSubtitle)).toBe(true);
  });

  it('edits the two zoom factors of a Ken Burns scene', () => {
    const document = setRemotionSceneZoom(
      setRemotionSceneKind(storyboardFixture(), 'scene-02', 'image-kenburns'),
      'scene-02',
      'zoomTo',
      2.5,
    );

    expect(document.scenes[1]?.remotionScene?.zoomTo).toBe(2.5);
  });

  it('leaves a scene without a Remotion scene alone when asked to edit one', () => {
    const document = storyboardFixture();

    expect(setRemotionSceneKind(document, 'scene-01', 'text')).toEqual(document);
    expect(setRemotionSceneText(document, 'scene-01', 'text', 'hi')).toEqual(document);
    expect(setRemotionSceneZoom(document, 'scene-01', 'zoomFrom', 2)).toEqual(document);
  });
});
