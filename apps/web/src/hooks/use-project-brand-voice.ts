import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from './use-async-resource';

export type ProjectBrandVoice = { id: string; lengthScale: number };

export function useProjectBrandVoice(slug: string): ProjectBrandVoice | null {
  const client = useRenderApi();
  const load = useCallback(async (): Promise<ProjectBrandVoice | null> => {
    try {
      const project = await client.getProject(slug);
      if (project.brand === undefined || project.brand === null || project.brandMissing === true) {
        return null;
      }
      const { manifest } = await client.getBrand(project.brand);
      return { id: manifest.voice.id, lengthScale: manifest.voice.lengthScale };
    } catch {
      return null;
    }
  }, [client, slug]);
  return useAsyncResource(load, `brand-voice:${slug}`).data;
}
