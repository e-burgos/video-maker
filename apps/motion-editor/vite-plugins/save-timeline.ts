/**
 * Plugin de Vite dev-only: `POST /__motion-editor/save-timeline` (DEC-73-003).
 * Middleware DELGADO: matchea ruta/método/Content-Type, acumula el body con
 * tope de 256 KB, parsea JSON y delega en el núcleo puro `saveTimeline`
 * (`save-timeline-core.ts`, testeado sin Vite). No existe en producción:
 * `apply: 'serve'` lo excluye del build.
 */
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import { saveTimeline, type SaveTimelineResult } from './save-timeline-core';

const ROUTE = '/__motion-editor/save-timeline';
/** Un timeline real pesa < 4 KB; 256 KB es un tope de sanidad generoso. */
const MAX_BODY_BYTES = 256 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function reject(
  res: ServerResponse,
  status: SaveTimelineResult['status'],
  error: string,
  message: string,
): void {
  sendJson(res, status, { ok: false, error, message });
}

export default function saveTimelinePlugin(): Plugin {
  return {
    name: 'motion-editor-save-timeline',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // La raíz de videos se deriva de la raíz de Vite (apps/motion-editor/),
      // no de process.cwd(): así es indiferente desde dónde se invoque `nx`.
      const videosRoot = join(server.config.root, 'src', 'videos');

      server.middlewares.use(ROUTE, (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          reject(res, 405, 'method_not_allowed', 'La ruta sólo admite POST.');
          return;
        }

        const contentType = req.headers['content-type'] ?? '';
        if (!contentType.toLowerCase().includes('application/json')) {
          reject(res, 415, 'unsupported_media_type', 'El Content-Type tiene que ser application/json.');
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        let settled = false;

        req.on('data', (chunk: Buffer) => {
          if (settled) return;
          received += chunk.length;
          if (received > MAX_BODY_BYTES) {
            settled = true;
            reject(res, 413, 'payload_too_large', 'El body supera el máximo de 256 KB.');
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on('end', () => {
          if (settled) return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          } catch {
            reject(res, 400, 'invalid_json', 'El body no parsea como JSON válido.');
            return;
          }

          const result = saveTimeline({ videosRoot, body: parsed });
          sendJson(res, result.status, result.body);
        });

        req.on('error', () => {
          if (settled) return;
          settled = true;
          reject(res, 500, 'write_failed', 'Error leyendo el request.');
        });
      });
    },
  };
}
