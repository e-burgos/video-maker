import type { FindingDraft } from './review-finding-builder';
import { formatSeconds, lengthSec } from './review-finding-builder';
import type { ReviewCaption, ReviewFrame, SecondsRange } from './review-inputs';
import { SILENCE_DETECT_MIN_SEC, SUBTITLE_MAX_CHARS, SUBTITLE_MIN_DURATION_SEC } from './review-thresholds';

function truncatedSeconds(seconds: number): string {
  return (Math.floor(seconds * 100) / 100).toFixed(2);
}

export function voiceSilenceFindings(
  silences: readonly SecondsRange[],
  voiceSegments: readonly SecondsRange[],
): FindingDraft[] {
  if (voiceSegments.length === 0) {
    return [];
  }
  const narrated = {
    startSec: Math.min(...voiceSegments.map((segment) => segment.startSec)),
    endSec: Math.max(...voiceSegments.map((segment) => segment.endSec)),
  };
  return silences.flatMap((silence): FindingDraft[] => {
    const inside = {
      startSec: Math.max(silence.startSec, narrated.startSec),
      endSec: Math.min(silence.endSec, narrated.endSec),
    };
    return lengthSec(inside) >= SILENCE_DETECT_MIN_SEC
      ? [{
          check: 'voice-silence',
          severity: 'suggestion',
          message: `Hay ${formatSeconds(lengthSec(inside))} de silencio dentro de la narración.`,
          timeRange: inside,
        }]
      : [];
  });
}

function isInsideSafeZone(caption: ReviewCaption, frame: ReviewFrame): boolean {
  if (caption.box === null) {
    return true;
  }
  const { box } = caption;
  const { safeZone } = frame;
  return (
    box.x >= safeZone.left &&
    box.y >= safeZone.top &&
    box.x + box.width <= frame.width - safeZone.right &&
    box.y + box.height <= frame.height - safeZone.bottom
  );
}

function captionFindings(caption: ReviewCaption, frame: ReviewFrame | null, singleLine: boolean): FindingDraft[] {
  const timeRange = { startSec: caption.startSec, endSec: caption.endSec };
  const findings: FindingDraft[] = [];
  if (singleLine && caption.text.length > SUBTITLE_MAX_CHARS) {
    findings.push({
      check: 'captions',
      severity: 'suggestion',
      message: `El subtítulo "${caption.text}" tiene ${String(caption.text.length)} caracteres y no entra en una línea (máximo ${String(SUBTITLE_MAX_CHARS)}).`,
      timeRange,
    });
  }
  if (lengthSec(caption) < SUBTITLE_MIN_DURATION_SEC) {
    findings.push({
      check: 'captions',
      severity: 'nitpick',
      message: `El subtítulo "${caption.text}" dura ${truncatedSeconds(lengthSec(caption))} s y se lee mal por debajo de ${String(SUBTITLE_MIN_DURATION_SEC)} s.`,
      timeRange,
    });
  }
  if (frame !== null && !isInsideSafeZone(caption, frame)) {
    findings.push({
      check: 'captions',
      severity: 'critical',
      message: `El recuadro del subtítulo "${caption.text}" se sale de la zona segura.`,
      timeRange,
      proposedFix: 'Reencuadrar los subtítulos dentro de la zona segura del formato o ajustar los márgenes de la zona segura.',
    });
  }
  return findings;
}

export function allCaptionFindings(
  captions: readonly ReviewCaption[],
  frame: ReviewFrame | null,
  captionStyle: string | null,
): FindingDraft[] {
  const singleLine = captionStyle === 'subtle-lower';
  return captions.flatMap((caption) => captionFindings(caption, frame, singleLine));
}
