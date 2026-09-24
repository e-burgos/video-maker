import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REPO_ROOT,
  assert,
  log,
  memoryGate,
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-02/artifacts',
);

const RENDER_API_PORT = 4397;
const WEB_PORT = 4209;
const SLUG = 'smoke-ingest';
const NON_TERMINAL_STATES = new Set(['queued', 'running', 'canceling']);
const BRIEF =
  'A 30 second vertical video about three terminal tricks that save a developer an hour a week. ' +
  'Energetic, Rioplatense Spanish, one host on camera.';
const AGENT_FAILURE_CODES = new Set([
  'AI_AGENT_RATE_LIMITED',
  'AI_AGENT_UNAVAILABLE',
  'AI_AGENT_FAILED',
  'AI_AGENT_INVALID_OUTPUT',
]);

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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function main() {
  await memoryGate();

  log('1', 'copying ONLY raw/ from media/smoke-ingest into a temporary media root');
  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'storyboard-smoke-'));
  const projectRoot = join(tempMediaRoot, SLUG);
  await mkdir(projectRoot, { recursive: true });
  await cp(join(REPO_ROOT, 'media', SLUG, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  const storyboardPath = join(projectRoot, 'work', 'storyboard.json');
  log('1', `temp media root: ${tempMediaRoot} (no work/, no storyboard yet)`);

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
      CLAUDE_CLI_MODEL: 'sonnet',
    },
  );
  const healthResponse = await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
  const health = await healthResponse.json();
  log('2', `render-api health: status=${health.status} capabilities=${JSON.stringify(health.capabilities)}`);
  assert(
    health.capabilities.storyboardQueue === true,
    'the service under test exposes capabilities.storyboardQueue (cycle-01 lesson: a stale server on another port answers 200 too)',
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
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: `http://localhost:${WEB_PORT}`,
  });
  const page = await context.newPage();

  const observedStages = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      log('console-error', message.text());
    }
  });
  page.on('pageerror', (error) => {
    log('pageerror', error.stack ?? error.message);
  });

  try {
    log('4', 'reaching the storyboard page from the project nav of the layout');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/library`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="project-nav"]');
    await page.getByRole('link', { name: 'storyboard', exact: true }).click();
    await page.waitForSelector('[data-testid="storyboard-empty-state"]');
    assert(
      page.url().endsWith(`/projects/${SLUG}/storyboard`),
      `the nav opened the storyboard route (${page.url()})`,
    );
    assert(
      (await page.getByTestId('storyboard-trigger').isVisible()) === true,
      'the empty state is actionable: the propose panel is on the same screen',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'storyboard-smoke-01-empty-state.png') });

    log('5', 'writing the brief and proposing the storyboard (EP-012 kind: storyboard)');
    await page.getByLabel('Brief', { exact: true }).fill(BRIEF);
    const proposeButton = page.getByRole('button', { name: 'Propose storyboard' });
    assert(await proposeButton.isEnabled(), 'Propose storyboard is enabled with a filled brief');

    const stagePoller = setInterval(() => {
      page
        .locator('[data-testid="storyboard-stage"]')
        .textContent({ timeout: 150 })
        .then((text) => {
          if (text !== null && !observedStages.includes(text)) {
            observedStages.push(text);
            log('5', `UI progress: ${text}`);
          }
        })
        .catch(() => undefined);
    }, 200);

    const proposeStartedAt = Date.now();
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      proposeButton.click(),
    ]);

    if (createResponse.status() !== 202) {
      const body = await createResponse.json();
      clearInterval(stagePoller);
      log('5', `the service refused the job at request time: ${JSON.stringify(body)}`);
      assert(
        AGENT_FAILURE_CODES.has(body.error?.code),
        `an unexpected refusal is a failure, a quota refusal is not (got ${body.error?.code})`,
      );
      await page.waitForSelector('[data-testid="storyboard-failure-explanation"]');
      const explained = await page.getByTestId('storyboard-failure-explanation').textContent();
      log('5', `QUOTA/AGENT branch verified on screen: ${body.error.code} — ${explained?.trim()}`);
      await page.screenshot({ path: join(ARTIFACTS_DIR, 'storyboard-smoke-quota-branch.png') });
      throw new Error(`AGENT_UNAVAILABLE_STOP: ${body.error.code}`);
    }

    const createdJob = await createResponse.json();
    assert(createdJob.kind === 'storyboard', `the created job is kind: "storyboard" (got ${createdJob.kind})`);
    log('5', `storyboard job created: ${createdJob.id} (state=${createdJob.state})`);

    const apiStages = [];
    const finalJob = await pollJobUntilTerminal(createdJob.id, 420000, (job) => {
      const stage = job.progress?.stage ?? null;
      if (stage !== null && apiStages.at(-1) !== stage) {
        apiStages.push(stage);
        log('5', `API progress: stage=${stage} percent=${job.progress?.percent ?? '—'}`);
      }
    });
    clearInterval(stagePoller);
    const proposeSeconds = (Date.now() - proposeStartedAt) / 1000;

    assert(finalJob !== null, 'the storyboard job reached a terminal state inside the deadline');
    if (finalJob.state === 'failed') {
      const code = finalJob.error?.code ?? 'unknown';
      log('5', `the job failed with ${code}: ${finalJob.error?.message ?? 'no message'}`);
      await page.waitForSelector('[data-testid="storyboard-failure-explanation"]');
      const explained = await page.getByTestId('storyboard-failure-explanation').textContent();
      log('5', `failure branch verified on screen: ${code} — ${explained?.trim()}`);
      await page.screenshot({ path: join(ARTIFACTS_DIR, 'storyboard-smoke-quota-branch.png') });
      assert(AGENT_FAILURE_CODES.has(code), `the failure is one of the typed agent codes (got ${code})`);
      throw new Error(`AGENT_UNAVAILABLE_STOP: ${code}`);
    }
    assert(finalJob.state === 'succeeded', `the storyboard job succeeded (got ${finalJob.state})`);
    log(
      '5',
      `propose finished in ${proposeSeconds.toFixed(1)}s; API stages: ${apiStages.join(' → ')}; UI stages: ${observedStages.join(' | ') || 'none captured'}`,
    );
    assert(observedStages.length > 0, 'the UI showed at least one stage while the job was running');
    assert(apiStages.includes('propose'), 'the propose stage was reported by the job');
    log(
      '5',
      `report: ${finalJob.report.sceneCount} scenes · ${finalJob.report.language} · from ${finalJob.report.source} · tokens ${finalJob.report.usage.tokensIn}/${finalJob.report.usage.tokensOut}`,
    );

    log('6', 'the studio renders the storyboard the agent just produced');
    await page.waitForSelector('[data-testid="storyboard-header-editor"]', { timeout: 30000 });
    const sceneCount = await page.locator('[data-testid^="storyboard-scene-"]').count();
    const title = await page.getByLabel('Title', { exact: true }).inputValue();
    const language = await page.getByLabel('Language', { exact: true }).inputValue();
    log('6', `on screen: title="${title}" language=${language} scenes=${sceneCount}`);
    assert(
      sceneCount === finalJob.report.sceneCount,
      `every scene of the document is on screen (${sceneCount} of ${finalJob.report.sceneCount})`,
    );
    await page.screenshot({
      path: join(ARTIFACTS_DIR, 'storyboard-smoke-02-storyboard-rendered.png'),
      fullPage: true,
    });

    log('7', 'editing the narration of the first scene and saving it with a full PUT (EP-017)');
    const onDisk = JSON.parse(await readFile(storyboardPath, 'utf8'));
    const firstSceneId = onDisk.scenes[0].id;
    const editedNarration = 'Narración editada desde el Web Studio para verificar el PUT.';
    await page.getByLabel(`Narration for ${firstSceneId}`, { exact: true }).fill(editedNarration);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="storyboard-save-bar"]')
          ?.getAttribute('data-storyboard-dirty') === 'true',
    );

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/storyboard`) &&
          response.request().method() === 'PUT',
      ),
      page.getByRole('button', { name: 'Save storyboard' }).click(),
    ]);
    assert(putResponse.status() === 200, `the PUT was accepted with 200 (got ${putResponse.status()})`);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="storyboard-save-bar"]')
          ?.getAttribute('data-storyboard-dirty') === 'false',
    );

    const savedOnDisk = JSON.parse(await readFile(storyboardPath, 'utf8'));
    log('7', `work/storyboard.json on disk now starts scene 1 with: "${savedOnDisk.scenes[0].narration}"`);
    assert(
      savedOnDisk.scenes[0].narration === editedNarration,
      'the edited narration reached work/storyboard.json on disk, not just the screen',
    );
    assert(
      savedOnDisk.scenes.length === onDisk.scenes.length,
      'the PUT replaced the whole document without losing a scene',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'storyboard-smoke-03-edited-and-saved.png') });

    log('8', 'copying the numbered prompt sheet (EP-018) and reading the clipboard back');
    const [promptsResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/storyboard/prompts')),
      page.getByRole('button', { name: 'Copy prompts' }).click(),
    ]);
    assert(promptsResponse.status() === 200, `the prompt sheet answered 200 (got ${promptsResponse.status()})`);
    assert(
      (promptsResponse.headers()['content-type'] ?? '').startsWith('text/plain'),
      `the prompt sheet is text/plain (got ${promptsResponse.headers()['content-type']})`,
    );
    const served = await promptsResponse.text();
    await page.waitForSelector('[data-testid="storyboard-prompt-text"]');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    log('8', `clipboard holds ${clipboard.length} chars; first line: ${clipboard.split('\n')[0]}`);
    assert(clipboard === served, 'the clipboard holds the sheet byte for byte as the service emitted it');
    assert(/(^|\n)01[.)\s]/.test(clipboard), 'the sheet is numbered from 01, the numbering spec-010 imports');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'storyboard-smoke-04-prompts-copied.png') });

    log('8', 'copying the prompt of a single scene');
    await page.locator(`[data-testid="storyboard-scene-${firstSceneId}"] button`).first().click();
    await page.waitForSelector('[data-testid="storyboard-scene-copied"]');
    const sceneClipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert(
      sceneClipboard === savedOnDisk.scenes[0].visualPrompt,
      'the per-scene button copied exactly that scene visualPrompt',
    );

    log('9', 'proposing a second storyboard: the service must answer 409 and the UI must confirm');
    await page.getByLabel('Brief', { exact: true }).fill(BRIEF);
    const [conflictResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/projects/${SLUG}/jobs`) && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Propose storyboard' }).click(),
    ]);
    assert(conflictResponse.status() === 409, `the second proposal was refused with 409 (got ${conflictResponse.status()})`);
    const conflictBody = await conflictResponse.json();
    assert(
      conflictBody.error.code === 'STORYBOARD_ALREADY_EXISTS',
      `the refusal carries STORYBOARD_ALREADY_EXISTS (got ${conflictBody.error?.code})`,
    );
    await page.waitForSelector('[role="alertdialog"]');
    log('9', `confirmation shown: ${(await page.locator('[role="alertdialog"]').textContent())?.trim().slice(0, 120)}…`);
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'storyboard-smoke-05-overwrite-confirmation.png') });

    await page.getByRole('button', { name: 'Keep the current storyboard' }).click();
    const afterDismiss = JSON.parse(await readFile(storyboardPath, 'utf8'));
    assert(
      afterDismiss.scenes[0].narration === editedNarration,
      'dismissing the confirmation left the edited storyboard untouched on disk',
    );

    await copyFile(storyboardPath, join(ARTIFACTS_DIR, 'smoke-storyboard-from-web.json'));
    await writeFile(join(ARTIFACTS_DIR, 'smoke-prompts-copied-from-web.txt'), served);
    log('10', 'saved the produced storyboard and the copied prompt sheet to artifacts/');

    log(
      'done',
      `spec-008 cycle-02 E2E complete: empty state → propose (${proposeSeconds.toFixed(1)}s, ${finalJob.report.sceneCount} scenes) → edit → PUT verified on disk → prompts copied → 409 confirmed`,
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
