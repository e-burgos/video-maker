import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DISTRIBUTION_REPO } from '../src/site-config.mjs';

const DOCS_SITE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DOCS_SITE_ROOT, '..', '..');
const BUILT_SITE_DIR = join(REPO_ROOT, 'dist', 'apps', 'docs-site');
const WORKFLOW_SOURCE_PATH = join(DOCS_SITE_ROOT, 'deploy', 'pages-workflow.yml');

export const SITE_SUBDIR_IN_PUBLIC_REPO = 'site';
export const WORKFLOW_DEST_PATH = '.github/workflows/pages-workflow.yml';
export const COMMIT_MESSAGE = 'chore(docs): publish the Video Maker docs site';

export function log(message) {
  process.stdout.write(`[publish-docs] ${message}\n`);
}

export function parsePublishArgs(argv, defaultRepo = DISTRIBUTION_REPO) {
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

export function describePlan(repo) {
  return [
    `clone https://github.com/${repo}.git into a temporary directory`,
    `replace its "${SITE_SUBDIR_IN_PUBLIC_REPO}/" folder with the prebuilt site at dist/apps/docs-site`,
    `copy apps/docs-site/deploy/pages-workflow.yml to "${WORKFLOW_DEST_PATH}"`,
    `git add -A && git commit -m "${COMMIT_MESSAGE}" (skipped if nothing changed)`,
    'git push origin HEAD',
  ];
}

function repoExistsOnGitHub(repo) {
  try {
    execFileSync('gh', ['repo', 'view', repo], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function publishForReal(repo) {
  if (!existsSync(BUILT_SITE_DIR)) {
    throw new Error(`${BUILT_SITE_DIR} does not exist — run "pnpm nx run docs-site:build" first`);
  }
  if (!repoExistsOnGitHub(repo)) {
    throw new Error(`refusing to publish: repo "${repo}" does not exist or is not reachable with the local gh auth`);
  }

  const workDir = mkdtempSync(join(tmpdir(), 'video-maker-docs-publish-'));
  const cloneDir = join(workDir, 'repo');

  log(`cloning ${repo} into ${cloneDir}`);
  execFileSync('gh', ['repo', 'clone', repo, cloneDir], { stdio: 'inherit' });

  const siteDestDir = join(cloneDir, SITE_SUBDIR_IN_PUBLIC_REPO);
  rmSync(siteDestDir, { recursive: true, force: true });
  cpSync(BUILT_SITE_DIR, siteDestDir, { recursive: true });
  log(`copied the built site into ${siteDestDir}`);

  const workflowDestDir = join(cloneDir, '.github', 'workflows');
  mkdirSync(workflowDestDir, { recursive: true });
  cpSync(WORKFLOW_SOURCE_PATH, join(cloneDir, WORKFLOW_DEST_PATH));
  log(`copied the Pages workflow into ${join(cloneDir, WORKFLOW_DEST_PATH)}`);

  execFileSync('git', ['add', '-A'], { cwd: cloneDir, stdio: 'inherit' });
  const hasChanges = execFileSync('git', ['status', '--porcelain'], { cwd: cloneDir, encoding: 'utf8' }).trim() !== '';
  if (!hasChanges) {
    log('nothing changed, nothing to commit or push');
    return;
  }

  execFileSync('git', ['commit', '-m', COMMIT_MESSAGE], { cwd: cloneDir, stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', 'HEAD'], { cwd: cloneDir, stdio: 'inherit' });
  log('published.');
}

function main() {
  const { publish, repo } = parsePublishArgs(process.argv.slice(2));
  const plan = describePlan(repo);

  log('this is what would happen:');
  plan.forEach((step, index) => log(`  ${index + 1}. ${step}`));

  if (!publish) {
    log('dry-run: nothing was cloned, copied or pushed. Pass --publish to actually do it.');
    return;
  }

  publishForReal(repo);
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\npublish-docs failed: ${error.message}\n`);
    process.exit(1);
  }
}
