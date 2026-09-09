import { createContext, useContext } from 'react';
import type { FC, ReactNode } from 'react';

export type VideoBackend = 'render' | 'player';

export const DEFAULT_VIDEO_BACKEND: VideoBackend = 'render';

const VideoBackendContext = createContext<VideoBackend>(DEFAULT_VIDEO_BACKEND);

export type VideoBackendProviderProps = {
  backend: VideoBackend;
  children: ReactNode;
};

export const VideoBackendProvider: FC<VideoBackendProviderProps> = ({ backend, children }) => (
  <VideoBackendContext.Provider value={backend}>{children}</VideoBackendContext.Provider>
);

export function useVideoBackend(): VideoBackend {
  return useContext(VideoBackendContext);
}
