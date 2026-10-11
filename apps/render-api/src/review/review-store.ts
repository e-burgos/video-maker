import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { ReviewReportSchema } from '@video-maker/timeline-core';
import type { ReviewReport } from '@video-maker/timeline-core';

import type { ObjectStorage } from '../deps/object-storage';
import type { ReviewJobCounts } from '../jobs/render-job';
import { REVIEW_FILE_SUFFIX, reviewFileFor } from '../jobs/review-job-params';

const OUT_DIRECTORY = 'out';

export interface StoredReview {
  readonly file: string;
  readonly reviewFile: string;
  readonly report: ReviewReport;
}

export function countFindings(report: ReviewReport): ReviewJobCounts {
  const count = (severity: ReviewReport['findings'][number]['severity']): number =>
    report.findings.filter((finding) => finding.severity === severity).length;
  return { critical: count('critical'), suggestion: count('suggestion'), nitpick: count('nitpick') };
}

export async function writeReview(storage: ObjectStorage, project: MediaProject, report: ReviewReport): Promise<string> {
  const validated = ReviewReportSchema.parse(report);
  const reviewFile = reviewFileFor(validated.file);
  await storage.writeTextFile(toAbsolutePath(project, reviewFile), `${JSON.stringify(validated, null, 2)}\n`);
  return reviewFile;
}

async function readReviewAt(storage: ObjectStorage, project: MediaProject, reviewFile: string): Promise<ReviewReport | null> {
  const path = toAbsolutePath(project, reviewFile);
  if ((await storage.stat(path))?.kind !== 'file') {
    return null;
  }
  try {
    const parsed = ReviewReportSchema.safeParse(JSON.parse(await storage.readTextFile(path)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readReview(storage: ObjectStorage, project: MediaProject, file: string): Promise<StoredReview | null> {
  const reviewFile = reviewFileFor(file);
  const report = await readReviewAt(storage, project, reviewFile);
  return report === null ? null : { file, reviewFile, report };
}

export async function listReviews(storage: ObjectStorage, project: MediaProject): Promise<StoredReview[]> {
  const entries = (await storage.listDirectory(toAbsolutePath(project, OUT_DIRECTORY))) ?? [];
  const reviews: StoredReview[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(REVIEW_FILE_SUFFIX)) {
      continue;
    }
    const reviewFile = `${OUT_DIRECTORY}/${entry.name}`;
    const report = await readReviewAt(storage, project, reviewFile);
    if (report !== null) {
      reviews.push({ file: `${OUT_DIRECTORY}/${entry.name.slice(0, -REVIEW_FILE_SUFFIX.length)}.mp4`, reviewFile, report });
    }
  }
  return reviews.sort((left, right) => left.file.localeCompare(right.file));
}
