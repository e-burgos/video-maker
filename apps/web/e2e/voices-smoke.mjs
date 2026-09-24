import { mkdir, mkdtemp, rm } from 'node:fs/promises';
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
  'sdd/specs/spec-e-burgos-016-studio-usability/cycles/cycle-01/artifacts',
);

const RENDER_API_PORT = 4411;
const WEB_PORT = 4412;
const SLUG = 'voices-smoke';
const MIN_PREVIEW_SECONDS = 2;
const MAX_CACHE_HIT_MS = 300;
const PLAYED_VOICES = 2;

async function timedFetch(url) {
  const startedAt = Date.now();
  const response = await fetch(url);
  const body = await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    cacheControl: response.headers.get('cache-control'),
    bytes: body.byteLength,
    elapsedMs: Date.now() - startedAt,
  };
}

async function measurePlayback(page, voiceId) {
  const startedAt = Date.now();
  const card = page.locator(`[data-testid="voice-card"][data-voice-id="${voiceId}"]`);
  await card.locator('button').click();

  const audio = card.locator('[data-testid="voice-preview-audio"]');
  await page.waitForFunction(
    (id) => {
      const element = document.querySelector(
        `[data-testid="voice-card"][data-voice-id="${id}"] [data-testid="voice-preview-audio"]`,
      );
      return element !== null && element.readyState >= 3 && element.duration > 0;
    },
    voiceId,
    { timeout: 60000 },
  );

  const measured = await audio.evaluate((element) => ({
    readyState: element.readyState,
    duration: element.duration,
    paused: element.paused,
    currentSrc: element.currentSrc,
  }));

  return { ...measured, elapsedMs: Date.now() - startedAt };
}

async function main() {
  await memoryGate();
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'voices-smoke-media-'));
  const previewCache = await mkdtemp(join(tmpdir(), 'voices-smoke-cache-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  log('1', `temp media root: ${tempMediaRoot} — preview cache: ${previewCache} (both outside media/)`);

  log('2', 'starting apps/render-api against the temporary media root and an empty preview cache');
  const renderApi = spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: tempMediaRoot,
      PIPER_PREVIEW_CACHE_DIR: previewCache,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
    },
  );

  const web = spawnLogged('web', 'pnpm', ['exec', 'vite', '--config', 'apps/web/vite.config.ts'], {
    ...process.env,
    WEB_PORT: String(WEB_PORT),
    RENDER_API_URL: `http://127.0.0.1:${RENDER_API_PORT}`,
  });

  let browser = null;

  try {
    await waitForHttp(`http://127.0.0.1:${RENDER_API_PORT}/health`, 20000);

    log('2', 'the first request proves this is the build under test, not a stale server');
    const catalogue = await (await fetch(`http://127.0.0.1:${RENDER_API_PORT}/voices`)).json();
    const [firstVoice] = catalogue.voices;
    assert(
      firstVoice !== undefined && typeof firstVoice.previewUrl === 'string',
      'GET /voices carries previewUrl, a field only the cycle-01 build emits',
    );
    assert(
      catalogue.voices.length >= 3,
      `at least three voices are installed (got ${catalogue.voices.length}: ${catalogue.voices
        .map((voice) => voice.id)
        .join(', ')})`,
    );
    for (const voice of catalogue.voices) {
      log(
        '2',
        `voice: ${voice.id} | label="${voice.label}" | language=${voice.language.code}/${voice.language.region} | quality=${voice.quality} | preview=${voice.previewUrl}`,
      );
      assert(
        voice.label !== voice.id && voice.description.length > 20 && voice.quality !== undefined,
        `${voice.id} is described with a readable label, a quality and a description`,
      );
    }

    const cached = catalogue.voices[catalogue.voices.length - 1];
    log('3', `timing the service-side cache on ${cached.id} (a voice the browser never touches)`);
    const miss = await timedFetch(`http://127.0.0.1:${RENDER_API_PORT}${cached.previewUrl}`);
    const hit = await timedFetch(`http://127.0.0.1:${RENDER_API_PORT}${cached.previewUrl}`);
    log('3', `cache miss: ${JSON.stringify(miss)}`);
    log('3', `cache hit:  ${JSON.stringify(hit)}`);
    assert(miss.status === 200 && miss.contentType === 'audio/wav', 'the preview is served as audio/wav');
    assert(miss.cacheControl === 'public, max-age=86400', 'the preview declares Cache-Control');
    assert(hit.bytes === miss.bytes, 'the cached preview is the very same wav, byte for byte');
    assert(
      hit.elapsedMs < MAX_CACHE_HIT_MS,
      `the second request is served from the cache in under ${MAX_CACHE_HIT_MS} ms (measured ${hit.elapsedMs} ms against ${miss.elapsedMs} ms)`,
    );

    const unknown = await fetch(`http://127.0.0.1:${RENDER_API_PORT}/voices/es_XX-nobody-high/preview`);
    assert(unknown.status === 404, `an unknown voice id is 404 (got ${unknown.status})`);
    assert(
      (await unknown.json()).error.code === 'VOICE_NOT_FOUND',
      'the 404 carries the typed code VOICE_NOT_FOUND',
    );

    log('4', 'creating the project the studio will show');
    const created = await fetch(`http://127.0.0.1:${RENDER_API_PORT}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: SLUG }),
    });
    assert(created.status === 201, `POST /projects created ${SLUG} (got ${created.status})`);

    await waitForHttp(`http://localhost:${WEB_PORT}/api/projects`, 20000);

    const { chromium } = await resolvePlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        log('console-error', message.text());
      }
    });
    page.on('pageerror', (error) => log('pageerror', error.stack ?? error.message));

    log('5', 'the asset library explains every upload role');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/library`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="asset-role-choices"]');
    const roles = await page.locator('[data-testid="asset-role-choice"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        role: node.dataset.role,
        selected: node.dataset.selected,
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    );
    for (const role of roles) {
      log('5', `role card: ${role.role} → ${role.text}`);
    }
    assert(
      roles.map((role) => role.role).join(',') === 'aroll,broll,image,audio,voice,logo',
      'the six roles are offered ordered by importance, A-roll first',
    );
    assert(
      roles.every((role) => role.text.length > 60),
      'every role is accompanied by what it does to the final video, not just its id',
    );
    assert(
      roles[0].text.toLowerCase().includes('required'),
      'A-roll is marked as the required one',
    );
    const hint = await page.locator('[data-testid="asset-role-hint"]').textContent();
    log('5', `role hint: ${hint}`);
    assert(
      hint.includes('at least three times'),
      'the B-roll matching rule is written on screen, not left to be guessed',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voices-smoke-01-upload-roles.png') });

    log('6', 'the voice page offers the installed voices as cards and plays them');
    await page.getByRole('link', { name: 'voice', exact: true }).click();
    await page.waitForSelector('[data-testid="voice-picker"]');
    const cards = await page.locator('[data-testid="voice-card"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.dataset.voiceId,
        selected: node.dataset.selected,
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    );
    for (const card of cards) {
      log('6', `voice card: ${card.id} (selected=${card.selected}) → ${card.text}`);
    }
    assert(cards.length === catalogue.voices.length, `one card per installed voice (${cards.length})`);
    assert(
      cards.filter((card) => card.selected === 'true').length === 1,
      'exactly one voice is selected, the one PIPER_MODEL_PATH points at',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voices-smoke-02-voice-cards.png') });

    const played = [];
    for (const voice of catalogue.voices.slice(0, PLAYED_VOICES)) {
      const measured = await measurePlayback(page, voice.id);
      log(
        '6',
        `played ${voice.id}: readyState=${measured.readyState} duration=${measured.duration.toFixed(2)}s in ${measured.elapsedMs} ms (${measured.currentSrc})`,
      );
      assert(
        measured.readyState >= 3 && measured.duration > MIN_PREVIEW_SECONDS,
        `${voice.id} really plays in the browser: readyState ${measured.readyState} >= 3 and duration ${measured.duration.toFixed(2)}s > ${MIN_PREVIEW_SECONDS}s`,
      );
      assert(
        measured.currentSrc.includes(`/api/voices/${voice.id}/preview`),
        `${voice.id} played the preview of its own voice`,
      );
      played.push({ id: voice.id, duration: measured.duration, elapsedMs: measured.elapsedMs });
    }
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'voices-smoke-03-preview-played.png') });

    log('7', 'picking a non-default voice keeps it selected for the job');
    const second = catalogue.voices[1];
    await page.getByLabel(`Use ${second.label}`).click();
    const selectedAfterPick = await page
      .locator('[data-testid="voice-card"][data-selected="true"]')
      .getAttribute('data-voice-id');
    assert(selectedAfterPick === second.id, `the picked voice stays selected (${selectedAfterPick})`);

    console.log(
      `\nSUMMARY ${JSON.stringify(
        {
          voices: catalogue.voices.map((voice) => ({ id: voice.id, label: voice.label })),
          played,
          cacheMissMs: miss.elapsedMs,
          cacheHitMs: hit.elapsedMs,
          previewBytes: miss.bytes,
          roles: roles.map((role) => role.role),
        },
        null,
        2,
      )}`,
    );
    log('done', 'voices smoke passed');
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    renderApi.kill('SIGTERM');
    web.kill('SIGTERM');
    await rm(tempMediaRoot, { recursive: true, force: true });
    await rm(previewCache, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
