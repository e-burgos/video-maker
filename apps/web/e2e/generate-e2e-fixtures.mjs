import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  REPO_ROOT,
  VOICE_ENV_VARS,
  assertMediaEnvResolvable,
  loadRootEnv,
  log,
} from './smoke-helpers.mjs';

const ARROLL_PHRASES = [
  'Hola, hoy te muestro tres trucos de terminal que le ahorran una hora por semana a cualquier desarrollador.',
  'El primero es usar el historial con búsqueda inversa para repetir comandos largos sin escribirlos de nuevo.',
  'El segundo es crear alias para los comandos más largos que usás todos los días en tu trabajo.',
  'El tercero es encadenar comandos con pipes para no abrir ninguna herramienta extra ni escribir scripts.',
  'Con estos tres trucos tu flujo de trabajo en la terminal se vuelve mucho más rápido y más cómodo.',
  'Probalos esta semana y contame cuánto tiempo te ahorraron, nos vemos en el próximo video.',
];

const PRODUCER_SPEECH =
  'Bienvenidos al recorrido por la plataforma. Acá vemos cómo se crea una campaña paso a paso, ' +
  'cómo se elige la pantalla donde va a correr y cómo se revisa antes de publicarla.';

const DISPLAY_ADS_SCRIPT = [
  'Entramos a la plataforma con nuestro usuario y llegamos al panel principal donde está todo el resumen.',
  'Las campañas viven acá. Esta línea de tiempo muestra qué corre en cada pantalla y avisa si dos campañas se pisan.',
  'Creamos una nueva. Son cinco pasos y podés moverte libre entre ellos sin perder lo que ya cargaste.',
  'Primero el nombre y desde cuándo corre. Si dejamos la fecha de fin vacía, la campaña no vence por calendario.',
  'Después, qué días corre y en qué horario, para que cada anuncio salga solo cuando corresponde.',
  'El efecto entre un anuncio y el siguiente, que podemos elegir entre varias transiciones suaves.',
  'Acá armamos la playlist. La plataforma separa horizontal y vertical, así la misma campaña se ve bien en una pantalla parada y en una acostada.',
  'Antes de largarla, la vemos como se va a ver en la pantalla real, con las medidas y los tiempos de cada pieza.',
  'Y listo. Con un clic queda guardada y asignada a las pantallas que elegimos al principio del recorrido.',
  'La campaña nace en borrador, así la revisás tranquila antes de ponerla al aire para todo el equipo.',
  '',
].join('\n');

function ffmpegPath() {
  return process.env.FFMPEG_PATH ?? 'ffmpeg';
}

function ffmpeg(args) {
  execFileSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function synthesizeSpeech(text, outputPath) {
  const voice = join(process.env.TTS_VOICES_DIR, 'vits-piper-es_AR-daniela-high');
  execFileSync(
    process.env.TTS_CLI_PATH,
    [
      `--vits-model=${join(voice, 'es_AR-daniela-high.onnx')}`,
      `--vits-tokens=${join(voice, 'tokens.txt')}`,
      `--vits-data-dir=${join(voice, 'espeak-ng-data')}`,
      `--output-filename=${outputPath}`,
      text,
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
}

function synthesizePhrases(phrases, outputPath, scratch) {
  const parts = phrases.map((phrase, index) => {
    const part = join(scratch, `phrase-${index}.wav`);
    synthesizeSpeech(phrase, part);
    return part;
  });
  const inputs = parts.flatMap((part) => ['-i', part]);
  ffmpeg([
    ...inputs,
    '-f',
    'lavfi',
    '-t',
    '2.4',
    '-i',
    'anullsrc=r=22050:cl=mono',
    '-filter_complex',
    parts
      .map((_, index) => `[${index}:a]aresample=22050,aformat=channel_layouts=mono[s${index}]`)
      .concat(
        `[${parts.length}:a]asplit=${parts.length - 1}${parts
          .slice(1)
          .map((_, index) => `[g${index}]`)
          .join('')}`,
        `${parts
          .map((_, index) => (index === 0 ? `[s0]` : `[g${index - 1}][s${index}]`))
          .join('')}concat=n=${parts.length * 2 - 1}:v=0:a=1[out]`,
      )
      .join(';'),
    '-map',
    '[out]',
    outputPath,
  ]);
}

function videoFilter(source, size, seconds) {
  return ['-f', 'lavfi', '-t', String(seconds), '-i', `${source}=size=${size}:rate=30`];
}

function encodeVideo(outputPath) {
  return ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', outputPath];
}

function makeSpeakingClipExact(outputPath, size, speechWav) {
  const probe = execFileSync(
    process.env.FFPROBE_PATH ?? 'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', speechWav],
    { encoding: 'utf8' },
  );
  const seconds = (Number(probe.trim()) + 1).toFixed(2);
  ffmpeg([
    ...videoFilter('testsrc2', size, seconds),
    '-i',
    speechWav,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-shortest',
    outputPath,
  ]);
}

function makeSilentClip(outputPath, source, size, seconds) {
  ffmpeg([...videoFilter(source, size, seconds), ...encodeVideo(outputPath)]);
}

function makeImage(outputPath, size) {
  ffmpeg(['-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=1`, '-frames:v', '1', outputPath]);
}

function makeLogo(outputPath) {
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=c=0x1e5fd8:s=1200x240',
    '-vf',
    'format=rgba,drawbox=x=40:y=40:w=160:h=160:color=white@1:t=fill,drawbox=x=240:y=90:w=900:h=60:color=white@0.85:t=fill',
    '-frames:v',
    '1',
    outputPath,
  ]);
}

function makeMusic(outputPath, seconds) {
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=220:sample_rate=44100:duration=${seconds}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=330:sample_rate=44100:duration=${seconds}`,
    '-filter_complex',
    '[0:a][1:a]amix=inputs=2,volume=0.6[a]',
    '-map',
    '[a]',
    '-c:a',
    'libmp3lame',
    outputPath,
  ]);
}

async function folders(root, names) {
  for (const name of names) {
    await mkdir(join(root, name), { recursive: true });
  }
}

function runCli(args) {
  execFileSync(
    'node',
    ['-r', './tools/render-cli/src/cli-register.cjs', 'tools/render-cli/src/main.ts', ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, SWC_NODE_PROJECT: 'tsconfig.base.json' },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
}

async function generateSmokeIngest(destination, scratch) {
  const root = join(destination, 'smoke-ingest');
  await folders(join(root, 'raw'), ['aroll', 'broll', 'images', 'audio']);
  const speech = join(scratch, 'smoke-speech.wav');
  synthesizePhrases(ARROLL_PHRASES, speech, scratch);
  makeSpeakingClipExact(join(root, 'raw/aroll/clip01.mp4'), '720x1280', speech);
  makeSilentClip(join(root, 'raw/broll/broll01.mp4'), 'mandelbrot', '720x1280', 6);
  makeImage(join(root, 'raw/images/photo01.jpg'), '1080x1080');
  makeMusic(join(root, 'raw/audio/music01.mp3'), 40);
  log('smoke-ingest', 'raw/ ready, ingesting and planning the CLI baseline into work/');
  runCli(['ingest', root]);
  runCli(['plan', root, '--preset', 'software-demo', '--seed', '0']);
}

async function generateDemo01(destination, scratch) {
  const root = join(destination, 'demo-01');
  await folders(join(root, 'raw'), ['aroll', 'logo']);
  await mkdir(join(root, 'work/producer'), { recursive: true });
  const speech = join(scratch, 'demo-speech.wav');
  synthesizeSpeech(PRODUCER_SPEECH, speech);
  makeSpeakingClipExact(join(root, 'raw/aroll/recorrido.mp4'), '1280x720', speech);
  makeLogo(join(root, 'raw/logo/brand.png'));
}

async function generateDisplayAds(destination) {
  const root = join(destination, 'display-ads');
  await folders(join(root, 'raw'), ['aroll', 'logo']);
  await mkdir(join(root, 'work/producer'), { recursive: true });
  makeSilentClip(join(root, 'raw/aroll/recorrido-plataforma.mp4'), 'testsrc2', '1920x1080', 96.53);
  makeLogo(join(root, 'raw/logo/brand.png'));
  await writeFile(join(root, 'work/producer/script.txt'), DISPLAY_ADS_SCRIPT, 'utf8');
  await writeFile(
    join(root, 'work/producer/conversation.json'),
    JSON.stringify({ schemaVersion: 1, turns: [] }, null, 2),
    'utf8',
  );
}

async function main() {
  const target = process.argv[2];
  if (target === undefined || target === '') {
    throw new Error('usage: node apps/web/e2e/generate-e2e-fixtures.mjs <destination-directory>');
  }
  await loadRootEnv(VOICE_ENV_VARS);
  assertMediaEnvResolvable(VOICE_ENV_VARS);

  const destination = resolve(target);
  await mkdir(destination, { recursive: true });
  const scratch = await mkdtemp(join(tmpdir(), 'e2e-fixtures-'));
  try {
    await generateSmokeIngest(destination, scratch);
    await generateDemo01(destination, scratch);
    await generateDisplayAds(destination);
    log('done', `fixtures written to ${destination}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

await main();
