const { execFileSync } = require('node:child_process');
const { cpSync, existsSync, rmSync } = require('node:fs');
const { join } = require('node:path');

module.exports = async function afterPack(context) {
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const resourcesDir = join(appPath, 'Contents', 'Resources');
  const stagingNodeModules = join(context.packager.projectDir, 'dist', 'desktop-staging', 'render-api', 'node_modules');
  const destination = join(resourcesDir, 'render-api', 'node_modules');

  if (!existsSync(stagingNodeModules)) {
    throw new Error(`afterPack: staged render-api node_modules not found at ${stagingNodeModules}`);
  }

  rmSync(destination, { recursive: true, force: true });
  cpSync(stagingNodeModules, destination, { recursive: true, dereference: true });

  execFileSync('/usr/bin/codesign', ['--deep', '--force', '--sign', '-', appPath], { stdio: 'inherit' });
};
