import { useCallback } from 'react';

import { artifactUrl } from '../api/artifact-url';
import {
  PRODUCER_SCRIPT_PATH,
  VOICE_SCRIPT_MANIFEST_PATH,
  VOICE_TRACK_PATH,
  formatFileSize,
  groupGeneratedFiles,
  hasGeneratedOutput,
} from '../api/generated-files';
import { parseVoiceScriptManifest } from '../api/parse-voice-script';
import { logoAssetsWithoutAlpha } from '../api/timeline-edit/logo-overlay';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import type { VoiceScriptManifest } from '@video-maker/timeline-core';
import type { AssetListing, GeneratedFile, GeneratedListing, VoiceDocument } from '../api/render-api-types';

export type GeneratedFilesPanelProps = {
  slug: string;
  assets: AssetListing | null;
};

function FileMeta({ file }: { file: GeneratedFile }) {
  return (
    <span className="font-mono text-xs text-slate-500">
      {file.path} · {formatFileSize(file.sizeBytes)}
    </span>
  );
}

function generatedVoiceId(
  voice: VoiceDocument | null,
  scriptManifest: VoiceScriptManifest | null,
): string | null {
  const tracks = voice?.manifest.tracks ?? [];
  return tracks.find((track) => track.voiceId !== null)?.voiceId ?? scriptManifest?.voiceId ?? null;
}

export function GeneratedFilesPanel({ slug, assets }: GeneratedFilesPanelProps) {
  const client = useRenderApi();
  const loadGenerated = useCallback(() => client.listGenerated(slug), [client, slug]);
  const generated = useAsyncResource<GeneratedListing>(loadGenerated, `generated:${slug}`);
  const group = groupGeneratedFiles(generated.data);
  const narrationExists = group.narration !== null;
  const scriptManifestExists =
    generated.data?.files.some((file) => file.path === VOICE_SCRIPT_MANIFEST_PATH) ?? false;
  const loadVoice = useCallback(async () => {
    if (!narrationExists) {
      return null;
    }
    return client.getVoice(slug);
  }, [client, slug, narrationExists]);
  const loadScriptManifest = useCallback(async () => {
    if (!scriptManifestExists) {
      return null;
    }
    return parseVoiceScriptManifest(await client.getProjectFile(slug, VOICE_SCRIPT_MANIFEST_PATH));
  }, [client, slug, scriptManifestExists]);
  const voice = useAsyncResource<VoiceDocument | null>(loadVoice, `voice:${slug}:${narrationExists}`);
  const scriptManifest = useAsyncResource<VoiceScriptManifest | null>(
    loadScriptManifest,
    `voice-script:${slug}:${scriptManifestExists}`,
  );
  const t = useT();

  const voiceId = generatedVoiceId(voice.data, scriptManifest.data);
  const opaqueLogos = logoAssetsWithoutAlpha(assets);

  return (
    <section data-testid="generated-files" className="space-y-3">
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
        {t('generated.heading')}
      </h2>
      <p className="text-sm text-slate-500">{t('generated.description')}</p>

      {opaqueLogos.map((path) => (
        <p key={path} data-testid="generated-logo-no-alpha" className="font-mono text-xs text-amber-300">
          {path} — {t('generated.logoNoAlpha')}
        </p>
      ))}

      {generated.status === 'loading' && (
        <p className="text-sm text-slate-500">{t('generated.loading')}</p>
      )}

      {generated.status === 'error' && generated.error !== null && (
        <ErrorNotice error={generated.error} onRetry={generated.reload} />
      )}

      {generated.status === 'ready' && !hasGeneratedOutput(group) && (
        <p data-testid="generated-empty" className="text-sm text-slate-600">
          {t('generated.empty')}
        </p>
      )}

      {group.narration !== null && (
        <div data-testid="generated-narration" className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-sm text-slate-300">{t('generated.narration')}</p>
          <audio
            data-testid="generated-narration-audio"
            src={artifactUrl(slug, VOICE_TRACK_PATH)}
            controls
            preload="metadata"
            className="w-full"
          />
          <div className="flex flex-wrap items-center gap-2">
            <FileMeta file={group.narration} />
            {voiceId !== null && (
              <span data-testid="generated-narration-voice" className="font-mono text-xs text-slate-400">
                {t('generated.narrationVoice', { voiceId })}
              </span>
            )}
          </div>
        </div>
      )}

      {group.script !== null && (
        <div data-testid="generated-script" className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-sm text-slate-300">{t('generated.script')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={artifactUrl(slug, PRODUCER_SCRIPT_PATH)}
              className="font-mono text-xs text-sky-300 underline"
            >
              {t('generated.open')}
            </a>
            <FileMeta file={group.script} />
          </div>
        </div>
      )}

      {group.deliverables.length > 0 && (
        <div data-testid="generated-deliverables" className="space-y-2">
          <p className="text-sm text-slate-300">{t('generated.deliverables')}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.deliverables.map((file) => (
              <li key={file.path} className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <video
                  data-testid="generated-deliverable-video"
                  src={artifactUrl(slug, file.path)}
                  controls
                  preload="metadata"
                  className="aspect-video w-full rounded-md bg-black"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <a href={artifactUrl(slug, file.path)} className="font-mono text-xs text-sky-300 underline">
                    {t('generated.download')}
                  </a>
                  <FileMeta file={file} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
