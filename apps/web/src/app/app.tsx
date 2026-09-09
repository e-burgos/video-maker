import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { RenderApiProvider } from '../api/render-api-context';
import { StudioLayout } from '../components/studio-layout';
import { AssetLibraryPage } from '../pages/asset-library-page';
import { ProjectsPage } from '../pages/projects-page';

const ProjectPreviewPage = lazy(async () => ({
  default: (await import('../pages/project-preview-page')).ProjectPreviewPage,
}));

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RenderApiProvider>
        <Routes>
          <Route element={<StudioLayout />}>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:slug" element={<AssetLibraryPage />} />
            <Route
              path="/projects/:slug/preview"
              element={
                <Suspense fallback={<p className="text-sm text-slate-500">Loading player…</p>}>
                  <ProjectPreviewPage />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </RenderApiProvider>
    </BrowserRouter>
  );
}
