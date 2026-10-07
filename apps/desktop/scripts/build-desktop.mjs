import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DESKTOP_ROOT = join(REPO_ROOT, 'apps', 'desktop');
const STAGING_ROOT = join(REPO_ROOT, 'dist', 'desktop-staging');
const APP_STAGING_DIR = join(STAGING_ROOT, 'app');
const RENDER_API_DEPS_DIR = join(STAGING_ROOT, 'render-api-deps');
const RENDER_API_RESOURCE_DIR = join(STAGING_ROOT, 'render-api');
const MCP_RESOURCE_DIR = join(STAGING_ROOT, 'mcp');
const ELECTRON_VERSION = '44.4.5';

const RENDER_API_RUNTIME_DEPS = {
  'better-sqlite3': '13.0.3',
  '@remotion/bundler': '4.0.522',
  '@remotion/cli': '4.0.522',
  '@remotion/player': '4.0.522',
  '@remotion/renderer': '4.0.522',
  '@remotion/transitions': '4.0.522',
  remotion: '4.0.522',
  hyperframes: '0.8.139',
};

function log(message) {
  process.stdout.write(`[build-desktop] ${message}\n`);
}

function run(command, args, options = {}) {
  log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit', ...options });
}

function nx(target) {
  run('pnpm', ['exec', 'nx', 'run', target]);
}

function dirSizeBytes(path) {
  const result = execFileSync('du', ['-sk', path], { encoding: 'utf8' });
  const kilobytes = Number(result.trim().split(/\s+/)[0]);
  return kilobytes * 1024;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderApiDepsHash() {
  return createHash('sha256').update(JSON.stringify(RENDER_API_RUNTIME_DEPS)).update(ELECTRON_VERSION).digest('hex');
}

function renderApiDepsUpToDate() {
  const marker = join(RENDER_API_DEPS_DIR, '.deps-hash');
  if (!existsSync(marker)) return false;
  if (readFileSync(marker, 'utf8').trim() !== renderApiDepsHash()) return false;
  const binding = join(RENDER_API_DEPS_DIR, 'node_modules', 'better-sqlite3', 'prebuilds', 'darwin-arm64.node');
  return existsSync(binding);
}

function buildRenderApiDeps() {
  if (renderApiDepsUpToDate()) {
    log('render-api runtime deps already staged and rebuilt for Electron, skipping');
    return;
  }

  log('staging render-api runtime deps (better-sqlite3, @remotion/*, remotion, hyperframes)');
  rmSync(RENDER_API_DEPS_DIR, { recursive: true, force: true });
  mkdirSync(RENDER_API_DEPS_DIR, { recursive: true });

  writeFileSync(
    join(RENDER_API_DEPS_DIR, 'package.json'),
    `${JSON.stringify({ name: 'render-api-deps', private: true, version: '0.0.0', dependencies: RENDER_API_RUNTIME_DEPS }, null, 2)}\n`,
  );
  writeFileSync(
    join(RENDER_API_DEPS_DIR, '.npmrc'),
    'node-linker=hoisted\nonlyBuiltDependencies[]=better-sqlite3\n',
  );

  run('pnpm', ['install', '--prod', '--no-lockfile', '--ignore-workspace'], { cwd: RENDER_API_DEPS_DIR });

  const electronRebuildBin = join(REPO_ROOT, 'node_modules', '.bin', 'electron-rebuild');
  run(electronRebuildBin, [
    '--force',
    '--version',
    ELECTRON_VERSION,
    '--module-dir',
    RENDER_API_DEPS_DIR,
    '--which-module',
    'better-sqlite3',
  ]);

  writeFileSync(join(RENDER_API_DEPS_DIR, '.deps-hash'), renderApiDepsHash());
}

function stageAppDir() {
  log('staging apps/desktop app directory');
  rmSync(APP_STAGING_DIR, { recursive: true, force: true });
  mkdirSync(APP_STAGING_DIR, { recursive: true });
  cpSync(join(REPO_ROOT, 'dist', 'out-tsc', 'apps', 'desktop', 'src'), APP_STAGING_DIR, { recursive: true });

  const sourcePackageJson = JSON.parse(readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf8'));
  writeFileSync(
    join(APP_STAGING_DIR, 'package.json'),
    `${JSON.stringify(
      {
        name: sourcePackageJson.name,
        productName: sourcePackageJson.productName,
        private: true,
        version: sourcePackageJson.version,
        main: 'main/main.js',
      },
      null,
      2,
    )}\n`,
  );
}

function stageRenderApiResource() {
  log('staging render-api resource (bundle + runtime deps)');
  rmSync(RENDER_API_RESOURCE_DIR, { recursive: true, force: true });
  mkdirSync(RENDER_API_RESOURCE_DIR, { recursive: true });
  cpSync(
    join(REPO_ROOT, 'dist', 'apps', 'render-api', 'main.js'),
    join(RENDER_API_RESOURCE_DIR, 'main.js'),
  );
  cpSync(join(RENDER_API_DEPS_DIR, 'node_modules'), join(RENDER_API_RESOURCE_DIR, 'node_modules'), {
    recursive: true,
    dereference: true,
  });
}

function stageMcpResource() {
  log('staging MCP resource');
  rmSync(MCP_RESOURCE_DIR, { recursive: true, force: true });
  mkdirSync(MCP_RESOURCE_DIR, { recursive: true });
  cpSync(join(REPO_ROOT, 'dist', 'libs', 'producer-tools', 'mcp', 'main.js'), join(MCP_RESOURCE_DIR, 'main.js'));
}

function report(dmgPath, elapsedMs) {
  const appPath = join(REPO_ROOT, 'dist', 'desktop', 'mac-arm64', 'Video Maker.app');
  const appSize = existsSync(appPath) ? dirSizeBytes(appPath) : null;
  const dmgSize = existsSync(dmgPath) ? statSync(dmgPath).size : null;

  log('--- build report ---');
  log(`.app size: ${appSize === null ? 'n/a' : formatBytes(appSize)}`);
  log(`.dmg size: ${dmgSize === null ? 'n/a' : formatBytes(dmgSize)}`);
  log(`build time: ${(elapsedMs / 1000).toFixed(1)}s`);
  log(`dmg: ${dmgPath}`);
}

async function main() {
  const startedAt = Date.now();

  run('node', [join(DESKTOP_ROOT, 'scripts', 'vendor-binaries.mjs')]);
  nx('web:build');
  nx('render-api:bundle');
  nx('producer-tools:bundle');
  nx('composition-remotion:bundle');
  nx('desktop:build');

  buildRenderApiDeps();
  stageAppDir();
  stageRenderApiResource();
  stageMcpResource();

  run('pnpm', ['exec', 'electron-builder', '--config', join(DESKTOP_ROOT, 'electron-builder.yml'), '--mac', 'dmg', '--arm64']);

  const packageJson = JSON.parse(readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf8'));
  const dmgPath = join(REPO_ROOT, 'dist', 'desktop', `Video-Maker-${packageJson.version}-arm64.dmg`);
  report(dmgPath, Date.now() - startedAt);
}

main().catch((error) => {
  process.stderr.write(`\nbuild-desktop failed: ${error.message}\n`);
  process.exit(1);
});
