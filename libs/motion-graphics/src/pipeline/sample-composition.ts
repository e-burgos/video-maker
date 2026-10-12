import { MotionStudioError } from '../errors/motion-studio-error';
import { MOTION_COMPOSITION_ID } from '../compose/compose-storyboard';

export const COMPOSITION_FILE = 'index.html';

const DURATION_ATTRIBUTE = /\bdata-duration="([^"]*)"/u;

export function truncateCompositionDuration(html: string, seconds: number): string {
  const rootTag = new RegExp(`<[^>]*\\bdata-composition-id="${MOTION_COMPOSITION_ID}"[^>]*>`, 'u').exec(html)?.[0];
  const currentDuration = Number(DURATION_ATTRIBUTE.exec(rootTag ?? '')?.[1]);
  if (rootTag === undefined || !Number.isFinite(currentDuration)) {
    throw new MotionStudioError('STAGE_FAILED', 'the composition has no root element with a data-duration to cut for the sample');
  }
  if (seconds >= currentDuration) {
    return html;
  }
  return html.replace(rootTag, rootTag.replace(DURATION_ATTRIBUTE, `data-duration="${String(seconds)}"`));
}
