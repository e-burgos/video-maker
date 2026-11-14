import { producerCostLabel } from '../api/producer-cost-format';
import { numberedOptions, parseProducerMarkdown } from '../api/producer-markdown';
import type { ProducerBlock, ProducerInline, ProducerTableRow } from '../api/producer-markdown';
import type { ProducerMessage } from '../api/render-api-types';
import { useLanguage, useT } from '../i18n/language-context';

export type ProducerMessageListProps = {
  messages: readonly ProducerMessage[];
  onPickReply: (text: string) => void;
  quickRepliesDisabled: boolean;
};

function Inlines({ inlines }: { inlines: readonly ProducerInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.kind === 'bold') {
          return (
            <strong key={index} className="font-semibold">
              {inline.text}
            </strong>
          );
        }
        if (inline.kind === 'code') {
          return (
            <code
              key={index}
              className="font-data rounded bg-[color-mix(in_srgb,currentColor_12%,transparent)] px-1 py-0.5 text-[0.85em]"
            >
              {inline.text}
            </code>
          );
        }
        return <span key={index}>{inline.text}</span>;
      })}
    </>
  );
}

function Cells({ row, header }: { row: ProducerTableRow; header: boolean }) {
  return (
    <tr>
      {row.map((cell, index) =>
        header ? (
          <th
            key={index}
            className="border-b border-[var(--tucu-glass-sub-line)] px-2 py-1 text-left font-data text-[11px] uppercase tracking-wide opacity-75"
          >
            <Inlines inlines={cell} />
          </th>
        ) : (
          <td key={index} className="border-b border-[var(--tucu-glass-sub-line)] px-2 py-1 align-top">
            <Inlines inlines={cell} />
          </td>
        ),
      )}
    </tr>
  );
}

const HEADING_CLASS: Readonly<Record<number, string>> = {
  1: 'text-base font-semibold',
  2: 'text-sm font-semibold',
};

function Block({ block }: { block: ProducerBlock }) {
  if (block.kind === 'heading') {
    return (
      <p
        role="heading"
        aria-level={block.level}
        className={`pt-1 ${HEADING_CLASS[block.level] ?? 'text-sm font-semibold'}`}
      >
        <Inlines inlines={block.inlines} />
      </p>
    );
  }

  if (block.kind === 'rule') {
    return <hr className="border-[var(--tucu-glass-sub-line)]" />;
  }

  if (block.kind === 'code') {
    return (
      <pre
        data-language={block.language}
        className="whitespace-pre-wrap break-words font-data rounded-[10px] bg-[color-mix(in_srgb,currentColor_10%,transparent)] p-3 text-xs [overflow-wrap:anywhere]"
      >
        {block.text}
      </pre>
    );
  }

  if (block.kind === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <Cells row={block.header} header />
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <Cells key={index} row={row} header={false} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.kind === 'paragraph') {
    return (
      <p className="text-sm leading-relaxed">
        <Inlines inlines={block.inlines} />
      </p>
    );
  }

  const items = block.items.map((item, index) => (
    <li key={index} className="text-sm leading-relaxed">
      <Inlines inlines={item} />
    </li>
  ));

  return block.kind === 'bullets' ? (
    <ul className="ml-5 list-disc space-y-1">{items}</ul>
  ) : (
    <ol className="ml-5 list-decimal space-y-1">{items}</ol>
  );
}

export function ProducerMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseProducerMarkdown(text).map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

export function quickRepliesOf(message: ProducerMessage): string[] {
  const suggestions = message.suggestions ?? [];
  const options = numberedOptions(message.text).filter(
    (option) => !suggestions.includes(option),
  );
  return [...suggestions, ...options];
}

export function ProducerMessageList({
  messages,
  onPickReply,
  quickRepliesDisabled,
}: ProducerMessageListProps) {
  const t = useT();
  const { language } = useLanguage();
  const last = messages.length === 0 ? null : (messages[messages.length - 1] as ProducerMessage);
  const quickReplies = last !== null && last.role === 'assistant' ? quickRepliesOf(last) : [];

  return (
    <ol data-testid="producer-message-list" className="space-y-3">
      {messages.map((message) => (
        <li
          key={message.id}
          data-testid={`producer-message-${message.id}`}
          data-role={message.role}
          className={
            message.role === 'user'
              ? 'ml-auto w-fit max-w-[85%] rounded-[14px] bg-[var(--cl-action-fill)] px-3 py-2.5 text-white'
              : 'glass-sub max-w-[95%] rounded-[14px] px-3 py-2.5 text-[var(--cl-ink)]'
          }
        >
          <p className="sr-only">{message.role === 'user' ? t('producer.roleUser') : t('producer.roleAssistant')}</p>
          {message.model !== undefined && (
            <p className="mb-1">
              <span
                data-testid={`producer-message-model-${message.id}`}
                className="font-data rounded-full border border-[var(--tucu-glass-sub-line)] px-1.5 py-0.5 text-[10px] text-[var(--cl-ink-3)]"
              >
                {message.model}
              </span>
            </p>
          )}
          <ProducerMarkdown text={message.text} />
          {message.usage?.costUsd !== undefined && message.usage.costUsd !== null && (
            <p
              data-testid={`producer-message-cost-${message.id}`}
              className="font-data mt-1 text-[10px] text-[var(--cl-ink-3)]"
            >
              {producerCostLabel(t, language, message.usage.costUsd)}
            </p>
          )}
        </li>
      ))}

      {quickReplies.length > 0 && (
        <li data-testid="producer-suggestions" className="flex flex-wrap gap-2 pt-1">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={quickRepliesDisabled}
              onClick={() => onPickReply(reply)}
              className="focus-cl glass-thin rounded-full px-3 py-1.5 text-xs font-medium text-[var(--cl-ink)] hover:border-[var(--cl-ink-3)] disabled:opacity-40"
            >
              {reply}
            </button>
          ))}
        </li>
      )}
    </ol>
  );
}
