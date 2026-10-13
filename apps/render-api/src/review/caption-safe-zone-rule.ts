import type { FindingDraft } from './review-finding-builder';
import type { CaptionLayoutFacts, CaptionPlacement, PixelRect, SecondsRange } from './review-inputs';
import { OVERLAY_MIN_EDGE_DISTANCE_PX } from './review-thresholds';

const CHECK = 'caption-safe-zone';

function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function timesOverlap(a: SecondsRange, b: SecondsRange): boolean {
  return a.startSec < b.endSec && b.startSec < a.endSec;
}

function firstAffected(captions: readonly CaptionPlacement[], isAffected: (caption: CaptionPlacement) => boolean): CaptionPlacement | null {
  return captions.find(isAffected) ?? null;
}

function draftFor(caption: CaptionPlacement, message: string, proposedFix: string): FindingDraft {
  return {
    check: CHECK,
    severity: 'critical',
    message: `${message} (primer subtítulo afectado: "${caption.text}").`,
    timeRange: { startSec: caption.startSec, endSec: caption.endSec },
    proposedFix,
  };
}

function logoFindings(layout: CaptionLayoutFacts): FindingDraft[] {
  const { logo } = layout;
  const caption = logo === null ? null : firstAffected(layout.captions, (candidate) => rectsOverlap(candidate.rect, logo));
  return caption === null
    ? []
    : [draftFor(
        caption,
        'Los subtítulos se superponen con el isotipo del video',
        'Mover el isotipo a una esquina de arriba, achicar el logo o acortar las líneas de subtítulos para que no lleguen a esa esquina.',
      )];
}

function chatButtonFindings(layout: CaptionLayoutFacts): FindingDraft[] {
  const { chatButton } = layout;
  const caption = chatButton === null ? null : firstAffected(layout.captions, (candidate) => rectsOverlap(candidate.rect, chatButton));
  return caption === null
    ? []
    : [draftFor(
        caption,
        'Los subtítulos tapan la zona del botón de chat de la interfaz, abajo a la derecha',
        'Acortar las líneas de subtítulos o subirlos para que terminen antes de la esquina inferior derecha, donde la grabación muestra el botón de chat.',
      )];
}

function overlayFindings(layout: CaptionLayoutFacts): FindingDraft[] {
  const caption = firstAffected(layout.captions, (candidate) =>
    layout.overlays.some((overlay) => timesOverlap(candidate, overlay) && rectsOverlap(candidate.rect, overlay.rect)),
  );
  return caption === null
    ? []
    : [draftFor(
        caption,
        'Los subtítulos se superponen con un recuadro del video',
        `Mover el recuadro arriba a la derecha, a no menos de ${String(OVERLAY_MIN_EDGE_DISTANCE_PX)} px de los bordes, y dejar abajo libre para subtítulos, isotipo y botón de chat.`,
      )];
}

export function captionSafeZoneFindings(layout: CaptionLayoutFacts | null): FindingDraft[] {
  return layout === null || layout.captions.length === 0
    ? []
    : [...logoFindings(layout), ...chatButtonFindings(layout), ...overlayFindings(layout)];
}
