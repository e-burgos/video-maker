import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';

import { RenderApiProvider } from '../api/render-api-context';
import { LanguageProvider, useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { StudioLayout } from '../components/studio-layout';
import { ProjectsPage } from '../pages/projects-page';

const AssetLibraryPage = lazy(async () => ({
  default: (await import('../pages/asset-library-page')).AssetLibraryPage,
}));

const BrandsPage = lazy(async () => ({
  default: (await import('../pages/brands-page')).BrandsPage,
}));

const BrandEditorPage = lazy(async () => ({
  default: (await import('../pages/brand-editor-page')).BrandEditorPage,
}));

const GuidePage = lazy(async () => ({
  default: (await import('../pages/guide-page')).GuidePage,
}));

const ProjectWorkspacePage = lazy(async () => ({
  default: (await import('../pages/project-workspace-page')).ProjectWorkspacePage,
}));

const ProjectPreviewPage = lazy(async () => ({
  default: (await import('../pages/project-preview-page')).ProjectPreviewPage,
}));

const MotionPage = lazy(async () => ({
  default: (await import('../pages/motion-page')).MotionPage,
}));

const PublishQueuePage = lazy(async () => ({
  default: (await import('../pages/publish-queue-page')).PublishQueuePage,
}));

const SettingsPage = lazy(async () => ({
  default: (await import('../pages/settings-page')).SettingsPage,
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

function ProducerRouteRedirect() {
  const { slug = '' } = useParams<{ slug: string }>();
  return <Navigate to={`/projects/${slug}`} replace />;
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
                path="/brands"
                element={
                  <Suspense fallback={<RouteFallback messageKey="brands.loading" />}>
                    <BrandsPage />
                  </Suspense>
                }
              />
              <Route
                path="/brands/:id"
                element={
                  <Suspense fallback={<RouteFallback messageKey="brands.loading" />}>
                    <BrandEditorPage />
                  </Suspense>
                }
              />
              <Route
                path="/publish-queue"
                element={
                  <Suspense fallback={<RouteFallback messageKey="publishQueue.loading" />}>
                    <PublishQueuePage />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<RouteFallback messageKey="settings.loading" />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug/motion"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.workspace" />}>
                    <MotionPage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.workspace" />}>
                    <ProjectWorkspacePage />
                  </Suspense>
                }
              />
              <Route
                path="/projects/:slug/library"
                element={
                  <Suspense fallback={<RouteFallback messageKey="app.loading.library" />}>
                    <AssetLibraryPage />
                  </Suspense>
                }
              />
              <Route path="/projects/:slug/producer" element={<ProducerRouteRedirect />} />
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
