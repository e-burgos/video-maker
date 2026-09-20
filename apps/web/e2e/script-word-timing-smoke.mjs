import { execFileSync } from 'node:child_process';
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

const RENDER_API_PORT = 4430;
const SLUG = 'script-word-timing-smoke';
const SOURCE_PROJECT = join(REPO_ROOT, 'media/display-ads');
const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-002-auto-montage-pipeline/fixes/artifacts',
);

const SPOKEN_SCRIPT = [
  'Entramos a la plataforma con nuestro usuario.',
  'Las campañas viven acá. Esta línea de tiempo muestra qué corre en cada pantalla y avisa si dos campañas se pisan.',
  'Creamos una nueva. Son cinco pasos y podés moverte libre entre ellos.',
  'Primero el nombre y desde cuándo corre. Si dejamos la fecha de fin vacía, la campaña no vence por calendario.',
  'Después, qué días corre y en qué horario.',
  'El efecto entre un anuncio y el siguiente.',
  'Acá armamos la playlist. La plataforma separa horizontal y vertical, así la misma campaña se ve bien en una pantalla parada y en una acostada.',
  'Antes de largarla, la vemos como se va a ver en la pantalla.',
  'Y listo.',
  'La campaña nace en borrador, así la revisás antes de ponerla al aire.',
  '',
].join('\n');

const MARKS = ['0:00', '0:20', '0:28', '0:32', '0:40', '0:50', '0:56', '1:14', '1:22', '1:30'];

const TIMED_SCRIPT = `${SPOKEN_SCRIPT.trim()
  .split('\n')
  .map((line, index) => `[${MARKS[index]}] ${line}`)
  .join('\n')}\n`;

const LINE_ONE_CEILING_MS = 2500;
const CAPTION_END_TOLERANCE_MS = 200;
const LINE_START_TOLERANCE_MS = 250;
const FRAME_SECONDS = [10, 22, 57];
const SILENT_FRAME_SECONDS = 10;

const apiUrl = `http://127.0.0.1:${RENDER_API_PORT}`;

function ffmpeg(args) {
  return execFileSync(process.env.FFMPEG_PATH ?? 'ffmpeg', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function seedProject(mediaRoot) {
  const projectRoot = join(mediaRoot, SLUG);
  await mkdir(join(projectRoot, 'work/producer'), { recursive: true });
  await cp(join(SOURCE_PROJECT, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await writeFile(join(projectRoot, 'work/producer/script.txt'), SPOKEN_SCRIPT, 'utf8');
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

async function readJson(projectRoot, relativePath) {
  return JSON.parse(await readFile(join(projectRoot, relativePath), 'utf8'));
}

function lineWindows(manifest) {
  return manifest.lines.map((line) => ({
    startMs: line.startMs,
    endMs: line.endMs ?? line.startMs + line.durationMs,
  }));
}

function captionsOf(edl) {
  return edl.decisions
    .filter((decision) => decision.type === 'caption-group')
    .map((decision) => ({
      startMs: decision.startMs,
      endMs: decision.endMs,
      text: decision.words.map((word) => word.text).join(' '),
      wordCount: decision.words.length,
    }));
}

function describeCaptions(captions, count) {
  return captions
    .slice(0, count)
    .map(
      (caption) =>
        `${(caption.startMs / 1000).toFixed(2)}s -> ${(caption.endMs / 1000).toFixed(2)}s [${caption.wordCount}w] ${caption.text}`,
    )
    .join('\n      ');
}

function assertCaptionsRespectLines(captions, windows, label) {
  for (const caption of captions) {
    const window = windows.find(
      (entry) => entry.startMs <= caption.startMs && caption.startMs < entry.endMs,
    );
    assert(
      window !== undefined,
      `${label}: the caption "${caption.text}" starts inside a sentence of the manifest, not in a silence (${(caption.startMs / 1000).toFixed(2)} s)`,
    );
    assert(
      caption.endMs <= (window?.endMs ?? 0) + CAPTION_END_TOLERANCE_MS,
      `${label}: the caption "${caption.text}" ends within its sentence (${caption.endMs} ms vs ${window?.endMs} ms)`,
    );
  }
}

async function planMontage(projectRoot, scriptPath, label) {
  const body = {
    kind: 'montage',
    preset: 'educational',
    voice: 'script',
    format: 'youtube-16x9',
    overwrite: true,
    ...(scriptPath === null ? {} : { scriptPath }),
  };
  await awaitJob((await postJob(body)).id, 900_000);
  const captions = captionsOf(await readJson(projectRoot, 'work/edl.json'));
  log('5', `${label}: ${captions.length} captions\n      ${describeCaptions(captions, 6)}`);
  return captions;
}

async function main() {
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);
  await memoryGate();

  const tempMediaRoot = await mkdtemp(join(tmpdir(), 'script-word-timing-media-'));
  const projectRoot = await seedProject(tempMediaRoot);
  await mkdir(ARTIFACTS_DIR, { recursive: true });
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

    log('3', 'voice job with the ten timed lines of the scene table');
    await awaitJob((await postJob({ kind: 'voice', scriptPath: 'work/producer/script-timed.txt', overwrite: true })).id, 900_000);

    const manifest = await readJson(projectRoot, 'work/voice/script-manifest.json');
    const windows = lineWindows(manifest);

    log('3', `wordsSource per line: ${JSON.stringify(manifest.lines.map((line) => line.wordsSource))}`);
    assert(
      manifest.lines.every((line) => line.wordsSource === 'whisper' || line.wordsSource === 'script'),
      'the build under test writes wordsSource on every line (FIX-e-burgos-009-004)',
    );

    log('4', 'word windows of voice.words.json against the manifest');
    const words = await readJson(projectRoot, 'work/voice/voice.words.json');
    log('4', `words: ${words.words.length}, segments: ${words.segments.length}`);

    for (const word of words.words) {
      const window = windows.find(
        (entry) => entry.startMs <= word.startMs && word.startMs < entry.endMs,
      );
      assert(
        window !== undefined && word.endMs <= window.endMs,
        `the word "${word.text}" stays inside the window of its line (${word.startMs}-${word.endMs} ms)`,
      );
    }

    const lineOneWords = words.words.filter((word) => word.startMs < windows[1].startMs);
    const lineOneEndMs = Math.max(...lineOneWords.map((word) => word.endMs));
    log('4', `line 1: ${lineOneWords.length} words, last one ends at ${lineOneEndMs} ms, window ends at ${windows[0].endMs} ms`);
    assert(
      lineOneEndMs <= windows[0].endMs && lineOneEndMs < LINE_ONE_CEILING_MS,
      `the last word of line 1 ends with the audio of line 1 and well under ${LINE_ONE_CEILING_MS} ms, not at the start of line 2 (got ${lineOneEndMs} ms, window ${windows[0].endMs} ms)`,
    );

    log('5', 'montage without --script and with --script');
    const withoutScript = await planMontage(projectRoot, null, 'without script');
    const withScript = await planMontage(projectRoot, 'work/producer/script.txt', 'with script');

    for (const [label, captions] of [
      ['without script', withoutScript],
      ['with script', withScript],
    ]) {
      assertCaptionsRespectLines(captions, windows, label);

      const first = captions[0];
      assert(
        first.startMs <= LINE_START_TOLERANCE_MS && first.endMs <= windows[0].endMs,
        `${label}: the first caption runs from about 0.0 s to the end of line 1 at most (got ${first.startMs}-${first.endMs} ms, window ${windows[0].endMs} ms)`,
      );
      assert(
        /entramos/i.test(first.text),
        `${label}: the first caption carries the opening sentence (got "${first.text}")`,
      );

      const campaigns = captions.find(
        (caption) => caption.startMs >= windows[1].startMs && caption.startMs < windows[1].endMs,
      );
      assert(
        campaigns !== undefined &&
          campaigns.startMs - windows[1].startMs <= LINE_START_TOLERANCE_MS &&
          /campañas/i.test(campaigns.text),
        `${label}: the campaigns caption starts at the mark of its line, ${windows[1].startMs} ms (got ${campaigns?.startMs} "${campaigns?.text}")`,
      );

      const counts = captions.map((caption) => caption.wordCount);
      assert(
        Math.max(...counts) <= 10,
        `${label}: no subtle-lower caption goes over 10 words (longest ${Math.max(...counts)})`,
      );
      assert(
        counts.filter((count) => count >= 6).length > captions.length / 2,
        `${label}: most captions group 6 words or more (${counts.filter((count) => count >= 6).length} of ${captions.length})`,
      );
    }

    assert(
      withoutScript.length === withScript.length,
      `aligning to the script keeps the same caption count (${withoutScript.length} vs ${withScript.length})`,
    );
    assert(
      withScript[0].text === SPOKEN_SCRIPT.split('\n')[0],
      `aligning to the script restores the punctuation of the first line (got "${withScript[0].text}")`,
    );
    assert(
      withScript
        .map((caption) => caption.text)
        .join(' ')
        .includes('Las campañas viven acá.'),
      'aligning to the script restores the words whisper misheard in the campaigns sentence',
    );

    log('6', 'render job');
    await memoryGate();
    const renderReport = (await awaitJob((await postJob({ kind: 'render' })).id, 1_800_000)).report;
    const outPath = join(projectRoot, renderReport.deliverable.resource);
    const videoStream = probeStream(outPath, 'v:0', 'width,height,nb_frames,r_frame_rate');
    log('6', `mp4 video stream: ${JSON.stringify(videoStream)}`);
    assert(videoStream.width === 1920 && videoStream.height === 1080, 'the MP4 is 1920x1080');

    for (const seconds of FRAME_SECONDS) {
      const framePath = join(
        ARTIFACTS_DIR,
        `script-word-timing-t${String(seconds).padStart(3, '0')}.jpg`,
      );
      ffmpeg(['-y', '-v', 'error', '-ss', String(seconds), '-i', outPath, '-frames:v', '1', framePath]);
      log('6', `frame at ${seconds} s: ${framePath}`);
    }

    assert(
      withScript.every(
        (caption) =>
          caption.endMs <= SILENT_FRAME_SECONDS * 1000 || caption.startMs > SILENT_FRAME_SECONDS * 1000,
      ),
      `no caption is on screen at ${SILENT_FRAME_SECONDS} s, where the narration is silent`,
    );

    log('7', 'audio sync: envelope correlation of the MP4 against voice.wav');
    const reference = audioEnvelope(join(projectRoot, 'work/voice/voice.wav'), 0, 93);
    const rendered = audioEnvelope(outPath, 0, 93);
    const { offsetMs, score } = bestOffsetMs(reference, rendered, 50);
    log('7', `best offset: ${offsetMs} ms (correlation ${score.toFixed(4)})`);
    assert(offsetMs === 0, `the rendered audio is in sync with voice.wav at 0 ms (got ${offsetMs} ms)`);
    assert(score > 0.9, `the envelopes match (correlation ${score.toFixed(4)})`);

    log('done', 'every acceptance criterion of FIX-e-burgos-009-004 and FIX-e-burgos-002-004 held');
  } finally {
    log('cleanup', `stopping render-api pid ${renderApi.pid}`);
    renderApi.kill('SIGTERM');
  }
}

main().catch((error) => {
  log('failed', error.stack ?? String(error));
  process.exitCode = 1;
});
