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
  music: [{ id: 'tema', file: 'music/tema.mp3', credit: 'Tema · CC BY 4.0', bpm: 120, mood: 'energetic', drop: 10 }],
  voice: { id: 'es_AR-daniela-high', lengthScale: 1.08 },
};
const storyboard = {
  version: 1,
  title: 'Promo',
  brand: 'acme',
  format: '16:9',
  beatSync: true,
  music: { track: 'tema' },
  scenes: [
    { id: 'hook', kind: 'feature', vo: 'Mirá tu local', props: { title: 'Tu local', bullets: [], visual: { kind: 'image', src: 'images/local.jpg' } } },
    { id: 'cierre', kind: 'cta', vo: 'Probalo hoy', anchor: 'drop', props: { button: 'Probalo' } },
  ],
};
const brandFiles = () => ({ '/repo/assets/runtime/gsap.min.js': 'gsap', '/repo/assets/brands/acme/brand.json': JSON.stringify(brand), '/repo/assets/brands/acme/music/tema.mp3': 'mp3' });

describe('runCli', () => {
  it('init copies the shared runtime, the brand kit, the hand template and its music into the project', async () => {
    const deps = createFakeMotionDependencies({
      files: {
        '/repo/assets/runtime/gsap.min.js': 'gsap',
        '/repo/assets/brands/acme/brand.json': '{}',
        '/repo/assets/brands/acme/music/tema.mp3': 'mp3',
        '/repo/templates/acme/_brand/brand/kit.css': 'css',
        '/repo/templates/acme/promo/script.json': JSON.stringify(script),
        '/repo/templates/acme/promo/index.html.tpl': 'tpl',
      },
    });
    const outcome = await runCli(['init', 'acme/promo', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(deps.files.get(`${P}/assets/runtime/gsap.min.js`)).toBe('gsap');
    expect(deps.files.get(`${P}/assets/brand/kit.css`)).toBe('css');
    expect(deps.files.get(`${P}/index.html.tpl`)).toBe('tpl');
    expect(deps.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
  });

  it('storyboard composes the template and script from the catalog and copies brand, music and images', async () => {
    const deps = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/sb.json': JSON.stringify(storyboard), '/in/images/local.jpg': 'jpg' } });
    const outcome = await runCli(['storyboard', '/in/sb.json', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toContain('2 scenes · 16:9 · music tema.mp3');
    expect(String(deps.files.get(`${P}/index.html.tpl`))).toContain('data-scene="hook"');
    const written = JSON.parse(String(deps.files.get(`${P}/script.json`)));
    expect(written.music).toEqual({ file: 'tema.mp3', credit: 'Tema · CC BY 4.0' });
    expect(written.scenes[1]).toMatchObject({ id: 'cierre', anchor: 10 });
    expect(deps.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
    expect(deps.files.get(`${P}/images/local.jpg`)).toBe('jpg');
    expect(deps.files.has(`${P}/storyboard.json`)).toBe(true);
  });

  it('storyboard fails on a missing image, an unknown brand or an invalid storyboard', async () => {
    const missing = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/sb.json': JSON.stringify(storyboard) } });
    expect((await runCli(['storyboard', '/in/sb.json', P], resolvePath, missing)).stderr[0]).toContain('image "images/local.jpg" not found');
    const noBrand = createFakeMotionDependencies({ files: { '/in/sb.json': JSON.stringify(storyboard) } });
    expect((await runCli(['storyboard', '/in/sb.json', P], resolvePath, noBrand)).stderr[0]).toContain('brand "acme" not found');
    const invalid = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/sb.json': JSON.stringify({ ...storyboard, scenes: [] }) } });
    expect((await runCli(['storyboard', '/in/sb.json', P], resolvePath, invalid)).exitCode).toBe(1);
    expect((await runCli(['storyboard', '/in/sb.json'], resolvePath, invalid)).exitCode).toBe(2);
  });

  it('storyboard inside the project checks images in place and keeps the storyboard where it is', async () => {
    const silent = { ...storyboard, music: null };
    const deps = createFakeMotionDependencies({ files: { ...brandFiles(), [`${P}/storyboard.json`]: JSON.stringify(silent), [`${P}/images/local.jpg`]: 'jpg' } });
    const outcome = await runCli(['storyboard', `${P}/storyboard.json`, P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(JSON.parse(String(deps.files.get(`${P}/script.json`))).music).toBeNull();
    expect(deps.files.has(`${P}/assets/music/tema.mp3`)).toBe(false);
  });

  it('auto asks the agent with the brief, writes the storyboard and composes the project copying the brief images', async () => {
    const brief = { version: 1, brand: 'acme', script: 'Mirá tu local. Probalo hoy.', images: [{ file: 'local.jpg', caption: 'Un local' }] };
    const generated = {
      ...storyboard,
      format: '9:16',
      scenes: [
        { id: 'hook', kind: 'feature', vo: 'Mirá tu local', props: { title: 'Tu local', bullets: [{ text: 'Ok', cue: 'local' }], visual: { kind: 'image', src: 'images/local.jpg' } } },
        storyboard.scenes[1],
      ],
    };
    const deps = createFakeMotionDependencies({
      files: { ...brandFiles(), '/in/brief.json': JSON.stringify(brief), '/in/images/local.jpg': 'jpg' },
      answers: [generated],
      usage: { inputTokens: 1200, outputTokens: 300 },
    });
    const outcome = await runCli(['auto', '/in/brief.json', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toBe('auto: 2 scenes · repaired no · tokens in 1200 / out 300');
    expect(deps.asked[0]?.userPrompt).toContain('Mirá tu local. Probalo hoy.');
    expect(JSON.parse(String(deps.files.get(`${P}/storyboard.json`))).format).toBe('16:9');
    expect(String(deps.files.get(`${P}/index.html.tpl`))).toContain('data-scene="hook"');
    expect(deps.files.get(`${P}/images/local.jpg`)).toBe('jpg');
    expect(deps.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
  });

  it('auto reports a repair and the cost when the first answer breaks the cross-check', async () => {
    const brief = { version: 1, brand: 'acme', script: 'Hola', music: 'tema' };
    const broken = { ...storyboard, scenes: [{ ...storyboard.scenes[0], props: { ...storyboard.scenes[0]?.props, visual: { kind: 'image', src: 'images/ghost.jpg' } } }, storyboard.scenes[1]] };
    const fixed = { ...storyboard, scenes: [{ id: 'hook', kind: 'hook', vo: 'Mirá tu local', props: { lines: [{ title: 'Tu local' }] } }, storyboard.scenes[1]] };
    const deps = createFakeMotionDependencies({ files: { ...brandFiles(), '/in/brief.json': JSON.stringify(brief) }, answers: [broken, fixed] });
    const outcome = await runCli(['auto', '/in/brief.json', P], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toBe('auto: 2 scenes · repaired yes · tokens in 2000 / out 400');
    expect(deps.asked[1]?.userPrompt).toContain('images/ghost.jpg');
  });

  it('auto fails naming the field when the repair still breaks, and on an invalid brief, unknown brand or agent failure', async () => {
    const brief = { version: 1, brand: 'acme', script: 'Hola' };
    const broken = { ...storyboard, scenes: [{ ...storyboard.scenes[0], props: { ...storyboard.scenes[0]?.props, visual: { kind: 'image', src: 'images/ghost.jpg' } } }, storyboard.scenes[1]] };
    const files = { ...brandFiles(), '/in/brief.json': JSON.stringify(brief) };
    const stuck = await runCli(['auto', '/in/brief.json', P], resolvePath, createFakeMotionDependencies({ files, answers: [broken, broken] }));
    expect(stuck.exitCode).toBe(1);
    expect(stuck.stderr[0]).toContain('scenes[0].props.visual.src');
    const invalid = await runCli(['auto', '/in/brief.json', P], resolvePath, createFakeMotionDependencies({ files: { ...files, '/in/brief.json': '{"version":1,"brand":"acme"}' } }));
    expect(invalid.stderr[0]).toContain('brief.json is invalid');
    const noBrand = await runCli(['auto', '/in/brief.json', P], resolvePath, createFakeMotionDependencies({ files: { '/in/brief.json': JSON.stringify(brief) } }));
    expect(noBrand.stderr[0]).toContain('brand "acme" not found');
    const down = await runCli(['auto', '/in/brief.json', P], resolvePath, createFakeMotionDependencies({ files, answers: [new Error('offline')] }));
    expect(down.stderr[0]).toContain('offline');
    expect((await runCli(['auto', '/in/brief.json'], resolvePath, createFakeMotionDependencies({}))).exitCode).toBe(2);
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

  it('voice --only redoes the listed lines and keeps the other word timings', async () => {
    const previous = { hook: [{ w: 'previo', t: 0, e: 1 }], reveal: [{ w: 'viejo', t: 0, e: 1 }] };
    const deps = createFakeMotionDependencies({ files: { [`${P}/script.json`]: JSON.stringify(script), [`${P}/words.json`]: JSON.stringify(previous) } });
    const outcome = await runCli(['voice', P, '--only', 'reveal'], resolvePath, deps);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toHaveLength(1);
    expect(outcome.stdout[0]).toMatch(/^voice reveal:/u);
    expect(deps.files.has(`${P}/assets/audio/vo-hook.wav`)).toBe(false);
    const words = JSON.parse(String(deps.files.get(`${P}/words.json`)));
    expect(words.hook).toEqual(previous.hook);
    expect(words.reveal[0]).toEqual({ w: 'Esto', t: 0, e: 0.25 });
  });

  it('voice --only rejects a scene id that is not in the script', async () => {
    const deps = createFakeMotionDependencies({ files: projectFiles() });
    const outcome = await runCli(['voice', P, '--only', 'reveal,nope'], resolvePath, deps);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr[0]).toContain('unknown scene "nope"');
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

  it('plan without music paces scenes on a silent grid and skips beats and trimming', async () => {
    const deps = createFakeMotionDependencies({ files: projectFiles({ [`${P}/script.json`]: JSON.stringify({ ...script, music: null }) }) });
    const outcome = await runCli(['plan', P], resolvePath, deps);
    expect(outcome.stdout[0]).toMatch(/^plan: no music · 120 BPM pacing grid/u);
    expect(deps.calls.filter((c) => c.startsWith('detectBeats') || c.startsWith('trimAudio'))).toEqual([]);
    expect(JSON.parse(String(deps.files.get(`${P}/timeline.json`))).musicCredit).toBe('');
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
