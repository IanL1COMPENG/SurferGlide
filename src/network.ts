import type { ClientMessage, RoomSnapshot, ServerMessage } from './core/protocol.ts';
import { multiplayerEndpoint, warmMultiplayer } from './core/deployment.ts';

export class Multiplayer {
  id = '';
  room: RoomSnapshot | null = null;
  offset = 0;
  socket: WebSocket | null = null;
  onRoom: (room: RoomSnapshot) => void = () => {};
  onError: (message: string) => void = () => {};
  onDisconnect: () => void = () => {};
  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN && this.id) return;
    const endpoint = multiplayerEndpoint(location.href, import.meta.env.VITE_MULTIPLAYER_URL);
    if (endpoint.host !== location.host) {
      // Free Node hosts can sleep. Wake the server before the short WS handshake.
      // This runs only when a player explicitly creates or joins a room.
      await warmMultiplayer(endpoint);
    }
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('The multiplayer server is taking too long to respond.'));
      }, 8000);
      socket.onmessage = event => {
        const data: ServerMessage = JSON.parse(event.data);
        if (data.type === 'welcome') {
          this.id = data.id;
          clearTimeout(timeout);
          settled = true;
          resolve();
        }
        if (data.type === 'room') {
          this.offset = data.now - Date.now();
          this.room = data.room;
          this.onRoom(data.room);
        }
        if (data.type === 'error') this.onError(data.message);
      };
      socket.onerror = () => {
        if (!settled) {
          clearTimeout(timeout);
          reject(
            new Error('Multiplayer is unavailable. Check the multiplayer server and try again.'),
          );
        }
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        this.id = '';
        const hadRoom = !!this.room;
        this.room = null;
        if (!settled) reject(new Error('Could not connect to multiplayer.'));
        if (hadRoom) this.onDisconnect();
      };
    });
  }
  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  leave() {
    this.send({ type: 'leave' });
    this.room = null;
  }
}
