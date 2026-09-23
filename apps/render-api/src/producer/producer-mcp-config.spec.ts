import { describe, expect, it } from 'vitest';

import { buildStudioMcpLaunchCommand } from '@video-maker/producer-tools';

import { buildProducerMcpConfigJson } from './producer-mcp-config';

const INPUT = {
  repoRoot: '/repo',
  apiUrl: 'http://127.0.0.1:4399',
  project: 'pitch-deck',
  model: 'sonnet',
};

describe('buildProducerMcpConfigJson', () => {
  it('serializa un único server "studio" con el comando, args y env del lanzamiento de la lib', () => {
    const launch = buildStudioMcpLaunchCommand(INPUT);

    expect(JSON.parse(buildProducerMcpConfigJson(INPUT))).toEqual({
      mcpServers: {
        studio: {
          command: launch.command,
          args: launch.args,
          env: launch.env,
        },
      },
    });
  });

  it('nunca incluye el cwd del lanzamiento: --mcp-config no lo conoce', () => {
    const parsed = JSON.parse(buildProducerMcpConfigJson(INPUT)) as {
      mcpServers: { studio: Record<string, unknown> };
    };

    expect(parsed.mcpServers.studio.cwd).toBeUndefined();
  });

  it('no lleva secretos: sólo la URL de la API, el slug del proyecto y el modelo', () => {
    const json = buildProducerMcpConfigJson(INPUT);

    expect(json).toContain('pitch-deck');
    expect(json).toContain('http://127.0.0.1:4399');
    expect(json).not.toMatch(/token|apikey|password/iu);
  });
});
