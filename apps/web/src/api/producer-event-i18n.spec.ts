import { describe, expect, it } from 'vitest';

import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';
import { translate } from '../i18n/translate';
import { TRANSLATED_STUDIO_TOOLS, translateProducerEvent, translateProducerTurnStatus } from './producer-event-i18n';

const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate(MESSAGES_ES, key, params);

describe('translateProducerEvent', () => {
  it('names a studio tool in the interface language instead of its raw MCP name', () => {
    expect(
      translateProducerEvent(t, { type: 'tool', name: 'mcp__studio__get_project_overview', summary: 'Checking the project' }),
    ).toBe('Revisando el proyecto');
  });

  it('keeps the name and summary of a tool the studio does not translate', () => {
    expect(translateProducerEvent(t, { type: 'tool', name: 'Bash', summary: 'ffprobe raw/aroll/clip01.mp4' })).toBe(
      'Bash · ffprobe raw/aroll/clip01.mp4',
    );
  });

  it('shows the text of a message without its suggestions block', () => {
    expect(translateProducerEvent(t, { type: 'text', text: 'Listo.\n```suggestions\n["Dale"]\n```\n' })).toBe('Listo.');
  });

  it('translates the known statuses and leaves an unknown one as it came', () => {
    expect(translateProducerEvent(t, { type: 'status', status: 'started' })).toBe('arrancó');
    expect(translateProducerEvent(t, { type: 'status', status: 'something-new' })).toBe('something-new');
  });

  it('has a label in both languages for every studio tool', () => {
    for (const tool of TRANSLATED_STUDIO_TOOLS) {
      expect(Object.keys(MESSAGES_ES)).toContain(`producer.tool.${tool}`);
      expect(Object.keys(MESSAGES_EN)).toContain(`producer.tool.${tool}`);
    }
  });
});

describe('translateProducerTurnStatus', () => {
  it('says how the turn ended in words', () => {
    expect(translateProducerTurnStatus(t, 'succeeded')).toBe('turno terminado');
    expect(translateProducerTurnStatus(t, 'failed')).toBe('turno con error');
  });
});
