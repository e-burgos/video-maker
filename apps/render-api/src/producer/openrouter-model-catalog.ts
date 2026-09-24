import type { FetchRemotePort } from '../deps/render-api-dependencies';
import { recommendedOpenRouterModelById } from '../config/recommended-openrouter-models';
import type {
  RecommendedOpenRouterModelBench,
  RecommendedOpenRouterModelTier,
} from '../config/recommended-openrouter-models';
import { PipelineStageError } from '../errors/pipeline-stage-error';

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const OPENROUTER_MODELS_TIMEOUT_MS = 10_000;
export const OPENROUTER_MODEL_CATALOG_TTL_MS = 60 * 60 * 1000;

const MAX_OPENROUTER_MODELS_RESPONSE_BYTES = 8 * 1024 * 1024;
const TOOLS_PARAMETER = 'tools';
const IMAGE_MODALITY = 'image';
const FREE_ID_SUFFIX = ':free';
const USD_PER_TOKEN_TO_PER_MILLION = 1_000_000;

export interface OpenRouterModelPricing {
  readonly promptPerMTokUsd: number;
  readonly completionPerMTokUsd: number;
}

export interface OpenRouterModelRecommendation {
  readonly tier: RecommendedOpenRouterModelTier;
  readonly notes: string;
  readonly bench: RecommendedOpenRouterModelBench | null;
}

export interface OpenRouterCatalogModel {
  readonly id: string;
  readonly name: string;
  readonly contextLength: number;
  readonly pricing: OpenRouterModelPricing;
  readonly supportsImages: boolean;
  readonly isFree: boolean;
  readonly recommended: boolean;
  readonly recommendation: OpenRouterModelRecommendation | null;
}

export interface OpenRouterModelCatalogResult {
  readonly models: readonly OpenRouterCatalogModel[];
  readonly fetchedAt: string;
  readonly stale: boolean;
}

export interface OpenRouterModelCatalog {
  readonly load: (fetchRemote: FetchRemotePort, nowMs: number) => Promise<OpenRouterModelCatalogResult>;
}

interface RawOpenRouterPricing {
  readonly prompt?: unknown;
  readonly completion?: unknown;
}

interface RawOpenRouterArchitecture {
  readonly input_modalities?: unknown;
}

interface RawOpenRouterModel {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly context_length?: unknown;
  readonly pricing?: RawOpenRouterPricing;
  readonly architecture?: RawOpenRouterArchitecture;
  readonly supported_parameters?: unknown;
}

interface RawOpenRouterModelsPayload {
  readonly data?: unknown;
}

export function openRouterCatalogUnavailable(cause: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'OPENROUTER_CATALOG_UNAVAILABLE',
    stage: null,
    hint: 'OpenRouter did not answer the model catalog with a usable response, try again shortly',
    cause,
  });
}

async function collectBytes(source: AsyncIterable<Uint8Array>, limitBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of source) {
    totalBytes += chunk.length;
    if (totalBytes > limitBytes) {
      throw new Error('OpenRouter models response exceeded the size limit');
    }
    chunks.push(chunk);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function priceUsdPerMillionTokens(raw: unknown): number {
  const value = typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(value) ? value * USD_PER_TOKEN_TO_PER_MILLION : 0;
}

function recommendationFor(id: string): OpenRouterModelRecommendation | null {
  const entry = recommendedOpenRouterModelById(id);
  return entry === null ? null : { tier: entry.tier, notes: entry.notes, bench: entry.bench };
}

function toCatalogModel(raw: RawOpenRouterModel): OpenRouterCatalogModel | null {
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : null;
  const contextLength = typeof raw.context_length === 'number' ? raw.context_length : null;
  if (id === null || contextLength === null) {
    return null;
  }

  const supportedParameters = Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [];
  if (!supportedParameters.includes(TOOLS_PARAMETER)) {
    return null;
  }

  const name = typeof raw.name === 'string' && raw.name !== '' ? raw.name : id;
  const promptPerMTokUsd = priceUsdPerMillionTokens(raw.pricing?.prompt);
  const completionPerMTokUsd = priceUsdPerMillionTokens(raw.pricing?.completion);
  const inputModalities = Array.isArray(raw.architecture?.input_modalities) ? raw.architecture.input_modalities : [];
  const isFree = id.endsWith(FREE_ID_SUFFIX) || (promptPerMTokUsd === 0 && completionPerMTokUsd === 0);
  const recommendation = recommendationFor(id);

  return {
    id,
    name,
    contextLength,
    pricing: { promptPerMTokUsd, completionPerMTokUsd },
    supportsImages: inputModalities.includes(IMAGE_MODALITY),
    isFree,
    recommended: recommendation !== null,
    recommendation,
  };
}

function sortRecommendedFirst(models: readonly OpenRouterCatalogModel[]): readonly OpenRouterCatalogModel[] {
  return [...models].sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

export async function fetchOpenRouterModelCatalog(
  fetchRemote: FetchRemotePort,
): Promise<readonly OpenRouterCatalogModel[]> {
  let response;
  try {
    response = await fetchRemote(OPENROUTER_MODELS_URL, {
      headers: { accept: 'application/json' },
      timeoutMs: OPENROUTER_MODELS_TIMEOUT_MS,
    });
  } catch (cause) {
    throw openRouterCatalogUnavailable(cause);
  }

  if (response.status !== 200) {
    throw openRouterCatalogUnavailable(new Error(`OpenRouter models responded with status ${response.status}`));
  }

  let payload: unknown;
  try {
    const bytes = await collectBytes(response.body(), MAX_OPENROUTER_MODELS_RESPONSE_BYTES);
    payload = JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch (cause) {
    throw openRouterCatalogUnavailable(cause);
  }

  const rawModels = (payload as RawOpenRouterModelsPayload | null)?.data;
  if (!Array.isArray(rawModels)) {
    throw openRouterCatalogUnavailable(new Error('OpenRouter models returned an unexpected payload shape'));
  }

  const models: OpenRouterCatalogModel[] = [];
  for (const raw of rawModels as readonly RawOpenRouterModel[]) {
    const model = toCatalogModel(raw);
    if (model !== null) {
      models.push(model);
    }
  }

  return sortRecommendedFirst(models);
}

export function createOpenRouterModelCatalog(
  ttlMs: number = OPENROUTER_MODEL_CATALOG_TTL_MS,
): OpenRouterModelCatalog {
  let cached: { readonly models: readonly OpenRouterCatalogModel[]; readonly fetchedAtMs: number } | null = null;

  return {
    load: async (fetchRemote, nowMs) => {
      if (cached !== null && nowMs - cached.fetchedAtMs < ttlMs) {
        return { models: cached.models, fetchedAt: new Date(cached.fetchedAtMs).toISOString(), stale: false };
      }

      try {
        const models = await fetchOpenRouterModelCatalog(fetchRemote);
        cached = { models, fetchedAtMs: nowMs };
        return { models, fetchedAt: new Date(nowMs).toISOString(), stale: false };
      } catch (cause) {
        if (cached !== null) {
          return { models: cached.models, fetchedAt: new Date(cached.fetchedAtMs).toISOString(), stale: true };
        }
        throw cause;
      }
    },
  };
}
