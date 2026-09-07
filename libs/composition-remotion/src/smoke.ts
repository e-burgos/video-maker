import { buildExampleTimeline } from './__fixtures__/example-timeline';
import { DEFAULT_RENDER_CONCURRENCY, renderTimeline } from './render';

async function main(): Promise<void> {
  const timeline = buildExampleTimeline('reels-9x16');

  const result = await renderTimeline(timeline, {
    outPath: 'out/example-9x16.mp4',
    concurrency: DEFAULT_RENDER_CONCURRENCY,
  });

  console.log(result);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
