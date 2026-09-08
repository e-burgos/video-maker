import type { CliReport, IngestReport, PlanReport, RenderReport } from './cli-report';

function formatIngestReport(report: IngestReport): string[] {
  const assetsLine = report.assetCounts.map((entry) => `${entry.role}=${entry.count}`).join(' ');

  const lines: string[] = [
    `ok [ingest] ${report.catalogPath}`,
    `  assets: ${assetsLine}`,
    `  transcribed: ${report.transcribedCount} (reused ${report.reusedTranscriptionCount})`,
    `  probe-failures: ${report.probeFailurePaths.length}`,
    ...report.probeFailurePaths.map((path) => `    ${path}`),
    `  transcription-failures: ${report.transcriptionFailures.length}`,
    ...report.transcriptionFailures.map((failure) => `    ${failure.assetId} (${failure.failedStage})`),
  ];

  if (report.staleCatalogReplaced) {
    lines.push('  stale-catalog-replaced: yes');
  }

  return lines;
}

function formatPlanReport(report: PlanReport): string[] {
  return [
    `ok [plan] ${report.timelinePath}`,
    `  edl: ${report.edlPath}`,
    `  edited-duration-ms: ${report.editedDurationMs}`,
    `  transcription-source: ${report.transcriptionSource}`,
    `  concepts: ${report.conceptTerms.length}`,
    ...report.conceptTerms.map((term) => `    ${term}`),
    `  broll-overlays: ${report.brollOverlayCount}`,
    `  broll-rejections: ${report.brollRejections.length}`,
    ...report.brollRejections.map(
      (rejection) => `    ${rejection.conceptTerm}@${rejection.startMs}ms ${rejection.reason}`,
    ),
  ];
}

function formatRenderReport(report: RenderReport): string[] {
  return [
    `ok [render] ${report.outPath}`,
    `  format: ${report.width}x${report.height}@${report.fps}`,
    `  frames: ${report.durationInFrames}`,
  ];
}

export function formatReport(report: CliReport): readonly string[] {
  switch (report.kind) {
    case 'ingest':
      return formatIngestReport(report);
    case 'plan':
      return formatPlanReport(report);
    case 'render':
      return formatRenderReport(report);
    case 'run':
      return [
        ...formatReport(report.ingest),
        ...formatReport(report.plan),
        ...formatReport(report.render),
      ];
  }
}
