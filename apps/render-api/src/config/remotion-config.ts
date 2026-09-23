export const REMOTION_SERVE_URL_ENV_VAR = 'REMOTION_SERVE_URL';
export const REMOTION_BROWSER_EXECUTABLE_ENV_VAR = 'REMOTION_BROWSER_EXECUTABLE';

export interface RemotionConfig {
  readonly serveUrl: string | null;
  readonly browserExecutable: string | null;
}

function readNonEmpty(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name];
  return value === undefined || value === '' ? null : value;
}

export function readRemotionConfig(env: NodeJS.ProcessEnv): RemotionConfig {
  return {
    serveUrl: readNonEmpty(env, REMOTION_SERVE_URL_ENV_VAR),
    browserExecutable: readNonEmpty(env, REMOTION_BROWSER_EXECUTABLE_ENV_VAR),
  };
}
