import type { CommandOptions, CommandResult, CommandRunner } from './command-runner';

export interface FixtureCall {
  bin: string;
  args: readonly string[];
  opts?: CommandOptions;
}

export interface FixtureResponse {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export type FixtureResponseFactory = (call: FixtureCall, index: number) => FixtureResponse;

export interface FixtureRoute {
  bin: string;
  argsPattern?: readonly (string | RegExp)[];
  response: FixtureResponse | FixtureResponseFactory;
}

function basename(path: string): string {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] ?? path;
}

function matchesBin(route: FixtureRoute, bin: string): boolean {
  return route.bin === bin || route.bin === basename(bin);
}

function matchesToken(token: string | RegExp, arg: string): boolean {
  return typeof token === 'string' ? token === arg : token.test(arg);
}

function matchesArgsPattern(
  pattern: readonly (string | RegExp)[] | undefined,
  args: readonly string[],
): boolean {
  if (pattern === undefined) {
    return true;
  }

  let cursor = 0;
  for (const token of pattern) {
    let found = false;
    while (cursor < args.length) {
      const arg = args[cursor];
      cursor += 1;
      if (arg !== undefined && matchesToken(token, arg)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

function resolveResponse(route: FixtureRoute, call: FixtureCall, index: number): FixtureResponse {
  return typeof route.response === 'function' ? route.response(call, index) : route.response;
}

function describeRoutes(routes: readonly FixtureRoute[]): string {
  return JSON.stringify(routes.map((route) => ({ bin: route.bin, argsPattern: route.argsPattern })));
}

export class FixtureCommandRunner implements CommandRunner {
  private readonly routes: readonly FixtureRoute[];
  private readonly recordedCalls: FixtureCall[] = [];

  constructor(routes: readonly FixtureRoute[]) {
    this.routes = routes;
  }

  get calls(): readonly FixtureCall[] {
    return this.recordedCalls;
  }

  async run(bin: string, args: readonly string[], opts?: CommandOptions): Promise<CommandResult> {
    const call: FixtureCall = opts !== undefined ? { bin, args, opts } : { bin, args };
    this.recordedCalls.push(call);

    const route = this.routes.find(
      (candidate) => matchesBin(candidate, bin) && matchesArgsPattern(candidate.argsPattern, args),
    );

    if (route === undefined) {
      throw new Error(
        `FixtureCommandRunner: ninguna ruta matchea bin="${bin}" args=${JSON.stringify(args)}. Rutas declaradas: ${describeRoutes(this.routes)}`,
      );
    }

    const response = resolveResponse(route, call, this.recordedCalls.length - 1);
    return {
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      exitCode: response.exitCode ?? 0,
    };
  }

  callsFor(bin: string): readonly FixtureCall[] {
    return this.recordedCalls.filter((call) => call.bin === bin || basename(call.bin) === bin);
  }

  reset(): void {
    this.recordedCalls.length = 0;
  }
}
