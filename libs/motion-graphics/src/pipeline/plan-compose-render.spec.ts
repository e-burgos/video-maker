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
    expect(ports.calls.some((c) => c === `trimAudio ${P}/assets/audio/music.wav ${written.duration + 0.5} -24`)).toBe(true);
  });

  it('with beatSync off follows the voice', async () => {
    const ports = createFakePipelinePorts({ files: projectFiles() });
    await planProject(ports, P, { beatSync: false });
    const timeline = JSON.parse(String(ports.files.get(`${P}/timeline.json`)));
    expect(timeline.beatSync).toBe(false);
    expect(timeline.scenes[0].end).toBe(3.8);
  });

  it.each([
    ['ElevenLabs voice at -22 LUFS', -22, 0.198],
    ['Piper voice at -25.5 LUFS', -25.5, 0.132],
  ])('plans the music at the calibrated bed and a duck derived from a %s, whatever the script volume', async (_label, voiceLufs, duck) => {
    const levels = async (music: unknown) => {
      const ports = createFakePipelinePorts({ voiceLufs, files: projectFiles({ [`${P}/script.json`]: JSON.stringify({ ...script, music }) }) });
      const { timeline } = await planProject(ports, P, { beatSync: true });
      const values = timeline.musicAutomation.lanes[0].points.map((p) => p.v);
      return { max: Math.max(...values), under: Math.min(...values.filter((v) => v > 0)) };
    };
    const base = { file: 'tema.mp3', credit: 'Tema · CC BY 4.0' };
    expect(await levels(base)).toEqual({ max: 0.885, under: duck });
    expect(await levels({ ...base, volume: 0.15 })).toEqual({ max: 0.885, under: duck });
  });

  it("music.mode 'segments' plans the music by segments and 'bed' or no mode keeps the duck bed", async () => {
    const plan = async (music: unknown) => {
      const ports = createFakePipelinePorts({ files: projectFiles({ [`${P}/script.json`]: JSON.stringify({ ...script, music }) }) });
      const { timeline } = await planProject(ports, P, { beatSync: true });
      return timeline.musicAutomation;
    };
    const base = { file: 'tema.mp3', credit: 'Tema · CC BY 4.0' };
    const bed = await plan(base);
    expect(await plan({ ...base, mode: 'bed' })).toEqual(bed);
    const segments = await plan({ ...base, mode: 'segments' });
    expect(segments).not.toEqual(bed);
    expect(Math.min(...segments.lanes[0].points.map((p) => p.v))).toBe(0);
    expect(segments.lanes[0].points.some((p) => p.v === 0.198)).toBe(true);
    const customFloor = await plan({ ...base, mode: 'segments', floorDb: -20 });
    expect(customFloor.lanes[0].points.some((p) => p.v === 0.0885)).toBe(true);
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

  it('renders a sample from the composition cut to the requested duration and puts the full one back afterwards', async () => {
    const html = '<div data-composition-id="motion" data-duration="60"></div>';
    const ports = createFakePipelinePorts({ files: { [`${P}/index.html`]: html } });
    let seenByTheRender = '';
    const render = ports.render.bind(ports);
    ports.render = async (request) => {
      seenByTheRender = String(ports.files.get(`${P}/index.html`));
      await render(request);
    };

    await renderProject(ports, P, { outPath: '/out/v.sample.mp4', fps: 30, quality: 'delivery', sampleSeconds: 10 });

    expect(seenByTheRender).toBe('<div data-composition-id="motion" data-duration="10"></div>');
    expect(ports.files.get(`${P}/index.html`)).toBe(html);
    expect(ports.renders).toEqual([{ projectDir: P, outPath: '/out/v.sample.mp4', fps: 30, quality: 'delivery' }]);
  });

  it('leaves no credits file next to a sample', async () => {
    const files = { [`${P}/index.html`]: '<div data-composition-id="motion" data-duration="60"></div>', [`${P}/timeline.json`]: JSON.stringify({ musicCredit: 'Tema · CC BY 4.0' }) };
    const ports = createFakePipelinePorts({ files });

    const result = await renderProject(ports, P, { outPath: '/out/v.sample.mp4', fps: 30, quality: 'delivery', sampleSeconds: 10 });

    expect(ports.files.has('/out/v.sample.credits.txt')).toBe(false);
    expect(result.creditsPath).toBeNull();
  });

  it('puts the full composition back even when the sample render fails', async () => {
    const html = '<div data-composition-id="motion" data-duration="60"></div>';
    const ports = createFakePipelinePorts({ files: { [`${P}/index.html`]: html } });
    ports.render = async () => {
      throw new Error('chrome crashed');
    };

    await expect(renderProject(ports, P, { outPath: '/out/v.sample.mp4', fps: 30, quality: 'delivery', sampleSeconds: 10 })).rejects.toThrow('chrome crashed');

    expect(ports.files.get(`${P}/index.html`)).toBe(html);
  });
});
