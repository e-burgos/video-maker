// @vitest-environment node
/**
 * Test-first (TASK-TEST-FE-73-10) del núcleo puro del endpoint dev-only de
 * guardado del timeline (DEC-73-003 §5.6). Corre en entorno `node` real:
 * arma un árbol temporal con `fs.mkdtempSync` y ejercita `saveTimeline` /
 * `listVideoSlugs` contra archivos de verdad, sin levantar Vite.
 *
 * Estos tests tienen que FALLAR antes de que exista `save-timeline-core.ts`
 * (todavía no se implementó — TASK-FE-73-11 lo crea).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listVideoSlugs, saveTimeline } from './save-timeline-core';

let root: string;
let videosRoot: string;
let sentinelPath: string;

/** Crea una carpeta de video válida: video.ts + timeline.json con contenido dado. */
function makeVideoFolder(slug: string, timelineContent: string): void {
  const dir = join(videosRoot, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'video.ts'), '// stub de test\n');
  writeFileSync(join(dir, 'timeline.json'), timelineContent);
}

/** Snapshot de mtime + contenido de TODO el árbol bajo `root`, recursivo. */
function snapshotTree(dir: string): Record<string, { content: string; mtimeMs: number }> {
  const out: Record<string, { content: string; mtimeMs: number }> = {};
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const stat = statSync(full);
        out[full] = { content: readFileSync(full, 'utf-8'), mtimeMs: stat.mtimeMs };
      }
    }
  };
  walk(dir);
  return out;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'motion-editor-save-timeline-'));
  videosRoot = join(root, 'src', 'videos');
  mkdirSync(videosRoot, { recursive: true });

  makeVideoFolder('como-funciona', JSON.stringify([{ name: 'Apertura', dur: 6 }], null, 2) + '\n');
  makeVideoFolder('conexion-android', JSON.stringify([{ name: 'Montaje', dur: 4 }], null, 2) + '\n');

  // Centinela FUERA de videosRoot: cualquier variante de traversal que "funcionara" lo tocaría.
  sentinelPath = join(root, 'centinela.txt');
  writeFileSync(sentinelPath, 'no me toques\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('listVideoSlugs', () => {
  it('lista sólo las carpetas que tienen video.ts Y timeline.json', () => {
    // Carpeta a medias: sólo timeline.json, sin video.ts.
    mkdirSync(join(videosRoot, 'a-medias'), { recursive: true });
    writeFileSync(join(videosRoot, 'a-medias', 'timeline.json'), '[]');

    const slugs = listVideoSlugs(videosRoot);
    expect(slugs.sort()).toEqual(['como-funciona', 'conexion-android']);
  });

  it('devuelve array vacío si la raíz no existe', () => {
    expect(listVideoSlugs(join(root, 'no-existe'))).toEqual([]);
  });
});

describe('saveTimeline — caso feliz', () => {
  it('slug válido ⇒ 200, escribe el archivo correcto y el del otro video queda byte-idéntico', () => {
    const before = snapshotTree(root);

    const result = saveTimeline({
      videosRoot,
      body: { slug: 'como-funciona', timeline: [{ name: 'Apertura', dur: 8 }, { name: 'Problema', dur: 9, nat: 9 }] },
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, path: 'src/videos/como-funciona/timeline.json', scenes: 2 });

    const written = readFileSync(join(videosRoot, 'como-funciona', 'timeline.json'), 'utf-8');
    expect(JSON.parse(written)).toEqual([
      { name: 'Apertura', dur: 8 },
      { name: 'Problema', dur: 9, nat: 9 },
    ]);

    // El del otro video no se tocó.
    const otherPath = join(videosRoot, 'conexion-android', 'timeline.json');
    const before_ = before[otherPath];
    const after_ = snapshotTree(root)[otherPath];
    expect(after_.content).toBe(before_.content);
  });
});

describe('saveTimeline — slug desconocido', () => {
  it('slug: "no-existe" ⇒ 403, cero escrituras', () => {
    const before = snapshotTree(root);

    const result = saveTimeline({
      videosRoot,
      body: { slug: 'no-existe', timeline: [{ name: 'A', dur: 1 }] },
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ ok: false, error: 'unknown_slug' });
    expect(snapshotTree(root)).toEqual(before);
  });

  it('carpeta que existe en disco pero sin video.ts ⇒ 403 (no está en el registro)', () => {
    mkdirSync(join(videosRoot, 'huerfana'), { recursive: true });
    writeFileSync(join(videosRoot, 'huerfana', 'timeline.json'), '[]');
    const before = snapshotTree(root);

    const result = saveTimeline({
      videosRoot,
      body: { slug: 'huerfana', timeline: [{ name: 'A', dur: 1 }] },
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ ok: false, error: 'unknown_slug' });
    expect(snapshotTree(root)).toEqual(before);
  });
});

describe('saveTimeline — path traversal: TODOS fallan por la misma razón que "pepito"', () => {
  const traversalSlugs = ['../fuera', '../../etc/passwd', '/tmp/x', 'a/b', 'a\\b', '', '.', '..'];

  it.each(traversalSlugs)('slug=%j ⇒ 403, centinela intacto', (slug) => {
    const sentinelBefore = readFileSync(sentinelPath, 'utf-8');
    const before = snapshotTree(root);

    const result = saveTimeline({
      videosRoot,
      body: { slug, timeline: [{ name: 'A', dur: 1 }] },
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ ok: false, error: 'unknown_slug' });
    expect(readFileSync(sentinelPath, 'utf-8')).toBe(sentinelBefore);
    expect(snapshotTree(root)).toEqual(before);
  });
});

describe('saveTimeline — payload inválido', () => {
  it.each([123, null, {}, undefined, ['x']])('slug no-string (%j) ⇒ 400', (slug) => {
    const result = saveTimeline({ videosRoot, body: { slug, timeline: [{ name: 'A', dur: 1 }] } });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, error: 'invalid_payload' });
  });

  it('body sin "timeline" ⇒ 400', () => {
    const result = saveTimeline({ videosRoot, body: { slug: 'como-funciona' } });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, error: 'invalid_payload' });
  });

  it('body no es un objeto ⇒ 400', () => {
    const result = saveTimeline({ videosRoot, body: 'no soy un objeto' });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, error: 'invalid_payload' });
  });
});

describe('saveTimeline — timeline estructuralmente inválido', () => {
  it.each<[Array<{ name: string; dur: number }>]>([
    [[{ name: 'A', dur: 0 }]],
    [[{ name: 'A', dur: -1 }]],
    [[{ name: 'A', dur: NaN }]],
    [[{ name: '', dur: 1 }]],
    [[{ name: 'A', dur: 1 }, { name: 'A', dur: 2 }]],
  ])('caso inválido %j ⇒ 422, sin escritura', (timeline) => {
    const before = snapshotTree(root);
    const result = saveTimeline({ videosRoot, body: { slug: 'como-funciona', timeline } });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ ok: false, error: 'invalid_timeline' });
    expect(snapshotTree(root)).toEqual(before);
  });
});

describe('saveTimeline — formato de salida', () => {
  it('indentado de 2, newline final y orden de claves (name, dur, nat, extra alfabético)', () => {
    const result = saveTimeline({
      videosRoot,
      body: {
        slug: 'como-funciona',
        timeline: [{ name: 'Apertura', zeta: 1, dur: 6, alfa: 2, nat: 6 }],
      },
    });

    expect(result.status).toBe(200);
    const raw = readFileSync(join(videosRoot, 'como-funciona', 'timeline.json'), 'utf-8');

    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.endsWith('\n\n')).toBe(false);
    // Indentado de 2: la segunda línea de un array de objetos empieza con 2 espacios + '{'.
    expect(raw.split('\n')[1]).toMatch(/^ {2}\{/);

    const keysInOrder = Object.keys(JSON.parse(raw)[0]);
    expect(keysInOrder).toEqual(['name', 'dur', 'nat', 'alfa', 'zeta']);
  });
});
