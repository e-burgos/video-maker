import type { InlinePart } from '../../content/about/about-content';

export function splitBackticks(text: string): readonly InlinePart[] {
  return text
    .split('`')
    .map((segment, index): InlinePart => (index % 2 === 1 ? { code: segment } : segment))
    .filter((part) => part !== '');
}
