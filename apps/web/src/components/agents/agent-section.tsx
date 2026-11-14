import type { AgentId, AgentSection as AgentSectionContent } from '../../content/agents/agents-content';
import { useT } from '../../i18n/language-context';
import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';
import { CopyableCodeBlock } from './copyable-code-block';

export type AgentSectionProps = {
  id: AgentId;
  section: AgentSectionContent;
};

export function AgentSection({ id, section }: AgentSectionProps) {
  const t = useT();

  return (
    <section data-testid={`agent-${id}`} className={`${PANEL_CLASS} gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 className={PANEL_HEADING_CLASS}>{section.title}</h2>
        <p className="m-0 text-xs text-[var(--cl-ink-2)]">{section.lede}</p>
      </div>
      <ol aria-label={t('agents.steps')} className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-[var(--cl-ink-2)]">
        {section.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {section.blocks.map((block) => (
        <CopyableCodeBlock key={block.id} id={`${id}-${block.id}`} label={block.label} code={block.code} />
      ))}
    </section>
  );
}
