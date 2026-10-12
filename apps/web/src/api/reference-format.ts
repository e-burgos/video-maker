import { REFERENCE_STAGES } from './reference-types';
import type { ReferenceStage } from './reference-types';
import type { TranslationKey } from '../i18n/messages-en';

export function referenceNameFor(assetPath: string): string {
  const baseName = assetPath.slice(assetPath.lastIndexOf('/') + 1);
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex <= 0 ? baseName : baseName.slice(0, dotIndex);
}

export function roundSeconds(seconds: number): string {
  return String(Math.round(seconds * 10) / 10);
}

export function formatPercent(ratio: number): string {
  return String(Math.round(ratio * 100));
}

export const REFERENCE_STAGE_KEY: Readonly<Record<ReferenceStage, TranslationKey>> = {
  probe: 'reference.stage.probe',
  scenes: 'reference.stage.scenes',
  transcribe: 'reference.stage.transcribe',
  keyframes: 'reference.stage.keyframes',
  persist: 'reference.stage.persist',
};

export function referenceStageNumber(stage: ReferenceStage): number {
  return REFERENCE_STAGES.indexOf(stage) + 1;
}
