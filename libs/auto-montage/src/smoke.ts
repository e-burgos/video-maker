import { parseArgs } from 'node:util';

import { ExecaCommandRunner, resolveBinaries } from '@video-maker/media-local';

import { ingestProject, resolveMediaProject } from './index';

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const projectRoot = positionals[0];
  if (projectRoot === undefined) {
    throw new Error(
      'Uso: pnpm nx run auto-montage:smoke -- "<ruta-absoluta-del-proyecto-de-medios>"',
    );
  }

  const binaries = await resolveBinaries(process.env);
  const project = resolveMediaProject(projectRoot);
  const runner = new ExecaCommandRunner();

  const result = await ingestProject(project, { binaries }, { runner });

  console.log(
    JSON.stringify(
      {
        catalogPath: result.catalogPath,
        assetCount: result.catalog.assets.length,
        assets: result.catalog.assets.map((entry) => ({
          id: entry.asset.id,
          role: entry.role,
          kind: entry.asset.kind,
          durationMs: entry.asset.durationMs,
        })),
        transcripts: result.catalog.transcripts,
        ignored: result.catalog.ignored,
        probeFailures: result.probeFailures.map((failure) => ({
          path: failure.path,
          message: failure.message,
        })),
        transcriptionFailures: result.transcriptionFailures.map((failure) => ({
          assetId: failure.assetId,
          stage: failure.stage,
        })),
        transcribedAssetIds: result.transcribedAssetIds,
        reusedTranscriptionAssetIds: result.reusedTranscriptionAssetIds,
        reusedProbeAssetIds: result.reusedProbeAssetIds,
        staleCatalogReplaced: result.staleCatalogReplaced,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
