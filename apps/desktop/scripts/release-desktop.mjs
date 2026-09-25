import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DESKTOP_ROOT = join(REPO_ROOT, 'apps', 'desktop');
const DIST_DESKTOP_DIR = join(REPO_ROOT, 'dist', 'desktop');
const BUILD_DESKTOP_SCRIPT = join(DESKTOP_ROOT, 'scripts', 'build-desktop.mjs');
const CHANGELOG_PATH = join(DESKTOP_ROOT, 'CHANGELOG.md');

export const DEFAULT_RELEASE_REPO = 'e-burgos/video-maker-app';

export function log(message) {
  process.stdout.write(`[release-desktop] ${message}\n`);
}

export function parseReleaseArgs(argv, defaultRepo = DEFAULT_RELEASE_REPO) {
  let repo = defaultRepo;
  let publish = false;

  for (const arg of argv) {
    if (arg === '--publish') {
      publish = true;
      continue;
    }
    const repoMatch = /^--repo=(.+)$/.exec(arg);
    if (repoMatch !== null) {
      repo = repoMatch[1];
      continue;
    }
    throw new Error(`unrecognized argument: ${arg}`);
  }

  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error(`--repo must look like "owner/name", got: ${repo}`);
  }

  return { publish, repo };
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

export function buildGhReleaseCreateArgs({ version, repo, title, notesFilePath, assetPaths }) {
  return [
    'release',
    'create',
    `v${version}`,
    ...assetPaths,
    '--repo',
    repo,
    '--title',
    title,
    '--notes-file',
    notesFilePath,
  ];
}

export function formatGhCommand(args) {
  return `gh ${args.map((part) => (/[\s"]/.test(part) ? JSON.stringify(part) : part)).join(' ')}`;
}

function readDesktopVersion() {
  const packageJson = JSON.parse(readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf8'));
  return packageJson.version;
}

function runDesktopBuild() {
  log('building the .dmg (reusing build-desktop.mjs)');
  execFileSync('node', [BUILD_DESKTOP_SCRIPT], { cwd: REPO_ROOT, stdio: 'inherit' });
}

function repoExistsOnGitHub(repo) {
  try {
    execFileSync('gh', ['repo', 'view', repo], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function releaseTagExists(repo, tag) {
  try {
    execFileSync('gh', ['release', 'view', tag, '--repo', repo], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { publish, repo } = parseReleaseArgs(process.argv.slice(2));

  runDesktopBuild();

  const version = readDesktopVersion();
  const tag = `v${version}`;
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

  const ghArgs = buildGhReleaseCreateArgs({
    version,
    repo,
    title: `Video Maker ${version}`,
    notesFilePath,
    assetPaths: [versionedDmgPath, stableDmgPath],
  });
  log(`this is the command that would publish the release:\n  ${formatGhCommand(ghArgs)}`);

  if (!publish) {
    log('dry-run: nothing was published. Pass --publish to actually create the GitHub release.');
    return;
  }

  log(`--publish given: checking that ${repo} exists and ${tag} is not taken yet`);
  if (!repoExistsOnGitHub(repo)) {
    throw new Error(`refusing to publish: repo "${repo}" does not exist or is not reachable with the local gh auth`);
  }
  if (releaseTagExists(repo, tag)) {
    throw new Error(`refusing to publish: release "${tag}" already exists on ${repo}`);
  }

  log('publishing the release with gh...');
  execFileSync('gh', ghArgs, { cwd: REPO_ROOT, stdio: 'inherit' });
  log('published.');
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`\nrelease-desktop failed: ${error.message}\n`);
    process.exit(1);
  });
}
