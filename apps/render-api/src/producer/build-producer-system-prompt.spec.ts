import { describe, expect, it } from 'vitest';

import {
  buildProducerSystemPrompt,
  PRODUCER_BASE_ALLOWED_TOOLS,
  producerAllowedTools,
} from './build-producer-system-prompt';
import type { ProducerProjectContext } from './collect-producer-context';

const CONTEXT: ProducerProjectContext = {
  slug: 'demo-01',
  projectRoot: '/media/demo-01',
  repoRoot: '/repo',
  apiUrl: 'http://127.0.0.1:4399',
  assetSource: 'catalog',
  assets: [
    { path: 'raw/aroll/clip01.mp4', role: 'aroll', durationMs: 25_900 },
    { path: 'raw/logo/logo.png', role: 'logo', durationMs: null },
  ],
  hasTimeline: true,
  producerScript: 'none',
};

describe('producerAllowedTools', () => {
  it('pone el binario de Piper en la lista blanca cuando está instalado (FIX-e-burgos-015-002)', () => {
    expect(producerAllowedTools('/usr/bin/piper')).toEqual([
      ...PRODUCER_BASE_ALLOWED_TOOLS,
      'Bash(/usr/bin/piper *)',
    ]);
    expect(producerAllowedTools('piper').at(-1)).toBe('Bash(piper *)');
    expect(producerAllowedTools(null)).toEqual([...PRODUCER_BASE_ALLOWED_TOOLS]);
  });

  it('incluye las formas reescritas por el hook rtk', () => {
    const patterns = [...PRODUCER_BASE_ALLOWED_TOOLS];
    expect(patterns).toContain('Bash(rtk curl *)');
    expect(patterns).toContain('Bash(rtk ls *)');
    expect(patterns).toContain('Bash(rtk read *)');
  });
});

describe('buildProducerSystemPrompt', () => {
  it('delega en el builder de la lib y no anexa ningún archivo de skill', () => {
    const prompt = buildProducerSystemPrompt(CONTEXT);

    expect(prompt).toContain('# Your tools');
    expect(prompt).toContain('# This project');
    expect(prompt).toContain('get_project_overview');
  });

  it('traduce el contexto del proyecto (assets, timeline, guion) al que espera la lib', () => {
    const prompt = buildProducerSystemPrompt(CONTEXT);

    expect(prompt).toContain('- aroll: raw/aroll/clip01.mp4 (25.9s)');
    expect(prompt).toContain('- logo: raw/logo/logo.png');
    expect(prompt).toContain('already saved — read it with get_timeline');
  });

  it('avisa cuando no hay material todavía', () => {
    const prompt = buildProducerSystemPrompt({
      ...CONTEXT,
      assetSource: 'raw-scan',
      assets: [],
      hasTimeline: false,
    });

    expect(prompt).toContain('No material yet');
    expect(prompt).toContain('none yet');
  });

  it('declara el guion existente como EL guion cuando el proyecto ya tiene uno', () => {
    const prompt = buildProducerSystemPrompt({ ...CONTEXT, producerScript: 'timed' });
    expect(prompt).toContain('WITH time marks');
    expect(prompt).toContain('never ask the user for a scene table');
  });

  it('nunca menciona shell, ffmpeg/ffprobe, curl, piper, render-cli, pnpm ni el modelo del turno', () => {
    const prompt = buildProducerSystemPrompt(CONTEXT);
    for (const word of ['curl', 'ffmpeg', 'ffprobe', 'Bash', 'piper', 'render-cli', 'pnpm', '"model"']) {
      expect(prompt).not.toContain(word);
    }
  });
});
