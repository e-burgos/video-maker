import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TimelineSchema } from '@video-maker/timeline-core';

async function main(): Promise<void> {
  const projectRoot = process.argv[2];
  const outPath = process.argv[3];
  if (projectRoot === undefined || outPath === undefined) {
    throw new Error('usage: render-muted.ts <project-root> <out-path>');
  }

  const timeline = TimelineSchema.parse(
    JSON.parse(readFileSync(resolve(projectRoot, 'work/timeline.json'), 'utf8')),
  );

  const { renderTimeline } = await import('@video-maker/composition-remotion/render');
  const result = await renderTimeline(timeline, {
    outPath: resolve(outPath),
    publicDir: resolve(projectRoot),
    audio: 'muted',
  });

  const sha256 = createHash('sha256').update(readFileSync(result.outPath)).digest('hex');
  console.log(JSON.stringify({ outPath: result.outPath, sha256, ...result }));
}

void main();
