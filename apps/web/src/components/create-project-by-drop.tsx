import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { assetContentType, assetMediaKind } from '../api/asset-media-kind';
import { slugifyFileName, uniqueProjectSlug } from '../api/project-slug';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';

export type CreateProjectByDropProps = {
  existingSlugs: readonly string[];
  children: ReactNode;
};

export function CreateProjectByDrop({ existingSlugs, children }: CreateProjectByDropProps) {
  const client = useRenderApi();
  const navigate = useNavigate();
  const t = useT();
  const [dragActive, setDragActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);
  const dragDepth = useRef(0);

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragActive(false);
    }
  }

  async function createFromFile(file: File) {
    setError(null);
    setCreating(true);
    try {
      const slug = uniqueProjectSlug(slugifyFileName(file.name), existingSlugs);
      await client.createProject({ slug, mode: 'footage' });
      await client.uploadToInbox({
        slug,
        filename: file.name,
        contentType: file.type === '' ? assetContentType(file.name) : file.type,
        body: file,
      });
      navigate(`/projects/${encodeURIComponent(slug)}`);
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
      setCreating(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined && assetMediaKind(file.name) !== 'other') {
      void createFromFile(file);
    }
  }

  return (
    <div
      data-testid="create-project-drop-zone"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive && (
        <div
          data-testid="create-project-overlay"
          className="fixed inset-0 z-30 flex items-center justify-center border-4 border-dashed border-accent bg-surface/90 text-lg font-medium text-accent-strong"
        >
          {t('projects.dropToCreate')}
        </div>
      )}

      {creating && (
        <p data-testid="create-project-progress" className="text-sm text-ink-faint">
          {t('projects.creatingFromFile')}
        </p>
      )}

      {error !== null && <ErrorNotice error={error} />}

      {children}
    </div>
  );
}
