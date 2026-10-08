import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RenderApiRuntime } from '../render-api-runtime';

const CLIENT_FIELD_MAX_LENGTH = 512;

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function clientField(value: unknown, resource: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '' || text.length > CLIENT_FIELD_MAX_LENGTH) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource,
      expected: `a non-empty string of at most ${String(CLIENT_FIELD_MAX_LENGTH)} characters`,
    });
  }
  return text;
}

export async function handleGetYoutubeIntegration(runtime: RenderApiRuntime): Promise<HttpResponse> {
  return jsonResponse(200, await runtime.youtube.oauth.status());
}

export async function handlePutYoutubeClient(
  runtime: RenderApiRuntime,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const body = await readJsonObjectBody(request);
  const status = await runtime.youtube.oauth.saveClient(
    clientField(body.clientId, 'clientId'),
    clientField(body.clientSecret, 'clientSecret'),
  );
  return jsonResponse(200, status);
}

export async function handleConnectYoutube(runtime: RenderApiRuntime): Promise<HttpResponse> {
  return jsonResponse(200, await runtime.youtube.oauth.startConnect());
}

export async function handleDisconnectYoutube(runtime: RenderApiRuntime): Promise<HttpResponse> {
  await runtime.youtube.oauth.disconnect();
  return { status: 204, headers: {}, body: undefined };
}
