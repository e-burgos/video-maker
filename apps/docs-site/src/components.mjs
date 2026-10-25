import { t } from './i18n.mjs';
import { icon } from './icons.mjs';
import { escapeHtml, screenshotFigure } from './render.mjs';

export function pipelineDiagram(stages, { label, compact = false }) {
  const items = stages
    .map(
      (stage, index) => `<li class="pipeline__stage" style="--stage-index:${index}">
<span class="pipeline__icon">${icon(stage.icon)}</span>
<span class="pipeline__step" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
<h3 class="pipeline__title">${escapeHtml(stage.title)}</h3>
${compact ? '' : `<p class="pipeline__text">${stage.textHtml}</p>`}
</li>`,
    )
    .join('');
  const compactClass = compact ? ' pipeline--compact' : '';
  return `<ol class="pipeline${compactClass} reveal" aria-label="${escapeHtml(label)}" style="--stage-count:${stages.length}">${items}</ol>`;
}

function walkthroughStep(ctx, path, step, index) {
  const media = step.screenshot === undefined
    ? ''
    : `<div class="walkthrough__media">${screenshotFigure(ctx, step.screenshot.file, step.screenshot.alt, { className: 'screenshot screenshot--framed' })}</div>`;
  return `<li class="walkthrough__step" data-step id="${path.id}-step-${index + 1}">
${media}
<div class="walkthrough__text">
<p class="walkthrough__count">${escapeHtml(step.kicker)}</p>
<h4 class="walkthrough__title">${escapeHtml(step.title)}</h4>
${step.bodyHtml}
</div>
</li>`;
}

function stepperControls(ctx, path) {
  const dots = path.steps
    .map(
      (step, index) =>
        `<li><button type="button" class="walkthrough__dot" data-stepper-dot aria-label="${escapeHtml(t(ctx.locale, 'stepper.goTo', { current: index + 1 }))}"></button></li>`,
    )
    .join('');
  return `<div class="walkthrough__controls" data-stepper-controls hidden>
<button type="button" class="icon-button" data-stepper-previous aria-label="${escapeHtml(t(ctx.locale, 'stepper.previous'))}">${icon('arrowLeft')}</button>
<ol class="walkthrough__dots">${dots}</ol>
<p class="walkthrough__status" data-stepper-status aria-live="polite" data-template="${escapeHtml(t(ctx.locale, 'stepper.status'))}"></p>
<button type="button" class="icon-button" data-stepper-next aria-label="${escapeHtml(t(ctx.locale, 'stepper.next'))}">${icon('arrowRight')}</button>
</div>`;
}

function pathPanel(ctx, path) {
  const steps = path.steps.map((step, index) => walkthroughStep(ctx, path, step, index)).join('');
  return `<section class="path-panel" id="${path.id}" aria-labelledby="${path.id}-title">
<h3 class="path-panel__title" id="${path.id}-title">${icon(path.icon)}<span>${escapeHtml(path.title)}</span></h3>
<p class="path-panel__intro">${path.introHtml}</p>
<div class="walkthrough" data-stepper>
<ol class="walkthrough__steps">${steps}</ol>
${stepperControls(ctx, path)}
</div>
</section>`;
}

export function pathWalkthroughs(ctx, paths) {
  const tabs = paths
    .map(
      (path, index) =>
        `<button type="button" class="paths__tab" role="tab" id="${path.id}-tab" aria-controls="${path.id}" aria-selected="${index === 0 ? 'true' : 'false'}">${icon(path.icon)}<span>${escapeHtml(path.tabLabel)}</span></button>`,
    )
    .join('');
  return `<div class="paths reveal" data-tabs>
<div class="paths__tabs" role="tablist" aria-label="${escapeHtml(t(ctx.locale, 'tabs.label'))}" hidden>${tabs}</div>
${paths.map((path) => pathPanel(ctx, path)).join('')}
</div>`;
}

export function featureGrid(features) {
  const cards = features
    .map(
      (feature) => `<li class="feature-card reveal">
<span class="feature-card__icon">${icon(feature.icon)}</span>
<h3 class="feature-card__title">${escapeHtml(feature.title)}</h3>
<p>${feature.textHtml}</p>
</li>`,
    )
    .join('');
  return `<ul class="feature-grid">${cards}</ul>`;
}
