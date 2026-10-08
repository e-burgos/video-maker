import { describe, expect, it } from 'vitest';

import { voiceProject } from './voice-project';
import { createFakePipelinePorts } from './__fixtures__/fake-pipeline-ports';
import { P, projectFiles, script } from './__fixtures__/pipeline-data';

describe('voiceProject', () => {
  it('keeps the best take of each line, removes the rest and writes word timings', async () => {
    const ports = createFakePipelinePorts({
      files: { [`${P}/script.json`]: JSON.stringify(script) },
      heard: (text, take) => (take === 0 ? 'y playas' : text),
      takeSeconds: (_, take) => 2 + take,
    });
    const result = await voiceProject(ports, P, { takes: 3 });
    expect(result.lines[0]).toMatch(/^voice hook: take 2\/2 · 1 ·/u);
    expect(result.voiced[0]).toMatchObject({ sceneId: 'hook', take: 2, attempts: 2, score: 1 });
    expect([...ports.files.keys()].filter((k) => k.includes('.take'))).toEqual([]);
    expect(ports.files.has(`${P}/assets/audio/vo-reveal.wav`)).toBe(true);
    const words = JSON.parse(String(ports.files.get(`${P}/words.json`)));
    expect(words.reveal[0]).toEqual({ w: 'Esto', t: 0, e: 0.25 });
  });

  it('reports each finished line through onLine with the running count', async () => {
    const ports = createFakePipelinePorts({ files: { [`${P}/script.json`]: JSON.stringify(script) } });
    const progress: Array<[string, number, number]> = [];
    await voiceProject(ports, P, { takes: 1, onLine: (line) => progress.push([line.sceneId, line.done, line.total]) });
    expect(progress).toEqual([
      ['hook', 1, 2],
      ['reveal', 2, 2],
    ]);
  });

  it('--only redoes the listed lines and keeps the other word timings', async () => {
    const previous = { hook: [{ w: 'previo', t: 0, e: 1 }], reveal: [{ w: 'viejo', t: 0, e: 1 }] };
    const ports = createFakePipelinePorts({ files: { [`${P}/script.json`]: JSON.stringify(script), [`${P}/words.json`]: JSON.stringify(previous) } });
    const result = await voiceProject(ports, P, { takes: 5, only: ['reveal'] });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatch(/^voice reveal:/u);
    expect(ports.files.has(`${P}/assets/audio/vo-hook.wav`)).toBe(false);
    const words = JSON.parse(String(ports.files.get(`${P}/words.json`)));
    expect(words.hook).toEqual(previous.hook);
    expect(words.reveal[0]).toEqual({ w: 'Esto', t: 0, e: 0.25 });
  });

  it('reuseUnchanged re-voices only the scenes whose line or voice changed since the last pass', async () => {
    const ports = createFakePipelinePorts({ files: { [`${P}/script.json`]: JSON.stringify(script) } });
    await voiceProject(ports, P, { takes: 1 });
    const firstPass = ports.calls.filter((c) => c.startsWith('synthesize')).length;
    const edited = { ...script, scenes: script.scenes.map((scene) => (scene.id === 'reveal' ? { ...scene, vo: 'Esto es Acme, ahora' } : scene)) };
    ports.files.set(`${P}/script.json`, JSON.stringify(edited));
    const progress: Array<[string, number, number]> = [];
    const result = await voiceProject(ports, P, { takes: 1, reuseUnchanged: true, onLine: (line) => progress.push([line.sceneId, line.done, line.total]) });
    expect(ports.calls.filter((c) => c.startsWith('synthesize')).length - firstPass).toBe(1);
    expect(result.lines).toEqual([expect.stringMatching(/^voice hook: reused/u), expect.stringMatching(/^voice reveal: take 1\/1/u)]);
    expect(progress).toEqual([['hook', 1, 2], ['reveal', 2, 2]]);
    const words = JSON.parse(String(ports.files.get(`${P}/words.json`)));
    expect(Object.keys(words).sort()).toEqual(['hook', 'reveal']);
  });

  it('reuseUnchanged voices everything when there is no previous pass', async () => {
    const ports = createFakePipelinePorts({ files: { [`${P}/script.json`]: JSON.stringify(script) } });
    const result = await voiceProject(ports, P, { takes: 1, reuseUnchanged: true });
    expect(result.lines.every((line) => !line.includes('reused'))).toBe(true);
  });

  it('--only rejects a scene id that is not in the script', async () => {
    const ports = createFakePipelinePorts({ files: projectFiles() });
    await expect(voiceProject(ports, P, { takes: 5, only: ['reveal', 'nope'] })).rejects.toThrow('unknown scene "nope"');
  });
});
