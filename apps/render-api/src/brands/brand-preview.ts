import {
  buildDuckAutomation,
  composeFromStoryboard,
  composeProject,
  joinPath,
  MOTION_COMPOSITION_ID,
  parseMotionStoryboard,
} from '@video-maker/motion-graphics';
import type { MotionPipelinePorts, MotionTimeline, SceneSlot } from '@video-maker/motion-graphics';
import { join } from 'node:path/posix';

import type { StoreConfig } from '../config/store-config';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { translateMotionError } from '../errors/translate-motion-error';
import { isSafeRelativePath, locateBrand, readManifest } from './brand-library';
import type { BrandFileTarget } from './brand-library';

export interface BrandPreviewOverrides {
  readonly tagline?: string;
  readonly headline?: string;
}

export interface BrandPreviewResult {
  readonly url: string;
  readonly composedAt: string;
  readonly durationSec: number;
}

const PREVIEW_DIRECTORY = '.preview';
const SCENE_SECONDS = 4.5;
const REVEAL_SCENE_ID = 'reveal';
const CTA_SCENE_ID = 'cta';
const CTA_BUTTON = 'Pedí tu cotización';
const VO_LEAD_IN = 0.25;
const PREVIEW_BPM = 120;
const AUDIO_TAG = /<audio\b[^>]*><\/audio>\s*/gu;

const PREVIEW_STAGE_STYLE = `<style>
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
#root { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }
</style>
`;

const PREVIEW_RUNTIME_SCRIPT = `<script>
(function () {
  var root = document.getElementById('root');
  function fitStage() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var left = (window.innerWidth - 1920 * scale) / 2;
    var top = (window.innerHeight - 1080 * scale) / 2;
    root.style.transform = 'translate(' + left + 'px,' + top + 'px) scale(' + scale + ')';
  }
  fitStage();
  window.addEventListener('resize', fitStage);
  var timeline = window.__timelines && window.__timelines[${JSON.stringify(MOTION_COMPOSITION_ID)}];
  if (timeline) { timeline.repeat(-1).repeatDelay(0.8).play(0); }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'mg-brand-tokens' || !data.tokens || typeof data.tokens !== 'object') { return; }
    Object.keys(data.tokens).forEach(function (name) {
      var value = data.tokens[name];
      if (/^--mg-[a-z0-9-]+$/.test(name) && typeof value === 'string') { document.documentElement.style.setProperty(name, value); }
    });
  });
})();
</script>
`;

export function previewDirectory(store: StoreConfig, id: string): string {
  return join(store.brandsRoot, PREVIEW_DIRECTORY, id);
}

function previewUrl(id: string): string {
  return `/brands/${id}/preview/index.html`;
}

function syntheticTimeline(): MotionTimeline {
  const scenes: SceneSlot[] = [REVEAL_SCENE_ID, CTA_SCENE_ID].map((id, index) => ({
    id,
    start: index * SCENE_SECONDS,
    end: (index + 1) * SCENE_SECONDS,
    voStart: index * SCENE_SECONDS + VO_LEAD_IN,
    voDuration: 0,
  }));
  const duration = SCENE_SECONDS * scenes.length;
  return {
    beatSync: false,
    duration,
    bpm: PREVIEW_BPM,
    beatLength: 60 / PREVIEW_BPM,
    beats: [],
    scenes,
    musicAutomation: buildDuckAutomation(scenes, duration),
    musicCredit: '',
  };
}

function previewStoryboard(brand: Awaited<ReturnType<typeof readManifest>>, overrides: BrandPreviewOverrides) {
  const revealTagline = overrides.headline ?? overrides.tagline;
  const ctaTagline = overrides.tagline ?? overrides.headline;
  return parseMotionStoryboard({
    version: 1,
    title: `${brand.name} preview`,
    brand: brand.id,
    format: '16:9',
    beatSync: false,
    music: null,
    scenes: [
      {
        id: REVEAL_SCENE_ID,
        kind: 'brand-reveal',
        vo: brand.tagline,
        props: revealTagline === undefined ? {} : { tagline: revealTagline },
      },
      {
        id: CTA_SCENE_ID,
        kind: 'cta',
        vo: brand.tagline,
        props: { button: CTA_BUTTON, ...(ctaTagline === undefined ? {} : { tagline: ctaTagline }) },
      },
    ],
  });
}

async function finishPreviewHtml(ports: MotionPipelinePorts, directory: string): Promise<void> {
  const path = joinPath(directory, 'index.html');
  const html = (await ports.readText(path)).replace(AUDIO_TAG, '');
  const staged = html.replace('</head>', `${PREVIEW_STAGE_STYLE}</head>`);
  await ports.writeText(path, staged.replace('</body>', `${PREVIEW_RUNTIME_SCRIPT}</body>`));
}

async function composePreview(ports: MotionPipelinePorts, storyboard: ReturnType<typeof previewStoryboard>, directory: string): Promise<number> {
  const timeline = syntheticTimeline();
  await composeFromStoryboard(ports, storyboard, directory, directory);
  await ports.writeText(joinPath(directory, 'timeline.json'), `${JSON.stringify(timeline)}\n`);
  await ports.writeText(joinPath(directory, 'words.json'), '{}\n');
  await composeProject(ports, directory);
  await finishPreviewHtml(ports, directory);
  return timeline.duration;
}

export async function createBrandPreview(
  deps: RenderApiDependencies,
  store: StoreConfig,
  id: string,
  overrides: BrandPreviewOverrides,
): Promise<BrandPreviewResult> {
  const brand = await locateBrand(deps, store, id);
  const manifest = await readManifest(deps, brand);
  const directory = previewDirectory(store, id);
  await deps.storage.removeDirectory(directory);
  await deps.storage.ensureDirectory(directory);

  try {
    const durationSec = await composePreview(deps.motionPorts(), previewStoryboard(manifest, overrides), directory);
    return { url: previewUrl(id), composedAt: deps.clock.nowIso(), durationSec };
  } catch (cause) {
    throw translateMotionError(cause, null, id) ?? cause;
  }
}

export async function resolveBrandPreviewFile(
  deps: RenderApiDependencies,
  store: StoreConfig,
  id: string,
  relativePath: string,
): Promise<BrandFileTarget> {
  if (!isSafeRelativePath(relativePath)) {
    throw new PipelineStageError({ code: 'ASSET_PATH_INVALID', stage: null, resource: relativePath, expected: 'a path inside the brand preview' });
  }
  await locateBrand(deps, store, id);
  const absolutePath = join(previewDirectory(store, id), relativePath);
  const fileStat = await deps.storage.stat(absolutePath);
  if (fileStat === null || fileStat.kind !== 'file') {
    throw new PipelineStageError({ code: 'FILE_NOT_FOUND', stage: null, resource: relativePath });
  }
  return { absolutePath, relativePath, sizeBytes: fileStat.sizeBytes };
}
