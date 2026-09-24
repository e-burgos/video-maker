import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-009-voice-over/cycles/cycle-02/artifacts',
);

const SEED_STORYBOARD = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-02/artifacts/smoke-storyboard-from-web.json',
);

const RENDER_API_PORT = 4398;
const WEB_PORT = 4210;
const SLUG = 'smoke-ingest';
const NON_TERMINAL_STATES = new Set(['queued', 'running', 'canceling']);
const EDITED_NARRATION = 'Narración reescrita para que esta escena quede desactualizada.';
const STALE_SCENE = 'scene-02';
const UPLOAD_SCENE = 'scene-03';

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex').slice(0, 8);
}

async function trackHashes(projectRoot, sceneIds) {
  const hashes = {};
  for (const sceneId of sceneIds) {
    hashes[sceneId] = await sha256(join(projectRoot, 'work', 'voice', `${sceneId}.wav`));
  }
  return hashes;
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
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}

async function main() {
  await memoryGate();
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);

  log('1', 'seeding a temporary media root with raw/ and a storyboard produced by a previous run');
  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'voice-smoke-'));
  const projectRoot = join(tempMediaRoot, SLUG);
  await mkdir(join(projectRoot, 'work'), { recursive: true });
  await cp(join(REPO_ROOT, 'media', SLUG, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  const storyboardPath = join(projectRoot, 'work', 'storyboard.json');
  await copyFile(SEED_STORYBOARD, storyboardPath);
  const seeded = JSON.parse(await readFile(storyboardPath, 'utf8'));
  const sceneIds = seeded.scenes.map((scene) => scene.id);
  log('1', `temp media root: ${tempMediaRoot} — ${sceneIds.length} scenes, no work/voice/ yet`);
  assert(sceneIds.length === 5, `the seeded storyboard has five scenes (got ${sceneIds.length})`);

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
  log('2', `render-api health: status=${health.status}`);
  assert(
    health.capabilities.voiceQueue === true,
    'the service under test exposes capabilities.voiceQueue, so this is the build of cycle-01 and not a stale server',
  );
  const piper = health.binaries.filter((binary) => binary.name.startsWith('piper'));
  log('2', `piper binaries: ${JSON.stringify(piper)}`);
  assert(
    piper.length === 2 && piper.every((binary) => binary.resolved),
    'piperCli and piperModel resolve, so the studio can actually synthesize',
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 2400 } });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      log('console-error', message.text());
    }
  });
  page.on('pageerror', (error) => {
    log('pageerror', error.stack ?? error.message);
  });

  const observedStages = [];
  const observedCounters = [];

  try {
    log('4', 'reaching the voice page from the project nav of the layout');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/library`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="project-nav"]');
    await page.getByRole('link', { name: 'voice', exact: true }).click();
    await page.waitForSelector('[data-testid="voice-empty-state"]');
    assert(
      page.url().endsWith(`/projects/${SLUG}/voice`),
      `the nav opened the voice route (${page.url()})`,
    );

    await page.waitForSelector('[data-testid="voice-picker"]');
    const selectedVoice = await page
      .locator('[data-testid="voice-card"][data-selected="true"]')
      .getAttribute('data-voice-id');
    const offered = await page
      .locator('[data-testid="voice-card"]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.voiceId));
    log('4', `voice cards: selected=${selectedVoice} offered=${JSON.stringify(offered)}`);
    assert(
      selectedVoice !== null && offered.includes(selectedVoice),
      'the picker marks which voice PIPER_MODEL_PATH points at',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voice-smoke-01-empty-state.png') });

    log('5', 'generating the voice-over of the whole storyboard (EP-012 kind: voice)');
    const generateButton = page.getByRole('button', { name: 'Generate voice-over' });
    assert(await generateButton.isEnabled(), 'Generate voice-over is enabled with Piper resolved');

    const uiPoller = setInterval(() => {
      page
        .locator('[data-testid="voice-stage"]')
        .textContent({ timeout: 120 })
        .then((text) => {
          if (text !== null && !observedStages.includes(text)) {
            observedStages.push(text);
            log('5', `UI stage: ${text}`);
          }
        })
        .catch(() => undefined);
      page
        .locator('[data-testid="voice-scene-progress"]')
        .textContent({ timeout: 120 })
        .then((text) => {
          if (text !== null && !observedCounters.includes(text)) {
            observedCounters.push(text);
            log('5', `UI counter: ${text}`);
          }
        })
        .catch(() => undefined);
    }, 150);

    const startedAt = Date.now();
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      generateButton.click(),
    ]);
    assert(createResponse.status() === 202, `the voice job was accepted with 202 (got ${createResponse.status()})`);
    const createdJob = await createResponse.json();
    assert(createdJob.kind === 'voice', `the created job is kind: "voice" (got ${createdJob.kind})`);

    const apiStages = [];
    const finalJob = await pollJobUntilTerminal(createdJob.id, 300000, (job) => {
      const stage = job.progress?.stage ?? null;
      if (stage !== null && apiStages[apiStages.length - 1] !== stage) {
        apiStages.push(stage);
        log('5', `API stage: ${stage} (${job.progress?.processedScenes ?? '—'}/${job.progress?.totalScenes ?? '—'})`);
      }
    });
    clearInterval(uiPoller);
    const generateSeconds = (Date.now() - startedAt) / 1000;

    assert(finalJob !== null, 'the voice job reached a terminal state inside the deadline');
    assert(finalJob.state === 'succeeded', `the voice job succeeded (got ${finalJob.state}: ${finalJob.error?.code ?? ''})`);
    log('5', `voice-over finished in ${generateSeconds.toFixed(1)}s; API stages: ${apiStages.join(' → ')}`);
    assert(observedStages.length > 0, 'the UI showed at least one stage while the job was running');
    assert(observedCounters.length > 0, `the UI counted the scenes while synthesizing (${observedCounters.join(' | ')})`);
    assert(
      finalJob.report.scenes.length === 5,
      `the report carries one track per scene (got ${finalJob.report.scenes.length})`,
    );

    log('6', 'measuring every player in the browser: a good src and a 404 look the same');
    await page.waitForSelector('[data-testid="voice-scene-scene-01"]', { timeout: 30000 });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('audio')).length === 5 &&
        Array.from(document.querySelectorAll('audio')).every(
          (element) => element.readyState >= 1 && element.duration > 0,
        ),
      undefined,
      { timeout: 30000 },
    );
    const players = await page.$$eval('audio', (elements) =>
      elements.map((element) => ({
        label: element.getAttribute('aria-label'),
        src: element.getAttribute('src'),
        readyState: element.readyState,
        duration: Number(element.duration.toFixed(3)),
      })),
    );
    players.forEach((player) => log('6', `player ${player.label}: readyState=${player.readyState} duration=${player.duration}s`));
    assert(players.length === 5, `there are five players on screen (got ${players.length})`);

    const durations = await page.locator('[data-testid^="voice-duration-"]').allTextContents();
    durations.forEach((text) => log('6', `duration row: ${text.replace(/\s+/g, ' ').trim()}`));
    assert(
      durations.every((text) => text.includes('vs the estimate')),
      'every scene compares its real duration against the estimate of the storyboard',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voice-smoke-02-tracks.png'), fullPage: true });

    const manifestPath = join(projectRoot, 'work', 'voice', 'manifest.json');
    const hashesBefore = await trackHashes(projectRoot, sceneIds);
    log('6', `wav hashes after the first pass: ${JSON.stringify(hashesBefore)}`);

    log('7', `editing the narration of ${STALE_SCENE} on the storyboard page and saving it`);
    await page.getByRole('link', { name: 'storyboard', exact: true }).click();
    await page.waitForSelector('[data-testid="storyboard-header-editor"]');
    await page.getByLabel(`Narration for ${STALE_SCENE}`, { exact: true }).fill(EDITED_NARRATION);
    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/storyboard`) &&
          response.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: 'Save storyboard' }).click(),
    ]);
    assert(putResponse.status() === 200, `the narration edit was persisted with 200 (got ${putResponse.status()})`);

    log('7', 'back on the voice page, the edited scene has to be flagged as stale');
    await page.getByRole('link', { name: 'voice', exact: true }).click();
    await page.waitForSelector(`[data-testid="voice-stale-${STALE_SCENE}"]`, { timeout: 20000 });
    const staleFlags = await page.$$eval('[data-testid^="voice-scene-scene-"]', (cards) =>
      cards.map((card) => ({
        scene: card.getAttribute('data-testid'),
        stale: card.getAttribute('data-voice-stale'),
      })),
    );
    log('7', `staleness on screen: ${JSON.stringify(staleFlags)}`);
    assert(
      staleFlags.filter((flag) => flag.stale === 'true').length === 1,
      'exactly the edited scene is flagged, the other four are untouched',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voice-smoke-03-stale.png'), fullPage: true });

    log('8', `regenerating only ${STALE_SCENE}`);
    const [regenerateResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      page.locator(`[data-testid="voice-scene-${STALE_SCENE}"] button`, { hasText: 'Regenerate this scene' }).first().click(),
    ]);
    assert(regenerateResponse.status() === 202, `the partial job was accepted with 202 (got ${regenerateResponse.status()})`);
    const regenerateBody = JSON.parse(regenerateResponse.request().postData() ?? '{}');
    log('8', `regeneration body: ${JSON.stringify(regenerateBody)}`);
    assert(
      JSON.stringify(regenerateBody.sceneIds) === JSON.stringify([STALE_SCENE]),
      'the request asks for that scene and no other',
    );

    const regeneratedJob = await pollJobUntilTerminal((await regenerateResponse.json()).id, 120000, () => undefined);
    assert(regeneratedJob?.state === 'succeeded', `the partial job succeeded (got ${regeneratedJob?.state})`);

    const hashesAfter = await trackHashes(projectRoot, sceneIds);
    log('8', `wav hashes after regenerating ${STALE_SCENE}: ${JSON.stringify(hashesAfter)}`);
    assert(
      hashesAfter[STALE_SCENE] !== hashesBefore[STALE_SCENE],
      `${STALE_SCENE} was rewritten (${hashesBefore[STALE_SCENE]} → ${hashesAfter[STALE_SCENE]})`,
    );
    const untouched = sceneIds.filter((sceneId) => sceneId !== STALE_SCENE);
    assert(
      untouched.every((sceneId) => hashesAfter[sceneId] === hashesBefore[sceneId]),
      `the other four wav files are byte-identical (${untouched.join(', ')})`,
    );

    await page.waitForFunction(
      (scene) =>
        document
          .querySelector(`[data-testid="voice-scene-${scene}"]`)
          ?.getAttribute('data-voice-stale') === 'false',
      STALE_SCENE,
      { timeout: 30000 },
    );
    log('8', `${STALE_SCENE} is no longer stale on screen`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voice-smoke-04-regenerated.png'), fullPage: true });

    log('9', `uploading a recording of my own and attaching it to ${UPLOAD_SCENE}`);
    const takePath = join(tempMediaRoot, 'my-take.wav');
    await copyFile(join(projectRoot, 'work', 'voice', 'scene-05.wav'), takePath);
    const takeHash = await sha256(takePath);
    log('9', `the take is a copy of scene-05.wav renamed my-take.wav (sha256 ${takeHash})`);

    const hashesBeforeUpload = await trackHashes(projectRoot, sceneIds);
    const [attachResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/voice/scenes/${UPLOAD_SCENE}`) &&
          response.request().method() === 'PUT',
      ),
      page.getByLabel(`Upload a take for ${UPLOAD_SCENE}`, { exact: true }).setInputFiles(takePath),
    ]);
    assert(attachResponse.status() === 200, `EP-021 accepted the take with 200 (got ${attachResponse.status()})`);
    const attached = await attachResponse.json();
    log('9', `attached track: ${JSON.stringify(attached.track)}`);
    assert(attached.track.source === 'uploaded', `the stored track is source: uploaded (got ${attached.track.source})`);
    assert(attached.track.voiceId === null, 'an uploaded track declares no Piper voice');

    await page.waitForFunction(
      (scene) =>
        document
          .querySelector(`[data-testid="voice-scene-${scene}"]`)
          ?.getAttribute('data-voice-source') === 'uploaded',
      UPLOAD_SCENE,
      { timeout: 30000 },
    );
    const sourceOnScreen = await page.getByTestId(`voice-source-${UPLOAD_SCENE}`).textContent();
    log('9', `on screen: ${sourceOnScreen}`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voice-smoke-05-uploaded.png'), fullPage: true });

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const uploadedTrack = manifest.tracks.find((track) => track.sceneId === UPLOAD_SCENE);
    log('9', `manifest on disk for ${UPLOAD_SCENE}: ${JSON.stringify(uploadedTrack)}`);
    assert(uploadedTrack.source === 'uploaded', 'work/voice/manifest.json records the take as uploaded');
    assert(uploadedTrack.voiceId === null, 'the manifest entry of an uploaded take has no voiceId');
    assert(
      manifest.tracks.filter((track) => track.source === 'generated').length === 4,
      'the other four tracks are still the synthesized ones',
    );

    const hashesAfterUpload = await trackHashes(projectRoot, sceneIds);
    const notUploaded = sceneIds.filter((sceneId) => sceneId !== UPLOAD_SCENE);
    log('9', `wav hashes after attaching the take: ${JSON.stringify(hashesAfterUpload)}`);
    assert(
      notUploaded.every((sceneId) => hashesAfterUpload[sceneId] === hashesBeforeUpload[sceneId]),
      `attaching a take left the other four wav files byte-identical (${notUploaded.join(', ')})`,
    );

    await copyFile(manifestPath, join(ARTIFACTS_DIR, 'smoke-voice-manifest-from-web.json'));
    await copyFile(storyboardPath, join(ARTIFACTS_DIR, 'smoke-storyboard-edited-from-web.json'));
    await writeFile(
      join(ARTIFACTS_DIR, 'smoke-voice-players.json'),
      `${JSON.stringify({ players, durations, hashesBefore, hashesAfter, hashesAfterUpload }, null, 2)}\n`,
    );

    log(
      'done',
      `spec-009 cycle-02 E2E complete: empty state → generate (${generateSeconds.toFixed(1)}s, 5 tracks) → 5 players measured → narration edited → stale flagged → ${STALE_SCENE} regenerated alone → own take attached to ${UPLOAD_SCENE}`,
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
