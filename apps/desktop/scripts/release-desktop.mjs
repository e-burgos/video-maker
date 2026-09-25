import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DESKTOP_ROOT = join(REPO_ROOT, 'apps', 'desktop');
const DIST_DESKTOP_DIR = join(REPO_ROOT, 'dist', 'desktop');
const BUILD_DESKTOP_SCRIPT = join(DESKTOP_ROOT, 'scripts', 'build-desktop.mjs');
const CHANGELOG_PATH = join(DESKTOP_ROOT, 'CHANGELOG.md');

export const DEFAULT_DOWNLOADS_BUCKET = 'video-maker-downloads';
export const DOWNLOADS_DOMAIN = 'https://video.estebanburgos.com.ar';
export const DMG_CONTENT_TYPE = 'application/x-apple-diskimage';

export function log(message) {
  process.stdout.write(`[release-desktop] ${message}\n`);
}

export function parseReleaseArgs(argv, defaultBucket = DEFAULT_DOWNLOADS_BUCKET) {
  let bucket = defaultBucket;
  let publish = false;

  for (const arg of argv) {
    if (arg === '--publish') {
      publish = true;
      continue;
    }
    const bucketMatch = /^--bucket=(.+)$/.exec(arg);
    if (bucketMatch !== null) {
      bucket = bucketMatch[1];
      continue;
    }
    throw new Error(`unrecognized argument: ${arg}`);
  }

  return { publish, bucket };
}

export function extractChangelogSection(changelog, version) {
  const headingPattern = new RegExp(`^## +${version.replace(/\./g, '\\.')}\\b.*$`, 'm');
  const headingMatch = headingPattern.exec(changelog);
  if (headingMatch === null) {
    throw new Error(`CHANGELOG.md has no "## ${version}" section`);
  }

  const afterHeading = changelog.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = /^## /m.exec(afterHeading);
  const body = nextHeadingMatch === null ? afterHeading : afterHeading.slice(0, nextHeadingMatch.index);

  const title = headingMatch[0].replace(/^## +/, '').trim();
  return { title, body: body.trim() };
}

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function formatSha256Line(hash, fileName) {
  return `${hash}  ${fileName}\n`;
}

export function downloadUrlFor(key) {
  return `${DOWNLOADS_DOMAIN}/descargas/${key}`;
}

export function buildWranglerR2PutArgs({ bucket, key, filePath }) {
  return [
    'dlx',
    'wrangler@4',
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--file',
    filePath,
    '--content-type',
    DMG_CONTENT_TYPE,
    '--remote',
  ];
}

export function formatPnpmCommand(args) {
  return `pnpm ${args.map((part) => (/[\s"]/.test(part) ? JSON.stringify(part) : part)).join(' ')}`;
}

function readDesktopVersion() {
  const packageJson = JSON.parse(readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf8'));
  return packageJson.version;
}

function runDesktopBuild() {
  log('building the .dmg (reusing build-desktop.mjs)');
  execFileSync('node', [BUILD_DESKTOP_SCRIPT], { cwd: REPO_ROOT, stdio: 'inherit' });
}

function ensureWranglerLoggedIn() {
  let output;
  try {
    output = execFileSync('pnpm', ['dlx', 'wrangler@4', 'whoami'], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (error) {
    throw new Error(`could not run "wrangler whoami": ${error.message}`);
  }
  if (/not authenticated/i.test(output)) {
    throw new Error('not logged in to Cloudflare — run "pnpm dlx wrangler@4 login" first');
  }
  log(output.trim());
}

async function verifyDownload({ key, filePath }) {
  const url = downloadUrlFor(key);
  const expectedSize = statSync(filePath).size;

  let response;
  try {
    response = await fetch(url, { method: 'HEAD' });
  } catch (error) {
    log(`warning: could not reach ${url}: ${error.message} — the domain may not be live yet`);
    return;
  }

  if (!response.ok) {
    log(`warning: HEAD ${url} returned ${response.status} — the domain may not be live yet`);
    return;
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength !== expectedSize) {
    log(`warning: HEAD ${url} content-length ${contentLength} does not match the uploaded file size ${expectedSize}`);
    return;
  }

  log(`verified ${url} — content-length matches (${contentLength} bytes)`);
}

async function main() {
  const { publish, bucket } = parseReleaseArgs(process.argv.slice(2));

  runDesktopBuild();

  const version = readDesktopVersion();
  const versionedDmgName = `Video-Maker-${version}-arm64.dmg`;
  const stableDmgName = 'Video-Maker-arm64.dmg';
  const versionedDmgPath = join(DIST_DESKTOP_DIR, versionedDmgName);
  const stableDmgPath = join(DIST_DESKTOP_DIR, stableDmgName);

  if (!existsSync(versionedDmgPath)) {
    throw new Error(`expected the build to produce ${versionedDmgPath}, but it is missing`);
  }

  log(`copying ${versionedDmgName} to the stable download name ${stableDmgName}`);
  copyFileSync(versionedDmgPath, stableDmgPath);

  const versionedSha256 = sha256File(versionedDmgPath);
  const stableSha256 = sha256File(stableDmgPath);
  writeFileSync(`${versionedDmgPath}.sha256`, formatSha256Line(versionedSha256, versionedDmgName));
  writeFileSync(`${stableDmgPath}.sha256`, formatSha256Line(stableSha256, stableDmgName));
  log(`sha256 ${versionedDmgName}: ${versionedSha256}`);
  log(`sha256 ${stableDmgName}: ${stableSha256}`);

  const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
  const { title, body } = extractChangelogSection(changelog, version);
  const notesFilePath = join(DIST_DESKTOP_DIR, 'release-notes.md');
  writeFileSync(notesFilePath, `${body}\n`);
  log(`release notes for "${title}" written to ${notesFilePath}`);

  const uploads = [
    { key: versionedDmgName, filePath: versionedDmgPath },
    { key: stableDmgName, filePath: stableDmgPath },
  ];

  for (const upload of uploads) {
    const args = buildWranglerR2PutArgs({ bucket, key: upload.key, filePath: upload.filePath });
    log(`this is the command that would upload ${upload.key}:\n  ${formatPnpmCommand(args)}`);
  }

  if (!publish) {
    log('dry-run: nothing was uploaded. Pass --publish to actually upload to R2.');
    return;
  }

  log('--publish given: checking the local wrangler session');
  ensureWranglerLoggedIn();

  for (const upload of uploads) {
    const args = buildWranglerR2PutArgs({ bucket, key: upload.key, filePath: upload.filePath });
    log(`uploading ${upload.key}...`);
    execFileSync('pnpm', args, { cwd: REPO_ROOT, stdio: 'inherit' });
  }
  log('uploaded.');

  for (const upload of uploads) {
    await verifyDownload(upload);
  }
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`\nrelease-desktop failed: ${error.message}\n`);
    process.exit(1);
  });
}
