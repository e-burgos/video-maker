import { describe, expect, it } from 'vitest';

import { testBrand } from '../__fixtures__/catalog-storyboard';
import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { generateMotionStoryboard } from './generate-motion-storyboard';
import type { AskResponse, AskStoryboardAgent } from './generate-motion-storyboard';
import type { MotionBrief } from './motion-brief';

const brief: MotionBrief = { version: 1, brand: 'acme', format: '16:9', beatSync: true, music: 'auto', script: 'Guion', images: [{ file: 'local.jpg', caption: 'Un local' }] };

const goodStoryboard: MotionStoryboard = {
  version: 1,
  title: 'Promo',
  brand: 'acme',
  format: '16:9',
  beatSync: true,
  music: { track: 'beat' },
  scenes: [
    { id: 'hook', kind: 'hook', vo: 'Una pantalla apagada', props: { lines: [{ title: 'Apagada', cue: 'apag' }] } },
    { id: 'cierre', kind: 'cta', vo: 'Probalo hoy', props: { button: 'Probalo', buttonCue: 'prob' } },
  ],
};

const badCue: MotionStoryboard = { ...goodStoryboard, scenes: [{ id: 'hook', kind: 'hook', vo: 'Una pantalla apagada', props: { lines: [{ title: 'Apagada', cue: 'ghost' }] } }, goodStoryboard.scenes[1] as MotionStoryboard['scenes'][number]] };

const response = (json: unknown, inputTokens = 100, outputTokens = 40, costUsd: number | null = null): AskResponse => ({ json, usage: { inputTokens, outputTokens, costUsd } });

function scriptedAsk(answers: Array<AskResponse | Error>) {
  const requests: Parameters<AskStoryboardAgent>[0][] = [];
  const ask: AskStoryboardAgent = async (request) => {
    requests.push(request);
    const next = answers[requests.length - 1];
    if (next === undefined || next instanceof Error) throw next ?? new Error('no more answers');
    return next;
  };
  return { ask, requests };
}

describe('generateMotionStoryboard', () => {
  it('returns the validated storyboard from a first valid answer without repairing', async () => {
    const { ask, requests } = scriptedAsk([response(goodStoryboard, 100, 40, 0.01)]);
    const result = await generateMotionStoryboard(ask, brief, testBrand);
    expect(result.repaired).toBe(false);
    expect(result.storyboard.scenes).toHaveLength(2);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 40, costUsd: 0.01 });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.systemPrompt).toContain('storyboard director');
  });

  it('imposes the brief over the answer before validating', async () => {
    const { ask } = scriptedAsk([response({ ...goodStoryboard, brand: 'other', format: '9:16', beatSync: false })]);
    const { storyboard } = await generateMotionStoryboard(ask, brief, testBrand);
    expect([storyboard.brand, storyboard.format, storyboard.beatSync]).toEqual(['acme', '16:9', true]);
  });

  it('anchors the brand reveal on the drop of the chosen track when the answer forgot it', async () => {
    const reveal = { id: 'logo', kind: 'brand-reveal' as const, vo: 'Esto es Acme', props: {} };
    const withReveal = (music: MotionStoryboard['music']) => ({ ...goodStoryboard, music, scenes: [goodStoryboard.scenes[0], reveal, goodStoryboard.scenes[1]] });
    const onDrop = await generateMotionStoryboard(scriptedAsk([response(withReveal({ track: 'beat' }))]).ask, brief, testBrand);
    expect(onDrop.storyboard.scenes[1]?.anchor).toBe('drop');
    const noDrop = await generateMotionStoryboard(scriptedAsk([response(withReveal({ track: 'calm' }))]).ask, brief, testBrand);
    expect(noDrop.storyboard.scenes[1]?.anchor).toBeUndefined();
  });

  it('drops a copied brand tagline and its accent from brand-reveal and cta so the brand tagline applies', async () => {
    const copied = `${testBrand.tagline} ${testBrand.taglineAccent ?? ''}`.trim();
    const answer = { ...goodStoryboard, scenes: [goodStoryboard.scenes[0], { id: 'logo', kind: 'brand-reveal', vo: 'Esto es Acme', props: { tagline: copied, accent: 'hoy mismo' } }, { id: 'cierre', kind: 'cta', vo: 'Probalo hoy', props: { tagline: 'Otra frase', accent: 'propia', button: 'Probalo' } }] };
    const { storyboard } = await generateMotionStoryboard(scriptedAsk([response(answer)]).ask, brief, testBrand);
    expect(storyboard.scenes[1]?.props).toEqual({});
    expect(storyboard.scenes[2]?.props).toEqual({ tagline: 'Otra frase', accent: 'propia', button: 'Probalo' });
  });

  it('repairs once sending the errors and the previous answer, and sums the usage', async () => {
    const { ask, requests } = scriptedAsk([response(badCue, 100, 40, 0.01), response(goodStoryboard, 150, 60, 0.02)]);
    const result = await generateMotionStoryboard(ask, brief, testBrand);
    expect(result.repaired).toBe(true);
    expect(result.usage.inputTokens).toBe(250);
    expect(result.usage.outputTokens).toBe(100);
    expect(result.usage.costUsd).toBeCloseTo(0.03);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.userPrompt).toContain('scenes[0].props.lines[0].cue');
    expect(requests[1]?.userPrompt).toContain('"ghost"');
    expect(requests[1]?.jsonSchema).toBe(requests[0]?.jsonSchema);
  });

  it('repairs a schema violation too, naming the field', async () => {
    const { ask, requests } = scriptedAsk([response({ ...goodStoryboard, scenes: [] }), response(goodStoryboard)]);
    expect((await generateMotionStoryboard(ask, brief, testBrand)).repaired).toBe(true);
    expect(requests[1]?.userPrompt).toContain('scenes');
  });

  it('leaves the cost unknown when the provider does not report it', async () => {
    const { ask } = scriptedAsk([response(badCue), response(goodStoryboard)]);
    expect((await generateMotionStoryboard(ask, brief, testBrand)).usage.costUsd).toBeNull();
  });

  it('throws STORYBOARD_INVALID with the issues when the repair still fails', async () => {
    const { ask, requests } = scriptedAsk([response(badCue), response(badCue)]);
    const error = await generateMotionStoryboard(ask, brief, testBrand).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MotionStudioError);
    expect((error as MotionStudioError).code).toBe('STORYBOARD_INVALID');
    expect((error as Error).message).toContain('scenes[0].props.lines[0].cue');
    expect(requests).toHaveLength(2);
  });

  it('throws AI_FAILED when the agent fails, on the first or on the repair ask', async () => {
    const first = await generateMotionStoryboard(scriptedAsk([new Error('boom')]).ask, brief, testBrand).catch((e: unknown) => e);
    expect((first as MotionStudioError).code).toBe('AI_FAILED');
    expect((first as Error).message).toContain('boom');
    const second = await generateMotionStoryboard(scriptedAsk([response(badCue), new Error('limit')]).ask, brief, testBrand).catch((e: unknown) => e);
    expect((second as MotionStudioError).code).toBe('AI_FAILED');
  });
});
