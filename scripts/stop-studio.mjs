import { execSync } from 'node:child_process';

const patterns = ['render-api/src/server-register.cjs apps/render-api/src/main.ts', 'vite --config apps/web/vite.config.ts'];
for (const pattern of patterns) {
  try {
    execSync(`pkill -f "${pattern}"`, { stdio: 'ignore' });
    process.stdout.write(`[studio] stopped: ${pattern}\n`);
  } catch {
    process.stdout.write(`[studio] not running: ${pattern}\n`);
  }
}
