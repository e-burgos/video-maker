import type {
  RemotionSceneKind,
  StoryboardDocument,
  StoryboardScene,
  VisualSource,
} from '@video-maker/timeline-core';

import {
  REMOTION_SCENE_KINDS,
  VISUAL_SOURCES,
  formatTags,
  setRemotionSceneKind,
  setRemotionSceneText,
  setRemotionSceneZoom,
  setSceneDuration,
  setSceneTags,
  setSceneText,
  setSceneVisualSource,
} from '../api/storyboard-edit/storyboard-document';
import type { RemotionSceneTextField } from '../api/storyboard-edit/storyboard-document';
import { useT } from '../i18n/language-context';
import { formatClock } from './storyboard/storyboard-model';
import type { SceneTiming } from './storyboard/storyboard-model';
import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_SMALL_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
  TEXTAREA_CLASS,
} from './ui/cl-controls';

const REMOTION_TEXT_FIELDS_BY_KIND: Readonly<Record<RemotionSceneKind, readonly RemotionSceneTextField[]>> =
  {
    title: ['title', 'subtitle'],
    text: ['text'],
    code: ['code', 'codeLanguage'],
    'image-kenburns': [],
  };

export type StoryboardSceneEditorProps = {
  storyboard: StoryboardDocument;
  scene: StoryboardScene;
  timing?: SceneTiming;
  onChange: (next: StoryboardDocument) => void;
  onCopyPrompt: (scene: StoryboardScene) => void;
};

const LABEL_CLASS = `flex flex-col gap-1 ${FIELD_LABEL_CLASS}`;

export function StoryboardSceneEditor({
  storyboard,
  scene,
  timing,
  onChange,
  onCopyPrompt,
}: StoryboardSceneEditorProps) {
  const t = useT();
  const remotionScene = scene.remotionScene;

  return (
    <section
      data-testid={`storyboard-scene-${scene.id}`}
      aria-label={t('storyboardScene.heading', { index: scene.index })}
      className="glass min-w-0 flex flex-col gap-4 rounded-[20px] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="m-0 text-base font-bold text-[var(--cl-ink)]">
            {t('storyboardScene.heading', { index: scene.index })}
          </h2>
          <span className="font-data truncate text-xs text-[var(--cl-ink-3)]">{scene.id}</span>
        </div>
        <div className="flex items-center gap-3">
          {timing !== undefined && (
            <span className="font-data text-xs text-[var(--cl-ink-2)]">
              {formatClock(timing.startMs)} – {formatClock(timing.endMs)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onCopyPrompt(scene)}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('storyboardScene.copyPrompt')}
          </button>
        </div>
      </div>

      <div className="grid gap-3 min-[1100px]:grid-cols-2">
        <label className={LABEL_CLASS}>
          {t('storyboardScene.narration', { sceneId: scene.id })}
          <textarea
            aria-label={t('storyboardScene.narration', { sceneId: scene.id })}
            rows={4}
            value={scene.narration}
            onChange={(event) =>
              onChange(setSceneText(storyboard, scene.id, 'narration', event.target.value))
            }
            className={TEXTAREA_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          {t('storyboardScene.visualPrompt', { sceneId: scene.id })}
          <textarea
            aria-label={t('storyboardScene.visualPrompt', { sceneId: scene.id })}
            rows={4}
            value={scene.visualPrompt}
            onChange={(event) =>
              onChange(setSceneText(storyboard, scene.id, 'visualPrompt', event.target.value))
            }
            className={TEXTAREA_CLASS}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL_CLASS}>
          {t('storyboardScene.visualSource', { sceneId: scene.id })}
          <select
            aria-label={t('storyboardScene.visualSource', { sceneId: scene.id })}
            value={scene.visualSource}
            onChange={(event) =>
              onChange(
                setSceneVisualSource(storyboard, scene.id, event.target.value as VisualSource),
              )
            }
            className={`${FIELD_SMALL_CLASS} font-data`}
          >
            {VISUAL_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          {t('storyboardScene.duration', { sceneId: scene.id })}
          <input
            inputMode="numeric"
            value={String(scene.estimatedDurationMs)}
            onChange={(event) =>
              onChange(setSceneDuration(storyboard, scene.id, Number(event.target.value)))
            }
            className={`${FIELD_SMALL_CLASS} font-data w-28`}
          />
        </label>

        {scene.visualSource === 'asset' && (
          <label className={LABEL_CLASS}>
            {t('storyboardScene.assetId', { sceneId: scene.id })}
            <input
              value={scene.assetId ?? ''}
              onChange={(event) =>
                onChange(setSceneText(storyboard, scene.id, 'assetId', event.target.value))
              }
              className={`${FIELD_SMALL_CLASS} font-data`}
            />
          </label>
        )}
      </div>

      {remotionScene !== undefined && (
        <div className="glass-sub flex flex-col gap-2 rounded-[14px] p-3">
          <label className={LABEL_CLASS}>
            {t('storyboardScene.remotionKind', { sceneId: scene.id })}
            <select
              aria-label={t('storyboardScene.remotionKind', { sceneId: scene.id })}
              value={remotionScene.kind}
              onChange={(event) =>
                onChange(
                  setRemotionSceneKind(storyboard, scene.id, event.target.value as RemotionSceneKind),
                )
              }
              className={`${FIELD_SMALL_CLASS} font-data w-48`}
            >
              {REMOTION_SCENE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>

          {REMOTION_TEXT_FIELDS_BY_KIND[remotionScene.kind].map((field) => (
            <label key={field} className={LABEL_CLASS}>
              {t('storyboardScene.field', { field, sceneId: scene.id })}
              <input
                value={remotionScene[field] ?? ''}
                onChange={(event) =>
                  onChange(setRemotionSceneText(storyboard, scene.id, field, event.target.value))
                }
                className={`${FIELD_SMALL_CLASS} font-data`}
              />
            </label>
          ))}

          {remotionScene.kind === 'image-kenburns' &&
            (['zoomFrom', 'zoomTo'] as const).map((field) => (
              <label key={field} className={LABEL_CLASS}>
                {t('storyboardScene.field', { field, sceneId: scene.id })}
                <input
                  inputMode="decimal"
                  value={String(remotionScene[field] ?? '')}
                  onChange={(event) =>
                    onChange(
                      setRemotionSceneZoom(storyboard, scene.id, field, Number(event.target.value)),
                    )
                  }
                  className={`${FIELD_SMALL_CLASS} font-data w-24`}
                />
              </label>
            ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={LABEL_CLASS}>
          {t('storyboardScene.captionStyle', { sceneId: scene.id })}
          <input
            value={scene.captionsStyle ?? ''}
            placeholder={storyboard.captionsStyle}
            onChange={(event) =>
              onChange(setSceneText(storyboard, scene.id, 'captionsStyle', event.target.value))
            }
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          {t('storyboardScene.musicTags', { sceneId: scene.id })}
          <input
            value={formatTags(scene.musicTags)}
            onChange={(event) =>
              onChange(setSceneTags(storyboard, scene.id, 'musicTags', event.target.value))
            }
            className={`${FIELD_CLASS} font-data`}
          />
        </label>

        <label className={LABEL_CLASS}>
          {t('storyboardScene.sfxTags', { sceneId: scene.id })}
          <input
            value={formatTags(scene.sfxTags)}
            onChange={(event) =>
              onChange(setSceneTags(storyboard, scene.id, 'sfxTags', event.target.value))
            }
            className={`${FIELD_CLASS} font-data`}
          />
        </label>
      </div>
    </section>
  );
}
