import type { PipelineStage } from '../../content/learn/learn-content';

export type PipelineStagesProps = {
  stages: readonly PipelineStage[];
};

export function PipelineStages({ stages }: PipelineStagesProps) {
  return (
    <ol data-testid="learn-pipeline" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3 p-0">
      {stages.map((stage, index) => (
        <li key={stage.id} data-pipeline-stage={stage.id} className="glass-sub flex min-w-0 flex-col gap-2 rounded-[16px] p-4">
          <span className="font-data text-[11px] font-bold text-[var(--cl-action-text)]">{index + 1}</span>
          <h3 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{stage.title}</h3>
          <p className="m-0 text-sm text-[var(--cl-ink-2)]">{stage.text}</p>
        </li>
      ))}
    </ol>
  );
}
