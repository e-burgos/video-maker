import type { ContentBlock } from '../../content/about/about-content';
import { InlinePartsView } from './inline-parts-view';

export type ContentBlocksViewProps = {
  blocks: readonly ContentBlock[];
};

export function ContentBlocksView({ blocks }: ContentBlocksViewProps) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'code') {
          return (
            <pre
              key={index}
              className="font-data m-0 overflow-x-auto rounded-[12px] bg-[#0b0d14] p-3 text-xs text-[#e8ecf5]"
            >
              {block.text}
            </pre>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="m-0 ml-5 flex list-disc flex-col gap-1.5 p-0 text-sm text-[var(--cl-ink-2)]">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlinePartsView parts={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="m-0 text-sm leading-relaxed text-[var(--cl-ink-2)]">
            <InlinePartsView parts={block.parts} />
          </p>
        );
      })}
    </>
  );
}
