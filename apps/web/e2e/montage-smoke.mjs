import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
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
  'sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-02/artifacts',
);

const RENDER_API_PORT = 4398;
const WEB_PORT = 4208;
const SLUG = 'smoke-ingest';
const NON_TERMINAL_STATES = new Set(['queued', 'running', 'canceling']);

const VOLATILE_KEYS = ['probedAt', 'modifiedAtMs'];

function sha256OfFile(path) {
  return readFile(path).then((buffer) => createHash('sha256').update(buffer).digest('hex'));
}

function withoutVolatileFields(value) {
  if (Array.isArray(value)) {
    return value.map(withoutVolatileFields);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !VOLATILE_KEYS.includes(key))
        .map(([key, nested]) => [key, withoutVolatileFields(nested)]),
    );
  }
  return value;
}

async function stableShapeOf(path) {
  const document = JSON.parse(await readFile(path, 'utf8'));
  return createHash('sha256')
    .update(JSON.stringify(withoutVolatileFields(document)))
    .digest('hex');
}

async function pollJobUntilTerminal(jobId, deadlineMs, onSnapshot) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${RENDER_API_PORT}/jobs/${jobId}`);
    assert(response.ok, `GET /jobs/${jobId} returned ok (status ${response.status})`);
    const job = await response.json();
    onSnapshot(job);
    if (!NON_TERMINAL_STATES.has(job.state)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

async function main() {
  await memoryGate();
  await loadRootEnv();
  assertMediaEnvResolvable();

  log('1', 'copying ONLY raw/ from media/smoke-ingest into a temporary media root');
  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'montage-smoke-'));
  const projectRoot = join(tempMediaRoot, SLUG);
  await mkdir(projectRoot, { recursive: true });
  await cp(join(REPO_ROOT, 'media', SLUG, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  log('1', `temp media root: ${tempMediaRoot} (no work/, no out/ — the studio has to produce them)`);

  const cliCatalogSha = await sha256OfFile(join(REPO_ROOT, 'media', SLUG, 'work', 'catalog.json'));
  const cliTimelineSha = await sha256OfFile(join(REPO_ROOT, 'media', SLUG, 'work', 'timeline.json'));
  const cliEdlSha = await sha256OfFile(join(REPO_ROOT, 'media', SLUG, 'work', 'edl.json'));
  log('1', `CLI baselines — catalog ${cliCatalogSha.slice(0, 12)}… timeline ${cliTimelineSha.slice(0, 12)}… edl ${cliEdlSha.slice(0, 12)}…`);

  await mkdir(ARTIFACTS_DIR, { recursive: true });

  log('2', 'starting apps/render-api against the temporary media root');
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
  const healthResponse = await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
  const health = await healthResponse.json();
  log('2', `render-api health: status=${health.status} capabilities=${JSON.stringify(health.capabilities)}`);
  assert(health.capabilities.montageQueue === true, 'the service exposes capabilities.montageQueue');
  assert(
    health.binaries.length === 4 && health.binaries.every((binary) => binary.resolved),
    `the four media binaries resolve (${health.binaries.map((b) => `${b.name}:${b.resolved}`).join(' ')})`,
  );

  log('3', 'starting apps/web with its proxy pointed at render-api');
  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });
  await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);
  log('3', 'web is up and the proxy reaches render-api');

  const { chromium } = await resolvePlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } });

  const observedMontageStages = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      log('console-error', message.text());
    }
  });
  page.on('pageerror', (error) => {
    log('pageerror', error.stack ?? error.message);
  });

  try {
    log('4', 'opening the projects list and the asset library of a project that has ONLY raw/');
    await page.goto(`http://localhost:${WEB_PORT}/`, { waitUntil: 'networkidle' });
    await page.getByText(SLUG, { exact: true }).click();
    await page.waitForSelector('[data-testid="asset-source"]');

    const assetSource = await page.getByTestId('asset-source').textContent();
    log('4', `asset listing source: ${assetSource}`);
    assert(assetSource === 'raw-scan', 'the library lists the raw material by scanning raw/, with no catalog yet');

    const arollCards = await page.locator('[data-testid="role-aroll"] li').count();
    const brollCards = await page.locator('[data-testid="role-broll"] li').count();
    const imageCards = await page.locator('[data-testid="role-image"] li').count();
    const audioCards = await page.locator('[data-testid="role-audio"] li').count();
    log('4', `asset cards visible: aroll=${arollCards} broll=${brollCards} image=${imageCards} audio=${audioCards}`);
    assert(arollCards > 0, 'the a-roll material is visible in the library before any montage exists');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'montage-smoke-01-raw-library.png') });

    log('5', 'checking the montage trigger is enabled because the service can montage');
    const generateButton = page.getByRole('button', { name: 'Generate montage' });
    assert(await generateButton.isEnabled(), 'Generate montage is enabled with a healthy service');

    const stagePoller = setInterval(() => {
      page
        .locator('[data-testid="montage-stage"]')
        .textContent({ timeout: 150 })
        .then((text) => {
          if (text !== null && !observedMontageStages.includes(text)) {
            observedMontageStages.push(text);
            log('6', `UI progress: ${text}`);
          }
        })
        .catch(() => undefined);
    }, 150);

    log('6', 'clicking Generate montage (EP-012 kind: montage, preset software-demo, seed 0)');
    const montageStartedAt = Date.now();
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      generateButton.click(),
    ]);
    const createdJob = await createResponse.json();
    assert(createResponse.status() === 202, `the montage job was accepted with 202 (got ${createResponse.status()})`);
    assert(createdJob.kind === 'montage', `the created job is kind: "montage" (got ${createdJob.kind})`);
    const montageJobId = createdJob.id;
    log('6', `montage job created: ${montageJobId} (state=${createdJob.state})`);

    const apiStages = [];
    const finalMontage = await pollJobUntilTerminal(montageJobId, 300000, (job) => {
      const stage = job.progress?.stage ?? null;
      if (stage !== null && apiStages.at(-1) !== stage) {
        apiStages.push(stage);
        log(
          '6',
          `API progress: stage=${stage} assets=${job.progress?.processedAssets ?? '—'}/${job.progress?.totalAssets ?? '—'} percent=${job.progress?.percent ?? '—'}`,
        );
      }
    });
    clearInterval(stagePoller);
    const montageSeconds = (Date.now() - montageStartedAt) / 1000;

    assert(finalMontage !== null, 'the montage job reached a terminal state inside the deadline');
    if (finalMontage.state === 'failed') {
      throw new Error(
        `ASSERTION FAILED: montage job ${montageJobId} failed with code=${finalMontage.error?.code ?? 'unknown'} message=${finalMontage.error?.message ?? 'none'}`,
      );
    }
    assert(finalMontage.state === 'succeeded', `the montage job succeeded (got ${finalMontage.state})`);
    log('6', `montage finished in ${montageSeconds.toFixed(1)}s; API stages observed: ${apiStages.join(' → ')}`);
    log('6', `UI stages observed: ${observedMontageStages.join(' | ') || 'none captured'}`);
    assert(observedMontageStages.length > 0, 'the UI showed at least one montage stage while the job was running');
    assert(apiStages.includes('transcribe'), 'the transcribe stage was reported by the job');

    log('7', 'the studio navigates to the preview once the montage succeeds');
    await page.waitForSelector('[data-testid="timeline-player"]', { timeout: 20000 });
    assert(page.url().endsWith(`/projects/${SLUG}/preview`), `the app navigated to the preview (${page.url()})`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'montage-smoke-02-preview-after-montage.png') });

    const generatedTimelinePath = join(projectRoot, 'work', 'timeline.json');
    const webCatalogSha = await sha256OfFile(join(projectRoot, 'work', 'catalog.json'));
    const webTimelineSha = await sha256OfFile(generatedTimelinePath);
    const webEdlSha = await sha256OfFile(join(projectRoot, 'work', 'edl.json'));
    log('7', `web-produced sha256 — catalog ${webCatalogSha.slice(0, 12)}… timeline ${webTimelineSha.slice(0, 12)}… edl ${webEdlSha.slice(0, 12)}…`);
    assert(webEdlSha === cliEdlSha, 'work/edl.json produced from the studio is byte-identical to the CLI baseline');

    const cliRoot = join(REPO_ROOT, 'media', SLUG, 'work');
    const webRoot = join(projectRoot, 'work');
    assert(
      (await stableShapeOf(join(webRoot, 'timeline.json'))) ===
        (await stableShapeOf(join(cliRoot, 'timeline.json'))),
      'work/timeline.json matches the CLI baseline once probedAt/modifiedAtMs are stripped (cycle-01 measured those two as the only difference)',
    );
    assert(
      (await stableShapeOf(join(webRoot, 'catalog.json'))) ===
        (await stableShapeOf(join(cliRoot, 'catalog.json'))),
      'work/catalog.json matches the CLI baseline once probedAt/modifiedAtMs are stripped',
    );
    assert(
      webTimelineSha !== cliTimelineSha || webCatalogSha === cliCatalogSha,
      'the raw sha256 of timeline.json is allowed to differ: it embeds the ingest timestamps',
    );

    log('8', 'going back to the library and asking for a second montage: the service must answer 409');
    await page.getByRole('link', { name: '← asset library' }).click();
    await page.waitForSelector('[data-testid="montage-trigger"]');
    const [conflictResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Generate montage' }).click(),
    ]);
    assert(conflictResponse.status() === 409, `the second montage was refused with 409 (got ${conflictResponse.status()})`);
    const conflictBody = await conflictResponse.json();
    assert(
      conflictBody.error.code === 'TIMELINE_ALREADY_EXISTS',
      `the refusal carries TIMELINE_ALREADY_EXISTS (got ${conflictBody.error?.code})`,
    );
    await page.waitForSelector('[role="alertdialog"]');
    const confirmationText = await page.locator('[role="alertdialog"]').textContent();
    log('8', `confirmation shown: ${confirmationText?.trim().slice(0, 120)}…`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'montage-smoke-03-overwrite-confirmation.png') });

    await page.getByRole('button', { name: 'Keep the current timeline' }).click();
    const timelineShaAfterDismiss = await sha256OfFile(generatedTimelinePath);
    assert(
      timelineShaAfterDismiss === webTimelineSha,
      'dismissing the confirmation left work/timeline.json untouched on disk',
    );

    log('9', 'back to the preview to edit the generated timeline');
    await page.getByRole('link', { name: 'open preview' }).click();
    await page.waitForSelector('[data-testid="timeline-player"]');

    const shortenTargets = [
      ['aroll-0001', 30],
      ['aroll-0002', 25],
      ['aroll-0003', 20],
      ['aroll-0004', 20],
      ['aroll-0005', 20],
      ['aroll-0006', 25],
    ];
    for (const [clipId, targetDuration] of shortenTargets) {
      const input = page.getByLabel(`Duration for ${clipId}`);
      const before = Number(await input.inputValue());
      await input.fill(String(targetDuration));
      await input.blur();
      log('9', `${clipId}.durationFrames ${before} -> ${targetDuration}`);
    }

    const saveButton = page.getByRole('button', { name: 'Save' });
    assert(await saveButton.isEnabled(), 'Save is enabled after editing the generated timeline');
    await saveButton.click();
    await page.waitForFunction(
      () => {
        const bar = document.querySelector('[data-testid="timeline-save-bar"]');
        return bar !== null && bar.getAttribute('data-timeline-dirty') === 'false';
      },
      undefined,
      { timeout: 10000 },
    );
    log('9', 'save confirmed in the UI: data-timeline-dirty="false"');

    const savedTimeline = JSON.parse(await readFile(generatedTimelinePath, 'utf8'));
    const editedDurationFrames = savedTimeline.durationFrames;
    log('9', `edited timeline.durationFrames on disk: ${editedDurationFrames}`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'montage-smoke-04-edited-and-saved.png') });

    log('10', 'triggering the render of the edited timeline (EP-012 kind: render)');
    const renderButton = page.getByRole('button', { name: 'Render' });
    assert(await renderButton.isEnabled(), 'Render is enabled after a clean save');
    const renderStartedAt = Date.now();
    const [renderResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      renderButton.click(),
    ]);
    const renderJob = await renderResponse.json();
    assert(renderJob.kind === 'render', `the created job is kind: "render" (got ${renderJob.kind})`);
    const renderJobId = renderJob.id;
    log('10', `render job created: ${renderJobId}`);

    const renderStages = [];
    let sawFrameProgress = false;
    const finalRender = await pollJobUntilTerminal(renderJobId, 600000, (job) => {
      const stage = job.progress?.stage ?? null;
      if (stage !== null && renderStages.at(-1) !== stage) {
        renderStages.push(stage);
        log('10', `API progress: stage=${stage}`);
      }
      if (job.progress?.stage === 'render' && (job.progress.renderedFrames ?? 0) > 0) {
        sawFrameProgress = true;
      }
    });
    const renderSeconds = (Date.now() - renderStartedAt) / 1000;

    assert(finalRender !== null, 'the render job reached a terminal state inside the deadline');
    if (finalRender.state === 'failed') {
      throw new Error(
        `ASSERTION FAILED: render job ${renderJobId} failed with code=${finalRender.error?.code ?? 'unknown'} message=${finalRender.error?.message ?? 'none'}`,
      );
    }
    assert(finalRender.state === 'succeeded', `the render job succeeded (got ${finalRender.state})`);
    assert(sawFrameProgress, 'per-frame progress was observed while the render stage ran');
    log('10', `render finished in ${renderSeconds.toFixed(1)}s; stages: ${renderStages.join(' → ')}`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'montage-smoke-05-render-succeeded.png') });

    log('11', 'downloading the MP4 (EP-011) and probing its streams');
    const deliverableUrl = `http://127.0.0.1:${RENDER_API_PORT}/projects/${SLUG}/files/out/${renderJobId}.mp4`;
    const deliverableResponse = await fetch(deliverableUrl);
    assert(deliverableResponse.ok, `GET ${deliverableUrl} returned ok (status ${deliverableResponse.status})`);
    const deliverable = Buffer.from(await deliverableResponse.arrayBuffer());
    const localMp4Path = join(tmpdir(), `montage-smoke-${renderJobId}.mp4`);
    await writeFile(localMp4Path, deliverable);
    log('11', `downloaded ${deliverable.byteLength} bytes to ${localMp4Path}`);

    const videoProbe = probeStream(
      localMp4Path,
      'v:0',
      'codec_name,width,height,r_frame_rate,nb_frames,pix_fmt',
    );
    const audioProbe = probeStream(localMp4Path, 'a:0', 'codec_name,sample_rate,channels,duration');
    log('11', `video stream: ${JSON.stringify(videoProbe)}`);
    log('11', `audio stream: ${JSON.stringify(audioProbe)}`);

    const [rateNum, rateDen] = videoProbe.r_frame_rate.split('/').map(Number);
    const derivedFps = rateNum / rateDen;
    log(
      '11',
      `derived from the VIDEO stream (never format.duration): nb_frames=${videoProbe.nb_frames} r_frame_rate=${videoProbe.r_frame_rate} duration=${(Number(videoProbe.nb_frames) / derivedFps).toFixed(3)}s`,
    );

    assert(
      Number(videoProbe.nb_frames) === editedDurationFrames,
      `video stream nb_frames (${videoProbe.nb_frames}) matches the edited timeline.durationFrames (${editedDurationFrames})`,
    );
    assert(typeof audioProbe.codec_name === 'string', 'the deliverable carries an audio stream');
    assert(Number(audioProbe.sample_rate) > 0, `the audio stream has a positive sample_rate (${audioProbe.sample_rate})`);

    log(
      'done',
      `spec-007 cycle-02 E2E complete: raw/ → montage (${montageSeconds.toFixed(1)}s) → preview → 409 → edit → save → render (${renderSeconds.toFixed(1)}s) → download → ffprobe`,
    );
  } finally {
    await browser.close();
    renderApi.kill('SIGTERM');
    web.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(tempMediaRoot, { recursive: true, force: true });
    log('cleanup', `temp media root removed: ${tempMediaRoot}`);
  }
}

await main();
