export interface KeyedSerializer {
  readonly run: <T>(key: string, task: () => Promise<T>) => Promise<T>;
}

export function createKeyedSerializer(): KeyedSerializer {
  const queues = new Map<string, Promise<void>>();

  return {
    run: (key, task) => {
      const previous = queues.get(key) ?? Promise.resolve();
      const settled = previous.then(task, task);
      queues.set(
        key,
        settled.then(
          () => undefined,
          () => undefined,
        ),
      );
      return settled;
    },
  };
}
