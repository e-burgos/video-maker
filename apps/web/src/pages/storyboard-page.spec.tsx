import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { motionOverviewFixture } from '../api/__fixtures__/motion-overview';
import { storyboardFixture } from '../api/__fixtures__/storyboard';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import { ShellToolbar } from '../components/shell/shell-toolbar';
import { ToolbarActionProvider } from '../components/shell/toolbar-action-provider';
import { StoryboardPage } from './storyboard-page';
import type { RenderApiClient } from '../api/render-api-client';
import type { StoryboardJob } from '../api/render-api-types';

const HEALTHY_SERVICE = {
  status: 'ok' as const,
  service: 'render-api',
  cycle: 3,
  time: '2026-09-09T12:00:00.000Z',
  engine: [],
  binaries: [],
  capabilities: {
    renderPipeline: true,
    assetStore: true,
    jobQueue: true,
    montageQueue: true,
    storyboardQueue: true,
    voiceQueue: true,
  },
  jobs: { running: 0, queued: 0 },
};

function succeededJob(): StoryboardJob {
  return {
    id: 'job-0009',
    kind: 'storyboard',
    slug: 'smoke-ingest',
    state: 'succeeded',
    createdAt: '2026-09-09T12:00:00.000Z',
    startedAt: '2026-09-09T12:00:00.500Z',
    finishedAt: '2026-09-09T12:01:40.000Z',
    progress: { stage: 'persist', percent: 100 },
    report: {
      storyboardPath: 'work/storyboard.json',
      storyboardId: 'storyboard-0001',
      source: 'brief',
      language: 'es-AR',
      sceneCount: 3,
      usage: { tokensIn: 10, tokensOut: 20, costUsd: null, model: null },
    },
    error: null,
  };
}

function withClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  withClipboard(undefined);
});

function renderPage(client: Partial<RenderApiClient>) {
  const withDefaults: Partial<RenderApiClient> = {
    getProject: vi.fn().mockResolvedValue({ slug: 'smoke-ingest' }),
    getHealth: vi.fn().mockResolvedValue(HEALTHY_SERVICE),
    getProjectFile: vi
      .fn()
      .mockRejectedValue(
        new RenderApiError('ARTIFACT_NOT_FOUND', 'no script', 404, null),
      ),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter initialEntries={['/projects/smoke-ingest/storyboard']}>
        <ToolbarActionProvider>
          <ShellToolbar title="Storyboard" subtitle={null} />
          <Routes>
            <Route path="/projects/:slug/storyboard" element={<StoryboardPage />} />
          </Routes>
        </ToolbarActionProvider>
      </MemoryRouter>
    </RenderApiProvider>,
  );
}

describe('StoryboardPage', () => {
  it('offers an actionable empty state when the project has no storyboard yet', async () => {
    renderPage({
      getStoryboard: vi
        .fn()
        .mockRejectedValue(new RenderApiError('STORYBOARD_NOT_FOUND', 'nothing yet', 404, null)),
    });

    await waitFor(() => expect(screen.getByTestId('storyboard-empty-state')).toBeTruthy());
    expect(screen.getByTestId('storyboard-trigger')).toBeTruthy();
    expect(screen.queryByTestId('storyboard-save-bar')).toBeNull();
  });

  it('shows any other read failure as a typed error, not as an empty state', async () => {
    renderPage({
      getStoryboard: vi
        .fn()
        .mockRejectedValue(new RenderApiError('STORYBOARD_INVALID', 'does not validate', 422, null)),
    });

    await waitFor(() => expect(screen.getByText('STORYBOARD_INVALID')).toBeTruthy());
    expect(screen.queryByTestId('storyboard-empty-state')).toBeNull();
  });

  it('renders the stored storyboard: header, character sheet, the scene list and the first scene', async () => {
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByTestId('storyboard-header-editor')).toBeTruthy());
    expect(screen.getByTestId('storyboard-character-sheet')).toBeTruthy();
    expect(screen.getByTestId('storyboard-scene-row-scene-01')).toBeTruthy();
    expect(screen.getByTestId('storyboard-scene-row-scene-03')).toBeTruthy();
    expect(screen.getByTestId('storyboard-scene-scene-01')).toBeTruthy();
    expect(screen.queryByTestId('storyboard-scene-scene-03')).toBeNull();
    expect(screen.getByTestId('storyboard-prompt-sheet')).toBeTruthy();
    expect(screen.getByTestId('storyboard-scene-count').textContent).toBe('3 scenes');
  });

  it('opens the scene the user picks in the list and marks it as the current one', async () => {
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByTestId('storyboard-scene-row-scene-03')).toBeTruthy());
    expect(screen.getByTestId('storyboard-scene-row-scene-01').getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByTestId('storyboard-scene-row-scene-03'));

    expect(screen.getByTestId('storyboard-scene-scene-03')).toBeTruthy();
    expect(screen.queryByTestId('storyboard-scene-scene-01')).toBeNull();
    expect(screen.getByTestId('storyboard-scene-row-scene-03').getAttribute('aria-current')).toBe('true');
  });

  it('flags the scene that has unsaved edits in the list', async () => {
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByLabelText('Narration for scene-01')).toBeTruthy());
    expect(screen.getByTestId('storyboard-scene-row-scene-01').getAttribute('data-scene-status')).toBe('ready');

    fireEvent.change(screen.getByLabelText('Narration for scene-01'), { target: { value: 'Otra.' } });

    await waitFor(() =>
      expect(screen.getByTestId('storyboard-scene-row-scene-01').getAttribute('data-scene-status')).toBe('edited'),
    );
    expect(screen.getByTestId('storyboard-scene-row-scene-02').getAttribute('data-scene-status')).toBe('ready');
  });

  it('shows the unsaved changes state in the save bar and drops the draft on discard', async () => {
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByLabelText('Title')).toBeTruthy());
    expect(screen.getByText('Saved')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Otro' } });
    await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe(storyboardFixture().title);
  });

  it('turns dirty on the first edit and clean again after the PUT', async () => {
    const putStoryboard = vi
      .fn()
      .mockResolvedValue({ slug: 'smoke-ingest', path: 'work/storyboard.json' });
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()), putStoryboard });

    await waitFor(() => expect(screen.getByTestId('storyboard-save-bar')).toBeTruthy());
    expect(screen.getByTestId('storyboard-save-bar').getAttribute('data-storyboard-dirty')).toBe(
      'false',
    );

    fireEvent.change(screen.getByLabelText('Narration for scene-01'), {
      target: { value: 'Una narración editada.' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('storyboard-save-bar').getAttribute('data-storyboard-dirty')).toBe(
        'true',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save storyboard' }));

    await waitFor(() =>
      expect(screen.getByTestId('storyboard-save-bar').getAttribute('data-storyboard-dirty')).toBe(
        'false',
      ),
    );
    const saved = putStoryboard.mock.calls[0]?.[1];
    expect(saved.scenes[0].narration).toBe('Una narración editada.');
    expect(saved.scenes).toHaveLength(3);
  });

  it('goes back to clean when an edit is typed back to the stored value', async () => {
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByLabelText('Title')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Otro' } });
    await waitFor(() =>
      expect(screen.getByTestId('storyboard-save-bar').getAttribute('data-storyboard-dirty')).toBe(
        'true',
      ),
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: storyboardFixture().title },
    });

    await waitFor(() =>
      expect(screen.getByTestId('storyboard-save-bar').getAttribute('data-storyboard-dirty')).toBe(
        'false',
      ),
    );
  });

  it('copies the prompt of a single scene and names the scene it copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByTestId('storyboard-scene-scene-01')).toBeTruthy());
    const scene = screen.getByTestId('storyboard-scene-scene-01');
    fireEvent.click(scene.querySelector('button') as HTMLButtonElement);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(storyboardFixture().scenes[0]?.visualPrompt),
    );
    expect(screen.getByTestId('storyboard-scene-copied').textContent).toContain('scene-01');
  });

  it('reloads the storyboard once the proposing job succeeds, dropping the previous draft', async () => {
    const getStoryboard = vi
      .fn()
      .mockRejectedValueOnce(new RenderApiError('STORYBOARD_NOT_FOUND', 'nothing yet', 404, null))
      .mockResolvedValue(storyboardFixture());
    renderPage({
      getStoryboard,
      createStoryboardJob: vi.fn().mockResolvedValue(succeededJob()),
      getRenderJob: vi.fn().mockResolvedValue(succeededJob()),
    });

    await waitFor(() => expect(screen.getByTestId('storyboard-empty-state')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Brief'), { target: { value: 'Tres trucos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose storyboard' }));

    await waitFor(() => expect(screen.getByTestId('storyboard-header-editor')).toBeTruthy());
    expect(getStoryboard).toHaveBeenCalledTimes(2);
  });
});

describe('StoryboardPage — guion del productor (FIX-009-003)', () => {
  const NO_STORYBOARD = new RenderApiError('STORYBOARD_NOT_FOUND', 'nothing yet', 404, null);
  const SCRIPT = '[0:00] Cada anuncio arranca de una plantilla.\n[0:22] El editor la ajusta.';

  it('sin storyboard pero con script.txt muestra el guion en vez del estado vacío', async () => {
    renderPage({
      getStoryboard: vi.fn().mockRejectedValue(NO_STORYBOARD),
      getProjectFile: vi.fn().mockResolvedValue(SCRIPT),
    });

    expect((await screen.findByTestId('producer-script-text')).textContent).toBe(SCRIPT);
    expect(screen.queryByTestId('storyboard-empty-state')).toBeNull();
  });

  it('lee el guion por el endpoint de artefactos', async () => {
    const getProjectFile = vi.fn().mockResolvedValue(SCRIPT);
    renderPage({
      getStoryboard: vi.fn().mockRejectedValue(NO_STORYBOARD),
      getProjectFile,
    });

    await waitFor(() =>
      expect(getProjectFile).toHaveBeenCalledWith('smoke-ingest', 'work/producer/script.txt'),
    );
  });

  it('conserva el estado vacío cuando tampoco hay guion', async () => {
    renderPage({ getStoryboard: vi.fn().mockRejectedValue(NO_STORYBOARD) });

    expect(await screen.findByTestId('storyboard-empty-state')).toBeTruthy();
    expect(screen.queryByTestId('producer-script-panel')).toBeNull();
  });

  it('con storyboard deja el guion del productor plegado y a mano', async () => {
    renderPage({
      getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()),
      getProjectFile: vi.fn().mockResolvedValue(SCRIPT),
    });

    const panel = await screen.findByTestId('producer-script-panel');
    expect((panel as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByTestId('producer-script-text').textContent).toBe(SCRIPT);
  });

  it('con storyboard y sin guion no muestra el panel del guion', async () => {
    renderPage({ getStoryboard: vi.fn().mockResolvedValue(storyboardFixture()) });

    await waitFor(() => expect(screen.getByTestId('storyboard-save-bar')).toBeTruthy());
    expect(screen.queryByTestId('producer-script-panel')).toBeNull();
  });
});

describe('storyboard page in a motion project', () => {
  it('renders the read-only motion view and never asks for the classic documents', async () => {
    const classicLoaders = {
      getStoryboard: vi.fn(),
      getVoice: vi.fn(),
      getTimeline: vi.fn(),
    };
    renderPage({
      getProject: vi.fn().mockResolvedValue({ slug: 'smoke-ingest', mode: 'motion' }),
      getMotionOverview: vi.fn().mockResolvedValue(motionOverviewFixture()),
      ...classicLoaders,
    });

    expect(await screen.findByTestId('motion-storyboard-view')).toBeTruthy();
    expect(screen.getByTestId('legacy-surface').contains(screen.getByTestId('motion-storyboard-view'))).toBe(true);
    expect(classicLoaders.getStoryboard).not.toHaveBeenCalled();
    expect(classicLoaders.getVoice).not.toHaveBeenCalled();
    expect(classicLoaders.getTimeline).not.toHaveBeenCalled();
  });
});
