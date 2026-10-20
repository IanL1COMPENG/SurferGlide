import type { CourseId } from './catalog.ts';
import type { Input, RiderState } from './game.ts';
export interface RoomPlayer {
  id: string;
  name: string;
  board: string;
  rider: string;
  state: RiderState;
}
export interface RoomSnapshot {
  code: string;
  host: string;
  course: CourseId;
  phase: 'lobby' | 'countdown' | 'playing' | 'finished';
  players: RoomPlayer[];
  startAt: number;
  roundId: string;
}
export type ClientMessage =
  | { type: 'create'; name: string; board: string; rider: string; course: CourseId }
  | { type: 'join'; code: string; name: string; board: string; rider: string }
  | { type: 'start' }
  | { type: 'leave' }
  | { type: 'input'; input: Input };
export type ServerMessage =
  | { type: 'welcome'; id: string }
  | { type: 'room'; room: RoomSnapshot; now: number }
  | { type: 'error'; message: string };
