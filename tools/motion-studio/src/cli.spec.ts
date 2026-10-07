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
  sfx: [],
};
const resolvePath = (raw: string) => (raw.startsWith('/') ? raw : `/cwd/${raw}`);
const projectFiles = () => ({
  [`${P}/script.json`]: JSON.stringify(script),
  [`${P}/assets/music/tema.mp3`]: 'mp3',
  [`${P}/assets/audio/vo-hook.wav`]: wavBytes(3),
  [`${P}/assets/audio/vo-reveal.wav`]: wavBytes(1.5),
});
const brand = {
  id: 'acme',
  name: 'Acme',
  spokenName: 'Acme',
  tagline: 'Todo bajo control.',
  logo: 'img/logo.svg',
  isotipo: 'img/iso.svg',
  css: 'brand.css',
  fonts: [{ family: 'Inter', file: 'fonts/inter.woff2' }],
  devices: {},
  images: {},
  music: [{ id: 'tema', file: 'music/tema.mp3', credit: 'Tema', bpm: 120, mood: 'energetic', drop: 10 }],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};
const storyboard = {
  version: 1,
  title: 'Promo',
  brand: 'acme',
  format: '16:9',
  beatSync: true,
  music: null,
  scenes: [
    { id: 'uno', kind: 'cta', vo: 'Mirá', props: { button: 'Ver' } },
    { id: 'cierre', kind: 'cta', vo: 'Probalo hoy', props: { button: 'Probalo' } },
  ],
};
const brandFiles = () => ({ '/repo/assets/runtime/gsap.min.js': 'gsap', '/repo/assets/brands/acme/brand.json': JSON.stringify(brand) });

describe('runCli', () => {
  it('init resolves both paths and delegates with the templates root', async () => {
    const deps = createFakeMotionDependencies({
      files: {
        ...brandFiles(),
        '/repo/templates/acme/promo/script.json': JSON.stringify({ ...script, music: null }),
        '/repo/templates/acme/promo/index.html.tpl': 'tpl',
      },
    });
    const outcome = await runCli(['init', 'acme/promo', 'out'], resolvePath, deps);
    expect(outcome).toEqual({ exitCode: 0, stdout: ['init: acme/promo → /cwd/out'], stderr: [] });
    expect(deps.files.get('/cwd/out/index.html.tpl')).toBe('tpl');
    expect((await runCli(['init', 'acme/nope', P], resolvePath, deps)).stderr[0]).toContain('template acme/nope not found');
    expect((await runCli(['init', 'acme', P], resolvePath, deps)).exitCode).toBe(2);
    expect((await runCli(['init', 'acme/promo'], resolvePath, deps)).exitCode).toBe(2);
  });

  it('storyboard parses the file, composes next to it and fails with the right exit code', async () => {
    const deps = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/sb.json': JSON.stringify(storyboard) } });
    const outcome = await runCli(['storyboard', '/in/sb.json', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toContain('2 scenes · 16:9 · music none');
    expect(deps.files.has(`${P}/storyboard.json`)).toBe(true);
    const invalid = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/sb.json': JSON.stringify({ ...storyboard, scenes: [] }) } });
    expect((await runCli(['storyboard', '/in/sb.json', P], resolvePath, invalid)).exitCode).toBe(1);
    expect((await runCli(['storyboard', '/in/sb.json'], resolvePath, invalid)).exitCode).toBe(2);
  });

  it('auto parses the brief, runs the agent and prints the usage line first', async () => {
    const brief = { version: 1, brand: 'acme', script: 'Probalo hoy' };
    const deps = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/brief.json': JSON.stringify(brief) }, answers: [storyboard], usage: { inputTokens: 1200, outputTokens: 300 } });
    const outcome = await runCli(['auto', '/in/brief.json', P], resolvePath, deps);
    expect(outcome.stdout[0]).toBe('auto: 2 scenes · repaired no · tokens in 1200 / out 300');
    const invalid = await runCli(['auto', '/in/brief.json', P], resolvePath, createFakeMotionDependencies({ files: { '/in/brief.json': '{"version":1,"brand":"acme"}' } }));
    expect(invalid.stderr[0]).toContain('brief.json is invalid');
    expect((await runCli(['auto', '/in/brief.json'], resolvePath, deps)).exitCode).toBe(2);
  });

  it('voice parses --takes and --only and rejects a non-positive --takes or an unknown scene', async () => {
    const deps = createFakeMotionDependencies({ files: { [`${P}/script.json`]: JSON.stringify(script) } });
    const outcome = await runCli(['voice', P, '--takes', '2', '--only', ' reveal '], resolvePath, deps);
    expect(outcome.stdout).toHaveLength(1);
    expect(outcome.stdout[0]).toMatch(/^voice reveal:/u);
    expect((await runCli(['voice', P, '--takes', '0'], resolvePath, deps)).exitCode).toBe(2);
    const unknown = await runCli(['voice', P, '--only', 'nope'], resolvePath, deps);
    expect(unknown.exitCode).toBe(2);
    expect(unknown.stderr[0]).toContain('unknown scene "nope"');
  });

  it('plan maps --no-beat-sync to beatSync off and compose reads what plan wrote', async () => {
    const deps = createFakeMotionDependencies({ files: { ...projectFiles(), [`${P}/index.html.tpl`]: '<i>{{start:reveal}}</i>', [`${P}/words.json`]: '{}' } });
    const synced = await runCli(['plan', P], resolvePath, deps);
    expect(synced.stdout[0]).toMatch(/^plan: 120 BPM .* beat sync on/u);
    const free = await runCli(['plan', P, '--no-beat-sync'], resolvePath, deps);
    expect(free.stdout[0]).toMatch(/beat sync off/u);
    expect((await runCli(['compose', P], resolvePath, deps)).stdout[0]).toMatch(/^compose: index\.html · 2 scenes/u);
  });

  it('render delegates to hyperframes with the default output path and flags', async () => {
    const deps = createFakeMotionDependencies({});
    const first = await runCli(['render', 'promo', '--fps', '60', '--quality', 'draft'], resolvePath, deps);
    await runCli(['render', P, '--out', '/out/v.mp4'], resolvePath, deps);
    expect(first.stdout).toEqual(['render: /cwd/promo/renders/video.mp4']);
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
