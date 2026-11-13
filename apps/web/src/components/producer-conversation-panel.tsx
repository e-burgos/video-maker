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
import { ProposalCard } from './proposal-card';
import type { AssetRole } from '../api/render-api-types';

export type ProducerConversationPanelProps = {
  producer: UseProducerConversationResult;
  pinned?: boolean;
  mode?: 'footage' | 'motion';
};

export function ProducerConversationPanel({ producer, pinned = false, mode = 'footage' }: ProducerConversationPanelProps) {
  const t = useT();
  const {
    slug,
    conversation,
    assets,
    proposal,
    materialReview,
    hasTimedScript,
    draft,
    setDraft,
    submit,
    queuedMessage,
    cancelQueued,
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

  const firstUse = conversation.data !== null && messages.length === 0;
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
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

  function uploadDroppedFiles(files: FileList) {
    void inbox.uploadFiles(files);
  }

  function pickReply(text: string) {
    setDraft(text);
    composerRef.current?.focus();
  }

  async function confirmAsset(assetId: string, role: AssetRole) {
    await inbox.confirm(assetId, role);
    assets.reload();
  }

  return (
    <div
      data-testid="producer-conversation-panel"
      className={`glass relative min-w-0 rounded-[20px] p-4 ${pinned ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4'}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive && (
        <div
          data-testid="chat-drop-overlay"
          className="absolute inset-0 z-20 flex items-center justify-center rounded-[20px] border-2 border-dashed border-[var(--cl-action)] bg-[var(--tucu-glass-thick-bg)] text-sm font-semibold text-[var(--cl-action-text)]"
        >
          {t('workspace.dropOverlay')}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={pinned ? 'relative min-h-0 flex-1 overflow-y-auto pr-1' : 'relative'}
      >
        <div ref={contentRef} className="space-y-4">
          {conversation.status === 'loading' && (
            <p className="text-sm text-[var(--cl-ink-2)]">{t('producer.loading')}</p>
          )}

          {conversation.status === 'error' && conversation.error !== null && (
            <ErrorNotice surface="glass" error={conversation.error} onRetry={conversation.reload} />
          )}

          {firstUse && (
            <ProducerWelcome
              slug={slug}
              assets={assets.data}
              onDraft={setDraft}
              hasTimedScript={hasTimedScript}
              compact={pendingAssets.length > 0}
              mode={mode}
            />
          )}

          {messages.length > 0 && (
            <ProducerMessageList
              messages={messages}
              onPickReply={pickReply}
              quickRepliesDisabled={running || sendPending}
            />
          )}

          <ProposalCard slug={slug} proposal={proposal} materialReview={materialReview} />

          <ProducerTurnActivity
            turn={poll.turn}
            polling={poll.polling}
            error={poll.error}
            canceling={cancelPending}
            onCancel={() => void cancel()}
          />
        </div>
      </div>

      <div className={pinned ? 'shrink-0 space-y-2' : 'space-y-2'}>
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
                mode={mode}
                requestText={draft}
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
                className="glass-sub flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-xs text-[var(--cl-ink-2)]"
              >
                {entry.status === 'uploading' && (
                  <span>{t('inbox.upload.uploading', { fileName: entry.fileName })}</span>
                )}
                {entry.status === 'error' && (
                  <span className="text-[var(--tucu-state-red-ink)]">
                    {entry.errorCode === 'UNSUPPORTED_MEDIA_TYPE'
                      ? t('inbox.upload.unsupported', { fileName: entry.fileName })
                      : t('inbox.upload.failed', { fileName: entry.fileName, code: entry.errorCode ?? '' })}
                  </span>
                )}
                {entry.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => inbox.dismissUpload(entry.id)}
                    className="focus-cl shrink-0 rounded text-[var(--cl-ink-2)] underline"
                  >
                    {t('inbox.upload.dismiss')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {queuedMessage !== null && (
          <div
            data-testid="producer-queued-message"
            className="space-y-1 rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-2.5 text-xs"
          >
            <p className="text-[var(--tucu-state-orange-ink)]">{t('producer.queued.notice')}</p>
            {queuedMessage.replaced && <p className="text-[var(--cl-ink-2)]">{t('producer.queued.replaced')}</p>}
            <p className="whitespace-pre-wrap text-[var(--cl-ink)]">
              <span className="font-medium">{t('producer.queued.label')}: </span>
              {queuedMessage.text}
            </p>
            <button type="button" onClick={cancelQueued} className="focus-cl rounded text-[var(--cl-ink-2)] underline">
              {t('producer.queued.cancel')}
            </button>
          </div>
        )}

        {firstUse && <ChatDropZone onFiles={uploadDroppedFiles} />}

        <ProducerComposer
          value={draft}
          onChange={setDraft}
          textareaRef={composerRef}
          onSend={() => submit(draft)}
          pending={sendPending}
          busy={running}
          blockers={blockers}
          models={models}
          model={selectedModel}
          onModelChange={setModel}
          activeEngine={effectiveEngine}
          placeholder={mode === 'motion' ? t('producer.composerPlaceholderMotion') : undefined}
          attachment={firstUse ? undefined : <ChatDropZone compact onFiles={uploadDroppedFiles} />}
        />

        {sendFailure !== null && (
          <div data-testid="producer-send-failure" className="space-y-2">
            <ErrorNotice surface="glass" error={sendFailure} />
            {sendFailureKey !== null && <p className="text-sm text-[var(--tucu-state-orange-ink)]">{t(sendFailureKey)}</p>}
          </div>
        )}

        {cancelFailure !== null && <ErrorNotice surface="glass" error={cancelFailure} />}
      </div>
    </div>
  );
}
