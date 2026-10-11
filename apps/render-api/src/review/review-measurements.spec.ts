import { describe, expect, it } from 'vitest';

import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createFfmpegReviewMeasurements } from './review-measurements';

const BINARIES = { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' };

const FFPROBE_FULL_JSON = JSON.stringify({
  streams: [{ index: 0, codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1', duration: '10.000000', pix_fmt: 'yuv420p' }],
  format: { duration: '10.100000' },
});

describe('createFfmpegReviewMeasurements.probeDurationSec', () => {
  it('uses the video stream duration so audio padding does not count', async () => {
    const runner = createFakeCommandRunner([{ bin: 'ffprobe', response: { stdout: '84.333333\n', exitCode: 0 } }]);

    const seconds = await createFfmpegReviewMeasurements(runner, BINARIES).probeDurationSec('/v.mp4');

    expect(seconds).toBeCloseTo(84.333333, 5);
  });

  it('falls back to the container probe when the stream reports no duration', async () => {
    const runner = createFakeCommandRunner([
      {
        bin: 'ffprobe',
        response: (call) =>
          call.args.includes('-select_streams') ? { stdout: 'N/A\n', exitCode: 0 } : { stdout: FFPROBE_FULL_JSON, exitCode: 0 },
      },
    ]);

    const seconds = await createFfmpegReviewMeasurements(runner, BINARIES).probeDurationSec('/v.mp4');

    expect(seconds).toBeCloseTo(10.1, 5);
  });
});
