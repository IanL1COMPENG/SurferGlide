import type { CourseId } from './catalog.ts';

export const FIXED_DT = 1 / 60;
export const RUN_DURATION = 90;
export const SPEED = 19;
export const TAU = Math.PI * 2;
export interface Input {
  steer: number;
  jump: boolean;
  spin: boolean;
  grab: boolean;
  flip: boolean;
}
export const neutralInput = (): Input => ({
  steer: 0,
  jump: false,
  spin: false,
  grab: false,
  flip: false,
});
export interface RunEvent {
  id: number;
  type: 'launch' | 'land' | 'wipeout' | 'pickup';
  text: string;
  points: number;
}
export interface RiderState {
  x: number;
  vx: number;
  y: number;
  vy: number;
  distance: number;
  time: number;
  charge: number;
  jumpHeld: boolean;
  airborne: boolean;
  spin: number;
  flip: number;
  grabTime: number;
  maxHeight: number;
  launchBonus: boolean;
  cooldown: number;
  wipeout: number;
  score: number;
  combo: number;
  bestCombo: number;
  cleanLandings: number;
  wipeouts: number;
  pickups: number;
  lastPickup: number;
  lastObstacle: number;
  event: RunEvent;
  finished: boolean;
}
export function createRun(): RiderState {
  return {
    x: 0,
    vx: 0,
    y: 0,
    vy: 0,
    distance: 0,
    time: 0,
    charge: 0,
    jumpHeld: false,
    airborne: false,
    spin: 0,
    flip: 0,
    grabTime: 0,
    maxHeight: 0,
    launchBonus: false,
    cooldown: 0,
    wipeout: 0,
    score: 0,
    combo: 1,
    bestCombo: 1,
    cleanLandings: 0,
    wipeouts: 0,
    pickups: 0,
    lastPickup: -1,
    lastObstacle: -1,
    event: { id: 0, type: 'land', text: '', points: 0 },
    finished: false,
  };
}
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function sanitizeInput(data: Partial<Input> | null | undefined): Input {
  return {
    steer:
      typeof data?.steer === 'number' && Number.isFinite(data.steer) ? clamp(data.steer, -1, 1) : 0,
    jump: data?.jump === true,
    spin: data?.spin === true,
    grab: data?.grab === true,
    flip: data?.flip === true,
  };
}
export function trackObject(index: number, seed: number) {
  const n = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  const random = n - Math.floor(n);
  return {
    distance: 80 + index * 66,
    x: (random * 2 - 1) * 7.4,
    type: index % 4 === 3 ? 'buoy' : 'ring',
  };
}
function emit(s: RiderState, type: RunEvent['type'], text: string, points = 0) {
  s.event = { id: s.event.id + 1, type, text, points };
}
function launch(s: RiderState, force: number, wake: boolean) {
  s.airborne = true;
  s.vy = force;
  s.y = 0.05;
  s.spin = 0;
  s.flip = 0;
  s.grabTime = 0;
  s.maxHeight = 0;
  s.launchBonus = wake;
  s.charge = 0;
  emit(s, 'launch', wake ? 'WAKE BOOST' : 'GET SOME AIR');
}
export function stepRun(s: RiderState, input: Input, dt = FIXED_DT, seed = 41) {
  if (s.finished) return;
  s.time = Math.min(RUN_DURATION, s.time + dt);
  s.distance += SPEED * dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  const oldX = s.x;
  if (s.wipeout > 0) {
    s.wipeout = Math.max(0, s.wipeout - dt);
    s.vx *= Math.exp(-4 * dt);
    s.y = 0;
    s.airborne = false;
  } else {
    const steer = clamp(input.steer, -1, 1);
    s.vx += (steer * (s.airborne ? 7.5 : 11) - s.vx) * (1 - Math.exp(-5 * dt));
    s.x = clamp(s.x + s.vx * dt, -10.5, 10.5);
    if (!s.airborne) {
      if (input.jump) s.charge = Math.min(1, s.charge + dt * 1.15);
      const crossedWake = Math.abs(oldX) < 4.1 && Math.abs(s.x) >= 4.1 && Math.abs(s.vx) > 4;
      const release = s.jumpHeld && !input.jump;
      if (s.cooldown === 0 && (crossedWake || release)) {
        const wake = crossedWake || Math.abs(Math.abs(s.x) - 4.1) < 1.9;
        launch(s, 6 + s.charge * 3 + (wake ? 2 : 0), wake);
      }
    } else {
      s.vy -= 12 * dt;
      s.y += s.vy * dt;
      s.maxHeight = Math.max(s.maxHeight, s.y);
      if (input.spin) s.spin += 5.4 * dt;
      else s.spin += (Math.round(s.spin / Math.PI) * Math.PI - s.spin) * (1 - Math.exp(-12 * dt));
      if (input.flip) s.flip += 5.1 * dt;
      else s.flip += (Math.round(s.flip / TAU) * TAU - s.flip) * (1 - Math.exp(-12 * dt));
      if (input.grab) s.grabTime += dt;
      if (s.y <= 0) {
        s.y = 0;
        s.airborne = false;
        s.cooldown = 0.65;
        const spinError = Math.abs(s.spin - Math.round(s.spin / Math.PI) * Math.PI);
        const flipError = Math.abs(s.flip - Math.round(s.flip / TAU) * TAU);
        if (spinError > 0.65 || flipError > 0.8) crash(s);
        else {
          const halfSpins = Math.round(s.spin / Math.PI);
          const flips = Math.round(s.flip / TAU);
          const grab = s.grabTime > 0.2;
          const base =
            100 + halfSpins * 150 + flips * 400 + (grab ? 150 : 0) + (s.launchBonus ? 100 : 0);
          const points = Math.round(base * s.combo);
          const names = [
            flips ? `${flips > 1 ? 'Double ' : ''}Backflip` : '',
            halfSpins ? `${halfSpins * 180}°` : '',
            grab ? 'Indy Grab' : '',
          ].filter(Boolean);
          emit(s, 'land', names.join(' + ') || (s.launchBonus ? 'Wake Air' : 'Clean Air'), points);
          s.score += points;
          s.cleanLandings++;
          s.combo = Math.min(5, s.combo + 0.5);
          s.bestCombo = Math.max(s.combo, s.bestCombo);
        }
        s.spin = 0;
        s.flip = 0;
      }
    }
    const nearIndex = Math.round((s.distance - 80) / 66);
    for (let i = Math.max(0, nearIndex - 1); i <= nearIndex + 1; i++) {
      const object = trackObject(i, seed);
      if (Math.abs(object.distance - s.distance) > 1.2) continue;
      if (
        object.type === 'ring' &&
        i !== s.lastPickup &&
        Math.abs(object.x - s.x) < 1.6 &&
        s.y < 3.7
      ) {
        s.pickups++;
        s.lastPickup = i;
        s.score += 100;
        emit(s, 'pickup', 'FLOW RING', 100);
      }
      if (
        object.type === 'buoy' &&
        i !== s.lastObstacle &&
        Math.abs(object.x - s.x) < 1.05 &&
        s.y < 0.9
      ) {
        s.lastObstacle = i;
        crash(s);
      }
    }
  }
  s.jumpHeld = input.jump;
  if (s.time >= RUN_DURATION) s.finished = true;
}
function crash(s: RiderState) {
  s.wipeout = 1.6;
  s.combo = 1;
  s.wipeouts++;
  s.spin = 0;
  s.flip = 0;
  s.charge = 0;
  emit(s, 'wipeout', 'WIPEOUT — SHAKE IT OFF');
}
export function rewardFor(s: Pick<RiderState, 'score' | 'pickups' | 'cleanLandings'>) {
  return Math.floor(s.score / 10) + s.pickups * 15 + (s.cleanLandings >= 5 ? 100 : 0);
}
export interface RunRecord {
  id: string;
  score: number;
  credits: number;
  course: CourseId;
  date: string;
  landings: number;
  combo: number;
  multiplayer: boolean;
}
