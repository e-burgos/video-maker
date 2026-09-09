import type { LogEvent, Logger } from '../deps/render-api-dependencies';

export interface RecordingLogger extends Logger {
  readonly events: () => readonly LogEvent[];
}

export function createRecordingLogger(): RecordingLogger {
  const events: LogEvent[] = [];

  return {
    info: (event) => {
      events.push(event);
    },
    error: (event) => {
      events.push(event);
    },
    events: () => events,
  };
}
