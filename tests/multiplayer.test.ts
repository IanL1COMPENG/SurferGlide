import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { attachRooms } from '../server/rooms.ts';
import type { RoomSnapshot, ServerMessage } from '../src/core/protocol.ts';

async function fixture() {
  const wss = new WebSocketServer({ port: 0 });
  await once(wss, 'listening');
  const app = attachRooms(wss);
  const port = (wss.address() as { port: number }).port;
  const sockets: WebSocket[] = [];
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(ws);
    const messages: ServerMessage[] = [];
    const subscribers = new Set<() => void>();
    ws.on('message', data => {
      messages.push(JSON.parse(data.toString()));
      for (const fn of subscribers) fn();
    });
    const wait = (predicate: (m: ServerMessage) => boolean) =>
      new Promise<ServerMessage>((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscribers.delete(check);
          reject(new Error('Timed out waiting for server message'));
        }, 6000);
        const check = () => {
          const index = messages.findIndex(predicate);
          if (index >= 0) {
            const message = messages.splice(index, 1)[0];
            clearTimeout(timeout);
            subscribers.delete(check);
            resolve(message);
          }
        };
        subscribers.add(check);
        check();
      });
    const welcome = await wait(m => m.type === 'welcome');
    return {
      ws,
      id: welcome.type === 'welcome' ? welcome.id : '',
      send: (data: object) => ws.send(JSON.stringify(data)),
      room: async (predicate: (r: RoomSnapshot) => boolean = () => true) => {
        const m = await wait(m => m.type === 'room' && predicate(m.room));
        return m.type === 'room' ? m.room : null!;
      },
      error: async () => {
        const m = await wait(m => m.type === 'error');
        return m.type === 'error' ? m.message : '';
      },
      wait,
    };
  }
  return {
    app,
    connect,
    close: async () => {
      for (const ws of sockets) ws.terminate();
      app.close();
      await new Promise<void>(resolve => wss.close(() => resolve()));
    },
  };
}
const identity = { name: 'Test Rider', board: 'daybreak', rider: 'kai' };

test('rooms isolate crews, validate codes, enforce host start, and migrate host on disconnect', async () => {
  const f = await fixture();
  try {
    const host = await f.connect();
    host.send({ type: 'create', ...identity, course: 'lagoon' });
    const room = await host.room();
    assert.match(room.code, /^[A-F0-9]{6}$/);
    assert.equal(room.host, host.id);
    host.send({ type: 'start' });
    assert.match(await host.error(), /friend/);
    const guest = await f.connect();
    guest.send({ type: 'join', ...identity, name: '<Guest>', code: 'ZZZZZZ' });
    assert.match(await guest.error(), /not found/);
    guest.send({ type: 'join', ...identity, name: '<Guest>', code: room.code.toLowerCase() });
    const joined = await guest.room();
    assert.equal(joined.players.length, 2);
    assert.equal(joined.players[1].name, 'Guest');
    guest.send({ type: 'start' });
    assert.match(await guest.error(), /host/);
    const outsider = await f.connect();
    outsider.send({ type: 'create', ...identity, course: 'sunset' });
    const other = await outsider.room();
    assert.notEqual(other.code, room.code);
    assert.equal(other.players.length, 1);
    host.ws.close();
    const migrated = await guest.room(r => r.host === guest.id);
    assert.equal(migrated.players.length, 1);
  } finally {
    await f.close();
  }
});

test('multiplayer starts a synchronized server simulation and ignores forged client scores', async () => {
  const f = await fixture();
  try {
    const host = await f.connect(),
      guest = await f.connect();
    host.send({ type: 'create', ...identity, course: 'lagoon' });
    const room = await host.room();
    guest.send({ type: 'join', ...identity, code: room.code });
    await guest.room();
    host.send({ type: 'start' });
    const countdown = await host.room(r => r.phase === 'countdown');
    assert.ok(countdown.startAt > Date.now());
    host.send({ type: 'input', input: { steer: Infinity, score: 999999999 } });
    const playing = await guest.room(r => r.phase === 'playing' && r.players[0].state.time > 0.05);
    assert.equal(playing.players[0].state.score, 0);
    assert.ok(playing.players[0].state.time < 1);
    assert.equal(playing.players[0].state.time, playing.players[1].state.time);
    const late = await f.connect();
    late.send({ type: 'join', ...identity, code: room.code });
    assert.match(await late.error(), /on the water/);
  } finally {
    await f.close();
  }
});

test('a room holds at most six riders and malformed JSON does not crash the server', async () => {
  const f = await fixture();
  try {
    const host = await f.connect();
    host.send({ type: 'create', ...identity, course: 'arctic' });
    const room = await host.room();
    for (let i = 0; i < 5; i++) {
      const guest = await f.connect();
      guest.send({ type: 'join', ...identity, code: room.code });
      await guest.room();
    }
    const overflow = await f.connect();
    overflow.send({ type: 'join', ...identity, code: room.code });
    assert.match(await overflow.error(), /full crew/);
    overflow.ws.send('{not valid');
    assert.match(await overflow.error(), /could not be read/);
    assert.equal(f.app.rooms.get(room.code)?.snapshot.players.length, 6);
  } finally {
    await f.close();
  }
});
