import { AGENT_IDS } from '../../content/agents/agents-content';
import { useT } from '../../i18n/language-context';
import { HINT_TEXT_CLASS } from '../ui/cl-controls';
import { LoadingState } from '../ui/status-states';
import { AgentSection } from './agent-section';
import { StudioEnginesStatus } from './studio-engines-status';
import { useAgentsContent } from './use-agents-content';

export function AgentsTab() {
  const t = useT();
  const content = useAgentsContent();

  return (
    <>
      <StudioEnginesStatus />
      {content === null && <LoadingState message={t('agents.loading')} />}
      {content !== null && (
        <>
          <div className="px-1 min-[1100px]:col-span-2">
            <h2 className="m-0 text-xl font-bold tracking-tight text-[var(--cl-ink)]">{content.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--cl-ink-2)]">{content.lede}</p>
            <p className={`${HINT_TEXT_CLASS} mt-1`}>{content.studioNote}</p>
          </div>
          {AGENT_IDS.map((id) => (
            <AgentSection key={id} id={id} section={content.sections[id]} />
          ))}
        </>
      )}
    </>
  );
}
