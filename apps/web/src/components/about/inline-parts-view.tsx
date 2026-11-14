import type { InlinePart } from '../../content/about/about-content';
import { LINK_CLASS } from '../ui/cl-controls';

const CODE_CLASS = 'font-data rounded-[6px] bg-[color-mix(in_srgb,var(--cl-ink)_8%,transparent)] px-1 text-[0.92em] text-[var(--cl-ink)]';

export type InlinePartsViewProps = {
  parts: readonly InlinePart[];
};

export function InlinePartsView({ parts }: InlinePartsViewProps) {
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        }
        if ('code' in part) {
          return (
            <code key={index} className={CODE_CLASS}>
              {part.code}
            </code>
          );
        }
        return (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {part.text}
          </a>
        );
      })}
    </>
  );
}
