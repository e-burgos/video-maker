import type {
  OpenRouterCatalogModel,
  OpenRouterModelsResult,
  ProducerConversation,
  ProducerEvent,
  ProducerMessage,
  ProducerModelCatalog,
  ProducerSettings,
  ProducerTurn,
} from '../render-api-types';

export function producerModels(
  overrides: Partial<ProducerModelCatalog> = {},
): ProducerModelCatalog {
  return {
    default: 'sonnet',
    allowed: [
      { id: 'sonnet', label: 'Sonnet', description: 'Balanced · faster, cheaper' },
      { id: 'opus', label: 'Opus', description: 'Most capable · slower, costlier' },
      { id: 'haiku', label: 'Haiku', description: 'Fastest · lightest' },
    ],
    ...overrides,
  };
}

export const ASSISTANT_ANSWER = [
  'Tengo **3 clips** de a-roll y una locución de 32 segundos.',
  '',
  'Te propongo:',
  '',
  '1. Un corte de 30 segundos con la música de fondo.',
  '2. Un corte de 45 segundos con más B-roll.',
].join('\n');

export function producerMessage(overrides: Partial<ProducerMessage> = {}): ProducerMessage {
  return {
    id: 'msg-0001',
    role: 'user',
    text: 'Contame qué material hay.',
    createdAt: '2026-09-10T10:00:00.000Z',
    ...overrides,
  };
}

export function producerEvents(): ProducerEvent[] {
  return [
    { type: 'status', status: 'started' },
    { type: 'tool', name: 'Bash', summary: 'ffprobe raw/aroll/clip01.mp4' },
    { type: 'text', text: 'Reviso el material que subiste.' },
    { type: 'tool', name: 'Bash', summary: 'queued montage job' },
  ];
}

export function producerTurn(overrides: Partial<ProducerTurn> = {}): ProducerTurn {
  return {
    turnId: 'turn-0001',
    slug: 'demo-01',
    status: 'running',
    model: 'sonnet',
    startedAt: '2026-09-10T10:00:01.000Z',
    finishedAt: null,
    events: producerEvents(),
    assistantMessage: null,
    suggestions: [],
    error: null,
    ...overrides,
  };
}

export function succeededTurn(overrides: Partial<ProducerTurn> = {}): ProducerTurn {
  return producerTurn({
    status: 'succeeded',
    finishedAt: '2026-09-10T10:04:01.000Z',
    assistantMessage: ASSISTANT_ANSWER,
    suggestions: ['Dale, avanzá con el corte de 30 segundos', 'Mostrame el guion primero'],
    ...overrides,
  });
}

export function producerSettings(overrides: Partial<ProducerSettings> = {}): ProducerSettings {
  return {
    engine: null,
    effectiveEngine: 'claude-cli',
    engines: {
      claudeCli: { available: true, reason: null, models: producerModels().allowed },
      openrouter: {
        keyPresent: false,
        keyHint: null,
        models: [
          {
            id: 'anthropic/claude-haiku-4.5',
            label: 'Claude Haiku 4.5',
            description: 'Anthropic · fast, tool-calling',
          },
        ],
      },
    },
    models: { claude: null, openrouter: null },
    ...overrides,
  };
}

export function producerConversation(
  overrides: Partial<ProducerConversation> = {},
): ProducerConversation {
  return {
    slug: 'demo-01',
    messages: [
      producerMessage(),
      producerMessage({
        id: 'msg-0002',
        role: 'assistant',
        text: ASSISTANT_ANSWER,
        createdAt: '2026-09-10T10:04:01.000Z',
        suggestions: ['Dale, avanzá con el corte de 30 segundos'],
        turnId: 'turn-0001',
        model: 'sonnet',
      }),
    ],
    session: {
      sessionId: 'session-0001',
      model: 'sonnet',
      createdAt: '2026-09-10T10:00:01.000Z',
      lastTurnAt: '2026-09-10T10:04:01.000Z',
    },
    activeTurn: null,
    models: producerModels(),
    ...overrides,
  };
}

export function openRouterCatalogModel(overrides: Partial<OpenRouterCatalogModel> = {}): OpenRouterCatalogModel {
  return {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Anthropic: Claude Haiku 4.5',
    contextLength: 200000,
    pricing: { promptPerMTokUsd: 1, completionPerMTokUsd: 5 },
    supportsImages: true,
    isFree: false,
    recommended: true,
    recommendation: { tier: 'reference', notes: 'Placeholder pending the benchmark.', bench: null },
    ...overrides,
  };
}

export function openRouterModelsResult(overrides: Partial<OpenRouterModelsResult> = {}): OpenRouterModelsResult {
  return {
    models: [
      openRouterCatalogModel(),
      openRouterCatalogModel({
        id: 'nex-agi/nex-n2.5-mini:free',
        name: 'Nex AGI: Nex-N2.5-Mini (free)',
        contextLength: 262144,
        pricing: { promptPerMTokUsd: 0, completionPerMTokUsd: 0 },
        isFree: true,
        recommended: false,
        recommendation: null,
      }),
      openRouterCatalogModel({
        id: 'fireworks/ember-1',
        name: 'Fireworks: Ember-1',
        contextLength: 1048576,
        pricing: { promptPerMTokUsd: 3, completionPerMTokUsd: 15 },
        isFree: false,
        recommended: false,
        recommendation: null,
      }),
    ],
    fetchedAt: '2026-09-24T00:00:00.000Z',
    stale: false,
    ...overrides,
  };
}
