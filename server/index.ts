import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { attachRooms } from './rooms.ts';

const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const vite = production
  ? null
  : await (
      await import('vite')
    ).createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};
const server = createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, game: 'Surfer Glide' }));
    return;
  }
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    const dist = path.join(root, 'dist');
    const requested = path.resolve(dist, '.' + pathname);
    if (requested !== dist && !requested.startsWith(dist + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let file = requested;
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(dist, 'index.html');
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': file.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Build the game first with npm run build.');
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') return; // Vite owns its separate HMR websocket.
  if (
    req.headers.origin &&
    req.headers.origin !== `http://${req.headers.host}` &&
    req.headers.origin !== `https://${req.headers.host}`
  ) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
const multiplayer = attachRooms(wss);
server.listen(port, '0.0.0.0', () => {
  console.log(
    `\n  SURFER GLIDE\n  Local: http://localhost:${port}\n  Multiplayer: /ws\n  Mode: ${production ? 'production' : 'development'}\n`,
  );
});
async function shutdown() {
  multiplayer.close();
  wss.close();
  await vite?.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
