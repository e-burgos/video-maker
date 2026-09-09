import type { CommandOptions, CommandResult, CommandRunner } from '@video-maker/media-local';

import type { CallLog } from './call-log';

export interface FakeCommandCall {
  readonly bin: string;
  readonly args: readonly string[];
  readonly opts?: CommandOptions;
}

export interface FakeCommandResponse {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly reject?: unknown;
}

export type FakeCommandResponseFactory = (
  call: FakeCommandCall,
  index: number,
) => FakeCommandResponse | Promise<FakeCommandResponse>;

export interface FakeCommandRoute {
  readonly bin: string;
  readonly response: FakeCommandResponse | FakeCommandResponseFactory;
}

export interface FakeCommandRunner extends CommandRunner {
  readonly calls: readonly FakeCommandCall[];
  readonly callsFor: (bin: string) => readonly FakeCommandCall[];
}

async function resolveResponse(
  route: FakeCommandRoute,
  call: FakeCommandCall,
  index: number,
): Promise<FakeCommandResponse> {
  return typeof route.response === 'function' ? route.response(call, index) : route.response;
}

export function createFakeCommandRunner(
  routes: readonly FakeCommandRoute[],
  callLog?: CallLog,
): FakeCommandRunner {
  const calls: FakeCommandCall[] = [];

  async function run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult> {
    const call: FakeCommandCall = opts === undefined ? { bin, args } : { bin, args, opts };
    calls.push(call);
    callLog?.record('commandRunner.run', call);

    const route = routes.find((candidate) => candidate.bin === bin);
    if (route === undefined) {
      throw new Error(`FakeCommandRunner: no route configured for bin "${bin}"`);
    }

    const response = await resolveResponse(route, call, calls.length - 1);
    if (response.reject !== undefined) {
      throw response.reject;
    }

    return {
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      exitCode: response.exitCode ?? 0,
    };
  }

  return {
    run,
    calls,
    callsFor: (bin) => calls.filter((call) => call.bin === bin),
  };
}
