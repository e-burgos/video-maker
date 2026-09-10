import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StoryboardDocument, StoryboardScene } from '@video-maker/timeline-core';

import { copyToClipboard } from '../api/clipboard';
import { parseStoryboardDocument } from '../api/parse-storyboard';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { ErrorNotice } from '../components/error-notice';
import { StoryboardCharacterSheet } from '../components/storyboard-character-sheet';
import { StoryboardHeaderEditor } from '../components/storyboard-header-editor';
import { StoryboardJobPanel } from '../components/storyboard-job-panel';
import { StoryboardPromptSheet } from '../components/storyboard-prompt-sheet';
import { StoryboardSaveBar } from '../components/storyboard-save-bar';
import { StoryboardSceneEditor } from '../components/storyboard-scene-editor';
import { StoryboardTrigger } from '../components/storyboard-trigger';

export const STORYBOARD_NOT_FOUND = 'STORYBOARD_NOT_FOUND';

type StoryboardEmptyStateProps = {
  slug: string;
};

function StoryboardEmptyState({ slug }: StoryboardEmptyStateProps) {
  return (
    <div
      data-testid="storyboard-empty-state"
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <p className="text-sm text-slate-300">
        <span className="font-mono text-slate-100">{slug}</span> has no storyboard yet.
      </p>
      <p className="text-sm text-slate-400">
        Describe the video you want above and the local AI agent writes the script, the character
        sheet and one visual prompt per scene.
      </p>
    </div>
  );
}

export function StoryboardPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(
    async () => parseStoryboardDocument(await client.getStoryboard(slug)),
    [client, slug],
  );
  const stored = useAsyncResource<StoryboardDocument>(load, `storyboard:${slug}`);

  const [jobId, setJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoryboardDocument | null>(null);
  const [saved, setSaved] = useState<StoryboardDocument | null>(null);
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);

  const baseline = saved ?? stored.data;
  const storyboard = draft ?? baseline;
  const dirty = draft !== null && baseline !== null && JSON.stringify(draft) !== JSON.stringify(baseline);

  const reload = useCallback(() => {
    setDraft(null);
    setSaved(null);
    stored.reload();
  }, [stored]);

  async function copyScenePrompt(scene: StoryboardScene) {
    const copied = await copyToClipboard(scene.visualPrompt);
    setCopiedSceneId(copied ? scene.id : null);
  }

  const missing =
    stored.status === 'error' && stored.error?.code === STORYBOARD_NOT_FOUND && saved === null;

  return (
    <section className="space-y-6">
      <div>
        <Link to={`/projects/${slug}`} className="text-xs text-slate-500 hover:text-slate-300">
          ← asset library
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">{slug} · storyboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          The generative mode: an idea or a script becomes a storyboard, and every scene carries the
          prompt you paste into an external tool to produce its footage.
        </p>
      </div>

      <StoryboardTrigger slug={slug} onCreated={(job) => setJobId(job.id)} />

      <StoryboardJobPanel jobId={jobId} onSucceeded={reload} />

      {stored.status === 'loading' && <p className="text-sm text-slate-500">Loading storyboard…</p>}

      {missing && <StoryboardEmptyState slug={slug} />}

      {stored.status === 'error' && stored.error !== null && !missing && (
        <ErrorNotice error={stored.error} onRetry={reload} />
      )}

      {storyboard !== null && (
        <>
          <StoryboardSaveBar
            slug={slug}
            storyboard={storyboard}
            dirty={dirty}
            onSaved={(next) => {
              setSaved(next);
              setDraft(null);
            }}
          />

          <StoryboardHeaderEditor storyboard={storyboard} onChange={setDraft} />

          <StoryboardCharacterSheet storyboard={storyboard} onChange={setDraft} />

          <div className="space-y-3">
            <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
              scenes <span className="text-slate-600">({storyboard.scenes.length})</span>
            </h2>
            {copiedSceneId !== null && (
              <p data-testid="storyboard-scene-copied" className="text-xs text-emerald-300">
                Prompt of {copiedSceneId} copied to the clipboard.
              </p>
            )}
            <ul className="space-y-3">
              {storyboard.scenes.map((scene) => (
                <StoryboardSceneEditor
                  key={scene.id}
                  storyboard={storyboard}
                  scene={scene}
                  onChange={setDraft}
                  onCopyPrompt={(target) => void copyScenePrompt(target)}
                />
              ))}
            </ul>
          </div>

          <StoryboardPromptSheet slug={slug} dirty={dirty} />
        </>
      )}
    </section>
  );
}
