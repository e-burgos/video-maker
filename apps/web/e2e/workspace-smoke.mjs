import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
  resolvePlaywright,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-05/artifacts',
);

const RENDER_API_PORT = 4470;
const WEB_PORT = 4471;
const SLUG_PREFIX = 'workspace-smoke';
const VIEWPORT = { width: 1440, height: 900 };
const MAX_TURN_COST_USD = 0.02;
const OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash';

const FIXTURES = {
  screenRecording: 'screen-recording.mp4',
  silentClip: 'silent-clip.mp4',
  logo: 'logo.png',
  photo: 'photo.jpg',
  music: 'music.wav',
};

async function buildFixtures(dir) {
  await mkdir(dir, { recursive: true });
  const paths = Object.fromEntries(Object.entries(FIXTURES).map(([key, name]) => [key, join(dir, name)]));

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=12',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    paths.screenRecording,
  ]);

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=6',
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    paths.silentClip,
  ]);

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=0x3355ffaa:s=320x180:d=1',
    '-frames:v', '1', '-pix_fmt', 'rgba',
    paths.logo,
  ]);

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=640x480:d=1',
    '-frames:v', '1',
    paths.photo,
  ]);

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=220:duration=60',
    '-c:a', 'pcm_s16le',
    paths.music,
  ]);

  return paths;
}

async function switchTo(page, language) {
  await page.locator(`[data-testid="language-switch"] [data-language="${language}"]`).click();
  await page.waitForFunction((code) => document.documentElement.lang === code, language, {
    timeout: 10000,
  });
}

async function dropFilesOnto(page, selector, filePaths) {
  await page.evaluate((sel) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.id = '__e2e_drop_source__';
    input.style.position = 'fixed';
    input.style.top = '-1000px';
    document.body.appendChild(input);
  }, selector);

  await page.locator('#__e2e_drop_source__').setInputFiles(filePaths);

  await page.evaluate((sel) => {
    const input = document.getElementById('__e2e_drop_source__');
    const target = document.querySelector(sel);
    if (target === null) {
      throw new Error(`drop target not found: ${sel}`);
    }
    const dataTransfer = new DataTransfer();
    for (const file of input.files) {
      dataTransfer.items.add(file);
    }
    const init = { bubbles: true, cancelable: true, dataTransfer };
    target.dispatchEvent(new DragEvent('dragenter', init));
    target.dispatchEvent(new DragEvent('dragover', init));
    target.dispatchEvent(new DragEvent('drop', init));
    input.remove();
  }, selector);
}

async function proposalCard(page, fileName) {
  return page.locator(`[data-testid="asset-proposal-card"]:has-text("${fileName}")`);
}

async function readCardState(card) {
  return card.evaluate((node) => ({
    role: node.querySelector('[data-testid="asset-proposal-role"]').value,
    reason: node.querySelector('p.text-xs.text-ink-faint')?.textContent ?? '',
  }));
}

async function main() {
  log('0', `heavy processes alive before this smoke: ${
    (() => {
      try {
        return execFileSync('bash', ['-c', "pgrep -fl 'ffmpeg|chrome-headless|whisper-cli|piper' || true"], {
          encoding: 'utf8',
        }).trim() || 'none';
      } catch {
        return 'none';
      }
    })()
  }`);

  await loadRootEnv(MEDIA_ENV_VARS);
  assertMediaEnvResolvable(MEDIA_ENV_VARS);
  await memoryGate();

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'workspace-smoke-media-'));
  const fixturesDir = await mkdtemp(join(tmpdir(), 'workspace-smoke-fixtures-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  log('1', `temp media root: ${tempMediaRoot}, fixtures: ${fixturesDir}`);

  log('1', 'building fixtures with ffmpeg (screen recording w/ audio, silent clip, alpha logo, photo, music)');
  const fixturePaths = await buildFixtures(fixturesDir);
  for (const [key, path] of Object.entries(fixturePaths)) {
    log('1', `  ${key}: ${path}`);
  }

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
  const consoleErrors = [];
  const failedRequests = [];
  const slug = `${SLUG_PREFIX}-${Date.now()}`;

  try {
    await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);
    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);

    const { chromium } = await resolvePlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push({ url: page.url(), text: message.text() });
        log('console-error', `[${page.url()}] ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push({ url: page.url(), text: error.stack ?? error.message });
      log('pageerror', error.stack ?? error.message);
    });
    page.on('requestfailed', (request) => {
      failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' });
      log('requestfailed', `${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push({ url: response.url(), failure: `HTTP ${response.status()}` });
      }
    });

    log('3', 'opening the projects home, switching to spanish');
    await page.goto(`http://localhost:${WEB_PORT}/`, { waitUntil: 'networkidle' });
    await switchTo(page, 'es');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'e2e-00-projects-home.png') });

    log('4', 'dropping the screen recording on the projects home (DataTransfer drop, creates a project)');
    await dropFilesOnto(page, '[data-testid="create-project-drop-zone"]', [fixturePaths.screenRecording]);
    await page.waitForURL(/\/projects\//, { timeout: 20000 });
    await page.waitForSelector('[data-testid="project-workspace"]', { timeout: 20000 });
    const createdSlug = decodeURIComponent(new URL(page.url()).pathname.split('/projects/')[1]);
    log('4', `landed in workspace of the new project: ${createdSlug}`);

    const projectRoot = join(tempMediaRoot, createdSlug);

    await page.waitForSelector('[data-testid="asset-proposal-card"]', { timeout: 20000 });
    let card = await proposalCard(page, FIXTURES.screenRecording);
    assert(await card.count() === 1, 'the dropped screen recording shows a pending proposal card');
    let state = await readCardState(card);
    log('4', `screen recording proposal: role=${state.role}, reason="${state.reason}"`);
    assert(state.role === 'aroll', 'ffprobe found audio in the screen recording, so it proposes A-roll');
    assert(state.reason === 'tiene voz', 'the reason is translated to spanish ("tiene voz")');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'e2e-01-new-project-pending-card.png') });

    log('5', 'attaching the photo through the chat attach input (setInputFiles on the hidden input)');
    await page
      .locator('[data-testid="chat-drop-zone"] input[type="file"]')
      .setInputFiles(fixturePaths.photo);

    log('5', 'dropping the silent clip, the logo and the music track onto the conversation panel (DataTransfer drop)');
    await dropFilesOnto(page, '[data-testid="producer-conversation-panel"]', [
      fixturePaths.silentClip,
      fixturePaths.logo,
      fixturePaths.music,
    ]);

    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="asset-proposal-card"]').length === 5,
      null,
      { timeout: 30000 },
    );
    log('5', 'all 5 files uploaded to the inbox and show a proposal card');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'e2e-02-five-proposal-cards.png') });

    const expected = {
      [FIXTURES.screenRecording]: { role: 'aroll', reason: 'tiene voz' },
      [FIXTURES.silentClip]: { role: 'broll', reason: 'no tiene audio' },
      [FIXTURES.logo]: { role: 'logo', reason: 'tiene transparencia' },
      [FIXTURES.photo]: { role: 'image', reason: 'es una foto' },
      [FIXTURES.music]: { role: 'audio', reason: 'su nombre de archivo menciona música' },
    };

    for (const [fileName, expectation] of Object.entries(expected)) {
      const proposal = await proposalCard(page, fileName);
      assert(await proposal.count() === 1, `a proposal card exists for ${fileName}`);
      const proposalState = await readCardState(proposal);
      log('6', `${fileName}: role=${proposalState.role}, reason="${proposalState.reason}"`);
      assert(
        proposalState.role === expectation.role,
        `${fileName} proposes role ${expectation.role} (got ${proposalState.role})`,
      );
      assert(
        proposalState.reason === expectation.reason,
        `${fileName} shows the spanish reason "${expectation.reason}" (got "${proposalState.reason}")`,
      );
    }

    log('7', 'confirming all 5, overriding the silent clip from broll to aroll');
    const silentCard = await proposalCard(page, FIXTURES.silentClip);
    await silentCard.locator('[data-testid="asset-proposal-role"]').selectOption('aroll');
    expected[FIXTURES.silentClip] = { ...expected[FIXTURES.silentClip], role: 'aroll' };

    for (const fileName of Object.keys(expected)) {
      const proposal = await proposalCard(page, fileName);
      await proposal.locator('[data-testid="asset-proposal-confirm"]').click();
    }

    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="asset-proposal-card"]').length === 0,
      null,
      { timeout: 30000 },
    );
    log('7', 'no pending proposal cards left, nothing was discarded');
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'e2e-03-all-confirmed.png') });

    log('8', 'checking on disk that every file landed in raw/<role>/ and the inbox is empty');
    const onDiskChecks = [
      { role: 'aroll', file: FIXTURES.screenRecording },
      { role: 'aroll', file: FIXTURES.silentClip },
      { role: 'logo', file: FIXTURES.logo },
      { role: 'images', file: FIXTURES.photo },
      { role: 'audio', file: FIXTURES.music },
    ];
    for (const { role, file } of onDiskChecks) {
      const path = join(projectRoot, 'raw', role, file);
      assert(existsSync(path), `${file} is at raw/${role}/${file} (${path})`);
    }
    const inboxDir = join(projectRoot, 'raw', 'inbox');
    const inboxEntries = existsSync(inboxDir) ? await readdir(inboxDir) : [];
    assert(inboxEntries.length === 0, `raw/inbox is empty after confirming everything (found: ${inboxEntries.join(', ') || 'none'})`);

    log('9', 'checking the Material tab lists the confirmed assets with translated labels');
    await page.locator('[data-testid="workspace-tab-material"]').click();
    await page.waitForSelector('[data-testid="workspace-material"]', { timeout: 10000 });
    const materialText = await page
      .locator('[data-testid="workspace-material"]')
      .evaluate((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
    log('9', `material tab: ${materialText}`);
    // No B-roll group after the step-7 override; assetRole.audio.short translates to "Música".
    for (const phrase of ['A-roll', 'Logo', 'Imágenes', 'Música']) {
      assert(materialText.includes(phrase), `the material tab shows the translated role "${phrase}"`);
    }
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'e2e-04-material-tab.png') });

    log('10', 'reloading: no pending cards survive a page reload once everything is confirmed');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="project-workspace"]', { timeout: 20000 });
    assert(
      (await page.locator('[data-testid="asset-proposal-card"]').count()) === 0,
      'no proposal cards after reload (all 5 were confirmed, none pending)',
    );

    log('11', 'setting the producer engine to openrouter/deepseek via the API (PUT /api/settings/producer)');
    const settingsResponse = await page.evaluate(
      async ({ model }) => {
        const response = await fetch('/api/settings/producer', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ engine: 'openrouter', models: { openrouter: model } }),
        });
        return { status: response.status, body: await response.json() };
      },
      { model: OPENROUTER_MODEL },
    );
    assert(settingsResponse.status === 200, `PUT /settings/producer accepted the openrouter engine (got ${settingsResponse.status})`);
    assert(
      settingsResponse.body.engines.openrouter.keyPresent === true,
      'the OpenRouter key is present in the macOS keychain (never read or printed by this test)',
    );
    log('11', `effective engine: ${settingsResponse.body.effectiveEngine}, model: ${settingsResponse.body.models.openrouter}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="producer-composer"]', { timeout: 20000 });
    const modelHelp = await page.locator('[data-testid="producer-model-help"]').textContent();
    log('11', `producer-model-help: ${modelHelp}`);

    log('12', 'sending one cheap producer turn asking what material this project has, in spanish');
    const question = '¿Qué material tiene este proyecto? Respondé en una línea.';
    await page.locator('[data-testid="producer-composer"] textarea').fill(question);
    await page.locator('[data-testid="producer-composer"] button', { hasText: /Enviar|Send/ }).click();

    await page.waitForFunction(
      () => document.querySelector('[data-testid="producer-turn-activity"]')?.getAttribute('data-status') !== undefined,
      null,
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () => {
        const activity = document.querySelector('[data-testid="producer-turn-activity"]');
        return activity !== null && activity.getAttribute('data-status') !== 'running';
      },
      null,
      { timeout: 180000 },
    );

    const turnStatus = await page.locator('[data-testid="producer-turn-activity"]').getAttribute('data-status');
    log('12', `turn settled with status: ${turnStatus}`);
    assert(turnStatus === 'succeeded', `the cheap openrouter turn succeeded (got ${turnStatus})`);

    const toolEvents = await page
      .locator('[data-testid="producer-turn-events"] li[data-event-type="tool"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    log('12', `tool calls: ${toolEvents.join(', ') || 'none'}`);
    assert(toolEvents.length > 0, 'the turn used at least one tool');
    for (const eventText of toolEvents) {
      assert(eventText.includes('mcp__studio__'), `tool call is namespaced under mcp__studio__ (got "${eventText}")`);
    }

    const messages = await page
      .locator('[data-testid="producer-message-list"] li[data-role="assistant"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    const lastAnswer = messages[messages.length - 1] ?? '';
    log('12', `assistant answer: ${lastAnswer}`);
    const answerLower = lastAnswer.toLowerCase();
    const mentionsMaterial = ['aroll', 'a-roll', 'broll', 'b-roll', 'logo', 'imagen', 'imágenes', 'audio', 'música', 'archivo'].some(
      (needle) => answerLower.includes(needle),
    );
    assert(mentionsMaterial, 'the answer mentions the confirmed files/roles');

    const costTexts = await page
      .locator('[data-testid="producer-message-list"] [data-testid^="producer-message-cost-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    log('12', `turn costs shown: ${costTexts.join(', ')}`);
    const lastCostText = costTexts[costTexts.length - 1] ?? '';
    const costMatch = /([0-9]+([.,][0-9]+)?)/.exec(lastCostText.replace(/\./g, '').replace(',', '.'));
    const parsedCost = costMatch === null ? null : Number(lastCostText.replace(/[^0-9.,]/g, '').replace(',', '.'));
    log('12', `parsed turn cost (best effort from "${lastCostText}"): ${parsedCost}`);
    if (parsedCost !== null && Number.isFinite(parsedCost)) {
      assert(parsedCost < MAX_TURN_COST_USD, `the turn cost is under US$ ${MAX_TURN_COST_USD} (parsed ${parsedCost})`);
    } else {
      log('12', `WARNING: could not parse a numeric cost from "${lastCostText}", recording the raw text in the report instead`);
    }
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'e2e-05-producer-turn.png') });

    log('13', 'loading the advanced menu routes: library, storyboard, voice, preview');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${encodeURIComponent(createdSlug)}`, {
      waitUntil: 'networkidle',
    });
    const consoleErrorsBeforeMenu = consoleErrors.length;
    const failedRequestsBeforeMenu = failedRequests.length;

    for (const routePath of ['library', 'storyboard', 'voice', 'preview']) {
      await page.goto(`http://localhost:${WEB_PORT}/projects/${encodeURIComponent(createdSlug)}/${routePath}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(ARTIFACTS_DIR, `e2e-06-advanced-${routePath}.png`) });
      log('13', `loaded /${routePath}`);
    }

    const newConsoleErrors = consoleErrors.slice(consoleErrorsBeforeMenu);
    const newFailedRequests = failedRequests.slice(failedRequestsBeforeMenu);
    log('13', `console errors while in the advanced menu: ${newConsoleErrors.length}`);
    log('13', `failed/4xx/5xx requests while in the advanced menu: ${newFailedRequests.length}`);
    for (const entry of newFailedRequests) {
      log('13', `  ${entry.url} — ${entry.failure}`);
    }

    log('done', 'workspace smoke passed');
    log('report', `total console errors: ${consoleErrors.length}, total failed/4xx/5xx requests: ${failedRequests.length}`);
    process.stdout.write(
      `\n${JSON.stringify(
        {
          createdSlug,
          consoleErrors,
          failedRequests,
          turnStatus,
          toolEvents,
          lastAnswer,
          lastCostText,
        },
        null,
        2,
      )}\n`,
    );
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
    await rm(tempMediaRoot, { recursive: true, force: true });
    await rm(fixturesDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
