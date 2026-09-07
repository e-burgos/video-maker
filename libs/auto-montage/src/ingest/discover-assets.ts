import { ProjectLayoutError } from '../errors/project-layout-error';
import type { DirectoryReader } from '../fs/directory-reader';
import type { FileStatReader, FileStats } from '../fs/file-stat-reader';
import type { MediaProject } from '../project/media-project';
import { toProjectRelativePath } from '../project/project-paths';
import type { AssetRole, IgnoredReason } from './classify-entry';
import { classifyFileEntry, classifyTopLevelEntry } from './classify-entry';

export interface AssetFinding {
  readonly relativePath: string;
  readonly role: AssetRole;
  readonly fingerprint: FileStats;
}

export interface IgnoredFinding {
  readonly path: string;
  readonly reason: IgnoredReason;
}

export interface DiscoverAssetsResult {
  readonly findings: readonly AssetFinding[];
  readonly ignored: readonly IgnoredFinding[];
}

export interface DiscoverAssetsDependencies {
  readonly readDirectory: DirectoryReader;
  readonly statFile: FileStatReader;
}

function compareByString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

async function walkRoleDirectory(
  deps: DiscoverAssetsDependencies,
  project: MediaProject,
  role: AssetRole,
  absoluteDirPath: string,
  findings: AssetFinding[],
  ignored: IgnoredFinding[],
): Promise<void> {
  const entries = await deps.readDirectory.readDirectory(absoluteDirPath);

  for (const entry of entries) {
    const entryAbsolutePath = `${absoluteDirPath}/${entry.name}`;

    if (entry.isDirectory) {
      if (!entry.name.startsWith('.')) {
        await walkRoleDirectory(deps, project, role, entryAbsolutePath, findings, ignored);
      }
      continue;
    }

    const entryRelativePath = toProjectRelativePath(project, entryAbsolutePath);
    const classification = classifyFileEntry(entry.name, role);

    if (classification.kind === 'ignored') {
      ignored.push({ path: entryRelativePath, reason: classification.reason });
      continue;
    }

    const fingerprint = await deps.statFile.statFile(entryAbsolutePath);
    findings.push({ relativePath: entryRelativePath, role, fingerprint });
  }
}

export async function discoverAssets(
  project: MediaProject,
  deps: DiscoverAssetsDependencies,
): Promise<DiscoverAssetsResult> {
  const topLevelEntries = await deps.readDirectory.readDirectory(project.rawDir).catch(() => {
    throw new ProjectLayoutError({ projectRoot: project.root, missingPath: project.rawDir });
  });

  const findings: AssetFinding[] = [];
  const ignored: IgnoredFinding[] = [];

  for (const entry of topLevelEntries) {
    const entryAbsolutePath = `${project.rawDir}/${entry.name}`;
    const classification = classifyTopLevelEntry(entry);

    if (classification.kind === 'skip') {
      continue;
    }

    if (classification.kind === 'ignored') {
      const entryRelativePath = toProjectRelativePath(project, entryAbsolutePath);
      ignored.push({ path: entryRelativePath, reason: classification.reason });
      continue;
    }

    await walkRoleDirectory(deps, project, classification.role, entryAbsolutePath, findings, ignored);
  }

  findings.sort((a, b) => compareByString(a.relativePath, b.relativePath));
  ignored.sort((a, b) => compareByString(a.path, b.path));

  return { findings, ignored };
}
