import { StateBadge } from '@e-burgos/tucu-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { draftFromBrief, draftToBrief, emptyBriefDraft, imageFileName } from '../api/motion-brief-form';
import type { BriefDraft } from '../api/motion-brief-form';
import { deliveredVideoOf, storedVideoOf } from '../api/motion-delivered-video';
import type { MotionBrief, MotionPhase, MotionStoryboard, MotionStoryboardReport } from '../api/motion-types';
import { useRenderApi } from '../api/render-api-context';
import { nullWhenMissing } from '../api/null-when-missing';
import type { Job } from '../api/render-api-types';
import { ErrorNotice } from '../components/error-notice';
import { MotionBriefForm } from '../components/motion-brief-form';
import { MotionJobStatus } from '../components/motion-job-status';
import { MotionSceneList } from '../components/motion-scene-list';
import { MotionBriefImages } from '../components/motion/motion-brief-images';
import { MotionDeliveredVideo } from '../components/motion/motion-delivered-video';
import type { DeliveredVideo } from '../components/motion/motion-delivered-video';
import { ToolbarStatus } from '../components/shell/toolbar-status';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import {
  PANEL_CLASS,
  PANEL_HEADING_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
  TOOLBAR_SECONDARY_BUTTON_CLASS,
} from '../components/ui/cl-controls';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';
import { LoadingState } from '../components/ui/status-states';

const BRIEF_NOT_FOUND = 'BRIEF_NOT_FOUND';
const STORYBOARD_NOT_FOUND = 'STORYBOARD_NOT_FOUND';
const OUTPUT_FILE = 'video.mp4';

export function MotionPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();

  const brands = useAsyncResource(
    useCallback(() => client.getMotionBrands(), [client]),
    'motion-brands',
  );
  const project = useAsyncResource(
    useCallback(() => client.getProject(slug), [client, slug]),
    `motion-project:${slug}`,
  );
  const brief = useAsyncResource<MotionBrief | null>(
    useCallback(() => nullWhenMissing(BRIEF_NOT_FOUND, () => client.getMotionBrief(slug)), [client, slug]),
    `motion-brief:${slug}`,
  );
  const storyboard = useAsyncResource<MotionStoryboard | null>(
    useCallback(
      () => nullWhenMissing(STORYBOARD_NOT_FOUND, () => client.getMotionStoryboard(slug)),
      [client, slug],
    ),
    `motion-storyboard:${slug}`,
  );
  const assets = useAsyncResource(
    useCallback(() => client.listAssets(slug), [client, slug]),
    `motion-assets:${slug}`,
  );

  const [draft, setDraft] = useState<BriefDraft | null>(null);
  const [scriptProblem, setScriptProblem] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edited, setEdited] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<MotionStoryboardReport | null>(null);
  const [delivery, setDelivery] = useState<DeliveredVideo | null>(null);
  const storedVideo = useAsyncResource<DeliveredVideo | null>(
    useCallback(() => storedVideoOf(client, slug), [client, slug]),
    `motion-stored-video:${slug}`,
  );
  const shownVideo = delivery ?? storedVideo.data ?? null;
  const phaseByJob = useRef(new Map<string, MotionPhase>());
  const handledJob = useRef<string | null>(null);

  const imageAssets = (assets.data?.assets ?? []).filter((asset) => asset.role === 'image');
  const imageFiles = imageAssets.map((asset) => imageFileName(asset.path));

  useEffect(() => {
    if (
      draft !== null ||
      brands.status !== 'ready' ||
      brief.status !== 'ready' ||
      project.status === 'loading' ||
      brands.data === null
    ) {
      return;
    }
    setDraft(
      brief.data === null
        ? emptyBriefDraft(brands.data, project.data?.brand ?? null)
        : draftFromBrief(brief.data),
    );
  }, [brands.data, brands.status, brief.data, brief.status, project.data, project.status, draft]);

  const poll = useRenderJobPoll(jobId, (id) => client.getRenderJob(id));
  const job = poll.job;
  const busy = jobId !== null && (poll.polling || job === null);

  const reloadStoryboard = storyboard.reload;
  useEffect(() => {
    if (job === null || job.kind !== 'motion' || job.state !== 'succeeded') {
      return;
    }
    if (handledJob.current === job.id) {
      return;
    }
    handledJob.current = job.id;
    reloadStoryboard();
    if (job.report?.storyboard) {
      setStats(job.report.storyboard);
    }
    const delivered = deliveredVideoOf(job.report);
    if (delivered !== null) {
      setDelivery(delivered);
    }
  }, [job, reloadStoryboard]);

  const saveAction = useApiAction((current: BriefDraft) =>
    client.putMotionBrief(slug, draftToBrief(current, imageFiles)),
  );
  const jobAction = useApiAction((phase: MotionPhase) =>
    client.createMotionJob(slug, {
      phase,
      overwrite: true,
      ...(phase === 'storyboard' ? {} : { output: OUTPUT_FILE }),
    }),
  );

  async function save(): Promise<boolean> {
    if (draft === null) {
      return false;
    }
    setSaved(false);
    if (draft.script.trim() === '') {
      setScriptProblem(true);
      return false;
    }
    setScriptProblem(false);
    const result = await saveAction.run(draft);
    setSaved(result !== null);
    if (result !== null) {
      setEdited(false);
    }
    return result !== null;
  }

  async function start(phase: MotionPhase) {
    if (!(await save())) {
      return;
    }
    const started = await jobAction.run(phase);
    if (started !== null) {
      phaseByJob.current.set(started.id, phase);
      setJobId(started.id);
    }
  }

  function changeDraft(next: BriefDraft) {
    setSaved(false);
    setEdited(true);
    setDraft(next);
  }

  function adoptRetried(retried: Job) {
    setJobId(retried.id);
  }

  const videoPhase: MotionPhase = storyboard.data === null ? 'all' : 'video';
  const loading =
    draft === null && (brands.status === 'loading' || brief.status === 'loading' || project.status === 'loading');
  const loadError = brands.error ?? (brief.status === 'error' ? brief.error : null);
  const saving = saveAction.status === 'pending';
  const briefReady = draft !== null && brands.data !== null;
  const briefState = edited ? 'unsaved' : saved || brief.data !== null ? 'saved' : null;

  useToolbarAction(
    briefReady
      ? {
          label: t('motion.video.make'),
          onClick: () => void start(videoPhase),
          disabled: busy,
          loading: busy,
        }
      : null,
  );

  return (
    <section data-testid="motion-page" className="flex flex-col gap-4">
      {briefReady && (
        <ToolbarStatus>
          {briefState !== null && (
            <span role="status" data-testid="motion-brief-state">
              <StateBadge tone={briefState === 'saved' ? 'green' : 'orange'} dot size="sm">
                {briefState === 'saved' ? t('motion.brief.saved') : t('edit.unsaved')}
              </StateBadge>
            </span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void start('storyboard')}
            className={`${TOOLBAR_SECONDARY_BUTTON_CLASS} ml-2`}
          >
            {t('motion.storyboard.make')}
          </button>
        </ToolbarStatus>
      )}

      {loading && <LoadingState message={t('motion.loading')} />}
      {loadError !== null && <ErrorNotice error={loadError} />}

      {draft !== null && brands.data !== null && (
        <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
          <section className={PANEL_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={PANEL_HEADING_CLASS}>{t('motion.brief.heading')}</h2>
              <Link
                to={`/projects/${encodeURIComponent(slug)}`}
                data-testid="motion-adjust-link"
                className={`${SECONDARY_BUTTON_SMALL_CLASS} no-underline`}
              >
                {t('motion.adjust.link')}
              </Link>
            </div>
            <MotionBriefForm
              draft={draft}
              brands={brands.data}
              scriptProblem={scriptProblem}
              onChange={changeDraft}
            />
            {saveAction.error !== null && <ErrorNotice error={saveAction.error} />}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy || saving}
                onClick={() => void save()}
                className={SECONDARY_BUTTON_SMALL_CLASS}
              >
                {saving ? t('motion.brief.saving') : t('motion.brief.save')}
              </button>
            </div>
          </section>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className={PANEL_CLASS}>
              <MotionBriefImages
                slug={slug}
                draft={draft}
                imageAssets={imageAssets}
                onChange={changeDraft}
                onImageUploaded={assets.reload}
              />
            </section>
            {storyboard.data !== null && (
              <section className={PANEL_CLASS}>
                <MotionSceneList storyboard={storyboard.data} stats={stats} />
              </section>
            )}
          </aside>
        </div>
      )}

      {jobAction.error !== null && <ErrorNotice error={jobAction.error} />}
      {job !== null && <MotionJobStatus job={job} onRetried={adoptRetried} />}
      {poll.error !== null && job === null && <ErrorNotice error={poll.error} />}

      {shownVideo !== null && <MotionDeliveredVideo slug={slug} video={shownVideo} />}
    </section>
  );
}
