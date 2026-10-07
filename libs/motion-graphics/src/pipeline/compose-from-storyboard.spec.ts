import { describe, expect, it } from 'vitest';

import { composeFromStoryboard } from './compose-from-storyboard';
import { createFakePipelinePorts } from './__fixtures__/fake-pipeline-ports';
import { P, brandFiles, storyboard } from './__fixtures__/pipeline-data';

describe('composeFromStoryboard', () => {
  it('composes the template and script from the catalog and copies brand, music and images', async () => {
    const ports = createFakePipelinePorts({ files: { ...brandFiles(), '/in/images/local.jpg': 'jpg' } });
    const { lines } = await composeFromStoryboard(ports, storyboard, '/in', P);
    expect(lines[0]).toContain('2 scenes · 16:9 · music tema.mp3');
    expect(String(ports.files.get(`${P}/index.html.tpl`))).toContain('data-scene="hook"');
    const written = JSON.parse(String(ports.files.get(`${P}/script.json`)));
    expect(written.music).toEqual({ file: 'tema.mp3', credit: 'Tema · CC BY 4.0' });
    expect(written.scenes[1]).toMatchObject({ id: 'cierre', anchor: 10 });
    expect(ports.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
    expect(ports.files.get(`${P}/images/local.jpg`)).toBe('jpg');
    expect(ports.files.has(`${P}/storyboard.json`)).toBe(true);
  });

  it('fails on a missing image or an unknown brand', async () => {
    const missing = createFakePipelinePorts({ files: brandFiles() });
    await expect(composeFromStoryboard(missing, storyboard, '/in', P)).rejects.toThrow('image "images/local.jpg" not found');
    await expect(composeFromStoryboard(createFakePipelinePorts({}), storyboard, '/in', P)).rejects.toThrow('brand "acme" not found');
  });

  it('inside the project checks images in place and keeps the storyboard where it is', async () => {
    const silent = { ...storyboard, music: null };
    const ports = createFakePipelinePorts({ files: { ...brandFiles(), [`${P}/images/local.jpg`]: 'jpg' } });
    await composeFromStoryboard(ports, silent, P, P);
    expect(JSON.parse(String(ports.files.get(`${P}/script.json`))).music).toBeNull();
    expect(ports.files.has(`${P}/assets/music/tema.mp3`)).toBe(false);
    expect(ports.files.has(`${P}/storyboard.json`)).toBe(false);
    await expect(composeFromStoryboard(createFakePipelinePorts({ files: brandFiles() }), silent, P, P)).rejects.toThrow('not found in the project');
  });
});
