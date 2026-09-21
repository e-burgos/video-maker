import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { producerBlockers, producerFailureKey } from '../api/producer-capability';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useProducerTurnPoll } from '../hooks/use-producer-turn-poll';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from '../components/error-notice';
import { ProducerComposer } from '../components/producer-composer';
import { ProducerMessageList } from '../components/producer-message-list';
import { ProducerTurnActivity } from '../components/producer-turn-activity';
import { ProducerWelcome } from '../components/producer-welcome';
import { hasProducerScript } from '../api/producer-recipes';
import type {
  AssetListing,
  ProducerConversation,
  RenderJobListing,
  GeneratedListing,
} from '../api/render-api-types';

function JobStrip({ listing }: { listing: RenderJobListing | null }) {
  const t = useT();
  const jobs = listing?.jobs ?? [];

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div data-testid="producer-jobs" className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
        {t('producer.jobsHeading')}
      </p>
      <ul className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <li
            key={job.id}
            data-job-kind={job.kind}
            data-job-state={job.state}
            className="rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-300"
          >
            {job.kind} · {job.state}
            {job.stage !== null && ` · ${job.stage}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProducerPage() {
  const client = useRenderApi();
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();

  const loadConversation = useCallback(() => client.getProducer(slug), [client, slug]);
  const loadAssets = useCallback(() => client.listAssets(slug), [client, slug]);
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const loadJobs = useCallback(() => client.listRenderJobs(slug), [client, slug]);
  const loadGenerated = useCallback(() => client.listGenerated(slug), [client, slug]);

  const conversation = useAsyncResource<ProducerConversation>(loadConversation, `producer:${slug}`);
  const assets = useAsyncResource<AssetListing>(loadAssets, `assets:${slug}`);
  const health = useAsyncResource(loadHealth, 'health');
  const jobs = useAsyncResource<RenderJobListing>(loadJobs, `jobs:${slug}`);
  const generated = useAsyncResource<GeneratedListing>(loadGenerated, `generated:${slug}`);
  const hasTimedScript = hasProducerScript(generated.data);

  const [draft, setDraft] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [turnId, setTurnId] = useState<string | null>(null);
  const adoptedActiveTurnRef = useRef<string | null>(null);
  const settledTurnRef = useRef<string | null>(null);

  const activeTurnId = conversation.data?.activeTurn?.turnId ?? null;
  useEffect(() => {
    if (activeTurnId !== null && adoptedActiveTurnRef.current !== activeTurnId) {
      adoptedActiveTurnRef.current = activeTurnId;
      setTurnId(activeTurnId);
    }
  }, [activeTurnId]);

  const loadTurn = useCallback(
    (currentTurnId: string) => client.getProducerTurn(slug, currentTurnId),
    [client, slug],
  );
  const poll = useProducerTurnPoll(turnId, loadTurn);

  const sendAction = useApiAction((text: string, chosenModel: string) =>
    client.sendProducerMessage(slug, text, chosenModel),
  );
  const cancelAction = useApiAction((currentTurnId: string) =>
    client.cancelProducerTurn(slug, currentTurnId),
  );

  const eventCount = poll.turn?.events.length ?? 0;
  const reloadJobs = jobs.reload;
  const reloadAssets = assets.reload;
  const reloadConversation = conversation.reload;

  useEffect(() => {
    if (poll.polling) {
      reloadJobs();
    }
  }, [eventCount, poll.polling, reloadJobs]);

  const settledTurnId = poll.stopReason === 'terminal' ? (poll.turn?.turnId ?? null) : null;
  useEffect(() => {
    if (settledTurnId !== null && settledTurnRef.current !== settledTurnId) {
      settledTurnRef.current = settledTurnId;
      reloadConversation();
      reloadAssets();
      reloadJobs();
    }
  }, [settledTurnId, reloadAssets, reloadConversation, reloadJobs]);

  const blockers = producerBlockers(health.data);
  const running = poll.polling;
  const models = conversation.data?.models.allowed ?? [];
  const sessionModel = conversation.data === null
    ? null
    : (conversation.data.session?.model ?? conversation.data.models.default);
  const selectedModel = model ?? sessionModel ?? '';

  useEffect(() => {
    if (model === null && sessionModel !== null) {
      setModel(sessionModel);
    }
  }, [model, sessionModel]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (trimmed === '' || running) {
      return;
    }

    const accepted = await sendAction.run(trimmed, selectedModel);
    if (accepted !== null) {
      setDraft('');
      setTurnId(accepted.turnId);
      adoptedActiveTurnRef.current = accepted.turnId;
      reloadConversation();
    }
  }

  async function cancel() {
    if (turnId !== null) {
      await cancelAction.run(turnId);
    }
  }

  const messages = conversation.data?.messages ?? [];
  const sendFailure = sendAction.error;
  const sendFailureKey = sendFailure === null ? null : producerFailureKey(sendFailure.code);

  return (
    <section className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
          {t('producer.backToProjects')}
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
          {t('producer.title', { slug })}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{t('producer.description')}</p>
      </div>

      {conversation.status === 'loading' && (
        <p className="text-sm text-slate-500">{t('producer.loading')}</p>
      )}

      {conversation.status === 'error' && conversation.error !== null && (
        <ErrorNotice error={conversation.error} onRetry={conversation.reload} />
      )}

      {conversation.data !== null && messages.length === 0 && (
        <ProducerWelcome slug={slug} assets={assets.data} onDraft={setDraft} hasTimedScript={hasTimedScript} />
      )}

      {messages.length > 0 && (
        <ProducerMessageList
          messages={messages}
          onQuickReply={(text) => void send(text)}
          quickRepliesDisabled={running || sendAction.status === 'pending'}
        />
      )}

      <ProducerTurnActivity
        turn={poll.turn}
        polling={poll.polling}
        error={poll.error}
        canceling={cancelAction.status === 'pending'}
        onCancel={() => void cancel()}
      />

      <JobStrip listing={jobs.data} />

      <ProducerComposer
        value={draft}
        onChange={setDraft}
        onSend={() => void send(draft)}
        pending={sendAction.status === 'pending' || running}
        blockers={blockers}
        models={models}
        model={selectedModel}
        onModelChange={setModel}
      />

      {sendFailure !== null && (
        <div data-testid="producer-send-failure" className="space-y-2">
          <ErrorNotice error={sendFailure} />
          {sendFailureKey !== null && (
            <p className="text-sm text-amber-200">{t(sendFailureKey)}</p>
          )}
        </div>
      )}

      {cancelAction.error !== null && <ErrorNotice error={cancelAction.error} />}
    </section>
  );
}
