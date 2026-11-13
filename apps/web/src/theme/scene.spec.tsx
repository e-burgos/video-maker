import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Scene } from './scene';

describe('Scene', () => {
  it('renders its children above a decorative backdrop', () => {
    const { container } = render(
      <Scene>
        <p data-testid="content">contenido</p>
      </Scene>,
    );
    const backdrop = container.querySelector('[data-scene-backdrop]');
    expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    expect(backdrop?.querySelectorAll('span')).toHaveLength(2);
    expect(screen.getByTestId('content').parentElement?.className).toContain('z-10');
    expect(container.firstElementChild?.className).toContain('isolate');
  });

  it('keeps the backdrop static', () => {
    const { container } = render(<Scene>x</Scene>);
    expect(container.innerHTML).not.toMatch(/animate-|transition/);
  });
});
