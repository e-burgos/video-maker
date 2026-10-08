import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { createBrand, deleteBrand, getBrand, listBrands, resolveBrandFile, saveBrandFile, updateBrand } from '../../brands/brand-library';
import type { BrandFileTarget, CreateBrandInput } from '../../brands/brand-library';
import { addGoogleFont, parseFontFamily } from '../../brands/brand-fonts';
import { createBrandPreview, resolveBrandPreviewFile } from '../../brands/brand-preview';
import type { BrandPreviewOverrides } from '../../brands/brand-preview';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { toErrorPayload } from '../../errors/to-error-payload';
import { parseByteRange } from '../byte-range';
import { contentTypeFor } from '../content-type-for';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

function jsonResponse(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE, ...headers }, body };
}

async function readRequestJson(request: HttpRequestLine): Promise<unknown> {
  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({ code: 'REQUEST_BODY_TOO_LARGE', stage: null, expected: `at most ${MAX_JSON_BODY_BYTES} bytes` });
  }
  if (bodyResult.kind !== 'parsed') {
    throw new PipelineStageError({ code: 'REQUEST_BODY_INVALID_JSON', stage: null, expected: 'a JSON object' });
  }
  return bodyResult.value;
}

function parseCreateBrandBody(value: unknown): CreateBrandInput {
  const body = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const optionalStrings = body !== null && ['id', 'duplicateFrom'].every((key) => body[key] === undefined || typeof body[key] === 'string');
  if (body === null || typeof body['name'] !== 'string' || !optionalStrings) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      expected: 'an object with a name string and optional id and duplicateFrom strings',
    });
  }
  return {
    name: body['name'],
    ...(typeof body['id'] === 'string' ? { id: body['id'] } : {}),
    ...(typeof body['duplicateFrom'] === 'string' ? { duplicateFrom: body['duplicateFrom'] } : {}),
  };
}

export async function handleListBrands(deps: RenderApiDependencies, store: StoreConfig): Promise<HttpResponse> {
  return jsonResponse(200, await listBrands(deps, store));
}

export async function handleGetBrand(deps: RenderApiDependencies, store: StoreConfig, params: RouteParams): Promise<HttpResponse> {
  return jsonResponse(200, await getBrand(deps, store, params.id ?? ''));
}

export async function handleCreateBrand(deps: RenderApiDependencies, store: StoreConfig, request: HttpRequestLine): Promise<HttpResponse> {
  const brand = await createBrand(deps, store, parseCreateBrandBody(await readRequestJson(request)));
  return jsonResponse(201, brand, { location: `/brands/${brand.id}` });
}

export async function handlePutBrand(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  return jsonResponse(200, await updateBrand(deps, store, params.id ?? '', await readRequestJson(request)));
}

export async function handleDeleteBrand(deps: RenderApiDependencies, store: StoreConfig, params: RouteParams): Promise<HttpResponse> {
  await deleteBrand(deps, store, params.id ?? '');
  return { status: 204, headers: {}, body: undefined };
}

export async function handlePutBrandFile(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const header = request.headers['content-length'];
  const contentLength = header === undefined ? Number.NaN : Number(header);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new PipelineStageError({ code: 'ASSET_CONTENT_LENGTH_REQUIRED', stage: null, resource: 'content-length' });
  }
  const saved = await saveBrandFile(deps, store, {
    id: params.id ?? '',
    kind: params.kind ?? '',
    name: params.name ?? '',
    upload: { contentLength, body: request.body.stream() },
  });
  return jsonResponse(201, saved);
}

function serveStoredFile(
  deps: RenderApiDependencies,
  file: BrandFileTarget,
  request: HttpRequestLine,
  extraHeaders: Readonly<Record<string, string>> = {},
): HttpResponse {
  const contentType = contentTypeFor(file.relativePath);
  const range = parseByteRange(request.headers.range, file.sizeBytes);

  if (range.kind === 'unsatisfiable') {
    const error = new PipelineStageError({ code: 'RANGE_NOT_SATISFIABLE', stage: null, resource: file.relativePath, expected: `bytes */${file.sizeBytes}` });
    return jsonResponse(416, { error: toErrorPayload(error) }, { 'content-range': `bytes */${file.sizeBytes}` });
  }
  if (range.kind === 'satisfiable') {
    return {
      status: 206,
      headers: {
        'content-type': contentType,
        'content-range': `bytes ${range.start}-${range.end}/${file.sizeBytes}`,
        'content-length': String(range.end - range.start + 1),
        'accept-ranges': 'bytes',
        ...extraHeaders,
      },
      body: undefined,
      stream: () => deps.storage.openReadStream(file.absolutePath, { start: range.start, end: range.end }),
    };
  }
  return {
    status: 200,
    headers: { 'content-type': contentType, 'content-length': String(file.sizeBytes), 'accept-ranges': 'bytes', ...extraHeaders },
    body: undefined,
    stream: () => deps.storage.openReadStream(file.absolutePath),
  };
}

export async function handleGetBrandFile(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  return serveStoredFile(deps, await resolveBrandFile(deps, store, params.id ?? '', params.path ?? ''), request);
}

function optionalOverride(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource: key, expected: 'a non-empty string' });
  }
  return value.trim();
}

async function readPreviewOverrides(request: HttpRequestLine): Promise<BrandPreviewOverrides> {
  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  if (bodyResult.kind === 'empty') {
    return {};
  }
  if (bodyResult.kind === 'too-large') {
    throw new PipelineStageError({ code: 'REQUEST_BODY_TOO_LARGE', stage: null, expected: `at most ${MAX_JSON_BODY_BYTES} bytes` });
  }
  const value = bodyResult.kind === 'parsed' ? bodyResult.value : null;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PipelineStageError({ code: 'REQUEST_BODY_INVALID_JSON', stage: null, expected: 'a JSON object with optional tagline and headline strings' });
  }
  const body = value as Record<string, unknown>;
  const tagline = optionalOverride(body, 'tagline');
  const headline = optionalOverride(body, 'headline');
  return { ...(tagline === undefined ? {} : { tagline }), ...(headline === undefined ? {} : { headline }) };
}

export async function handlePostBrandPreview(
  deps: RenderApiDependencies,
  store: StoreConfig,
  runtime: RenderApiRuntime,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const id = params.id ?? '';
  const overrides = await readPreviewOverrides(request);
  const preview = await runtime.brandPreviewSerializer.run(id, () => createBrandPreview(deps, store, id, overrides));
  return jsonResponse(200, preview);
}

export async function handleGetBrandPreviewFile(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const file = await resolveBrandPreviewFile(deps, store, params.id ?? '', params.path ?? '');
  return serveStoredFile(deps, file, request, { 'cache-control': 'no-store' });
}

export async function handlePostBrandFont(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const family = parseFontFamily(await readRequestJson(request));
  return jsonResponse(200, await addGoogleFont(deps, store, params.id ?? '', family));
}
