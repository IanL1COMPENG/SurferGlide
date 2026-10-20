import * as THREE from 'three';

const sampleGLSL = `
  float ocean(vec2 p) {
    vec2 w=vec2(p.x,p.y-uDistance);
    float h=sin(dot(w,normalize(vec2(1.,.32)))*.25+uTime*1.25)*.24;
    h+=sin(dot(w,normalize(vec2(-.45,1.)))*.56+uTime*1.6)*.105;
    h+=sin(dot(w,normalize(vec2(.14,1.)))*1.05-uTime*1.9)*.045;
    float aft=p.y+24.; float gate=smoothstep(0.,5.,aft)*(1.-smoothstep(80.,145.,aft));
    float edge=abs(p.x)-aft*.171;
    float wake=exp(-edge*edge*1.1)*.72;
    wake+=exp(-pow(edge+1.65,2.)*.65)*.22;
    wake+=exp(-pow(edge-1.5,2.)*.9)*.18;
    return h+wake*gate+sin(aft*1.5-uTime*3.)*.035*exp(-edge*edge*.4)*gate;
  }
`;

export class CartoonOcean {
  readonly group = new THREE.Group();
  readonly material: THREE.ShaderMaterial;
  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDistance: { value: 0 },
        uDeep: { value: new THREE.Color('#0077ba') },
        uShallow: { value: new THREE.Color('#25d9df') },
        uSky: { value: new THREE.Color('#b8edff') },
      },
      vertexShader: `uniform float uTime;uniform float uDistance;varying vec3 vWorld;${sampleGLSL}
      void main(){vec3 p=position; p.y=ocean(p.xz);vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `uniform float uTime;uniform float uDistance;uniform vec3 uDeep;uniform vec3 uShallow;uniform vec3 uSky;varying vec3 vWorld;
      ${sampleGLSL}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 a=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1,0)),f.x),mix(hash(a+vec2(0,1)),hash(a+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vWorld.xz;float h=ocean(p);float eps=.12;
      vec3 normal=normalize(vec3(h-ocean(p+vec2(eps,0.)),eps,h-ocean(p+vec2(0.,eps))));
      vec3 viewDir=normalize(cameraPosition-vWorld);vec3 light=normalize(vec3(-.4,.85,-.3));
      float fresnel=pow(1.-clamp(dot(normal,viewDir),0.,1.),3.);
      float shade=smoothstep(.15,.92,dot(normal,light));
      vec3 color=mix(uDeep,uShallow,.30+shade*.42+h*.10);
      color=mix(color,uSky,fresnel*.15);
      vec2 uv=vec2(p.x,p.y-uDistance);
      float caustic=sin(uv.x*1.6+sin(uv.y*.8+uTime*.3))*sin(uv.y*1.35+sin(uv.x*.73));
      color+=vec3(.05,.12,.11)*smoothstep(.72,.98,caustic)*.45;
      float spec=pow(max(0.,dot(normal,normalize(light+viewDir))),130.);
      color+=vec3(1.,.96,.70)*spec*.6;
      float aft=p.y+24.;float edge=abs(p.x)-aft*.171;
      float foamNoise=noise(vec2(p.x*2.5,(p.y-uDistance)*1.8));
      float crest=exp(-edge*edge*7.)*(.6+foamNoise*.75);
      float secondary=exp(-pow(edge+1.7,2.)*12.)*.25;
      float propeller=exp(-p.x*p.x*1.2)*smoothstep(1.,5.,aft)*(1.-smoothstep(8.,28.,aft));
      float wakeMask=smoothstep(.5,4.,aft)*(1.-smoothstep(65.,130.,aft));
      float foam=clamp((crest+secondary)*wakeMask+propeller*(.75+foamNoise*.5),0.,1.);
      foam*=smoothstep(.18,.5,foamNoise+.22);
      color=mix(color,vec3(.91,1.,.97),foam);
      float horizon=smoothstep(65.,450.,length(p));color=mix(color,uSky,horizon*.64);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
    const near = new THREE.PlaneGeometry(130, 230, 180, 280);
    near.rotateX(-Math.PI / 2);
    const far = new THREE.PlaneGeometry(1400, 1400, 24, 24);
    far.rotateX(-Math.PI / 2);
    const farMesh = new THREE.Mesh(far, this.material);
    farMesh.position.y = -1.25;
    this.group.add(farMesh, new THREE.Mesh(near, this.material));
  }
  update(time: number, distance: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uDistance.value = distance;
  }
  setCourse(course: 'lagoon' | 'sunset' | 'arctic') {
    this.material.uniforms.uDeep.value.set(
      course === 'sunset' ? '#3974be' : course === 'arctic' ? '#1b75b6' : '#0077ba',
    );
    this.material.uniforms.uShallow.value.set(
      course === 'sunset' ? '#f1bc9a' : course === 'arctic' ? '#6cd5f0' : '#25d9df',
    );
    this.material.uniforms.uSky.value.set(
      course === 'sunset' ? '#ffd5c2' : course === 'arctic' ? '#d9f3ff' : '#b8edff',
    );
  }
  height(x: number, z: number, time: number, distance: number) {
    const wz = z - distance;
    let h = Math.sin(((x + wz * 0.32) / Math.hypot(1, 0.32)) * 0.25 + time * 1.25) * 0.24;
    h += Math.sin(((-x * 0.45 + wz) / Math.hypot(0.45, 1)) * 0.56 + time * 1.6) * 0.105;
    h += Math.sin(((x * 0.14 + wz) / Math.hypot(0.14, 1)) * 1.05 - time * 1.9) * 0.045;
    const aft = z + 24,
      edge = Math.abs(x) - aft * 0.171;
    const smooth = (a: number, b: number, n: number) => {
      const t = THREE.MathUtils.clamp((n - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    };
    const gate = smooth(0, 5, aft) * (1 - smooth(80, 145, aft));
    return (
      h +
      (Math.exp(-edge * edge * 1.1) * 0.72 +
        Math.exp(-((edge + 1.65) ** 2) * 0.65) * 0.22 +
        Math.exp(-((edge - 1.5) ** 2) * 0.9) * 0.18) *
        gate +
      Math.sin(aft * 1.5 - time * 3) * 0.035 * Math.exp(-edge * edge * 0.4) * gate
    );
  }
}
