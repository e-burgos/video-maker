import { describe, expect, it } from 'vitest';

import { composeProject } from './compose-project';
import { planProject } from './plan-project';
import { renderProject } from './render-project';
import { createFakePipelinePorts } from './__fixtures__/fake-pipeline-ports';
import { P, projectFiles, script } from './__fixtures__/pipeline-data';

describe('planProject', () => {
  it('fits the grid, anchors the drop on a bar, trims the music and writes the timeline', async () => {
    const ports = createFakePipelinePorts({ files: projectFiles() });
    const { lines, timeline } = await planProject(ports, P, { beatSync: true });
    expect(lines[0]).toMatch(/^plan: 120 BPM .* beat sync on/u);
    const written = JSON.parse(String(ports.files.get(`${P}/timeline.json`)));
    expect(written).toEqual(timeline);
    expect(written.scenes[1].start).toBe(10.04);
    expect(written.scenes[0].end).toBe(10.04);
    expect(written.musicCredit).toBe('Tema · CC BY 4.0');
    expect(ports.calls.some((c) => c.startsWith(`trimAudio ${P}/assets/audio/music.wav ${written.duration + 0.5}`))).toBe(true);
  });

  it('with beatSync off follows the voice', async () => {
    const ports = createFakePipelinePorts({ files: projectFiles() });
    await planProject(ports, P, { beatSync: false });
    const timeline = JSON.parse(String(ports.files.get(`${P}/timeline.json`)));
    expect(timeline.beatSync).toBe(false);
    expect(timeline.scenes[0].end).toBe(3.8);
  });

  it('keeps the music bed at its volume and ducks it well under the voice, default volume 0.5', async () => {
    const levels = async (music: unknown) => {
      const ports = createFakePipelinePorts({ files: projectFiles({ [`${P}/script.json`]: JSON.stringify({ ...script, music }) }) });
      const { timeline } = await planProject(ports, P, { beatSync: true });
      return Math.max(...timeline.musicAutomation.lanes[0].points.map((p) => p.v));
    };
    expect(await levels({ file: 'tema.mp3', credit: 'Tema · CC BY 4.0' })).toBe(0.5);
    expect(await levels({ file: 'tema.mp3', credit: 'Tema · CC BY 4.0', volume: 0.2 })).toBe(0.2);
  });

  it('without music paces scenes on a silent grid and skips beats and trimming', async () => {
    const ports = createFakePipelinePorts({ files: projectFiles({ [`${P}/script.json`]: JSON.stringify({ ...script, music: null }) }) });
    const { lines } = await planProject(ports, P, { beatSync: true });
    expect(lines[0]).toMatch(/^plan: no music · 120 BPM pacing grid/u);
    expect(ports.calls.filter((c) => c.startsWith('detectBeats') || c.startsWith('trimAudio'))).toEqual([]);
    expect(JSON.parse(String(ports.files.get(`${P}/timeline.json`))).musicCredit).toBe('');
  });

  it('fails when the project has no voice yet', async () => {
    const ports = createFakePipelinePorts({ files: { [`${P}/script.json`]: JSON.stringify(script) } });
    await expect(planProject(ports, P, { beatSync: true })).rejects.toThrow('ENOENT');
  });
});

describe('composeProject', () => {
  it('writes index.html from the template with the planned timing', async () => {
    const ports = createFakePipelinePorts({
      files: projectFiles({ [`${P}/index.html.tpl`]: '<i data-start="{{start:reveal}}">{{sfx:riser}}</i>', [`${P}/words.json`]: '{}' }),
    });
    await planProject(ports, P, { beatSync: true });
    const result = await composeProject(ports, P);
    expect(ports.files.get(`${P}/index.html`)).toBe('<i data-start="10.04">8.04</i>');
    expect(result.scenes).toBe(2);
    expect(result.lines[0]).toBe(`compose: index.html · 2 scenes · ${result.durationSec} s`);
  });
});

describe('renderProject', () => {
  it('leaves the music credit next to the video for the post description instead of on screen', async () => {
    const ports = createFakePipelinePorts({ files: { [`${P}/timeline.json`]: JSON.stringify({ musicCredit: '"Tema" Autor · CC BY 4.0' }) } });
    const result = await renderProject(ports, P, { outPath: '/out/v.mp4', fps: 30, quality: 'delivery' });
    expect(ports.files.get('/out/v.credits.txt')).toBe('Música: "Tema" Autor · CC BY 4.0\n');
    expect(result.lines).toEqual(['render: /out/v.mp4', 'credits: /out/v.credits.txt']);
    expect(result.musicCredit).toBe('"Tema" Autor · CC BY 4.0');
  });

  it('writes no credits file for a silent video', async () => {
    const ports = createFakePipelinePorts({ files: { [`${P}/timeline.json`]: JSON.stringify({ musicCredit: '' }) } });
    await renderProject(ports, P, { outPath: '/out/v.mp4', fps: 30, quality: 'delivery' });
    expect(ports.files.has('/out/v.credits.txt')).toBe(false);
  });

  it('delegates to the render port with the given output, fps and quality', async () => {
    const ports = createFakePipelinePorts({});
    const result = await renderProject(ports, P, { outPath: '/out/v.mp4', fps: 60, quality: 'draft' });
    expect(ports.renders).toEqual([{ projectDir: P, outPath: '/out/v.mp4', fps: 60, quality: 'draft' }]);
    expect(result).toEqual({ lines: ['render: /out/v.mp4'], outPath: '/out/v.mp4', creditsPath: null, musicCredit: null });
  });
});
