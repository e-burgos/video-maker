import type { TranslateFn } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { stripSuggestionsFence } from './producer-suggestions-fence';
import type { ProducerEvent, ProducerTurnStatus } from './render-api-types';

const STUDIO_TOOL_PREFIX = 'mcp__studio__';

export const TRANSLATED_STUDIO_TOOLS = [
  'get_project_overview',
  'probe_media',
  'extract_frames',
  'list_voices',
  'read_project_text',
  'write_project_text',
  'copy_asset',
  'start_job',
  'wait_for_job',
  'cancel_job',
  'get_timeline',
  'put_timeline',
  'patch_timeline',
  'search_free_music',
  'import_music',
  'search_free_media',
  'import_media',
  'view_images',
  'get_render_review',
  'record_visual_review',
  'review_material',
  'propose_production',
  'get_reference_brief',
  'draft_publication',
  'list_publications',
  'queue_publication',
  'get_motion_brands',
  'read_motion_brief',
  'write_motion_brief',
  'read_motion_storyboard',
  'write_motion_storyboard',
  'set_voice_direction',
] as const;

const TRANSLATED_EVENT_STATUSES = ['started', 'tool-failed'] as const;

function translatedStudioTool(name: string): string | null {
  if (!name.startsWith(STUDIO_TOOL_PREFIX)) {
    return null;
  }
  const tool = name.slice(STUDIO_TOOL_PREFIX.length);
  return (TRANSLATED_STUDIO_TOOLS as readonly string[]).includes(tool) ? tool : null;
}

export function translateProducerEvent(t: TranslateFn, event: ProducerEvent): string {
  if (event.type === 'text') {
    return stripSuggestionsFence(event.text);
  }
  if (event.type === 'tool') {
    const tool = translatedStudioTool(event.name);
    return tool === null ? `${event.name} · ${event.summary}` : t(`producer.tool.${tool}` as TranslationKey);
  }
  return (TRANSLATED_EVENT_STATUSES as readonly string[]).includes(event.status)
    ? t(`producer.event.${event.status}` as TranslationKey)
    : event.status;
}

export function translateProducerTurnStatus(t: TranslateFn, status: ProducerTurnStatus): string {
  return t(`producer.turnStatus.${status}` as TranslationKey);
}
