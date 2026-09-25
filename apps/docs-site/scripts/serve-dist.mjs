import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function resolveRequestedPath(rootDir, requestUrl) {
  const withoutQuery = requestUrl.split('?')[0];
  const decoded = decodeURIComponent(withoutQuery);
  const candidate = join(rootDir, decoded);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return join(candidate, 'index.html');
  }
  return candidate;
}

export function startStaticServer(rootDir, port = 0) {
  const server = createServer((request, response) => {
    const filePath = resolveRequestedPath(rootDir, request.url ?? '/');
    if (!existsSync(filePath) || !filePath.startsWith(rootDir)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': contentType });
    createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        server,
        url: `http://127.0.0.1:${boundPort}`,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}
