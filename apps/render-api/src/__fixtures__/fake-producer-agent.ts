import type {
  ProducerTurnResult,
  ProducerTurnRun,
  ProducerTurnStart,
  SpawnedProducerProcess,
  SpawnProducerProcessInput,
} from '../producer/producer-agent';

export interface FakeProducerProcessControl {
  readonly input: SpawnProducerProcessInput;
  readonly emitStdout: (chunk: string) => void;
  readonly emitStderr: (chunk: string) => void;
  readonly emitSpawnError: (error: unknown) => void;
  readonly exit: (exitCode: number | null, signal?: string | null) => void;
  readonly signals: () => readonly string[];
}

export interface FakeProducerSpawner {
  readonly spawn: (input: SpawnProducerProcessInput) => SpawnedProducerProcess;
  readonly processes: () => readonly FakeProducerProcessControl[];
  readonly last: () => FakeProducerProcessControl;
}

export function createFakeProducerSpawner(): FakeProducerSpawner {
  const processes: FakeProducerProcessControl[] = [];

  return {
    spawn: (input) => {
      const stdoutListeners: ((chunk: string) => void)[] = [];
      const stderrListeners: ((chunk: string) => void)[] = [];
      const exitListeners: ((exitCode: number | null, signal: string | null) => void)[] = [];
      const errorListeners: ((error: unknown) => void)[] = [];
      const signals: string[] = [];

      processes.push({
        input,
        emitStdout: (chunk) => stdoutListeners.forEach((listener) => listener(chunk)),
        emitStderr: (chunk) => stderrListeners.forEach((listener) => listener(chunk)),
        emitSpawnError: (error) => errorListeners.forEach((listener) => listener(error)),
        exit: (exitCode, signal) =>
          exitListeners.forEach((listener) => listener(exitCode, signal ?? null)),
        signals: () => signals,
      });

      return {
        onStdout: (listener) => stdoutListeners.push(listener),
        onStderr: (listener) => stderrListeners.push(listener),
        onExit: (listener) => exitListeners.push(listener),
        onSpawnError: (listener) => errorListeners.push(listener),
        kill: (signal) => signals.push(signal),
      };
    },
    processes: () => processes,
    last: () => {
      const last = processes.at(-1);
      if (last === undefined) {
        throw new Error('createFakeProducerSpawner: no process was spawned');
      }
      return last;
    },
  };
}

export interface ManualTimeouts {
  readonly schedule: (callback: () => void, ms: number) => () => void;
  readonly fire: (ms: number) => void;
  readonly pending: () => readonly number[];
}

export function createManualTimeouts(): ManualTimeouts {
  const scheduled = new Map<number, { callback: () => void; ms: number }>();
  let nextId = 0;

  return {
    schedule: (callback, ms) => {
      const id = nextId;
      nextId += 1;
      scheduled.set(id, { callback, ms });
      return () => {
        scheduled.delete(id);
      };
    },
    fire: (ms) => {
      for (const [id, entry] of [...scheduled.entries()]) {
        if (entry.ms === ms) {
          scheduled.delete(id);
          entry.callback();
        }
      }
    },
    pending: () => [...scheduled.values()].map((entry) => entry.ms),
  };
}

export function fakeProducerTurnRun(result: ProducerTurnResult): ProducerTurnRun {
  return { cancel: () => undefined, completed: Promise.resolve(result) };
}

export function producerTurnStartFixture(
  overrides?: Partial<ProducerTurnStart>,
): ProducerTurnStart {
  return {
    text: 'Contame qué material hay',
    model: 'sonnet',
    systemPrompt: '# Skill: video-producer',
    sessionId: '11111111-2222-3333-4444-555555555555',
    resume: false,
    projectRoot: '/media/demo-01',
    ...overrides,
  };
}
