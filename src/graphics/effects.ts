import * as THREE from 'three';
import { BOARD_EFFECTS } from './assets.ts';
import type { RiderState } from '../core/game.ts';

export class RideEffects {
  readonly points: THREE.Points;
  private readonly count = 380;
  private position = new Float32Array(this.count * 3);
  private velocity = new Float32Array(this.count * 3);
  private life = new Float32Array(this.count);
  private duration = new Float32Array(this.count);
  private alpha = new Float32Array(this.count);
  private size = new Float32Array(this.count);
  private seed = new Float32Array(this.count);
  private cursor = 0;
  private emission = 0;
  private event = -1;
  private material: THREE.ShaderMaterial;
  private board = 'daybreak';
  private reducedMotion = false;
  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'aAlpha',
      new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'aSize',
      new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    for (let i = 0; i < this.count; i++) this.seed[i] = (i * 0.6180339) % 1;
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color('#dbff73') },
        uAccent: { value: new THREE.Color('#ffffff') },
        uMode: { value: 0 },
        uPixel: { value: Math.min(devicePixelRatio, 1.8) },
      },
      vertexShader: `attribute float aAlpha;attribute float aSize;attribute float aSeed;uniform float uPixel;varying float vAlpha;varying float vSeed;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vAlpha=aAlpha;vSeed=aSeed;gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*360.*uPixel/-mv.z,0.,55.);}`,
      fragmentShader: `uniform vec3 uColor;uniform vec3 uAccent;uniform float uMode;varying float vAlpha;varying float vSeed;
      void main(){vec2 p=gl_PointCoord-.5;float r=length(p);float a=atan(p.y,p.x);float mask;
      if(uMode>1.5&&uMode<2.5){mask=(1.-smoothstep(.36,.48,r))*smoothstep(.24,.32,r);mask+=.4*(1.-smoothstep(.02,.08,length(p-vec2(-.14,-.14))));}
      else if(uMode>2.5){float star=r*(1.65-.65*cos(a*4.));mask=1.-smoothstep(.31,.45,star);}
      else{mask=1.-smoothstep(.1,.48,r);}
      vec3 color=mix(uColor,uAccent,vSeed);color=mix(color,vec3(1.),pow(max(0.,1.-r*3.),4.)*.6);
      gl_FragColor=vec4(color,mask*vAlpha); if(gl_FragColor.a<.01)discard;
      #include <colorspace_fragment>
      }`,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  configure(board: string, reducedMotion: boolean) {
    this.board = board;
    this.reducedMotion = reducedMotion;
    const style = BOARD_EFFECTS[board] || BOARD_EFFECTS.daybreak;
    this.material.uniforms.uColor.value.set(style.color);
    this.material.uniforms.uAccent.value.set(style.secondary);
    this.material.uniforms.uMode.value =
      board === 'tidal' ? 2 : ['orchid', 'sunset', 'stealth'].includes(board) ? 3 : 0;
  }
  private emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    life: number,
  ) {
    const i = this.cursor++ % this.count;
    this.position.set([x, y, z], i * 3);
    this.velocity.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.duration[i] = life;
    this.size[i] = size;
  }
  update(dt: number, state: RiderState, x: number, y: number, z: number, menu: boolean) {
    this.emission += dt;
    const motion = menu ? 7 : 19;
    if (!state.airborne && state.wipeout <= 0 && this.emission > 1 / 42) {
      this.emission = 0;
      const n = this.reducedMotion ? 1 : 4;
      for (let j = 0; j < n; j++) {
        const a = Math.random() * Math.PI * 2;
        this.emit(
          x + Math.cos(a) * 0.75,
          y + 0.23,
          z + 0.15 + Math.random() * 0.4,
          (Math.random() - 0.5) * (1 + Math.abs(state.vx) * 0.2),
          0.5 + Math.random() * 1.3,
          motion,
          0.07 + Math.random() * 0.1,
          this.board === 'tidal' ? 1.1 : 0.65 + Math.random() * 0.45,
        );
      }
    }
    if (state.event?.id !== this.event) {
      this.event = state.event?.id ?? -1;
      if (
        (state.event?.type === 'land' && state.event.points > 0) ||
        state.event?.type === 'wipeout'
      ) {
        const n = this.reducedMotion ? 12 : 64;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2;
          const speed = 1.5 + Math.random() * 2;
          this.emit(
            x,
            y + 0.15,
            z,
            Math.cos(a) * speed,
            1.5 + Math.random() * 2,
            Math.sin(a) * speed + motion,
            0.08 + Math.random() * 0.11,
            0.5 + Math.random() * 0.5,
          );
        }
      }
    }
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.position[i * 3] += this.velocity[i * 3] * dt;
        this.position[i * 3 + 1] += this.velocity[i * 3 + 1] * dt;
        this.position[i * 3 + 2] += this.velocity[i * 3 + 2] * dt;
        this.velocity[i * 3 + 1] -= 3.8 * dt;
      }
      this.alpha[i] = Math.max(0, this.life[i] / this.duration[i] || 0) * 0.86;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aAlpha.needsUpdate = true;
    this.points.geometry.attributes.aSize.needsUpdate = true;
  }
  dispose(scene: THREE.Scene) {
    this.points.geometry.dispose();
    this.material.dispose();
    scene.remove(this.points);
  }
}
