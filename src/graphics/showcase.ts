import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAsset, cloneAsset, disposeInstance, BOARD_EFFECTS } from './assets.ts';

/** A short-lived, interactive 3D showroom. Shared geometry stays in the asset cache. */
export class CosmeticShowcase {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private frame = 0;
  private disposed = false;
  private last = performance.now();
  private observer: ResizeObserver;
  private ring: THREE.Mesh;
  private sparkle: THREE.Points;
  readonly ready: Promise<void>;
  constructor(
    private container: HTMLElement,
    kind: 'board' | 'rider',
    id: string,
    celebrate = false,
    reducedMotion = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#efffff', '#537fa5', 2.5));
    const key = new THREE.DirectionalLight('#fff0d7', 3.2);
    key.position.set(3, 6, -4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#b2d4ff', 2);
    rim.position.set(-4, 3, 3);
    this.scene.add(rim);
    this.scene.add(this.root);
    const targetY = kind === 'rider' ? 1.3 : 0.25;
    this.camera.position.set(
      kind === 'rider' ? 3.1 : 2.5,
      kind === 'rider' ? 2.5 : 2.7,
      kind === 'rider' ? -4.8 : -3.5,
    );
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, targetY, 0);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.autoRotate = !reducedMotion;
    this.controls.autoRotateSpeed = celebrate ? 1.2 : 0.65;
    this.controls.minDistance = kind === 'rider' ? 3.4 : 2.4;
    this.controls.maxDistance = 8;
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.025, 8, 80),
      new THREE.MeshBasicMaterial({
        color: BOARD_EFFECTS[id]?.color || '#ffd654',
        transparent: true,
        opacity: 0.6,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.scene.add(this.ring);
    const positions = new Float32Array(38 * 3);
    for (let i = 0; i < 38; i++) {
      const a = i * 2.399;
      positions[i * 3] = Math.cos(a) * (1.4 + (i % 4) * 0.15);
      positions[i * 3 + 1] = 0.3 + (i % 7) * 0.35;
      positions[i * 3 + 2] = Math.sin(a) * (1.4 + (i % 4) * 0.15);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sparkle = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: BOARD_EFFECTS[id]?.color || '#ffd654',
        size: celebrate ? 0.065 : 0.035,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.scene.add(this.sparkle);
    this.ready = Promise.all([
      loadAsset(`${kind}-${id}`),
      kind === 'rider' ? loadAsset('board-daybreak') : Promise.resolve(null),
    ])
      .then(([model, board]) => {
        if (this.disposed) return;
        const object = cloneAsset(model);
        this.root.add(object);
        if (board) this.root.add(cloneAsset(board));
        if (model.animations.length) {
          this.mixer = new THREE.AnimationMixer(object);
          const clip = THREE.AnimationClip.findByName(
            model.animations,
            celebrate ? 'Victory' : 'Cruise',
          );
          if (clip) this.mixer.clipAction(clip).play();
        }
        container.classList.add('ready');
      })
      .catch(() => {
        if (!this.disposed)
          container.innerHTML =
            '<p class="preview-error">The model could not load. Check your connection and try again.</p>';
      });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.animate();
  }
  private resize() {
    const w = this.container.clientWidth || 400,
      h = this.container.clientHeight || 270;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private animate = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.mixer?.update(dt);
    this.controls.update(dt);
    this.sparkle.rotation.y += dt * 0.3;
    this.ring.rotation.z += dt * 0.1;
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.mixer?.stopAllAction();
    disposeInstance(this.root);
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.sparkle.geometry.dispose();
    (this.sparkle.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
