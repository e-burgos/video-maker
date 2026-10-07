import { describe, expect, it } from 'vitest';

import { createFakeMotionDependencies, wavBytes } from './__fixtures__/fake-motion-dependencies';
import { runCli, USAGE } from './cli';

const P = '/work/promo';
const script = {
  voice: 'es_AR-daniela-high',
  lengthScale: 1.08,
  music: { file: 'tema.mp3', credit: 'Tema · CC BY 4.0' },
  scenes: [
    { id: 'hook', vo: 'Cuánto cuesta una pantalla apagada', minBars: 2 },
    { id: 'reveal', vo: 'Esto es Display Ads', minBars: 2, anchor: 10 },
  ],
  sfx: [{ id: 'riser', scene: 'reveal', offset: -2 }],
};
const resolvePath = (raw: string) => (raw.startsWith('/') ? raw : `/cwd/${raw}`);

function projectFiles(extra: Record<string, string | Uint8Array> = {}) {
  return {
    [`${P}/script.json`]: JSON.stringify(script),
    [`${P}/assets/music/tema.mp3`]: 'mp3',
    [`${P}/assets/audio/vo-hook.wav`]: wavBytes(3),
    [`${P}/assets/audio/vo-reveal.wav`]: wavBytes(1.5),
    ...extra,
  };
}

describe('runCli', () => {
  it('init copies the brand kit, the video template and its music into the project', async () => {
    const deps = createFakeMotionDependencies({
      files: {
        '/repo/templates/acme/_brand/brand/kit.css': 'css',
        '/repo/templates/acme/promo/script.json': JSON.stringify(script),
        '/repo/templates/acme/promo/index.html.tpl': 'tpl',
        '/repo/templates/acme/_music/tema.mp3': 'mp3',
      },
    });
    const outcome = await runCli(['init', 'acme/promo', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(deps.files.get(`${P}/assets/brand/kit.css`)).toBe('css');
    expect(deps.files.get(`${P}/index.html.tpl`)).toBe('tpl');
    expect(deps.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
  });

  it('init rejects an unknown template or a missing video name', async () => {
    const deps = createFakeMotionDependencies({});
    expect((await runCli(['init', 'acme/nope', P], resolvePath, deps)).stderr[0]).toContain('template acme/nope not found');
    expect((await runCli(['init', 'acme', P], resolvePath, deps)).exitCode).toBe(2);
    expect((await runCli(['init', 'acme/promo'], resolvePath, deps)).exitCode).toBe(2);
  });

  it('voice keeps the best take of each line, removes the rest and writes word timings', async () => {
    const deps = createFakeMotionDependencies({
      files: { [`${P}/script.json`]: JSON.stringify(script) },
      heard: (text, take) => (take === 0 ? 'y playas' : text),
      takeSeconds: (_, take) => 2 + take,
    });
    const outcome = await runCli(['voice', P, '--takes', '3'], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toMatch(/^voice hook: take 2\/2 · 1 ·/u);
    expect([...deps.files.keys()].filter((k) => k.includes('.take'))).toEqual([]);
    expect(deps.files.has(`${P}/assets/audio/vo-reveal.wav`)).toBe(true);
    const words = JSON.parse(String(deps.files.get(`${P}/words.json`)));
    expect(words.reveal[0]).toEqual({ w: 'Esto', t: 0, e: 0.25 });
  });

  it('voice rejects a non-positive --takes', async () => {
    const deps = createFakeMotionDependencies({ files: projectFiles() });
    expect((await runCli(['voice', P, '--takes', '0'], resolvePath, deps)).exitCode).toBe(2);
  });

  it('plan fits the grid, anchors the drop on a bar, trims the music and writes the timeline', async () => {
    const deps = createFakeMotionDependencies({ files: projectFiles() });
    const outcome = await runCli(['plan', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toMatch(/^plan: 120 BPM .* beat sync on/u);
    const timeline = JSON.parse(String(deps.files.get(`${P}/timeline.json`)));
    expect(timeline.scenes[1].start).toBe(10.04);
    expect(timeline.scenes[0].end).toBe(10.04);
    expect(timeline.musicCredit).toBe('Tema · CC BY 4.0');
    expect(deps.calls.some((c) => c.startsWith(`trimAudio ${P}/assets/audio/music.wav ${timeline.duration + 0.5}`))).toBe(true);
  });

  it('plan with --no-beat-sync follows the voice', async () => {
    const deps = createFakeMotionDependencies({ files: projectFiles() });
    await runCli(['plan', P, '--no-beat-sync'], resolvePath, deps);
    const timeline = JSON.parse(String(deps.files.get(`${P}/timeline.json`)));
    expect(timeline.beatSync).toBe(false);
    expect(timeline.scenes[0].end).toBe(3.8);
  });

  it('compose writes index.html from the template with the planned timing', async () => {
    const deps = createFakeMotionDependencies({
      files: projectFiles({ [`${P}/index.html.tpl`]: '<i data-start="{{start:reveal}}">{{sfx:riser}}</i>', [`${P}/words.json`]: '{}' }),
    });
    await runCli(['plan', P], resolvePath, deps);
    const outcome = await runCli(['compose', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(deps.files.get(`${P}/index.html`)).toBe('<i data-start="10.04">8.04</i>');
  });

  it('render delegates to hyperframes with the default output path and flags', async () => {
    const deps = createFakeMotionDependencies({});
    await runCli(['render', 'promo', '--fps', '60', '--quality', 'draft'], resolvePath, deps);
    await runCli(['render', P, '--out', '/out/v.mp4'], resolvePath, deps);
    expect(deps.renders).toEqual([
      { projectDir: '/cwd/promo', outPath: '/cwd/promo/renders/video.mp4', fps: 60, quality: 'draft' },
      { projectDir: P, outPath: '/out/v.mp4', fps: 30, quality: 'delivery' },
    ]);
  });

  it('prints usage for unknown commands and missing arguments, and the reason for stage failures', async () => {
    const deps = createFakeMotionDependencies({});
    const unknown = await runCli(['dance', P], resolvePath, deps);
    expect(unknown.exitCode).toBe(2);
    expect(unknown.stderr).toEqual(['motion-studio: unknown command "dance"', ...USAGE]);
    expect((await runCli([], resolvePath, deps)).exitCode).toBe(2);
    const missing = await runCli(['plan', P], resolvePath, deps);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr[0]).toContain('ENOENT');
  });
});
