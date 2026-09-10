export interface ProducerTurnStart {
  readonly text: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly sessionId: string;
  readonly resume: boolean;
  readonly projectRoot: string;
}

export interface ProducerTurnResult {
  readonly exitCode: number | null;
  readonly canceled: boolean;
  readonly timedOut: boolean;
  readonly spawnFailed: boolean;
  readonly stderr: string;
}

export interface ProducerTurnRun {
  readonly cancel: () => void;
  readonly completed: Promise<ProducerTurnResult>;
}

export type ProducerAgentPort = (
  start: ProducerTurnStart,
  onLine: (line: string) => void,
) => ProducerTurnRun;

export interface SpawnProducerProcessInput {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface SpawnedProducerProcess {
  readonly onStdout: (listener: (chunk: string) => void) => void;
  readonly onStderr: (listener: (chunk: string) => void) => void;
  readonly onExit: (listener: (exitCode: number | null, signal: string | null) => void) => void;
  readonly onSpawnError: (listener: (error: unknown) => void) => void;
  readonly kill: (signal: 'SIGTERM' | 'SIGKILL') => void;
}

export type SpawnProducerProcess = (input: SpawnProducerProcessInput) => SpawnedProducerProcess;
