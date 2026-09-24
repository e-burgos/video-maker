import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatDropZonePlaceholder } from './chat-drop-zone-placeholder';

describe('ChatDropZonePlaceholder', () => {
  it('renders the seam TASK-003 will wire drag and drop into', () => {
    render(<ChatDropZonePlaceholder />);

    expect(screen.getByTestId('chat-drop-zone').textContent).toContain('Drag your material here');
  });
});
