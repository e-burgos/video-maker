import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { artifactUrl } from '../api/artifact-url';
import { humanizeSlug } from '../api/humanize-slug';
import { draftFromBrief, draftToBrief, emptyBriefDraft, imageFileName } from '../api/motion-brief-form';
import type { BriefDraft } from '../api/motion-brief-form';
import type {
  MotionBrief,
  MotionJobReport,
  MotionPhase,
  MotionStoryboard,
  MotionStoryboardReport,
} from '../api/motion-types';
import { useRenderApi } from '../api/render-api-context';
import { nullWhenMissing } from '../api/null-when-missing';
import type { Job } from '../api/render-api-types';
import { ErrorNotice } from '../components/error-notice';
import { MotionBriefForm } from '../components/motion-brief-form';
import { MotionJobStatus } from '../components/motion-job-status';
import { MotionSceneList } from '../components/motion-scene-list';
import { Button } from '../components/ui/button';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useRenderJobPoll } from '../hooks/use-render-job-poll';
import { useT } from '../i18n/language-context';

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
  const [jobId, setJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<MotionStoryboardReport | null>(null);
  const [delivery, setDelivery] = useState<MotionJobReport | null>(null);
  const phaseByJob = useRef(new Map<string, MotionPhase>());
  const handledJob = useRef<string | null>(null);

  const imageAssets = (assets.data?.assets ?? []).filter((asset) => asset.role === 'image');
  const imageFiles = imageAssets.map((asset) => imageFileName(asset.path));

  useEffect(() => {
    if (draft !== null || brands.status !== 'ready' || brief.status !== 'ready' || brands.data === null) {
      return;
    }
    setDraft(brief.data === null ? emptyBriefDraft(brands.data) : draftFromBrief(brief.data));
  }, [brands.data, brands.status, brief.data, brief.status, draft]);

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
    if (job.report !== null && phaseByJob.current.get(job.id) !== 'storyboard') {
      setDelivery(job.report);
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

  function adoptRetried(retried: Job) {
    setJobId(retried.id);
  }

  const videoPhase: MotionPhase = storyboard.data === null ? 'all' : 'video';
  const loading = draft === null && (brands.status === 'loading' || brief.status === 'loading');
  const loadError = brands.error ?? (brief.status === 'error' ? brief.error : null);

  return (
    <section data-testid="motion-page" className="space-y-6">
      <header className="space-y-2">
        <Link to="/" className="text-xs text-ink-faint hover:text-ink-muted">
          {t('motion.back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('motion.page.title')}</h1>
        <p className="font-mono text-xs text-ink-faint">{humanizeSlug(slug)}</p>
      </header>

      {loading && <p className="text-sm text-ink-faint">{t('motion.loading')}</p>}
      {loadError !== null && <ErrorNotice error={loadError} />}

      {draft !== null && brands.data !== null && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-ink">{t('motion.brief.heading')}</h2>
          <MotionBriefForm
            slug={slug}
            draft={draft}
            brands={brands.data}
            imageAssets={imageAssets}
            scriptProblem={scriptProblem}
            onChange={(next) => {
              setSaved(false);
              setDraft(next);
            }}
            onImageUploaded={assets.reload}
          />

          {saveAction.error !== null && <ErrorNotice error={saveAction.error} />}
          {saved && (
            <p role="status" className="text-sm text-success">
              {t('motion.brief.saved')}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button disabled={busy || saveAction.status === 'pending'} onClick={() => void save()}>
              {saveAction.status === 'pending' ? t('motion.brief.saving') : t('motion.brief.save')}
            </Button>
            <Button disabled={busy} onClick={() => void start('storyboard')}>
              {t('motion.storyboard.make')}
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void start(videoPhase)}>
              {t('motion.video.make')}
            </Button>
          </div>
        </div>
      )}

      {jobAction.error !== null && <ErrorNotice error={jobAction.error} />}
      {job !== null && <MotionJobStatus job={job} onRetried={adoptRetried} />}
      {poll.error !== null && job === null && <ErrorNotice error={poll.error} />}

      {storyboard.data !== null && <MotionSceneList storyboard={storyboard.data} stats={stats} />}

      {delivery !== null && (
        <div data-testid="motion-video" className="space-y-2">
          <h2 className="text-sm font-medium text-ink">{t('motion.video.heading')}</h2>
          <video
            src={artifactUrl(slug, delivery.path)}
            controls
            preload="metadata"
            className="w-full max-w-3xl rounded-control bg-black"
          />
          <p className="font-mono text-xs text-ink-faint">
            {t('motion.video.path', { path: delivery.path, duration: delivery.durationSec })}
          </p>
        </div>
      )}
    </section>
  );
}
