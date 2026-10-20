import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { multiplayerEndpoint, warmMultiplayer } from '../src/core/deployment.ts';
import { isAllowedOrigin, parseAllowedOrigins } from '../server/origins.ts';

test('deployment endpoints preserve local rooms and enforce safe HTTPS multiplayer', () => {
  assert.equal(
    multiplayerEndpoint('http://localhost:3000/?room=ABC123').href,
    'ws://localhost:3000/ws',
  );
  assert.equal(multiplayerEndpoint('https://game.vercel.app/').href, 'wss://game.vercel.app/ws');
  assert.equal(
    multiplayerEndpoint('https://game.vercel.app/', 'https://crew.onrender.com').href,
    'wss://crew.onrender.com/ws',
  );
  assert.equal(
    multiplayerEndpoint('https://game.vercel.app/', ' wss://crew.onrender.com/ws ').href,
    'wss://crew.onrender.com/ws',
  );
  for (const endpoint of [
    'ws://crew.example/ws',
    'ftp://crew.example/ws',
    'wss://name:secret@crew.example/ws',
    'wss://crew.example/ws?token=secret',
    'wss://crew.example/ws#secret',
  ]) {
    assert.throws(() => multiplayerEndpoint('https://game.vercel.app/', endpoint));
  }
});

test('only same-origin and explicitly permitted frontends can use crew rooms', () => {
  const allowed = parseAllowedOrigins(' https://game.vercel.app/, https://custom.example ');
  assert.ok(isAllowedOrigin('https://game.vercel.app', 'crew.onrender.com', allowed));
  assert.ok(isAllowedOrigin('http://localhost:3000', 'localhost:3000', allowed));
  assert.ok(isAllowedOrigin(undefined, 'crew.onrender.com', allowed));
  assert.equal(isAllowedOrigin('https://other.vercel.app', 'crew.onrender.com', allowed), false);
  assert.equal(
    isAllowedOrigin('https://game.vercel.app.evil.example', 'crew.onrender.com', allowed),
    false,
  );
  assert.equal(isAllowedOrigin('null', 'crew.onrender.com', allowed), false);
  for (const origin of [
    '*',
    'https://*.vercel.app',
    'https://game.vercel.app/path',
    'https://user:secret@example.com',
    'https://example.com?token=secret',
  ]) {
    assert.throws(() => parseAllowedOrigins(origin));
  }
});

test('a sleeping backend can return proxy errors or HTML before multiplayer is ready', async t => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    if (requests <= 2) {
      response.writeHead(requests === 1 ? 503 : 200, { 'Content-Type': 'text/html' });
      response.end('<p>Starting your service...</p>');
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true, game: 'Surfer Glide' }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const port = (server.address() as { port: number }).port;
  await warmMultiplayer(new URL(`ws://127.0.0.1:${port}/ws`), 2000, 10);
  assert.equal(requests, 3);
});

test('production backend accepts the Vercel frontend and rejects unrelated WebSocket origins', async t => {
  const origin = 'https://surfer-glide-test.vercel.app';
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--production'], {
    env: { ...process.env, PORT: '0', ALLOWED_ORIGINS: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  const port = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Backend did not start')), 10_000);
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.on('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Backend exited before readiness: ${code}`));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/healthz`, { headers: { Origin: origin } });
  assert.equal(health.headers.get('access-control-allow-origin'), origin);
  assert.equal(health.headers.get('vary'), 'Origin');
  assert.equal((await health.json()).game, 'Surfer Glide');
  const other = await fetch(`${base}/healthz`, { headers: { Origin: 'https://other.vercel.app' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error('Welcome timed out'));
    }, 3000);
    socket.on('error', reject);
    socket.once('message', raw => {
      try {
        assert.equal(JSON.parse(raw.toString()).type, 'welcome');
        clearTimeout(timeout);
        socket.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: 'https://other.vercel.app',
    });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error('Origin rejection timed out'));
    }, 3000);
    socket.on('open', () => reject(new Error('Unrelated origin was accepted')));
    socket.on('error', reject);
    socket.on('unexpected-response', (_request, response) => {
      clearTimeout(timeout);
      response.resume();
      socket.terminate();
      try {
        assert.equal(response.statusCode, 403);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});
