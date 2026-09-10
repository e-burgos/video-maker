export type HttpHeaders = Readonly<Record<string, string>>;

export interface RequestBodySource {
  readonly stream: () => AsyncIterable<Uint8Array>;
}

export interface HttpRequestLine {
  readonly method: string;
  readonly path: string;
  readonly headers: HttpHeaders;
  readonly body: RequestBodySource;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: HttpHeaders;
  readonly body: unknown;
  readonly stream?: () => AsyncIterable<Uint8Array>;
}

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
export const PLAIN_TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

export function plainTextResponse(status: number, text: string): HttpResponse {
  const bytes = new TextEncoder().encode(text);

  return {
    status,
    headers: { 'content-type': PLAIN_TEXT_CONTENT_TYPE, 'content-length': String(bytes.byteLength) },
    body: text,
    stream: async function* stream() {
      yield bytes;
    },
  };
}
