import { FixtureCommandRunner } from '@video-maker/media-local';
import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import { runCli } from '../cli';
import { classifyWhiteSegments, MAX_FLASH_SECONDS } from './flash-scan-command';

const ROOT = '/media/demo';
const STDERR = [
  '[blackdetect @ 0x1] black_start:0 black_end:2',
  '[blackdetect @ 0x1] black_start:12.1 black_end:12.2',
  '[blackdetect @ 0x1] black_start:46.2 black_end:68.5',
].join('\n');

describe('classifyWhiteSegments', () => {
  it('solo los saltos breves son destellos; los tramos claros sostenidos quedan aparte', () => {
    const result = classifyWhiteSegments([
      { startSec: 0, endSec: 2, durationSec: 2 },
      { startSec: 12.1, endSec: 12.2, durationSec: 0.1 },
      { startSec: 20, endSec: 20 + MAX_FLASH_SECONDS, durationSec: MAX_FLASH_SECONDS },
    ]);

    expect(result.flashes).toEqual([{ startSec: 12.1, endSec: 12.2, durationSec: 0.1 }]);
    expect(result.brightStretches.map((segment) => segment.startSec)).toEqual([0, 20]);
  });
});

describe('render-cli flash-scan', () => {
  function deps(withVideos: boolean) {
    const fileSystem = createFakeFileSystem(
      withVideos
        ? [
            { path: `${ROOT}/out/old.mp4`, contents: 'x', modifiedAtMs: 1 },
            { path: `${ROOT}/out/new.mp4`, contents: 'x', modifiedAtMs: 2 },
          ]
        : [],
      [`${ROOT}/out`],
    );
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: STDERR, exitCode: 0 } }]);
    return { runner, deps: createFakeCliDependencies({ fileSystem, runner }) };
  }

  it('escanea el mp4 más nuevo de out/ y separa destellos de tramos claros', async () => {
    const { deps: cliDeps, runner } = deps(true);
    const outcome = await runCli(['flash-scan', ROOT], (raw) => raw, cliDeps);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout[0]).toBe(`FLASHES [flash-scan] ${ROOT}/out/new.mp4`);
    expect(outcome.stdout).toContain('  flashes (< 0.5 s): 1');
    expect(outcome.stdout).toContain('  bright stretches (not flashes): 2');
    expect(runner.calls[0]?.args.join(' ')).toContain('negate,blackdetect=d=0:pix_th=0.1:picture_black_ratio_th=0.9');
  });

  it('sin videos renderizados falla con un input faltante', async () => {
    const outcome = await runCli(['flash-scan', ROOT], (raw) => raw, deps(false).deps);

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr.join('\n')).toMatch(/no-rendered-video/u);
  });
});
