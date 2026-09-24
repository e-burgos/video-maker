import type { UseProducerConversationResult } from '../hooks/use-producer-conversation';
import { useT } from '../i18n/language-context';
import { ChatDropZonePlaceholder } from './chat-drop-zone-placeholder';
import { ErrorNotice } from './error-notice';
import { ProducerComposer } from './producer-composer';
import { ProducerMessageList } from './producer-message-list';
import { ProducerTurnActivity } from './producer-turn-activity';
import { ProducerWelcome } from './producer-welcome';

export type ProducerConversationPanelProps = {
  producer: UseProducerConversationResult;
};

export function ProducerConversationPanel({ producer }: ProducerConversationPanelProps) {
  const t = useT();
  const {
    slug,
    conversation,
    assets,
    hasTimedScript,
    draft,
    setDraft,
    send,
    running,
    sendPending,
    sendFailure,
    sendFailureKey,
    poll,
    cancel,
    cancelPending,
    cancelFailure,
    blockers,
    models,
    selectedModel,
    setModel,
    effectiveEngine,
  } = producer;

  const messages = conversation.data?.messages ?? [];

  return (
    <div data-testid="producer-conversation-panel" className="space-y-4">
      {conversation.status === 'loading' && (
        <p className="text-sm text-ink-faint">{t('producer.loading')}</p>
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
          quickRepliesDisabled={running || sendPending}
        />
      )}

      <ProducerTurnActivity
        turn={poll.turn}
        polling={poll.polling}
        error={poll.error}
        canceling={cancelPending}
        onCancel={() => void cancel()}
      />

      <ChatDropZonePlaceholder />

      <ProducerComposer
        value={draft}
        onChange={setDraft}
        onSend={() => void send(draft)}
        pending={sendPending || running}
        blockers={blockers}
        models={models}
        model={selectedModel}
        onModelChange={setModel}
        activeEngine={effectiveEngine}
      />

      {sendFailure !== null && (
        <div data-testid="producer-send-failure" className="space-y-2">
          <ErrorNotice error={sendFailure} />
          {sendFailureKey !== null && <p className="text-sm text-warning">{t(sendFailureKey)}</p>}
        </div>
      )}

      {cancelFailure !== null && <ErrorNotice error={cancelFailure} />}
    </div>
  );
}
