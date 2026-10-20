import * as THREE from 'three';
import { BOARDS, RIDERS, COURSES, type CourseId } from './core/catalog.ts';
import { trackObject, type RiderState } from './core/game.ts';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const mat = (color: THREE.ColorRepresentation, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness });
function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function limb(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const m = mesh(
    new THREE.CylinderGeometry(radius, radius * 0.85, start.distanceTo(end), 8),
    material,
    parent,
  );
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, end.clone().sub(start).normalize());
  return m;
}
interface RiderVisual {
  root: THREE.Group;
  body: THREE.Group;
  board: THREE.Mesh;
  jersey: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  shadow: THREE.Mesh;
}
function makeRider(scene: THREE.Scene, boardId: string, riderId: string): RiderVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  scene.add(root);
  const boardData = BOARDS.find(b => b.id === boardId) || BOARDS[0];
  const riderData = RIDERS.find(r => r.id === riderId) || RIDERS[0];
  const boardMat = mat(boardData.color, 0.32);
  const accent = mat(boardData.accent, 0.4);
  const jersey = mat(riderData.color);
  const hair = mat(riderData.accent);
  const skin = mat('#dcaa7d');
  const shorts = mat('#204956');
  const white = mat('#fff2dc');
  const board = mesh(new THREE.CapsuleGeometry(0.4, 1.65, 6, 16), boardMat, body, 0, 0.13, 0);
  board.rotation.z = Math.PI / 2;
  board.scale.set(0.16, 1, 1);
  for (const x of [-0.67, 0.65]) {
    const stripe = mesh(new THREE.BoxGeometry(0.15, 0.022, 0.65), accent, body, x, 0.205, 0);
    stripe.rotation.y = -0.3;
  }
  for (const x of [-0.46, 0.46])
    mesh(new THREE.BoxGeometry(0.29, 0.22, 0.43), shorts, body, x, 0.29, 0);
  limb(body, new V3(-0.46, 0.38, 0), new V3(-0.57, 0.9, 0.1), 0.11, skin);
  limb(body, new V3(0.46, 0.38, 0), new V3(0.25, 0.87, 0.14), 0.11, skin);
  limb(body, new V3(-0.57, 0.9, 0.1), new V3(-0.2, 1.26, 0), 0.14, shorts);
  limb(body, new V3(0.25, 0.87, 0.14), new V3(0.18, 1.26, 0), 0.14, shorts);
  mesh(new THREE.CylinderGeometry(0.32, 0.27, 0.67, 10), jersey, body, -0.02, 1.57, 0);
  // Vest panels and zip make the small silhouette read as a wakeboarder.
  mesh(new THREE.BoxGeometry(0.045, 0.55, 0.06), white, body, -0.02, 1.58, 0.29);
  for (const y of [1.43, 1.65])
    mesh(new THREE.BoxGeometry(0.6, 0.055, 0.57), shorts, body, -0.02, y, 0);
  mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.18, 8), skin, body, 0, 1.96, 0);
  mesh(new THREE.SphereGeometry(0.31, 14, 12), skin, body, 0, 2.18, 0);
  const hairMesh = mesh(
    new THREE.SphereGeometry(0.325, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.61),
    hair,
    body,
    0,
    2.23,
    0,
  );
  hairMesh.rotation.x = -0.1;
  mesh(new THREE.BoxGeometry(0.48, 0.1, 0.2), shorts, body, 0, 2.2, -0.24);
  const armL = limb(body, new V3(-0.29, 1.82, -0.01), new V3(-0.28, 1.42, -0.69), 0.09, skin);
  const armR = limb(body, new V3(0.29, 1.82, -0.01), new V3(0.24, 1.42, -0.69), 0.09, skin);
  const handle = mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.65, 8),
    shorts,
    body,
    0,
    1.41,
    -0.7,
  );
  handle.rotation.z = Math.PI / 2;
  const shadow = mesh(
    new THREE.CircleGeometry(0.8, 24),
    new THREE.MeshBasicMaterial({
      color: '#073f53',
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    }),
    scene,
    0,
    0.13,
    0,
  );
  shadow.rotation.x = -Math.PI / 2;
  return { root, body, board, jersey, hair, accent, armL, armR, shadow };
}

export class OceanScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(49, 1, 0.2, 1200);
  private water: THREE.ShaderMaterial;
  private rider: RiderVisual;
  private boat = new THREE.Group();
  private islands = new THREE.Group();
  private clouds = new THREE.Group();
  private props: { group: THREE.Group; index: number; type: string }[] = [];
  private rope: THREE.Line;
  private spray: THREE.Points;
  private sprayPositions: Float32Array;
  private remote = new Map<string, RiderVisual>();
  private course: CourseId = 'lagoon';
  private seed = 41;
  private time = 0;
  private quality = 'high';
  private cameraTarget = new V3();
  private reducedMotion = false;
  private lastEvent = 0;
  private impact = 0;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2('#a8dce0', 0.0052);
    this.scene.add(new THREE.HemisphereLight('#e2f8ff', '#458c91', 2.9));
    this.sun = new THREE.DirectionalLight('#fff2d7', 3.2);
    this.sun.position.set(-70, 90, -90);
    this.scene.add(this.sun);
    this.sky = mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color('#69b7d5') },
          bottom: { value: new THREE.Color('#d9eeeb') },
        },
        vertexShader:
          'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float h=clamp(vPos.y/500.,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.5)),1.);}',
      }),
      this.scene,
    );
    const waterGeometry = new THREE.PlaneGeometry(180, 320, 180, 240);
    waterGeometry.rotateX(-Math.PI / 2);
    this.water = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDistance: { value: 0 },
        uColor: { value: new THREE.Color('#139fac') },
        uSun: { value: new THREE.Color('#fff2d7') },
      },
      vertexShader: `uniform float uTime;uniform float uDistance;varying vec3 vWorld;varying float vHeight;
        void main(){vec3 p=position;float z=p.z-uDistance;float waves=sin(p.x*.22+z*.16+uTime*.8)*.16+sin(p.x*.59-z*.23+uTime)*.1;
        float behind=clamp((p.z+23.)/5.,0.,1.);float line=abs(p.x)-(p.z+23.)*.185;float wake=exp(-line*line*1.6)*behind*exp(-max(p.z,0.)*.027)*.65;
        p.y=waves+wake;vHeight=p.y;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float uTime;uniform float uDistance;uniform vec3 uColor;uniform vec3 uSun;varying vec3 vWorld;varying float vHeight;
        float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 p=vWorld.xz;float z=p.y-uDistance;
        float lines=sin(p.x*2.6+sin(z*.7+uTime)*1.7+z*1.6)*sin(z*3.6-p.x*.9+uTime*1.5);
        vec3 color=mix(uColor*.67,uColor*1.35,clamp(vHeight*.7+.4,0.,1.));
        float behind=smoothstep(-23.,-18.,p.y)*(1.-smoothstep(65.,130.,p.y));float edge=abs(p.x)-(p.y+23.)*.185;
        float foam=exp(-edge*edge*5.)*behind*(.45+.3*sin(z*3.+uTime*2.)+.25*lines);
        float center=exp(-p.x*p.x*.24)*smoothstep(-24.,-18.,p.y)*(1.-smoothstep(-16.,0.,p.y));
        color=mix(color,vec3(.86,.99,.94),clamp(foam+center*.65,0.,.88));
        float spark=pow(max(0.,lines),16.)*.4; color+=uSun*spark;
        float far=smoothstep(35.,260.,length(p));color=mix(color,vec3(.64,.82,.82),far*.68);
        gl_FragColor=vec4(color,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    });
    const farWater = new THREE.PlaneGeometry(1100, 1100, 24, 24);
    farWater.rotateX(-Math.PI / 2);
    mesh(farWater, this.water, this.scene, 0, -0.8, 0);
    mesh(waterGeometry, this.water, this.scene);
    this.scene.add(this.islands, this.boat, this.clouds);
    this.buildIslands();
    this.buildBoat();
    this.buildClouds();
    this.rider = makeRider(this.scene, 'daybreak', 'kai');
    const ropeGeometry = new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]);
    this.rope = new THREE.Line(
      ropeGeometry,
      new THREE.LineBasicMaterial({ color: '#f3e8b2', transparent: true, opacity: 0.9 }),
    );
    this.scene.add(this.rope);
    this.sprayPositions = new Float32Array(180 * 3);
    const sprayGeometry = new THREE.BufferGeometry();
    sprayGeometry.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));
    this.spray = new THREE.Points(
      sprayGeometry,
      new THREE.PointsMaterial({
        color: '#e3fffb',
        size: 0.09,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    this.scene.add(this.spray);
    this.buildTrack();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  private buildBoat() {
    const white = mat('#fff9e7', 0.35),
      teal = mat('#235b61'),
      coral = mat('#f6916c'),
      glass = new THREE.MeshStandardMaterial({ color: '#90d5db', roughness: 0.15, metalness: 0.3 });
    const hull = mesh(new THREE.CapsuleGeometry(1.1, 3, 6, 12), white, this.boat, 0, 0.55, -23);
    hull.rotation.x = Math.PI / 2;
    hull.scale.z = 0.6;
    mesh(new THREE.BoxGeometry(1.95, 0.34, 2.8), teal, this.boat, 0, 0.8, -22.7);
    mesh(new THREE.BoxGeometry(1.7, 0.28, 2.5), white, this.boat, 0, 1, -22.7);
    const windshield = mesh(
      new THREE.BoxGeometry(1.65, 0.7, 0.1),
      glass,
      this.boat,
      0,
      1.5,
      -23.25,
    );
    windshield.rotation.x = -0.3;
    for (const x of [-0.7, 0.7]) {
      limb(this.boat, new V3(x, 1, -22.4), new V3(x, 2.6, -22.4), 0.045, teal);
    }
    const canopy = mesh(new THREE.BoxGeometry(2.1, 0.12, 1.7), coral, this.boat, 0, 2.6, -22.5);
    canopy.rotation.x = -0.04;
    mesh(new THREE.BoxGeometry(0.7, 0.6, 0.6), coral, this.boat, 0, 1.3, -22);
    mesh(new THREE.SphereGeometry(0.23, 10, 8), mat('#ce9973'), this.boat, -0.36, 1.94, -22.7);
    mesh(
      new THREE.CylinderGeometry(0.23, 0.19, 0.5, 8),
      mat('#fff2cf'),
      this.boat,
      -0.36,
      1.57,
      -22.7,
    );
  }
  private buildIslands() {
    const sand = mat('#f3dfad'),
      rock = mat('#78978a'),
      grass = mat('#6ca174'),
      darkGrass = mat('#487b64'),
      trunk = mat('#9d7c51'),
      leaf = mat('#3e946d');
    const placements = [
      [-65, -100, 33, 23],
      [-100, -210, 50, 40],
      [74, -170, 51, 35],
      [140, -320, 90, 65],
      [-180, -400, 110, 80],
      [53, 36, 22, 15],
      [-80, 100, 43, 25],
      [42, -30, 13, 6],
      [-44, -65, 18, 9],
    ];
    for (let i = 0; i < placements.length; i++) {
      const [x, z, scale, height] = placements[i];
      const island = new THREE.Group();
      island.position.set(x, -2, z);
      this.islands.add(island);
      const beach = mesh(new THREE.SphereGeometry(1, 18, 12), sand, island);
      beach.scale.set(scale * 1.2, 4, scale * 0.76);
      const stone = mesh(new THREE.IcosahedronGeometry(1, 1), rock, island, 0, height * 0.3, -3);
      stone.scale.set(scale * 0.85, height * 0.72, scale * 0.53);
      stone.rotation.y = i;
      const top = mesh(
        new THREE.IcosahedronGeometry(1, 1),
        i % 2 ? grass : darkGrass,
        island,
        -scale * 0.05,
        height * 0.65,
        -3,
      );
      top.scale.set(scale * 0.71, height * 0.27, scale * 0.46);
      top.rotation.y = i;
      for (let j = 0; j < 5; j++) {
        const palm = new THREE.Group();
        const angle = j * 2.4 + i;
        palm.position.set(Math.cos(angle) * scale * 0.7, 3, Math.sin(angle) * scale * 0.4);
        palm.scale.setScalar(0.65 + (j % 3) * 0.23);
        island.add(palm);
        const curve = new THREE.CatmullRomCurve3([
          new V3(0, 0, 0),
          new V3(0.4, 3, 0),
          new V3(1.5, 6.7, 0),
        ]);
        mesh(new THREE.TubeGeometry(curve, 8, 0.22, 7, false), trunk, palm);
        for (let k = 0; k < 7; k++) {
          const a = (k * Math.PI * 2) / 7;
          const direction = new V3(Math.cos(a), 0, Math.sin(a));
          const shape = new THREE.Shape();
          shape.moveTo(0, 0);
          shape.quadraticCurveTo(1.3, 0.9, 4.5, 0);
          shape.quadraticCurveTo(1.3, -0.8, 0, 0);
          const frond = mesh(
            new THREE.ShapeGeometry(shape, 5),
            new THREE.MeshStandardMaterial({
              color: k % 2 ? '#64a879' : '#3e946d',
              side: THREE.DoubleSide,
              roughness: 1,
            }),
            palm,
            1.5,
            6.7,
            0,
          );
          frond.rotation.set(-Math.PI / 2 + 0.3, 0, a);
          frond.position.add(direction.multiplyScalar(0.1));
        }
        mesh(new THREE.SphereGeometry(0.32, 6, 6), trunk, palm, 1.6, 6.4, 0.1);
      }
    }
    // Open-sided beach hut on the near island.
    const hut = new THREE.Group();
    hut.position.set(50, 4, 28);
    this.islands.add(hut);
    for (const x of [-2, 2])
      for (const z of [-2, 2])
        mesh(new THREE.CylinderGeometry(0.15, 0.18, 4, 6), trunk, hut, x, 2, z);
    const roof = mesh(new THREE.ConeGeometry(4, 2, 4), mat('#b38459'), hut, 0, 5, 0);
    roof.rotation.y = Math.PI / 4;
  }
  private buildClouds() {
    const white = new THREE.MeshBasicMaterial({ color: '#f5f7e9' });
    for (let i = 0; i < 17; i++) {
      const cloud = new THREE.Group();
      cloud.position.set(Math.sin(i * 8.3) * 350, 60 + (i % 4) * 15, -100 - i * 25);
      for (let j = 0; j < 5; j++) {
        const puff = mesh(
          new THREE.SphereGeometry(1, 8, 6),
          white,
          cloud,
          (j - 2) * 9,
          Math.sin(j * 2) * 3,
          0,
        );
        puff.scale.set(15, 6 + (j % 2) * 3, 6);
      }
      this.clouds.add(cloud);
    }
    // Tiny distant sailboats.
    for (const [x, z] of [
      [-27, -170],
      [34, -260],
    ]) {
      const sailboat = new THREE.Group();
      sailboat.position.set(x, 0, z);
      this.scene.add(sailboat);
      const hull = mesh(new THREE.SphereGeometry(1, 8, 6), mat('#fff6dc'), sailboat, 0, 0.7, 0);
      hull.scale.set(1.4, 0.5, 3);
      limb(sailboat, new V3(0, 1, 0), new V3(0, 11, 0), 0.08, mat('#866e50'));
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0, 9);
      shape.lineTo(4, 0);
      shape.closePath();
      mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: '#f8ead1', side: THREE.DoubleSide }),
        sailboat,
        0,
        2,
        0,
      );
    }
  }
  private buildTrack() {
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#f5d978',
      emissive: '#dc8f21',
      emissiveIntensity: 0.3,
      metalness: 0.45,
      roughness: 0.3,
    });
    const white = mat('#fff0d5'),
      coral = mat('#f27659');
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      this.scene.add(group);
      const ring = mesh(new THREE.TorusGeometry(1.2, 0.09, 8, 36), ringMat, group, 0, 1.6, 0);
      ring.name = 'ring';
      const buoy = new THREE.Group();
      buoy.name = 'buoy';
      group.add(buoy);
      mesh(new THREE.ConeGeometry(0.6, 1.5, 10), coral, buoy, 0, 0.8, 0);
      mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.26, 10), white, buoy, 0, 0.7, 0);
      this.props.push({ group, index: i, type: 'ring' });
    }
  }
  setCourse(id: CourseId) {
    this.course = id;
    const course = COURSES.find(x => x.id === id)!;
    this.seed = course.seed;
    this.water.uniforms.uColor.value.set(course.water);
    this.water.uniforms.uSun.value.set(course.sun);
    (this.scene.fog as THREE.FogExp2).color.set(course.sky);
    this.sun.color.set(course.sun);
    const sky = this.sky.material as THREE.ShaderMaterial;
    sky.uniforms.top.value.set(
      id === 'sunset' ? '#c894b3' : id === 'arctic' ? '#779dbb' : '#69b7d5',
    );
    sky.uniforms.bottom.value.set(course.sky);
    this.islands.traverse(obj => {
      if (!(obj instanceof THREE.Mesh) || !(obj.material instanceof THREE.MeshStandardMaterial))
        return;
      // Cold course keeps the same island geometry with a snowy palette.
      if (!obj.userData.originalColor) obj.userData.originalColor = obj.material.color.getHex();
      obj.material.color.setHex(
        id === 'arctic'
          ? obj.userData.originalColor === 0xf3dfad
            ? 0xdce8e7
            : obj.userData.originalColor === 0x78978a
              ? 0x8fa9b3
              : obj.userData.originalColor
          : obj.userData.originalColor,
      );
    });
  }
  equip(boardId: string, riderId: string) {
    const b = BOARDS.find(x => x.id === boardId) || BOARDS[0],
      r = RIDERS.find(x => x.id === riderId) || RIDERS[0];
    (this.rider.board.material as THREE.MeshStandardMaterial).color.set(b.color);
    this.rider.accent.color.set(b.accent);
    this.rider.jersey.color.set(r.color);
    this.rider.hair.color.set(r.accent);
  }
  configure(quality: 'high' | 'low', reducedMotion: boolean) {
    this.quality = quality;
    this.reducedMotion = reducedMotion;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.8 : 1));
    this.resize();
  }
  private resize() {
    const width = window.innerWidth,
      height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  clearRemote() {
    for (const rider of this.remote.values()) this.disposeRider(rider);
    this.remote.clear();
  }
  private disposeRider(rider: RiderVisual) {
    rider.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(m => m.dispose());
      }
    });
    this.scene.remove(rider.root, rider.shadow);
    rider.shadow.geometry.dispose();
    (rider.shadow.material as THREE.Material).dispose();
  }
  updateRemote(players: { id: string; board: string; rider: string; state: RiderState }[]) {
    const ids = new Set(players.map(p => p.id));
    for (const [id, rider] of this.remote)
      if (!ids.has(id)) {
        this.disposeRider(rider);
        this.remote.delete(id);
      }
    for (const p of players) {
      let rider = this.remote.get(p.id);
      if (!rider) {
        rider = makeRider(this.scene, p.board, p.rider);
        this.remote.set(p.id, rider);
      }
      this.poseRider(rider, p.state, 0.35);
      rider.root.position.z = -3 - (players.findIndex(x => x.id === p.id) % 3) * 2.5;
    }
  }
  private poseRider(rider: RiderVisual, state: RiderState, smoothing = 1) {
    const bob = Math.sin(this.time * 5 + state.x) * 0.07;
    const targetY = state.y + 0.32 + (state.airborne ? 0 : bob);
    rider.root.position.x += (state.x - rider.root.position.x) * smoothing;
    rider.root.position.y += (targetY - rider.root.position.y) * smoothing;
    rider.root.rotation.set(
      state.flip,
      state.spin + (state.airborne ? 0 : -state.vx * 0.025),
      state.airborne ? -state.vx * 0.015 : -state.vx * 0.035,
    );
    rider.body.rotation.x = state.airborne ? (state.grabTime > 0.2 ? -0.28 : 0.05) : 0.07;
    if (state.wipeout > 0) {
      rider.root.rotation.z = 1.4;
      rider.root.position.y = -0.25;
    }
    rider.shadow.position.x = rider.root.position.x;
    rider.shadow.scale.setScalar(1 + state.y * 0.16);
    (rider.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0.03,
      0.17 - state.y * 0.018,
    );
  }
  update(dt: number, state: RiderState | null, mode: 'menu' | 'play' | 'shop' = 'menu') {
    this.time += dt;
    const distance = state?.distance ?? this.time * 7;
    this.water.uniforms.uTime.value = this.time;
    this.water.uniforms.uDistance.value = distance;
    const demo: RiderState =
      state ||
      ({
        x: 2 + Math.sin(this.time * 0.45) * 1.6,
        y: 0,
        vx: Math.cos(this.time * 0.45) * 2,
        airborne: false,
        flip: 0,
        spin: 0,
        wipeout: 0,
        grabTime: 0,
      } as RiderState);
    this.poseRider(this.rider, demo, 1 - Math.exp(-dt * 22));
    this.boat.position.y = Math.sin(this.time * 2) * 0.09;
    this.boat.rotation.z = Math.sin(this.time) * 0.013;
    const ropePos = this.rope.geometry.attributes.position as THREE.BufferAttribute;
    ropePos.setXYZ(0, 0, 2.3 + this.boat.position.y, -22.4);
    ropePos.setXYZ(1, this.rider.root.position.x, this.rider.root.position.y + 1.4, -0.7);
    ropePos.needsUpdate = true;
    this.rope.geometry.computeBoundingSphere();
    this.rope.visible = demo.wipeout <= 0;
    const offset = Math.max(0, Math.floor((distance - 40) / 66));
    for (let i = 0; i < this.props.length; i++) {
      const object = trackObject(i + offset, this.seed);
      const prop = this.props[i];
      prop.index = i + offset;
      prop.group.position.set(object.x, 0, distance - object.distance);
      prop.group.getObjectByName('ring')!.visible =
        object.type === 'ring' && (!state || state.lastPickup !== prop.index);
      prop.group.getObjectByName('buoy')!.visible = object.type === 'buoy';
      prop.group.rotation.y = object.type === 'ring' ? Math.sin(this.time * 1.5) * 0.2 : 0;
      prop.group.position.y = Math.sin(this.time * 2 + i) * 0.1;
    }
    for (let i = 0; i < 180; i++) {
      const progress = (this.time * (1.5 + (i % 3) * 0.1) + i * 0.618) % 1;
      const side = i % 2 ? 1 : -1;
      this.sprayPositions[i * 3] =
        demo.x + side * progress * (0.5 + Math.abs(demo.vx) * 0.15) + Math.sin(i * 8.3) * 0.25;
      this.sprayPositions[i * 3 + 1] =
        Math.sin(progress * Math.PI) * (0.3 + Math.abs(demo.vx) * 0.08) + 0.15;
      this.sprayPositions[i * 3 + 2] = progress * 5 + Math.cos(i * 3.2) * 0.2;
    }
    this.spray.geometry.attributes.position.needsUpdate = true;
    this.spray.visible = !demo.airborne && demo.wipeout <= 0;
    // Islands drift past slowly, looping outside the navigable lane.
    this.islands.position.z = (distance * 0.095) % 105;
    this.clouds.position.x = Math.sin(this.time * 0.02) * 6;
    if (state && state.event.id !== this.lastEvent) {
      this.lastEvent = state.event.id;
      if (state.event.type === 'land' || state.event.type === 'wipeout') this.impact = 0.45;
    }
    this.impact = Math.max(0, this.impact - dt * 2);
    const menu = mode !== 'play';
    const mobile = this.camera.aspect < 0.9;
    const desired = new V3(
      menu ? (mobile ? 10 : 10.8) : demo.x * 0.35 + 2.5,
      menu ? (mode === 'shop' ? 4.5 : 6.9) : 5 + demo.y * 0.32,
      menu ? (mode === 'shop' ? 8 : 13.8) : 11.5,
    );
    if (!this.reducedMotion && !menu) desired.y += Math.sin(this.impact * 28) * this.impact * 0.17;
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 3));
    this.cameraTarget.lerp(
      new V3(
        menu ? (mobile ? -2 : -6) : demo.x * 0.42,
        menu ? 0.7 : 1 + demo.y * 0.18,
        menu ? -12 : -7,
      ),
      1 - Math.exp(-dt * 4),
    );
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov +=
      ((menu ? 49 : 55 + Math.abs(demo.vx) * 0.18) - this.camera.fov) * (1 - Math.exp(-dt * 3));
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.clearRemote();
    this.renderer.dispose();
  }
}
