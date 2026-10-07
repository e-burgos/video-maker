export interface HyperframesInvocationInput {
  cliPath: string;
  execPath: string;
  isElectron: boolean;
  env: Readonly<Record<string, string | undefined>>;
}

export interface HyperframesInvocation {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export const HYPERFRAMES_VERSION = '0.8.139';

export function hyperframesInvocation(input: HyperframesInvocationInput): HyperframesInvocation {
  const inherited = Object.fromEntries(Object.entries(input.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const browser = input.env['REMOTION_BROWSER_EXECUTABLE'];
  return {
    command: input.execPath,
    args: [input.cliPath],
    env: {
      ...inherited,
      HYPERFRAMES_NO_UPDATE_CHECK: '1',
      HYPERFRAMES_NO_TELEMETRY: '1',
      HYPERFRAMES_NO_AUTO_INSTALL: '1',
      ...(input.isElectron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      ...(browser === undefined || browser === '' ? {} : { PRODUCER_HEADLESS_SHELL_PATH: browser }),
    },
  };
}
