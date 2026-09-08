export interface CallLogEntry {
  readonly port: string;
  readonly input: unknown;
}

export interface CallLog {
  readonly record: (port: string, input: unknown) => void;
  readonly entries: () => readonly CallLogEntry[];
  readonly ports: () => readonly string[];
}

export function createCallLog(): CallLog {
  const entries: CallLogEntry[] = [];

  return {
    record: (port, input) => {
      entries.push({ port, input });
    },
    entries: () => entries,
    ports: () => entries.map((entry) => entry.port),
  };
}
