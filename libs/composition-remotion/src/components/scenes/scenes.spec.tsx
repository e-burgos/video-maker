import type { OutputFormat } from '@video-maker/timeline-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CodeScene } from './code-scene';
import { PlaceholderScene } from './placeholder-scene';
import { TextScene } from './text-scene';
import { TitleScene } from './title-scene';

const PORTRAIT: OutputFormat = { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 };
const LANDSCAPE: OutputFormat = { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 };

describe('TitleScene', () => {
  it('renders the headline as the only heading of the scene', () => {
    render(<TitleScene title="Cómo cocinar sin gas" format={PORTRAIT} />);

    expect(screen.getByRole('heading', { name: 'Cómo cocinar sin gas' })).toBeDefined();
  });

  it('renders the subtitle only when the storyboard filled it', () => {
    const { unmount } = render(<TitleScene title="Título" format={PORTRAIT} />);
    expect(screen.queryByText('Bajada')).toBeNull();
    unmount();

    render(<TitleScene title="Título" subtitle="Bajada" format={PORTRAIT} />);
    expect(screen.getByText('Bajada')).toBeDefined();
  });

  it('renders in 16:9 with the same type size as in 9:16', () => {
    const { container: portrait, unmount } = render(<TitleScene title="Título" format={PORTRAIT} />);
    const portraitSize = (portrait.querySelector('h1') as HTMLElement).style.fontSize;
    unmount();

    const { container: landscape } = render(<TitleScene title="Título" format={LANDSCAPE} />);

    expect((landscape.querySelector('h1') as HTMLElement).style.fontSize).toBe(portraitSize);
  });
});

describe('TextScene', () => {
  it('renders the body copy as written, without uppercasing it', () => {
    const { container } = render(<TextScene text="Un párrafo de apoyo" format={PORTRAIT} />);

    expect(screen.getByText('Un párrafo de apoyo')).toBeDefined();
    expect((container.querySelector('p') as HTMLElement).style.textTransform).toBe('');
  });
});

describe('CodeScene', () => {
  it('renders one element per line of the snippet and names the language', () => {
    const { container } = render(
      <CodeScene code={'const a = 1;\nconst b = 2;'} codeLanguage="typescript" format={PORTRAIT} />,
    );

    expect(screen.getByText('typescript')).toBeDefined();
    expect((container.querySelector('pre') as HTMLElement).children).toHaveLength(2);
  });

  it('renders in a monospace family without loading any highlighter', () => {
    const { container } = render(<CodeScene code="x" codeLanguage="js" format={PORTRAIT} />);

    expect((container.querySelector('pre') as HTMLElement).style.fontFamily).toContain('monospace');
  });

  it('keeps a snippet longer than the budget inside the card by shrinking and clipping it', () => {
    const code = Array.from({ length: 40 }, (_, index) => `const value${index} = ${index};`).join('\n');
    const { container } = render(<CodeScene code={code} codeLanguage="typescript" format={PORTRAIT} />);

    expect((container.querySelector('pre') as HTMLElement).children.length).toBeLessThanOrEqual(18);
  });
});

describe('PlaceholderScene', () => {
  it('shows the visual prompt so the missing shot is identifiable in the render', () => {
    render(<PlaceholderScene prompt="A kitchen at dawn" sceneId="scene-03" format={PORTRAIT} />);

    expect(screen.getByText('A kitchen at dawn')).toBeDefined();
    expect(screen.getByText('scene-03')).toBeDefined();
  });

  it('falls back to a generic label when there is no scene id to show', () => {
    render(<PlaceholderScene prompt="A kitchen at dawn" format={PORTRAIT} />);

    expect(screen.getByText('missing visual')).toBeDefined();
  });
});
