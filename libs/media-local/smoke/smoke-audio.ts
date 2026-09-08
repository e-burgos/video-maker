import { mkdirSync } from 'node:fs';

import type { EditDecisionList, MediaAsset } from '@video-maker/timeline-core';
import { buildTimeline, defaultFormat } from '@video-maker/timeline-core';

import {
  ExecaCommandRunner,
  MASTER_BUS_TRUE_PEAK_MARGIN_DB,
  MissingMediaStreamError,
  mixTimelineAudio,
  muxAudioIntoVideo,
  probeMedia,
  resolveBinary,
  verifyMixLoudness,
} from '../src/index';
import type { LoudnessMeasurement, MixLoudnessVerification } from '../src/index';

const TMP_DIR = 'tmp/smoke-audio';
const AROLL_PATH = `${TMP_DIR}/aroll.mp4`;
const MUSIC_PATH = `${TMP_DIR}/music.wav`;
const RENDER_MUTED_PATH = `${TMP_DIR}/render-muted.mp4`;
const MASTER_PATH = `${TMP_DIR}/master.wav`;
const FINAL_PATH = `${TMP_DIR}/final.mp4`;
const SHOULD_NOT_EXIST_PATH = `${TMP_DIR}/should-not-exist.mp4`;

function formatMeasurement(label: string, measurement: LoudnessMeasurement): string {
  return `  ${label}  I=${measurement.integratedLufs.toFixed(1)} LUFS  TP=${measurement.truePeakDbtp.toFixed(1)} dBTP  LRA=${measurement.loudnessRange.toFixed(1)} LU`;
}

function formatVerification(label: string, verification: MixLoudnessVerification): string {
  const arrow = verification.withinTolerance ? 'dentro' : 'FUERA';
  return `${formatMeasurement(label, verification.measured)}  Δ=${verification.integratedDeltaLu.toFixed(1)} LU / ${verification.truePeakDeltaDb.toFixed(1)} dB  -> ${arrow}`;
}

function extractMasterBusFilter(filterComplex: string): string {
  const start = filterComplex.lastIndexOf('alimiter=');
  const end = filterComplex.indexOf('[', start);
  return filterComplex.slice(start, end);
}

async function generateSignals(ffmpegPath: string, runner: ExecaCommandRunner): Promise<void> {
  await runner.run(ffmpegPath, [
    '-hide_banner',
    '-nostats',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=540x960:rate=30:duration=12',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=220:sample_rate=48000:duration=12',
    '-filter:a',
    'volume=-20dB',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    AROLL_PATH,
  ]);

  await runner.run(ffmpegPath, [
    '-hide_banner',
    '-nostats',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000:duration=12',
    '-filter:a',
    'volume=-12dB',
    '-c:a',
    'pcm_s16le',
    '-ar',
    '48000',
    '-ac',
    '2',
    MUSIC_PATH,
  ]);

  await runner.run(ffmpegPath, [
    '-hide_banner',
    '-nostats',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=540x960:rate=30:duration=12',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-an',
    RENDER_MUTED_PATH,
  ]);
}

function buildSmokeTimeline(arollAsset: MediaAsset, musicAsset: MediaAsset) {
  const edl: EditDecisionList = {
    schemaVersion: 1,
    sourceAssetId: 'aroll',
    format: defaultFormat('reels-9x16'),
    generatedBy: { tool: 'smoke-audio', params: {} },
    decisions: [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 12000 },
      { id: 'duck-0001', type: 'duck', startMs: 2000, endMs: 5000, gainDb: -24 },
      { id: 'duck-0002', type: 'duck', startMs: 7000, endMs: 9000, gainDb: -24 },
    ],
  };

  return buildTimeline(edl, [arollAsset, musicAsset], { assetId: 'music' });
}

async function checkMissingVideoStream(
  runner: ExecaCommandRunner,
  ffmpegPath: string,
  ffprobePath: string,
): Promise<boolean> {
  try {
    await muxAudioIntoVideo(MASTER_PATH, MASTER_PATH, SHOULD_NOT_EXIST_PATH, runner, { ffmpegPath, ffprobePath });
    return false;
  } catch (error) {
    return error instanceof MissingMediaStreamError && error.stream === 'video';
  }
}

async function main(): Promise<void> {
  const runner = new ExecaCommandRunner();
  const ffmpegPath = await resolveBinary('ffmpeg', process.env);
  const ffprobePath = await resolveBinary('ffprobe', process.env);

  mkdirSync(TMP_DIR, { recursive: true });

  console.log('smoke-audio · libs/media-local');
  console.log(`  ffmpeg  : ${ffmpegPath}`);
  console.log(`  ffprobe : ${ffprobePath}`);
  console.log();

  await generateSignals(ffmpegPath, runner);
  console.log(`  señales  : ${AROLL_PATH}  ${MUSIC_PATH}  ${RENDER_MUTED_PATH}`);

  const arollAsset = await probeMedia(AROLL_PATH, runner, { assetId: 'aroll', ffprobePath });
  const musicAsset = await probeMedia(MUSIC_PATH, runner, { assetId: 'music', ffprobePath });

  const timeline = buildSmokeTimeline(arollAsset, musicAsset);
  const target = timeline.audioMix.voice;

  const mixResult = await mixTimelineAudio(timeline, MASTER_PATH, runner, { ffmpegPath });
  console.log(`  master   : ${MASTER_PATH}`);

  const voiceAssetId = timeline.tracks.voice[0]?.assetId;
  const voiceMeasured = voiceAssetId !== undefined ? mixResult.voiceMeasured.get(voiceAssetId) : undefined;
  if (voiceMeasured !== undefined) {
    console.log(formatMeasurement('voz medida (pasada 1)', voiceMeasured));
  }

  const techoDbtp = target.truePeakDbtp - MASTER_BUS_TRUE_PEAK_MARGIN_DB;
  console.log(`  master bus             ${extractMasterBusFilter(mixResult.filterComplex)}  (techo ${techoDbtp} dBFS)`);

  const masterVerification = await verifyMixLoudness(MASTER_PATH, target, runner, { ffmpegPath });
  console.log(formatVerification('master (WAV)          ', masterVerification));

  await muxAudioIntoVideo(RENDER_MUTED_PATH, MASTER_PATH, FINAL_PATH, runner, { ffmpegPath, ffprobePath });
  console.log(`  entregable: ${FINAL_PATH}`);

  const finalVerification = await verifyMixLoudness(FINAL_PATH, target, runner, { ffmpegPath });
  console.log(formatVerification('entregable (MP4/AAC)  ', finalVerification));

  console.log();
  console.log(`  invocaciones de ffmpeg del mix: 2   (medición + mix)`);

  const ce3Ok = await checkMissingVideoStream(runner, ffmpegPath, ffprobePath);
  console.log(`  CE-3 (mux sin stream de video): ${ce3Ok ? 'MissingMediaStreamError -> OK' : 'FAIL'}`);

  const pass = finalVerification.withinTolerance && ce3Ok;
  console.log();
  console.log(`  RESULTADO: ${pass ? 'PASS' : 'FAIL'}`);

  if (!pass) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
