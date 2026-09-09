import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimelineIssueList } from './timeline-issue-list';
import type { TimelineEditIssue } from '../api/timeline-edit/timeline-edit-state';

describe('TimelineIssueList', () => {
  it('shows a CLIP_EXCEEDS_ASSET issue as a warning distinguishable from ErrorNotice, with its code, path and message', () => {
    const issues: TimelineEditIssue[] = [
      { code: 'CLIP_EXCEEDS_ASSET', path: 'tracks.aroll[0].durationFrames', message: 'Clip exceeds the asset.' },
    ];

    render(<TimelineIssueList issues={issues} />);

    const row = screen.getByRole('status');
    expect(row.getAttribute('data-severity')).toBe('render-blocking');
    expect(row.textContent).toContain('CLIP_EXCEEDS_ASSET');
    expect(row.textContent).toContain('tracks.aroll[0].durationFrames');
    expect(row.textContent).toContain('Clip exceeds the asset.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('distinguishes a save-blocking issue from a render-blocking one', () => {
    const issues: TimelineEditIssue[] = [
      { code: 'SCHEMA_INVALID', path: 'root', message: 'The document does not validate.' },
      { code: 'AROLL_GAP', path: 'tracks.aroll[1].from', message: 'There is a gap.' },
    ];

    render(<TimelineIssueList issues={issues} />);

    const rows = screen.getAllByRole('status');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-severity')).toBe('save-blocking');
    expect(rows[1]?.getAttribute('data-severity')).toBe('render-blocking');
    expect(rows[0]?.className).not.toBe(rows[1]?.className);
  });

  it('renders VOICE_TRACK_NOT_MIRRORED (APR-04), classified as render-blocking, without widening or casting the library type', () => {
    const issues: TimelineEditIssue[] = [
      {
        code: 'VOICE_TRACK_NOT_MIRRORED',
        path: 'tracks.voice',
        message: 'tracks.voice has 3 clip(s) but tracks.aroll has 4; the mirror was skipped.',
      },
    ];

    render(<TimelineIssueList issues={issues} />);

    const row = screen.getByRole('status');
    expect(row.getAttribute('data-severity')).toBe('render-blocking');
    expect(row.textContent).toContain('VOICE_TRACK_NOT_MIRRORED');
    expect(row.textContent).toContain('tracks.voice');
  });

  it('renders nothing when there are no issues', () => {
    const { container } = render(<TimelineIssueList issues={[]} />);

    expect(container.textContent).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
