export const ENGINE_MODULE_NAMES = ['media-local', 'composition-remotion/render'] as const;

export type EngineModuleName = (typeof ENGINE_MODULE_NAMES)[number];

export interface EngineModuleStatus {
  readonly name: EngineModuleName;
  readonly loaded: boolean;
}
