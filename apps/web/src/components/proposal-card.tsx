import { StateBadge } from '@e-burgos/tucu-ui';
import type { ProposalConcept } from '@video-maker/timeline-core';

import { outputPresetDetail } from '../api/output-presets';
import {
  estimateBasisSamples,
  formatDurationSeconds,
  formatMinutes,
  formatTokenCount,
  formatUsd,
} from '../api/proposal-format';
import type { ProposalDocument, ProposalEstimate } from '../api/proposal-types';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import type { AsyncResource } from '../hooks/use-async-resource';
import { useT, useTn } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import type { MaterialReviewDocument } from '../api/material-review-types';
import { ErrorNotice } from './error-notice';
import { MaterialNotReviewedNote, MaterialReviewTable, MaterialWarningsBlock } from './material-review-block';
import { PRIMARY_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type ProposalCardProps = {
  slug: string;
  proposal: AsyncResource<ProposalDocument>;
  materialReview?: AsyncResource<MaterialReviewDocument>;
};

function EstimateLines({ estimate }: { estimate: ProposalEstimate | undefined }) {
  const t = useT();
  const tn = useTn();

  if (estimate === undefined) {
    return <p className="text-xs text-[var(--cl-ink-3)]">{t('proposal.estimate.none')}</p>;
  }

  const samples = estimateBasisSamples(estimate);

  return (
    <ul data-testid="proposal-estimate" className="space-y-0.5 text-xs text-[var(--cl-ink-2)]">
      <li>{t('proposal.estimate.render', { minutes: formatMinutes(estimate.renderMinutes) })}</li>
      <li>{t('proposal.estimate.voice', { minutes: formatMinutes(estimate.voiceMinutes) })}</li>
      {estimate.producerTokens !== null && (
        <li>
          {t('proposal.estimate.tokens', {
            input: formatTokenCount(estimate.producerTokens.input),
            output: formatTokenCount(estimate.producerTokens.output),
          })}
        </li>
      )}
      {estimate.usd !== null && <li>{t('proposal.estimate.usd', { usd: formatUsd(estimate.usd) })}</li>}
      <li className="text-[var(--cl-ink-3)]">
        {samples === null
          ? t('proposal.estimate.basis.default')
          : tn('proposal.estimate.basis.samples', samples)}
      </li>
      {estimate.basis.render.rough && (
        <li data-testid="proposal-estimate-rough" className="text-[var(--tucu-state-orange-ink)]">
          <span className="font-medium">{t('proposal.estimate.rough')}</span>{' '}
          {t(samples === null ? 'proposal.estimate.rough.default' : 'proposal.estimate.rough.studio')}
        </li>
      )}
    </ul>
  );
}

function ConceptFields({ concept }: { concept: ProposalConcept }) {
  const t = useT();
  const tn = useTn();
  const rows: readonly (readonly [TranslationKey, string])[] = [
    ['proposal.field.format', t(outputPresetDetail(concept.format).labelKey)],
    ['proposal.field.duration', formatDurationSeconds(concept.durationSec)],
    ['proposal.field.scenes', tn('proposal.scenes', concept.scenes)],
    ['proposal.field.delivery', t(`proposal.delivery.${concept.delivery.kind}` as TranslationKey)],
    ...(concept.musicMode === undefined
      ? []
      : ([['proposal.field.music', t(`musicMode.${concept.musicMode}` as TranslationKey)]] as const)),
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {rows.map(([labelKey, value]) => (
        <div key={labelKey}>
          <dt className="text-[var(--cl-ink-3)]">{t(labelKey)}</dt>
          <dd className="text-[var(--cl-ink)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type ConceptItemProps = {
  concept: ProposalConcept;
  estimate: ProposalEstimate | undefined;
  recommended: boolean;
  approved: boolean;
  approving: boolean;
  onApprove: (conceptId: string) => void;
};

function ConceptItem({ concept, estimate, recommended, approved, approving, onApprove }: ConceptItemProps) {
  const t = useT();

  return (
    <li
      data-testid="proposal-concept"
      data-concept-id={concept.id}
      data-approved={approved}
      className={`flex flex-col gap-2 rounded-[12px] border p-3 ${approved ? 'border-[var(--tucu-state-green-line)]' : 'border-[var(--tucu-glass-sub-line)]'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--cl-ink)]">{concept.title}</h3>
        {recommended && (
          <StateBadge tone="teal" size="sm">
            {t('proposal.recommended')}
          </StateBadge>
        )}
        {approved && (
          <StateBadge tone="green" dot size="sm">
            {t('proposal.approved')}
          </StateBadge>
        )}
      </div>
      <p className="text-sm text-[var(--cl-ink-2)]">{concept.angle}</p>
      <ConceptFields concept={concept} />
      <EstimateLines estimate={estimate} />
      {concept.notes !== undefined && <p className="text-xs text-[var(--cl-ink-3)]">{concept.notes}</p>}
      {!approved && (
        <button
          type="button"
          className={`${recommended ? PRIMARY_BUTTON_SMALL_CLASS : SECONDARY_BUTTON_SMALL_CLASS} self-start`}
          disabled={approving}
          aria-label={`${t('proposal.approve')}: ${concept.title}`}
          onClick={() => onApprove(concept.id)}
        >
          {approving ? t('proposal.approving') : t('proposal.approve')}
        </button>
      )}
    </li>
  );
}

export function ProposalCard({ slug, proposal, materialReview }: ProposalCardProps) {
  const client = useRenderApi();
  const t = useT();
  const approveAction = useApiAction((conceptId: string) => client.approveProposal(slug, conceptId));
  const document = proposal.data?.proposal ?? null;

  if (proposal.data === null || document === null) {
    return null;
  }

  async function approve(conceptId: string) {
    const approved = await approveAction.run(conceptId);
    if (approved !== null) {
      proposal.reload();
    }
  }

  const review = materialReview?.data?.review ?? null;
  const warnings = document.materialWarnings ?? materialReview?.data?.warnings ?? null;
  const reviewMissing = materialReview?.data != null && review === null && document.materialWarnings === undefined;

  return (
    <section data-testid="proposal-card" className="glass-sub space-y-3 rounded-[14px] p-3.5">
      {warnings !== null && <MaterialWarningsBlock slug={slug} warnings={warnings} />}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-[var(--cl-ink)]">{t('proposal.heading')}</h2>
        </div>
        <p className="text-xs text-[var(--cl-ink-3)]">{t('proposal.hint')}</p>
      </div>
      {review !== null && <MaterialReviewTable review={review} />}
      {reviewMissing && <MaterialNotReviewedNote />}
      <ul className="space-y-3">
        {document.concepts.map((concept) => (
          <ConceptItem
            key={concept.id}
            concept={concept}
            estimate={proposal.data?.estimates[concept.id]}
            recommended={concept.id === document.recommendedId}
            approved={document.status === 'approved' && concept.id === document.approvedConceptId}
            approving={approveAction.status === 'pending'}
            onApprove={(conceptId) => void approve(conceptId)}
          />
        ))}
      </ul>
      {approveAction.error !== null && <ErrorNotice surface="glass" error={approveAction.error} />}
    </section>
  );
}
