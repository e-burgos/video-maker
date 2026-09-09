import type { HttpHeaders, HttpRequestLine } from '../http/http-message';

export interface RequestLineInput {
  readonly method: string;
  readonly path: string;
  readonly headers?: HttpHeaders;
  readonly body?: AsyncIterable<Uint8Array>;
}

function emptyBody(): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.resolve({ value: undefined, done: true as const }),
    }),
  };
}

export function requestLine(input: RequestLineInput): HttpRequestLine {
  return {
    method: input.method,
    path: input.path,
    headers: input.headers ?? {},
    body: { stream: () => input.body ?? emptyBody() },
  };
}
