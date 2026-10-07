/**
 * Test-first (TASK-TEST-FE-73-03) del núcleo puro del registro (DEC-73-001).
 * Usa mapas de claves SINTÉTICOS (DEC-73-007): cero fixtures en disco, cero
 * fragilidad. `buildRegistry` todavía no existe — este archivo tiene que
 * fallar (rojo) antes de implementarlo en TASK-FE-73-04.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry } from './build-registry';
import { defineVideo } from './define-video';

function minimalVideo(title: string) {
  return {
    default: defineVideo({
      title,
      audience: 'prospecto',
      scenes: { Uno: () => null },
      timeline: [{ name: 'Uno', dur: 5 }],
    }),
  };
}

describe('buildRegistry', () => {
  it('descubre exactamente los videos con video.ts, con slug derivado de la carpeta', () => {
    const videoModules = {
      './demo-a/video.ts': minimalVideo('Demo A'),
      './demo-b/video.ts': minimalVideo('Demo B'),
    };
    const timelineKeys = ['./demo-a/timeline.json', './demo-b/timeline.json'];

    const registry = buildRegistry(videoModules, timelineKeys);

    expect(registry.videos.map((v) => v.slug)).toEqual(['demo-a', 'demo-b']);
    expect(registry.videos.every((v) => v.playable)).toBe(true);
    expect(registry.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(registry.defaultSlug).toBe('demo-a');
    expect(registry.bySlug.get('demo-a')?.definition.title).toBe('Demo A');
  });

  it('orden alfabético por slug, con numeric compare', () => {
    const videoModules = {
      './video-10/video.ts': minimalVideo('Diez'),
      './video-2/video.ts': minimalVideo('Dos'),
    };
    const timelineKeys = ['./video-10/timeline.json', './video-2/timeline.json'];

    const registry = buildRegistry(videoModules, timelineKeys);

    expect(registry.videos.map((v) => v.slug)).toEqual(['video-2', 'video-10']);
  });

  it('una carpeta con timeline.json pero sin video.ts produce un error que la nombra', () => {
    const videoModules = {
      './demo-a/video.ts': minimalVideo('Demo A'),
    };
    const timelineKeys = ['./demo-a/timeline.json', './conexion-android/timeline.json'];

    const registry = buildRegistry(videoModules, timelineKeys);

    // El video sano sigue registrado y jugable: una carpeta rota no tumba a las demás.
    expect(registry.videos.map((v) => v.slug)).toEqual(['demo-a']);
    expect(registry.videos[0].playable).toBe(true);

    const brokenIssue = registry.issues.find((i) => i.slug === 'conexion-android');
    expect(brokenIssue).toBeDefined();
    expect(brokenIssue?.code).toBe('missing-video-module');
    expect(brokenIssue?.where).toContain('conexion-android');
    expect(brokenIssue?.message).toContain('conexion-android');
  });

  it('una carpeta con video.ts pero sin timeline.json produce un error que la nombra', () => {
    const videoModules = {
      './demo-a/video.ts': minimalVideo('Demo A'),
      './huerfano/video.ts': minimalVideo('Huérfano'),
    };
    const timelineKeys = ['./demo-a/timeline.json'];

    const registry = buildRegistry(videoModules, timelineKeys);

    const brokenIssue = registry.issues.find((i) => i.slug === 'huerfano');
    expect(brokenIssue?.code).toBe('missing-timeline-file');
    expect(brokenIssue?.where).toContain('huerfano');
  });

  it('un nombre de carpeta que no es kebab-case produce invalid-slug y no tumba a los demás', () => {
    const videoModules = {
      './demo-a/video.ts': minimalVideo('Demo A'),
      './Como Funciona/video.ts': minimalVideo('Mal nombrado'),
    };
    const timelineKeys = ['./demo-a/timeline.json', './Como Funciona/timeline.json'];

    const registry = buildRegistry(videoModules, timelineKeys);

    expect(registry.videos.map((v) => v.slug)).toEqual(['demo-a']);
    const issue = registry.issues.find((i) => i.code === 'invalid-slug');
    expect(issue).toBeDefined();
  });

  it('un default export que no salió de defineVideo() produce not-a-video-definition', () => {
    const videoModules = {
      './demo-a/video.ts': minimalVideo('Demo A'),
      './roto/video.ts': { default: { no: 'es un video' } },
    };
    const timelineKeys = ['./demo-a/timeline.json', './roto/timeline.json'];

    const registry = buildRegistry(videoModules, timelineKeys);

    expect(registry.videos.map((v) => v.slug)).toEqual(['demo-a']);
    const issue = registry.issues.find((i) => i.slug === 'roto');
    expect(issue?.code).toBe('not-a-video-definition');
  });

  it('sin ningún video playable, defaultSlug es null', () => {
    const videoModules = {};
    const timelineKeys: string[] = [];

    const registry = buildRegistry(videoModules, timelineKeys);

    expect(registry.videos).toHaveLength(0);
    expect(registry.defaultSlug).toBeNull();
  });
});
