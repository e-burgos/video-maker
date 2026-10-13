import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { formatFileSize } from '../api/generated-files';
import { formatDateTime } from '../api/format-updated-at';
import { useRenderApi } from '../api/render-api-context';
import {
  buildPublishInput,
  buildQueueInput,
  emptyPublishFormValues,
  formatPublishDuration,
  publishIssues,
} from '../api/youtube-publish-form';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useYouTubeIntegration } from '../hooks/use-youtube-integration';
import { useLanguage, useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { Badge } from './ui/badge';
import { PublishReviewNotice } from './publish-review-notice';
import { YouTubeMetadataFields } from './youtube-metadata-fields';
import { YouTubePublishProgress } from './youtube-publish-progress';
import { YouTubeVisibilityFields } from './youtube-visibility-fields';
import type { AssetListEntry } from '../api/render-api-types';
import type { YouTubePublishFormValues, YouTubePublishIssue } from '../api/youtube-publish-form';
import type { PublishQueueAddResult } from '../api/publish-queue-types';
import type { YouTubePublishOptions } from '../api/youtube-types';

export type YouTubePublishDialogProps = {
  slug: string;
  onClose: () => void;
  onPublished: () => void;
};

type Phase = 'form' | 'confirm' | 'job' | 'queued';

const ISSUE_MESSAGE: Readonly<Record<YouTubePublishIssue, TranslationKey>> = {
  fileMissing: 'youtube.publish.issue.fileMissing',
  titleEmpty: 'youtube.publish.issue.titleEmpty',
  titleTooLong: 'youtube.publish.issue.titleTooLong',
  descriptionTooLong: 'youtube.publish.issue.descriptionTooLong',
  tagsTooLong: 'youtube.publish.issue.tagsTooLong',
  scheduleMissing: 'youtube.publish.issue.scheduleMissing',
  scheduleNotFuture: 'youtube.publish.issue.scheduleNotFuture',
};

const SELECT_CLASS =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50';

const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-40';

const PRIMARY_BUTTON_CLASS =
  'rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40';

function NotConnectedNotice() {
  const t = useT();

  return (
    <div data-testid="youtube-not-connected" className="space-y-2">
      <p>{t('youtube.publish.notConnected')}</p>
      <Link to="/settings" className="text-sky-300 underline hover:text-sky-200">
        {t('youtube.publish.goToSettings')}
      </Link>
    </div>
  );
}

function SelectedFileSummary({ options, path }: { options: YouTubePublishOptions; path: string }) {
  const t = useT();
  const file = options.files.find((candidate) => candidate.path === path);

  if (file === undefined) {
    return null;
  }

  return (
    <p data-testid="youtube-file-summary" className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span>{formatPublishDuration(file.durationSec)}</span>
      <span>
        {file.width}×{file.height}
      </span>
      <span>{formatFileSize(file.sizeBytes)}</span>
      {file.isShort && <Badge tone="accent">{t('youtube.publish.short')}</Badge>}
    </p>
  );
}

export function YouTubePublishDialog({ slug, onClose, onPublished }: YouTubePublishDialogProps) {
  const client = useRenderApi();
  const t = useT();
  const { language } = useLanguage();
  const integration = useYouTubeIntegration();
  const connected = integration.data?.connected === true;
  const channelTitle = integration.data?.channel?.title ?? '';

  const loadOptions = useCallback(
    async () => (connected ? client.getYouTubePublishOptions(slug) : null),
    [client, slug, connected],
  );
  const options = useAsyncResource<YouTubePublishOptions | null>(loadOptions, `youtube-options:${slug}:${connected}`);
  const loadImages = useCallback(
    async (): Promise<AssetListEntry[]> =>
      connected ? (await client.listAssets(slug)).assets.filter((asset) => asset.role === 'image') : [],
    [client, slug, connected],
  );
  const images = useAsyncResource<AssetListEntry[]>(loadImages, `youtube-images:${slug}:${connected}`);

  const [edited, setEdited] = useState<YouTubePublishFormValues | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [jobId, setJobId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ignoreReview, setIgnoreReview] = useState(false);
  const [queued, setQueued] = useState<PublishQueueAddResult | null>(null);

  const optionsData = options.data;
  const initialValues = useMemo(
    () => emptyPublishFormValues(optionsData?.defaults.privacy ?? 'public', optionsData?.files[0]?.path ?? ''),
    [optionsData],
  );
  const values = edited ?? initialValues;

  const draft = useApiAction((file: string) => client.draftYouTubeMetadata(slug, file));
  const publish = useApiAction((input: ReturnType<typeof buildPublishInput>) =>
    client.createPublishJob(slug, input),
  );

  const enqueue = useApiAction((input: ReturnType<typeof buildQueueInput>) => client.addToPublishQueue(input));

  const patch = useCallback(
    (change: Partial<YouTubePublishFormValues>) => {
      setEdited((current) => ({ ...(current ?? initialValues), ...change }));
    },
    [initialValues],
  );

  const issues = publishIssues(values, new Date());
  const visibleIssues = issues.filter((issue) => issue !== 'titleEmpty' && issue !== 'fileMissing');
  const selectedFile = optionsData?.files.find((file) => file.path === values.file) ?? null;
  const reviewBlocksPublish = selectedFile?.reviewStatus === 'fail' && !ignoreReview;
  const canSubmit =
    issues.length === 0 && publish.status !== 'pending' && enqueue.status !== 'pending' && !reviewBlocksPublish;

  function close(): void {
    if (jobId !== null) {
      onPublished();
    }
    onClose();
  }

  async function proposeWithProducer() {
    const result = await draft.run(values.file);
    if (result !== null) {
      patch({ title: result.title, description: result.description, tags: result.tags });
    }
  }

  async function startUpload() {
    const job = await publish.run(buildPublishInput(values, ignoreReview && selectedFile?.reviewStatus === 'fail'));
    if (job !== null) {
      setJobId(job.id);
      setPhase('job');
    }
  }

  async function addToQueue() {
    const result = await enqueue.run(buildQueueInput(slug, values, ignoreReview && selectedFile?.reviewStatus === 'fail'));
    if (result !== null) {
      setQueued(result);
      setPhase('queued');
    }
  }

  function requestPublish(): void {
    if (values.privacy === 'public') {
      setPhase('confirm');
      return;
    }
    void startUpload();
  }

  function confirmationText(): string {
    const scheduledAt = values.scheduled ? Date.parse(values.publishAtLocal) : Number.NaN;
    return Number.isNaN(scheduledAt)
      ? t('youtube.publish.confirmPublic', { channel: channelTitle })
      : t('youtube.publish.confirmPublicScheduled', {
          channel: channelTitle,
          date: formatDateTime(scheduledAt, language),
        });
  }

  function reloadAll(): void {
    integration.reload();
    options.reload();
  }

  const loading = integration.status === 'loading' || (connected && options.status === 'loading');
  const loadError = integration.error ?? options.error;
  const formDisabled =
    draft.status === 'pending' || publish.status === 'pending' || enqueue.status === 'pending';
  const noFiles = optionsData !== null && optionsData.files.length === 0;

  let footer: ReactNode;
  if (phase === 'job' || phase === 'queued') {
    footer = (
      <button type="button" onClick={close} className={SECONDARY_BUTTON_CLASS}>
        {t('youtube.publish.close')}
      </button>
    );
  } else if (phase === 'confirm') {
    footer = (
      <>
        <button type="button" onClick={() => setPhase('form')} className={SECONDARY_BUTTON_CLASS}>
          {t('youtube.publish.back')}
        </button>
        <button
          type="button"
          data-testid="youtube-publish-confirm"
          disabled={publish.status === 'pending'}
          onClick={() => void startUpload()}
          className={PRIMARY_BUTTON_CLASS}
        >
          {publish.status === 'pending' ? t('youtube.publish.publishing') : t('youtube.publish.confirmAction')}
        </button>
      </>
    );
  } else {
    footer = (
      <>
        <button type="button" onClick={close} className={SECONDARY_BUTTON_CLASS}>
          {t('youtube.publish.cancel')}
        </button>
        <button
          type="button"
          data-testid="youtube-publish-queue"
          disabled={!connected || !canSubmit}
          onClick={() => void addToQueue()}
          className={SECONDARY_BUTTON_CLASS}
        >
          {enqueue.status === 'pending' ? t('youtube.publish.addingToQueue') : t('youtube.publish.addToQueue')}
        </button>
        <button
          type="button"
          data-testid="youtube-publish-submit"
          disabled={!connected || !canSubmit}
          onClick={requestPublish}
          className={PRIMARY_BUTTON_CLASS}
        >
          {t('youtube.publish.submit')}
        </button>
      </>
    );
  }

  return (
    <Modal title={t('youtube.publish.dialogTitle')} testId="youtube-publish-dialog" onClose={close} footer={footer} wide>
      {loading && <p className="text-slate-400">{t('youtube.publish.loading')}</p>}

      {!loading && loadError !== null && (
        <ErrorNotice error={loadError} onRetry={reloadAll} />
      )}

      {!loading && loadError === null && integration.data !== null && !connected && <NotConnectedNotice />}

      {!loading && connected && optionsData !== null && phase === 'form' && (
        <div className="space-y-4">
          {noFiles ? (
            <p data-testid="youtube-no-files" className="text-amber-300">
              {t('youtube.publish.noFiles')}
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400">{t('youtube.publish.channel', { channel: channelTitle })}</p>

              <div className="space-y-1">
                <label htmlFor="youtube-file" className="text-sm text-slate-400">
                  {t('youtube.publish.file')}
                </label>
                <select
                  id="youtube-file"
                  value={values.file}
                  disabled={formDisabled}
                  onChange={(event) => {
                    patch({ file: event.target.value });
                    setIgnoreReview(false);
                  }}
                  className={SELECT_CLASS}
                >
                  {optionsData.files.map((file) => (
                    <option key={file.path} value={file.path}>
                      {file.path} · {formatPublishDuration(file.durationSec)}
                    </option>
                  ))}
                </select>
                <SelectedFileSummary options={optionsData} path={values.file} />
              </div>

              {selectedFile !== null && selectedFile.reviewStatus !== null && selectedFile.reviewStatus !== 'pass' && (
                <PublishReviewNotice
                  slug={slug}
                  file={selectedFile.path}
                  status={selectedFile.reviewStatus}
                  ignoreReview={ignoreReview}
                  disabled={formDisabled}
                  onIgnoreReviewChange={setIgnoreReview}
                />
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="youtube-draft"
                  disabled={formDisabled || values.file === ''}
                  onClick={() => void proposeWithProducer()}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {draft.status === 'pending' ? t('youtube.publish.drafting') : t('youtube.publish.draft')}
                </button>
                {draft.status === 'pending' && (
                  <p role="status" className="text-xs text-slate-400">
                    {t('youtube.publish.draftingNote')}
                  </p>
                )}
                {draft.error !== null && <ErrorNotice error={draft.error} />}
              </div>

              <YouTubeMetadataFields values={values} disabled={formDisabled} onChange={patch} />
              <YouTubeVisibilityFields values={values} disabled={formDisabled} onChange={patch} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="youtube-playlist" className="text-sm text-slate-400">
                    {t('youtube.publish.playlist')}
                  </label>
                  <select
                    id="youtube-playlist"
                    value={values.playlistId}
                    disabled={formDisabled}
                    onChange={(event) => patch({ playlistId: event.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="">{t('youtube.publish.noPlaylist')}</option>
                    {optionsData.playlists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="youtube-thumbnail" className="text-sm text-slate-400">
                    {t('youtube.publish.thumbnail')}
                  </label>
                  <select
                    id="youtube-thumbnail"
                    value={values.thumbnail}
                    disabled={formDisabled}
                    onChange={(event) => patch({ thumbnail: event.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="">{t('youtube.publish.noThumbnail')}</option>
                    {(images.data ?? []).map((image) => (
                      <option key={image.path} value={image.path}>
                        {image.path}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visibleIssues.length > 0 && (
                <ul data-testid="youtube-publish-issues" className="space-y-0.5 text-xs text-amber-300">
                  {visibleIssues.map((issue) => (
                    <li key={issue}>{t(ISSUE_MESSAGE[issue])}</li>
                  ))}
                </ul>
              )}

              {publish.error !== null && <ErrorNotice error={publish.error} />}
              {enqueue.error !== null && <ErrorNotice error={enqueue.error} />}
            </>
          )}
        </div>
      )}

      {phase === 'confirm' && (
        <div className="space-y-3">
          <p data-testid="youtube-publish-confirm-text" className="text-slate-100">
            {confirmationText()}
          </p>
          {publish.error !== null && <ErrorNotice error={publish.error} />}
        </div>
      )}

      {phase === 'queued' && queued !== null && (
        <div data-testid="youtube-queued" className="space-y-3">
          <p className="text-slate-100">{t('youtube.publish.queued')}</p>
          {queued.alreadyPublished !== null && (
            <p data-testid="youtube-queued-already-published" role="alert" className="text-amber-300">
              {queued.alreadyPublished.url === null ? (
                t('youtube.publish.queuedAlreadyPublishedNoLink')
              ) : (
                <>
                  {t('youtube.publish.queuedAlreadyPublished')}{' '}
                  <a
                    href={queued.alreadyPublished.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline hover:text-amber-200"
                  >
                    {queued.alreadyPublished.url}
                  </a>
                </>
              )}
            </p>
          )}
          <Link to="/publish-queue" className="text-sky-300 underline hover:text-sky-200">
            {t('youtube.publish.goToQueue')}
          </Link>
        </div>
      )}

      {phase === 'job' && jobId !== null && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{t('youtube.publish.canClose')}</p>
          <YouTubePublishProgress
            key={attempt}
            jobId={jobId}
            onRetried={(job) => {
              setJobId(job.id);
              setAttempt((current) => current + 1);
            }}
            onSucceeded={onPublished}
          />
        </div>
      )}
    </Modal>
  );
}
