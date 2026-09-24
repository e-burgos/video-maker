import { execSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
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

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-005-render-service/fixes/artifacts',
);

const RENDER_API_PORT = 4420;
const WEB_PORT = 4421;
const SLUG = 'delete-asset-smoke';
const UPLOADED_FILENAME = 'delete-me.jpg';
const UPLOADED_ASSET_ID = `raw/images/${UPLOADED_FILENAME}`;
const AROLL_ASSET_ID = 'raw/aroll/clip01.mp4';

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readCatalog(projectRoot) {
  return JSON.parse(await readFile(join(projectRoot, 'work/catalog.json'), 'utf8'));
}

async function seedProject(mediaRoot) {
  const projectRoot = join(mediaRoot, SLUG);
  const source = join(REPO_ROOT, 'media/smoke-ingest');

  await mkdir(join(projectRoot, 'work'), { recursive: true });
  await cp(join(source, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await cp(join(source, 'work/transcripts'), join(projectRoot, 'work/transcripts'), {
    recursive: true,
  });
  for (const document of ['catalog.json', 'timeline.json']) {
    await cp(join(source, 'work', document), join(projectRoot, 'work', document));
  }

  const catalog = await readCatalog(projectRoot);
  catalog.projectSlug = SLUG;
  await writeFile(join(projectRoot, 'work/catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
  await cp(join(source, 'raw/images/photo01.jpg'), join(mediaRoot, UPLOADED_FILENAME));

  return projectRoot;
}

async function cardPaths(page) {
  return page
    .locator('[data-testid="asset-card"]')
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.assetPath));
}

function heavyProcessReport() {
  try {
    return execSync("pgrep -fl 'ffmpeg|chrome-headless|whisper-cli|piper' || true", {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

async function main() {
  log('0', `heavy processes alive (this smoke renders nothing): ${heavyProcessReport() || 'none'}`);
  await loadRootEnv(MEDIA_ENV_VARS);
  assertMediaEnvResolvable(MEDIA_ENV_VARS);

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'delete-asset-smoke-media-'));
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const projectRoot = await seedProject(tempMediaRoot);
  const uploadSource = join(tempMediaRoot, UPLOADED_FILENAME);
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

    log('3', 'cheap gate: the build under test publishes DELETE on the asset path');
    const methodProbe = await fetch(
      `http://127.0.0.1:${RENDER_API_PORT}/projects/${SLUG}/assets/aroll/never-uploaded.mp4`,
      { method: 'DELETE' },
    );
    const methodProbeBody = await methodProbe.json();
    log('3', `DELETE on a missing asset: ${methodProbe.status} ${methodProbeBody.error?.code}`);
    assert(
      methodProbe.status === 404 && methodProbeBody.error?.code === 'ASSET_NOT_FOUND',
      'the route exists in this build and answers 404 ASSET_NOT_FOUND, not 405 METHOD_NOT_ALLOWED',
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

    log('4', 'uploading a file through the studio uploader');
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/library`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="asset-card"]', { timeout: 20000 });
    await page.locator('[data-testid="asset-role-choice"][data-role="image"] input').check();
    await page.locator('input[type="file"]').setInputFiles(uploadSource);
    await page.waitForSelector(`[data-asset-path="${UPLOADED_ASSET_ID}"]`, { timeout: 20000 });

    const uploadedOnDisk = join(projectRoot, UPLOADED_ASSET_ID);
    assert(await exists(uploadedOnDisk), `the upload landed on disk at ${UPLOADED_ASSET_ID}`);
    const catalogAfterUpload = await readCatalog(projectRoot);
    assert(
      catalogAfterUpload.assets.some((entry) => entry.asset.id === UPLOADED_ASSET_ID),
      'work/catalog.json lists the uploaded asset',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'delete-asset-01-uploaded.png') });

    log('5', 'deleting the uploaded file from the library');
    const uploadedCard = page.locator(`[data-asset-path="${UPLOADED_ASSET_ID}"]`);
    await uploadedCard.locator('[data-testid="asset-delete-open"]').click();
    const confirmation = await uploadedCard
      .locator('[data-testid="asset-delete-confirm"]')
      .evaluate((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
    log('5', `confirmation: ${confirmation}`);
    assert(
      confirmation.includes(`Delete ${UPLOADED_FILENAME}?`),
      'the confirmation names the file it is about to remove',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'delete-asset-02-confirm.png') });

    await uploadedCard.locator('[data-testid="asset-delete-accept"]').click();
    await page.waitForSelector(`[data-asset-path="${UPLOADED_ASSET_ID}"]`, {
      state: 'detached',
      timeout: 20000,
    });

    const pathsAfterDelete = await cardPaths(page);
    log('5', `cards after the delete: ${pathsAfterDelete.join(' · ')}`);
    assert(
      !pathsAfterDelete.includes(UPLOADED_ASSET_ID),
      'the deleted asset is gone from the library listing',
    );
    assert(
      !(await exists(uploadedOnDisk)),
      `the file is gone from disk: ${uploadedOnDisk} no longer exists`,
    );
    const catalogAfterDelete = await readCatalog(projectRoot);
    assert(
      !catalogAfterDelete.assets.some((entry) => entry.asset.id === UPLOADED_ASSET_ID),
      'work/catalog.json no longer lists the deleted asset',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'delete-asset-03-deleted.png') });

    log('6', 'trying to delete the A-roll the stored timeline uses');
    const arollCard = page.locator(`[data-asset-path="${AROLL_ASSET_ID}"]`);
    await arollCard.locator('[data-testid="asset-delete-open"]').click();
    await arollCard.locator('[data-testid="asset-delete-accept"]').click();
    await arollCard.locator('[data-testid="asset-delete-in-use"]').waitFor({ timeout: 20000 });

    const inUse = await arollCard
      .locator('[data-testid="asset-delete-in-use"]')
      .evaluate((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
    log('6', `in-use warning: ${inUse}`);
    assert(
      inUse.includes('The timeline still uses this asset'),
      'the studio warns that the timeline still uses the A-roll instead of deleting it',
    );
    assert(
      inUse.includes('tracks.aroll clip'),
      'the warning names the timeline uses the service reported',
    );
    assert(
      await exists(join(projectRoot, AROLL_ASSET_ID)),
      'the referenced A-roll is still on disk after the refused delete',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'delete-asset-04-in-use.png') });

    log('7', 'deleting the referenced A-roll anyway');
    await arollCard.locator('[data-testid="asset-delete-force"]').click();
    await page.waitForSelector(`[data-asset-path="${AROLL_ASSET_ID}"]`, {
      state: 'detached',
      timeout: 20000,
    });

    assert(
      !(await exists(join(projectRoot, AROLL_ASSET_ID))),
      'Delete anyway removed the referenced A-roll from disk',
    );
    assert(
      !(await exists(join(projectRoot, 'work/transcripts/aroll/clip01.json'))),
      'the transcript derived from that A-roll went with it',
    );
    const finalCatalog = await readCatalog(projectRoot);
    log('7', `catalog transcripts left: ${JSON.stringify(finalCatalog.transcripts)}`);
    assert(
      finalCatalog.transcripts.length === 0 &&
        !finalCatalog.assets.some((entry) => entry.asset.id === AROLL_ASSET_ID),
      'work/catalog.json dropped both the asset entry and its transcript reference',
    );
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'delete-asset-05-forced.png') });

    log('done', 'delete asset smoke passed');
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
