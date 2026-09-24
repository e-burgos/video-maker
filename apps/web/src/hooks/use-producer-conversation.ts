import { useCallback, useEffect, useRef, useState } from 'react';

import { hasProducerScript } from '../api/producer-recipes';
import { producerBlockers, producerFailureKey } from '../api/producer-capability';
import { useRenderApi } from '../api/render-api-context';
import { useT } from '../i18n/language-context';
import { useApiAction } from './use-api-action';
import { useAsyncResource } from './use-async-resource';
import type { AsyncResource } from './use-async-resource';
import { useProducerTurnPoll } from './use-producer-turn-poll';
import type { ProducerTurnPoll } from './use-producer-turn-poll';
import type { Blocker } from '../api/blockers';
import type {
  AssetListing,
  GeneratedListing,
  ProducerConversation,
  ProducerEngineId,
  ProducerModelOption,
  ProducerSettings,
  RenderJobListing,
  ServiceHealth,
} from '../api/render-api-types';
import type { RenderApiError } from '../api/render-api-error';

export type UseProducerConversationResult = {
  slug: string;
  conversation: AsyncResource<ProducerConversation>;
  assets: AsyncResource<AssetListing>;
  health: AsyncResource<ServiceHealth>;
  jobs: AsyncResource<RenderJobListing>;
  generated: AsyncResource<GeneratedListing>;
  hasTimedScript: boolean;
  draft: string;
  setDraft: (value: string) => void;
  selectedModel: string;
  setModel: (model: string | null) => void;
  models: readonly ProducerModelOption[];
  effectiveEngine: ProducerEngineId | null;
  blockers: readonly Blocker[];
  running: boolean;
  send: (text: string) => Promise<void>;
  sendPending: boolean;
  sendFailure: RenderApiError | null;
  sendFailureKey: ReturnType<typeof producerFailureKey>;
  cancel: () => Promise<void>;
  cancelPending: boolean;
  cancelFailure: RenderApiError | null;
  poll: ProducerTurnPoll;
};

export function useProducerConversation(slug: string): UseProducerConversationResult {
  const client = useRenderApi();
  const t = useT();

  const loadConversation = useCallback(() => client.getProducer(slug), [client, slug]);
  const loadAssets = useCallback(() => client.listAssets(slug), [client, slug]);
  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const loadJobs = useCallback(() => client.listRenderJobs(slug), [client, slug]);
  const loadGenerated = useCallback(() => client.listGenerated(slug), [client, slug]);
  const loadProducerSettings = useCallback(() => client.getProducerSettings(), [client]);

  const conversation = useAsyncResource<ProducerConversation>(loadConversation, `producer:${slug}`);
  const assets = useAsyncResource<AssetListing>(loadAssets, `assets:${slug}`);
  const health = useAsyncResource(loadHealth, 'health');
  const jobs = useAsyncResource<RenderJobListing>(loadJobs, `jobs:${slug}`);
  const generated = useAsyncResource<GeneratedListing>(loadGenerated, `generated:${slug}`);
  const producerSettings = useAsyncResource<ProducerSettings>(loadProducerSettings, 'producer-settings');
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
  const effectiveEngine = producerSettings.data?.effectiveEngine ?? null;
  const recommendedOpenRouterModels = producerSettings.data?.engines.openrouter.models ?? [];
  const openRouterDefaultModel = producerSettings.data?.models.openrouter ?? null;
  const openRouterModelsForChat: ProducerModelOption[] =
    openRouterDefaultModel !== null &&
    !recommendedOpenRouterModels.some((option) => option.id === openRouterDefaultModel)
      ? [
          ...recommendedOpenRouterModels,
          { id: openRouterDefaultModel, label: openRouterDefaultModel, description: t('producer.model.yourChoice') },
        ]
      : recommendedOpenRouterModels;
  const engineModels: ProducerModelOption[] =
    effectiveEngine === 'claude-cli'
      ? (producerSettings.data?.engines.claudeCli.models ?? [])
      : effectiveEngine === 'openrouter'
        ? openRouterModelsForChat
        : (conversation.data?.models.allowed ?? []);
  const models = engineModels.length > 0 ? engineModels : (conversation.data?.models.allowed ?? []);
  const engineDefaultModel =
    effectiveEngine === 'claude-cli'
      ? (producerSettings.data?.models.claude ?? conversation.data?.models.default ?? null)
      : effectiveEngine === 'openrouter'
        ? (producerSettings.data?.models.openrouter ?? models[0]?.id ?? null)
        : (conversation.data?.models.default ?? null);
  const sessionModel =
    conversation.data === null ? null : (conversation.data.session?.model ?? engineDefaultModel);
  const selectedModel = model ?? sessionModel ?? '';

  useEffect(() => {
    if (model === null && sessionModel !== null) {
      setModel(sessionModel);
    }
  }, [model, sessionModel]);

  useEffect(() => {
    if (model !== null && models.length > 0 && !models.some((option) => option.id === model)) {
      setModel(null);
    }
  }, [model, models]);

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

  const sendFailure = sendAction.error;

  return {
    slug,
    conversation,
    assets,
    health,
    jobs,
    generated,
    hasTimedScript,
    draft,
    setDraft,
    selectedModel,
    setModel,
    models,
    effectiveEngine,
    blockers,
    running,
    send,
    sendPending: sendAction.status === 'pending',
    sendFailure,
    sendFailureKey: sendFailure === null ? null : producerFailureKey(sendFailure.code),
    cancel,
    cancelPending: cancelAction.status === 'pending',
    cancelFailure: cancelAction.error,
    poll,
  };
}
