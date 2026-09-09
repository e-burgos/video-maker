import { execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

const NON_REGRESSION_BASELINE_SHA256 =
  'c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/artifacts',
);

const RENDER_API_PORT = 4399;
const WEB_PORT = 4207;
const SLUG = 'smoke-ingest';

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  log('assert', `ok — ${message}`);
}

async function memoryGate() {
  log('0', 'memory gate');
  let heavyProcesses = '';
  try {
    heavyProcesses = execSync("pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' || true", {
      encoding: 'utf8',
    }).trim();
  } catch {
    heavyProcesses = '';
  }
  assert(heavyProcesses === '', `no ffmpeg/whisper-cli/chrome-headless process alive (found: ${heavyProcesses || 'none'})`);

  try {
    const pressure = execSync('memory_pressure | tail -2', { encoding: 'utf8' }).trim();
    log('0', pressure);
  } catch {
    log('0', 'memory_pressure not available on this platform, continuing');
  }
}

async function resolvePlaywright() {
  try {
    return await import('playwright');
  } catch {
    // fall through to the npx cache below — playwright is never a package.json dependency here
  }

  const npxRoot = join(homedir(), '.npm', '_npx');
  let entries = [];
  try {
    entries = await readdir(npxRoot);
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    const candidate = join(npxRoot, entry, 'node_modules', 'playwright', 'index.mjs');
    try {
      return await import(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(
    'playwright not found. Run `npx playwright install` once on this machine (never add it to ' +
      'package.json) so this script can find it under ~/.npm/_npx/*/node_modules/playwright.',
  );
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (cause) {
      lastError = cause;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

function spawnLogged(label, command, args, env) {
  const child = spawn(command, args, { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function main() {
  await memoryGate();

  log('1', 'copying media/smoke-ingest into a temporary media root (never media/ itself)');
  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'studio-smoke-'));
  await cp(join(REPO_ROOT, 'media', SLUG), join(tempMediaRoot, SLUG), { recursive: true });
  log('1', `temp media root: ${tempMediaRoot}`);

  const initialTimelinePath = join(tempMediaRoot, SLUG, 'work', 'timeline.json');
  const initialTimeline = JSON.parse(await readFile(initialTimelinePath, 'utf8'));
  const initialArollDuration = initialTimeline.tracks.aroll[0].durationFrames;
  const initialAutomation = initialTimeline.audioMix.automation;
  log(
    '1',
    `baseline read: aroll-0001.durationFrames=${initialArollDuration}, ` +
      `automation keyframes=${initialAutomation.length}, format.preset=${initialTimeline.format.preset}`,
  );

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
  await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
  log('2', 'render-api is healthy');

  log('3', 'starting apps/web with its proxy pointed at render-api');
  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });
  await waitForHttp(`http://localhost:${WEB_PORT}/api/projects/${SLUG}/timeline`, 20000);
  log('3', 'web is up and the proxy reaches render-api (EP-007 reachable same-origin)');

  const { chromium } = await resolvePlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } });

  const badResponses = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      log('console-error', message.text());
    }
  });
  page.on('pageerror', (error) => {
    log('pageerror', error.stack ?? error.message);
  });

  try {
    log('4', 'opening the projects list (EP-002)');
    await page.goto(`http://localhost:${WEB_PORT}/`, { waitUntil: 'networkidle' });
    await page.getByText(SLUG, { exact: true }).click();

    log('4', 'opening the asset library (EP-004/EP-005)');
    await page.waitForSelector('[data-testid="asset-source"]');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-01-asset-library.png') });

    await page.getByRole('link', { name: 'open preview' }).click();

    log('4', 'opening the preview / studio page (EP-007)');
    await page.waitForSelector('[data-testid="timeline-player"]');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-02-preview-loaded.png') });

    log('5a', 'US-3-001: shortening the first a-roll clip');
    const trimInput = page.getByLabel('Duration for aroll-0001');
    const currentDuration = Number(await trimInput.inputValue());
    const newDuration = Math.max(1, Math.floor(currentDuration / 2));
    await trimInput.fill(String(newDuration));
    await trimInput.blur();
    log('5a', `aroll-0001.durationFrames ${currentDuration} -> ${newDuration}`);

    log('5b', 'US-3-002: correcting one transcribed caption word');
    const wordInput = page.getByLabel('Word 1 of caption-0001');
    const originalWord = await wordInput.inputValue();
    const correctedWord = 'Ahora';
    await wordInput.fill(correctedWord);
    await wordInput.blur();
    log('5b', `captions[0].words[0].text "${originalWord}" -> "${correctedWord}"`);

    log('5c', 'US-3-003: changing the persisted music levels');
    await page.getByLabel('Base level (dB)').fill('-6');
    await page.getByLabel('Base level (dB)').blur();
    await page.getByLabel('Ducked level (dB)').fill('-30');
    await page.getByLabel('Ducked level (dB)').blur();
    log('5c', 'audioMix.music.baseGainDb -> -6, duckedGainDb -> -30');

    log('5d', 'US-3-004: changing the persisted output preset to a same-aspect-ratio preset');
    await page.getByLabel('Output preset').selectOption('tiktok-9x16');
    log('5d', 'format.preset -> tiktok-9x16 (same 9:16 aspect as reels-9x16, avoids caption safe-zone risk)');

    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-03-edited.png') });

    log('6', 'checking the render trigger is disabled while there are unsaved changes (CA-221)');
    const renderButton = page.getByRole('button', { name: 'Render' });
    assert(await renderButton.isDisabled(), 'Render button is disabled before saving');

    log('6', 'saving the timeline (EP-008)');
    const saveButton = page.getByRole('button', { name: 'Save' });
    assert(await saveButton.isEnabled(), 'Save button is enabled with unsaved changes and no blocking issues');
    await saveButton.click();

    await page.waitForFunction(() => {
      const bar = document.querySelector('[data-testid="timeline-save-bar"]');
      return bar !== null && bar.getAttribute('data-timeline-dirty') === 'false';
    }, undefined, { timeout: 10000 });
    log('6', 'save confirmed in the UI: data-timeline-dirty="false"');

    log('6', 'checking the render trigger is enabled again after a clean save (CA-221)');
    assert(await renderButton.isEnabled(), 'Render button is enabled after saving with no blocking issues');

    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-04-saved.png') });

    assert(badResponses.length === 0, `no response >= 400 from the app (saw: ${badResponses.join(', ') || 'none'})`);

    log('6', 'verifying the four edits landed on DISK, not just in the HTTP response (CA-217/CA-243)');
    const savedTimeline = JSON.parse(await readFile(initialTimelinePath, 'utf8'));

    assert(
      savedTimeline.tracks.aroll[0].durationFrames === newDuration,
      `work/timeline.json has tracks.aroll[0].durationFrames === ${newDuration}`,
    );
    assert(
      savedTimeline.tracks.captions[0].words[0].text === correctedWord,
      `work/timeline.json has tracks.captions[0].words[0].text === "${correctedWord}"`,
    );
    assert(
      savedTimeline.audioMix.music.baseGainDb === -6 && savedTimeline.audioMix.music.duckedGainDb === -30,
      'work/timeline.json has audioMix.music.baseGainDb === -6 and duckedGainDb === -30',
    );
    assert(
      JSON.stringify(savedTimeline.audioMix.automation) !== JSON.stringify(initialAutomation),
      'work/timeline.json has audioMix.automation rewritten (CA-210), not left stale',
    );
    assert(
      savedTimeline.format.preset === 'tiktok-9x16',
      'work/timeline.json has format.preset === "tiktok-9x16"',
    );

    log('done', 'TASK-029 scope complete: create/open -> library -> preview -> edit -> save, verified on disk');

    log('7a', 'US-3-001 (round 2): shortening the remaining a-roll clips to keep the render cheap (~90-150 frames)');
    const remainingArollTargets = [
      ['aroll-0002', 25],
      ['aroll-0003', 20],
      ['aroll-0004', 20],
      ['aroll-0005', 20],
      ['aroll-0006', 25],
    ];
    for (const [clipId, targetDuration] of remainingArollTargets) {
      const clipDurationInput = page.getByLabel(`Duration for ${clipId}`);
      const before = Number(await clipDurationInput.inputValue());
      await clipDurationInput.fill(String(targetDuration));
      await clipDurationInput.blur();
      log('7a', `${clipId}.durationFrames ${before} -> ${targetDuration}`);
    }

    await page.waitForFunction(() => {
      const bar = document.querySelector('[data-testid="timeline-save-bar"]');
      return bar !== null && bar.getAttribute('data-timeline-dirty') === 'true';
    }, undefined, { timeout: 10000 });

    log('7b', 'saving the shortened timeline before triggering the render (EP-008)');
    assert(await saveButton.isEnabled(), 'Save button is enabled after the second edit round');
    await saveButton.click();

    await page.waitForFunction(() => {
      const bar = document.querySelector('[data-testid="timeline-save-bar"]');
      return bar !== null && bar.getAttribute('data-timeline-dirty') === 'false';
    }, undefined, { timeout: 10000 });
    log('7b', 'second save confirmed in the UI: data-timeline-dirty="false"');

    const shortenedTimeline = JSON.parse(await readFile(initialTimelinePath, 'utf8'));
    const shortenedDurationFrames = shortenedTimeline.durationFrames;
    log('7b', `work/timeline.json durationFrames after shortening: ${shortenedDurationFrames}`);
    assert(
      shortenedDurationFrames >= 60 && shortenedDurationFrames <= 200,
      `timeline.durationFrames (${shortenedDurationFrames}) is within the cheap-render target range (~90-150 frames, generous bounds)`,
    );

    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-05-shortened.png') });

    log('8', 'triggering the render (EP-012) and capturing the created job id from the network response');
    assert(await renderButton.isEnabled(), 'Render button is enabled after the second clean save (CA-221)');
    const [createJobResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      renderButton.click(),
    ]);
    const createdJob = await createJobResponse.json();
    assert(
      typeof createdJob.id === 'string' && createdJob.id.length > 0,
      `created render job has a string id (got: ${JSON.stringify(createdJob.id)})`,
    );
    const jobId = createdJob.id;
    log('8', `render job created: ${jobId} (initial state=${createdJob.state}, stage=${createdJob.progress?.stage ?? 'n/a'})`);

    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-06-render-started.png') });

    log(
      '9',
      'polling the render job directly against render-api (EP-014) until a terminal state, capturing at least one intermediate snapshot',
    );
    const nonTerminalStates = new Set(['queued', 'running', 'canceling']);
    let observedIntermediate =
      nonTerminalStates.has(createdJob.state) ? createdJob : null;
    let finalJob = null;
    const pollDeadline = Date.now() + 120000;
    while (Date.now() < pollDeadline) {
      const jobResponse = await fetch(`http://127.0.0.1:${RENDER_API_PORT}/jobs/${jobId}`);
      assert(jobResponse.ok, `GET /jobs/${jobId} returned ok (status ${jobResponse.status})`);
      const job = await jobResponse.json();
      const stageLabel = job.progress ? job.progress.stage : 'n/a';
      const frameLabel =
        job.progress && job.progress.stage === 'render'
          ? `${job.progress.renderedFrames ?? '—'}/${job.progress.totalFrames ?? '—'}`
          : 'n/a';
      log('9', `state=${job.state} stage=${stageLabel} frames=${frameLabel}`);

      if (observedIntermediate === null && nonTerminalStates.has(job.state)) {
        observedIntermediate = job;
      }

      if (!nonTerminalStates.has(job.state)) {
        finalJob = job;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    assert(finalJob !== null, 'render job reached a terminal state before the 120s poll deadline');
    assert(
      observedIntermediate !== null,
      `a real intermediate (non-terminal) progress state was observed before completion (stage=${observedIntermediate?.progress?.stage ?? 'n/a'})`,
    );

    if (finalJob.state === 'failed') {
      throw new Error(
        `ASSERTION FAILED: render job ${jobId} ended in state "failed" with error.code=${finalJob.error?.code ?? 'unknown'} ` +
          `message=${finalJob.error?.message ?? 'none'}. Stopping per TASK-030 contract: no retry, no product change.`,
      );
    }

    assert(finalJob.state === 'succeeded', `render job ${jobId} ended in state "succeeded" (got: ${finalJob.state})`);
    log('9', `render finished (confirmed via direct EP-014 polling). report.deliverable=${JSON.stringify(finalJob.report?.deliverable ?? null)}`);

    try {
      await page.waitForFunction(() => {
        const panel = document.querySelector('[data-testid="render-job-panel"]');
        return panel !== null && /state: succeeded/.test(panel.textContent ?? '');
      }, undefined, { timeout: 8000 });
    } catch {
      log(
        '9',
        'the UI panel did not mirror the succeeded state within 8s (see KNOWN-ISSUE-02 in studio-smoke.md: ' +
          "the Vite dev server's dependency-optimizer full-reload can fire mid-poll and reset the " +
          'selected-job React state); re-selecting the job from the refreshed job list',
      );
      await page.getByRole('button', { name: 'Refresh' }).click();
      await page.getByRole('button', { name: jobId }).click();
      try {
        await page.waitForFunction(() => {
          const panel = document.querySelector('[data-testid="render-job-panel"]');
          return panel !== null && /state: succeeded/.test(panel.textContent ?? '');
        }, undefined, { timeout: 8000 });
      } catch {
        log('9', 'still not mirrored in the UI after re-selecting; continuing with the API-confirmed result only');
      }
    }
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'studio-smoke-07-render-succeeded.png') });

    log('10', 'downloading the rendered MP4 directly via Node fetch (EP-011) — not the browser');
    const deliverableUrl = `http://127.0.0.1:${RENDER_API_PORT}/projects/${SLUG}/files/out/${jobId}.mp4`;
    const deliverableResponse = await fetch(deliverableUrl);
    assert(deliverableResponse.ok, `GET ${deliverableUrl} returned ok (status ${deliverableResponse.status})`);
    const deliverableBuffer = Buffer.from(await deliverableResponse.arrayBuffer());
    const localMp4Path = join(tmpdir(), `studio-smoke-${jobId}.mp4`);
    await writeFile(localMp4Path, deliverableBuffer);
    log(
      '10',
      `downloaded ${deliverableBuffer.byteLength} bytes to ${localMp4Path} (outside the temp media ` +
        'root on purpose, so the finally cleanup below cannot delete this evidence before ffprobe runs)',
    );

    const renderedSha256 = createHash('sha256').update(deliverableBuffer).digest('hex');
    log('10', `sha256(${jobId}.mp4) = ${renderedSha256}`);
    assert(
      renderedSha256 !== NON_REGRESSION_BASELINE_SHA256,
      'rendered file sha256 legitimately DIFFERS from the TASK-028 non-regression baseline — this render is on ' +
        'the EDITED document, not the unedited one, so a different hash is expected and is NOT a regression (APR-03)',
    );

    log('11', 'running ffprobe against the video and audio streams (never format.duration)');
    const videoProbeRaw = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt -of json "${localMp4Path}"`,
      { encoding: 'utf8' },
    );
    const videoProbe = JSON.parse(videoProbeRaw).streams[0];
    log('11', `video stream: ${JSON.stringify(videoProbe)}`);

    const audioProbeRaw = execSync(
      `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of json "${localMp4Path}"`,
      { encoding: 'utf8' },
    );
    const audioProbe = JSON.parse(audioProbeRaw).streams[0];
    log('11', `audio stream: ${JSON.stringify(audioProbe)}`);

    const [rateNum, rateDen] = videoProbe.r_frame_rate.split('/').map(Number);
    const derivedFps = rateNum / rateDen;
    const derivedDurationSeconds = Number(videoProbe.nb_frames) / derivedFps;
    log(
      '11',
      `derived from the VIDEO stream (never format.duration): nb_frames=${videoProbe.nb_frames}, ` +
        `r_frame_rate=${videoProbe.r_frame_rate} (${derivedFps}fps), duration=${derivedDurationSeconds.toFixed(3)}s`,
    );

    assert(typeof videoProbe.codec_name === 'string', 'video stream has a codec_name');
    assert(
      Number(videoProbe.nb_frames) === shortenedDurationFrames,
      `video stream nb_frames (${videoProbe.nb_frames}) matches the edited timeline.durationFrames (${shortenedDurationFrames})`,
    );
    assert(typeof audioProbe.codec_name === 'string', 'audio stream has a codec_name');
    assert(Number(audioProbe.sample_rate) > 0, `audio stream has a positive sample_rate (${audioProbe.sample_rate})`);

    log(
      'done',
      'TASK-030 scope complete: shorten -> save -> render -> intermediate progress observed -> succeeded -> download -> ffprobe (video+audio streams)',
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
