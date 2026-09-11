import { numberedOptions, parseProducerMarkdown } from '../api/producer-markdown';
import type { ProducerBlock, ProducerInline, ProducerTableRow } from '../api/producer-markdown';
import type { ProducerMessage } from '../api/render-api-types';
import { useT } from '../i18n/language-context';

export type ProducerMessageListProps = {
  messages: readonly ProducerMessage[];
  onQuickReply: (text: string) => void;
  quickRepliesDisabled: boolean;
};

function Inlines({ inlines }: { inlines: readonly ProducerInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.kind === 'bold') {
          return (
            <strong key={index} className="font-semibold text-slate-50">
              {inline.text}
            </strong>
          );
        }
        if (inline.kind === 'code') {
          return (
            <code
              key={index}
              className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.85em] text-sky-200"
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
            className="border-b border-slate-700 px-2 py-1 text-left font-mono text-[11px] uppercase tracking-wide text-slate-400"
          >
            <Inlines inlines={cell} />
          </th>
        ) : (
          <td key={index} className="border-b border-slate-800/60 px-2 py-1 align-top">
            <Inlines inlines={cell} />
          </td>
        ),
      )}
    </tr>
  );
}

const HEADING_CLASS: Readonly<Record<number, string>> = {
  1: 'text-base font-semibold text-slate-50',
  2: 'text-sm font-semibold text-slate-50',
};

function Block({ block }: { block: ProducerBlock }) {
  if (block.kind === 'heading') {
    return (
      <p
        role="heading"
        aria-level={block.level}
        className={`pt-1 ${HEADING_CLASS[block.level] ?? 'text-sm font-semibold text-slate-200'}`}
      >
        <Inlines inlines={block.inlines} />
      </p>
    );
  }

  if (block.kind === 'rule') {
    return <hr className="border-slate-800" />;
  }

  if (block.kind === 'code') {
    return (
      <pre
        data-language={block.language}
        className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300"
      >
        {block.text}
      </pre>
    );
  }

  if (block.kind === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm text-slate-200">
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
      <p className="text-sm leading-relaxed text-slate-200">
        <Inlines inlines={block.inlines} />
      </p>
    );
  }

  const items = block.items.map((item, index) => (
    <li key={index} className="text-sm leading-relaxed text-slate-200">
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
  onQuickReply,
  quickRepliesDisabled,
}: ProducerMessageListProps) {
  const t = useT();
  const last = messages.length === 0 ? null : (messages[messages.length - 1] as ProducerMessage);
  const quickReplies = last !== null && last.role === 'assistant' ? quickRepliesOf(last) : [];

  return (
    <ol data-testid="producer-message-list" className="space-y-4">
      {messages.map((message) => (
        <li
          key={message.id}
          data-testid={`producer-message-${message.id}`}
          data-role={message.role}
          className={
            message.role === 'user'
              ? 'ml-auto max-w-[85%] rounded-lg border border-sky-500/40 bg-sky-500/10 p-3'
              : 'max-w-[95%] rounded-lg border border-slate-800 bg-slate-900/60 p-3'
          }
        >
          <p className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            {message.role === 'user' ? t('producer.roleUser') : t('producer.roleAssistant')}
            {message.model !== undefined && (
              <span
                data-testid={`producer-message-model-${message.id}`}
                className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400"
              >
                {message.model}
              </span>
            )}
          </p>
          <ProducerMarkdown text={message.text} />
        </li>
      ))}

      {quickReplies.length > 0 && (
        <li data-testid="producer-suggestions" className="flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={quickRepliesDisabled}
              onClick={() => onQuickReply(reply)}
              className="rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs text-sky-100 disabled:opacity-40"
            >
              {reply}
            </button>
          ))}
        </li>
      )}
    </ol>
  );
}
