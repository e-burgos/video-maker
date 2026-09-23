import { execFileSync, execSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MEDIA_ENV_VARS,
  REPO_ROOT,
  assert,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  memoryGate,
  probeStream,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-02/artifacts',
);

const RENDER_API_PORT = 4460;
const WEB_PORT = 4461;
const SLUG = 'interrupted-job-smoke';
const NON_TERMINAL_STATES = new Set(['queued', 'running', 'canceling']);

async function buildSyntheticAroll(mediaRoot, slug) {
  const projectRoot = join(mediaRoot, slug);
  for (const sub of ['raw/aroll', 'raw/broll', 'raw/images', 'raw/audio', 'raw/voice', 'raw/logo', 'work', 'out']) {
    await mkdir(join(projectRoot, sub), { recursive: true });
  }
  const clipPath = join(projectRoot, 'raw', 'aroll', 'clip.mp4');
  execFileSync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=1080x1920:rate=30:duration=8',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=8',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    clipPath,
  ]);
  return projectRoot;
}

function findProcesses(pattern) {
  try {
    return execSync(`pgrep -fl '${pattern}' || true`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '');
  } catch {
    return [];
  }
}

function killProcesses(lines) {
  let killed = 0;
  for (const line of lines) {
    const pid = Number(line.trim().split(/\s+/u)[0]);
    if (!Number.isInteger(pid)) {
      continue;
    }
    try {
      process.kill(pid, 'SIGKILL');
      killed += 1;
    } catch {
      // already gone
    }
  }
  return killed;
}

function spawnRenderApi(label, mediaRoot) {
  return spawnLogged(
    label,
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: mediaRoot,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
    },
  );
}

async function killServerHard(child) {
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGKILL');
    setTimeout(resolve, 1500);
  });
}

async function apiJson(path, init) {
  const response = await fetch(`http://127.0.0.1:${RENDER_API_PORT}${path}`, init);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function pollJobUntilProgress(jobId, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const { body } = await apiJson(`/jobs/${jobId}`);
    if (typeof body?.progress?.renderedFrames === 'number' && body.progress.renderedFrames > 0) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`job ${jobId} never showed progress.renderedFrames > 0 within ${deadlineMs}ms`);
}

async function pollJobUntilTerminal(jobId, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const { body } = await apiJson(`/jobs/${jobId}`);
    if (body !== null && !NON_TERMINAL_STATES.has(body.state)) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`job ${jobId} did not settle within ${deadlineMs}ms`);
}

async function main() {
  await memoryGate();
  await loadRootEnv(MEDIA_ENV_VARS);
  assertMediaEnvResolvable(MEDIA_ENV_VARS);

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'interrupted-job-smoke-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  log('1', `temp media root: ${tempMediaRoot}`);
  log('1', 'building a synthetic 8s A-roll clip with video and audio (ffmpeg lavfi testsrc+sine)');
  await buildSyntheticAroll(tempMediaRoot, SLUG);

  let renderApi = spawnRenderApi('render-api:run1', tempMediaRoot);
  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });

  let browser = null;
  const cycles = [];

  try {
    await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
    log('2', 'render-api is up on the temp media root');

    log('3', 'building the timeline with a montage job through the API');
    const montage = (
      await apiJson(`/projects/${SLUG}/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'montage' }),
      })
    ).body;
    const montageResult = await pollJobUntilTerminal(montage.id, 60000);
    assert(montageResult.state === 'succeeded', 'the montage job that builds the timeline succeeds');

    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);
    log('3', 'web is up and the proxy reaches render-api');

    const { chromium } = await resolvePlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        log('console-error', message.text());
      }
    });
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));

    async function runInterruptedCycle(locale) {
      const cycle = { locale };
      log(locale, `starting a render job (cycle: ${locale})`);
      const render = (
        await apiJson(`/projects/${SLUG}/jobs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'render' }),
        })
      ).body;
      cycle.originalJobId = render.id;
      log(locale, `render job ${render.id} created; waiting for progress.renderedFrames > 0`);

      const progressed = await pollJobUntilProgress(render.id, 30000);
      cycle.progressBeforeKill = progressed.progress;
      assert(
        progressed.progress.renderedFrames > 0,
        `progress.renderedFrames > 0 observed via the API before the kill (${progressed.progress.renderedFrames}/${progressed.progress.totalFrames})`,
      );

      log(locale, `killing render-api (pid ${renderApi.pid}) with SIGKILL mid-render`);
      await killServerHard(renderApi);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const orphans = findProcesses('chrome-headless-shell|ffmpeg');
      cycle.orphanProcessesFound = orphans.length;
      log(locale, `orphan processes found after the kill: ${orphans.length}`);
      if (orphans.length > 0) {
        cycle.orphanProcessesKilled = killProcesses(orphans);
        log(locale, `orphan processes killed: ${cycle.orphanProcessesKilled}`);
      } else {
        cycle.orphanProcessesKilled = 0;
      }

      log(locale, 'restarting render-api on the same media root');
      renderApi = spawnRenderApi(`render-api:${locale}`, tempMediaRoot);
      await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);

      if (locale === 'es') {
        log(locale, 'switching the UI language to Spanish');
        await page.locator('[data-testid="language-switch"] [data-language="es"]').click();
      }

      if (page.url().includes(`/projects/${SLUG}/preview`)) {
        const refreshLabel = locale === 'es' ? 'Refrescar' : 'Refresh';
        log(locale, `reloading the render job listing (${refreshLabel})`);
        await page.getByRole('button', { name: refreshLabel }).click();
      } else {
        log(locale, 'opening the preview page');
        await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/preview`, {
          waitUntil: 'networkidle',
        });
      }

      await page.getByRole('button', { name: render.id, exact: true }).click();
      const panel = page.locator('[data-testid="render-job-panel"]');
      await panel.waitFor({ state: 'visible' });

      const badge = panel.locator('[data-testid="job-interrupted-badge"]');
      await badge.waitFor({ state: 'visible', timeout: 15000 });
      const badgeText = (await badge.textContent())?.trim();
      cycle.badgeText = badgeText;
      const expectedBadge = locale === 'es' ? 'Interrumpido' : 'Interrupted';
      assert(
        badgeText === expectedBadge,
        `the panel shows the "${expectedBadge}" badge instead of the generic failure text (measured in the DOM: "${badgeText}")`,
      );

      const retryLabel = locale === 'es' ? 'Volver a intentar' : 'Run again';
      const retryButton = panel.getByRole('button', { name: retryLabel });
      await retryButton.waitFor({ state: 'visible' });
      assert(
        await retryButton.isVisible(),
        `the "${retryLabel}" retry button is visible for the interrupted job (measured in the DOM)`,
      );

      await retryButton.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(ARTIFACTS_DIR, `interrupted-job-smoke-01-badge-${locale}.png`),
      });
      cycle.screenshotBadge = `interrupted-job-smoke-01-badge-${locale}.png`;

      log(locale, `clicking "${retryLabel}"`);
      const [retryResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith(`/jobs/${render.id}/retry`) &&
            response.request().method() === 'POST',
        ),
        retryButton.click(),
      ]);
      assert(
        retryResponse.status() === 202,
        `POST /jobs/${render.id}/retry answered 202 (got ${retryResponse.status()})`,
      );
      const retried = await retryResponse.json();
      cycle.retriedJobId = retried.id;
      log(locale, `retried job id: ${retried.id}`);

      await page.waitForFunction(
        (expectedId) => {
          const idNode = document.querySelector('[data-testid="render-job-panel"] p');
          return idNode !== null && idNode.textContent === expectedId;
        },
        retried.id,
        { timeout: 10000 },
      );
      assert(true, `the new job id ${retried.id} replaced the interrupted one in the DOM after the retry`);

      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(ARTIFACTS_DIR, `interrupted-job-smoke-02-after-retry-${locale}.png`),
      });
      cycle.screenshotAfterRetry = `interrupted-job-smoke-02-after-retry-${locale}.png`;

      log(locale, 'polling the API until the retried job reaches a terminal state');
      const settled = await pollJobUntilTerminal(retried.id, 60000);
      cycle.retriedJobState = settled.state;
      assert(settled.state === 'succeeded', `the retried job succeeded (got ${settled.state})`);

      const mp4Path = join(tempMediaRoot, SLUG, 'out', `${retried.id}.mp4`);
      const stream = probeStream(mp4Path, 'v:0', 'nb_frames,codec_name,width,height,r_frame_rate');
      cycle.ffprobeNbFrames = Number(stream.nb_frames);
      cycle.reportDurationInFrames = settled.report?.deliverable?.durationInFrames;
      assert(
        cycle.ffprobeNbFrames === cycle.reportDurationInFrames,
        `ffprobe nb_frames (${cycle.ffprobeNbFrames}) equals report.deliverable.durationInFrames (${cycle.reportDurationInFrames})`,
      );

      cycles.push(cycle);
    }

    await runInterruptedCycle('en');
    await runInterruptedCycle('es');

    console.log(`\nSUMMARY ${JSON.stringify({ slug: SLUG, cycles }, null, 2)}`);
    log('done', 'interrupted job smoke passed (en + es)');
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    if (renderApi !== null) {
      renderApi.kill('SIGKILL');
    }
    web.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(tempMediaRoot, { recursive: true, force: true });
    log('cleanup', `temp media root removed: ${tempMediaRoot}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
