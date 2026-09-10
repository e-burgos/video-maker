import type { ServiceHealth } from './render-api-types';

export function producerBlockers(health: ServiceHealth | null): string[] {
  if (health === null) {
    return ['The render service health is unknown, so the producer cannot be reached.'];
  }

  if (!health.capabilities.producer) {
    return [
      'Claude Code is not available to the render service on this machine, so the producer cannot run.',
    ];
  }

  return [];
}

export function canTalkToProducer(health: ServiceHealth | null): boolean {
  return producerBlockers(health).length === 0;
}

const PRODUCER_FAILURE_EXPLANATIONS: Readonly<Record<string, string>> = {
  PRODUCER_UNAVAILABLE:
    'Claude Code is not installed or the video-producer skill cannot be read on this machine. Install Claude Code, sign in with your subscription and restart the render service.',
  PRODUCER_RATE_LIMITED:
    'The Claude subscription ran out of quota. The conversation is saved on disk: come back later and keep going from where you left it.',
  PRODUCER_TURN_FAILED:
    'The producer stopped before finishing this turn. Whatever it had already written to the project is still there; send the message again to resume.',
  PRODUCER_TURN_ACTIVE:
    'The producer is already working on this project. Wait for the running turn or cancel it before sending another message.',
  PRODUCER_TURN_NOT_FOUND:
    'That turn is not in the service any more. The turn registry lives in memory, so a restart of the render service loses the turns in flight; the conversation itself is safe on disk.',
  PRODUCER_TURN_NOT_CANCELABLE:
    'That turn had already finished when the cancellation arrived, so there was nothing to stop.',
  PRODUCER_MESSAGE_INVALID: 'Write something before sending it to the producer.',
  PRODUCER_STATE_INVALID:
    'The stored conversation of this project cannot be read, so the service refuses to overwrite it. Check work/producer/conversation.json before talking to the producer again.',
};

export function producerFailureExplanation(code: string): string | null {
  return PRODUCER_FAILURE_EXPLANATIONS[code] ?? null;
}
