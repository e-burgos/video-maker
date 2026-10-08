import { describeProducerModel } from '../../config/producer-config';
import type { ProducerModelOption } from '../../config/producer-config';
import {
  RECOMMENDED_OPENROUTER_MODELS,
  isRecommendedOpenRouterModelId,
} from '../../config/recommended-openrouter-models';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import type { OpenRouterCatalogModel } from '../../producer/openrouter-model-catalog';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { readJsonObjectBody } from '../read-json-object-body';
import type { RenderApiRuntime } from '../render-api-runtime';

export const OPENROUTER_SECRET_NAME = 'openrouter';

export const PRODUCER_ENGINE_SETTING_KEY = 'producer.engine';
export const PRODUCER_MODEL_CLAUDE_SETTING_KEY = 'producer.model.claude';
export const PRODUCER_MODEL_OPENROUTER_SETTING_KEY = 'producer.model.openrouter';

const PRODUCER_ENGINES = ['claude-cli', 'openrouter'] as const;
export type ProducerEngine = (typeof PRODUCER_ENGINES)[number];

const CLAUDE_CLI_UNAVAILABLE_REASON =
  'install the Claude Code CLI and sign it in, or set CLAUDE_CLI_PATH to its absolute path';

const OPENROUTER_KEY_ENDPOINT = 'https://openrouter.ai/api/v1/key';
const OPENROUTER_KEY_PREFIX = 'sk-or-v1-';
const OPENROUTER_KEY_MIN_LENGTH = OPENROUTER_KEY_PREFIX.length + 8;
const OPENROUTER_VERIFY_TIMEOUT_MS = 10_000;
const OPENROUTER_KEY_HINT_LENGTH = 4;

interface ProducerEngineStatusClaude {
  readonly available: boolean;
  readonly reason: string | null;
  readonly models: readonly ProducerModelOption[];
}

interface ProducerEngineStatusOpenRouter {
  readonly keyPresent: boolean;
  readonly keyHint: string | null;
  readonly models: readonly ProducerModelOption[];
}

export interface ProducerSettingsBody {
  readonly engine: ProducerEngine | null;
  readonly effectiveEngine: ProducerEngine | null;
  readonly engines: {
    readonly claudeCli: ProducerEngineStatusClaude;
    readonly openrouter: ProducerEngineStatusOpenRouter;
  };
  readonly models: {
    readonly claude: string | null;
    readonly openrouter: string | null;
  };
}

export interface OpenRouterKeyBody {
  readonly keyPresent: boolean;
  readonly keyHint: string | null;
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { status, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

function keyHintOf(value: string): string {
  return value.slice(-OPENROUTER_KEY_HINT_LENGTH);
}

function isProducerEngine(value: unknown): value is ProducerEngine {
  return typeof value === 'string' && (PRODUCER_ENGINES as readonly string[]).includes(value);
}

export function readEngineSetting(deps: RenderApiDependencies): ProducerEngine | null {
  const value = deps.localStore.settings.get(PRODUCER_ENGINE_SETTING_KEY);
  return isProducerEngine(value) ? value : null;
}

export function readModelSetting(deps: RenderApiDependencies, key: string): string | null {
  const value = deps.localStore.settings.get(key);
  return typeof value === 'string' && value !== '' ? value : null;
}

export function resolveEffectiveProducerEngine(
  engine: ProducerEngine | null,
  claudeAvailable: boolean,
  openRouterKeyPresent: boolean,
): ProducerEngine | null {
  if (engine !== null) {
    return engine;
  }
  if (claudeAvailable) {
    return 'claude-cli';
  }
  return openRouterKeyPresent ? 'openrouter' : null;
}

function priceLabel(model: OpenRouterCatalogModel): string {
  return model.isFree
    ? 'Free'
    : `US$${model.pricing.promptPerMTokUsd.toFixed(2)}/1M in · US$${model.pricing.completionPerMTokUsd.toFixed(2)}/1M out`;
}

function describeOpenRouterCatalogModel(model: OpenRouterCatalogModel): ProducerModelOption {
  return { id: model.id, label: model.name, description: `${priceLabel(model)} · tool-calling` };
}

function fallbackRecommendedOpenRouterModels(): readonly ProducerModelOption[] {
  return RECOMMENDED_OPENROUTER_MODELS.map((entry) => ({ id: entry.id, label: entry.id, description: entry.notes }));
}

async function recommendedOpenRouterModelOptions(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
): Promise<readonly ProducerModelOption[]> {
  try {
    const nowMs = Date.parse(deps.clock.nowIso());
    const { models } = await runtime.openRouterModelCatalog.load(deps.fetchRemote, nowMs);
    const recommended = models.filter((model) => model.recommended).map(describeOpenRouterCatalogModel);
    return recommended.length > 0 ? recommended : fallbackRecommendedOpenRouterModels();
  } catch {
    return fallbackRecommendedOpenRouterModels();
  }
}

async function buildProducerSettingsBody(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
): Promise<ProducerSettingsBody> {
  const engine = readEngineSetting(deps);
  const claudeModel = readModelSetting(deps, PRODUCER_MODEL_CLAUDE_SETTING_KEY);
  const openrouterModel = readModelSetting(deps, PRODUCER_MODEL_OPENROUTER_SETTING_KEY);
  const claudeAvailable = await deps.probeProducerBinary();
  const storedKey = await deps.secretStore.get(OPENROUTER_SECRET_NAME);
  const keyPresent = storedKey !== null;

  return {
    engine,
    effectiveEngine: resolveEffectiveProducerEngine(engine, claudeAvailable, keyPresent),
    engines: {
      claudeCli: {
        available: claudeAvailable,
        reason: claudeAvailable ? null : CLAUDE_CLI_UNAVAILABLE_REASON,
        models: runtime.producer.models.map(describeProducerModel),
      },
      openrouter: {
        keyPresent,
        keyHint: storedKey === null ? null : keyHintOf(storedKey),
        models: await recommendedOpenRouterModelOptions(deps, runtime),
      },
    },
    models: {
      claude: claudeModel,
      openrouter: openrouterModel,
    },
  };
}

export async function handleGetProducerSettings(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  return jsonResponse(200, await buildProducerSettingsBody(deps, runtime));
}

function assertEngineValue(value: unknown): ProducerEngine | null {
  if (value === null) {
    return null;
  }
  if (!isProducerEngine(value)) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'engine',
      expected: `null or one of ${PRODUCER_ENGINES.join(', ')}`,
    });
  }
  return value;
}

function assertClaudeModel(value: unknown, runtime: RenderApiRuntime): string {
  if (typeof value !== 'string' || !runtime.producer.models.includes(value)) {
    throw new PipelineStageError({
      code: 'PRODUCER_MODEL_INVALID',
      stage: null,
      resource: 'models.claude',
      expected: `one of ${runtime.producer.models.join(', ')}`,
    });
  }
  return value;
}

async function assertOpenRouterModel(
  value: unknown,
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
): Promise<string> {
  if (typeof value !== 'string' || value === '') {
    throw new PipelineStageError({
      code: 'PRODUCER_MODEL_INVALID',
      stage: null,
      resource: 'models.openrouter',
      expected: 'a non-empty OpenRouter model id',
    });
  }

  let known: boolean;
  try {
    const nowMs = Date.parse(deps.clock.nowIso());
    const { models } = await runtime.openRouterModelCatalog.load(deps.fetchRemote, nowMs);
    known = models.some((model) => model.id === value);
  } catch {
    known = isRecommendedOpenRouterModelId(value);
  }

  if (!known) {
    throw new PipelineStageError({
      code: 'PRODUCER_MODEL_INVALID',
      stage: null,
      resource: 'models.openrouter',
      expected: 'a tool-capable OpenRouter model id',
    });
  }
  return value;
}

export async function handlePutProducerSettings(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const value = await readJsonObjectBody(request);

  if ('engine' in value) {
    deps.localStore.settings.set(PRODUCER_ENGINE_SETTING_KEY, assertEngineValue(value.engine));
  }

  if ('models' in value) {
    const models = value.models;
    if (typeof models !== 'object' || models === null) {
      throw new PipelineStageError({
        code: 'INVALID_INPUT',
        stage: null,
        resource: 'models',
        expected: 'an object with optional claude and openrouter fields',
      });
    }
    const modelsValue = models as Record<string, unknown>;
    if ('claude' in modelsValue) {
      deps.localStore.settings.set(PRODUCER_MODEL_CLAUDE_SETTING_KEY, assertClaudeModel(modelsValue.claude, runtime));
    }
    if ('openrouter' in modelsValue) {
      deps.localStore.settings.set(
        PRODUCER_MODEL_OPENROUTER_SETTING_KEY,
        await assertOpenRouterModel(modelsValue.openrouter, deps, runtime),
      );
    }
  }

  return jsonResponse(200, await buildProducerSettingsBody(deps, runtime));
}

function assertOpenRouterApiKeyFormat(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith(OPENROUTER_KEY_PREFIX) ||
    value.length < OPENROUTER_KEY_MIN_LENGTH
  ) {
    throw new PipelineStageError({
      code: 'OPENROUTER_KEY_INVALID',
      stage: null,
      resource: 'apiKey',
      expected: `a string starting with "${OPENROUTER_KEY_PREFIX}"`,
    });
  }
  return value;
}

async function verifyOpenRouterKey(deps: RenderApiDependencies, apiKey: string): Promise<void> {
  let status: number;
  try {
    const response = await deps.fetchRemote(OPENROUTER_KEY_ENDPOINT, {
      headers: { authorization: `Bearer ${apiKey}` },
      timeoutMs: OPENROUTER_VERIFY_TIMEOUT_MS,
    });
    status = response.status;
  } catch (cause) {
    throw new PipelineStageError({
      code: 'OPENROUTER_KEY_INVALID',
      stage: null,
      resource: 'apiKey',
      expected: 'a key OpenRouter accepts',
      hint: 'could not reach OpenRouter to verify the key, check connectivity and try again',
      cause,
    });
  }

  if (status === 200) {
    return;
  }

  throw new PipelineStageError({
    code: 'OPENROUTER_KEY_INVALID',
    stage: null,
    resource: 'apiKey',
    expected: 'a key OpenRouter accepts',
    hint:
      status === 401
        ? 'OpenRouter rejected the key'
        : 'OpenRouter did not confirm the key, check connectivity and try again',
  });
}

export async function handlePutOpenRouterKey(
  deps: RenderApiDependencies,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const value = await readJsonObjectBody(request);
  const apiKey = assertOpenRouterApiKeyFormat(value.apiKey);
  const shouldVerify = value.verify !== false;

  if (shouldVerify) {
    await verifyOpenRouterKey(deps, apiKey);
  }

  await deps.secretStore.set(OPENROUTER_SECRET_NAME, apiKey);

  const body: OpenRouterKeyBody = { keyPresent: true, keyHint: keyHintOf(apiKey) };
  return jsonResponse(200, body);
}

export async function handleDeleteOpenRouterKey(deps: RenderApiDependencies): Promise<HttpResponse> {
  await deps.secretStore.delete(OPENROUTER_SECRET_NAME);

  const body: OpenRouterKeyBody = { keyPresent: false, keyHint: null };
  return jsonResponse(200, body);
}
