import type {
  RenderMutedVideoInput,
  RenderMutedVideoOutput,
  RenderMutedVideoPort,
} from '../deps/render-api-dependencies';

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (cause: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export interface ControllableRenderMutedVideo {
  readonly port: RenderMutedVideoPort;
  readonly started: Promise<void>;
  readonly emitProgress: (renderedFrames: number, totalFrames: number) => void;
  readonly resolve: (output: RenderMutedVideoOutput) => void;
  readonly reject: (cause: unknown) => void;
}

export function createControllableRenderMutedVideo(): ControllableRenderMutedVideo {
  const startedDeferred = createDeferred<void>();
  const outputDeferred = createDeferred<RenderMutedVideoOutput>();
  let capturedInput: RenderMutedVideoInput | null = null;

  const port: RenderMutedVideoPort = (input) => {
    capturedInput = input;
    startedDeferred.resolve();
    return outputDeferred.promise;
  };

  return {
    port,
    started: startedDeferred.promise,
    emitProgress: (renderedFrames, totalFrames) => {
      capturedInput?.onProgress?.(renderedFrames, totalFrames);
    },
    resolve: outputDeferred.resolve,
    reject: outputDeferred.reject,
  };
}
