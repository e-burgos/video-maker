import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../../api/render-api-context';
import type { RenderApiClient } from '../../api/render-api-client';
import { RenderApiError } from '../../api/render-api-error';
import type { ServiceHealth } from '../../api/render-api-types';
import { COPILOT_MCP_JSON } from '../../content/agents/agent-configs';
import { LANGUAGE_STORAGE_KEY } from '../../i18n/language';
import { LanguageProvider } from '../../i18n/language-context';
import { AgentsTab } from './agents-tab';

function health(producerEngines: { claudeCli: boolean; openrouter: boolean } | undefined): ServiceHealth {
  return {
    status: 'ok',
    service: 'render-api',
    cycle: 1,
    time: '',
    engine: [],
    binaries: [],
    capabilities: {
      renderPipeline: true,
      assetStore: true,
      jobQueue: true,
      montageQueue: true,
      storyboardQueue: true,
      voiceQueue: true,
      producer: true,
      producerEngines,
    },
    jobs: { running: 0, queued: 0 },
  };
}

function renderTab(getHealth: () => Promise<ServiceHealth>) {
  render(
    <LanguageProvider>
      <RenderApiProvider client={{ getHealth } as unknown as RenderApiClient}>
        <AgentsTab />
      </RenderApiProvider>
    </LanguageProvider>,
  );
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

beforeEach(() => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('AgentsTab', () => {
  it('shows one section per agent with its configuration', async () => {
    renderTab(async () => health({ claudeCli: true, openrouter: false }));

    await waitFor(() => expect(screen.getByTestId('agent-copilot')).toBeTruthy());

    for (const id of ['claude-code', 'copilot', 'gemini', 'other']) {
      expect(screen.getByTestId(`agent-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('agent-block-claude-code-install').textContent).toContain('/plugin install video-maker@video-maker');
    expect(screen.getByTestId('agent-block-copilot-mcp-json').textContent).toContain('"video-maker"');
    expect(screen.getByTestId('agent-block-other-command').textContent).toContain('npx -y @e-burgos/video-maker-mcp');
  });

  it('reports the API address and each producer engine', async () => {
    renderTab(async () => health({ claudeCli: true, openrouter: false }));

    await waitFor(() => expect(screen.getByTestId('agents-engine-claudeCli')).toBeTruthy());

    expect(screen.getByTestId('agents-studio').textContent).toMatch(/Studio API reachable at .+\/api$/);
    expect(screen.getByTestId('agents-engine-claudeCli').dataset['state']).toBe('ready');
    expect(screen.getByTestId('agents-engine-openrouter').dataset['state']).toBe('missing');
  });

  it('marks the engines unknown when the service does not report them', async () => {
    renderTab(async () => health(undefined));

    await waitFor(() => expect(screen.getByTestId('agents-engine-claudeCli').dataset['state']).toBe('unknown'));
  });

  it('shows the failure and retries when the studio cannot be read', async () => {
    const getHealth = vi
      .fn()
      .mockRejectedValueOnce(new RenderApiError('SERVICE_UNREACHABLE', 'down', null, null))
      .mockResolvedValue(health({ claudeCli: true, openrouter: true }));
    renderTab(getHealth);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByTestId('agents-engine-openrouter').dataset['state']).toBe('ready'));
  });

  it('copies a block and confirms with Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    renderTab(async () => health({ claudeCli: true, openrouter: true }));
    await waitFor(() => expect(screen.getByTestId('agent-copy-copilot-mcp-json')).toBeTruthy());

    fireEvent.click(screen.getByTestId('agent-copy-copilot-mcp-json'));

    await waitFor(() => expect(screen.getByTestId('agent-copy-copilot-mcp-json').textContent).toBe('Copied'));
    expect(writeText).toHaveBeenCalledWith(COPILOT_MCP_JSON);
  });

  it('asks to copy by hand when the clipboard is refused', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    renderTab(async () => health({ claudeCli: true, openrouter: true }));
    await waitFor(() => expect(screen.getByTestId('agent-copy-gemini-settings-json')).toBeTruthy());

    fireEvent.click(screen.getByTestId('agent-copy-gemini-settings-json'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('copy it by hand'));
    expect(screen.getByTestId('agent-copy-gemini-settings-json').textContent).toBe('Copy');
  });
});
