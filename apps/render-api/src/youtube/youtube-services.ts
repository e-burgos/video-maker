import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { createYoutubeClient } from './youtube-client';
import type { YoutubeClient } from './youtube-client';
import { createYoutubeOAuth } from './youtube-oauth';
import type { YoutubeOAuth } from './youtube-oauth';

export interface YoutubeServices {
  readonly oauth: YoutubeOAuth;
  readonly client: YoutubeClient;
}

export function createYoutubeServices(deps: RenderApiDependencies): YoutubeServices {
  const oauth = createYoutubeOAuth(deps);
  return { oauth, client: createYoutubeClient(deps, oauth) };
}
