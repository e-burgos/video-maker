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
import type { RenderApiClient } from '../api/render-api-client';
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

type DeliveredVideo = { path: string; durationSec: number | null; musicCredit: string | null };

const OUTPUT_PREFIX = 'out/';
const VIDEO_EXTENSION = '.mp4';
const CREDITS_EXTENSION = '.credits.txt';
const CREDIT_LABEL = /^Música:\s*/u;

async function storedVideoOf(client: RenderApiClient, slug: string): Promise<DeliveredVideo | null> {
  const listing = await client.listGenerated(slug);
  const newest = listing.files
    .filter((file) => file.path.startsWith(OUTPUT_PREFIX) && file.path.endsWith(VIDEO_EXTENSION))
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs)[0];
  if (newest === undefined) return null;
  const creditsPath = `${newest.path.slice(0, -VIDEO_EXTENSION.length)}${CREDITS_EXTENSION}`;
  const hasCredits = listing.files.some((file) => file.path === creditsPath);
  const musicCredit = hasCredits ? (await client.getProjectFile(slug, creditsPath)).trim().replace(CREDIT_LABEL, '') : null;
  return { path: newest.path, durationSec: null, musicCredit };
}

function deliveredVideoOf(report: MotionJobReport | null): DeliveredVideo | null {
  return report !== null && report.path !== null ? { path: report.path, durationSec: report.durationSec, musicCredit: report.musicCredit ?? null } : null;
}

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
        <Link
          to={`/projects/${encodeURIComponent(slug)}`}
          data-testid="motion-adjust-link"
          className="inline-block rounded-control border border-accent px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          {t('motion.adjust.link')}
        </Link>
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

      {shownVideo !== null && (
        <div data-testid="motion-video" className="space-y-2">
          <h2 className="text-sm font-medium text-ink">{t('motion.video.heading')}</h2>
          <video
            src={artifactUrl(slug, shownVideo.path)}
            controls
            preload="metadata"
            className="w-full max-w-3xl rounded-control bg-black"
          />
          <p className="font-mono text-xs text-ink-faint">
            {shownVideo.durationSec === null ? shownVideo.path : t('motion.video.path', { path: shownVideo.path, duration: shownVideo.durationSec })}
          </p>
          {shownVideo.musicCredit !== null && (
            <p data-testid="motion-music-credit" className="text-xs text-ink-muted">
              {t('motion.video.credit', { credit: shownVideo.musicCredit })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
