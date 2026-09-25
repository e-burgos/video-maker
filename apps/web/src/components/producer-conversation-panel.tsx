import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { useInboxUploads } from '../hooks/use-inbox-uploads';
import type { UseProducerConversationResult } from '../hooks/use-producer-conversation';
import { useStickToBottom } from '../hooks/use-stick-to-bottom';
import { useT } from '../i18n/language-context';
import { AssetProposalCard } from './asset-proposal-card';
import { ChatDropZone } from './chat-drop-zone';
import { ErrorNotice } from './error-notice';
import { ProducerComposer } from './producer-composer';
import { ProducerMessageList } from './producer-message-list';
import { ProducerTurnActivity } from './producer-turn-activity';
import { ProducerWelcome } from './producer-welcome';
import type { AssetRole } from '../api/render-api-types';

export type ProducerConversationPanelProps = {
  producer: UseProducerConversationResult;
  pinned?: boolean;
};

export function ProducerConversationPanel({ producer, pinned = false }: ProducerConversationPanelProps) {
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
  const inbox = useInboxUploads(slug);
  const pendingAssets = inbox.pending.data?.assets ?? [];
  const visibleUploads = inbox.uploads.filter((entry) => entry.status !== 'done');

  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const { scrollRef, contentRef, onScroll } = useStickToBottom<HTMLDivElement, HTMLDivElement>(
    messages.length > 0,
  );

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragActive(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (event.dataTransfer.files.length > 0) {
      void inbox.uploadFiles(event.dataTransfer.files);
    }
  }

  async function confirmAsset(assetId: string, role: AssetRole) {
    await inbox.confirm(assetId, role);
    assets.reload();
  }

  return (
    <div
      data-testid="producer-conversation-panel"
      className={`relative ${pinned ? 'flex h-full min-h-0 flex-col' : 'space-y-4'}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive && (
        <div
          data-testid="chat-drop-overlay"
          className="absolute inset-0 z-20 flex items-center justify-center rounded-panel border-2 border-dashed border-accent bg-surface/90 text-sm font-medium text-accent-strong"
        >
          {t('workspace.dropOverlay')}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={pinned ? 'min-h-0 flex-1 overflow-y-auto pr-1' : ''}
      >
        <div ref={contentRef} className="space-y-4">
          {conversation.status === 'loading' && (
            <p className="text-sm text-ink-faint">{t('producer.loading')}</p>
          )}

          {conversation.status === 'error' && conversation.error !== null && (
            <ErrorNotice error={conversation.error} onRetry={conversation.reload} />
          )}

          {conversation.data !== null && messages.length === 0 && (
            <ProducerWelcome
              slug={slug}
              assets={assets.data}
              onDraft={setDraft}
              hasTimedScript={hasTimedScript}
              compact={pendingAssets.length > 0}
            />
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
        </div>
      </div>

      <div className={pinned ? 'shrink-0 space-y-2 pt-3' : 'space-y-2'}>
        {pendingAssets.length > 0 && (
          <div
            data-testid="asset-proposal-list"
            className="max-h-64 space-y-2 overflow-y-auto"
          >
            {pendingAssets.map((asset) => (
              <AssetProposalCard
                key={asset.id}
                slug={slug}
                asset={asset}
                onConfirm={confirmAsset}
                onDiscard={inbox.discard}
              />
            ))}
          </div>
        )}

        {visibleUploads.length > 0 && (
          <ul data-testid="inbox-upload-list" className="space-y-1">
            {visibleUploads.map((entry) => (
              <li
                key={entry.id}
                data-testid="inbox-upload-entry"
                data-status={entry.status}
                className="flex items-center justify-between gap-2 rounded-control border border-border-subtle px-2 py-1 text-xs text-ink-faint"
              >
                {entry.status === 'uploading' && (
                  <span>{t('inbox.upload.uploading', { fileName: entry.fileName })}</span>
                )}
                {entry.status === 'error' && (
                  <span className="text-danger">
                    {entry.errorCode === 'UNSUPPORTED_MEDIA_TYPE'
                      ? t('inbox.upload.unsupported', { fileName: entry.fileName })
                      : t('inbox.upload.failed', { fileName: entry.fileName, code: entry.errorCode ?? '' })}
                  </span>
                )}
                {entry.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => inbox.dismissUpload(entry.id)}
                    className="shrink-0 text-ink-faint underline"
                  >
                    {t('inbox.upload.dismiss')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <ChatDropZone onFiles={(files) => void inbox.uploadFiles(files)} />

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
    </div>
  );
}
