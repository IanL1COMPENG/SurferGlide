import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { BOARDS, RIDERS, COURSES } from '../src/core/catalog.ts';
import {
  createRun,
  FIXED_DT,
  neutralInput,
  sanitizeInput,
  stepRun,
  type Input,
} from '../src/core/game.ts';
import type { ClientMessage, RoomSnapshot, ServerMessage } from '../src/core/protocol.ts';

interface Client {
  id: string;
  ws: WebSocket;
  code: string | null;
  input: Input;
  alive: boolean;
  messages: number;
  window: number;
  lastInput: number;
}
interface Room {
  snapshot: RoomSnapshot;
  updated: number;
  finishedAt: number;
}
export function attachRooms(wss: WebSocketServer) {
  const clients = new Map<string, Client>();
  const rooms = new Map<string, Room>();
  const send = (client: Client, message: ServerMessage) => {
    if (client.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 256_000)
      client.ws.send(JSON.stringify(message));
  };
  const broadcast = (room: Room) => {
    const data = JSON.stringify({ type: 'room', room: room.snapshot, now: Date.now() });
    for (const player of room.snapshot.players) {
      const client = clients.get(player.id);
      if (client?.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 256_000)
        client.ws.send(data);
    }
  };
  const leave = (client: Client) => {
    const room = rooms.get(client.code || '');
    client.code = null;
    client.input = neutralInput();
    if (!room) return;
    room.snapshot.players = room.snapshot.players.filter(p => p.id !== client.id);
    if (room.snapshot.players.length === 0) {
      rooms.delete(room.snapshot.code);
      return;
    }
    if (room.snapshot.host === client.id) room.snapshot.host = room.snapshot.players[0].id;
    broadcast(room);
  };
  wss.on('connection', ws => {
    if (clients.size >= 240) {
      ws.close(1013, 'Server full. Try again shortly.');
      return;
    }
    const client: Client = {
      id: randomUUID(),
      ws,
      code: null,
      input: neutralInput(),
      alive: true,
      messages: 0,
      window: Date.now(),
      lastInput: Date.now(),
    };
    clients.set(client.id, client);
    send(client, { type: 'welcome', id: client.id });
    ws.on('pong', () => {
      client.alive = true;
    });
    ws.on('message', (raw, binary) => {
      if (binary || raw.toString().length > 2048) {
        ws.close(1008, 'Invalid message');
        return;
      }
      if (Date.now() - client.window > 1000) {
        client.window = Date.now();
        client.messages = 0;
      }
      if (++client.messages > 90) {
        ws.close(1008, 'Too many messages');
        return;
      }
      let data: ClientMessage;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        send(client, { type: 'error', message: 'That message could not be read.' });
        return;
      }
      if (!data || typeof data !== 'object') return;
      if (data.type === 'leave') {
        leave(client);
        return;
      }
      if (data.type === 'input') {
        client.input = sanitizeInput(data.input);
        client.lastInput = Date.now();
        return;
      }
      if (data.type === 'create' || data.type === 'join') {
        if (client.code) {
          send(client, { type: 'error', message: 'Leave your current room first.' });
          return;
        }
        const player = {
          id: client.id,
          name:
            typeof data.name === 'string'
              ? data.name
                  .replace(/[\p{C}<>]/gu, '')
                  .trim()
                  .slice(0, 18) || 'Wave Rider'
              : 'Wave Rider',
          board: BOARDS.some(x => x.id === data.board) ? data.board : 'daybreak',
          rider: RIDERS.some(x => x.id === data.rider) ? data.rider : 'kai',
          state: createRun(),
        };
        let room: Room | undefined;
        if (data.type === 'create') {
          if (rooms.size >= 80) {
            send(client, { type: 'error', message: 'All docks are full. Try again in a moment.' });
            return;
          }
          let code: string;
          do {
            code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
          } while (rooms.has(code));
          const course = COURSES.find(c => c.id === data.course)?.id || 'lagoon';
          room = {
            snapshot: {
              code,
              host: client.id,
              course,
              phase: 'lobby',
              players: [],
              startAt: 0,
              roundId: randomUUID(),
            },
            updated: Date.now(),
            finishedAt: 0,
          };
          rooms.set(code, room);
        } else {
          const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
          room = rooms.get(code);
          if (!room) {
            send(client, {
              type: 'error',
              message: 'Room not found. Double-check your six-character code.',
            });
            return;
          }
          if (room.snapshot.phase !== 'lobby' && room.snapshot.phase !== 'finished') {
            send(client, {
              type: 'error',
              message: 'This crew is on the water. Join after their run.',
            });
            return;
          }
          if (room.snapshot.players.length >= 6) {
            send(client, { type: 'error', message: 'This room has a full crew of six.' });
            return;
          }
        }
        room.snapshot.players.push(player);
        client.code = room.snapshot.code;
        room.updated = Date.now();
        broadcast(room);
        return;
      }
      if (data.type === 'start') {
        const room = rooms.get(client.code || '');
        if (!room || room.snapshot.host !== client.id) {
          send(client, { type: 'error', message: 'Only the room host can start the run.' });
          return;
        }
        if (!['lobby', 'finished'].includes(room.snapshot.phase)) return;
        if (room.snapshot.players.length < 2) {
          send(client, { type: 'error', message: 'Invite at least one friend to start.' });
          return;
        }
        room.snapshot.phase = 'countdown';
        room.snapshot.startAt = Date.now() + 3500;
        room.snapshot.roundId = randomUUID();
        for (const p of room.snapshot.players) {
          p.state = createRun();
          const c = clients.get(p.id);
          if (c) c.input = neutralInput();
        }
        room.updated = Date.now();
        room.finishedAt = 0;
        broadcast(room);
      }
    });
    ws.on('error', () => ws.terminate());
    ws.on('close', () => {
      leave(client);
      clients.delete(client.id);
    });
  });
  let last = performance.now(),
    accumulator = 0,
    frames = 0;
  const tick = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (accumulator >= FIXED_DT) {
      for (const room of rooms.values()) {
        const s = room.snapshot;
        if (s.phase === 'countdown' && Date.now() >= s.startAt) s.phase = 'playing';
        if (s.phase !== 'playing') continue;
        for (const p of s.players) {
          const c = clients.get(p.id);
          stepRun(
            p.state,
            c && Date.now() - c.lastInput < 750 ? c.input : neutralInput(),
            FIXED_DT,
            COURSES.find(x => x.id === s.course)!.seed,
          );
        }
        if (s.players.every(p => p.state.finished)) {
          s.phase = 'finished';
          room.finishedAt = Date.now();
          broadcast(room);
        }
      }
      accumulator -= FIXED_DT;
    }
    if (++frames % 4 === 0)
      for (const room of rooms.values())
        if (['countdown', 'playing'].includes(room.snapshot.phase)) broadcast(room);
  }, 1000 / 60);
  const heartbeat = setInterval(() => {
    for (const c of clients.values()) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
    for (const [code, room] of rooms) {
      if (
        Date.now() - (room.finishedAt || room.updated) > 60 * 60 * 1000 &&
        room.snapshot.phase !== 'playing'
      ) {
        for (const p of room.snapshot.players) {
          const c = clients.get(p.id);
          if (c) c.ws.close(1000, 'Room expired');
        }
        rooms.delete(code);
      }
    }
  }, 30_000);
  return {
    rooms,
    clients,
    close: () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      for (const c of clients.values()) c.ws.terminate();
    },
  };
}
