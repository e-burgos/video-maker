import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
  assert,
  audioEnvelope,
  bestOffsetMs,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  memoryGate,
  probeStream,
  spawnLogged,
  waitForHttp,
} from './smoke-helpers.mjs';

const RENDER_API_PORT = 4420;
const SLUG = 'timed-narration-smoke';
const SOURCE_PROJECT = join(REPO_ROOT, 'media/display-ads');
const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-009-voice-over/fixes/artifacts',
);
const SUBTITLE_ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-003-kinetic-captions/fixes/artifacts',
);
const SUBTITLE_FRAME_SECONDS = [10, 22];

const TIMED_SCRIPT = [
  '[0:00] Entramos a la plataforma con nuestro usuario.',
  '[0:20] Las campañas viven acá. Esta línea de tiempo muestra qué corre en cada pantalla y avisa si dos campañas se pisan.',
  '[0:28] Creamos una nueva. Son cinco pasos y podés moverte libre entre ellos.',
  '[0:32] Primero el nombre y desde cuándo corre. Si dejamos la fecha de fin vacía, la campaña no vence por calendario.',
  '[0:40] Después, qué días corre y en qué horario.',
  '[0:50] El efecto entre un anuncio y el siguiente.',
  '[0:56] Acá armamos la playlist. La plataforma separa horizontal y vertical, así la misma campaña se ve bien en una pantalla parada y en una acostada.',
  '[1:14] Antes de largarla, la vemos como se va a ver en la pantalla.',
  '[1:22] Y listo.',
  '[1:30-1:37] La campaña nace en borrador, así la revisás antes de ponerla al aire.',
  '',
].join('\n');

const EXPECTED_STARTS_MS = [0, 20_000, 28_000, 32_000, 40_000, 50_000, 56_000, 74_000, 82_000, 90_000];
const EXPECTED_TIMELINE_FRAMES = 2895;
const FRAME_SECONDS = [10, 22, 45, 92];

const apiUrl = `http://127.0.0.1:${RENDER_API_PORT}`;

function ffmpeg(args) {
  return execFileSync(process.env.FFMPEG_PATH ?? 'ffmpeg', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function ffmpegStderr(args) {
  const result = spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 32,
  });
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

async function seedProject(mediaRoot) {
  const projectRoot = join(mediaRoot, SLUG);
  await mkdir(join(projectRoot, 'work/producer'), { recursive: true });
  await cp(join(SOURCE_PROJECT, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await cp(
    join(SOURCE_PROJECT, 'work/producer/conversation.json'),
    join(projectRoot, 'work/producer/conversation.json'),
  );
  await writeFile(join(projectRoot, 'work/producer/script-timed.txt'), TIMED_SCRIPT, 'utf8');
  return projectRoot;
}

async function postJob(body) {
  const response = await fetch(`${apiUrl}/projects/${SLUG}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const job = await response.json();
  assert(
    response.status === 202,
    `${body.kind} job accepted (got ${response.status} ${JSON.stringify(job.error ?? {})})`,
  );
  return job;
}

async function awaitJob(jobId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await fetch(`${apiUrl}/jobs/${jobId}`);
    last = await response.json();
    if (last.state === 'succeeded' || last.state === 'failed' || last.state === 'canceled') {
      assert(
        last.state === 'succeeded',
        `job ${jobId} succeeded (state ${last.state}, error ${JSON.stringify(last.error ?? {})})`,
      );
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`job ${jobId} did not settle: ${JSON.stringify(last)}`);
}

function silenceWindows(wavPath) {
  const report = ffmpegStderr([
    '-hide_banner',
    '-nostats',
    '-i',
    wavPath,
    '-af',
    'silencedetect=noise=-45dB:d=0.6',
    '-f',
    'null',
    '-',
  ]);

  const windows = [];
  let start = null;
  for (const line of report.split('\n')) {
    const startMatch = /silence_start:\s*([\d.]+)/.exec(line);
    const endMatch = /silence_end:\s*([\d.]+)/.exec(line);
    if (startMatch !== null) {
      start = Number(startMatch[1]);
    }
    if (endMatch !== null && start !== null) {
      windows.push([start, Number(endMatch[1])]);
      start = null;
    }
  }
  if (start !== null) {
    windows.push([start, Number.POSITIVE_INFINITY]);
  }
  return windows;
}

function isSilentAt(windows, seconds) {
  return windows.some(([from, to]) => seconds >= from && seconds <= to);
}

async function main() {
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);
  await memoryGate();

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'timed-narration-media-'));
  const projectRoot = await seedProject(tempMediaRoot);
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await mkdir(SUBTITLE_ARTIFACTS_DIR, { recursive: true });
  log('1', `temp media root: ${tempMediaRoot} (raw/ + work/producer/ of media/display-ads)`);

  const renderApi = spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: tempMediaRoot,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
    },
  );
  log('2', `render-api pid: ${renderApi.pid} on ${RENDER_API_PORT}`);

  try {
    await waitForHttp(`${apiUrl}/health`, 30_000);

    log('3', 'cheap gate: this build rejects an unknown captionStyle');
    const styleProbe = await fetch(`${apiUrl}/projects/${SLUG}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'montage', captionStyle: 'neon' }),
    });
    const styleProbeBody = await styleProbe.json();
    assert(
      styleProbe.status === 422 && styleProbeBody.error?.code === 'MONTAGE_CAPTION_STYLE_INVALID',
      `the build under test knows captionStyle (got ${styleProbe.status} ${styleProbeBody.error?.code})`,
    );

    log('4', 'voice job with the 10 timed lines of the user scene table');
    const voiceJob = await postJob({
      kind: 'voice',
      scriptPath: 'work/producer/script-timed.txt',
      overwrite: true,
    });
    const voiceReport = (await awaitJob(voiceJob.id, 900_000)).report;

    const manifest = JSON.parse(
      await readFile(join(projectRoot, 'work/voice/script-manifest.json'), 'utf8'),
    );
    const starts = manifest.lines.map((line) => line.startMs);
    const requested = manifest.lines.map((line) => line.requestedStartMs);
    const overflows = manifest.lines.map((line) => line.overflowMs);
    log('4', `startMs: ${JSON.stringify(starts)}`);
    log('4', `requestedStartMs: ${JSON.stringify(requested)}`);
    log('4', `overflowMs: ${JSON.stringify(overflows)}`);
    log('4', `lengthScale: ${JSON.stringify(manifest.lines.map((line) => line.lengthScale ?? 1))}`);

    assert(
      JSON.stringify(requested) === JSON.stringify(EXPECTED_STARTS_MS),
      'the manifest kept the ten marks of the scene table as requestedStartMs',
    );
    starts.forEach((startMs, index) => {
      const requestedMs = EXPECTED_STARTS_MS[index];
      const displacedMs = startMs - requestedMs;
      assert(
        displacedMs >= 0 && (displacedMs === 0 || overflows[index - 1] > 0),
        `line ${index + 1} starts at its mark (${requestedMs} ms) or was displaced by a reported overflow (start ${startMs} ms, previous overflow ${overflows[index - 1] ?? 0} ms)`,
      );
    });
    assert(
      manifest.lines.every((line) => line.endMs === line.startMs + line.durationMs),
      'every line reports endMs',
    );

    const voiceWav = join(projectRoot, 'work/voice/voice.wav');
    const voiceStream = probeStream(voiceWav, 'a:0', 'sample_rate,channels,duration');
    log('4', `voice.wav: ${JSON.stringify(voiceStream)} (report ${voiceReport.track.durationMs} ms)`);
    assert(voiceStream.sample_rate === '48000', 'voice.wav is 48 kHz');
    assert(voiceStream.channels === 1, 'voice.wav is mono');
    assert(
      Math.abs(Number(voiceStream.duration) - 97) <= 0.5,
      `voice.wav covers the window the script declared, up to 1:37 (measured ${voiceStream.duration} s)`,
    );

    const windows = silenceWindows(voiceWav);
    log('4', `silence windows: ${JSON.stringify(windows)}`);
    assert(
      windows.some(([from, to]) => from <= 8 && to >= 20),
      'voice.wav is silent for the whole 8 s to 20 s band, where scene 1 has nothing left to say',
    );
    assert(
      !isSilentAt(windows, 22),
      'voice.wav is speaking at 22 s: the campaigns sentence lands on its scene',
    );

    log('5', 'montage job: voice script, youtube-16x9, educational');
    const montageJob = await postJob({
      kind: 'montage',
      preset: 'educational',
      voice: 'script',
      format: 'youtube-16x9',
      scriptPath: 'work/producer/script-timed.txt',
      overwrite: true,
    });
    const montageReport = (await awaitJob(montageJob.id, 900_000)).report;
    log('5', `montage report: ${JSON.stringify({ captionStyle: montageReport.captionStyle, voiceTrack: montageReport.voiceTrack })}`);

    const timeline = JSON.parse(await readFile(join(projectRoot, 'work/timeline.json'), 'utf8'));
    const captions = timeline.tracks.captions;
    const wordCounts = captions.map((caption) => caption.words.length);
    log('5', `durationFrames: ${timeline.durationFrames}, captions: ${captions.length}`);
    log('5', `caption word counts: ${JSON.stringify(wordCounts)}`);

    assert(
      timeline.durationFrames === EXPECTED_TIMELINE_FRAMES,
      `the timeline lasts the whole A-roll: ${EXPECTED_TIMELINE_FRAMES} frames (got ${timeline.durationFrames})`,
    );
    assert(timeline.captionStyle === 'subtle-lower', 'educational defaults to subtle-lower');
    assert(montageReport.voiceTrack.truncatedMs === 0, 'a timed script truncates nothing');

    const fps = timeline.format.fps;
    const captionText = (caption) => caption.words.map((word) => word.text).join(' ');
    const first = captions[0];
    log('5', `first caption at ${(first.from / fps).toFixed(2)} s: "${captionText(first)}"`);
    assert(first.from / fps < 1.5, 'the first caption starts at about 0 s');
    assert(
      /entramos/i.test(captionText(first)),
      `the first caption carries the opening sentence (got "${captionText(first)}")`,
    );

    const campaigns = captions.find((caption) => /campañas/i.test(captionText(caption)));
    assert(campaigns !== undefined, 'there is a caption for the campaigns sentence');
    const campaignsSeconds = campaigns.from / fps;
    log('5', `campaigns caption at ${campaignsSeconds.toFixed(2)} s: "${captionText(campaigns)}"`);
    assert(
      campaignsSeconds >= 19 && campaignsSeconds <= 24,
      `the campaigns caption lands on its scene, around 20 s (got ${campaignsSeconds.toFixed(2)} s)`,
    );

    const longest = Math.max(...wordCounts);
    assert(longest >= 6 && longest <= 10, `captions group up to 6-10 words (longest ${longest})`);

    log('6', 'render job');
    await memoryGate();
    const renderJob = await postJob({ kind: 'render' });
    const renderReport = (await awaitJob(renderJob.id, 1_800_000)).report;
    const outPath = join(projectRoot, renderReport.deliverable.resource);
    log('6', `render: ${JSON.stringify(renderReport.deliverable)}`);

    const videoStream = probeStream(outPath, 'v:0', 'width,height,nb_frames,r_frame_rate');
    log('6', `mp4 video stream: ${JSON.stringify(videoStream)}`);
    assert(videoStream.width === 1920 && videoStream.height === 1080, 'the MP4 is 1920x1080');
    assert(
      Number(videoStream.nb_frames) === EXPECTED_TIMELINE_FRAMES,
      `the MP4 has ${EXPECTED_TIMELINE_FRAMES} frames (got ${videoStream.nb_frames})`,
    );

    for (const seconds of FRAME_SECONDS) {
      const framePath = join(ARTIFACTS_DIR, `timed-narration-t${String(seconds).padStart(3, '0')}.jpg`);
      ffmpeg(['-y', '-v', 'error', '-ss', String(seconds), '-i', outPath, '-frames:v', '1', framePath]);
      log('6', `frame at ${seconds} s: ${framePath}`);
    }

    for (const seconds of SUBTITLE_FRAME_SECONDS) {
      const framePath = join(
        SUBTITLE_ARTIFACTS_DIR,
        `subtle-lower-t${String(seconds).padStart(3, '0')}.png`,
      );
      ffmpeg(['-y', '-v', 'error', '-ss', String(seconds), '-i', outPath, '-frames:v', '1', framePath]);
      log('6', `subtitle frame at ${seconds} s: ${framePath}`);
    }

    log('6', `logo of the rendered timeline: ${JSON.stringify(timeline.logo)}`);
    assert(
      timeline.logo === undefined || timeline.logo.widthRatio === 0.18,
      `a 16:9 montage sizes the logo at 0.18 of the width (got ${timeline.logo?.widthRatio})`,
    );

    log('7', 'audio sync: envelope correlation of the MP4 against voice.wav');
    const reference = audioEnvelope(voiceWav, 0, 96);
    const rendered = audioEnvelope(outPath, 0, 96);
    const { offsetMs, score } = bestOffsetMs(reference, rendered, 50);
    log('7', `best offset: ${offsetMs} ms (correlation ${score.toFixed(4)})`);
    assert(offsetMs === 0, `the rendered audio is in sync with voice.wav at 0 ms (got ${offsetMs} ms)`);
    assert(score > 0.9, `the envelopes match (correlation ${score.toFixed(4)})`);

    log('done', 'every acceptance criterion of FIX-e-burgos-009-002 and FIX-e-burgos-003-003 held');
  } finally {
    log('cleanup', `stopping render-api pid ${renderApi.pid}`);
    renderApi.kill('SIGTERM');
  }
}

main().catch((error) => {
  log('failed', error.stack ?? String(error));
  process.exitCode = 1;
});
