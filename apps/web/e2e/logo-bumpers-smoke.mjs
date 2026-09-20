import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MEDIA_ENV_VARS,
  REPO_ROOT,
  assert,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const ARTIFACTS_DIR = join(REPO_ROOT, 'sdd/specs/spec-e-burgos-006-web-studio/fixes/artifacts');

const RENDER_API_PORT = 4440;
const WEB_PORT = 4441;
const SLUG = 'logo-bumpers-smoke';
const LOGO_ASSET_ID = 'raw/logo/brand.jpg';
const INTRO_COLOR = '#0b1020';
const INTRO_DURATION_MS = 3000;
const INTRO_FRAMES = 90;

async function readTimeline(projectRoot) {
  return JSON.parse(await readFile(join(projectRoot, 'work/timeline.json'), 'utf8'));
}

async function writeTimeline(projectRoot, timeline) {
  await writeFile(
    join(projectRoot, 'work/timeline.json'),
    JSON.stringify(timeline, null, 2),
    'utf8',
  );
}

async function seedProject(mediaRoot) {
  const projectRoot = join(mediaRoot, SLUG);
  const source = join(REPO_ROOT, 'media/smoke-ingest');

  await mkdir(join(projectRoot, 'work'), { recursive: true });
  await cp(join(source, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  for (const document of ['catalog.json', 'timeline.json']) {
    await cp(join(source, 'work', document), join(projectRoot, 'work', document));
  }

  await mkdir(join(projectRoot, 'raw/logo'), { recursive: true });
  await cp(join(source, 'raw/images/photo01.jpg'), join(projectRoot, LOGO_ASSET_ID));

  const catalog = JSON.parse(await readFile(join(projectRoot, 'work/catalog.json'), 'utf8'));
  const image = catalog.assets.find((entry) => entry.role === 'image');
  const logoAsset = { ...image.asset, id: LOGO_ASSET_ID, path: LOGO_ASSET_ID };
  catalog.projectSlug = SLUG;
  catalog.assets.push({ ...image, role: 'logo', asset: logoAsset });
  await writeFile(
    join(projectRoot, 'work/catalog.json'),
    JSON.stringify(catalog, null, 2),
    'utf8',
  );

  const timeline = await readTimeline(projectRoot);
  timeline.assets.push(logoAsset);
  timeline.logo = {
    assetId: LOGO_ASSET_ID,
    position: 'bottom-right',
    widthRatio: 0.18,
    marginRatio: 0.035,
    opacity: 1,
  };
  await writeTimeline(projectRoot, timeline);

  return { projectRoot, timeline };
}

async function main() {
  await loadRootEnv(MEDIA_ENV_VARS);
  assertMediaEnvResolvable(MEDIA_ENV_VARS);

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'logo-bumpers-smoke-media-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const { projectRoot, timeline: seededTimeline } = await seedProject(tempMediaRoot);
  log('1', `temp media root: ${tempMediaRoot} (a copy of media/smoke-ingest, outside media/)`);

  log('2', `starting apps/render-api on ${RENDER_API_PORT} and vite on ${WEB_PORT}`);
  const renderApi = spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: tempMediaRoot,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
    },
  );
  log('2', `render-api pid: ${renderApi.pid}`);

  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });
  log('2', `web pid: ${web.pid}`);

  let browser = null;

  try {
    await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);

    log('3', 'cheap gate: this build accepts a timeline document that declares bumpers');
    const probe = await fetch(`http://127.0.0.1:${RENDER_API_PORT}/projects/${SLUG}/timeline`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...seededTimeline,
        bumpers: {
          intro: {
            enabled: true,
            durationMs: 2000,
            backgroundColor: '#ffffff',
            animation: 'zoom',
            logoWidthRatio: 0.4,
          },
        },
      }),
    });
    log('3', `PUT with bumpers: ${probe.status}`);
    assert(probe.status === 200, 'the service under test accepts timeline.bumpers (422 before the fix)');
    await writeTimeline(projectRoot, seededTimeline);
    assert(
      (await readTimeline(projectRoot)).bumpers === undefined,
      'the probe was rolled back: the studio starts from a timeline with no bumpers',
    );

    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);

    const { chromium } = await resolvePlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        log('console-error', message.text());
      }
    });
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        log('http', `${response.status()} ${response.url()}`);
      }
    });

    log('4', 'opening the preview and the logo panel');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/preview`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('[data-testid="logo-bumper-editor"]', { timeout: 20000 });

    const playerFramesBefore = Number(
      await page.locator('[data-testid="timeline-player"]').getAttribute('data-duration-in-frames'),
    );
    const durationBefore = (await page.locator('[data-testid="preview-duration"]').textContent()).trim();
    log('4', `player frames: ${playerFramesBefore} · duration row: ${durationBefore}`);
    assert(
      playerFramesBefore === seededTimeline.durationFrames,
      `the Player starts at the content duration (${seededTimeline.durationFrames} frames)`,
    );

    log('5', 'ticking the intro and choosing its colour and duration');
    await page.getByLabel('Add a video intro').check();
    await page.getByLabel('Intro background hex').fill(INTRO_COLOR);
    await page.getByLabel('Intro duration').selectOption(String(INTRO_DURATION_MS));

    const playerFramesAfter = Number(
      await page.locator('[data-testid="timeline-player"]').getAttribute('data-duration-in-frames'),
    );
    const durationAfter = (await page.locator('[data-testid="preview-duration"]').textContent()).trim();
    log('5', `player frames: ${playerFramesAfter} · duration row: ${durationAfter}`);
    assert(
      playerFramesAfter === seededTimeline.durationFrames + INTRO_FRAMES,
      `the Player already shows the total (${seededTimeline.durationFrames} + ${INTRO_FRAMES} frames) before saving`,
    );
    assert(
      durationAfter === `${durationBefore} + 3 s`,
      'the duration row shows the content plus the intro',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'logo-bumpers-01-intro.png') });

    log('6', 'saving the timeline');
    assert(
      (await page.locator('[data-testid="timeline-save-bar"]').getAttribute('data-timeline-dirty')) ===
        'true',
      'the draft is dirty before saving',
    );
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector('[data-testid="timeline-save-bar"][data-timeline-dirty="false"]', {
      timeout: 20000,
    });

    const saved = await readTimeline(projectRoot);
    log('6', `bumpers on disk: ${JSON.stringify(saved.bumpers)}`);
    assert(
      JSON.stringify(saved.bumpers) ===
        JSON.stringify({
          intro: {
            enabled: true,
            durationMs: INTRO_DURATION_MS,
            backgroundColor: INTRO_COLOR,
            animation: 'zoom',
            logoWidthRatio: 0.4,
          },
        }),
      'work/timeline.json holds the intro the studio configured, and no outro',
    );
    assert(
      saved.durationFrames === seededTimeline.durationFrames,
      'durationFrames still means the content, not the total',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'logo-bumpers-02-saved.png') });

    log('done', 'logo bumpers smoke passed');
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    for (const child of [web, renderApi]) {
      if (child.pid !== undefined) {
        log('cleanup', `killing pid ${child.pid}`);
        child.kill('SIGTERM');
      }
    }
  }
}

await main();
