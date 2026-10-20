import * as THREE from 'three';
import { COURSES, type CourseId } from '../core/catalog.ts';
import { createRun, trackObject, type RiderState } from '../core/game.ts';
import { RiderAvatar, loadAsset, cloneAsset } from './assets.ts';
import { CartoonOcean } from './water.ts';
import { RideEffects } from './effects.ts';

const V = THREE.Vector3;
const material = (color: string, roughness = 0.7) =>
  new THREE.MeshStandardMaterial({ color, roughness });
function add(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function cylinderBetween(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
  mat: THREE.Material,
) {
  const m = add(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export class OceanScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(49, 1, 0.15, 1300);
  readonly ocean = new CartoonOcean();
  readonly rider: RiderAvatar;
  readonly ready: Promise<void>;
  private effects: RideEffects;
  private boat = new THREE.Group();
  private islands = new THREE.Group();
  private clouds = new THREE.Group();
  private sky: THREE.ShaderMaterial;
  private sun: THREE.DirectionalLight;
  private rope: THREE.Line;
  private handle: THREE.Mesh;
  private props: THREE.Group[] = [];
  private remote = new Map<string, { avatar: RiderAvatar; state: RiderState; index: number }>();
  private mats = {
    sand: material('#ffe8a0'),
    grass: material('#70d05c'),
    leaf: material('#38ad69'),
    trunk: material('#b88249'),
    rock: material('#80b59c'),
  };
  private time = 0;
  private seed = 41;
  private course: CourseId = 'lagoon';
  private reducedMotion = false;
  private target = new V(0, 1, -10);
  private impact = 0;
  private lastEvent = 0;
  private resizeHandler = () => this.resize();
  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2('#b8edff', 0.0026);
    this.scene.add(new THREE.HemisphereLight('#f0fcff', '#70b9c8', 2.2));
    this.sun = new THREE.DirectionalLight('#fff4d3', 2.8);
    this.sun.position.set(-32, 55, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -32;
    this.sun.shadow.camera.right = 32;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -32;
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun);
    this.sky = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color('#58b9ef') },
        uHorizon: { value: new THREE.Color('#d6f7ff') },
      },
      vertexShader:
        'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform vec3 uTop;uniform vec3 uHorizon;varying vec3 vPos;void main(){float t=pow(clamp(vPos.y/500.,0.,1.),.6);gl_FragColor=vec4(mix(uHorizon,uTop,t),1.);}',
    });
    add(new THREE.SphereGeometry(900, 24, 16), this.sky, this.scene);
    this.scene.add(this.ocean.group, this.islands, this.boat, this.clouds);
    this.buildIslands();
    this.buildBoat();
    this.buildClouds();
    this.buildTrack();
    this.rider = new RiderAvatar(this.scene);
    this.ready = this.rider.load('daybreak', 'kai');
    this.ready.catch(error => console.error('Could not load the Blender rider assets', error));
    this.effects = new RideEffects(this.scene);
    this.rope = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new V(), new V(), new V()]),
      new THREE.LineBasicMaterial({ color: '#fff3c9' }),
    );
    this.scene.add(this.rope);
    this.handle = add(
      new THREE.CylinderGeometry(0.038, 0.038, 0.62, 10),
      material('#163650'),
      this.scene,
    );
    this.handle.rotation.z = Math.PI / 2;
    this.camera.position.set(11, 6.4, 14);
    this.camera.lookAt(this.target);
    window.addEventListener('resize', this.resizeHandler);
    this.resize();
  }
  private buildBoat() {
    const ivory = material('#fff8dd', 0.32),
      orange = material('#ff745e', 0.32),
      blue = material('#1f5e8a', 0.35),
      purple = material('#a897f5');
    const shape = new THREE.Shape();
    shape.moveTo(-0.98, -2.35);
    shape.lineTo(0.98, -2.35);
    shape.quadraticCurveTo(1.3, -0.3, 0.98, 1.6);
    shape.quadraticCurveTo(0.8, 2.6, 0, 2.95);
    shape.quadraticCurveTo(-0.8, 2.6, -0.98, 1.6);
    shape.quadraticCurveTo(-1.3, -0.3, -0.98, -2.35);
    const hull = add(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.58,
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.18,
        bevelThickness: 0.13,
        steps: 1,
        curveSegments: 14,
      }),
      ivory,
      this.boat,
      0,
      0.2,
      0,
    );
    hull.rotation.x = -Math.PI / 2;
    hull.castShadow = true;
    const deck = add(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.05,
        bevelThickness: 0.03,
        steps: 1,
        curveSegments: 14,
      }),
      orange,
      this.boat,
      0,
      0.91,
      0,
    );
    deck.rotation.x = -Math.PI / 2;
    deck.scale.setScalar(0.92);
    add(new THREE.BoxGeometry(1.55, 0.22, 2.1), ivory, this.boat, 0, 1.03, 0.15);
    for (const x of [-0.72, 0.72]) {
      const seat = add(new THREE.BoxGeometry(0.43, 0.55, 0.7), blue, this.boat, x * 0.6, 1.27, 0.7);
      seat.castShadow = true;
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#95efff',
      transparent: true,
      opacity: 0.65,
      roughness: 0.12,
      metalness: 0.1,
    });
    const windshield = add(
      new THREE.BoxGeometry(1.65, 0.73, 0.07),
      glass,
      this.boat,
      0,
      1.6,
      -0.85,
    );
    windshield.rotation.x = -0.25;
    for (const x of [-0.86, 0.86])
      cylinderBetween(this.boat, new V(x, 1.05, 0.5), new V(x, 2.58, 0.22), 0.042, blue);
    const canopy = add(new THREE.BoxGeometry(2.08, 0.12, 1.85), purple, this.boat, 0, 2.65, 0.1);
    canopy.castShadow = true;
    add(new THREE.BoxGeometry(2.08, 0.04, 0.14), ivory, this.boat, 0, 2.73, -0.5);
    add(new THREE.BoxGeometry(0.55, 0.45, 0.45), blue, this.boat, 0, 0.7, 2.58);
    const bumper = add(
      new THREE.TorusGeometry(0.2, 0.07, 8, 20),
      orange,
      this.boat,
      -1.06,
      0.78,
      1.15,
    );
    bumper.rotation.y = Math.PI / 2;
    loadAsset('rider-kai')
      .then(gltf => {
        const driver = cloneAsset(gltf);
        driver.scale.setScalar(0.43);
        driver.position.set(-0.36, 0.8, -0.25);
        this.boat.add(driver);
      })
      .catch(() => {});
    this.boat.position.z = -24;
  }
  private palm(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    height: number,
    turn: number,
  ) {
    const palm = new THREE.Group();
    palm.position.set(x, y, z);
    palm.rotation.y = turn;
    parent.add(palm);
    const curve = new THREE.CatmullRomCurve3([
      new V(0, 0, 0),
      new V(0.1, height * 0.45, 0),
      new V(0.7, height, 0),
    ]);
    add(new THREE.TubeGeometry(curve, 10, 0.18, 9, false), this.mats.trunk, palm);
    const pos: number[] = [],
      indices: number[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k * Math.PI * 2) / 7;
      const dx = Math.cos(a),
        dz = Math.sin(a);
      const offset = pos.length / 3;
      for (let i = 0; i <= 9; i++) {
        const u = i / 9;
        const width = Math.sin(u * Math.PI) * 0.57;
        const length = 3.6 * u;
        const h = height + Math.sin(u * Math.PI) * 1.05 - u * 0.9;
        for (const side of [-1, 1])
          pos.push(0.7 + dx * length - dz * width * side, h, dz * length + dx * width * side);
        if (i < 9) {
          const j = offset + i * 2;
          indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.mats.leaf.side = THREE.DoubleSide;
    add(geometry, this.mats.leaf, palm);
    for (const dx of [-0.17, 0.17]) {
      const coconut = add(
        new THREE.SphereGeometry(0.24, 9, 7),
        this.mats.trunk,
        palm,
        0.7 + dx,
        height - 0.15,
        0.1,
      );
      coconut.scale.y = 1.1;
    }
  }
  private buildIslands() {
    const places = [
      [-62, -118, 31, 14],
      [76, -165, 43, 24],
      [-132, -295, 68, 39],
      [135, -365, 88, 48],
      [43, -34, 13, 4],
      [-43, -66, 18, 6],
      [70, 57, 24, 8],
      [-90, 145, 36, 14],
    ];
    for (let islandIndex = 0; islandIndex < places.length; islandIndex++) {
      const [x, z, size, height] = places[islandIndex];
      const island = new THREE.Group();
      island.position.set(x, -0.1, z);
      this.islands.add(island);
      const sand = add(new THREE.SphereGeometry(1, 28, 12), this.mats.sand, island, 0, -0.1, 0);
      sand.scale.set(size * 1.14, 0.95, size * 0.8);
      const verts: number[] = [],
        idx: number[] = [];
      const segments = 28,
        rings = 10;
      for (let r = 0; r <= rings; r++)
        for (let s = 0; s < segments; s++) {
          const radius = r / rings;
          const a = (s / segments) * Math.PI * 2;
          const h =
            0.3 +
            height *
              Math.pow(1 - radius, 1.45) *
              (0.88 + 0.12 * Math.sin(a * 3 + radius * 3 + islandIndex));
          verts.push(Math.cos(a) * size * radius, h, Math.sin(a) * size * radius * 0.66);
          if (r < rings) {
            const n = r * segments + s,
              next = r * segments + ((s + 1) % segments);
            idx.push(n, next, n + segments, next, next + segments, n + segments);
          }
        }
      const terrain = new THREE.BufferGeometry();
      terrain.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      terrain.setIndex(idx);
      terrain.computeVertexNormals();
      add(terrain, this.mats.grass, island);
      for (let p = 0; p < 4; p++) {
        const a = p * 1.6 + islandIndex;
        const r = 0.8;
        const ground = 0.3 + height * Math.pow(1 - r, 1.45);
        this.palm(
          island,
          Math.cos(a) * size * r,
          ground,
          Math.sin(a) * size * r * 0.66,
          4.5 + p * 0.6,
          a,
        );
      }
      if (islandIndex === 4 || islandIndex === 5) {
        const coral = material(islandIndex === 4 ? '#ff8b83' : '#b5a5ff');
        const umbrella = new THREE.Group();
        umbrella.position.set(-size * 0.6, 1, size * 0.3);
        island.add(umbrella);
        cylinderBetween(umbrella, new V(0, 0, 0), new V(0, 3.5, 0), 0.045, this.mats.trunk);
        const roof = add(new THREE.ConeGeometry(2, 1, 10), coral, umbrella, 0, 3.5, 0);
        roof.scale.y = 0.55;
        const chair = add(
          new THREE.BoxGeometry(1, 0.15, 2),
          material('#fff0c7'),
          umbrella,
          0,
          0.35,
          0,
        );
        chair.rotation.x = -0.1;
      }
    }
    const hut = new THREE.Group();
    hut.position.set(41, 1.3, -28);
    this.islands.add(hut);
    for (const x of [-1.8, 1.8])
      for (const z of [-1.8, 1.8])
        cylinderBetween(hut, new V(x, 0, z), new V(x, 3.4, z), 0.13, this.mats.trunk);
    const roof = add(new THREE.ConeGeometry(3.5, 1.7, 4), material('#f8b95a'), hut, 0, 4, 0);
    roof.rotation.y = Math.PI / 4;
    const lighthouse = new THREE.Group();
    lighthouse.position.set(79, 11, -174);
    this.islands.add(lighthouse);
    const cream = material('#fff7d9'),
      coral = material('#ff786b');
    for (let i = 0; i < 5; i++)
      add(
        new THREE.CylinderGeometry(1.4 - i * 0.12, 1.5 - i * 0.12, 1.7, 16),
        i % 2 ? coral : cream,
        lighthouse,
        0,
        i * 1.7,
        0,
      );
    add(new THREE.CylinderGeometry(1.1, 1.1, 1.5, 10), material('#94edff'), lighthouse, 0, 8, 0);
    add(new THREE.ConeGeometry(1.6, 1.3, 10), coral, lighthouse, 0, 9.4, 0);
  }
  private buildClouds() {
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (let i = 0; i < 13; i++) {
      const cloud = new THREE.Group();
      cloud.position.set(Math.sin(i * 4.7) * 320, 48 + (i % 4) * 13, -130 - i * 32);
      for (let j = 0; j < 4; j++) {
        const puff = add(
          new THREE.SphereGeometry(1, 14, 10),
          white,
          cloud,
          (j - 1.5) * 9,
          Math.sin(j * 1.6) * 3,
          0,
        );
        puff.scale.set(14, 6 + (j % 2) * 3, 6);
      }
      this.clouds.add(cloud);
    }
    const sun = add(
      new THREE.SphereGeometry(13, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#fff4b4' }),
      this.scene,
      -180,
      170,
      -480,
    );
    sun.name = 'Sun';
    for (const [x, z] of [
      [-26, -170],
      [36, -270],
    ]) {
      const sailboat = new THREE.Group();
      sailboat.position.set(x, 0.2, z);
      this.scene.add(sailboat);
      const hull = add(
        new THREE.SphereGeometry(1, 12, 8),
        material('#fff8da'),
        sailboat,
        0,
        0.4,
        0,
      );
      hull.scale.set(0.8, 0.4, 2.2);
      cylinderBetween(sailboat, new V(0, 0.5, 0), new V(0, 8.3, 0), 0.05, this.mats.trunk);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0, 7);
      shape.lineTo(3.4, 0);
      shape.closePath();
      add(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: '#ffd471', side: THREE.DoubleSide }),
        sailboat,
        0,
        1.2,
        0,
      );
    }
  }
  private buildTrack() {
    const gold = new THREE.MeshStandardMaterial({
      color: '#ffdc4c',
      metalness: 0.38,
      roughness: 0.27,
      emissive: '#cc8000',
      emissiveIntensity: 0.15,
    });
    for (let i = 0; i < 8; i++) {
      const prop = new THREE.Group();
      const ring = add(new THREE.TorusGeometry(1.18, 0.12, 10, 40), gold, prop, 0, 1.75, 0);
      ring.name = 'ring';
      const inner = add(
        new THREE.TorusGeometry(1.18, 0.045, 8, 40),
        material('#fff4aa'),
        ring,
        0,
        0,
        0.075,
      );
      const buoy = new THREE.Group();
      buoy.name = 'buoy';
      prop.add(buoy);
      add(new THREE.ConeGeometry(0.62, 1.6, 12), material('#ff7262'), buoy, 0, 0.8, 0);
      add(new THREE.CylinderGeometry(0.43, 0.54, 0.23, 12), material('#fff2d4'), buoy, 0, 0.78, 0);
      add(new THREE.SphereGeometry(0.11, 10, 8), material('#ffdf68'), buoy, 0, 1.63, 0);
      this.props.push(prop);
      this.scene.add(prop);
    }
  }
  setCourse(id: CourseId) {
    if (this.course === id && this.seed === COURSES.find(c => c.id === id)!.seed) return;
    this.course = id;
    this.seed = COURSES.find(c => c.id === id)!.seed;
    this.ocean.setCourse(id);
    this.sky.uniforms.uTop.value.set(
      id === 'sunset' ? '#cba3ef' : id === 'arctic' ? '#75b9ee' : '#58b9ef',
    );
    this.sky.uniforms.uHorizon.value.set(id === 'sunset' ? '#ffdfba' : '#d6f7ff');
    (this.scene.fog as THREE.FogExp2).color.set(
      id === 'sunset' ? '#ffd5c2' : id === 'arctic' ? '#d9f3ff' : '#b8edff',
    );
    this.sun.color.set(id === 'sunset' ? '#ffd4a7' : '#fff4d3');
    this.mats.grass.color.set(id === 'arctic' ? '#e4f5ff' : '#70d05c');
    this.mats.leaf.color.set(id === 'arctic' ? '#a4dcec' : '#38ad69');
    this.mats.sand.color.set(id === 'arctic' ? '#effaff' : '#ffe8a0');
  }
  equip(board: string, rider: string) {
    this.rider.load(board, rider).catch(error => console.error('Cosmetic asset failed', error));
    this.effects.configure(board, this.reducedMotion);
  }
  configure(quality: 'high' | 'low', reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.8 : 1));
    this.renderer.shadowMap.enabled = quality === 'high';
    this.effects.configure(this.rider.boardId, reducedMotion);
    this.resize();
  }
  private resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  clearRemote() {
    for (const entry of this.remote.values()) entry.avatar.dispose(this.scene);
    this.remote.clear();
  }
  updateRemote(players: { id: string; board: string; rider: string; state: RiderState }[]) {
    const ids = new Set(players.map(p => p.id));
    for (const [id, entry] of this.remote)
      if (!ids.has(id)) {
        entry.avatar.dispose(this.scene);
        this.remote.delete(id);
      }
    players.forEach((p, index) => {
      let entry = this.remote.get(p.id);
      if (!entry) {
        const avatar = new RiderAvatar(this.scene);
        avatar.load(p.board, p.rider).catch(() => {});
        entry = { avatar, state: p.state, index };
        this.remote.set(p.id, entry);
      }
      entry.state = p.state;
      entry.index = index;
    });
  }
  update(dt: number, state: RiderState | null, mode: 'menu' | 'play' | 'shop' = 'menu') {
    this.time += dt;
    const distance = state?.distance ?? this.time * 7;
    this.ocean.update(this.time, distance);
    const demo = state ?? {
      ...createRun(),
      x: 2.8 + Math.sin(this.time * 0.35) * 0.65,
      vx: Math.cos(this.time * 0.35) * 1.3,
    };
    const surface = this.ocean.height(demo.x, 0, this.time, distance);
    const menu = mode !== 'play';
    this.rider.update(demo, dt, surface, this.time, menu);
    this.effects.update(dt, demo, this.rider.root.position.x, surface, 0, menu);
    for (const entry of this.remote.values()) {
      const z = -3 - entry.index * 2;
      entry.avatar.root.position.z = z;
      entry.avatar.update(
        entry.state,
        dt,
        this.ocean.height(entry.state.x, z, this.time, distance),
        this.time,
      );
      entry.avatar.shadow.position.z = z;
    }
    const boatY = this.ocean.height(0, -24, this.time, distance) * 0.3;
    this.boat.position.y = boatY;
    this.boat.rotation.z = Math.sin(this.time * 1.1) * 0.018;
    this.rider.root.updateMatrixWorld(true);
    const endpoint = new V(0, 0.33, -0.75).applyMatrix4(this.rider.trickPivot.matrixWorld);
    this.handle.position.copy(endpoint);
    this.handle.quaternion
      .copy(this.rider.trickPivot.getWorldQuaternion(new THREE.Quaternion()))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), Math.PI / 2));
    this.handle.visible = demo.wipeout <= 0;
    const positions = this.rope.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, 0, boatY + 2.6, -23.8);
    positions.setXYZ(1, endpoint.x * 0.45, 1.6 + demo.y * 0.35, -12);
    positions.setXYZ(2, endpoint.x, endpoint.y, endpoint.z);
    positions.needsUpdate = true;
    this.rope.geometry.computeBoundingSphere();
    this.rope.visible = demo.wipeout <= 0;
    const offset = Math.max(0, Math.floor((distance - 40) / 66));
    this.props.forEach((prop, i) => {
      const index = i + offset;
      const obj = trackObject(index, this.seed);
      const z = distance - obj.distance;
      prop.position.set(obj.x, this.ocean.height(obj.x, z, this.time, distance), z);
      prop.getObjectByName('ring')!.visible = obj.type === 'ring' && state?.lastPickup !== index;
      prop.getObjectByName('buoy')!.visible = obj.type === 'buoy';
      prop.rotation.y = obj.type === 'ring' ? Math.sin(this.time * 1.8 + i) * 0.13 : 0;
    });
    this.islands.position.z = (distance * 0.055) % 75;
    this.clouds.position.x = Math.sin(this.time * 0.018) * 6;
    if (state && state.event.id !== this.lastEvent) {
      this.lastEvent = state.event.id;
      if (['land', 'wipeout'].includes(state.event.type)) this.impact = 0.4;
    }
    this.impact = Math.max(0, this.impact - dt * 2);
    const mobile = this.camera.aspect < 0.9;
    const desired = new V(
      menu ? (mobile ? 9 : 10.4) : mobile ? demo.x + 0.65 : demo.x * 0.31 + 2.1,
      menu ? 5.8 : 4.65 + demo.y * 0.28,
      menu ? 13.3 : 10.7,
    );
    if (!this.reducedMotion && !menu) desired.y += Math.sin(this.impact * 30) * this.impact * 0.15;
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 3.2));
    this.target.lerp(
      new V(
        menu ? (mobile ? -1 : -5) : demo.x * (mobile ? 1 : 0.42),
        menu ? 1.1 : 1.25 + demo.y * 0.2,
        menu ? -11 : -8,
      ),
      1 - Math.exp(-dt * 4),
    );
    this.camera.lookAt(this.target);
    const fov = menu ? 49 : (mobile ? 60 : 55) + Math.abs(demo.vx) * 0.16;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 3));
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    window.removeEventListener('resize', this.resizeHandler);
    this.clearRemote();
    this.rider.dispose(this.scene);
    this.effects.dispose(this.scene);
    this.renderer.dispose();
  }
}
