import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
  assert,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
  memoryGate,
  probeStream,
  spawnLogged,
  waitForHttp,
} from '../../apps/web/e2e/smoke-helpers.mjs';

const ARTIFACTS_DIR = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-010-scene-assembly/cycles/cycle-01/artifacts',
);
const SEED_STORYBOARD = join(
  REPO_ROOT,
  'sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-02/artifacts/smoke-storyboard-from-web.json',
);

const RENDER_API_PORT = 4399;
const BASE_URL = `http://127.0.0.1:${RENDER_API_PORT}`;
const SLUG = 'smoke-ingest';
const NON_TERMINAL_STATES = new Set(['queued', 'running', 'canceling']);
const AROLL_ORACLE_SHA256 = 'c1b9fd9f33ba69263d9806acd02b212d44adb3951e1927d9b64f44d04c8527cb';
const SCENE_PADDING_MS = 250;
const MIN_FREE_DISK_GIB = 2;

const SMOKE_TEMP_ROOT = join(tmpdir(), 'scene-assembly-smoke');

function freeDiskGib() {
  const line = execSync('df -k /', { encoding: 'utf8' }).trim().split('\n').at(-1) ?? '';
  const available = Number(line.split(/\s+/)[3]);
  return available / (1024 * 1024);
}

function diskReport() {
  return execSync('df -h /', { encoding: 'utf8' }).trim().split('\n').at(-1) ?? '';
}

function diskGate(step) {
  const free = freeDiskGib();
  log(step, `df -h /: ${diskReport()}`);
  assert(
    free >= MIN_FREE_DISK_GIB,
    `at least ${MIN_FREE_DISK_GIB} GiB free before writing media (measured ${free.toFixed(2)} GiB)`,
  );
}

function temporaryUsage() {
  try {
    return execSync(`du -sh "${SMOKE_TEMP_ROOT}" 2>/dev/null || true`, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function parseFrameRate(value) {
  const [numerator, denominator] = value.split('/').map(Number);
  return denominator === undefined || denominator === 0 ? numerator : numerator / denominator;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function api(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function pollJob(jobId, deadlineMs, onSnapshot) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const { payload } = await api('GET', `/jobs/${jobId}`);
    onSnapshot?.(payload);
    if (!NON_TERMINAL_STATES.has(payload.state)) {
      return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`job ${jobId} did not reach a terminal state in ${deadlineMs} ms`);
}

async function runJob(label, body, timeoutMs) {
  const stages = [];
  const { status, payload } = await api('POST', `/projects/${SLUG}/jobs`, body);
  assert(status === 202, `POST job ${label} answered 202 (got ${status}: ${JSON.stringify(payload).slice(0, 240)})`);
  const job = await pollJob(payload.id, timeoutMs, (snapshot) => {
    const stage = snapshot.progress?.stage;
    if (stage !== undefined && stage !== null && !stages.includes(stage)) {
      stages.push(stage);
    }
  });
  assert(
    job.state === 'succeeded',
    `job ${label} succeeded (state ${job.state}, error ${JSON.stringify(job.error ?? null)})`,
  );
  log(label, `stages observed: ${stages.join(' -> ') || 'none'}`);
  return { job, stages };
}

function startRenderApi(mediaRoot) {
  return spawnLogged(
    'render-api',
    'node',
    ['-r', './apps/render-api/src/server-register.cjs', 'apps/render-api/src/main.ts'],
    {
      ...process.env,
      RENDER_API_PORT: String(RENDER_API_PORT),
      RENDER_API_MEDIA_ROOT: mediaRoot,
      SWC_NODE_PROJECT: 'tsconfig.base.json',
    },
  );
}

function buildSmokeStoryboard(seed) {
  const scenes = seed.scenes.map((scene, position) => {
    const base = {
      id: scene.id,
      index: position + 1,
      narration: scene.narration,
      visualPrompt: scene.visualPrompt,
      estimatedDurationMs: scene.estimatedDurationMs,
      musicTags: scene.musicTags,
      sfxTags: scene.sfxTags,
    };
    if (position === 1) {
      return {
        ...base,
        visualSource: 'remotion-scene',
        remotionScene: { kind: 'title', title: 'Tres trucos de terminal', subtitle: 'Una hora por semana' },
      };
    }
    if (position === 2) {
      return { ...base, visualSource: 'remotion-scene', remotionScene: scene.remotionScene };
    }
    return { ...base, visualSource: 'upload' };
  });

  return { ...seed, scenes };
}

async function seedAssemblyProject() {
  const mediaRoot = join(SMOKE_TEMP_ROOT, 'assembly');
  const projectRoot = join(mediaRoot, SLUG);
  await mkdir(join(projectRoot, 'work'), { recursive: true });
  await cp(join(REPO_ROOT, 'media', SLUG, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await cp(
    join(REPO_ROOT, 'media', SLUG, 'work', 'transcripts'),
    join(projectRoot, 'work', 'transcripts'),
    { recursive: true },
  );
  await cp(join(REPO_ROOT, 'media', SLUG, 'work', 'catalog.json'), join(projectRoot, 'work', 'catalog.json'));

  await rename(join(projectRoot, 'raw', 'images', 'photo01.jpg'), join(projectRoot, 'raw', 'images', '01.jpg'));
  await rename(join(projectRoot, 'raw', 'broll', 'clip01.mp4'), join(projectRoot, 'raw', 'broll', '04.mp4'));

  const seed = JSON.parse(await readFile(SEED_STORYBOARD, 'utf8'));
  const storyboard = buildSmokeStoryboard(seed);
  await writeFile(join(projectRoot, 'work', 'storyboard.json'), `${JSON.stringify(storyboard, null, 2)}\n`);

  return { mediaRoot, projectRoot, storyboard };
}

async function captureSceneFrames(mp4Path, timeline, storyboard) {
  const fps = timeline.format.fps;
  const captured = [];

  for (const clip of timeline.tracks.scenes) {
    const midSeconds = (clip.from + clip.durationFrames / 2) / fps;
    const scene = storyboard.scenes.find((candidate) => candidate.id === clip.sceneId);
    const label = clip.visual.kind === 'remotion' ? `remotion-${clip.visual.scene.kind}` : clip.visual.kind;
    const outPath = join(ARTIFACTS_DIR, `smoke-frame-${clip.sceneId}-${label}.png`);
    execSync(
      `ffmpeg -y -v error -ss ${midSeconds.toFixed(3)} -i "${mp4Path}" -frames:v 1 -q:v 3 "${outPath}"`,
      { encoding: 'utf8' },
    );
    captured.push({
      sceneId: clip.sceneId,
      visualSource: scene?.visualSource ?? 'unknown',
      visual: label,
      atSeconds: Number(midSeconds.toFixed(3)),
      file: `artifacts/${outPath.split('/').pop()}`,
    });
  }

  return captured;
}

async function captureCaptionFrame(mp4Path, timeline) {
  const fps = timeline.format.fps;
  const clip = timeline.tracks.captions.reduce(
    (longest, candidate) =>
      longest === undefined || candidate.durationFrames > longest.durationFrames ? candidate : longest,
    undefined,
  );

  if (clip === undefined) {
    return null;
  }

  const midSeconds = (clip.from + clip.durationFrames / 2) / fps;
  const outPath = join(ARTIFACTS_DIR, 'smoke-frame-captions.png');
  execSync(`ffmpeg -y -v error -ss ${midSeconds.toFixed(3)} -i "${mp4Path}" -frames:v 1 -q:v 3 "${outPath}"`, {
    encoding: 'utf8',
  });

  return {
    clipId: clip.id,
    words: clip.words.map((word) => word.text).join(' '),
    atSeconds: Number(midSeconds.toFixed(3)),
    file: 'artifacts/smoke-frame-captions.png',
  };
}

async function runAssemblySmoke() {
  log('1', 'seeding a temporary media root from media/smoke-ingest');
  const { mediaRoot, projectRoot, storyboard } = await seedAssemblyProject();
  log('1', `temp media root: ${mediaRoot}`);

  const renderApi = startRenderApi(mediaRoot);
  const evidence = { mediaRoot };

  try {
    log('2', 'waiting for render-api');
    const health = await (await waitForHttp(`${BASE_URL}/health`, 30000)).json();
    assert(
      health.capabilities.assembleQueue === true,
      'the service under test exposes capabilities.assembleQueue, so this is the cycle-01 build and not a stale server',
    );
    evidence.health = { status: health.status, capabilities: health.capabilities };

    log('3', 'ingesting raw/ so the catalog knows the renamed files');
    const montage = await runJob('montage', { kind: 'montage', overwrite: true }, 600000);
    evidence.montage = montage.job.report;

    log('4', 'synthesizing the voice of every scene');
    const voice = await runJob('voice', { kind: 'voice', overwrite: true }, 900000);
    evidence.voice = {
      stages: voice.stages,
      scenes: voice.job.report.scenes.map((scene) => ({
        sceneId: scene.sceneId,
        durationMs: scene.durationMs,
        source: scene.source,
      })),
    };

    log('5', 'importing the numbered files onto their scenes');
    const importResult = await api('POST', `/projects/${SLUG}/scenes/import`, {});
    assert(importResult.status === 200, `POST scenes/import answered 200 (got ${importResult.status})`);
    evidence.sceneImport = {
      imported: importResult.payload.imported,
      assignments: importResult.payload.assignment.assignments,
      skipped: importResult.payload.skipped,
      slots: importResult.payload.slots.map((slot) => ({
        sceneId: slot.sceneId,
        visualSource: slot.visualSource,
        assetId: slot.assetId,
      })),
    };
    assert(
      importResult.payload.imported === 2,
      `the numbered import bound the two renamed files (imported ${importResult.payload.imported})`,
    );
    assert(
      importResult.payload.slots.at(-1).assetId === null,
      'the last upload scene stays without an asset, so the render must fall back to its placeholder',
    );

    log('6', 'assembling the timeline from the storyboard');
    const assemble = await runJob('assemble', { kind: 'assemble', overwrite: true }, 120000);
    evidence.assemble = { stages: assemble.stages, report: assemble.job.report };
    const canonicalStages = ['collect', 'build', 'persist'];
    assert(
      assemble.stages.length > 0 &&
        assemble.stages.every(
          (stage, index) =>
            canonicalStages.includes(stage) &&
            (index === 0 || canonicalStages.indexOf(stage) > canonicalStages.indexOf(assemble.stages[index - 1])),
        ),
      `the stages the 500 ms poller sampled are a prefix-ordered subset of collect|build|persist (${assemble.stages.join(',')}); ` +
        'the build stage is synchronous and usually falls between two samples — the full order is asserted by run-assemble-pipeline.spec.ts',
    );
    assert(
      assemble.stages.at(-1) === 'persist',
      `the last stage the poller saw is persist (${assemble.stages.at(-1)})`,
    );
    assert(
      assemble.job.report.editDecisionListPath === null,
      'the assemble job declares it writes no edl.json (D-5)',
    );

    const timeline = JSON.parse(await readFile(join(projectRoot, 'work', 'timeline.json'), 'utf8'));
    assert(timeline.tracks.aroll.length === 0, 'the assembled timeline leaves the aroll track empty');
    assert(
      timeline.tracks.scenes.length === storyboard.scenes.length,
      `the assembled timeline has one scene clip per storyboard scene (${timeline.tracks.scenes.length})`,
    );
    const visualKinds = timeline.tracks.scenes.map((clip) =>
      clip.visual.kind === 'remotion' ? `remotion:${clip.visual.scene.kind}` : clip.visual.kind,
    );
    log('6', `scene visuals: ${visualKinds.join(', ')}`);
    assert(
      visualKinds.includes('placeholder'),
      'the scene with no assigned visual became a placeholder instead of failing the build',
    );

    const voiceMsById = new Map(
      evidence.voice.scenes.map((scene) => [scene.sceneId, scene.durationMs]),
    );
    const expectedMs = timeline.tracks.scenes.reduce(
      (total, clip) => total + (voiceMsById.get(clip.sceneId) ?? 0) + SCENE_PADDING_MS,
      0,
    );
    const expectedFrames = timeline.tracks.scenes.reduce(
      (total, clip) =>
        total + Math.round((((voiceMsById.get(clip.sceneId) ?? 0) + SCENE_PADDING_MS) / 1000) * timeline.format.fps),
      0,
    );
    evidence.durations = {
      voiceMsPlusPadding: expectedMs,
      expectedFrames,
      timelineDurationFrames: timeline.durationFrames,
      fps: timeline.format.fps,
    };
    assert(
      timeline.durationFrames === expectedFrames,
      `durationFrames is the sum of the real voice durations plus the padding (${timeline.durationFrames} vs ${expectedFrames})`,
    );

    diskGate('7');
    log('7', 'rendering the assembled timeline');
    const render = await runJob('render', { kind: 'render' }, 1800000);
    const deliverable = join(projectRoot, render.job.report.deliverable.resource);
    evidence.render = {
      stages: render.stages,
      deliverable: render.job.report.deliverable.resource,
      loudness: render.job.report.loudness,
    };

    log('8', 'probing the delivered MP4');
    const video = probeStream(deliverable, 'v:0', 'codec_name,width,height,nb_frames,r_frame_rate');
    const audio = probeStream(deliverable, 'a:0', 'codec_name,sample_rate,channels');
    const videoSeconds = Number(video.nb_frames) / parseFrameRate(video.r_frame_rate);
    evidence.ffprobe = { video, audio, videoSeconds: Number(videoSeconds.toFixed(3)) };
    assert(Number(video.nb_frames) === timeline.durationFrames, `the video stream has exactly durationFrames frames (${video.nb_frames})`);
    assert(audio.codec_name === 'aac', `the delivered audio is AAC (${audio.codec_name})`);
    assert(video.width === 1080 && video.height === 1920, `the deliverable is 1080x1920 (${video.width}x${video.height})`);

    log('9', 'capturing one frame in the middle of every scene');
    evidence.frames = await captureSceneFrames(deliverable, timeline, storyboard);

    assert(
      timeline.tracks.captions.length > 0,
      `the assembled timeline carries captions built from the voice words.json (${timeline.tracks.captions.length})`,
    );
    evidence.captionFrame = await captureCaptionFrame(deliverable, timeline);
    log('9', `caption frame: ${JSON.stringify(evidence.captionFrame)}`);

    evidence.timeline = {
      durationFrames: timeline.durationFrames,
      format: timeline.format,
      scenes: timeline.tracks.scenes.map((clip) => ({
        sceneId: clip.sceneId,
        from: clip.from,
        durationFrames: clip.durationFrames,
        visual: clip.visual.kind === 'remotion' ? `remotion:${clip.visual.scene.kind}` : clip.visual.kind,
      })),
      voiceClips: timeline.tracks.voice.length,
      captionClips: timeline.tracks.captions.length,
    };

    return evidence;
  } finally {
    renderApi.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function runArollNonRegression() {
  log('10', 'rendering the untouched A-roll timeline to prove the scenes track changed nothing');
  diskGate('10');
  const mediaRoot = join(SMOKE_TEMP_ROOT, 'aroll-oracle');
  const projectRoot = join(mediaRoot, SLUG);
  await mkdir(projectRoot, { recursive: true });
  await cp(join(REPO_ROOT, 'media', SLUG, 'raw'), join(projectRoot, 'raw'), { recursive: true });
  await mkdir(join(projectRoot, 'work'), { recursive: true });
  for (const name of ['timeline.json', 'edl.json', 'catalog.json']) {
    await cp(join(REPO_ROOT, 'media', SLUG, 'work', name), join(projectRoot, 'work', name));
  }

  const renderApi = startRenderApi(mediaRoot);
  try {
    await waitForHttp(`${BASE_URL}/health`, 30000);
    const { job } = await runJob('render-aroll', { kind: 'render' }, 1800000);
    const mutedResource = job.report.intermediates.mutedVideoResource;
    const digest = await sha256(join(projectRoot, mutedResource));
    assert(
      digest === AROLL_ORACLE_SHA256,
      `the A-roll muted render is byte identical to the reference (${digest})`,
    );
    return { mutedVideo: mutedResource, sha256: digest, oracle: AROLL_ORACLE_SHA256 };
  } finally {
    renderApi.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function main() {
  await memoryGate();
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);
  await mkdir(ARTIFACTS_DIR, { recursive: true });

  const diskBefore = diskReport();
  log('0', `df -h / before: ${diskBefore}`);
  diskGate('0');

  log('0', 'ensuring the Remotion browser is installed');
  execSync('npx remotion browser ensure', { cwd: REPO_ROOT, stdio: 'inherit' });

  await rm(SMOKE_TEMP_ROOT, { recursive: true, force: true });
  await mkdir(SMOKE_TEMP_ROOT, { recursive: true });

  let evidence;
  try {
    const assembly = await runAssemblySmoke();
    await memoryGate();
    const nonRegression = await runArollNonRegression();
    const temporaryFootprint = temporaryUsage();
    const diskAfter = diskReport();
    log('done', `temporary footprint: ${temporaryFootprint}`);
    log('done', `df -h / after: ${diskAfter}`);
    evidence = {
      ranAt: new Date().toISOString(),
      disk: { before: diskBefore, after: diskAfter, temporaryFootprint },
      assembly,
      nonRegression,
    };
  } finally {
    await rm(SMOKE_TEMP_ROOT, { recursive: true, force: true });
    log('cleanup', `removed ${SMOKE_TEMP_ROOT}; df -h /: ${diskReport()}`);
  }

  await writeFile(
    join(ARTIFACTS_DIR, 'smoke-scene-assembly.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  log('done', 'evidence written to artifacts/smoke-scene-assembly.json');
}

main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
