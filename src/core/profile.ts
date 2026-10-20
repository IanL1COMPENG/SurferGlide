import { BOARDS, RIDERS, COURSES, type Cosmetic, type CourseId } from './catalog.ts';
import { rewardFor, type RiderState, type RunRecord } from './game.ts';

export interface Profile {
  version: 1;
  name: string;
  credits: number;
  xp: number;
  board: string;
  rider: string;
  owned: string[];
  runs: RunRecord[];
  best: number;
  totalRings: number;
  settings: { volume: number; music: boolean; quality: 'high' | 'low'; reducedMotion: boolean };
}
const KEY = 'surfer-glide.profile.v1';
export const newProfile = (): Profile => ({
  version: 1,
  name: 'Wave Rider',
  credits: 0,
  xp: 0,
  board: 'daybreak',
  rider: 'kai',
  owned: ['daybreak', 'kai'],
  runs: [],
  best: 0,
  totalRings: 0,
  settings: {
    volume: 0.65,
    music: true,
    quality: 'high',
    reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  },
});
const validNum = (x: unknown, max = 1e12) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0;
export function loadProfile(): Profile {
  const fallback = newProfile();
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data || data.version !== 1) return fallback;
    const ids = [...BOARDS, ...RIDERS].map(x => x.id);
    const owned = Array.isArray(data.owned)
      ? data.owned.filter((x: unknown): x is string => typeof x === 'string' && ids.includes(x))
      : [];
    const settings = data.settings || {};
    return {
      ...fallback,
      name: typeof data.name === 'string' ? data.name.slice(0, 18) : fallback.name,
      credits: Math.floor(validNum(data.credits)),
      xp: Math.floor(validNum(data.xp)),
      best: Math.floor(validNum(data.best)),
      totalRings: validNum(data.totalRings),
      owned: [...new Set([...fallback.owned, ...owned])],
      board:
        BOARDS.some(x => x.id === data.board) && owned.includes(data.board)
          ? data.board
          : fallback.board,
      rider:
        RIDERS.some(x => x.id === data.rider) && owned.includes(data.rider)
          ? data.rider
          : fallback.rider,
      runs: Array.isArray(data.runs)
        ? data.runs
            .filter(
              (x: RunRecord) =>
                x &&
                typeof x.id === 'string' &&
                Number.isFinite(x.score) &&
                x.score >= 0 &&
                typeof x.date === 'string' &&
                COURSES.some(c => c.id === x.course),
            )
            .slice(0, 40)
        : [],
      settings: {
        volume: typeof settings.volume === 'number' ? validNum(settings.volume, 1) : 0.65,
        music: settings.music !== false,
        quality: settings.quality === 'low' ? 'low' : 'high',
        reducedMotion:
          typeof settings.reducedMotion === 'boolean'
            ? settings.reducedMotion
            : fallback.settings.reducedMotion,
      },
    };
  } catch {
    return fallback;
  }
}
export function saveProfile(profile: Profile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
export function buyOrEquip(
  profile: Profile,
  item: Cosmetic,
  kind: 'board' | 'rider',
): 'bought' | 'equipped' | 'insufficient' {
  if (!profile.owned.includes(item.id)) {
    if (profile.credits < item.price) return 'insufficient';
    profile.credits -= item.price;
    profile.owned.push(item.id);
    profile[kind] = item.id;
    return 'bought';
  }
  profile[kind] = item.id;
  return 'equipped';
}
export function completeRun(
  profile: Profile,
  state: RiderState,
  course: CourseId,
  id: string,
  multiplayer = false,
): RunRecord | undefined {
  if (!state.finished || profile.runs.some(x => x.id === id)) return;
  const record = {
    id,
    score: state.score,
    credits: rewardFor(state),
    course,
    date: new Date().toISOString(),
    landings: state.cleanLandings,
    combo: state.bestCombo,
    multiplayer,
  };
  profile.credits += record.credits;
  profile.xp += state.score;
  profile.best = Math.max(profile.best, state.score);
  profile.totalRings += state.pickups;
  profile.runs.unshift(record);
  profile.runs = profile.runs.slice(0, 40);
  return record;
}
