import { VOICE_STAGES } from './render-job';
import type { VoiceJobProgress, VoiceStage } from './render-job';

export function voiceProgressPercent(processed: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.floor((processed / total) * 100)));
}

export function startVoiceJobStage(
  previous: VoiceJobProgress | null,
  stage: VoiceStage,
): VoiceJobProgress {
  if (previous !== null && VOICE_STAGES.indexOf(stage) <= VOICE_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, processedScenes: null, totalScenes: null, percent: null };
}

export function mergeVoiceJobProgress(
  previous: VoiceJobProgress | null,
  stage: VoiceStage,
  processedScenes: number,
  totalScenes: number,
): VoiceJobProgress {
  if (previous !== null && VOICE_STAGES.indexOf(stage) < VOICE_STAGES.indexOf(previous.stage)) {
    return previous;
  }
  return { stage, processedScenes, totalScenes, percent: voiceProgressPercent(processedScenes, totalScenes) };
}
