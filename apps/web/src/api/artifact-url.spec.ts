import { describe, expect, it } from 'vitest';

import { artifactUrl } from './artifact-url';

describe('artifactUrl', () => {
  it('encodes every segment of a nested path and keeps the slashes', () => {
    expect(artifactUrl('smoke-ingest', 'raw/aroll/clip 01.mp4')).toBe(
      '/api/projects/smoke-ingest/files/raw/aroll/clip%2001.mp4',
    );
  });

  it('encodes the slug as a single segment', () => {
    expect(artifactUrl('a b', 'out/master.mp4')).toBe('/api/projects/a%20b/files/out/master.mp4');
  });

  it('drops empty segments left by leading or doubled slashes', () => {
    expect(artifactUrl('demo', '/work//timeline.json')).toBe(
      '/api/projects/demo/files/work/timeline.json',
    );
  });

  it('drops dot segments so the url can never climb out of the project', () => {
    expect(artifactUrl('demo', '../../etc/passwd')).toBe('/api/projects/demo/files/etc/passwd');
    expect(artifactUrl('demo', './out/master.mp4')).toBe('/api/projects/demo/files/out/master.mp4');
  });
});
