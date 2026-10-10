import { PipelineStageError } from '../errors/pipeline-stage-error';
import { GoogleNetworkError, parseJsonObject } from './google-request';

const QUOTA_REASONS: readonly string[] = [
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'uploadLimitExceeded',
];
const MISSING_SCOPE_REASONS: readonly string[] = ['insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'];
const RECONNECT_FOR_SCOPE_HINT =
  'the connected channel did not grant the playlist permission: disconnect and connect YouTube again';
const HINT_MAX_LENGTH = 300;
const GOOGLE_RESOURCE = 'youtube';

interface GoogleErrorDetails {
  readonly reason: string | null;
  readonly message: string | null;
}

function detailsOf(bodyText: string): GoogleErrorDetails {
  const error = parseJsonObject(bodyText)?.error;
  if (typeof error === 'string') {
    return { reason: error, message: null };
  }
  if (typeof error !== 'object' || error === null) {
    return { reason: null, message: null };
  }
  const record = error as Record<string, unknown>;
  const first = Array.isArray(record.errors) ? (record.errors[0] as Record<string, unknown> | undefined) : undefined;
  return {
    reason: typeof first?.reason === 'string' ? first.reason : null,
    message: typeof record.message === 'string' ? record.message : null,
  };
}

export function googleErrorReason(bodyText: string): string | null {
  return detailsOf(bodyText).reason;
}

export function youtubeApiError(status: number, bodyText: string): PipelineStageError {
  const { reason, message } = detailsOf(bodyText);
  const hint = [String(status), reason, message].filter((part) => part !== null).join(' ').slice(0, HINT_MAX_LENGTH);

  if (reason !== null && QUOTA_REASONS.includes(reason)) {
    return new PipelineStageError({ code: 'YOUTUBE_QUOTA_EXCEEDED', stage: null, resource: GOOGLE_RESOURCE, hint });
  }
  if (status === 403 && reason !== null && MISSING_SCOPE_REASONS.includes(reason)) {
    return new PipelineStageError({
      code: 'YOUTUBE_NOT_CONNECTED',
      stage: null,
      resource: GOOGLE_RESOURCE,
      hint: `${RECONNECT_FOR_SCOPE_HINT} (${hint})`.slice(0, HINT_MAX_LENGTH),
    });
  }
  if (status === 401) {
    return new PipelineStageError({ code: 'YOUTUBE_NOT_CONNECTED', stage: null, resource: GOOGLE_RESOURCE, hint });
  }
  return new PipelineStageError({ code: 'YOUTUBE_UPLOAD_FAILED', stage: null, resource: GOOGLE_RESOURCE, hint });
}

export function youtubeNetworkError(cause: GoogleNetworkError): PipelineStageError {
  return new PipelineStageError({
    code: 'YOUTUBE_UPLOAD_FAILED',
    stage: null,
    resource: GOOGLE_RESOURCE,
    hint: 'could not reach Google, check the connection and retry',
    cause,
  });
}
