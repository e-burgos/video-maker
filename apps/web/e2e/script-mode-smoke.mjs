import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
  assert,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  memoryGate,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const RENDER_API_PORT = 4421;
const WEB_PORT = 4211;
const SLUG = 'script-mode-smoke';
const SOURCE_PROJECT = join(REPO_ROOT, 'media/display-ads');
const EXPECTED_SCRIPT_LINES = 10;

const ARTIFACTS = {
  library: join(REPO_ROOT, 'sdd/specs/spec-e-burgos-006-web-studio/fixes/artifacts'),
  voice: join(REPO_ROOT, 'sdd/specs/spec-e-burgos-009-voice-over/fixes/artifacts'),
};

const apiUrl = `http://127.0.0.1:${RENDER_API_PORT}`;
const webUrl = `http://localhost:${WEB_PORT}`;

async function seedProject(mediaRoot) {
  const projectRoot = join(mediaRoot, SLUG);
  await mkdir(join(projectRoot, 'work/producer'), { recursive: true });
  await cp(join(SOURCE_PROJECT, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await cp(
    join(SOURCE_PROJECT, 'work/producer/script.txt'),
    join(projectRoot, 'work/producer/script.txt'),
  );
  return projectRoot;
}

async function postJob(body) {
  const response = await fetch(`${apiUrl}/projects/${SLUG}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const job = await response.json();
  assert(
    response.status === 202,
    `${body.kind} job accepted (got ${response.status} ${JSON.stringify(job.error ?? {})})`,
  );
  return job;
}

async function awaitJob(jobId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await fetch(`${apiUrl}/jobs/${jobId}`);
    last = await response.json();
    if (last.state === 'succeeded' || last.state === 'failed' || last.state === 'canceled') {
      assert(
        last.state === 'succeeded',
        `job ${jobId} succeeded (state ${last.state}, error ${JSON.stringify(last.error ?? {})})`,
      );
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`job ${jobId} did not settle: ${JSON.stringify(last)}`);
}

async function mediaState(page, testId) {
  return page.locator(`[data-testid="${testId}"]`).evaluate((node) => ({
    readyState: node.readyState,
    duration: node.duration,
    src: node.getAttribute('src'),
  }));
}

async function main() {
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);
  await memoryGate();

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'script-mode-media-'));
  const projectRoot = await seedProject(tempMediaRoot);
  for (const directory of Object.values(ARTIFACTS)) {
    await mkdir(directory, { recursive: true });
  }
  log('1', `temp media root: ${tempMediaRoot} (raw/ + work/producer/script.txt, no storyboard)`);

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
  log('2', `render-api pid ${renderApi.pid} on ${RENDER_API_PORT}`);

  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: apiUrl,
  });

  let browser = null;

  try {
    await waitForHttp(`${apiUrl}/health`, 30_000);

    log('3', 'cheap gate: this build serves EP-028, confined to the three generated roots');
    const generatedProbe = await fetch(`${apiUrl}/projects/${SLUG}/generated`);
    const generatedBefore = await generatedProbe.json();
    assert(
      generatedProbe.status === 200 &&
        JSON.stringify(generatedBefore.roots) ===
          JSON.stringify(['work/voice', 'work/producer', 'out']),
      `the build under test knows GET /projects/:slug/generated (got ${generatedProbe.status} ${JSON.stringify(generatedBefore.roots)})`,
    );
    assert(
      generatedBefore.files.every((file) => !file.path.startsWith('raw/')),
      'the listing never reaches into raw/',
    );

    log('4', 'voice job from the producer script of media/display-ads');
    const voiceJob = await postJob({
      kind: 'voice',
      scriptPath: 'work/producer/script.txt',
      overwrite: true,
    });
    await awaitJob(voiceJob.id, 900_000);

    const manifest = JSON.parse(
      await readFile(join(projectRoot, 'work/voice/script-manifest.json'), 'utf8'),
    );
    log('4', `manifest: ${manifest.lines.length} lines, voice ${manifest.voiceId}`);
    assert(
      manifest.lines.length === EXPECTED_SCRIPT_LINES,
      `the manifest has the ${EXPECTED_SCRIPT_LINES} lines of the script (got ${manifest.lines.length})`,
    );

    log('5', 'montage job with the kinetic default, so the preview has a style to change');
    const montageJob = await postJob({
      kind: 'montage',
      preset: 'software-demo',
      voice: 'script',
      format: 'youtube-16x9',
      scriptPath: 'work/producer/script.txt',
      overwrite: true,
    });
    await awaitJob(montageJob.id, 900_000);

    const timelinePath = join(projectRoot, 'work/timeline.json');
    const plannedTimeline = JSON.parse(await readFile(timelinePath, 'utf8'));
    log(
      '5',
      `timeline: captionStyle=${plannedTimeline.captionStyle}, logo.widthRatio=${plannedTimeline.logo?.widthRatio}`,
    );
    assert(
      plannedTimeline.captionStyle === 'bold-impact',
      `software-demo planned the kinetic style (got ${plannedTimeline.captionStyle})`,
    );
    assert(
      plannedTimeline.logo?.widthRatio === 0.18,
      `a 16:9 montage sizes the logo at 0.18 of the width (got ${plannedTimeline.logo?.widthRatio})`,
    );

    await waitForHttp(`${webUrl}/api/projects`, 30_000);
    const playwright = await resolvePlaywright();
    browser = await playwright.chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 2200 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));

    log('6', 'library: the Generated section lists what the engine produced');
    await page.goto(`${webUrl}/projects/${SLUG}/library`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="generated-narration"]');
    const narration = await mediaState(page, 'generated-narration-audio');
    log('6', `generated narration player: ${JSON.stringify(narration)}`);
    assert(
      narration.src === `/api/projects/${SLUG}/files/work/voice/voice.wav`,
      'the player points at work/voice/voice.wav through EP-011',
    );
    assert(
      narration.readyState === 4 && narration.duration > 30,
      `the narration really decodes in the browser (readyState ${narration.readyState}, ${narration.duration} s)`,
    );
    const voiceBadge = await page
      .locator('[data-testid="generated-narration-voice"]')
      .textContent();
    log('6', `voice badge: ${voiceBadge}`);
    const scriptEntry = await page.locator('[data-testid="generated-script"]').textContent();
    assert(
      scriptEntry.includes('work/producer/script.txt'),
      'the Generated section offers the producer script',
    );
    await page.screenshot({
      path: join(ARTIFACTS.library, 'script-mode-01-library-generated.png'),
      fullPage: true,
    });

    log('7', 'voice page: script mode instead of STORYBOARD_NOT_FOUND');
    await page.goto(`${webUrl}/projects/${SLUG}/voice`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="voice-script-panel"]');
    const lineCount = await page.locator('[data-testid="voice-script-line"]').count();
    log('7', `script lines rendered: ${lineCount}`);
    assert(
      lineCount === EXPECTED_SCRIPT_LINES,
      `the voice page lists the ${EXPECTED_SCRIPT_LINES} lines of the script (got ${lineCount})`,
    );
    const scriptAudio = await mediaState(page, 'voice-script-audio');
    log('7', `voice page player: ${JSON.stringify(scriptAudio)}`);
    assert(
      scriptAudio.readyState === 4 && scriptAudio.duration > 30,
      `the voice page plays the generated track (readyState ${scriptAudio.readyState})`,
    );
    assert(
      (await page.locator('[data-testid="voice-empty-state"]').count()) === 0,
      'the voice page no longer falls back to the empty state',
    );
    const regenerate = page.getByRole('button', { name: 'Regenerate with the selected voice' });
    assert(await regenerate.isEnabled(), 'the script mode offers to regenerate with the picked voice');
    await page.screenshot({
      path: join(ARTIFACTS.voice, 'script-mode-02-voice-script-mode.png'),
      fullPage: true,
    });

    log('8', 'storyboard page: the producer script, read only');
    await page.goto(`${webUrl}/projects/${SLUG}/storyboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="producer-script-panel"]');
    const shownScript = await page.locator('[data-testid="producer-script-text"]').textContent();
    const diskScript = await readFile(join(projectRoot, 'work/producer/script.txt'), 'utf8');
    assert(
      shownScript.trim() === diskScript.trim(),
      'the storyboard page shows the producer script exactly as it is on disk',
    );
    assert(
      (await page.locator('[data-testid="storyboard-empty-state"]').count()) === 0,
      'the storyboard page no longer shows only the empty state',
    );
    await page.screenshot({
      path: join(ARTIFACTS.voice, 'script-mode-03-storyboard-producer-script.png'),
      fullPage: true,
    });

    log('9', 'preview: pick the lower subtitle and save it with the full PUT');
    await page.goto(`${webUrl}/projects/${SLUG}/preview`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="caption-style-selector"]');
    const offered = await page
      .locator('[data-testid="caption-style-selector"] option')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
    log('9', `caption style options: ${JSON.stringify(offered)}`);
    assert(
      offered.includes('Subtitle at the bottom — tutorials and explainers'),
      'the selector offers the lower subtitle in the language of the product, never the style id',
    );

    await page.selectOption('[data-testid="caption-style-selector"] select', 'subtle-lower');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForSelector('[data-testid="timeline-save-bar"][data-timeline-dirty="false"]');

    const savedTimeline = JSON.parse(await readFile(timelinePath, 'utf8'));
    log('9', `timeline on disk after the PUT: captionStyle=${savedTimeline.captionStyle}`);
    assert(
      savedTimeline.captionStyle === 'subtle-lower',
      `the PUT persisted the picked style on disk (got ${savedTimeline.captionStyle})`,
    );
    assert(
      savedTimeline.tracks.captions.length === plannedTimeline.tracks.captions.length,
      'the full PUT kept every caption clip the montage planned',
    );
    await page.screenshot({
      path: join(ARTIFACTS.library, 'script-mode-04-preview-caption-style.png'),
      fullPage: true,
    });

    await writeFile(
      join(ARTIFACTS.library, 'script-mode-smoke-report.json'),
      `${JSON.stringify(
        {
          generatedRoots: generatedBefore.roots,
          narration,
          scriptAudio,
          scriptLines: lineCount,
          captionStyleBefore: plannedTimeline.captionStyle,
          captionStyleAfter: savedTimeline.captionStyle,
          logoWidthRatio: plannedTimeline.logo?.widthRatio ?? null,
          voiceBadge,
        },
        null,
        2,
      )}\n`,
    );

    log('done', 'library Generated, voice script mode, storyboard script and the caption style PUT all held');
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    log('cleanup', `stopping render-api pid ${renderApi.pid} and web pid ${web.pid}`);
    renderApi.kill('SIGTERM');
    web.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(tempMediaRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  log('failed', error.stack ?? String(error));
  process.exitCode = 1;
});
