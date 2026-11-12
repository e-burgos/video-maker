import { removeStudioDiscoveryFileIfOwned, resolveAppVersion, resolveStudioSource, resolveVideoMakerHome, writeStudioDiscoveryFile } from './studio-discovery-file';

export interface PublishStudioDiscoveryInput {
  readonly env: NodeJS.ProcessEnv;
  readonly apiUrl: string;
  readonly token: string | null;
  readonly pid: number;
  readonly now: () => Date;
}

export async function publishStudioDiscovery(input: PublishStudioDiscoveryInput): Promise<() => Promise<void>> {
  const home = resolveVideoMakerHome(input.env);
  const source = resolveStudioSource(input.env);
  await writeStudioDiscoveryFile(home, {
    apiUrl: input.apiUrl,
    token: input.token,
    version: resolveAppVersion(input.env),
    source,
    pid: input.pid,
    startedAt: input.now().toISOString(),
  });
  return async () => {
    await removeStudioDiscoveryFileIfOwned(home, source, input.pid);
  };
}
