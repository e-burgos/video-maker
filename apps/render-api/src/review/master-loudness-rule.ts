import type { FindingDraft } from './review-finding-builder';
import { formatDb } from './review-finding-builder';
import type { ReviewMasterLevels } from './review-inputs';
import {
  MASTER_CRITICAL_TOLERANCE_LU,
  MASTER_SUGGESTION_TOLERANCE_LU,
  MASTER_TARGET_LUFS,
  MASTER_TRUE_PEAK_CEILING_DBTP,
} from './review-thresholds';

const CHECK = 'master-loudness';

function integratedFinding(integratedLufs: number): FindingDraft | null {
  const deviation = integratedLufs - MASTER_TARGET_LUFS;
  const message = `El máster mide ${formatDb(integratedLufs)} LUFS integrados y el objetivo es ${String(MASTER_TARGET_LUFS)} LUFS (desvío ${formatDb(deviation)} LU).`;
  if (Math.abs(deviation) > MASTER_CRITICAL_TOLERANCE_LU) {
    return {
      check: CHECK,
      severity: 'critical',
      message,
      proposedFix: `Volver a normalizar el máster a ${String(MASTER_TARGET_LUFS)} LUFS (aplicar ${formatDb(-deviation)} dB de ganancia) y revisar la mezcla.`,
    };
  }
  return Math.abs(deviation) > MASTER_SUGGESTION_TOLERANCE_LU ? { check: CHECK, severity: 'suggestion', message } : null;
}

function truePeakFinding(truePeakDbtp: number): FindingDraft | null {
  if (truePeakDbtp <= MASTER_TRUE_PEAK_CEILING_DBTP) {
    return null;
  }
  return {
    check: CHECK,
    severity: 'suggestion',
    message: `El pico verdadero del máster es ${formatDb(truePeakDbtp)} dBTP y supera el techo de ${String(MASTER_TRUE_PEAK_CEILING_DBTP)} dBTP.`,
  };
}

export function masterLoudnessFindings(master: ReviewMasterLevels): FindingDraft[] {
  return [integratedFinding(master.integratedLufs), truePeakFinding(master.truePeakDbtp)].filter(
    (finding): finding is FindingDraft => finding !== null,
  );
}
