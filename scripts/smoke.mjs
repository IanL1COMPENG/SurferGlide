import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

const base = new URL(process.argv[2] || 'http://127.0.0.1:3000');
const health = await fetch(new URL('/healthz', base));
assert.equal(health.status, 200);
assert.equal((await health.json()).game, 'Surfer Glide');
const response = await fetch(base);
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /Surfer Glide/);
const bundle = html.match(/src="([^\"]+\.js)"/);
assert.ok(bundle, 'Expected a production JavaScript bundle. Run npm run build and npm start.');
const asset = await fetch(new URL(bundle[1], base));
assert.equal(asset.status, 200);
assert.match(asset.headers.get('content-type'), /javascript/);

const url = new URL('/ws', base);
url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
await new Promise((resolve, reject) => {
  const ws = new WebSocket(url, { origin: base.origin });
  const timer = setTimeout(() => {
    ws.terminate();
    reject(new Error('Multiplayer handshake timed out'));
  }, 6000);
  ws.on('error', error => {
    clearTimeout(timer);
    reject(error);
  });
  ws.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'welcome')
        ws.send(
          JSON.stringify({
            type: 'create',
            name: 'Smoke test',
            course: 'lagoon',
            board: 'daybreak',
            rider: 'kai',
          }),
        );
      if (message.type === 'room') {
        assert.equal(message.room.phase, 'lobby');
        assert.match(message.room.code, /^[A-F0-9]{6}$/);
        assert.equal(message.room.players.length, 1);
        clearTimeout(timer);
        ws.send(JSON.stringify({ type: 'leave' }));
        ws.close();
        resolve();
      }
    } catch (error) {
      clearTimeout(timer);
      ws.terminate();
      reject(error);
    }
  });
});
console.log(
  'Production smoke passed: health, HTML, built JavaScript, WebSocket handshake, room creation, and cleanup.',
);
