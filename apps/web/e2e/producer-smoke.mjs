import { execSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
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
  'sdd/specs/spec-e-burgos-015-studio-producer/cycles/cycle-02/artifacts',
);

const RENDER_API_PORT = 4398;
const WEB_PORT = 4210;
const SLUG = 'demo-01';

const TURN_ONE_TEXT =
  'Contame qué material hay y proponeme un video de 30 segundos, sin nombrar la marca.';
const TURN_TWO_FALLBACK = 'Dale, avanzá con esa propuesta y entregame el MP4.';
const TURN_THREE_TEXT = 'Escribime un título alternativo para el video.';
const MODEL_TURN_TEXT = 'Respondeme solamente con la palabra LISTO, sin tocar ningún archivo.';
const MODEL_TURN_DEADLINE_MS = 300_000;

const TURN_DEADLINE_MS = 900_000;
const STOP_AFTER_STEP = Number(process.env.PRODUCER_SMOKE_STOP_AFTER ?? '99');
const RATE_LIMIT_CODES = new Set(['PRODUCER_RATE_LIMITED', 'PRODUCER_UNAVAILABLE']);

const CARRIED_OVER_PRODUCER_STATE = new Set(['conversation.json', 'conversation.md', 'session.json']);

const timeline = [];

function record(step, detail) {
  timeline.push({ step, detail, at: new Date().toISOString() });
  log(step, detail);
}

async function apiJson(path) {
  const response = await fetch(`http://127.0.0.1:${RENDER_API_PORT}${path}`);
  return { status: response.status, body: await response.json() };
}

async function startTurn(page, label, act) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/producer/messages') && candidate.request().method() === 'POST',
    ),
    act(),
  ]);

  const body = await response.json();
  record(label, `POST /producer/messages -> ${response.status()} ${JSON.stringify(body).slice(0, 200)}`);

  if (response.status() !== 202) {
    throw new Error(`PRODUCER_QUOTA_STOP: ${body.error?.code ?? response.status()}`);
  }

  return body.turnId;
}

async function followTurn(turnId, label, deadlineMs) {
  const startedAt = Date.now();
  let seenEvents = 0;
  const seenJobs = new Set();

  while (Date.now() - startedAt < deadlineMs) {
    const settled = await apiJson(`/projects/${SLUG}/producer/turns/${turnId}`);
    const turn = settled.body;

    for (const event of turn.events.slice(seenEvents)) {
      seenEvents += 1;
      const line =
        event.type === 'tool' ? `${event.name} - ${event.summary}` : (event.text ?? event.status);
      log(label, `event ${seenEvents}: ${String(line).replace(/\s+/gu, ' ').slice(0, 160)}`);
    }

    const jobs = await apiJson(`/projects/${SLUG}/jobs`);
    for (const job of jobs.body.jobs ?? []) {
      const key = `${job.id}:${job.state}`;
      if (!seenJobs.has(key)) {
        seenJobs.add(key);
        log(label, `job ${job.id} ${job.kind} -> ${job.state}${job.stage ? ` (${job.stage})` : ''}`);
      }
    }

    if (turn.status !== 'running') {
      return {
        turn,
        seconds: (Date.now() - startedAt) / 1000,
        events: turn.events.length,
        jobs: [...seenJobs],
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return {
    turn: null,
    seconds: (Date.now() - startedAt) / 1000,
    events: seenEvents,
    jobs: [...seenJobs],
  };
}


function stopIfQuota(turn, label) {
  if (turn !== null && turn.status === 'failed' && RATE_LIMIT_CODES.has(turn.error?.code)) {
    record(label, `QUOTA BRANCH: ${turn.error.code} — ${turn.error.message}`);
    throw new Error(`PRODUCER_QUOTA_STOP: ${turn.error.code}`);
  }
}

async function main() {
  await memoryGate();
  const stray = execSync("pgrep -fl 'claude -p' || true", { encoding: 'utf8' }).trim();
  assert(stray === '', `no orphan claude -p process from a previous run (found: ${stray || 'none'})`);

  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);

  record(
    '1',
    'copying raw/ and work/producer/ of media/demo-01 into a temporary media root, leaving behind the conversation and the session of the real project so the run always starts on the empty state',
  );
  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'producer-smoke-'));
  const projectRoot = join(tempMediaRoot, SLUG);
  await mkdir(join(projectRoot, 'work'), { recursive: true });
  await cp(join(REPO_ROOT, 'media', SLUG, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await cp(
    join(REPO_ROOT, 'media', SLUG, 'work', 'producer'),
    join(projectRoot, 'work', 'producer'),
    {
      recursive: true,
      filter: (source) => !CARRIED_OVER_PRODUCER_STATE.has(basename(source)),
    },
  );
  await mkdir(join(projectRoot, 'out'), { recursive: true });
  record('1', `temp media root: ${tempMediaRoot} (no out/, no catalog, no timeline)`);

  await mkdir(ARTIFACTS_DIR, { recursive: true });

  record('2', 'starting apps/render-api against the temporary media root');
  const renderApi = spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: tempMediaRoot,
      RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
      PRODUCER_MODEL: 'sonnet',
    },
  );

  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });

  let browser;
  try {
    const healthResponse = await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
    const health = await healthResponse.json();
    record('2', `render-api health: ${health.status} · capabilities ${JSON.stringify(health.capabilities)}`);
    assert(
      health.capabilities.producer === true,
      'the service under test exposes capabilities.producer (a stale server on another port answers 200 too)',
    );

    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 30000);
    record('3', 'web is up and its /api proxy reaches render-api');

    const playwright = await resolvePlaywright();
    browser = await playwright.chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        log('console-error', message.text());
      }
    });

    record('4', 'opening the project: the studio lands on the producer page');
    await page.goto(`http://localhost:${WEB_PORT}/`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: new RegExp(SLUG) }).first().click();
    await page.waitForSelector('[data-testid="producer-welcome"]');
    assert(
      page.url().endsWith(`/projects/${SLUG}/producer`),
      `the projects list opens each project on the producer (${page.url()})`,
    );

    const inventory = (await page.getByTestId('producer-inventory').textContent()) ?? '';
    record('4', `inventory on screen: ${inventory.replace(/\s+/g, ' ').trim()}`);
    assert(inventory.includes('aroll'), 'the empty state lists the real material of the project');
    assert(inventory.includes('logo'), 'the logo of raw/logo/ is part of the inventory');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-01-empty-state.png'), fullPage: true });

    record('M', 'model picker: the catalog of EP-022 and the select of the composer say the same thing');
    const conversation = await apiJson(`/projects/${SLUG}/producer`);
    record('M', `GET /producer models: ${JSON.stringify(conversation.body.models)}`);
    assert(
      conversation.body.models?.default === 'sonnet',
      'the conversation publishes the default model of the service (a stale build has no models at all)',
    );
    const allowed = conversation.body.models.allowed.map((option) => option.id);
    assert(allowed.includes('haiku'), `haiku is one of the allowed models (got ${JSON.stringify(allowed)})`);

    const picker = page.getByLabel('model');
    const offered = await picker.locator('option').evaluateAll((options) =>
      options.map((option) => option.value),
    );
    record('M', `models offered on screen: ${JSON.stringify(offered)}`);
    assert(
      JSON.stringify(offered) === JSON.stringify(allowed),
      'the select offers exactly the models the service allows, in the same order',
    );
    assert(
      (await picker.inputValue()) === 'sonnet',
      'the picker starts on the model of the session, or on the default when there is none',
    );

    if (STOP_AFTER_STEP <= 4) {
      record('probe', 'PRODUCER_SMOKE_STOP_AFTER=4 — the mechanics are verified, no claude -p was spent');
      return;
    }

    record('M', `switching the model to haiku and sending a short turn: "${MODEL_TURN_TEXT}"`);
    await picker.selectOption('haiku');
    await page.getByLabel('Message for the producer').fill(MODEL_TURN_TEXT);
    const modelTurnId = await startTurn(page, 'M', () =>
      page.getByRole('button', { name: 'Send' }).click(),
    );
    const modelTurn = await followTurn(modelTurnId, 'M', MODEL_TURN_DEADLINE_MS);
    stopIfQuota(modelTurn.turn, 'M');
    assert(modelTurn.turn !== null, 'the haiku turn reached a terminal state inside the deadline');
    assert(
      modelTurn.turn.model === 'haiku',
      `the turn record carries the model the user chose (got ${modelTurn.turn.model})`,
    );
    assert(modelTurn.turn.status === 'succeeded', `the haiku turn succeeded (got ${modelTurn.turn.status})`);

    const sessionOnDisk = JSON.parse(
      await readFile(join(projectRoot, 'work', 'producer', 'session.json'), 'utf8'),
    );
    record('M', `work/producer/session.json on disk: ${JSON.stringify(sessionOnDisk)}`);
    assert(
      sessionOnDisk.model === 'haiku',
      `the model in effect reached session.json on disk, not just the screen (got ${sessionOnDisk.model})`,
    );

    const badges = await page.locator('[data-testid^="producer-message-model-"]').allTextContents();
    record('M', `model badges on screen: ${JSON.stringify(badges)}`);
    assert(badges.at(-1) === 'haiku', 'the answer of the producer shows the model that wrote it');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-09-model-haiku.png'), fullPage: true });

    record('M', 'back to sonnet for the rest of the run: switching model mid session is valid');
    await picker.selectOption('sonnet');

    if (STOP_AFTER_STEP <= 5) {
      record('probe', 'PRODUCER_SMOKE_STOP_AFTER=5 — the model picker is verified end to end, one short turn spent');
      return;
    }

    record('5', `turn 1 — sending: "${TURN_ONE_TEXT}"`);
    await page.getByLabel('Message for the producer').fill(TURN_ONE_TEXT);
    const firstTurnId = await startTurn(page, '5', () =>
      page.getByRole('button', { name: 'Send' }).click(),
    );

    await page.waitForSelector('[data-testid="producer-turn-activity"]');
    await new Promise((resolve) => setTimeout(resolve, 12000));
    const liveEvents = (await page.getByTestId('producer-turn-events').textContent()) ?? '';
    record('5', `live events on screen after 12 s: ${liveEvents.replace(/\s+/g, ' ').trim().slice(0, 220)}`);
    assert(liveEvents.trim() !== '', 'the UI shows the events of the turn while it runs');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-02-turn-running.png'), fullPage: true });

    const first = await followTurn(firstTurnId, '5', TURN_DEADLINE_MS);
    stopIfQuota(first.turn, '5');
    assert(first.turn !== null, 'turn 1 reached a terminal state inside the deadline');
    assert(first.turn.status === 'succeeded', `turn 1 succeeded (got ${first.turn.status})`);
    record('5', `turn 1: ${first.seconds.toFixed(1)}s · ${first.events} events · ${first.turn.suggestions.length} suggestions`);

    await page.waitForSelector('[data-testid="producer-suggestions"]', { timeout: 30000 });
    const chips = await page.locator('[data-testid="producer-suggestions"] button').allTextContents();
    record('5', `chips on screen: ${JSON.stringify(chips)}`);
    assert(chips.length > 0, 'the answer of the producer arrived with clickable quick replies');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-03-answer-and-chips.png'), fullPage: true });

    record('6', 'turn 2 — answering with a chip so the producer makes the video');
    const forward = chips.find((chip) => /dale|avanz|adelante|hacelo|segu/iu.test(chip)) ?? null;
    const secondTurnId = await startTurn(page, '6', async () => {
      if (forward === null) {
        record('6', `no forward chip offered; sending the fallback text: "${TURN_TWO_FALLBACK}"`);
        await page.getByLabel('Message for the producer').fill(TURN_TWO_FALLBACK);
        await page.getByRole('button', { name: 'Send' }).click();
        return;
      }
      record('6', `clicking the chip: "${forward}"`);
      await page.getByRole('button', { name: forward, exact: true }).click();
    });

    await page.waitForSelector('[data-testid="producer-turn-activity"]');
    const second = await followTurn(secondTurnId, '6', TURN_DEADLINE_MS);
    stopIfQuota(second.turn, '6');
    assert(second.turn !== null, 'turn 2 reached a terminal state inside the deadline');
    record('6', `turn 2: ${second.seconds.toFixed(1)}s · ${second.events} events · jobs seen: ${JSON.stringify(second.jobs)}`);
    assert(second.turn.status === 'succeeded', `turn 2 succeeded (got ${second.turn.status})`);

    const jobsAfter = await apiJson(`/projects/${SLUG}/jobs`);
    const kinds = (jobsAfter.body.jobs ?? []).map((job) => `${job.kind}:${job.state}`);
    record('6', `jobs of the project after turn 2: ${JSON.stringify(kinds)}`);
    assert(
      kinds.some((entry) => entry.startsWith('montage')),
      'the agent enqueued a montage job on this same API',
    );

    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-04-turn-two-done.png'), fullPage: true });

    record('7', 'checking the deliverable the producer left in out/');
    const outFiles = await readdir(join(projectRoot, 'out')).catch(() => []);
    const mp4 = outFiles.find((name) => name.endsWith('.mp4'));
    if (mp4 !== undefined) {
      const mp4Path = join(projectRoot, 'out', mp4);
      const video = probeStream(mp4Path, 'v:0', 'width,height,nb_frames,r_frame_rate');
      const audio = probeStream(mp4Path, 'a:0', 'codec_name,sample_rate,channels');
      record(
        '7',
        `out/${mp4}: ${video.width}x${video.height} · ${video.nb_frames} frames @ ${video.r_frame_rate} · audio ${audio.codec_name} ${audio.sample_rate} Hz`,
      );
      assert(Number(video.nb_frames) > 0, 'the MP4 has real video frames');
      assert(audio.codec_name !== undefined, 'the MP4 carries an audio stream');
    } else {
      record('7', `no MP4 in out/ (files: ${JSON.stringify(outFiles)}) — the producer stopped before the render`);
    }

    record('8', 'preview refreshed: the timeline the producer built is on screen');
    await page.getByRole('link', { name: 'preview', exact: true }).click();
    await page.waitForSelector('[data-testid="timeline-player"]', { timeout: 60000 });
    const tracks = await page.getByTestId('preview-tracks').textContent();
    record('8', `preview tracks: ${tracks}`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-05-preview.png'), fullPage: true });

    record('9', 'logo: driving timeline.logo from the preview and saving it');
    await page.waitForSelector('[data-testid="logo-overlay-editor"]');
    const logoCheckbox = page.getByLabel('Show logo');
    assert(
      await logoCheckbox.isEnabled(),
      'the logo control is enabled because raw/logo/ is in the catalog of the project',
    );

    async function saveTimeline(label) {
      const [put] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes(`/projects/${SLUG}/timeline`) &&
            response.request().method() === 'PUT',
        ),
        page.getByRole('button', { name: 'Save', exact: true }).click(),
      ]);
      assert(put.status() === 200, `${label}: the timeline PUT was accepted (got ${put.status()})`);
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="timeline-save-bar"]')
            ?.getAttribute('data-timeline-dirty') === 'false',
      );
      return JSON.parse(await readFile(join(projectRoot, 'work', 'timeline.json'), 'utf8'));
    }

    if (await logoCheckbox.isChecked()) {
      record('9', 'the montage already drew the logo (logo: auto): taking it off first');
      await logoCheckbox.uncheck();
      const withoutLogo = await saveTimeline('logo off');
      record('9', `work/timeline.json without the logo: logo=${JSON.stringify(withoutLogo.logo)}`);
      assert(withoutLogo.logo === undefined, 'unchecking the box removed the logo from the document on disk');
    }

    await logoCheckbox.check();
    await page.getByLabel('Logo position').selectOption('bottom-right');
    const onDisk = await saveTimeline('logo on');
    record('9', `work/timeline.json on disk now carries logo: ${JSON.stringify(onDisk.logo)}`);
    assert(onDisk.logo !== undefined, 'the logo reached work/timeline.json on disk, not just the screen');
    assert(onDisk.logo.position === 'bottom-right', 'the position saved is the one chosen on screen');
    assert(
      onDisk.assets.some((asset) => asset.id === onDisk.logo.assetId),
      'the logo asset travelled into timeline.assets, so validateTimeline accepts the document',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-06-logo.png'), fullPage: true });

    record('10', 'cancellation: a third short turn is killed from the UI');
    await page.getByRole('link', { name: 'producer', exact: true }).click();
    await page.waitForSelector('[data-testid="producer-composer"]');
    await page.getByLabel('Message for the producer').fill(TURN_THREE_TEXT);
    await startTurn(page, '10', () => page.getByRole('button', { name: 'Send' }).click());
    await page.waitForSelector('[data-testid="producer-turn-activity"]');
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="producer-turn-activity"]')
          ?.getAttribute('data-status') === 'canceled',
      undefined,
      { timeout: 120000 },
    );
    record('10', 'the third turn settled as canceled on screen');
    const alive = execSync("pgrep -fl 'claude -p' || true", { encoding: 'utf8' }).trim();
    record('10', `claude processes alive after the cancellation: ${alive || 'none'}`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'producer-smoke-07-canceled.png'), fullPage: true });

    record('done', 'spec-015 cycle-02 E2E complete');
  } finally {
    if (browser !== undefined) {
      await browser.close();
    }
    renderApi.kill('SIGTERM');
    web.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    execSync("pkill -f 'claude -p' || true");
    console.log(`\n[timeline]\n${timeline.map((entry) => `${entry.at} [${entry.step}] ${entry.detail}`).join('\n')}`);
    console.log(`[cleanup] the temporary media root was kept for inspection: ${tempMediaRoot}`);
  }
}

await main().catch(async (error) => {
  console.error(`\n[failed] ${error.message}`);
  process.exitCode = 1;
});
