import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { referenceBrief } from '../api/__fixtures__/reference';
import { ReferenceSceneStrip } from './reference-scene-strip';

describe('ReferenceSceneStrip', () => {
  it('renders one card per scene with keyframe, time range and duration', () => {
    render(<ReferenceSceneStrip slug="demo-01" scenes={referenceBrief().scenes} />);

    const scenes = screen.getAllByTestId('reference-scene');
    expect(scenes).toHaveLength(2);
    const second = within(scenes[1] as HTMLElement);
    expect(second.getByRole('img').getAttribute('src')).toBe(
      '/api/projects/demo-01/files/work/reference/demo/scene-01.jpg',
    );
    expect(second.getByRole('img').getAttribute('alt')).toBe('Key frame of scene 2');
    expect(second.getByText('Scene 2')).toBeTruthy();
    expect(second.getByText('0:03–0:09')).toBeTruthy();
    expect(second.getByText('6.5 s')).toBeTruthy();
  });

  it('scrolls the strip horizontally inside its own container', () => {
    render(<ReferenceSceneStrip slug="demo-01" scenes={referenceBrief().scenes} />);

    expect(screen.getByTestId('reference-scene-strip').className).toContain('overflow-x-auto');
  });
});
