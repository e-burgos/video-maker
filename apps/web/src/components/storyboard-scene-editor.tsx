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
  onChange: (next: StoryboardDocument) => void;
  onCopyPrompt: (scene: StoryboardScene) => void;
};

function paddedIndex(index: number): string {
  return String(index).padStart(2, '0');
}

export function StoryboardSceneEditor({
  storyboard,
  scene,
  onChange,
  onCopyPrompt,
}: StoryboardSceneEditorProps) {
  const t = useT();
  const remotionScene = scene.remotionScene;

  return (
    <li
      data-testid={`storyboard-scene-${scene.id}`}
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-sm text-slate-300">
          {paddedIndex(scene.index)} · {scene.id}
        </h3>
        <button
          type="button"
          onClick={() => onCopyPrompt(scene)}
          className="rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-300 hover:border-slate-500"
        >
          {t('storyboardScene.copyPrompt')}
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('storyboardScene.narration', { sceneId: scene.id })}
        <textarea
          aria-label={t('storyboardScene.narration', { sceneId: scene.id })}
          rows={2}
          value={scene.narration}
          onChange={(event) =>
            onChange(setSceneText(storyboard, scene.id, 'narration', event.target.value))
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('storyboardScene.visualPrompt', { sceneId: scene.id })}
        <textarea
          aria-label={t('storyboardScene.visualPrompt', { sceneId: scene.id })}
          rows={3}
          value={scene.visualPrompt}
          onChange={(event) =>
            onChange(setSceneText(storyboard, scene.id, 'visualPrompt', event.target.value))
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('storyboardScene.visualSource', { sceneId: scene.id })}
          <select
            aria-label={t('storyboardScene.visualSource', { sceneId: scene.id })}
            value={scene.visualSource}
            onChange={(event) =>
              onChange(
                setSceneVisualSource(storyboard, scene.id, event.target.value as VisualSource),
              )
            }
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          >
            {VISUAL_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('storyboardScene.duration', { sceneId: scene.id })}
          <input
            inputMode="numeric"
            value={String(scene.estimatedDurationMs)}
            onChange={(event) =>
              onChange(setSceneDuration(storyboard, scene.id, Number(event.target.value)))
            }
            className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>

        {scene.visualSource === 'asset' && (
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            {t('storyboardScene.assetId', { sceneId: scene.id })}
            <input
              value={scene.assetId ?? ''}
              onChange={(event) =>
                onChange(setSceneText(storyboard, scene.id, 'assetId', event.target.value))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
            />
          </label>
        )}
      </div>

      {remotionScene !== undefined && (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            {t('storyboardScene.remotionKind', { sceneId: scene.id })}
            <select
              aria-label={t('storyboardScene.remotionKind', { sceneId: scene.id })}
              value={remotionScene.kind}
              onChange={(event) =>
                onChange(
                  setRemotionSceneKind(storyboard, scene.id, event.target.value as RemotionSceneKind),
                )
              }
              className="w-48 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
            >
              {REMOTION_SCENE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>

          {REMOTION_TEXT_FIELDS_BY_KIND[remotionScene.kind].map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs text-slate-400">
              {t('storyboardScene.field', { field, sceneId: scene.id })}
              <input
                value={remotionScene[field] ?? ''}
                onChange={(event) =>
                  onChange(setRemotionSceneText(storyboard, scene.id, field, event.target.value))
                }
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
              />
            </label>
          ))}

          {remotionScene.kind === 'image-kenburns' &&
            (['zoomFrom', 'zoomTo'] as const).map((field) => (
              <label key={field} className="flex flex-col gap-1 text-xs text-slate-400">
                {t('storyboardScene.field', { field, sceneId: scene.id })}
                <input
                  inputMode="decimal"
                  value={String(remotionScene[field] ?? '')}
                  onChange={(event) =>
                    onChange(
                      setRemotionSceneZoom(storyboard, scene.id, field, Number(event.target.value)),
                    )
                  }
                  className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
                />
              </label>
            ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('storyboardScene.captionStyle', { sceneId: scene.id })}
          <input
            value={scene.captionsStyle ?? ''}
            placeholder={storyboard.captionsStyle}
            onChange={(event) =>
              onChange(setSceneText(storyboard, scene.id, 'captionsStyle', event.target.value))
            }
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('storyboardScene.musicTags', { sceneId: scene.id })}
          <input
            value={formatTags(scene.musicTags)}
            onChange={(event) =>
              onChange(setSceneTags(storyboard, scene.id, 'musicTags', event.target.value))
            }
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('storyboardScene.sfxTags', { sceneId: scene.id })}
          <input
            value={formatTags(scene.sfxTags)}
            onChange={(event) =>
              onChange(setSceneTags(storyboard, scene.id, 'sfxTags', event.target.value))
            }
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>
      </div>
    </li>
  );
}
