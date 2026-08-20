const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const port = Number(process.env.PORT || 3002);
const root = path.resolve(__dirname, 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
  response.setHeader('Cache-Control', extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).on('error', () => {
    if (!response.headersSent) response.statusCode = 500;
    response.end('Internal server error');
  }).pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  const requestedPath = path.resolve(root, `.${pathname}`);
  const isInsideRoot = requestedPath === root || requestedPath.startsWith(`${root}${path.sep}`);
  const candidate = isInsideRoot ? requestedPath : path.join(root, 'index.html');

  fs.stat(candidate, (error, stats) => {
    const filePath = !error && stats.isFile() ? candidate : path.join(root, 'index.html');
    fs.stat(filePath, (fallbackError) => {
      if (fallbackError) {
        response.writeHead(500);
        response.end('Frontend build is missing. Run npm run build.');
        return;
      }

      if (request.method === 'HEAD') {
        response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        response.end();
        return;
      }

      sendFile(response, filePath);
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[scorelo-frontend] listening on port ${port}`);
});