export const STUDIO_MCP_SERVER_NAME = 'studio';

export const STUDIO_TOOL_NAMES = [
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
  'get_motion_brands',
  'read_motion_brief',
  'write_motion_brief',
  'read_motion_storyboard',
  'write_motion_storyboard',
  'get_render_review',
  'record_visual_review',
  'review_material',
  'propose_production',
  'get_reference_brief',
] as const;

export type StudioToolName = (typeof STUDIO_TOOL_NAMES)[number];

export function isStudioToolName(value: unknown): value is StudioToolName {
  return (
    typeof value === 'string' &&
    (STUDIO_TOOL_NAMES as readonly string[]).includes(value)
  );
}

export function claudeCodeToolName(tool: StudioToolName): `mcp__${typeof STUDIO_MCP_SERVER_NAME}__${StudioToolName}` {
  return `mcp__${STUDIO_MCP_SERVER_NAME}__${tool}`;
}
