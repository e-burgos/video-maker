import { join } from 'node:path';

import type { AppPaths } from './app-paths';
import { mergePathWithDefault, readLoginShellPath, resolveClaudeCli } from './login-shell-path';

const BASE_ALLOWED_KEYS = ['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'SHELL', 'LANG'] as const;

export function allowlistedParentEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed: NodeJS.ProcessEnv = {};
  for (const key of BASE_ALLOWED_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      allowed[key] = value;
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && key.startsWith('LC_')) {
      allowed[key] = value;
    }
  }
  return allowed;
}

export interface BuildRenderApiEnvInput {
  readonly paths: AppPaths;
  readonly host: string;
  readonly port: number;
  readonly token: string;
  readonly projectsFolder: string;
  readonly isPackaged: boolean;
  readonly parentPid: number;
  readonly parentEnv?: NodeJS.ProcessEnv;
}

export interface BuildRenderApiEnvDeps {
  readonly readLoginShellPath?: typeof readLoginShellPath;
  readonly resolveClaudeCli?: typeof resolveClaudeCli;
}

export async function buildRenderApiEnv(
  input: BuildRenderApiEnvInput,
  deps: BuildRenderApiEnvDeps = {},
): Promise<NodeJS.ProcessEnv> {
  const readLoginShellPathFn = deps.readLoginShellPath ?? readLoginShellPath;
  const resolveClaudeCliFn = deps.resolveClaudeCli ?? resolveClaudeCli;
  const sourceEnv = input.parentEnv ?? process.env;
  const loginShellPath = await readLoginShellPathFn();
  const mergedPath = mergePathWithDefault(loginShellPath, sourceEnv.PATH ?? '');
  const claudeCliPath = await resolveClaudeCliFn({ loginShellPath });

  const env: NodeJS.ProcessEnv = {
    ...allowlistedParentEnv(sourceEnv),
    PATH: mergedPath,
    RENDER_API_HOST: input.host,
    RENDER_API_PORT: String(input.port),
    RENDER_API_MEDIA_ROOT: input.projectsFolder,
    RENDER_API_DB_PATH: input.paths.dbPath,
    VIDEO_MAKER_BIN_DIR: input.paths.vendorBinDir,
    VIDEO_MAKER_MODELS_DIR: input.paths.modelsDir,
    VIDEO_MAKER_PARENT_PID: String(input.parentPid),
    RENDER_API_ACCESS_TOKEN: input.token,
    REMOTION_BROWSER_EXECUTABLE: input.paths.chromeHeadlessShellPath,
  };

  if (claudeCliPath !== null) {
    env.CLAUDE_CLI_PATH = claudeCliPath;
  }
  if (input.paths.remotionServeUrl !== null) {
    env.REMOTION_SERVE_URL = input.paths.remotionServeUrl;
  }
  if (input.isPackaged) {
    env.RENDER_API_WEB_ROOT = join(input.paths.resourcesDir, 'web');
    env.STUDIO_MCP_ENTRY = join(input.paths.resourcesDir, 'mcp', 'main.js');
  }

  return env;
}
