#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;
const WORDS_PER_SECOND = 2.5;
const LINE_MARGIN_SECONDS = 0.6;
const LEAD_IN_SECONDS = 1.5;
const TAIL_MS = 1200;

export const FORMATS = {
  'youtube-16x9': { viewport: { width: 1600, height: 900 }, scale: 1, output: { width: 1920, height: 1080 } },
  'reels-9x16': { viewport: { width: 540, height: 960 }, scale: 2, output: { width: 1080, height: 1920 } },
  'tiktok-9x16': { viewport: { width: 540, height: 960 }, scale: 2, output: { width: 1080, height: 1920 } },
  'shorts-9x16': { viewport: { width: 540, height: 960 }, scale: 2, output: { width: 1080, height: 1920 } },
};

function readDotEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')).replace(/^export\s+/u, '').trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/u, '$2')]),
  );
}

export function hostEnv(cwd = process.cwd()) {
  return { ...readDotEnv(join(cwd, '.env')), ...readDotEnv(join(cwd, '.env.local')), ...process.env };
}

const env = hostEnv();
const FFMPEG = env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = env.FFPROBE_PATH || 'ffprobe';

function loadPlaywright() {
  const bases = [env.VIDEO_MAKER_PLAYWRIGHT_DIR, process.cwd(), SCRIPT_DIR].filter(Boolean);
  for (const base of bases) {
    const requireFrom = createRequire(join(resolve(base), 'noop.js'));
    for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
      try {
        return requireFrom(name);
      } catch {}
    }
  }
  throw new Error(
    'Playwright is not installed where this script can find it. Either the host project already has it ' +
      '(playwright or @playwright/test), or install it outside the repo: ' +
      'npm install --prefix ~/.video-maker/recorder playwright && export VIDEO_MAKER_PLAYWRIGHT_DIR=~/.video-maker/recorder. ' +
      'Then install the browser once: npx playwright install chromium',
  );
}

function hasFfmpeg() {
  try {
    execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const cursorScript = (color) => `(() => {
  const add = () => {
    if (document.getElementById('__vm_cursor')) return;
    const c = document.createElement('div');
    c.id = '__vm_cursor';
    c.style.cssText = 'position:fixed;left:-100px;top:-100px;z-index:2147483647;width:18px;height:18px;border-radius:50%;'
      + 'background:${color}55;border:2px solid ${color};pointer-events:none;transform:translate(-50%,-50%);'
      + 'box-shadow:0 0 0 5px ${color}22;transition:width .08s,height .08s';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.width = '30px'; c.style.height = '30px'; }, true);
    addEventListener('mouseup', () => { c.style.width = '18px'; c.style.height = '18px'; }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  setInterval(add, 1500);
})()`;

const maskStyle = (selectors) => `${selectors.join(',')}{filter:blur(7px)!important;}`;

export const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const randomBetween = (low, high) => low + Math.random() * (high - low);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wordCount = (sentence) => sentence.trim().split(/\s+/u).length;
const round1 = (value) => Math.round(value * 10) / 10;

function createHumanPointer(page, pace) {
  const position = { x: 200, y: 200 };
  const pause = (ms) => page.waitForTimeout(Math.round(ms * pace));

  async function moveTo(x, y) {
    const distance = Math.hypot(x - position.x, y - position.y);
    if (distance < 2) return;
    const durationMs = Math.min(420, 110 + Math.sqrt(distance) * 12) * randomBetween(0.9, 1.1);
    const bend = Math.min(90, distance * 0.18) * (Math.random() < 0.5 ? -1 : 1);
    const normal = { x: -(y - position.y) / distance, y: (x - position.x) / distance };
    const start = { ...position };
    const c1 = { x: start.x + (x - start.x) * 0.3 + normal.x * bend, y: start.y + (y - start.y) * 0.3 + normal.y * bend };
    const c2 = { x: start.x + (x - start.x) * 0.7 + normal.x * bend * 0.5, y: start.y + (y - start.y) * 0.7 + normal.y * bend * 0.5 };
    const startedAt = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      const e = easeInOut(t);
      const u = 1 - e;
      const px = u * u * u * start.x + 3 * u * u * e * c1.x + 3 * u * e * e * c2.x + e * e * e * x;
      const py = u * u * u * start.y + 3 * u * u * e * c1.y + 3 * u * e * e * c2.y + e * e * e * y;
      const before = Date.now();
      await page.mouse.move(t < 1 ? px + randomBetween(-0.6, 0.6) : x, t < 1 ? py + randomBetween(-0.6, 0.6) : y);
      if (t >= 1) break;
      const spent = Date.now() - before;
      if (spent < 12) await page.waitForTimeout(12 - spent);
    }
    if (distance > 400 && Math.random() < 0.3) {
      await page.mouse.move(x + ((x - start.x) / distance) * randomBetween(4, 8), y + ((y - start.y) / distance) * randomBetween(4, 8));
      await page.waitForTimeout(randomBetween(30, 55));
      await page.mouse.move(x, y);
    }
    position.x = x;
    position.y = y;
  }

  async function pointAt(locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox().catch(() => null);
    if (!box) return null;
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const left = Math.max(0, box.x);
    const right = Math.min(viewport.width, box.x + box.width);
    const top = Math.max(0, box.y);
    const bottom = Math.min(viewport.height, box.y + box.height);
    if (right - left < 2 || bottom - top < 2) return null;
    const target = { x: left + (right - left) * randomBetween(0.38, 0.62), y: top + (bottom - top) * randomBetween(0.38, 0.62) };
    await moveTo(target.x, target.y);
    await pause(randomBetween(35, 80));
    return target;
  }

  async function click(locator, waitMs = 900) {
    const target = await pointAt(locator);
    if (target) {
      await page.mouse.down();
      await page.waitForTimeout(randomBetween(35, 75));
      await page.mouse.up();
    } else {
      await locator.click({ timeout: 20000 });
    }
    await pause(waitMs);
  }

  async function preciseClick(locator, waitMs = 900) {
    await pointAt(locator).catch(() => null);
    await locator.click({ timeout: 20000 });
    const box = await locator.boundingBox().catch(() => null);
    if (box) {
      position.x = box.x + box.width / 2;
      position.y = box.y + box.height / 2;
    }
    await pause(waitMs);
  }

  async function type(locator, text, waitMs = 700) {
    await pointAt(locator);
    await locator.click({ timeout: 15000 }).catch(() => {});
    await pause(randomBetween(150, 300));
    for (const character of text) {
      await page.keyboard.type(character);
      await page.waitForTimeout(/[\s.,;:—-]/u.test(character) ? randomBetween(90, 190) : randomBetween(35, 95));
    }
    await pause(waitMs);
  }

  return { moveTo, pointAt, click, preciseClick, type, pause };
}

function speedUpFilter(trimStart, waits, width, height) {
  const pieces = [];
  let cursor = trimStart;
  const normal = (from, to) => `trim=start=${from.toFixed(3)}${to === null ? '' : `:end=${to.toFixed(3)}`},setpts=PTS-STARTPTS`;
  for (const wait of waits) {
    if (wait.from > cursor + 0.05) pieces.push(normal(cursor, wait.from));
    pieces.push(`trim=start=${wait.from.toFixed(3)}:end=${wait.to.toFixed(3)},setpts=(PTS-STARTPTS)*${(wait.output / (wait.to - wait.from)).toFixed(5)}`);
    cursor = wait.to;
  }
  pieces.push(normal(cursor, null));
  const labelled = pieces.map((filter, index) => `[0:v]${filter}[p${index}]`).join(';');
  const joined = pieces.map((_, index) => `[p${index}]`).join('');
  return `${labelled};${joined}concat=n=${pieces.length}:v=1:a=0,${scaleFilter(width, height)}[v]`;
}

function scaleFilter(width, height) {
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=30`;
}

function finalTime(t, trimStart, waits) {
  let removed = trimStart;
  for (const wait of waits) {
    const length = wait.to - wait.from;
    if (t >= wait.to) removed += length - wait.output;
    else if (t > wait.from) removed += (t - wait.from) * (1 - wait.output / length);
  }
  return round1(t - removed);
}

const ENCODE_ARGS = ['-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

export function probe(file) {
  const json = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration', '-of', 'json', file]).toString();
  const { streams = [], format = {} } = JSON.parse(json);
  const video = streams.find((stream) => stream.codec_type === 'video') ?? {};
  const [numerator, denominator] = String(video.r_frame_rate ?? '0/1').split('/').map(Number);
  const duration = Number(format.duration);
  return {
    durationSec: Number.isFinite(duration) ? round1(duration) : null,
    width: video.width ?? null,
    height: video.height ?? null,
    fps: denominator ? Math.round((numerator / denominator) * 100) / 100 : null,
    pixFmt: video.pix_fmt ?? null,
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  };
}

export function verifyRecording({ aroll, script, format }) {
  const errors = [];
  const warnings = [];
  const info = probe(aroll);
  const vertical = format.endsWith('9x16');
  if ((info.height > info.width) !== vertical) errors.push(`orientation does not match ${format}`);
  if (info.pixFmt !== 'yuv420p') errors.push(`pix_fmt ${info.pixFmt}, expected yuv420p`);
  if (info.fps && (info.fps < 25 || info.fps > 60)) errors.push(`${info.fps} fps outside 25-60`);
  if (info.hasAudio) warnings.push('the recording has an audio track; deliver it silent when the voice is generated');
  if (info.durationSec && (info.durationSec < 15 || info.durationSec > 240)) warnings.push(`${info.durationSec} s long (tutorial 60-180 s, reel 20-60 s)`);
  if (script && existsSync(script)) {
    let previous = -1;
    readFileSync(script, 'utf8').split('\n').filter(Boolean).forEach((line, index) => {
      const mark = /^\[(\d{1,2}):(\d{2})\]\s+(.+)$/u.exec(line);
      if (!mark) {
        warnings.push(`script line ${index + 1} has no [m:ss] mark`);
        return;
      }
      const seconds = Number(mark[1]) * 60 + Number(mark[2]);
      if (seconds <= previous) errors.push(`script line ${index + 1}: mark ${mark[1]}:${mark[2]} is not increasing`);
      if (info.durationSec && seconds > info.durationSec) errors.push(`script line ${index + 1}: mark beyond the recording (${info.durationSec} s)`);
      if (/https?:\/\/|www\./iu.test(mark[3])) warnings.push(`script line ${index + 1} speaks a URL`);
      previous = seconds;
    });
  }
  return { ok: errors.length === 0, errors, warnings, recording: info };
}

export function extractFrames(video, everySeconds = 8, outDir = join(dirname(video), 'frames')) {
  mkdirSync(outDir, { recursive: true });
  execFileSync(FFMPEG, ['-v', 'error', '-i', video, '-vf', `fps=1/${everySeconds},scale=800:-1`, join(outDir, 'f%02d.png'), '-y']);
  return outDir;
}

export function joinTakes({ takes, output }) {
  const inputs = [];
  const filters = [];
  const milestones = [];
  let offset = 0;
  takes.forEach((take, index) => {
    const to = take.to ?? probe(take.video).durationSec;
    const from = take.from ?? 0;
    inputs.push('-i', take.video);
    filters.push(`[${index}:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS[v${index}]`);
    for (const milestone of take.milestones ?? []) {
      if (milestone.t >= from && milestone.t < to) milestones.push({ t: round1(milestone.t - from + offset), label: milestone.label });
    }
    offset += to - from;
  });
  const concat = `${takes.map((_, index) => `[v${index}]`).join('')}concat=n=${takes.length}:v=1:a=0[v]`;
  const temporary = `${output}.tmp.mp4`;
  execFileSync(FFMPEG, ['-v', 'error', ...inputs, '-filter_complex', `${filters.join(';')};${concat}`, '-map', '[v]', '-r', '30', ...ENCODE_ARGS, temporary, '-y']);
  renameSync(temporary, output);
  return { video: output, milestones, recording: probe(output) };
}

export function writeTimedScript({ milestones, narration, file }) {
  if (narration.length !== milestones.length) throw new Error(`narration (${narration.length}) and milestones (${milestones.length}) must be 1:1`);
  writeFileSync(file, `${milestones.map((milestone, index) => `[${mmss(milestone.t)}] ${narration[index]}`).join('\n')}\n`);
  return file;
}

function defaultOutDir(slug, rehearsal) {
  return rehearsal ? join(tmpdir(), 'video-maker-rehearsal', slug) : join(homedir(), '.video-maker', 'recordings', slug);
}

export async function recordFlow(flowModule, { outDir, rehearsal = false } = {}) {
  const config = flowModule.config ?? {};
  const narration = flowModule.narration ?? [];
  const { slug, baseUrl } = config;
  if (!slug || !SLUG_PATTERN.test(slug)) throw new Error(`config.slug "${slug}" must be kebab-case (a-z, 0-9, single hyphens)`);
  if (!baseUrl) throw new Error('config.baseUrl is missing: the URL of the running app to record');
  const format = config.format ?? 'youtube-16x9';
  const preset = FORMATS[format];
  if (!preset) throw new Error(`unknown format ${format} (${Object.keys(FORMATS).join(', ')})`);
  if (typeof flowModule.default !== 'function') throw new Error('the flow file must export a default async function');

  const directory = outDir ?? defaultOutDir(slug, rehearsal);
  mkdirSync(directory, { recursive: true });
  const viewport = config.viewport ?? preset.viewport;
  const scale = config.scale ?? preset.scale;
  const pace = Number(env.VIDEO_MAKER_PACE || config.pace || 1);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: config.headless ?? true,
    executablePath: env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: scale > 1 ? [`--force-device-scale-factor=${scale}`] : [],
  });
  const contextOptions = { viewport, deviceScaleFactor: scale, locale: config.locale, timezoneId: config.timezoneId };

  let storageState;
  let sessionData = {};
  if (typeof flowModule.login === 'function') {
    const loginContext = await browser.newContext({ ...contextOptions });
    const loginPage = await loginContext.newPage();
    await flowModule.login(loginPage, { baseUrl, env });
    sessionData = await loginPage.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    storageState = await loginContext.storageState();
    await loginContext.close();
  }

  const context = await browser.newContext({
    ...contextOptions,
    storageState,
    ...(rehearsal ? {} : { recordVideo: { dir: directory, size: { width: viewport.width * scale, height: viewport.height * scale } } }),
  });
  await context.addInitScript(({ origin, data }) => {
    if (location.origin !== origin || sessionStorage.length) return;
    for (const [key, value] of Object.entries(data)) sessionStorage.setItem(key, value);
  }, { origin: new URL(baseUrl).origin, data: sessionData });
  await context.addInitScript(cursorScript(config.cursorColor ?? '#0ea5e9'));

  const page = await context.newPage();
  const startedAt = Date.now();
  const elapsed = () => (Date.now() - startedAt) / 1000;
  const milestones = [];
  const waits = [];
  const apiJson = [];
  const snapshots = [];
  const pointer = createHumanPointer(page, pace);

  if (config.apiUrl) {
    page.on('response', async (response) => {
      if (!response.url().startsWith(config.apiUrl) || response.status() >= 300) return;
      try {
        if ((response.headers()['content-type'] || '').includes('json')) {
          apiJson.push({ method: response.request().method(), url: response.url().slice(config.apiUrl.length), body: await response.json() });
        }
      } catch {}
    });
  }

  const afterNavigation = async () => {
    if (config.mask?.length) await page.addStyleTag({ content: maskStyle(config.mask) }).catch(() => {});
    await flowModule.onNavigate?.(page);
  };

  const helpers = {
    page,
    baseUrl,
    env,
    apiJson,
    narration,
    hito: (label) => {
      milestones.push({ t: round1(elapsed()), label });
      process.stderr.write(`· [${mmss(elapsed())}] ${label}\n`);
    },
    lineWindow: (index) => page.waitForTimeout(Math.round((wordCount(narration[index] ?? '') / WORDS_PER_SECOND + LINE_MARGIN_SECONDS) * 1000)),
    air: (seconds) => page.waitForTimeout(Math.round(seconds * 1000)),
    pause: pointer.pause,
    click: pointer.click,
    preciseClick: pointer.preciseClick,
    type: pointer.type,
    pointAt: pointer.pointAt,
    goTo: async (path, waitMs = 2500) => {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await afterNavigation();
      await pointer.pause(waitMs);
    },
    waitUntil: async (condition, { outputSeconds = 8, timeoutMs = 1_200_000, everyMs = 3000 } = {}) => {
      const from = elapsed();
      const deadline = Date.now() + timeoutMs;
      let met = false;
      while (Date.now() < deadline) {
        if (await condition()) {
          met = true;
          break;
        }
        await page.waitForTimeout(everyMs);
      }
      const to = elapsed();
      waits.push({ from, to, output: Math.min(outputSeconds, to - from) });
      if (!met) throw new Error(`waitUntil exceeded ${Math.round(timeoutMs / 1000)} s`);
    },
    snapshot: async (name, { fullPage = false } = {}) => {
      const imagesDir = join(directory, 'images');
      mkdirSync(imagesDir, { recursive: true });
      const file = join(imagesDir, `${name}.png`);
      await page.screenshot({ path: file, fullPage });
      snapshots.push(file);
      return file;
    },
  };

  await page.goto(`${baseUrl}${config.startPath ?? '/'}`, { waitUntil: 'networkidle', timeout: 40000 });
  await afterNavigation();
  await pointer.pause(1500);

  let result = { ok: false };
  try {
    result = { ok: true, ...((await flowModule.default(helpers)) ?? {}) };
  } catch (error) {
    result = { ok: false, error: String(error).slice(0, 400) };
  }

  if (config.closingSeconds) await page.waitForTimeout(config.closingSeconds * 1000);
  await page.waitForTimeout(TAIL_MS);
  const video = rehearsal ? null : page.video();
  await context.close();
  const rawVideo = video ? await video.path().catch(() => null) : null;
  await browser.close();

  const summary = { slug, format, rehearsal, result, milestones, narrationLines: narration.length, snapshots, outDir: directory };
  if (narration.length && narration.length !== milestones.length) summary.mismatch = `narration has ${narration.length} lines but the flow marked ${milestones.length} milestones`;
  if (rehearsal || !rawVideo || !existsSync(rawVideo)) return summary;

  return { ...summary, ...exportRecording({ rawVideo, directory, slug, format, milestones, waits, narration }) };
}

function exportRecording({ rawVideo, directory, slug, format, milestones, waits, narration }) {
  const { width, height } = FORMATS[format].output;
  if (!hasFfmpeg()) {
    const fallback = join(directory, `${slug}.webm`);
    copyFileSync(rawVideo, fallback);
    rmSync(rawVideo, { force: true });
    return { aroll: fallback, warning: 'ffmpeg not found: the raw .webm was kept untrimmed; install ffmpeg (or set FFMPEG_PATH) for a 1080p30 H.264 file' };
  }
  const trimStart = milestones.length ? Math.max(0, milestones[0].t - LEAD_IN_SECONDS) : 0;
  const trim = trimStart > 0.2 ? trimStart : 0;
  const slowWaits = waits.filter((wait) => wait.to - wait.from > wait.output + 0.5).sort((a, b) => a.from - b.from);
  const timed = milestones.map((milestone) => ({ ...milestone, t: finalTime(milestone.t, trim, slowWaits) }));
  const aroll = join(directory, `${slug}.mp4`);
  if (slowWaits.length) {
    execFileSync(FFMPEG, ['-v', 'error', '-i', rawVideo, '-filter_complex', speedUpFilter(trim, slowWaits, width, height), '-map', '[v]', ...ENCODE_ARGS, aroll, '-y']);
  } else {
    execFileSync(FFMPEG, ['-v', 'error', ...(trim ? ['-ss', String(trim)] : []), '-i', rawVideo, '-vf', scaleFilter(width, height), ...ENCODE_ARGS, aroll, '-y']);
  }
  rmSync(rawVideo, { force: true });
  const script = narration.length === timed.length && timed.length > 0 ? writeTimedScript({ milestones: timed, narration, file: join(directory, 'script.txt') }) : null;
  writeFileSync(join(directory, 'milestones.json'), `${JSON.stringify({ slug, format, recordedAt: new Date().toISOString(), milestones: timed, narration }, null, 2)}\n`);
  return { aroll, script, milestones: timed, verification: verifyRecording({ aroll, script, format }) };
}

function parseArgs(argv) {
  const options = { rehearsal: false, outDir: undefined, flow: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--rehearsal') options.rehearsal = true;
    else if (arg === '--out') options.outDir = resolve(argv[(index += 1)]);
    else options.flow = arg;
  }
  return options;
}

async function main() {
  const { flow, outDir, rehearsal } = parseArgs(process.argv.slice(2));
  if (!flow) {
    process.stderr.write('usage: node record.mjs <path/to/flow.mjs> [--rehearsal] [--out <dir>]\n');
    process.exit(2);
  }
  const flowPath = isAbsolute(flow) ? flow : resolve(process.cwd(), flow);
  const flowModule = await import(pathToFileURL(flowPath).href);
  const summary = await recordFlow(flowModule, { outDir, rehearsal });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.result.ok && (summary.verification?.ok ?? true) ? 0 : 1;
}

if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  await main();
}
