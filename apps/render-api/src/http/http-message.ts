export interface HttpRequestLine {
  readonly method: string;
  readonly path: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
