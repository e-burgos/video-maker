import type { AiAgentPort, AiAgentRequest, AiAgentResponse, AiAgentUsage } from '../deps/render-api-dependencies';
import type { CallLog } from './call-log';

export const FAKE_AI_AGENT_USAGE: AiAgentUsage = {
  tokensIn: 1200,
  tokensOut: 340,
  costUsd: 0.12,
  durationMs: 4200,
  model: 'claude-sonnet-4-6',
};

export interface FakeAiAgent {
  readonly agent: AiAgentPort;
  readonly requests: readonly AiAgentRequest[];
}

export type FakeAiAgentAnswer = (request: AiAgentRequest, index: number) => unknown;

export function createFakeAiAgent(
  answer: unknown | FakeAiAgentAnswer,
  callLog?: CallLog,
  usage: AiAgentUsage = FAKE_AI_AGENT_USAGE,
): FakeAiAgent {
  const requests: AiAgentRequest[] = [];

  const agent: AiAgentPort = async (request: AiAgentRequest): Promise<AiAgentResponse> => {
    requests.push(request);
    callLog?.record('aiAgent', request);

    const json = typeof answer === 'function' ? (answer as FakeAiAgentAnswer)(request, requests.length - 1) : answer;
    if (json instanceof Error) {
      throw json;
    }

    return { json, usage };
  };

  return { agent, requests };
}
