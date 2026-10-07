import { describe, expect, it } from 'vitest';

import { parseMotionBrief } from '../auto/motion-brief';
import { autoStoryboard } from './auto-storyboard';
import { createFakePipelinePorts } from './__fixtures__/fake-pipeline-ports';
import { P, brandFiles, storyboard } from './__fixtures__/pipeline-data';

const brokenImage = {
  ...storyboard,
  scenes: [{ ...storyboard.scenes[0], props: { ...storyboard.scenes[0]?.props, visual: { kind: 'image', src: 'images/ghost.jpg' } } }, storyboard.scenes[1]],
};

describe('autoStoryboard', () => {
  it('asks the agent with the brief, writes the storyboard and composes the project copying the brief images', async () => {
    const brief = parseMotionBrief({ version: 1, brand: 'acme', script: 'Mirá tu local. Probalo hoy.', images: [{ file: 'local.jpg', caption: 'Un local' }] });
    const generated = {
      ...storyboard,
      format: '9:16',
      scenes: [
        { id: 'hook', kind: 'feature', vo: 'Mirá tu local', props: { title: 'Tu local', bullets: [{ text: 'Ok', cue: 'local' }], visual: { kind: 'image', src: 'images/local.jpg' } } },
        storyboard.scenes[1],
      ],
    };
    const ports = createFakePipelinePorts({ files: { ...brandFiles(), '/in/images/local.jpg': 'jpg' }, answers: [generated], usage: { inputTokens: 1200, outputTokens: 300 } });
    const result = await autoStoryboard(ports, brief, '/in', P);
    expect(result.lines[0]).toBe('auto: 2 scenes · repaired no · tokens in 1200 / out 300');
    expect(result.repaired).toBe(false);
    expect(result.usage).toMatchObject({ inputTokens: 1200, outputTokens: 300 });
    expect(ports.asked[0]?.userPrompt).toContain('Mirá tu local. Probalo hoy.');
    expect(JSON.parse(String(ports.files.get(`${P}/storyboard.json`))).format).toBe('16:9');
    expect(String(ports.files.get(`${P}/index.html.tpl`))).toContain('data-scene="hook"');
    expect(ports.files.get(`${P}/images/local.jpg`)).toBe('jpg');
    expect(ports.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
  });

  it('reports a repair and the cost when the first answer breaks the cross-check', async () => {
    const brief = parseMotionBrief({ version: 1, brand: 'acme', script: 'Hola', music: 'tema' });
    const fixed = { ...storyboard, scenes: [{ id: 'hook', kind: 'hook', vo: 'Mirá tu local', props: { lines: [{ title: 'Tu local' }] } }, storyboard.scenes[1]] };
    const ports = createFakePipelinePorts({ files: brandFiles(), answers: [brokenImage, fixed] });
    const result = await autoStoryboard(ports, brief, '/in', P);
    expect(result.lines[0]).toBe('auto: 2 scenes · repaired yes · tokens in 2000 / out 400');
    expect(result.repaired).toBe(true);
    expect(ports.asked[1]?.userPrompt).toContain('images/ghost.jpg');
  });

  it('fails naming the field when the repair still breaks, on an unknown brand and on agent failure', async () => {
    const brief = parseMotionBrief({ version: 1, brand: 'acme', script: 'Hola' });
    await expect(autoStoryboard(createFakePipelinePorts({ files: brandFiles(), answers: [brokenImage, brokenImage] }), brief, '/in', P)).rejects.toThrow('scenes[0].props.visual.src');
    await expect(autoStoryboard(createFakePipelinePorts({}), brief, '/in', P)).rejects.toThrow('brand "acme" not found');
    await expect(autoStoryboard(createFakePipelinePorts({ files: brandFiles(), answers: [new Error('offline')] }), brief, '/in', P)).rejects.toThrow('offline');
  });
});
