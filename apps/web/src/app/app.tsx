import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { RenderApiProvider } from '../api/render-api-context';
import { LanguageProvider, useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { StudioLayout } from '../components/studio-layout';
import { ProjectsPage } from '../pages/projects-page';

const AssetLibraryPage = lazy(async () => ({
  default: (await import('../pages/asset-library-page')).AssetLibraryPage,
}));

const GuidePage = lazy(async () => ({
  default: (await import('../pages/guide-page')).GuidePage,
}));

const ProducerPage = lazy(async () => ({
  default: (await import('../pages/producer-page')).ProducerPage,
}));

const ProjectPreviewPage = lazy(async () => ({
  default: (await import('../pages/project-preview-page')).ProjectPreviewPage,
}));

const StoryboardPage = lazy(async () => ({
  default: (await import('../pages/storyboard-page')).StoryboardPage,
}));

const VoicePage = lazy(async () => ({
  default: (await import('../pages/voice-page')).VoicePage,
}));

function RouteFallback({ messageKey }: { messageKey: TranslationKey }) {
  const t = useT();
  return <p className="text-sm text-slate-500">{t(messageKey)}</p>;
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LanguageProvider>
        <RenderApiProvider>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route path="/" element={<ProjectsPage />} />
              <Route
                path="/guide"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.guide" />}>
                    <GuidePage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.library" />}>
                    <AssetLibraryPage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug/producer"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.producer" />}>
                    <ProducerPage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug/storyboard"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.storyboard" />}>
                    <StoryboardPage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug/voice"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.voice" />}>
                    <VoicePage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug/preview"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.player" />}>
                    <ProjectPreviewPage />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </RenderApiProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
