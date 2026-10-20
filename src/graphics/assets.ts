import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { BOARDS, RIDERS } from '../core/catalog.ts';
import type { RiderState } from '../core/game.ts';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
export const MODEL_ROOT = `${import.meta.env?.BASE_URL ?? '/'}models/`;
export function loadAsset(name: string): Promise<GLTF> {
  if (!cache.has(name)) {
    cache.set(
      name,
      loader.loadAsync(`${MODEL_ROOT}${name}.glb`).catch(error => {
        cache.delete(name);
        throw error;
      }),
    );
  }
  return cache.get(name)!;
}
export function cloneAsset(gltf: GLTF): THREE.Group {
  const result = clone(gltf.scene) as THREE.Group;
  result.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const copy = (material: THREE.Material) => {
      const cloned = material.clone();
      if (cloned instanceof THREE.MeshStandardMaterial) {
        cloned.roughness = Math.max(0.25, cloned.roughness);
        cloned.envMapIntensity = 0.6;
      }
      return cloned;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(copy)
      : copy(object.material);
    object.frustumCulled = false;
  });
  return result;
}
export function disposeInstance(group: THREE.Object3D) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

export const BOARD_EFFECTS: Record<
  string,
  { name: string; color: string; secondary: string; symbol: string; description: string }
> = {
  daybreak: {
    name: 'Sunbeam spray',
    color: '#dbff73',
    secondary: '#ffffff',
    symbol: '☀',
    description: 'A fresh lime shimmer in every turn.',
  },
  coral: {
    name: 'Coral confetti',
    color: '#ff527d',
    secondary: '#ffcd59',
    symbol: '✿',
    description: 'Warm sparks and a candy-colored wake.',
  },
  tidal: {
    name: 'Bubble rush',
    color: '#49dfff',
    secondary: '#a5fff6',
    symbol: '◌',
    description: 'A trail of luminous ocean bubbles.',
  },
  orchid: {
    name: 'Cosmic drift',
    color: '#c77aff',
    secondary: '#66f7ff',
    symbol: '✧',
    description: 'Leave a little galaxy behind you.',
  },
  sunset: {
    name: 'Golden hour',
    color: '#ffce45',
    secondary: '#fff2a2',
    symbol: '✦',
    description: 'Golden starbursts for a legendary line.',
  },
  stealth: {
    name: 'Neon voltage',
    color: '#73ff93',
    secondary: '#a7eaff',
    symbol: 'ϟ',
    description: 'Electric green rails. High-voltage style.',
  },
};

export class RiderAvatar {
  readonly root = new THREE.Group();
  readonly trickPivot = new THREE.Group();
  readonly boardAnchor = new THREE.Group();
  readonly characterAnchor = new THREE.Group();
  readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  boardId = 'daybreak';
  riderId = 'kai';
  ready: Promise<void> = Promise.resolve();
  loaded = false;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentClip = '';
  private ticket = 0;
  private wasAirborne = false;
  private impact = 0;
  private lastEvent = -1;
  constructor(scene: THREE.Scene) {
    this.trickPivot.position.y = 1.1;
    this.boardAnchor.position.y = -1.1;
    this.characterAnchor.position.y = -1.1;
    this.trickPivot.add(this.boardAnchor, this.characterAnchor);
    this.root.add(this.trickPivot);
    scene.add(this.root);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 36),
      new THREE.MeshBasicMaterial({
        color: '#00517e',
        transparent: true,
        opacity: 0.19,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }
  load(boardId: string, riderId: string): Promise<void> {
    if (this.loaded && boardId === this.boardId && riderId === this.riderId) return this.ready;
    const ticket = ++this.ticket;
    this.boardId = BOARDS.some(x => x.id === boardId) ? boardId : 'daybreak';
    this.riderId = RIDERS.some(x => x.id === riderId) ? riderId : 'kai';
    this.ready = Promise.all([
      loadAsset(`board-${this.boardId}`),
      loadAsset(`rider-${this.riderId}`),
    ]).then(([board, rider]) => {
      if (ticket !== this.ticket) return;
      this.mixer?.stopAllAction();
      if (this.mixer) this.mixer.uncacheRoot(this.characterAnchor.children[0]);
      this.boardAnchor.children.forEach(disposeInstance);
      this.characterAnchor.children.forEach(disposeInstance);
      this.boardAnchor.clear();
      this.characterAnchor.clear();
      this.actions.clear();
      this.currentClip = '';
      this.boardAnchor.add(cloneAsset(board));
      const character = cloneAsset(rider);
      this.characterAnchor.add(character);
      this.mixer = new THREE.AnimationMixer(character);
      for (const clip of rider.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
      this.play('Cruise', 0);
      this.loaded = true;
    });
    return this.ready;
  }
  private play(name: string, fade = 0.18) {
    if (this.currentClip === name || !this.actions.has(name)) return;
    const previous = this.actions.get(this.currentClip);
    const next = this.actions.get(name)!;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    if (previous) {
      previous.fadeOut(fade);
      next.fadeIn(fade);
    }
    this.currentClip = name;
  }
  update(
    state: RiderState,
    dt: number,
    surface: number,
    time: number,
    menu = false,
    victory = false,
  ) {
    const alpha = 1 - Math.exp(-dt * 20);
    this.root.position.x += (state.x - this.root.position.x) * alpha;
    this.root.position.y += (surface + state.y + 0.025 - this.root.position.y) * alpha;
    if (state.airborne && !this.wasAirborne) this.impact = 0.2;
    if (state.event?.id !== this.lastEvent) {
      this.lastEvent = state.event?.id ?? -1;
      if (state.event?.type === 'land') this.impact = -0.24;
    }
    this.impact = this.impact > 0 ? Math.max(0, this.impact - dt) : Math.min(0, this.impact + dt);
    let animation =
      state.wipeout > 0
        ? 'Wipeout'
        : victory
          ? 'Victory'
          : state.airborne
            ? this.impact > 0
              ? 'Pop'
              : state.grabTime > 0.1
                ? 'IndyGrab'
                : 'Air'
            : this.impact < 0
              ? 'Land'
              : state.vx < -2
                ? 'CarveLeft'
                : state.vx > 2
                  ? 'CarveRight'
                  : 'Cruise';
    if (menu && !victory) animation = 'Cruise';
    this.play(animation);
    this.mixer?.update(dt);
    const yaw = menu ? Math.PI * 0.78 + Math.sin(time * 0.32) * 0.08 : -state.vx * 0.025;
    const lean = state.wipeout > 0 ? 1.65 : (state.airborne ? -0.018 : -0.033) * state.vx;
    this.root.rotation.set(0, yaw, lean);
    this.trickPivot.rotation.set(state.flip || 0, state.spin || 0, 0);
    this.boardAnchor.rotation.z = state.airborne ? Math.sin(time * 4) * 0.035 : -state.vx * 0.008;
    if (state.wipeout > 0) this.root.position.y = surface - 0.35;
    this.shadow.position.set(this.root.position.x, surface + 0.05, this.root.position.z);
    this.shadow.scale.set(1 + state.y * 0.2, 0.65 + state.y * 0.1, 1);
    this.shadow.material.opacity = Math.max(0.02, 0.18 - state.y * 0.024);
    this.wasAirborne = state.airborne;
  }
  dispose(scene: THREE.Scene) {
    ++this.ticket;
    this.mixer?.stopAllAction();
    disposeInstance(this.root);
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    scene.remove(this.root, this.shadow);
  }
}
