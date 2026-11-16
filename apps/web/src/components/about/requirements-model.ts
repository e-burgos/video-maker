import type { StateBadgeTone } from '@e-burgos/tucu-ui';

import { REQUIREMENT_IDS } from '../../content/about/about-content';
import type { RequirementGroupId, RequirementId } from '../../content/about/about-content';
import type { ServiceHealth } from '../../api/render-api-types';
import type { TranslationKey } from '../../i18n/messages-en';

export type RequirementState = 'ok' | 'missing' | 'optional';

export type RequirementItem = {
  id: RequirementId;
  group: RequirementGroupId;
  state: RequirementState;
  envVar: string | null;
};

export const REQUIREMENT_GROUPS: readonly RequirementGroupId[] = ['engine', 'media', 'producer'];

export const STATE_TONE: Readonly<Record<RequirementState, StateBadgeTone>> = {
  ok: 'green',
  missing: 'red',
  optional: 'neutral',
};

export const STATE_LABEL: Readonly<Record<RequirementState, TranslationKey>> = {
  ok: 'about.requirements.stateOk',
  missing: 'about.requirements.stateMissing',
  optional: 'about.requirements.stateOptional',
};

const ENGINE_IDS: readonly RequirementId[] = ['media-local', 'composition-remotion/render'];
const PRODUCER_IDS: readonly RequirementId[] = ['claudeCli', 'openrouter'];

function groupOf(id: RequirementId): RequirementGroupId {
  if (ENGINE_IDS.includes(id)) {
    return 'engine';
  }
  return PRODUCER_IDS.includes(id) ? 'producer' : 'media';
}

function producerAvailability(health: ServiceHealth): Readonly<Record<'claudeCli' | 'openrouter', boolean>> {
  const engines = health.capabilities.producerEngines;
  return {
    claudeCli: engines?.claudeCli ?? health.capabilities.producer,
    openrouter: engines?.openrouter ?? false,
  };
}

function stateOf(id: RequirementId, health: ServiceHealth): { state: RequirementState; envVar: string | null } {
  const module = health.engine.find((entry) => entry.name === id);
  if (module !== undefined) {
    return { state: module.loaded ? 'ok' : 'missing', envVar: null };
  }
  if (id === 'claudeCli' || id === 'openrouter') {
    const availability = producerAvailability(health);
    if (availability[id]) {
      return { state: 'ok', envVar: null };
    }
    const anyAvailable = availability.claudeCli || availability.openrouter;
    return { state: anyAvailable ? 'optional' : 'missing', envVar: null };
  }
  const binary = health.binaries.find((entry) => entry.name === id);
  return { state: binary?.resolved === true ? 'ok' : 'missing', envVar: binary?.envVar ?? null };
}

export function buildRequirements(health: ServiceHealth): readonly RequirementItem[] {
  return REQUIREMENT_IDS.map((id) => ({ id, group: groupOf(id), ...stateOf(id, health) }));
}

export function countMissing(items: readonly RequirementItem[]): number {
  return items.filter((item) => item.state === 'missing').length;
}

export function itemsInGroup(items: readonly RequirementItem[], group: RequirementGroupId): readonly RequirementItem[] {
  return items.filter((item) => item.group === group);
}
