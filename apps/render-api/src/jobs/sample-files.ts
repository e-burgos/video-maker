import type { Job } from './render-job';
import { isSampleVideoName } from './sample-job-params';

export type SampleFileClassifier = (relativePath: string) => boolean;

export interface JobsBySlug {
  readonly listBySlug: (slug: string) => readonly Job[];
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
}

function producedVideoOf(job: Job): { readonly path: string; readonly sample: boolean } | null {
  if (job.kind === 'render' && job.report !== null) {
    return { path: job.report.deliverable.resource, sample: job.report.sample === true };
  }
  if (job.kind === 'motion' && job.report?.path) {
    return { path: job.report.path, sample: job.report.sample === true };
  }
  return null;
}

export function createSampleFileClassifier(jobs: readonly Job[]): SampleFileClassifier {
  const sampleByPath = new Map<string, boolean>();
  for (const job of jobs) {
    const produced = producedVideoOf(job);
    if (produced !== null) {
      sampleByPath.set(normalizeRelativePath(produced.path), produced.sample);
    }
  }
  return (relativePath) => sampleByPath.get(normalizeRelativePath(relativePath)) ?? isSampleVideoName(relativePath);
}

export function sampleFileClassifierFor(jobs: JobsBySlug | undefined, slug: string): SampleFileClassifier {
  return createSampleFileClassifier(jobs?.listBySlug(slug) ?? []);
}
