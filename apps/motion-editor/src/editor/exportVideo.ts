/**
 * Exportador de video standalone (sin host).
 *
 * Recorre el timeline frame por frame usando el mismo protocolo que usa el
 * editor: despacha `data-om-seek-to-time-frame` con `sync: true` sobre la raíz
 * exportable (el <svg data-om-exportable-video-with-duration-secs>), serializa
 * ese frame y lo encodea.
 *
 * Dos caminos:
 *  1. WebCodecs (`VideoEncoder`) + `mp4-muxer` si está instalado → .mp4
 *  2. Fallback sin dependencias: canvas.captureStream() + MediaRecorder → .webm
 *
 * Requisito del motor: todo lo visible se renderiza desde el reloj de la escena
 * (nada desde useEffect / rAF propio), si no el frame exportado sale viejo.
 */

export interface ExportOptions {
  fps?: number;
  filename?: string;
  /** 0 → 1 */
  onProgress?: (p: number, frame: number, total: number) => void;
  signal?: AbortSignal;
}

export type ExportableRoot = SVGSVGElement;

export function findExportableRoot(): ExportableRoot | null {
  return document.querySelector<ExportableRoot>(
    '[data-om-exportable-video-with-duration-secs]',
  );
}

export function getDuration(root: ExportableRoot): number {
  return Number(root.getAttribute('data-om-exportable-video-with-duration-secs')) || 0;
}

/* ── Seek ──────────────────────────────────────────────────────────────── */

/** Mueve el playhead. `sync` fuerza el commit de React antes de volver. */
export function seek(root: Element, time: number, opts: { sync?: boolean; playing?: boolean } = {}) {
  root.dispatchEvent(
    new CustomEvent('data-om-seek-to-time-frame', {
      detail: { time, sync: opts.sync === true, playing: opts.playing === true },
    }),
  );
}

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function settle(root: ExportableRoot) {
  // Si el motor anuncia sync-seek, el DOM ya refleja el frame al volver del
  // dispatch. Si no, hay que esperar dos refrescos para que caiga el commit.
  if (root.getAttribute('data-om-sync-seek') === 'true') return;
  await raf();
  await raf();
}

/* ── Serialización del frame ───────────────────────────────────────────── */

const dataUrlCache = new Map<string, string>();

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const cached = dataUrlCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  const blob = await res.blob();
  const out = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  dataUrlCache.set(url, out);
  return out;
}

/**
 * Pre-cachea todas las imágenes del stage como data: URL. Un <img src="/x.png">
 * dentro de un foreignObject NO carga cuando el svg se serializa aparte.
 */
export async function preloadImages(root: ExportableRoot) {
  const urls = new Set<string>();
  root.querySelectorAll('img[src]').forEach((el) => {
    const src = (el as HTMLImageElement).getAttribute('src');
    if (src && !src.startsWith('data:')) urls.add(new URL(src, window.location.href).href);
  });
  await Promise.all([...urls].map((u) => toDataUrl(u).catch(() => '')));
}

export function serializeFrame(root: ExportableRoot, width: number, height: number): string {
  const clone = root.cloneNode(true) as ExportableRoot;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  clone.removeAttribute('style'); // el stage se escala en pantalla; el export no
  
  // Strip media elements that cannot be rendered to canvas and taint the source
  clone.querySelectorAll('video, audio, iframe, embed, object').forEach(el => el.remove());

  clone.querySelectorAll('img[src]').forEach((el) => {
    const img = el as HTMLImageElement;
    const srcAttr = img.getAttribute('src') || '';
    if (srcAttr.startsWith('data:')) return;
    const abs = new URL(srcAttr, window.location.href).href;
    const data = dataUrlCache.get(abs);
    if (data) {
      img.setAttribute('src', data);
    } else {
      // Si la imagen falló en cargar o no se pre-cacheó, la reemplazamos con
      // un píxel transparente para evitar el SecurityError de canvas tainted.
      img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    }
  });
  return new XMLSerializer().serializeToString(clone);
}

/**
 * Rasteriza el svg serializado sobre el canvas.
 *
 * IMPORTANTE — por qué `data:` y no `blob:`:
 * el stage es un `<svg><foreignObject>` con HTML adentro. Chrome marca el
 * canvas como *tainted* (origin-unclean) al dibujar un svg con `foreignObject`
 * que viene de una `blob:` URL, y ahí `getImageData`/`toDataURL`/`new
 * VideoFrame(canvas)` tiran `SecurityError`. La misma imagen servida como
 * `data:` URL NO ensucia el canvas. Verificado en Chrome 148:
 *
 *   blob: + foreignObject → TAINTED · data: + foreignObject → clean
 *
 * No cambiar a `createObjectURL` por "performance": rompe el export entero.
 * (Codificar la data: URL cuesta ~2 ms por frame en 1920×1080.)
 */
async function drawFrame(
  ctx: CanvasRenderingContext2D,
  svgText: string,
  width: number,
  height: number,
) {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const img = new Image();
  img.decoding = 'sync';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo rasterizar el frame'));
    img.src = url;
  });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
}

/**
 * Falla temprano y con un mensaje útil si el canvas quedó tainted: sin esto el
 * error recién aparece en `new VideoFrame(canvas)` con un stack que no dice
 * qué recurso lo ensució.
 */
function assertOriginClean(ctx: CanvasRenderingContext2D) {
  try {
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    throw new Error(
      'El canvas quedó tainted: algún recurso del stage no es origin-clean. ' +
        'Revisá que toda imagen/fuente esté inlineada como data: URL y que el ' +
        'svg del frame se cargue desde data: (no blob:).',
    );
  }
}

/* ── Export ────────────────────────────────────────────────────────────── */

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function exportVideo(
  root: ExportableRoot = findExportableRoot() as ExportableRoot,
  { fps = 30, filename = 'video', onProgress, signal }: ExportOptions = {},
): Promise<Blob> {
  if (!root) throw new Error('No hay raíz exportable en el documento');

  const width = Number(root.getAttribute('width')) || 1920;
  const height = Number(root.getAttribute('height')) || 1080;
  const duration = getDuration(root);
  const total = Math.max(1, Math.round(duration * fps));

  await preloadImages(root);
  // Las fuentes se inlinean solas dentro del svg; esperamos el flag.
  for (let i = 0; i < 40 && root.getAttribute('data-om-fonts-inlined') !== 'true'; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

  const mp4 = await tryMp4Encoder(width, height, fps);
  const rec = mp4 ? null : startRecorder(canvas, fps);

  for (let f = 0; f < total; f++) {
    if (signal?.aborted) throw new DOMException('Export cancelado', 'AbortError');
    const t = Math.min(duration, f / fps);
    seek(root, t, { sync: true });
    await settle(root);
    await preloadImages(root);
    await drawFrame(ctx, serializeFrame(root, width, height), width, height);
    if (f === 0) assertOriginClean(ctx);
    if (mp4) await mp4.addFrame(canvas, (f * 1e6) / fps);
    else if (rec) rec.frame();
    onProgress?.((f + 1) / total, f + 1, total);
    if (f % 4 === 3) await raf(); // deja respirar al main thread
  }

  let blob: Blob;
  if (mp4) {
    blob = await mp4.finish();
  } else if (rec) {
    blob = await rec.finish();
  } else {
    throw new Error('No encoder/recorder available');
  }
  download(blob, `${filename}.${mp4 ? 'mp4' : 'webm'}`);
  return blob;
}

/* ── Camino 1: WebCodecs + mp4-muxer (opcional) ────────────────────────── */

interface Mp4Sink {
  addFrame(canvas: HTMLCanvasElement, timestampUs: number): Promise<void>;
  finish(): Promise<Blob>;
}

async function tryMp4Encoder(width: number, height: number, fps: number): Promise<Mp4Sink | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Muxer: any, ArrayBufferTarget: any;
  try {
    // Dependencia opcional: `pnpm add mp4-muxer`. Sin ella cae al webm.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ 'mp4-muxer');
    Muxer = mod.Muxer;
    ArrayBufferTarget = mod.ArrayBufferTarget;
  } catch {
    return null;
  }

  // Negociamos el perfil antes de comprometernos al camino mp4: si el equipo
  // no soporta H.264 High@L4 (o el tamaño pedido), caemos al webm en vez de
  // reventar a mitad del render.
  const base = { width, height, bitrate: 12_000_000, framerate: fps };
  let config: VideoEncoderConfig | null = null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e01f']) {
    const candidate = { codec, ...base };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(candidate);
      if (supported) {
        config = candidate;
        break;
      }
    } catch {
      /* perfil inválido en este runtime: probamos el siguiente */
    }
  }
  if (!config) return null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });
  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e as Error;
      console.error('[export]', e);
    },
  });
  encoder.configure(config);

  let n = 0;
  return {
    async addFrame(canvas, timestampUs) {
      if (encodeError) throw encodeError;
      const frame = new VideoFrame(canvas, { timestamp: timestampUs });
      encoder.encode(frame, { keyFrame: n % (fps * 2) === 0 });
      frame.close();
      n++;
      if (encoder.encodeQueueSize > 8) {
        await new Promise<void>((r) => {
          const wait = () =>
            encoder.encodeQueueSize <= 4 ? r() : setTimeout(wait, 8);
          wait();
        });
      }
    },
    async finish() {
      await encoder.flush();
      encoder.close();
      muxer.finalize();
      return new Blob([target.buffer], { type: 'video/mp4' });
    },
  };
}

/* ── Camino 2: MediaRecorder con frames a demanda (cero deps) ──────────── */

function startRecorder(canvas: HTMLCanvasElement, fps: number) {
  // captureStream(0) → sólo captura cuando pedimos requestFrame(): el video
  // sale a fps exacto aunque el render de cada frame tarde más.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  ) || 'video/webm';
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  void fps;

  return {
    frame() {
      track.requestFrame();
    },
    finish(): Promise<Blob> {
      return new Promise((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
        rec.stop();
        track.stop();
      });
    },
  };
}
