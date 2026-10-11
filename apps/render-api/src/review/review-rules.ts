import { reviewStatusFor } from '@video-maker/timeline-core';
import type { ReviewReport } from '@video-maker/timeline-core';

import { deliveryFindings } from './delivery-rules';
import { masterLoudnessFindings } from './master-loudness-rule';
import { allCaptionFindings, voiceSilenceFindings } from './narration-rules';
import { blackFrameFindings, frozenFrameFindings } from './picture-rules';
import type { FindingDraft } from './review-finding-builder';
import { formatSeconds, lengthSec, numbered } from './review-finding-builder';
import type { ReviewInputs, SecondsRange } from './review-inputs';
import { voiceMusicMarginFindings, voiceMusicMargins, worstMarginDb } from './voice-music-margin-rule';

function totalSeconds(ranges: readonly SecondsRange[]): number {
  return ranges.reduce((sum, range) => sum + lengthSec(range), 0);
}

function durationFindings(inputs: ReviewInputs): FindingDraft[] {
  const differenceSec = inputs.actualDurationSec - inputs.expectedDurationSec;
  if (Math.abs(differenceSec) <= 1 / inputs.fps + 1e-6) {
    return [];
  }
  return [{
    check: 'duration',
    severity: 'critical',
    message: `El render dura ${formatSeconds(inputs.actualDurationSec)} y debería durar ${formatSeconds(inputs.expectedDurationSec)} (diferencia ${formatSeconds(Math.abs(differenceSec))}, más de un cuadro).`,
    proposedFix: 'Volver a renderizar el video: el archivo parece cortado o desfasado respecto de la Timeline.',
  }];
}

function missingAssetFindings(missingAssets: readonly string[]): FindingDraft[] {
  return missingAssets.map((path) => ({
    check: 'missing-assets',
    severity: 'critical',
    message: `Falta en disco el recurso "${path}" que usa el video.`,
    proposedFix: `Restaurar o volver a generar "${path}" y renderizar de nuevo.`,
  }));
}

export function reviewRender(inputs: ReviewInputs): ReviewReport {
  const margins = voiceMusicMargins(inputs.voiceSegments);
  const drafts = [
    ...masterLoudnessFindings(inputs.master),
    ...voiceMusicMarginFindings(margins),
    ...durationFindings(inputs),
    ...blackFrameFindings(inputs.blackSegments, inputs.bumpers),
    ...frozenFrameFindings(inputs.frozenSegments, inputs.voiceSegments, inputs.delivery),
    ...voiceSilenceFindings(inputs.silences, inputs.voiceSegments),
    ...allCaptionFindings(inputs.captions, inputs.frame, inputs.captionStyle),
    ...missingAssetFindings(inputs.missingAssets),
    ...deliveryFindings({
      delivery: inputs.delivery,
      actualDurationSec: inputs.actualDurationSec,
      hasVoice: inputs.hasVoice,
      captionCount: inputs.captions.length,
    }),
  ];
  const findings = numbered(drafts);

  return {
    version: 1,
    file: inputs.file,
    createdAt: inputs.createdAt,
    status: reviewStatusFor(findings),
    delivery: inputs.delivery,
    metrics: {
      masterIntegratedLufs: inputs.master.integratedLufs,
      masterTruePeakDbtp: inputs.master.truePeakDbtp,
      voiceMusicMarginDb: worstMarginDb(margins),
      durationSec: inputs.actualDurationSec,
      expectedDurationSec: inputs.expectedDurationSec,
      blackSeconds: totalSeconds(inputs.blackSegments),
      frozenSeconds: totalSeconds(inputs.frozenSegments),
      silenceSeconds: totalSeconds(inputs.silences),
      captionCount: inputs.captions.length,
      missingAssetCount: inputs.missingAssets.length,
    },
    findings,
  };
}
