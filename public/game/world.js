import * as THREE from './vendor/three.module.min.js';
import { normalizeCharacter, displayCharacter } from './progress.js';
import { CAMPUS, BUILDINGS, STATIONS, DORM, DORM_STATIONS, ATLANTIC, ATLANTIC_ROOMS, ATLANTIC_STATIONS, ATLANTIC_DESTINATIONS, NPC_STATIONS, WORKSHOP_STATIONS, SAFETY_STATIONS, REST_STATIONS, LOMA_ENTRANCES, TRAINING_GATES, TEACHER_PLAZA, CAMPUS_STATIONS, DORM_DESTINATIONS } from './campus.js';
export { STATIONS, DORM_STATIONS, ATLANTIC, ATLANTIC_STATIONS, ATLANTIC_DESTINATIONS, NPC_STATIONS, WORKSHOP_STATIONS, SAFETY_STATIONS, REST_STATIONS, LOMA_ENTRANCES } from './campus.js';

const C = {
  navy: '#173F4B', ink: '#17343C', teal: '#417D80', mint: '#B8D0BC',
  grass: '#A9C7A1', sand: '#E4D3AF', cream: '#F4EFE1', peach: '#E4A187',
  path: '#E6E3D4', water: '#76BBCC', white: '#FBF9ED', glass: '#6DABB6',
};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const editable = target => target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]');
const mix = (a, b, t) => a + (b - a) * t;
const KNEE_Y = 0.68;   // knee height below the hip joint, in avatar rig units
const HIP_Y = 1.39;    // hip joint height in avatar rig units
const SMALL_SCALE = 0.95;
const STUDENT_TALK_RANGE = 3.2;
const REMOTE_DELAY_MS = 120;
const REMOTE_LIMIT = 30;
const REMOTE_LOW_LIMIT = 15;
const REMOTE_GESTURES = new Set(['wave', 'salute', 'thumbs-up', 'cheer']);
const REMOTE_LOOK_FIELDS = ['gender', 'skin', 'hairColor', 'hairStyle', 'outfit', 'accent', 'body', 'accessory', 'uniformBottom'];

// Background cadets: maritime students in campus or maritime uniform. Walking students can be
// approached for a quick maritime trivia chat; seated students use the same full-size model.
const STUDENT_LOOKS = [
  { name: 'Cadet Ploy', gender: 'female', skin: '#E0AE89', hairColor: '#2B2421', hairStyle: 'bun', outfit: 'maritime-white', accent: '#C9A24A', body: 'slim', accessory: 'cap' },
  { name: 'Cadet Arun', gender: 'male', skin: '#8A5C40', hairColor: '#262625', hairStyle: 'crop', outfit: 'cadet', accent: '#284B79', body: 'regular' },
  { name: 'Cadet Nok', gender: 'female', skin: '#C99570', hairColor: '#50392C', hairStyle: 'bob', outfit: 'maritime', accent: '#C9A24A', body: 'regular', accessory: 'glasses' },
  { name: 'Cadet Krit', gender: 'male', skin: '#BA8061', hairColor: '#332921', hairStyle: 'swept', outfit: 'maritime-white', accent: '#C9A24A', body: 'broad', accessory: 'cap' },
  { name: 'Cadet Fah', gender: 'female', skin: '#DCA479', hairColor: '#523426', hairStyle: 'bun', outfit: 'cadet', accent: '#198879', body: 'regular' },
  { name: 'Cadet Somchai', gender: 'male', skin: '#98603E', hairColor: '#292327', hairStyle: 'crop', outfit: 'maritime', accent: '#C9A24A', body: 'slim', accessory: 'cap' },
];
const studentLook = (index, overrides = {}) => {
  const look = STUDENT_LOOKS[index % STUDENT_LOOKS.length];
  return { ...look, uniformBottom: look.gender === 'female' ? 'skirt' : 'pants', ...overrides };
};

// arms[0]/legs[0] are the cadet's right side (screen left when facing the camera).
// Each pose blends from the idle stance by w (0 → 1 → 0 over the gesture).
const GESTURES = {
  salute: { duration: 1.7, pose({ arms, rest, w }) {
    arms[0].rotation.x = mix(arms[0].rotation.x, -2.75, w);
    arms[0].rotation.z = mix(rest[0], 0.24, w);
  } },
  wave: { duration: 2.0, pose({ arms, rest, w, local }) {
    arms[0].rotation.x = mix(arms[0].rotation.x, -0.25, w);
    arms[0].rotation.z = mix(rest[0], -2.5 + Math.sin(local * 12) * 0.3, w);
  } },
  cheer: { duration: 1.7, pose({ arms, rig, rest, w, local }) {
    const pump = Math.sin(local * 13) * 0.16;
    arms[0].rotation.z = mix(rest[0], -2.85 + pump, w);
    arms[1].rotation.z = mix(rest[1], 2.85 - pump, w);
    rig.position.y += Math.abs(Math.sin(local * 6.5)) * 0.08 * w;
  } },
  'thumbs-up': { duration: 1.8, pose({ arms, rest, w }) {
    arms[0].rotation.x = mix(arms[0].rotation.x, -1.75, w);
    arms[0].rotation.z = mix(rest[0], -0.30, w);
  } },
  jump: { duration: 1.25, pose({ arms, legs, rig, rest, t }) {
    const air = clamp((t - 0.16) / 0.6, 0, 1), lift = Math.sin(Math.PI * air);
    const crouch = t < 0.16 ? Math.sin(Math.PI * t / 0.16) : t > 0.76 ? Math.sin(Math.PI * clamp((t - 0.76) / 0.2, 0, 1)) : 0;
    rig.position.y += lift * 0.34 - crouch * 0.08;
    arms[0].rotation.z = mix(rest[0], -2.4, lift); arms[1].rotation.z = mix(rest[1], 2.4, lift);
    legs[0].rotation.x = legs[1].rotation.x = lift * 0.32;
  } },
};

function roundShape(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export class SeaWorld {
  static STATIONS = STATIONS;

  get isReady() { return !this._failed && !this._disposed && Boolean(this.renderer); }

  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.mode = 'creator';
    this._zone = 'campus';
    this._zoneConfig = CAMPUS;
    this._stations = CAMPUS_STATIONS;
    this.paused = false;
    this.quality = 'high';
    this._resources = new Set();
    this._geometries = new Map();
    this._materials = new Map();
    this._listeners = [];
    this._keys = new Set();
    this._touch = { x: 0, z: 0, run: false };
    this._position = new THREE.Vector3(CAMPUS.spawn.x, 0, CAMPUS.spawn.z);
    this._path = [];
    this._time = 0;
    this._lastMove = 0;
    this._nearId = undefined;
    this._creatorYaw = 0.20;
    this._cameraAngle = Math.PI / 6;
    this._cameraTargetAngle = Math.PI / 6;
    this._cameraDistance = 23;
    this._cameraInput = 0;
    this._trainingGateModels = [];
    this._cameraLook = new THREE.Vector3(CAMPUS.spawn.x, 1, CAMPUS.spawn.z);
    this._collision = BUILDINGS.filter(b => !b.open).map(b => ({ x1:b.x-b.w/2, x2:b.x+b.w/2, z1:b.z-b.d/2, z2:b.z+b.d/2 }));
    this._npcs = [];
    this._remotePlayers = new Map();
    this._remotePool = [];
    this._movementSpeed = 0;
    this._staff = [];
    this._stationRings = [];
    this._canopies = [];
    this._facades = [];
    this._ray = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._clock = new THREE.Clock();
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.22;
      this.scene = new THREE.Scene();
      this.worldCamera = new THREE.PerspectiveCamera(43, 1, 0.1, 240);
      this.creatorCamera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 50);
      this.creatorCamera.position.set(3.0, 3.2, 8.8);
      this.creatorCamera.lookAt(0, 1.8, 0);
      this.camera = this.creatorCamera;
      this.scene.add(new THREE.HemisphereLight('#FFFBEF', '#86A799', 2.4));
      this.sun = new THREE.DirectionalLight('#FFF2D5', 3.3);
      this.sun.position.set(-24, 42, 23);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1536, 1536);
      Object.assign(this.sun.shadow.camera, { left: -47, right: 47, top: 42, bottom: -42, near: 1, far: 110 });
      this.sun.shadow.bias = -0.00015;
      this.sun.shadow.normalBias = 0.035;
      this.scene.add(this.sun);
      this.scene.add(new THREE.AmbientLight('#FFFFFF', 0.25));
      this.creator = new THREE.Group();
      this.world = new THREE.Group();
      this._remoteGroup = new THREE.Group();
      this._remoteGroup.name = 'online-cadets';
      this.scene.add(this.creator, this.world, this._remoteGroup);
      this._buildCreator();
      this._buildWorld();
      this.setCharacter({ gender:'male', uniformBottom:'pants', skin: '#BA8061', hairColor: '#302D2A', hairStyle: 'swept', outfit: 'cadet', accent: '#3E7A80', body: 'regular', accessory: 'none' });
      this._bindEvents();
      this._resize();
      this.setMode('creator');
      this._raf = requestAnimationFrame(() => this._frame());
    } catch (error) {
      this._failed = true;
      this.callbacks.onError?.(error);
    }
  }

  _keep(resource) { this._resources.add(resource); return resource; }

  _g(key, make) {
    if (!this._geometries.has(key)) this._geometries.set(key, this._keep(make()));
    return this._geometries.get(key);
  }

  _m(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!this._materials.has(key)) this._materials.set(key, this._keep(new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra })));
    return this._materials.get(key);
  }

  _box(parent, w, h, d, x, y, z, color, radius = 0.035) {
    const key = `b:${w}:${h}:${d}:${radius}`;
    const geometry = this._g(key, () => {
      if (!radius) return new THREE.BoxGeometry(w, h, d);
      const r = Math.min(radius, w / 3, h / 3, d / 3);
      const g = new THREE.ExtrudeGeometry(roundShape(w - r * 2, h - r * 2, r), {
        depth: d - r * 2, bevelEnabled: true, bevelSegments: 2, steps: 1,
        bevelSize: r, bevelThickness: r, curveSegments: 3,
      });
      g.translate(0, 0, -d / 2 + r);
      return g;
    });
    return this._mesh(parent, geometry, typeof color === 'string' ? this._m(color) : color, x, y, z);
  }

  _mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  _sphere(parent, radius, x, y, z, color, scale = [1, 1, 1], detail = 12) {
    const m = this._mesh(parent, this._g(`s:${radius}:${detail}`, () => new THREE.SphereGeometry(radius, detail, Math.max(6, detail / 2))), typeof color === 'string' ? this._m(color) : color, x, y, z);
    m.scale.set(...scale); return m;
  }

  _cyl(parent, rt, rb, h, x, y, z, color, sides = 12) {
    return this._mesh(parent, this._g(`c:${rt}:${rb}:${h}:${sides}`, () => new THREE.CylinderGeometry(rt, rb, h, sides)), typeof color === 'string' ? this._m(color) : color, x, y, z);
  }

  _capsule(parent, radius, length, x, y, z, material) {
    return this._mesh(parent, this._g(`cap:${radius}:${length}`, () => new THREE.CapsuleGeometry(radius, length, 4, 10)), material, x, y, z);
  }

  _textTexture(text, bg, color = C.navy, width = 512, height = 128, size = 48) {
    const el = document.createElement('canvas'); el.width = width; el.height = height;
    const ctx = el.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color; ctx.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, width / 2, height / 2 + 1, width - 32);
    const texture = this._keep(new THREE.CanvasTexture(el));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  _sign(parent, text, x, y, z, width = 5, bg = C.cream, color = C.navy, height = 0.75) {
    const mat = this._keep(new THREE.MeshStandardMaterial({ map: this._textTexture(text, bg, color), roughness: 1 }));
    const sign = this._mesh(parent, this._g(`p:${width}:${height}`, () => new THREE.PlaneGeometry(width, height)), mat, x, y, z);
    sign.castShadow = false;
    return sign;
  }

  _buildCreator() {
    // Navy, gold and white pedestal for the character screen.
    const shadow = this._keep(new THREE.ShadowMaterial({ color: '#0F2A4A', opacity: 0.13 }));
    const floor = this._mesh(this.creator, this._g('creatorfloor', () => new THREE.PlaneGeometry(200, 200)), shadow, 0, -0.16, 0);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
    this._cyl(this.creator, 1.82, 1.91, 0.24, 0, -0.045, 0, '#1A3D66', 64);
    this._cyl(this.creator, 1.82, 1.82, 0.025, 0, 0.087, 0, '#FBFCFE', 64);
    const rim = this._mesh(this.creator, this._g('creatorrim', () => new THREE.TorusGeometry(1.86, 0.03, 6, 80)), this._m('#C9A24A', { metalness: 0.45, roughness: 0.4 }), 0, 0.07, 0);
    rim.rotation.x = Math.PI / 2;
    const outer = this._mesh(this.creator, this._g('creatorouter', () => new THREE.TorusGeometry(2.3, 0.008, 4, 96)), this._m('#D8C28A'), 0, -0.105, 0);
    outer.rotation.x = Math.PI / 2;
  }

  _buildAvatar(config, small = false, { seated = false } = {}) {
    const group = new THREE.Group(), rig = new THREE.Group(); group.add(rig);
    const personal = new Set();
    const mat = (color, extra = {}) => {
      const m = this._keep(new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra })); personal.add(m); return m;
    };
    const skin = mat(config.skin || '#BA8061');
    const hair = mat(config.hairColor || '#302D2A');
    const accent = mat(config.accent || '#417D80');
    const navy = mat(C.navy), cream = mat(C.white), dark = mat('#293137');
    const white = mat('#FFFFFF'), black = mat('#16191E');
    const suit = mat('#E75C2D'), suitTrim = mat('#C43C25');
    const workshopFabric=mat('#365C75'),workshopSeam=mat('#29475B'),formalNavy=mat('#172C43');
    const reflector = mat('#E7ECE4', { roughness:.30, metalness:.24 });
    const gold = mat('#D8B771'), blush = mat(config.skin || '#BA8061');
    blush.color.multiplyScalar(0.92);
    const outfit = config.outfit || 'cadet';
    const cadet = outfit === 'cadet';
    const immersion = outfit === 'immersion',coverall=outfit==='coverall',maritime=outfit==='maritime',maritimeWhite=outfit==='maritime-white',casual=outfit==='casual';
    const maritimeUniform=maritime||maritimeWhite;
    const uniform = outfit === 'cadet' || outfit === 'officer';
    const skirt = (cadet||maritimeUniform) && config.gender === 'female';
    const shirt = immersion?suit:coverall?workshopFabric:maritime?formalNavy:cadet||casual||maritimeWhite?white:uniform||outfit==='labcoat'?cream:outfit==='blazer'?navy:accent;
    const pants = immersion?suit:coverall?workshopFabric:cadet||maritimeUniform?black:casual?formalNavy:navy;
    const width = config.body === 'slim' ? 0.90 : config.body === 'broad' ? 1.13 : 1;
    const body = this._box(rig, 0.82 * width, 1.0, 0.47, 0, 2.0, 0, shirt, 0.14);
    body.name = 'avatar-shirt';
    this._box(rig, 0.72 * width, 0.30, 0.43, 0, 1.46, 0, pants, 0.1).name='avatar-hip';
    this._box(rig, 0.74 * width, 0.085, 0.46, 0, 1.52, 0, immersion?suit:coverall?workshopFabric:cadet||maritimeUniform?black:casual?formalNavy:navy, 0.02).name='avatar-waist';
    if (!immersion&&!coverall&&!casual) this._box(rig, 0.1, 0.065, 0.025, 0, 1.52, 0.244, gold, 0.009);
    this._capsule(rig, immersion ? .21 : .13, 0.14, 0, 2.55, 0, immersion ? suit : skin);
    const collarL = this._box(rig, 0.19, 0.21, 0.06, -0.105, 2.4, 0.232, immersion?suitTrim:coverall?workshopFabric:cadet||casual||maritimeUniform?white:cream, 0.02);
    const collarR = this._box(rig, 0.19, 0.21, 0.06, 0.105, 2.4, 0.232, immersion?suitTrim:coverall?workshopFabric:cadet||casual||maritimeUniform?white:cream, 0.02);
    collarL.rotation.z = -0.45; collarR.rotation.z = 0.45;
    if (uniform) {
      this._box(rig, 0.045, 0.65, 0.016, 0, 1.97, 0.251, this._m('#E3E6DA'), 0.006);
      for (let i = 0; i < 4; i++) this._sphere(rig, 0.021, 0, 2.24 - i * 0.16, 0.268, navy, [1, 1, 0.5], 8);
      if(outfit==='officer')for (const side of [-1, 1]) {
        const ep = this._box(rig, 0.22, 0.055, 0.35, side * 0.31 * width, 2.465, -0.01, navy, 0.015);
        ep.rotation.z = side * -0.16;
        const stripes = outfit === 'officer' ? 4 : 2;
        for (let i = 0; i < stripes; i++) this._box(rig, 0.026, 0.008, 0.26, side * 0.31 * width + (i - (stripes - 1) / 2) * 0.045, 2.501, 0, gold, 0.003);
      }
      this._box(rig, 0.22, 0.24, 0.03, -0.22 * width, 2.06, 0.248, cadet ? white : cream, 0.02);
      if(!cadet){this._box(rig, 0.21, 0.045, 0.03, -0.22 * width, 2.14, 0.266, accent, 0.009);
      this._sphere(rig, 0.06, 0.21 * width, 2.12, 0.255, gold, [0.8, 1, 0.16], 10);}
    } else if (maritimeWhite) {
      this._box(rig,.042,.79,.022,0,2.03,.259,'#DDE4E3',.007).name='maritime-white-placket';
      this._box(rig,.076,.54,.030,0,2.13,.285,black,.013).name='maritime-white-tie';
      this._box(rig,.108,.12,.034,0,2.415,.292,black,.022);
      for(const side of[-1,1]){
        this._box(rig,.235,.235,.036,side*.235*width,2.095,.264,'#D5DDDC',.022).name='maritime-white-chest-pocket';
        this._box(rig,.213,.204,.026,side*.235*width,2.10,.290,white,.018);
        this._box(rig,.24,.065,.026,side*.235*width,2.193,.300,white,.012);
        this._sphere(rig,.018,side*.235*width,2.181,.320,black,[1,1,.45],8);
        const ep=this._box(rig,.22,.059,.35,side*.32*width,2.468,-.01,black,.015);ep.rotation.z=side*-.13;ep.name='maritime-white-epaulette';
        for(let i=0;i<2;i++)this._box(rig,.027,.013,.27,side*.32*width+(i-.5)*.049,2.51,0,gold,.003).name='maritime-white-rank-stripe';
      }
      this._box(rig,.205,.046,.021,.235*width,2.275,.272,black,.008).name='maritime-white-nameplate';
      this._box(rig,.064,.022,.011,.235*width,2.275,.286,gold,.003);
    } else if (maritime) {
      this._box(rig,.34,.70,.034,0,2.14,.259,white,.018).name='maritime-white-shirt';
      this._box(rig,.073,.48,.027,0,2.18,.286,black,.012).name='maritime-tie';
      this._box(rig,.105,.12,.035,0,2.41,.292,black,.02);
      this._box(rig,.83*width,.30,.48,0,1.47,0,formalNavy,.05).name='maritime-jacket-hem';
      for(const side of[-1,1]){
        const lapel=this._box(rig,.17,.66,.05,side*.19,2.14,.292,formalNavy,.02);lapel.rotation.z=side*-.30;lapel.name='maritime-lapel';
        this._box(rig,.21,.053,.34,side*.32*width,2.466,-.01,black,.015).name='maritime-epaulette';
        for(let i=0;i<2;i++)this._box(rig,.025,.012,.25,side*.32*width+(i-.5)*.047,2.506,0,gold,.003);
        this._box(rig,.22,.055,.027,side*.255*width,1.69,.272,formalNavy,.012);
        for(let i=0;i<3;i++)this._sphere(rig,.027,side*.145,2.02-i*.17,.29,gold,[1,1,.5],10).name='maritime-jacket-button';
      }
    } else if(coverall) {
      // Connected torso, waist and legs use one fabric with a continuous zip.
      this._box(rig,.075,1.14,.033,0,1.98,.261,workshopSeam,.012).name='coverall-continuous-zip';
      this._box(rig,.019,1.06,.018,0,2.00,.282,'#ADC3C9',.004);
      for(const side of[-1,1]){
        this._box(rig,.22,.25,.033,side*.23*width,2.12,.261,workshopFabric,.026).name='coverall-chest-pocket';
        this._box(rig,.23,.041,.019,side*.23*width,2.225,.287,workshopSeam,.008);
        this._box(rig,.22,.12,.021,side*.24*width,1.73,.269,workshopSeam,.017);
      }
    } else if(casual) {
      this._box(rig,.028,.24,.017,0,2.31,.26,'#E9EBE7',.005);
    } else if (outfit === 'polo') {
      this._box(rig, 0.035, 0.27, 0.015, 0, 2.3, 0.26, cream, 0.007);
      this._sphere(rig, 0.055, -0.22 * width, 2.17, 0.258, cream, [1, 1, 0.16], 12);
    } else if (outfit === 'blazer' || outfit === 'labcoat') {
      this._box(rig, 0.32, 0.63, 0.035, 0, 2.11, 0.259, outfit === 'blazer' ? cream : accent, 0.014);
      for (const side of [-1, 1]) {
        const lapel = this._box(rig, 0.16, 0.55, 0.046, side * 0.195, 2.17, 0.283, shirt, 0.016);
        lapel.rotation.z = side * -0.28;
        this._box(rig, 0.19, 0.21, 0.035, side * 0.245 * width, 1.75, 0.255, shirt, 0.018);
      }
      for (let i = 0; i < 3; i++) this._sphere(rig, 0.023, 0, 2.03 - i * 0.16, 0.299, gold, [1, 1, 0.45], 8);
      if (outfit === 'labcoat') {
        this._box(rig, 0.87 * width, 0.62, 0.49, 0, 1.38, 0, cream, 0.06);
        this._box(rig, 0.025, 0.48, 0.02, 0, 1.34, 0.26, accent, 0.004);
        for (const side of [-1, 1]) this._box(rig, 0.24, 0.20, 0.025, side * 0.23 * width, 1.34, 0.265, cream, 0.018);
      }
    } else if (immersion) {
      // Stylized training suit: one-piece orange shell, sealed cuffs, hood,
      // gloves and boots. This model is used in both creator and campus views.
      this._box(rig, .10, .96, .045, 0, 1.99, .256, suitTrim, .015).name = 'immersion-front-zip';
      this._box(rig, .025, .87, .018, 0, 2.01, .286, dark, .004);
      for (const side of [-1, 1]) {
        this._box(rig, .19, .13, .027, side * .235 * width, 2.21, .263, reflector, .008).name = `immersion-chest-reflector-${side}`;
        this._box(rig, .16, .29, .025, side * .27 * width, 1.83, .263, suitTrim, .025);
      }
      this._box(rig, .53 * width, .14, .03, 0, 2.21, -.258, reflector, .008).name = 'immersion-back-reflector';
    } else {
      this._box(rig, 0.025, 0.88, 0.02, 0, 1.99, 0.25, gold, 0.004);
      for (const side of [-1, 1]) {
        this._box(rig, 0.23, 0.23, 0.025, side * 0.22, 2.14, 0.253, accent, 0.025);
        this._box(rig, 0.22, 0.04, 0.015, side * 0.22, 2.23, 0.276, gold, 0.006);
      }
    }
    if (skirt) {
      const garment = this._cyl(rig, .405 * width, .395 * width, .90, 0, 1.14, 0, black, 32);
      garment.scale.z = .66;
      garment.name = 'avatar-uniform-skirt';
      garment.userData.cut='straight-fitted';
      // Seated: the skirt sits at the hips and the thighs (drawn in black below) carry it forward.
      if (seated) { garment.scale.y = .44; garment.position.y = 1.40; }
      // A straight fitted knee-length skirt, with no outward flare at the hem.
      else for (const side of [-1, 1]) this._box(rig, .018, .66, .012, side * .26 * width, 1.09, .323, '#23272C', .003);
    }
    const arms = [], legs = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * 0.49 * width, 2.36, 0); rig.add(arm); arms.push(arm);
      arm.rotation.z = side * 0.09;
      const sideName = side === -1 ? 'left' : 'right';
      this._capsule(arm, immersion ? .164 : .145, 0.23, 0, -0.15, 0, shirt).name = `avatar-${sideName}-upper-sleeve`;
      const longSleeve = uniform || immersion || coverall || maritimeUniform || outfit === 'blazer' || outfit === 'labcoat';
      this._capsule(arm, immersion ? .141 : longSleeve ? .119 : .108, 0.45, 0, -0.62, 0, longSleeve ? shirt : skin).name = `avatar-${sideName}-forearm`;
      this._sphere(arm, immersion ? .155 : .122, 0, -0.975, 0.025, immersion ? suit : skin, [0.91, 1.32, 0.9], 12).name = immersion ? `immersion-${sideName}-glove` : `avatar-${sideName}-hand`;
      if (uniform||maritimeUniform) this._cyl(arm, .126, .126, .072, 0, -.876, 0, shirt).name = `avatar-${sideName}-cuff`;
      if(maritimeWhite)this._sphere(arm,.020,side*.108,-.876,.035,black,[.5,1,1],8).name='maritime-white-cuff-button';
      if (immersion) {
        this._cyl(arm, .147, .147, .075, 0, -.865, 0, suitTrim);
        this._box(arm, .15, .17, .025, 0, -.50, .145, reflector, .008).name = `immersion-${sideName}-arm-reflector`;
        this._sphere(arm, .064, side * .11, -.94, .11, suit, [.7, 1.4, .8], 10);
      }
      if(maritime)for(const y of[-.74,-.81])this._cyl(arm,.125,.125,.035,0,y,0,gold,16).name='maritime-cuff-stripe';
      if(coverall)this._cyl(arm,.123,.123,.075,0,-.868,0,workshopSeam,16).name='coverall-cuff';
      if (outfit === 'polo') this._cyl(arm, 0.148, 0.148, 0.055, 0, -0.295, 0, cream);
      const leg = new THREE.Group(); leg.position.set(side * 0.205 * width, 1.39, 0); rig.add(leg); legs.push(leg);
      this._capsule(leg, (immersion ? .176 : .156) * width, 0.46, 0, -0.34, 0, seated && skirt ? black : skirt||casual ? skin : pants).name = `avatar-${sideName}-upper-leg`;
      this._capsule(leg, (immersion ? .159 : .133) * width, 0.42, 0, -0.94, 0, skirt||casual ? skin : pants).name = `avatar-${sideName}-lower-leg`;
      this._box(leg, (immersion ? .36 : .30) * width, immersion ? .37 : .20, immersion ? .57 : .51, 0, immersion ? -1.17 : -1.255, .1, immersion?suitTrim:cadet||maritimeUniform||coverall?black:casual||outfit==='polo'?cream:dark, .078).name = immersion ? `immersion-${sideName}-boot` : `avatar-${sideName}-shoe`;
      this._box(leg, (immersion ? .37 : .31) * width, .045, immersion ? .57 : .51, 0, -1.339, .105, outfit === 'polo' ? '#C7CCBE' : '#161F24', .02);
      if(casual){
        this._box(leg,.34*width,.60,.37,0,-.21,0,formalNavy,.064).name=`casual-${sideName}-shorts`;
        this._box(leg,.347*width,.050,.38,0,-.51,0,formalNavy,.018);
      }
      if (immersion) this._box(leg, .18, .12, .025, 0, -.76, .164, reflector, .008).name = `immersion-${sideName}-leg-reflector`;
      if (seated) {
        // A knee joint lets a seated cadet bend: everything below the knee moves into its own group.
        const knee = new THREE.Group(); knee.position.set(0, -KNEE_Y, 0); knee.name = `avatar-${sideName}-knee`; leg.add(knee);
        for (const part of leg.children.filter(child => child !== knee && child.position.y < -0.6)) { knee.add(part); part.position.y += KNEE_Y; }
        leg.userData.knee = knee;
      }
    }
    // A complete face remains visible at both portrait and walking scale.
    this._sphere(rig, 1, 0, 2.98, 0, skin, [0.385, 0.445, 0.35], 20);
    for (const side of [-1, 1]) {
      this._sphere(rig, 0.08, side * 0.383, 2.98, 0, skin, [0.7, 1.25, 0.82], 12);
      this._sphere(rig, 0.046, side * 0.138, 3.015, 0.326, cream, [1, 0.9, 0.45], 12);
      this._sphere(rig, 0.030, side * 0.136, 3.014, 0.347, dark, [0.9, 1, 0.48], 12);
      this._sphere(rig, 0.009, side * 0.136 - 0.007, 3.024, 0.36, cream, [1, 1, 0.5], 8);
      const brow = this._capsule(rig, 0.014, 0.085, side * 0.138, 3.115, 0.319, hair);
      brow.rotation.z = Math.PI / 2 + side * 0.08;
      this._sphere(rig, 0.07, side * 0.236, 2.901, 0.278, blush, [1, 0.52, 0.15], 12);
    }
    this._sphere(rig, 0.066, 0, 2.948, 0.350, skin, [0.65, 0.87, 0.78], 12);
    const smileGeom = this._g('smile', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.087, 2.829, 0.319), new THREE.Vector3(0, 2.809, 0.341), new THREE.Vector3(0.087, 2.829, 0.319),
    ]), 10, 0.009, 5, false));
    this._mesh(rig, smileGeom, this._m('#765047'));
    if (immersion) {
      // Leave a front opening instead of drawing an opaque helmet over the face.
      const hood = this._mesh(rig, this._g('immersion-hood', () => new THREE.SphereGeometry(1, 24, 16, Math.PI * .75, Math.PI * 1.5)), suit, 0, 3.015, -.025);
      hood.scale.set(.457, .54, .42); hood.name = 'immersion-hood';
      const rim = this._mesh(rig, this._g('immersion-face-rim', () => new THREE.TorusGeometry(.343, .054, 8, 36)), suitTrim, 0, 3.02, .272);
      rim.scale.set(1, 1.22, 1); rim.name = 'immersion-face-opening';
      this._box(rig, .28, .12, .026, 0, 3.465, .065, reflector, .008).name = 'immersion-hood-reflector';
    }
    const hairstyle = immersion ? 'bald' : config.hairStyle || 'swept';
    if (hairstyle !== 'bald') {
      const cap = this._mesh(rig, this._g('haircap', () => new THREE.SphereGeometry(1, 18, 8, 0, TAU, 0, Math.PI * 0.49)), hair, 0, 3.115, -0.025);
      cap.name = 'avatar-hair-cap';
      cap.scale.set(0.411, 0.34, 0.368);
    }
    if (hairstyle === 'crop') {
      this._sphere(rig, 1, -0.07, 3.335, 0.12, hair, [0.31, 0.14, 0.23], 12);
      for (const side of [-1, 1]) this._box(rig, 0.065, 0.24, 0.17, side * 0.366, 3.065, -0.06, hair, 0.03);
    } else if (hairstyle === 'swept') {
      for (let i = 0; i < 5; i++) {
        const lock = this._sphere(rig, 1, -0.235 + i * 0.095, 3.343 + i * 0.009, 0.16 - i * 0.013, hair, [0.125, 0.125, 0.27], 12);
        lock.rotation.z = -0.44; lock.rotation.x = -0.14;
      }
      this._box(rig, 0.066, 0.23, 0.19, -0.369, 3.064, -0.02, hair, 0.025);
    } else if (hairstyle === 'bob') {
      this._box(rig, 0.79, 0.56, 0.36, 0, 2.957, -0.194, hair, 0.13);
      for (const side of [-1, 1]) this._sphere(rig, 1, side * 0.342, 2.968, -0.011, hair, [0.13, 0.37, 0.26], 16);
      const fringe = this._sphere(rig, 1, -0.11, 3.268, 0.242, hair, [0.30, 0.14, 0.13], 14); fringe.rotation.z = -0.15;
    } else if (hairstyle === 'bun') {
      this._sphere(rig, 0.225, 0, 3.365, -0.305, hair, [1, 1.04, 1], 14);
      const tie = this._mesh(rig, this._g('hairtie', () => new THREE.TorusGeometry(0.125, 0.022, 6, 14)), accent, 0, 3.33, -0.24);
      tie.rotation.x = 0.55;
      this._sphere(rig, 1, -0.07, 3.273, 0.195, hair, [0.32, 0.14, 0.17], 16);
    }
    if (config.accessory === 'glasses') {
      for (const side of [-1, 1]) this._mesh(rig, this._g('glasses', () => new THREE.TorusGeometry(0.084, 0.011, 6, 20)), dark, side * 0.135, 3.013, 0.37);
      this._box(rig, 0.104, 0.018, 0.017, 0, 3.024, 0.378, dark, 0.004);
      for (const side of [-1, 1]) this._box(rig, 0.019, 0.02, 0.24, side * 0.227, 3.035, 0.26, dark, 0.004);
    } else if (config.accessory === 'cap' && !immersion) {
      this._sphere(rig, 1, 0, 3.47, -0.018, maritimeWhite?white:outfit === 'officer' ? cream : navy, [0.441, 0.14, 0.413], 18);
      this._cyl(rig, 0.404, 0.393, 0.1, 0, 3.375, -0.015, navy, 20);
      this._box(rig, 0.62, 0.05, 0.38, 0, 3.365, 0.358, navy, 0.08);
      this._sphere(rig, 0.058, 0, 3.421, 0.392, gold, [0.83, 1, 0.18], 10);
    }
    if (small) group.scale.setScalar(0.95);
    group.userData = {
      rig, body, arms, legs, appearance: { ...config, ...(skirt?{uniformBottom:'skirt'}:{}) }, garment:immersion||coverall?'one-piece':skirt?'straight-fitted-skirt':'separates',
      dispose: () => { for (const m of personal) { m.dispose(); this._resources.delete(m); } },
    };
    return group;
  }

  _animateAvatar(avatar, time, speed = 0) {
    const { arms, legs, body, rig } = avatar.userData;
    const stride = Math.sin(time * (speed > 5 ? 11 : 8.7));
    const amplitude = speed > 0.1 ? Math.min(avatar.userData.garment==='straight-fitted-skirt'?.30:.68, speed * .105) : .015;
    legs[0].rotation.x = stride * amplitude; legs[1].rotation.x = -stride * amplitude;
    arms[0].rotation.x = -stride * amplitude * 0.75; arms[1].rotation.x = stride * amplitude * 0.75;
    body.scale.y = 1 + Math.sin(time * 2.1) * 0.009;
    rig.position.y = speed > 0.1 ? Math.abs(Math.cos(time * (speed > 5 ? 11 : 8.7))) * 0.055 : Math.sin(time * 2.1) * 0.009;
  }

  _hitsPlayer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this._ray.setFromCamera(this._pointer, this.camera);
    return this._ray.intersectObject(this.player, true).length > 0;
  }

  /** Creator reactions stay random; online controls request an explicit world gesture. */
  playGesture(name) {
    if (!this.player || this.mode !== 'creator' && (this.mode !== 'world' || !REMOTE_GESTURES.has(name))) return null;
    const names = ['salute', 'wave', 'cheer', 'jump'].filter(key => key !== this._lastGesture);
    const chosen = GESTURES[name] ? name : names[Math.floor(Math.random() * names.length)];
    this._gesture = { name: chosen, start: this._time }; this._lastGesture = chosen;
    this.callbacks.onGesture?.(chosen);
    return chosen;
  }

  _applyGesture() {
    const gesture = this._gesture; if (!gesture) return;
    if (!this._applyAvatarGesture(this.player, gesture, this._time)) this._gesture = null;
  }

  _applyAvatarGesture(avatar, gesture, time) {
    const { arms, legs, rig } = avatar.userData, spec = GESTURES[gesture.name];
    arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * 0.09; });
    const t = (time - gesture.start) / spec.duration;
    if (avatar.userData.gestureThumb) avatar.userData.gestureThumb.visible = false;
    if (t >= 1) {
      return false;
    }
    // Ease into the pose, hold it, then ease back to the idle stance.
    const ease = x => x * x * (3 - 2 * x);
    const w = t < 0.2 ? ease(t / 0.2) : t > 0.8 ? ease((1 - t) / 0.2) : 1;
    const local = time - gesture.start;
    spec.pose({ arms, legs, rig, w, t, local, rest: [-0.09, 0.09] });
    if (gesture.name === 'thumbs-up' && w > .25) {
      if (!avatar.userData.gestureThumb) {
        const hand = arms[0].children.find(part => /-(hand|glove)$/.test(part.name));
        const thumb = this._mesh(arms[0], this._g('gesture-thumb', () => new THREE.CapsuleGeometry(.048, .12, 3, 8)), hand.material, .105, -.975, .15);
        thumb.name = 'gesture-thumb'; thumb.rotation.x = Math.PI / 2;
        avatar.userData.gestureThumb = thumb;
      }
      avatar.userData.gestureThumb.visible = true;
    }
    return true;
  }

  _remoteNow() { return globalThis.performance?.now?.() ?? Date.now(); }

  /** Presence uses this light view; the existing position/save callback is unchanged. */
  getPresenceState() {
    const moving = this.mode === 'world' && !this.paused && this._movementSpeed > 0.01;
    return { ...this.getPosition(), yaw: this.player?.rotation.y || 0, moving, running: moving && this._movementSpeed > 5 };
  }

  _emitPresenceMove() {
    if (this.mode !== 'world' || !this.callbacks.onPresenceMove) return;
    const state = this.getPresenceState(), last = this._lastPresenceState;
    if (last && Object.keys(state).every(key => state[key] === last[key])) return;
    this._lastPresenceState = state;
    this.callbacks.onPresenceMove({ ...state });
  }

  /** Join details are server-owned; label text is painted, never inserted as HTML. */
  addRemotePlayer(k, look, label) {
    if (this._failed || this._disposed || typeof k !== 'string' || !k || k.length > 64) return false;
    let player = this._remotePlayers.get(k);
    if (!player) {
      if (this._remotePlayers.size >= 100) return false;
      player = { k, samples: [], actor: null, gesture: null, bubble: '', bubbleUntil: 0 };
      this._remotePlayers.set(k, player);
    }
    player.look = displayCharacter(look, this._zone);
    player.lookKey = JSON.stringify(REMOTE_LOOK_FIELDS.map(key => player.look[key]));
    player.label = String(label || 'Cadet').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
    if (player.actor) this._prepareRemoteActor(player.actor, player);
    return true;
  }

  updateRemotePlayer(k, state) {
    const player = this._remotePlayers.get(k);
    if (!player || !state || !['x', 'z', 'yaw'].every(key => Number.isFinite(state[key]))) return false;
    const previous = player.samples.at(-1), now = this._remoteNow();
    const sourceTime = Number.isFinite(state.t) ? state.t : null;
    if (previous && sourceTime !== null && previous.sourceTime !== null && sourceTime <= previous.sourceTime) return false;
    const bounds = this._zoneConfig.bounds;
    const sample = { x: clamp(state.x, bounds.minX, bounds.maxX), z: clamp(state.z, bounds.minZ, bounds.maxZ),
      yaw: Math.atan2(Math.sin(state.yaw), Math.cos(state.yaw)), moving: state.moving === true,
      running: state.moving === true && state.running === true, received: now, sourceTime };
    // A long stationary interval has no snapshots. Give the first new step its
    // usual interpolation window rather than blending across that entire pause.
    if (previous && !previous.moving && now - previous.received > 250) {
      player.samples.push({ ...previous, received: now - 125 });
    }
    player.samples.push(sample);
    if (player.samples.length > 8) player.samples.splice(0, player.samples.length - 8);
    return true;
  }

  removeRemotePlayer(k) {
    const player = this._remotePlayers.get(k);
    if (!player) return false;
    this._releaseRemoteActor(player);
    this._remotePlayers.delete(k);
    this._trimRemotePool();
    return true;
  }

  clearRemotePlayers() {
    for (const player of this._remotePlayers.values()) this._releaseRemoteActor(player);
    this._remotePlayers.clear();
    this._trimRemotePool();
  }

  showRemoteBubble(k, text) {
    const player = this._remotePlayers.get(k);
    if (!player) return false;
    player.bubble = typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100) : '';
    player.bubbleUntil = player.bubble ? this._remoteNow() + 4000 : 0;
    if (player.actor) {
      this._paintRemoteText(player.actor.bubble, player.bubble);
      player.actor.bubble.visible = Boolean(player.bubble);
    }
    return true;
  }

  playRemoteGesture(k, id) {
    const player = this._remotePlayers.get(k);
    if (!player || !REMOTE_GESTURES.has(id)) return false;
    player.gesture = { name: id, start: this._remoteNow() / 1000 };
    return true;
  }

  cancelRemoteGesture(k) {
    const player = this._remotePlayers.get(k);
    if (!player) return false;
    player.gesture = null;
    if (player.actor) {
      this._animateAvatar(player.actor.avatar, this._time, 0);
      player.actor.avatar.userData.arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * 0.09; });
      if (player.actor.avatar.userData.gestureThumb) player.actor.avatar.userData.gestureThumb.visible = false;
    }
    return true;
  }

  _remoteTextSprite(bubble = false) {
    const canvas = document.createElement('canvas');
    canvas.width = bubble ? 768 : 640; canvas.height = 112;
    const texture = this._keep(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const material = this._keep(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(bubble ? 6.4 : 5.4, .94, 1);
    sprite.position.y = bubble ? 5.0 : 4.0;
    sprite.userData = { canvas, texture, bubble, text: null };
    sprite.visible = !bubble;
    return sprite;
  }

  _paintRemoteText(sprite, text) {
    if (sprite.userData.text === text) return;
    const { canvas, texture, bubble } = sprite.userData, ctx = canvas.getContext('2d');
    sprite.userData.text = text;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (text) {
      ctx.beginPath(); ctx.roundRect(3, 3, canvas.width - 6, 96, 22);
      ctx.fillStyle = bubble ? '#FFFCF1' : '#173F4B'; ctx.fill();
      if (bubble) {
        ctx.beginPath(); ctx.moveTo(canvas.width / 2 - 12, 96); ctx.lineTo(canvas.width / 2, 111);
        ctx.lineTo(canvas.width / 2 + 12, 96); ctx.fill();
      }
      ctx.fillStyle = bubble ? '#173F4B' : '#FFFCF1';
      ctx.font = '700 36px "Trebuchet MS", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, 51, canvas.width - 34);
    }
    texture.needsUpdate = true;
  }

  _prepareRemoteActor(actor, player) {
    if (actor.lookKey !== player.lookKey) {
      const fresh = this._buildAvatar(player.look, true);
      if (actor.avatar) {
        // Avatar geometry is shared with the local cadet and NPCs. Only this
        // rig's private materials are released when a pooled look changes.
        actor.avatar.userData.dispose();
        actor.avatar.clear();
        actor.avatar.userData = fresh.userData;
        actor.avatar.add(...[...fresh.children]);
        actor.avatar.scale.copy(fresh.scale);
      } else actor.avatar = fresh;
      actor.lookKey = player.lookKey;
      actor.avatar.add(actor.label, actor.bubble);
    }
    actor.avatar.name = `online-cadet-${player.k}`;
    actor.avatar.userData.remoteKey = player.k;
    actor.avatar.userData.appearance = { ...player.look };
    this._paintRemoteText(actor.label, player.label);
    this._paintRemoteText(actor.bubble, player.bubble);
  }

  _acquireRemoteActor(player) {
    const same = this._remotePool.findIndex(actor => actor.lookKey === player.lookKey);
    const actor = this._remotePool.splice(same < 0 ? this._remotePool.length - 1 : same, 1)[0]
      || { avatar: null, label: this._remoteTextSprite(), bubble: this._remoteTextSprite(true) };
    this._prepareRemoteActor(actor, player);
    player.actor = actor;
    actor.avatar.visible = true;
    this._remoteGroup.add(actor.avatar);
    return actor;
  }

  _releaseRemoteActor(player) {
    const actor = player.actor;
    if (!actor) return;
    actor.avatar.removeFromParent(); actor.avatar.visible = false;
    delete actor.avatar.userData.remoteKey;
    actor.avatar.userData.arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * 0.09; });
    if (actor.avatar.userData.gestureThumb) actor.avatar.userData.gestureThumb.visible = false;
    actor.bubble.visible = false;
    this._paintRemoteText(actor.bubble, '');
    this._paintRemoteText(actor.label, '');
    player.actor = null;
    this._remotePool.push(actor);
  }

  _disposeRemoteActor(actor) {
    actor.avatar.removeFromParent(); actor.avatar.userData.dispose();
    for (const sprite of [actor.label, actor.bubble]) {
      sprite.material.map.dispose(); this._resources.delete(sprite.material.map);
      sprite.material.dispose(); this._resources.delete(sprite.material);
    }
  }

  _trimRemotePool() {
    const limit = this.quality === 'low' ? REMOTE_LOW_LIMIT : REMOTE_LIMIT;
    const used = [...this._remotePlayers.values()].filter(player => player.actor).length;
    while (this._remotePool.length > Math.max(0, limit - used)) this._disposeRemoteActor(this._remotePool.pop());
  }

  _interpolateRemotePlayer(player, now) {
    const samples = player.samples, target = now - REMOTE_DELAY_MS;
    while (samples.length > 2 && samples[1].received <= target) samples.shift();
    let a = samples[0], b = a;
    for (const sample of samples) {
      b = sample;
      if (sample.received >= target) break;
      a = sample;
    }
    const span = b.received - a.received;
    const blend = span > 0 ? clamp((target - a.received) / span, 0, 1) : 1;
    const latest = samples.at(-1), fresh = now - latest.received < 500;
    return { x: mix(a.x, b.x, blend), z: mix(a.z, b.z, blend), yaw: mixAngle(a.yaw, b.yaw, blend),
      moving: fresh && (blend < 1 ? a.moving || b.moving : b.moving), running: fresh && (blend < 1 ? a.running || b.running : b.running) };
  }

  _updateRemotePlayers(now = this._remoteNow()) {
    if (!this._remoteGroup) return;
    this._remoteGroup.visible = this.mode === 'world';
    if (this.mode !== 'world') return;
    const limit = this.quality === 'low' ? REMOTE_LOW_LIMIT : REMOTE_LIMIT;
    const ordered = [...this._remotePlayers.values()].filter(player => player.samples.length)
      .map(player => ({ player, state: this._interpolateRemotePlayer(player, now) }))
      .sort((a, b) => Math.hypot(a.state.x - this._position.x, a.state.z - this._position.z)
        - Math.hypot(b.state.x - this._position.x, b.state.z - this._position.z));
    const visible = new Set(ordered.slice(0, limit).map(item => item.player.k));
    for (const player of this._remotePlayers.values()) if (!visible.has(player.k)) this._releaseRemoteActor(player);
    for (const { player, state } of ordered.slice(0, limit)) {
      const actor = player.actor || this._acquireRemoteActor(player), avatar = actor.avatar;
      avatar.position.set(state.x, this._groundHeight(state.x, state.z), state.z);
      avatar.rotation.y = state.yaw;
      this._animateAvatar(avatar, this._time, state.moving ? state.running ? 7.2 : 4.25 : 0);
      if (player.gesture && !this._applyAvatarGesture(avatar, player.gesture, now / 1000)) player.gesture = null;
      actor.bubble.visible = Boolean(player.bubble) && now < player.bubbleUntil;
    }
    this._trimRemotePool();
  }

  _buildWorld() {
    // Districts retain their own geometry, navigation and markers.
    // Only the active district is visible or receives movement updates.
    this._zones = {};
    this._buildCampus();
    this._zones.campus = this._captureZone(CAMPUS, CAMPUS_STATIONS);
    for(const [id,config,stations,build] of [
      ['dorm',DORM,DORM_DESTINATIONS,()=>this._buildDorm()],
      ['atlantic',ATLANTIC,ATLANTIC_DESTINATIONS,()=>this._buildAtlantic()],
    ]){
      this.world = new THREE.Group();this.world.name=`district-${id}`;
      this.scene.add(this.world);
      this._collision = [];this._npcs = [];this._staff = [];
      this._stationRings = [];this._canopies = [];this._facades = [];
      this.radar = null;
      build();this._zones[id] = this._captureZone(config,stations);
    }
    this._activateZoneData('campus');
  }

  _captureZone(config, stations) {
    return {
      group:this.world, config, stations, collision:this._collision,
      npcs:this._npcs, staff:this._staff, stationRings:this._stationRings,
      canopies:this._canopies, facades:this._facades,
      nearArrow:this.nearArrow, destinationMarker:this.destinationMarker,
      radar:this.radar,
    };
  }

  _activateZoneData(zone) {
    const data = this._zones[zone];
    this._zone = zone;
    this._zoneConfig = data.config;
    this._stations = data.stations;
    this.world = data.group;
    this._collision = data.collision;
    this._npcs = data.npcs;
    this._staff = data.staff;
    this._stationRings = data.stationRings;
    this._canopies = data.canopies;
    this._facades = data.facades;
    this.nearArrow = data.nearArrow;
    this.destinationMarker = data.destinationMarker;
    this.radar = data.radar;
    for (const [id, item] of Object.entries(this._zones)) item.group.visible = id === zone && this.mode === 'world';
  }

  _buildWayfinding(stations) {
    for (const station of stations) this._station(station);
    this.nearArrow = new THREE.Group();
    this._cyl(this.nearArrow, 0.20, 0, 0.35, 0, 0, 0, '#F9CB76', 5).castShadow = false;
    this._cyl(this.nearArrow, 0.072, 0.072, 0.23, 0, 0.25, 0, '#F9CB76', 8).castShadow = false;
    this.nearArrow.visible = false; this.world.add(this.nearArrow);
    this.destinationMarker = this._mesh(this.world, this._g('destinationring', () => new THREE.TorusGeometry(0.43,0.045,6,28)), this._m('#FFFBED'), 0,0.08,0);
    this.destinationMarker.rotation.x = Math.PI / 2; this.destinationMarker.visible = false;
  }

  _buildCampus() {
    // AMCOL's supplied plan is the source of relative building placement.
    // The surrounding ground is continuous land; there is no invented island.
    const lawn = this._mesh(this.world, this._g('campus-land', () => new THREE.PlaneGeometry(340, 260)), this._m('#B3C8A0'), 0, -0.22, 0);
    lawn.rotation.x = -Math.PI / 2; lawn.castShadow = false;
    this._box(this.world, 78, 0.22, 51, 0, -0.11, 0, '#BBCBAA', 0.08);
    this._box(this.world, 165, 0.055, 7, 0, -0.165, 28.8, '#979E93', 0);
    for (let x = -72; x < 74; x += 8) this._box(this.world, 3, 0.009, 0.10, x, -0.132, 28.8, '#DBDEC9', 0).castShadow = false;
    this._box(this.world, 165, 0.025, 0.12, 0, -0.127, 25.7, '#E8E7D8', 0).castShadow = false;
    const path = (x, z, w, d) => this._box(this.world, w, 0.055, d, x, 0.02, z, C.path, 0.02);
    path(-34.8, 6.8, 3.2, 33.5); // West walk from the gate to IMD.
    path(-1.7, 19.6, 65, 3.1);   // Front route, south of the Dome.
    path(-19.5, 2.0, 3.1, 36);   // Open west approach to lifeboat and training.
    path(-3.5, -12.5, 20.3, 3.0); // Rear cross-campus connection.
    path(9.6, -.5, 2.8, 42.0);   // Pacific's east entry through the office passage.
    path(21.0, -14.3, 20, 3.2);  // Workshop forecourt and Atlantic approach.
    path(29.0, 1.0, 1.7, 31.0);  // Atlantic's west-facing corridor.
    path(19.4, -1.2, 19.4, 2.8);
    path(20.1, 13.8, 20.7, 2.6);
    path(-32.0, -6.7, 6.3, 2.7);
    path(-26.6, -7.0, 13.8, 2.8);
    path(-26.5, 2.0, 15.8, 3.0);
    path(9.0, -20.5, 3.0, 3.0);  // Pacific's only entrance, on its right/east side.
    path(-3.0, 18.4, 5.2, 4.4);
    path(12.7,17.6,2.8,7.3);
    path(22.9,19.8,3.0,10.0);
    path(33.1,18.8,2.4,6.9);
    path(26.8,24.0,15.0,1.4);
    path(22.2,15.0,25.0,2.0);
    path(-33, 22.8, 6.7, 6.0);
    for (let x = -29; x <= 12; x += 4) this._box(this.world, 0.026, 0.008, 2.9, x, 0.052, 19.6, '#D2D7C5', 0).castShadow = false;
    for (const b of BUILDINGS) {
      if (b.type === 'dome') this._buildDome(b);
      else if (b.type === 'garden') this._buildGarden(b);
      else this._building(b);
    }
    this._buildWorkshopLocker();
    this._campusGate();
    this._buildSignalMast();
    this._buildLifeboat();
    this._buildTeacherPlaza();
    this._buildTrainingGates();
    // The sketch's front boundary, interrupted by the main entrance.
    this._box(this.world, 66.5, 0.50, 0.25, 4.55, 0.25, 24.5, '#CDD3BD', 0.03);
    for (let x = -28; x < 38; x += 4.5) this._box(this.world, 0.24, 0.91, 0.30, x, 0.455, 24.5, '#DCE0CA', 0.03);
    for (const [x,z,size,palm] of [
      [-36.2,-20,1.0,true],[-36.1,9,.88,true],[-24,22.2,.78,true],[-13,22.5,.84,true],[-2.5,23,.80,true],
      [9.4,22.6,.76,true],[-19.3,-24.1,.65,false],[3.0,-24.2,.65,false],[34.4,-21.6,.78,false],
    ]) this._tree(x,z,size,palm);
    for (const [x,z,rot] of [[-24,17.6,0],[-14,20.4,Math.PI],[-.5,21.5,Math.PI],[11.3,17.5,Math.PI/2],[-33.5,-1.0,Math.PI/2]]) this._bench(x,z,rot);
    for (const [x,z] of [[-30.5,19],[-19,19],[6.5,19],[16.8,13.8],[10.2,-13.7],[-22,-7.0]]) this._lamp(x,z);
    for (const [x,z] of [[-36,-7.4],[-26.5,-8.2],[9.9,-18.5],[31.7,-16.6],[10.6,-2.0],[17.7,-1.2],[21,16.5],[29.5,16.3]]) this._planter(x,z);
    this._buildWayfinding(CAMPUS_STATIONS);
    // Dorm shuttle stop beside the front walk, matching the dormitory's CAMPUS SHUTTLE sign.
    for (const x of [-28.3, -24.7]) this._box(this.world, .12, 2.7, .12, x, 1.35, 22.0, '#5D827D', .015);
    this._sign(this.world, 'DORM SHUTTLE', -26.5, 2.56, 22.05, 4.4, C.navy, C.cream, .60);
    this._box(this.world, 4.6, .10, 1.2, -26.5, 2.98, 21.7, '#5D827D', .02);
    this._buildStaff('campus');
    const routes = [
      [[-19,17.8],[-9,19.5],[-9,17.8],[-19,12]],
      [[-18,-6],[-15,-6],[-15,4],[-18,4]],
      [[10,9],[10,18.8],[14,18.8],[14,9]],
    ];
    routes.forEach((route,i) => this._addStudent('campus',i,route,{phase:i*3,speed:1.2+i*.13}));
  }

  _buildWorkshopLocker() {
    const station = WORKSHOP_STATIONS[0];
    const g = new THREE.Group(); g.position.set(station.modelX, 0, station.modelZ);
    g.name = 'workshop-changing-locker'; g.userData.stationId = station.id;
    this.world.add(g);
    this._box(g, 2.45, .18, 1.20, 0, .09, 0, '#B9C7BA', .05);
    this._box(g, 2.18, 3.02, .85, 0, 1.63, 0, '#375960', .06);
    for (const side of [-1, 1]) {
      this._box(g, .96, 2.70, .07, side * .515, 1.58, .465, '#668082', .025);
      this._box(g, .035, .30, .045, side * .515 + .33, 1.53, .52, '#E2EADD', .007);
      for (let line = 0; line < 3; line++) this._box(g, .57, .045, .012, side * .515, 2.57 - line * .105, .51, '#35575D', .003);
    }
    // A suit silhouette makes this locker identifiable without reading its sign.
    const display = new THREE.Group(); display.position.set(-.51, 1.72, .54); g.add(display);
    this._box(display, .33, .48, .025, 0, 0, 0, '#365C75', .05);
    this._box(display,.21,.10,.025,0,.29,0,'#365C75',.026);
    this._box(display,.028,.48,.02,0,-.01,.025,'#C4D0D1',.004);
    for (const side of [-1, 1]) {
      const arm = this._box(display, .105, .43, .025, side * .20, .02, 0, '#365C75', .03); arm.rotation.z = side * .20;
      this._box(display, .13, .39, .025, side * .10, -.39, 0, '#365C75', .03);
      this._box(display, .075, .052, .014, side * .09, .09, .025, '#E9EDE5', .005);
    }
    this._sign(g, 'CHANGE HERE', 0, 3.31, .16, 2.80, '#F6EDDB', '#8D442C', .48).name = 'workshop-changing-sign';
    this._sign(g, 'ONE-PIECE COVERALL', 0, .49, .53, 1.89, '#375960', '#F9F6EB', .27);
    this._collision.push({x1:station.modelX-1.22,x2:station.modelX+1.22,z1:station.modelZ-.6,z2:station.modelZ+.60});
  }

  _staffBillboard(station, marker = false) {
    const canvas = document.createElement('canvas');
    canvas.width = marker ? 128 : 768;
    canvas.height = marker ? 128 : 144;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (marker) {
      ctx.beginPath(); ctx.arc(64, 64, 53, 0, TAU);
      ctx.fillStyle = '#F4C66F'; ctx.fill();
      ctx.strokeStyle = '#FFFCF1'; ctx.lineWidth = 9; ctx.stroke();
      ctx.fillStyle = '#173F4B'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 80px Arial, sans-serif'; ctx.fillText('!', 64, 68);
    } else {
      ctx.beginPath(); ctx.roundRect(3, 3, 762, 138, 23);
      ctx.fillStyle = '#FFFCF1'; ctx.fill();
      ctx.strokeStyle = station.color; ctx.lineWidth = 6; ctx.stroke();
      ctx.beginPath(); ctx.arc(59, 71, 36, 0, TAU);
      ctx.fillStyle = station.color; ctx.fill();
      ctx.fillStyle = station.numberColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 37px Arial, sans-serif'; ctx.fillText(String(station.staffNumber), 59, 72);
      ctx.textAlign = 'left'; ctx.fillStyle = '#173F4B';
      ctx.font = '700 42px "Trebuchet MS", Arial, sans-serif';
      ctx.fillText(station.name, 113, 53, 625);
      ctx.fillStyle = '#5D746E'; ctx.font = '600 24px "Trebuchet MS", Arial, sans-serif';
      ctx.fillText(station.subtitle, 113, 100, 625);
    }
    const texture = this._keep(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = this._keep(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false, depthWrite:false, sizeAttenuation:false, toneMapped:false }));
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(marker ? .030 : .215, marker ? .030 : .0403, 1);
    sprite.renderOrder = marker ? 8 : 9;
    sprite.userData.stationId = station.id;
    return sprite;
  }

  _buildStaff(zone) {
    this._staff ??= [];
    const staff = NPC_STATIONS.filter(station => station.zone === zone);
    for (const station of staff) {
      const avatar = this._buildAvatar({ ...station.appearance, gender:station.gender }, true);
      const scale = station.npcId === 'yak' ? 1.09 : .97;
      avatar.scale.setScalar(scale);
      avatar.position.set(station.modelX, 0, station.modelZ);
      avatar.rotation.y = station.facing;
      avatar.name = station.id;
      avatar.userData.staffId = station.npcId;
      avatar.userData.stationId = station.id;
      const badge = this._box(avatar.userData.rig, .16, .21, .030, .22, 2.17, .282, C.cream, .014);
      badge.name = 'staff-id-badge';
      this._box(avatar.userData.rig, .12, .035, .012, .22, 2.21, .306, station.color, .004);
      this._box(avatar.userData.rig, .083, .025, .012, .22, 2.13, .306, C.navy, .004);
      const label = this._staffBillboard(station);
      label.name = `${station.id}-name`;
      label.position.set(station.modelX, 3.48 * scale + 1.16, station.modelZ);
      label.userData.worldAnchor=label.position.clone();
      const marker = this._staffBillboard(station, true);
      marker.name = `${station.id}-quest`;
      marker.position.set(station.modelX, 3.48 * scale + .50, station.modelZ);
      this.world.add(avatar, label, marker);
      const actor = { avatar, label, marker, station, stationary:true, phase:station.staffNumber * .9, scale };
      this._staff.push(actor);
      this._npcs.push(actor);
    }
  }

  _updateStaffLabels() {
    if (!this.worldCamera) return;
    // Give nearby names priority. On a narrow screen, keep the entire name tag
    // on screen and stagger nearby cards vertically instead of clipping them.
    const ordered=(this._staff||[]).map(staff=>({staff,distance:Math.hypot(staff.avatar.position.x-this._position.x,staff.avatar.position.z-this._position.z)})).sort((a,b)=>a.distance-b.distance);
    const occupied=[];this.worldCamera.updateMatrixWorld();
    const portrait=this.worldCamera.aspect<.8;
    // The topbar is outside the canvas. Inside a portrait canvas, reserve the
    // cadet/day HUD and the collapsed mission row before placing name cards.
    const topLimit=portrait?Math.min(.90,1-336/(this._height||750)):.90;
    // Reserve the visible teachers' silhouettes as well as their name cards.
    // Portrait cards can move upward, but must not cover a nearby teacher.
    const protectedBodies=ordered.filter(({staff,distance})=>distance<20&&TEACHER_PLAZA.staffIds.includes(staff.station.npcId)).map(({staff})=>{
      const points=[];
      for(const x of[-.90,.90])for(const y of[0,3.60])for(const z of[-.55,.55])points.push(new THREE.Vector3(staff.avatar.position.x+x*staff.scale,y*staff.scale,staff.avatar.position.z+z*staff.scale).project(this.worldCamera));
      return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))};
    });
    for(const {staff,distance} of ordered){
      staff.avatar.visible=distance<49;staff.marker.visible=distance<35;
      staff.marker.position.y=3.48*staff.scale+.50+Math.sin(this._time*2.2+staff.phase)*.06;
      if(staff.label.userData.worldAnchor)staff.label.position.copy(staff.label.userData.worldAnchor);
      const center=staff.label.position.clone().project(this.worldCamera);
      const halfW=staff.label.scale.x*this.worldCamera.projectionMatrix.elements[0]/2;
      const halfH=staff.label.scale.y*this.worldCamera.projectionMatrix.elements[5]/2;
      const originalX=center.x;
      if(portrait&&Math.abs(center.x)<1.22)center.x=clamp(center.x,-.95+halfW,.95-halfW);
      const boxAt=y=>({left:center.x-halfW-.012,right:center.x+halfW+.012,top:y+halfH+.018,bottom:y-halfH-.018});
      const onscreen=center.z>-1&&center.z<1&&Math.abs(originalX)<1.22;
      let candidate=null;
      const step=halfH*2+.055;
      const candidateY=[center.y];
      if(portrait||protectedBodies.length){
        const edges=[...occupied,...protectedBodies].filter(b=>b.left<center.x+halfW+.012&&b.right>center.x-halfW-.012);
        const options=[topLimit-halfH-.019,-.88+halfH+.019,...edges.flatMap(b=>[b.top+halfH+.019,b.bottom-halfH-.019]),...Array.from({length:7},(_,i)=>center.y-(i+1)*step)];
        candidateY.push(...options.filter(y=>y>center.y).sort((a,b)=>a-b),...options.filter(y=>y<center.y).sort((a,b)=>b-a));
      }
      for(const y of candidateY){
        const box=boxAt(y);
        if(box.top>topLimit||box.bottom<-.88||box.right<-.96||box.left>.96)continue;
        if(protectedBodies.some(b=>box.left<b.right&&box.right>b.left&&box.bottom<b.top&&box.top>b.bottom))continue;
        if(!occupied.some(b=>box.left<b.right&&box.right>b.left&&box.bottom<b.top&&box.top>b.bottom)){candidate={y,box};break;}
      }
      staff.label.visible=distance<16&&onscreen&&Boolean(candidate);
      if(staff.label.visible){
        occupied.push(candidate.box);center.y=candidate.y;
        staff.label.position.copy(center.unproject(this.worldCamera));
      }
    }
  }

  _building(b) {
    const g = new THREE.Group();g.name=`building-${b.id}`;g.userData.buildingId=b.id;
    g.userData.floors=b.floors||1;g.position.set(b.x,0,b.z);this.world.add(g);
    const west=b.facing==='west', north=b.facing==='north';
    if(west)g.rotation.y=-Math.PI/2; else if(north)g.rotation.y=Math.PI;
    const w=west?b.d:b.w,d=west?b.w:b.d,h=b.h,wall=b.color,trim=b.trim;
    const floors=b.floors||1,entry=b.entryX||0,floorHeight=h/floors;
    this._box(g,w+.28,.20,d+.28,0,.09,0,'#D3D3C1',.04);
    this._box(g,w,h,d,0,h/2+.10,0,wall,.07).name=`${b.id}-body`;
    this._box(g,w+.32,.26,d+.32,0,h+.23,0,trim,.05);
    this._box(g,w+.12,.10,d+.14,0,h+.40,0,C.cream,.025);
    const front=d/2+.045,glass=this._m(C.glass,{roughness:.35,metalness:.10});
    const rows=floors===4?Array.from({length:4},(_,i)=>({y:1.80+i*floorHeight,floor:i+1})):[{y:2.65,floor:1}];
    const columns=Math.max(2,Math.floor((w-1.4)/2.25));
    const sideCount=Math.max(1,Math.floor((d-1.4)/2.7));
    if(b.type!=='workshop')for(const {y,floor} of rows){
      const level=new THREE.Group();level.name=`${b.id}-floor-${floor}`;level.userData.floor=floor;g.add(level);
      for(let i=0;i<columns;i++){
        const x=(i-(columns-1)/2)*2.25;
        if(!b.sideDoors&&floor===1&&Math.abs(x-entry)<1.6)continue;
        if(b.type==='training'){
          const frame=this._cyl(level,.68,.68,.105,x,y,front,C.cream,20);frame.rotation.x=Math.PI/2;
          const pane=this._cyl(level,.55,.55,.12,x,y,front+.07,glass,20);pane.rotation.x=Math.PI/2;
        }else{
          this._box(level,1.55,1.8,.10,x,y,front,C.white,.025);
          const pane=this._box(level,1.35,1.6,.065,x,y+.01,front+.07,glass,.015);pane.name=`${b.id}-floor-${floor}-window-${i}`;
          this._box(level,.045,1.6,.06,x,y+.01,front+.115,C.cream,.006);
          if(floors===4){
            this._box(level,1.55,1.8,.10,x,y,-front,C.white,.025);
            this._box(level,1.35,1.6,.065,x,y+.01,-front-.07,glass,.015).name=`${b.id}-floor-${floor}-rear-window-${i}`;
          }
        }
      }
      for(const side of[-1,1])for(let i=0;i<sideCount;i++){
        const z=-d/2+1.3+i*2.7;
        if(b.id==='pacific'&&side===1&&floor===1&&Math.abs(z)<1.6)continue;
        this._box(level,.065,1.55,1.42,side*(w/2+.04),y,z,glass,.02).castShadow=false;
      }
      if(floors===4){
        const top=floor*floorHeight+.10;
        this._box(level,w+.14,.19,d+.15,0,top,0,trim,.02).name=`${b.id}-floor-${floor}-band`;
        if(floor<4){
          this._box(level,w-.20,.13,.72,0,top+.02,front+.31,trim,.02).name=`${b.id}-balcony-${floor}`;
          this._box(level,w-.25,.065,.07,0,top+.71,front+.64,'#AFC7C5',.012);
          for(let x=-w/2+.50;x<w/2;x+=2.25)this._box(level,.045,.66,.045,x,top+.38,front+.64,'#AFC7C5',.005);
        }
      }
    }
    if(!b.sideDoors){
    const doorHeight=floors===4?2.67:3.40,doorY=doorHeight/2+.29;
    this._box(g,1.84,doorHeight+.25,.12,entry,doorY,front,C.navy,.035);
    this._box(g,1.61,doorHeight,.06,entry,doorY,front+.09,glass,.025);
    this._box(g,.06,doorHeight,.07,entry,doorY,front+.135,C.cream,.006);
    for(const side of[-1,1])this._box(g,.05,.30,.035,entry+side*.14,1.65,front+.19,'#CEB27A',.008);
    this._box(g,2.8,.12,.70,entry,.075,front+.30,C.cream,.02);
    this._box(g,3.2,.18,1.05,entry,floors===4?3.15:3.96,front+.43,trim,.04);
    }else this._buildSideEntrances(g,b,glass);
    if(b.type!=='cafe')this._sign(g,b.id==='loma-lounge'?'LOMA LOUNGE':b.name,0,h-.34,front+.09,Math.min(w-1.0,17.5),wall,C.navy,floors===4?.54:.64);
    if(floors===4)this._sign(g,'4 STOREYS',w/2-2.15,3.67,front+.14,3.40,trim,C.cream,.44).name=`${b.id}-four-storey-sign`;
    if(b.id==='pacific'){
      this._sign(g,'MATHEMATICS  /  SCIENCE  /  ENGLISH',0,3.68,front+.14,Math.min(w-8,19.5),trim,C.cream,.48);
    }
    if(b.id==='imd')this._sign(g,'INTERNATIONAL MARITIME DEPARTMENT',0,.72,front+.09,w-1.3,wall,C.teal,.45);
    if(b.type==='training'){
      const buoy=this._mesh(g,this._g('training-buoy',()=>new THREE.TorusGeometry(.37,.11,7,24)),this._m('#D49A76'),2.0,1.5,front+.16);
      buoy.castShadow=false;
      this._box(g,3.2,.16,1.2,-4.2,h+.61,0,C.navy,.03);
    }
    if(b.type==='workshop'){
      for(const side of[-1,1]){
        this._box(g,3.8,2.9,.12,side*3.13,1.7,front,'#899C99',.025);
        for(let row=0;row<7;row++)this._box(g,3.73,.035,.035,side*3.13,.49+row*.38,front+.085,'#BCC8BC',0);
      }
      this._box(g,w-.7,.12,1.8,0,4.05,front+.6,trim,.02);
      this._sign(g,'WORKSHOP COVERALL REQUIRED',0,3.63,front+1.53,7.3,'#E75C2D','#FFF9EF',.44).name='workshop-training-sign';
      for(const side of[-1,1])this._box(g,1.1,.55,1.0,side*2.6,h+.68,-.6,'#BCC5B8',.07);
    }
    if(b.type==='simulators'){
      this._sign(g,'BRIDGE  /  ENGINE  /  ECDIS  /  GMDSS',0,3.68,front+.14,w-8.1,trim,C.cream,.48);
      this._sign(g,'ENTER ATLANTIC',0,.71,front+.11,4.2,wall,C.navy,.40);
      this._cyl(g,.055,.09,2.3,-w/2+2,h+1.6,0,C.cream,8);
      for(const y of[h+1.4,h+2.2])this._box(g,1.4,.06,.06,-w/2+2,y,0,C.cream,.01);
      this.radar=new THREE.Group();this.radar.position.set(w/2-3,h+.8,0);g.add(this.radar);
      this._cyl(this.radar,.13,.20,.6,0,0,0,C.cream,8);
      this._box(this.radar,1.85,.25,.18,0,.42,0,C.cream,.04);
    }
    if(b.type==='cafe'){
      this._box(g,w-.25,.15,1.8,0,4.15,front+.73,trim,.03);
      for(let i=0;i<6;i++)this._box(g,(w-.35)/6,.045,1.8,-(w-.35)/2+(i+.5)*(w-.35)/6,4.25,front+.73,i%2?C.cream:trim,.01);
      this._sign(g,'LOMA CAFÉ',0,4.13,front+1.66,5.5,trim,C.cream,.49);
    }
    if(b.type==='lounge'){
      this._box(g,w-.3,.16,1.72,0,3.94,front+.66,trim,.03);
      this._sign(g,'SEMESTER FINAL EXAMS',0,3.92,front+1.59,6.7,trim,C.cream,.43);
    }
    // Exterior buildings fade only when they obstruct the camera's view of the cadet.
    // Private material copies avoid fading another building that shares its color.
    const copies=new Map();
    g.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const source=mesh.material;
      if(!copies.has(source)){
        const material=this._keep(source.clone());material.transparent=true;
        copies.set(source,material);
      }
      mesh.material=copies.get(source);
    });
    this._facades??=[];
    this._facades.push({buildingId:b.id,materials:[...copies.values()],opacity:1,box:new THREE.Box3().setFromObject(g)});
  }

  _buildSideEntrances(parent,b,glass) {
    const axis=new THREE.Vector3(0,1,0);
    for(const entry of b.sideDoors){
      const side=entry.side==='west'?-1:1;
      const door=new THREE.Group();door.name=`${entry.id}-side-door`;door.userData.stationId=entry.id;door.userData.side=entry.side;
      door.position.copy(new THREE.Vector3(side*(b.w/2+.06),0,entry.offset).applyAxisAngle(axis,-parent.rotation.y));
      door.rotation.y=side*Math.PI/2-parent.rotation.y;parent.add(door);
      this._box(door,1.80,2.84,.13,0,1.48,0,'#244550',.035).name=b.id==='pacific'?'pacific-door-frame':'loma-door-frame';
      this._box(door,1.53,2.57,.07,0,1.48,.09,glass,.025).name=b.id==='pacific'?'pacific-east-glass-door':'loma-side-glass-door';
      this._box(door,.045,2.57,.055,0,1.48,.15,C.cream,.008);
      for(const x of[-.12,.12])this._box(door,.045,.32,.055,x,1.43,.20,'#D9BD87',.009);
      this._box(door,2.8,.14,1.10,0,.08,.38,'#E4DDC9',.05);
      this._box(door,2.65,.16,1.10,0,3.01,.34,b.trim,.05);
      this._sign(door,entry.side==='west'?'WEST ENTRANCE':'EAST ENTRANCE',0,3.32,.1,3.15,C.cream,C.navy,.35);
      this._sign(door,b.id==='pacific'?'PACIFIC':b.id==='loma-lounge'?'FINAL EXAMS':'LOMA CAFÉ',0,2.63,.17,1.48,b.trim,C.cream,.23);
    }
  }

  _buildTrainingGates() {
    this._trainingGateModels??=[];
    const color='#DAB465',dark='#5B6D68';
    for(const gate of TRAINING_GATES){
      const g=new THREE.Group();g.name=`${gate.id}-outfit-entry-gate`;g.userData.requiredOutfit=gate.outfit;this.world.add(g);
      const panel=new THREE.Group();panel.name=`${gate.id}-gate-panel`;g.add(panel);
      if(gate.id==='workshop'){
        panel.position.set(gate.bounds.x1,0,gate.door.z);
        this._box(panel,3.6,.14,.10,1.8,.93,0,color,.025);
        this._box(panel,3.6,.09,.08,1.8,.53,0,dark,.02);
        for(const x of[gate.bounds.x1,gate.bounds.x2])this._cyl(g,.10,.13,1.4,x,.70,gate.door.z,dark,10);
        this._sign(g,'ONE-PIECE COVERALL',gate.door.x,1.49,gate.door.z+.10,3.35,C.cream,C.navy,.34);
      }else{
        const b=gate.bounds;
        panel.position.set(b.x2,0,gate.door.z-1.4);
        this._box(panel,.10,.14,2.8,0,.93,1.4,color,.025);
        this._box(panel,.08,.09,2.8,0,.53,1.4,dark,.02);
        const rails=[{x1:b.x1,z1:b.z1,x2:b.x2,z2:b.z1},{x1:b.x1,z1:b.z2,x2:b.x2,z2:b.z2},{x1:b.x1,z1:b.z1,x2:b.x1,z2:b.z2},{x1:b.x2,z1:b.z1,x2:b.x2,z2:gate.door.z-1.4},{x1:b.x2,z1:gate.door.z+1.4,x2:b.x2,z2:b.z2}];
        for(const rail of rails){
          const cx=(rail.x1+rail.x2)/2,cz=(rail.z1+rail.z2)/2,w=Math.abs(rail.x2-rail.x1)||.10,d=Math.abs(rail.z2-rail.z1)||.10;
          this._box(g,w,.095,d,cx,.94,cz,dark,.02);this._box(g,w,.07,d,cx,.45,cz,dark,.015);
          this._collision.push({x1:Math.min(rail.x1,rail.x2)-.075,x2:Math.max(rail.x1,rail.x2)+.075,z1:Math.min(rail.z1,rail.z2)-.075,z2:Math.max(rail.z1,rail.z2)+.075});
          for(const point of[[rail.x1,rail.z1],[rail.x2,rail.z2]])this._cyl(g,.09,.12,1.15,point[0],.57,point[1],dark,10);
        }
        const sign=this._sign(g,'IMMERSION SUIT',b.x2,1.63,gate.door.z,3.6,C.cream,C.navy,.39);sign.rotation.y=Math.PI/2;
      }
      this._trainingGateModels.push({id:gate.id,requiredOutfit:gate.outfit,panel,openAngle:gate.id==='lifeboat'?-Math.PI/2:Math.PI/2});
    }
    this._updateTrainingGateModels();
  }

  _buildDome(b) {
    const g=new THREE.Group();g.position.set(b.x,0,b.z);this.world.add(g);
    this._box(g,b.w,.075,b.d,0,.04,0,'#D6D9CB',.025);
    for(let x=-b.w/2+3;x<b.w/2;x+=3)this._box(g,.022,.008,b.d-.15,x,.082,0,'#BCC6B8',0).castShadow=false;
    for(let z=-b.d/2+3;z<b.d/2;z+=3)this._box(g,b.w-.15,.008,.022,0,.082,z,'#BCC6B8',0).castShadow=false;
    const eave=Math.max(4.7,b.h*.65),verts=[],indices=[],segments=24;
    for(let side=0;side<2;side++)for(let i=0;i<=segments;i++){
      const t=i/segments;verts.push(-b.w/2+b.w*t,eave+(b.h-eave)*Math.sin(Math.PI*t),side?-b.d/2:b.d/2);
    }
    for(let i=0;i<segments;i++){const a=i,c=i+segments+1;indices.push(a,a+1,c,a+1,c+1,c);}
    const geometry=this._keep(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=this._keep(new THREE.MeshStandardMaterial({color:b.color,roughness:.78,side:THREE.DoubleSide,transparent:true,opacity:.92,depthWrite:false}));
    const roof=this._mesh(g,geometry,material);roof.castShadow=true;roof.renderOrder=2;
    this._canopies.push({material,bounds:{x1:b.x-b.w/2,x2:b.x+b.w/2,z1:b.z-b.d/2,z2:b.z+b.d/2},normal:.92,fade:.12});
    for(let row=0;row<5;row++){
      const z=-b.d/2+b.d*row/4,points=[];
      for(let i=0;i<=24;i++){const t=i/24;points.push(new THREE.Vector3(-b.w/2+b.w*t,eave+(b.h-eave)*Math.sin(Math.PI*t)-.025,z));}
      const rib=this._keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.085,5,false));
      this._mesh(g,rib,this._m(b.trim));
      for(const side of[-1,1]){
        this._box(g,.26,eave,.29,side*(b.w/2-.10),eave/2,z,b.trim,.025);
        const x=b.x+side*(b.w/2-.10),zz=b.z+z;
        this._collision.push({x1:x-.16,x2:x+.16,z1:zz-.17,z2:zz+.17});
      }
    }
    for(const side of[-1,1])this._box(g,.14,.18,b.d,side*(b.w/2-.04),eave-.05,0,b.trim,.02);
    this._sign(g,'DOME',0,b.h-.48,b.d/2+.13,4.3,C.cream,C.navy,.82);
    this._sign(g,'AMCOL',0,b.h-.48,-b.d/2-.13,4.3,C.cream,C.navy,.82).rotation.y=Math.PI;
    this._buildPresentationStage(g, b);
  }

  _buildPresentationStage(g, b) {
    const stageShift=-(b.d-21)/2;
    const stage=new THREE.Group();stage.name='dome-presentation-stage';stage.position.z=stageShift;g.add(stage);
    this._box(stage,17,.52,3.5,0,.31,-7.55,'#B39A76',.05);
    this._box(stage,17.15,.07,3.65,0,.60,-7.55,'#C9B38D',.02);
    this._box(stage,4.4,.16,.65,0,.13,-5.43,'#C9B38D',.025);
    this._box(stage,4.4,.30,.46,0,.28,-5.85,'#C9B38D',.025);
    const screenBacking=this._box(stage,11.0,6.30,.20,0,3.90,-9.62,C.navy,.05);
    screenBacking.name='dome-screen-backing';
    screenBacking.material=this._keep(screenBacking.material.clone());screenBacking.material.transparent=true;
    this._box(stage,1.05,1.35,.7,4.5,1.29,-6.9,'#416E72',.035);
    this._box(stage,1.2,.10,.86,4.5,2.01,-6.9,C.cream,.025);
    this._cyl(stage,.025,.035,.55,4.48,2.30,-6.93,C.navy,6).rotation.z=-.17;
    this._sphere(stage,.06,4.43,2.57,-6.93,C.navy,[1,1.5,1],8);
    for(const x of[-9.2,9.2]){
      this._box(stage,.85,1.75,.9,x,1.16,-8.4,'#354C52',.07);
      this._collision.push({x1:b.x+x-.43,x2:b.x+x+.43,z1:b.z+stageShift-8.85,z2:b.z+stageShift-7.95});
    }
    this._collision.push({x1:b.x+3.95,x2:b.x+5.05,z1:b.z+stageShift-7.28,z2:b.z+stageShift-6.52});
    this._presentationCanvas=document.createElement('canvas');
    this._presentationCanvas.width=1280;this._presentationCanvas.height=720;
    this._presentationTexture=this._keep(new THREE.CanvasTexture(this._presentationCanvas));
    this._presentationTexture.colorSpace=THREE.SRGBColorSpace;
    const screenMaterial=this._keep(new THREE.MeshBasicMaterial({map:this._presentationTexture,toneMapped:false,transparent:true}));
    const screen=this._mesh(stage,this._g('presentation-screen',()=>new THREE.PlaneGeometry(10.6,5.9625)),screenMaterial,0,3.90,-9.505);
    screen.castShadow=false;
    this._presentationScreen=screen;
    this._facades.push({buildingId:'dome-screen',materials:[screenBacking.material,screenMaterial],opacity:1,box:new THREE.Box3(new THREE.Vector3(b.x-5.5,.75,b.z+stageShift-9.74),new THREE.Vector3(b.x+5.5,7.05,b.z+stageShift-9.49))});
    this.setPresentationSlide({title:'Your voice. Your next chapter.',lines:['Prepare your presentation in Pacific.','Present to fellow cadets and teachers.','Visit the Academic Office for today’s missions.']});
    const skins=['#BA8061','#E0AE89','#895B40','#CA9773'];
    for(let row=0;row<3;row++)for(const side of[-1,1]){
      const x=side*5.25,z=-1.0+row*3.1;
      this._box(g,6.15,.15,.88,x,.66,z,'#A89070',.025);
      this._box(g,6.15,.8,.13,x,1.14,z+.50,'#A89070',.025);
      for(const leg of[-1,1])this._box(g,.18,.60,.7,x+leg*2.55,.30,z,C.navy,.02);
      this._collision.push({x1:b.x+x-3.12,x2:b.x+x+3.12,z1:b.z+z-.58,z2:b.z+z+.65});
      for(let seat=0;seat<2;seat++)this._audiencePerson(g,x+(seat?1.65:-1.65),z,skins[(row+seat+(side+1)/2)%skins.length],row===0&&seat===0?'#537E79':C.cream,Math.PI);
    }
  }

  /** A seated maritime student: the same full-size cadet model as the walking students, posed on a seat. */
  _audiencePerson(parent,x,z,skin,shirt,rotation=0,seatTop=.735) {
    this._seatedCount=(this._seatedCount||0)+1;
    const avatar=this._buildAvatar(studentLook(this._seatedCount,{skin}),true,{seated:true});
    const { rig, arms, legs } = avatar.userData;
    // Hips just above the seat, thighs forward over it, shins down to the floor, hands on the lap.
    rig.position.y=(seatTop+.04)/SMALL_SCALE-HIP_Y;
    for(const leg of legs){leg.rotation.x=-Math.PI/2;leg.userData.knee.rotation.x=Math.PI/2;}
    arms.forEach((arm,i)=>{arm.rotation.x=-.62;arm.rotation.z=(i?1:-1)*.04;});
    // Sit back on the seat: the hip moves behind the seat centre, opposite the facing direction.
    const back=.24;avatar.position.set(x-Math.sin(rotation)*back,0,z-Math.cos(rotation)*back);avatar.rotation.y=rotation;
    avatar.userData.seated=true;parent.add(avatar);
    return avatar;
  }

  /** Update the big screen without recreating world geometry or the texture. */
  setPresentationSlide({title='Cadet presentation',lines=[]}={}) {
    if(!this._presentationCanvas)return false;
    const ctx=this._presentationCanvas.getContext('2d');
    if(!ctx)return false;
    ctx.fillStyle='#F3F1DF';ctx.fillRect(0,0,1280,720);
    ctx.fillStyle='#224D56';ctx.fillRect(0,0,1280,95);
    ctx.fillStyle='#F5F1DF';ctx.font='700 27px Arial, sans-serif';ctx.fillText('AMCOL  /  CADET PRESENTATION',72,59);
    const wrap=(value,maxWidth,font)=>{
      ctx.font=font;const rows=[];let row='';
      for(const word of String(value).slice(0,800).split(/\s+/)){
        const next=row?`${row} ${word}`:word;
        if(row&&ctx.measureText(next).width>maxWidth){rows.push(row);row=word;}else row=next;
      }
      if(row)rows.push(row);return rows;
    };
    ctx.fillStyle='#193E47';
    const titleRows=wrap(title,1120,'700 52px Arial, sans-serif').slice(0,2);
    titleRows.forEach((line,i)=>ctx.fillText(line,72,171+i*64,1120));
    let y=titleRows.length>1?323:265;
    for(const line of(Array.isArray(lines)?lines:[]).slice(0,4)){
      if(y>600)break;
      ctx.fillStyle='#52847C';ctx.beginPath();ctx.arc(84,y-12,7,0,TAU);ctx.fill();
      ctx.fillStyle='#36575B';
      const rows=wrap(line,1045,'400 32px Arial, sans-serif').slice(0,2);
      for(const row of rows){ctx.fillText(row,111,y,1045);y+=43;}
      y+=19;
    }
    ctx.fillStyle='#6F8980';ctx.font='400 20px Arial, sans-serif';ctx.fillText('Learn · Practise · Explain',72,677);
    this._presentationTexture.needsUpdate=true;return true;
  }

  _buildGarden(b) {
    const g=new THREE.Group();g.position.set(b.x,0,b.z);this.world.add(g);
    this._box(g,b.w,.07,b.d,0,.035,0,'#D8DCC7',.025);
    // Palm Garden is open to the sky: outdoor tables and palms, without a roof.
    this._box(g,5.9,.88,1.25,-.15,.46,-b.d/2+1.25,'#96A88B',.075);
    this._box(g,6.15,.12,1.4,-.15,.94,-b.d/2+1.25,C.cream,.025);
    this._collision.push({x1:b.x-3.2,x2:b.x+3,z1:b.z-b.d/2+.50,z2:b.z-b.d/2+2.0});
    for(const z of[-1.4,4.2]){
      this._cyl(g,1.03,1.03,.13,-1.7,1.10,z,'#BEA37D',16);
      this._cyl(g,.09,.16,1.03,-1.7,.54,z,b.trim,10);
      for(const side of[-1,1]){
        this._box(g,.48,.1,1.9,-1.7+side*1.42,.64,z,'#BEA37D',.035);
        this._box(g,.10,.60,1.55,-1.7+side*1.42,.3,z,b.trim,.015);
      }
      this._collision.push({x1:b.x-4.0,x2:b.x+.1,z1:b.z+z-1.1,z2:b.z+z+1.1});
    }
    this._box(g,.12,2.55,.12,2.55,1.28,b.d/2-.24,b.trim,.015);
    this._box(g,.12,2.55,.12,4.40,1.28,b.d/2-.24,b.trim,.015);
    this._sign(g,'PALM GARDEN',3.48,2.18,b.d/2-.16,2.6,C.cream,C.navy,.42);
    this._sign(g,'EAT · RELAX',3.48,1.73,b.d/2-.16,2.6,C.cream,b.trim,.34);
    this._audiencePerson(g,-3.15,4.2,'#BA8061','#E0A58B',Math.PI/2,.69);
    this._audiencePerson(g,-.26,-1.4,'#D5AA86',C.cream,-Math.PI/2,.69);
    for(const [x,z] of[[b.x+b.w/2-1.0,b.z-3.6],[b.x+b.w/2-1.0,b.z+4.2]])this._tree(x,z,.80,true);
  }

  _buildAtlantic() {
    this.world.userData.district='atlantic';this.world.userData.cutaway=true;
    const ground=this._mesh(this.world,this._g('atlantic-ground',()=>new THREE.PlaneGeometry(180,150)),this._m('#BCCDCB'),0,-.24,0);
    ground.rotation.x=-Math.PI/2;ground.castShadow=false;
    this._box(this.world,50.2,.22,42.2,0,-.11,0,'#CAD4CF',.12).name='atlantic-interior-foundation';
    this._box(this.world,8,.035,40,0,.028,0,'#ECE6D4',.03).name='atlantic-central-hall';
    for(let z=-18;z<20;z+=2)this._box(this.world,7.7,.009,.025,0,.05,z,'#D7D0BB',0).castShadow=false;
    const wall=(w,d,x,z,name)=>{
      this._box(this.world,w,1.20,d,x,.60,z,'#98ADA8',.035).name=name;
      this._box(this.world,w+.035,.065,d+.035,x,1.22,z,'#E9E9DC',.018);
      this._collision.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2,id:name});
    };
    wall(.26,41.1,-24.35,0,'atlantic-outer-west-wall');
    wall(.26,41.1,24.35,0,'atlantic-outer-east-wall');
    wall(48.95,.26,0,-20.45,'atlantic-outer-north-wall');
    wall(48.95,.26,0,20.45,'atlantic-outer-south-wall');
    for(const room of ATLANTIC_ROOMS)this._buildAtlanticRoom(room);
    // Solid divider strips close the small seams between adjacent room blocks.
    for(const z of[-5.5,9.5])wall(20,1,-14,z,`atlantic-west-divider-${z}`);
    wall(20,2,14,1,'atlantic-east-divider');
    const welcome=this._sign(this.world,'ATLANTIC · INTERIOR',0,3.10,-20.30,7.1,'#254E62',C.cream,.66);
    welcome.name='atlantic-interior-welcome-sign';
    this._sign(this.world,'OFFICES & SIMULATORS',0,2.42,-20.28,7.1,C.cream,'#315B68',.46);
    const exit=this._sign(this.world,'EXIT TO CAMPUS',0,3.05,20.28,6.7,'#4C7468',C.cream,.65);
    exit.name='atlantic-exit-sign';
    for(const x of[-3.45,3.45])this._box(this.world,.12,2.90,.12,x,1.47,20.27,'#4C7468',.02);
    const lobby=this._sign(this.world,'ATLANTIC LOBBY',0,.075,9.1,5.8,'#ECE6D4','#506E6B',.72);
    lobby.rotation.x=-Math.PI/2;lobby.castShadow=false;lobby.name='atlantic-lobby-floor-sign';
    this._buildWayfinding(ATLANTIC_DESTINATIONS);
    this._buildStaff('atlantic');
  }

  _buildAtlanticRoom(room) {
    const g=new THREE.Group();g.name=`atlantic-room-${room.id}`;
    g.position.set(room.x,0,room.z);g.userData.roomId=room.id;g.userData.stationId=room.stationId;g.userData.cutaway=true;
    this.world.add(g);
    const solid=(w,h,d,x,y,z,color,name)=>{
      const mesh=this._box(g,w,h,d,x,y,z,color,.025);mesh.name=name;
      this._collision.push({x1:room.x+x-w/2,x2:room.x+x+w/2,z1:room.z+z-d/2,z2:room.z+z+d/2,id:name});
      return mesh;
    };
    this._box(g,room.w,.035,room.d,0,.028,0,room.color,.025).name=`atlantic-${room.id}-floor`;
    const hallSide=room.doorSide==='east'?1:-1,doorZ=room.doorZ-room.z;
    for(const z of[-room.d/2,room.d/2]){
      solid(room.w,.98,.20,0,.49,z,'#AFBDB3',`atlantic-${room.id}-room-wall`);
      this._box(g,room.w,.07,.24,0,1.01,z,room.trim,.02);
    }
    for(const [from,to]of[[-room.d/2,doorZ-room.doorWidth/2],[doorZ+room.doorWidth/2,room.d/2]]){
      if(to<=from)continue;
      solid(.20,.98,to-from,hallSide*room.w/2,.49,(from+to)/2,'#AFBDB3',`atlantic-${room.id}-hall-wall`);
      this._box(g,.24,.07,to-from,hallSide*room.w/2,1.01,(from+to)/2,room.trim,.02);
    }
    const doorway=new THREE.Group();doorway.name=`${room.stationId}-doorway`;doorway.userData.clearWidth=room.doorWidth;
    doorway.position.set(hallSide*room.w/2,0,doorZ);g.add(doorway);
    this._box(doorway,.70,.03,room.doorWidth,0,.070,0,'#F1E3B4',.02);
    for(const z of[-room.doorWidth/2,room.doorWidth/2])this._box(doorway,.22,2.65,.18,0,1.325,z,room.trim,.025);
    // A low cutaway leaves the whole room visible. There is no roof or lintel
    // above the walking route; side posts mark the generous doorway opening.
    const plaqueY=room.id==='bridge'?5.55:room.id==='captain'?4.65:room.id==='engine'?4.8:room.id==='ecdis'?5.65:room.id==='gmdss'?5.25:3.45;
    const plaque=this._sign(g,room.name.toUpperCase(),0,plaqueY,-room.d/2+.18,Math.min(14.8,room.w-2),room.trim,C.cream,.79);
    plaque.name=`atlantic-${room.id}-room-sign`;
    for(const x of[-7.15,7.15])this._box(g,.075,2.9,.08,x,1.53,-room.d/2+.11,'#9AAC9F',.015);

    if(room.id==='captain'){
      this._buildAtlanticExecutive(g,room,solid);
    }else if(room.id==='bridge'){
      this._buildAtlanticBridge(g,room,solid);
    }else if(room.id==='engine'){
      this._buildAtlanticEngine(g,room,solid);
    }else if(room.id==='ecdis'){
      this._buildAtlanticEcdis(g,room,solid);
    }else if(room.id==='gmdss'){
      this._buildAtlanticGmdss(g,room,solid);
    }
  }

  _atlanticSurface(kind) {
    const key=`atlantic-surface-${kind}`;
    if(this._materials.has(key))return this._materials.get(key);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const c=canvas.getContext('2d');
    if(kind==='wood'){
      c.fillStyle='#A87B53';c.fillRect(0,0,512,512);
      for(let row=0;row<12;row++){
        const y=row*44;c.fillStyle=['#B18A62','#A97C53','#BE956B','#A98159'][row%4];c.fillRect(0,y,512,43);
        c.strokeStyle='#916B49';c.lineWidth=1;c.beginPath();c.moveTo(0,y+43);c.lineTo(512,y+43);c.stroke();
        const joint=(row%3)*159+65;c.fillRect(joint,y,1,43);
        for(let n=0;n<5;n++){c.strokeStyle=n%2?'#AA8058':'#C49A70';c.beginPath();c.moveTo(0,y+5+n*7);c.bezierCurveTo(140,y+n*7,320,y+13+n*7,512,y+5+n*7);c.stroke();}
      }
    }else{
      const steel=kind==='steel',chartLab=kind==='chart-lab',radioLab=kind==='radio-lab';c.fillStyle=chartLab?'#B4C7B9':radioLab?'#778598':steel?'#7C8A89':'#344E5B';c.fillRect(0,0,512,512);
      c.strokeStyle=chartLab?'#93ADA0':radioLab?'#64768A':steel?'#5F716F':'#293F4B';c.lineWidth=3;
      for(let n=0;n<=8;n++){const p=n*64;c.beginPath();c.moveTo(p,0);c.lineTo(p,512);c.moveTo(0,p);c.lineTo(512,p);c.stroke();}
      c.strokeStyle=chartLab?'#BCCDC0':radioLab?'#8392A2':steel?'#99A5A0':'#42606B';c.lineWidth=1;
      for(let y=8;y<512;y+=16)for(let x=8;x<512;x+=16){c.beginPath();c.moveTo(x,y);c.lineTo(x+5,y-3);c.stroke();}
    }
    const texture=this._keep(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
    const material=this._keep(new THREE.MeshStandardMaterial({map:texture,roughness:kind==='wood'?.64:.87,metalness:kind==='steel'?.22:0}));
    this._materials.set(key,material);return material;
  }

  _atlanticFloor(parent,room,kind) {
    const floor=this._mesh(parent,this._g(`atlantic-floor-${room.w}-${room.d}`,()=>new THREE.PlaneGeometry(room.w-.26,room.d-.26)),this._atlanticSurface(kind),0,.055,0);
    floor.rotation.x=-Math.PI/2;floor.castShadow=false;floor.name=`atlantic-${room.id}-finished-floor`;
    for(const z of[-room.d/2+.14,room.d/2-.14])this._box(parent,room.w-.32,.13,.055,0,.17,z,room.id==='captain'?'#D5BD91':'#546D70',.005);
  }

  _atlanticPlant(parent,x,z,size=1) {
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);g.name='atlantic-room-plant';parent.add(g);
    this._cyl(g,.46,.33,.76,0,.39,0,'#E5DFCE',16);
    this._cyl(g,.43,.43,.05,0,.78,0,'#5C5945',16);
    this._cyl(g,.046,.065,1.48,0,1.43,0,'#6E7851',8);
    for(let n=0;n<7;n++){const a=n*2.4;const leaf=this._sphere(g,.31,Math.sin(a)*.32,1.36+n*.13,Math.cos(a)*.25,n%2?'#426D59':'#5B8060',[.69,1.43,.28],10);leaf.rotation.z=Math.sin(a)*.75;leaf.rotation.y=a;}
    return g;
  }

  _atlanticChair(parent,x,z,yaw=0,large=false) {
    const g=new THREE.Group();g.name='atlantic-operator-chair';g.position.set(x,0,z);g.rotation.y=yaw;parent.add(g);
    const upholstery=this._m('#213C50',{roughness:.66});
    this._box(g,large?1.30:1.05,.24,1.03,0,.86,0,upholstery,.12);
    this._box(g,large?1.30:1.05,large?1.65:1.25,.20,0,large?1.70:1.50,-.44,upholstery,.11);
    this._box(g,.055,large?1.35:.94,.015,0,large?1.70:1.50,-.324,'#4E6773',.005);
    this._cyl(g,.095,.13,.68,0,.43,0,'#869797',12);
    for(const side of[-1,1]){this._box(g,.10,.39,.10,side*.59,1.09,.16,'#687E85',.018);this._box(g,.17,.11,.80,side*.59,1.30,0,upholstery,.04);}
    for(let n=0;n<5;n++){const leg=this._box(g,.12,.10,.65,0,.12,.26,'#687E85',.025);leg.rotation.y=n*Math.PI*.4;leg.position.x=Math.sin(n*Math.PI*.4)*.26;leg.position.z=Math.cos(n*Math.PI*.4)*.26;}
    return g;
  }

  _buildAtlanticExecutive(g,room,solid) {
    this._atlanticFloor(g,room,'wood');
    const wood=this._atlanticSurface('wood'),brass=this._m('#C9AA6E',{roughness:.38,metalness:.55}),navy=this._m('#233C50',{roughness:.74});
    this._box(g,8.0,.018,7.8,.1,.074,.4,'#344F60',.02).name='atlantic-ceo-rug';
    for(const x of[-3.72,3.92])this._box(g,.042,.012,7.25,x,.09,.4,'#BBA277',0);
    for(const z of[-3.2,4])this._box(g,7.62,.012,.042,.1,.09,z,'#BBA277',0);
    // The executive feature wall stays at the back, clear of every approach.
    solid(12.8,3.85,.26,0,1.97,-6.71,'#E9E3D1','atlantic-ceo-feature-wall');
    this._box(g,8.6,2.48,.11,0,2.62,-6.50,navy,.04);
    for(const x of[-5.97,-5.52,-5.07,5.07,5.52,5.97])this._box(g,.18,3.45,.15,x,2.00,-6.48,wood,0);
    this._sign(g,'AMCOL',0,3.05,-6.40,4.8,'#233C50','#E9D9B0',.91).name='atlantic-ceo-amcol-plaque';
    this._sign(g,'THE AMCOL WAY',0,2.17,-6.39,7.45,'#233C50','#F6F0DF',.56).name='atlantic-ceo-amcol-way';
    this._box(g,7.45,.032,.035,0,1.78,-6.38,brass,.004);
    solid(5.0,1.17,2.0,0,.655,0,wood,'atlantic-ceo-desk');
    this._box(g,5.22,.17,2.18,0,1.325,0,wood,0);
    this._box(g,4.72,.69,.036,0,.70,1.014,navy,.022);
    this._box(g,4.81,.032,.040,0,1.096,1.036,brass,.005);
    for(const x of[-2.10,2.10])for(const y of[.35,.68,1.01])this._box(g,.51,.018,.036,x,y,1.039,'#CDB28A',.003);
    this._sign(g,'CAPT. CHALERMVUT · CEO',0,.76,1.048,3.38,'#233C50','#F1E2C0',.31).name='atlantic-ceo-desk-nameplate';
    this._atlanticDisplay(g,-.90,1.44,-.26,1.78,.99,'LEADERSHIP','office');
    this._box(g,1.53,.027,.48,-.89,1.432,.58,'#344F60',.026);
    for(let n=0;n<4;n++)this._box(g,1.25,.004,.012,-.89,1.449,.42+n*.075,'#A7B4B4',0);
    this._box(g,.86,.06,.61,.90,1.46,.27,'#F3EEDF',.01);
    for(let n=0;n<4;n++)this._box(g,.55,.004,.014,.89,1.493,.11+n*.10,'#A9B8B2',0);
    for(let n=0;n<3;n++)this._box(g,.49,.064,.73,1.67,1.44+n*.068,-.46,['#344F60','#B99062','#6C9188'][n],.015);
    this._cyl(g,.12,.15,.31,2.13,1.60,.42,brass,12);
    for(let n=0;n<3;n++){const pen=this._cyl(g,.013,.013,.39,2.09+n*.035,1.84,.42,'#2C4652',6);pen.rotation.z=(n-1)*.17;}
    this._cyl(g,.26,.29,.055,-2.05,1.443,-.53,brass,16);
    this._cyl(g,.035,.035,.73,-2.05,1.83,-.53,brass,10);
    this._cyl(g,.25,.40,.41,-2.05,2.30,-.53,'#ECE1C5',18);
    this._atlanticChair(g,0,-4.14,0,true);
    solid(1.45,.02,1.62,0,.075,-4.14,'#344F60','atlantic-ceo-chair-footprint').visible=false;
    // Open shelves and display awards have small, bounded furniture footprints.
    solid(3.35,2.95,.87,-7.75,1.54,-5.6,wood,'atlantic-ceo-bookcase');
    this._box(g,2.99,2.65,.055,-7.75,1.55,-5.12,'#544C3E',0);
    for(let shelf=0;shelf<3;shelf++){
      const y=.35+shelf*.83;this._box(g,3.13,.082,.30,-7.75,y,-5.06,wood,0);
      for(let n=0;n<8;n++)this._box(g,.23,.49+(n%3)*.08,.25,-9.09+n*.355,y+.35,-4.995,['#486774','#C3AD7C','#ECE2C8','#6A877B'][n%4],.009);
    }
    solid(3.12,1.09,1.24,7.48,.605,-5.64,wood,'atlantic-ceo-award-cabinet');
    for(const x of[6.55,7.48,8.41]){
      this._box(g,.84,.72,.028,x,.69,-5.001,'#E2D5B8',.02);
      this._box(g,.18,.032,.046,x,.98,-4.98,brass,.006);
      this._box(g,.40,.11,.35,x,1.235,-5.64,navy,.025);
      this._cyl(g,.055,.10,.31,x,1.44,-5.64,brass,10);
      const cup=this._cyl(g,.23,.11,.29,x,1.73,-5.64,brass,14);cup.name='atlantic-ceo-award';
    }
    this._sign(g,'CADET EXCELLENCE',7.48,2.42,-6.10,3.50,'#EEE7D6','#6F6249',.37);
    solid(4.15,.31,1.57,-6.23,.70,4.72,navy,'atlantic-ceo-guest-sofa');
    this._box(g,4.15,1.08,.25,-6.23,1.20,5.43,navy,.12);
    for(const x of[-8.15,-4.31])this._box(g,.29,.60,1.48,x,1.00,4.70,navy,.10);
    for(const x of[-7.16,-5.3])this._box(g,1.66,.15,1.20,x,.94,4.60,'#3F5C6D',.085);
    solid(2.73,.12,1.22,-6.23,.67,2.48,wood,'atlantic-ceo-coffee-table');
    for(const x of[-7.34,-5.12])this._box(g,.12,.58,.83,x,.34,2.48,brass,.02);
    this._box(g,.74,.06,.54,-6.24,.77,2.48,'#ECE4CF',.015);
    this._atlanticPlant(g,8.02,4.77,1.15);this._atlanticPlant(g,-8.72,-1.94,.95);
  }

  _buildAtlanticBridge(g,room,solid) {
    this._atlanticFloor(g,room,'deck');
    const navy=this._m('#183341',{roughness:.57}),metal=this._m('#799598',{roughness:.42,metalness:.35});
    for(const z of[-1.10,5.96])this._box(g,17.7,.012,.05,-.20,.074,z,'#A7C9C0',0);
    solid(18.70,4.74,.23,-.1,2.45,-6.70,navy,'atlantic-bridge-panorama-wall');
    this._atlanticPanorama(g);
    solid(13.20,1.15,1.96,-1.35,.66,-3.87,navy,'atlantic-bridge-console');
    this._box(g,13.40,.16,2.13,-1.35,1.30,-3.87,metal,.07);
    this._box(g,12.64,.52,.036,-1.35,.77,-2.875,'#345767',.025);
    for(const x of[-7.18,-3.35,.48,4.30])this._box(g,3.42,.026,.051,x,.57,-2.851,'#6C8588',0);
    for(const x of[-8.23,5.55]){
      solid(1.34,1.15,3.07,x,.66,-3.35,navy,'atlantic-bridge-console-wing');
      this._box(g,1.48,.15,3.23,x,1.30,-3.35,metal,.065);
    }
    this._atlanticDisplay(g,-5.66,1.40,-4.08,2.68,1.45,'RADAR · SIMULATION','radar');
    this._atlanticDisplay(g,-1.64,1.40,-4.08,2.68,1.45,'CONNING DISPLAY','conning');
    this._atlanticDisplay(g,2.37,1.40,-4.08,2.68,1.45,'ROUTE PLANNING','chart');
    for(const x of[-6.42,-5.91,-5.40,-4.89,.00,.51,1.02,1.53]){
      this._box(g,.28,.07,.21,x,1.43,-3.21,'#183341',.025);
      this._box(g,.15,.022,.105,x,1.478,-3.21,x<0?'#76BAA5':'#DFB96C',.012);
    }
    const wheel=new THREE.Group();wheel.name='atlantic-bridge-helm';wheel.position.set(-1.64,1.92,-2.77);g.add(wheel);
    this._mesh(wheel,this._g('atlantic-helm-ring',()=>new THREE.TorusGeometry(.57,.065,8,40)),this._m('#CFB879',{metalness:.48,roughness:.38}));
    for(let n=0;n<4;n++){const spoke=this._box(wheel,.045,1.12,.055,0,0,0,'#728A8F',.008);spoke.rotation.z=n*Math.PI/4;}
    this._sphere(wheel,.16,0,0,.04,'#193845',[1,1,.56]);
    this._sign(wheel,'HELM',0,0,.135,.26,'#193845','#E0CC9B',.09);
    this._box(g,.72,1.21,.44,-1.64,.71,-2.94,navy,.09);
    const throttle=new THREE.Group();throttle.name='atlantic-bridge-throttle';throttle.position.set(4.47,1.43,-3.39);g.add(throttle);
    this._box(throttle,.61,.17,.55,0,0,0,'#253E49',.035);
    for(const x of[-.17,.17]){const lever=this._cyl(throttle,.026,.026,.51,x,.30,0,'#BAC4BD',8);lever.rotation.x=-.22;this._sphere(throttle,.09,x,.55,-.056,x<0?'#BF755D':'#698F85',[1.2,.7,1.4],12);}
    this._atlanticChair(g,-4.80,-.21,0);
    solid(1.47,.02,1.65,-4.80,.075,-.21,'#344F60','atlantic-bridge-chair-footprint').visible=false;
    solid(3.77,.11,2.03,-6.29,1.08,4.13,'#C8C8B3','atlantic-bridge-chart-table');
    for(const x of[-7.87,-4.72])this._box(g,.18,.96,1.50,x,.56,4.13,navy,.025);
    const chart=this._sign(g,'PASSAGE PLANNING',-6.29,1.15,4.15,3.30,'#AEC5B8','#365965',.85);chart.rotation.x=-Math.PI/2;
    this._box(g,3.41,.015,.04,-6.29,1.164,3.36,'#778E84',0);
    this._sign(g,'CAPT. JAKK · BRIDGE TRAINING',-.05,1.16,-6.53,11.36,'#183341','#E3EADC',.39).name='atlantic-bridge-staff-plaque';
  }

  _atlanticPanorama(parent) {
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=480;
    const c=canvas.getContext('2d'),sky=c.createLinearGradient(0,0,0,260);sky.addColorStop(0,'#719AAD');sky.addColorStop(1,'#D5E1D4');c.fillStyle=sky;c.fillRect(0,0,1536,480);
    const sea=c.createLinearGradient(0,208,0,480);sea.addColorStop(0,'#51879A');sea.addColorStop(1,'#1C5268');c.fillStyle=sea;c.fillRect(0,207,1536,273);
    c.fillStyle='#98B5B3';c.beginPath();c.moveTo(0,206);for(let x=0;x<580;x+=30)c.lineTo(x,191-Math.sin(x*.018)*21-Math.cos(x*.04)*8);c.lineTo(650,208);c.closePath();c.fill();
    c.fillStyle='#6C8E90';for(let n=0;n<14;n++)c.fillRect(26+n*29,180-(n%4)*10,20,28+(n%4)*10);
    c.strokeStyle='#BFD6CC';for(let n=0;n<30;n++){const x=(n*173)%1500,y=232+n*7;c.globalAlpha=.25+(n%4)*.08;c.lineWidth=1.2;c.beginPath();c.moveTo(x,y);c.lineTo(x+24+n*2,y);c.stroke();}c.globalAlpha=1;
    c.fillStyle='#213F4C';c.beginPath();c.moveTo(1160,247);c.lineTo(1268,247);c.lineTo(1249,264);c.lineTo(1176,264);c.closePath();c.fill();c.fillRect(1184,221,58,26);c.fillStyle='#D3DCCE';c.fillRect(1198,212,24,12);
    for(const [x,y,col]of[[690,304,'#D4AA65'],[950,294,'#B36153']]){c.fillStyle=col;c.fillRect(x-3,y-18,6,20);c.beginPath();c.moveTo(x-10,y+2);c.lineTo(x+10,y+2);c.lineTo(x+6,y+9);c.lineTo(x-6,y+9);c.closePath();c.fill();}
    c.fillStyle='#E6E4CA';c.beginPath();c.moveTo(654,480);c.lineTo(768,391);c.lineTo(882,480);c.closePath();c.fill();c.strokeStyle='#789595';c.lineWidth=4;c.beginPath();c.moveTo(768,396);c.lineTo(768,480);c.stroke();
    c.fillStyle='#183944';c.fillRect(0,0,1536,34);c.fillStyle='#DEEBDF';c.font='700 18px Arial';c.textAlign='left';c.fillText('BRIDGE SIMULATION  /  TRAINING VIEW',22,24);c.textAlign='right';c.fillText('AMCOL',1512,24);
    for(let n=0;n<3;n++){
      const panel=document.createElement('canvas');panel.width=512;panel.height=480;panel.getContext('2d').drawImage(canvas,n*512,0,512,480,0,0,512,480);
      const texture=this._keep(new THREE.CanvasTexture(panel));texture.colorSpace=THREE.SRGBColorSpace;
      const group=new THREE.Group();group.name='atlantic-bridge-panorama-panel';group.position.set((n-1)*5.88,3.08,n===1?-6.49:-6.12);group.rotation.y=(1-n)*.12;parent.add(group);
      this._box(group,5.96,3.22,.14,0,0,-.02,'#1A3440',.028);
      const screen=this._mesh(group,this._g('atlantic-panorama-panel',()=>new THREE.PlaneGeometry(5.73,2.97)),this._keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})),0,0,.06);screen.name='atlantic-bridge-panorama-screen';screen.castShadow=false;
      this._box(group,5.68,.036,.045,0,-1.55,.076,'#81B0AD',.005);
    }
  }

  _atlanticGauge(parent,x,y,z,label,value) {
    const g=new THREE.Group();g.position.set(x,y,z);g.name='atlantic-engine-gauge';parent.add(g);
    const rim=this._cyl(g,.27,.27,.075,0,0,0,'#B3BFBA',24);rim.rotation.x=Math.PI/2;
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;const c=canvas.getContext('2d');
    c.fillStyle='#F1EEDB';c.fillRect(0,0,192,192);c.strokeStyle='#57716C';c.lineWidth=5;c.beginPath();c.arc(96,96,78,Math.PI*.8,Math.PI*2.2);c.stroke();
    for(let n=0;n<9;n++){const a=Math.PI*(.8+n*.175);c.lineWidth=3;c.beginPath();c.moveTo(96+Math.cos(a)*64,96+Math.sin(a)*64);c.lineTo(96+Math.cos(a)*73,96+Math.sin(a)*73);c.stroke();}
    c.strokeStyle='#B46045';c.lineWidth=5;c.beginPath();c.moveTo(96,96);c.lineTo(135,53);c.stroke();c.fillStyle='#36544F';c.font='700 23px Arial';c.textAlign='center';c.fillText(value,96,129);c.font='700 17px Arial';c.fillText(label,96,156);
    const texture=this._keep(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
    const dial=this._mesh(g,this._g('atlantic-gauge-face',()=>new THREE.CircleGeometry(.238,28)),this._keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})),0,0,.043);dial.castShadow=false;
  }

  _buildAtlanticEngine(g,room,solid) {
    this._atlanticFloor(g,room,'steel');
    const dark=this._m('#334E52',{roughness:.58,metalness:.30}),steel=this._m('#A4B7B0',{roughness:.39,metalness:.58}),green=this._m('#527F72',{roughness:.64,metalness:.19});
    solid(17.7,3.30,.21,0,1.73,-9.70,'#D3D8CB','atlantic-engine-pipeline-wall');
    this._box(g,17.2,.19,.13,0,.98,-9.55,dark,.016);
    for(const [y,color]of[[2.68,'#B78559'],[3.06,'#587F94']]){
      const pipe=this._cyl(g,.10,.10,16.40,0,y,-9.39,color,10);pipe.rotation.z=Math.PI/2;
      for(const x of[-7,-3,1,5,7.5])this._box(g,.085,.48,.25,x,y,-9.48,steel,.012);
    }
    this._sign(g,'ENGINE SYSTEMS · SIMULATION',0,3.91,-9.53,12.4,'#344F53','#F4E8C6',.54).name='atlantic-engine-systems-plaque';
    // Painted borders make the machinery footprint legible without blocking it.
    const hazard=document.createElement('canvas');hazard.width=512;hazard.height=64;const hc=hazard.getContext('2d');hc.fillStyle='#D5B457';hc.fillRect(0,0,512,64);hc.fillStyle='#34484B';
    for(let x=-64;x<576;x+=64){hc.beginPath();hc.moveTo(x,0);hc.lineTo(x+30,0);hc.lineTo(x+94,64);hc.lineTo(x+64,64);hc.closePath();hc.fill();}
    const ht=this._keep(new THREE.CanvasTexture(hazard));ht.colorSpace=THREE.SRGBColorSpace;const hm=this._keep(new THREE.MeshStandardMaterial({map:ht,roughness:.94}));
    for(const [x,z,width,depth]of[[2,-7.28,9.12,.37],[2,-1.13,9.12,.37],[-2.43,-4.2,.37,6.45],[6.43,-4.2,.37,6.45]]){
      const strip=this._mesh(g,this._g(`hazard-${width}-${depth}`,()=>new THREE.PlaneGeometry(width,depth)),hm,x,.077,z);strip.rotation.x=-Math.PI/2;strip.name='atlantic-engine-hazard-marking';strip.castShadow=false;
    }
    const engine=new THREE.Group();engine.name='atlantic-engine-model';engine.position.set(2,0,-4.2);g.add(engine);
    solid(8,.34,4.8,2,.26,-4.2,dark,'atlantic-engine-skid');
    this._box(engine,7.36,.22,4.25,0,.48,0,steel,.025);
    this._box(engine,6.45,1.62,3.12,-.23,1.37,0,green,.10);
    this._box(engine,6.80,.22,3.35,-.23,2.28,0,steel,.035);
    for(const x of[-2.51,-.23,2.05]){
      this._box(engine,1.84,.90,.12,x,1.24,1.615,'#3D685E',.045);
      for(const dx of[-.72,.72])for(const y of[.92,1.59])this._sphere(engine,.041,x+dx,y,1.694,steel,[1,1,.48],8);
      this._cyl(engine,.61,.69,.97,x,2.84,0,green,16).name='engine-cylinder';
      this._cyl(engine,.72,.72,.18,x,3.40,0,steel,16);
      this._cyl(engine,.50,.55,.18,x,3.58,0,dark,16);
      this._box(engine,.82,.30,.61,x,3.82,0,green,.055);
      const pipe=this._cyl(engine,.087,.087,1.73,x,2.40,1.94,'#B9885D',10);pipe.name='engine-service-pipe';
      const valve=this._mesh(engine,this._g('atlantic-valve',()=>new THREE.TorusGeometry(.23,.044,7,24)),this._m('#B3644D',{metalness:.27,roughness:.5}),x,2.11,2.05);valve.name='engine-training-valve';
      for(let n=0;n<3;n++){const spoke=this._box(engine,.027,.43,.034,x,2.11,2.055,'#B3644D',.004);spoke.rotation.z=n*Math.PI/3;}
      this._atlanticGauge(engine,x,2.91,2.065,'BAR',String(4+Math.round(x+2.51)));
      const exhaust=this._cyl(engine,.13,.13,.70,x,3.66,-.83,steel,12);exhaust.rotation.x=Math.PI/2;
    }
    const manifold=this._cyl(engine,.20,.20,6.18,-.23,3.66,-1.17,steel,14);manifold.rotation.z=Math.PI/2;
    const coolant=this._cyl(engine,.095,.095,6.31,-.23,.87,1.99,'#548DA5',10);coolant.rotation.z=Math.PI/2;
    for(const x of[-3.12,2.70]){const pipe=this._cyl(engine,.095,.095,.88,x,1.25,1.99,'#548DA5',10);pipe.name='engine-coolant-pipe';}
    const flywheel=this._cyl(engine,1.02,1.02,.55,3.31,1.53,0,dark,24);flywheel.rotation.z=Math.PI/2;flywheel.name='atlantic-engine-flywheel';
    const hub=this._cyl(engine,.65,.65,.60,3.36,1.53,0,steel,24);hub.rotation.z=Math.PI/2;
    this._sign(engine,'TRAINING ENGINE',-.23,.57,2.135,3.89,'#334E52','#E7D3A0',.24);
    solid(4.18,1.23,1.75,-6.48,.71,-6.60,dark,'atlantic-engine-control-console');
    this._box(g,4.37,.15,1.95,-6.48,1.40,-6.60,steel,.04);
    this._atlanticDisplay(g,-7.47,1.49,-6.87,1.81,1.22,'ENGINE STATUS','engine');
    this._atlanticDisplay(g,-5.44,1.49,-6.87,1.81,1.22,'POWER SYSTEMS','power');
    for(const [x,col]of[[-7.65,'#7CAC8A'],[-6.87,'#D5B264'],[-6.09,'#79A7A5'],[-5.31,'#B55C4A']]){
      this._cyl(g,.098,.11,.066,x,1.52,-6.02,col,14);
    }
    this._sign(g,'ENGINE CONTROL',-6.48,.88,-5.70,3.67,'#334E52','#E9DDC3',.36);
    solid(3.09,2.42,1.22,7.87,1.28,-7.88,'#647C77','atlantic-engine-tool-cabinet');
    for(const x of[7.14,8.60]){this._box(g,1.36,2.09,.05,x,1.29,-7.243,'#80958A',.025);this._box(g,.06,.39,.10,x+.35,1.31,-7.199,'#C8CBBC',.015);for(let n=0;n<4;n++)this._box(g,.89,.028,.025,x,1.91+n*.075,-7.207,'#58716D',.002);}
    this._sign(g,'TOOLS',7.87,2.66,-7.19,2.28,'#334E52','#EAE2CC',.29);
    const route=this._sign(g,'KEEP CLEAR',-6.68,.079,-.1,4.98,'#587D73','#F0EACA',.85);route.rotation.x=-Math.PI/2;route.name='atlantic-engine-clear-route';
    for(const z of[-1.03,1.03])this._box(g,6.12,.013,.075,-6.78,.078,z,'#E2D8AD',0);
    const stencil=this._sign(g,'SIMULATOR TRAINING',.74,.080,7.03,10.56,'#7C8A89','#E4E5CE',.75);stencil.rotation.x=-Math.PI/2;stencil.name='atlantic-engine-training-floor-label';
  }

  _atlanticLabPanel(parent,x,y,z,w,h,kind,label) {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const c=canvas.getContext('2d');
    if(kind==='ecdis'){
      c.fillStyle='#B4D4D3';c.fillRect(0,0,1024,512);
      c.fillStyle='#E4DEC3';c.beginPath();c.moveTo(0,0);c.lineTo(309,0);c.lineTo(269,104);c.lineTo(363,192);c.lineTo(292,282);c.lineTo(336,385);c.lineTo(210,512);c.lineTo(0,512);c.closePath();c.fill();
      c.strokeStyle='#82B4B8';c.lineWidth=2;
      for(const d of[28,64,103]){c.beginPath();c.moveTo(309+d,55);c.bezierCurveTo(271+d,180,430+d,220,325+d,370);c.lineTo(248+d,512);c.stroke();}
      c.strokeStyle='#8FAFAA';c.lineWidth=1;for(let n=1;n<10;n++){c.beginPath();c.moveTo(n*103,52);c.lineTo(n*103,512);c.moveTo(0,n*63);c.lineTo(1024,n*63);c.stroke();}
      c.fillStyle='#536E65';c.font='700 25px Arial';c.fillText('TRAINING COAST',35,198);c.font='700 22px Arial';c.fillText('CHART EXERCISE',652,474);
      const pts=[[463,430],[560,330],[514,215],[695,129]];c.strokeStyle='#C37048';c.lineWidth=6;c.beginPath();pts.forEach(([px,py],n)=>n?c.lineTo(px,py):c.moveTo(px,py));c.stroke();
      for(const [n,[px,py]]of pts.entries()){c.fillStyle='#F6E6B9';c.strokeStyle='#8C663F';c.lineWidth=3;c.beginPath();c.arc(px,py,12,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#3F5D5F';c.font='700 24px Arial';c.fillText(`WP 0${n+1}`,px+20,py+8);}
      c.fillStyle='#3B6D7B';c.beginPath();c.moveTo(463,405);c.lineTo(453,428);c.lineTo(473,428);c.closePath();c.fill();
      c.strokeStyle='#365E68';c.lineWidth=3;c.beginPath();c.moveTo(942,141);c.lineTo(942,82);c.lineTo(933,98);c.moveTo(942,82);c.lineTo(951,98);c.stroke();c.fillStyle='#365E68';c.font='700 21px Arial';c.fillText('N',934,74);
    }else if(kind==='waypoints'){
      c.fillStyle='#E7E9D9';c.fillRect(0,0,1024,512);c.fillStyle='#628A7D';c.fillRect(28,83,968,60);
      c.fillStyle='#F5F0DC';c.font='700 32px Arial';c.fillText('POINT',58,126);c.fillText('PLANNING CHECK',334,126);
      for(const [n,text]of['Identify the waypoint','Check the next leg','Review chart symbols','Explain your route'].entries()){
        const y=179+n*76;c.fillStyle=n%2?'#D5DFD1':'#DEE5D8';c.fillRect(28,y-16,968,67);c.fillStyle='#315B58';c.font='700 32px Arial';c.fillText(`WP 0${n+1}`,58,y+27);c.font='700 30px Arial';c.fillText(text,334,y+27);
      }
    }else if(kind==='message-board'){
      c.fillStyle='#D6DCE2';c.fillRect(0,0,1024,512);
      for(const [n,[title,line]]of [['LISTEN','Understand the message'],['IDENTIFY','Who is calling whom?'],['REVIEW','Check words and order']].entries()){
        const x=26+n*330;c.fillStyle=['#EEE9D8','#DDE8DD','#E8DFCD'][n];c.fillRect(x,88,312,334);c.fillStyle='#58748A';c.fillRect(x+21,110,44,44);c.fillStyle='#F4F0DA';c.font='700 28px Arial';c.fillText(String(n+1),x+34,143);c.fillStyle='#355369';c.font='700 32px Arial';c.fillText(title,x+21,210);c.font='700 24px Arial';const words=line.split(' ');c.fillText(words.slice(0,2).join(' '),x+21,272);c.fillText(words.slice(2).join(' '),x+21,310);c.fillStyle='#7990A0';c.fillRect(x+21,353,260,5);
      }
      c.fillStyle='#536C7F';c.font='700 23px Arial';c.fillText('CLASSROOM EXERCISES · NO LIVE TRANSMISSIONS',28,475);
    }else{
      c.fillStyle='#163548';c.fillRect(0,0,1024,512);c.fillStyle='#7399AA';c.font='700 32px Arial';
      const data=kind==='vhf'?['CHANNEL','16','VHF TRAINER','LISTEN  /  SPEAK  /  REPEAT']:kind==='dsc'?['DSC PRACTICE','REVIEW','MESSAGE CONSOLE','IDENTITY  /  MESSAGE  /  CHECK']:['SATCOM TRAINER','READY','MESSAGE TERMINAL','CONTACT  /  COMPOSE  /  REVIEW'];
      c.fillText(data[0],48,120);c.fillStyle='#E5ECD9';c.font=kind==='vhf'?'700 146px Arial':'700 86px Arial';c.fillText(data[1],48,279);
      c.fillStyle='#D4B979';c.font='700 34px Arial';c.fillText(data[2],50,345);c.fillStyle='#89B6AE';c.font='700 27px Arial';c.fillText(data[3],50,402);c.strokeStyle='#587C89';c.lineWidth=3;c.strokeRect(748,91,222,215);
      for(let n=0;n<5;n++){c.fillStyle=n<4?'#86B49C':'#365B6B';c.fillRect(773+n*34,266-n*30,21,20+n*30);}c.fillStyle='#A8C6BB';c.font='700 22px Arial';c.fillText('SIMULATION ONLY',50,471);
    }
    c.fillStyle=kind==='ecdis'||kind==='waypoints'?'#315E62':'#294B65';c.fillRect(0,0,1024,58);c.fillStyle='#F2EFDC';c.font='700 29px Arial';c.textAlign='center';c.fillText(label,512,40,972);
    const texture=this._keep(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
    const frame=this._box(parent,w+.17,h+.15,.12,x,y,z-.04,kind==='ecdis'||kind==='waypoints'?'#315C61':'#28455E',.035);frame.name=`atlantic-${kind}-panel-frame`;
    const panel=this._mesh(parent,this._g(`atlantic-lab-panel-${w}-${h}`,()=>new THREE.PlaneGeometry(w,h)),this._keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})),x,y,z+.026);
    panel.name=`atlantic-${kind}-training-screen`;panel.castShadow=false;return panel;
  }

  _buildAtlanticEcdis(g,room,solid) {
    this._atlanticFloor(g,room,'chart-lab');
    const green=this._m('#48746D',{roughness:.69}),cream=this._m('#E2DECB',{roughness:.76}),trim=this._m('#9EBEB0',{roughness:.50,metalness:.12});
    solid(18.1,4.85,.22,-.1,2.49,-4.75,'#CCDACD','atlantic-ecdis-display-wall');
    this._box(g,17.65,.23,.12,-.1,.89,-4.58,green,.02);
    this._atlanticLabPanel(g,-3.02,3.59,-4.55,10.9,2.72,'ecdis','ELECTRONIC CHART · TRAINING ROUTE');
    this._atlanticLabPanel(g,6.06,3.48,-4.55,5.25,2.91,'waypoints','WAYPOINT REVIEW');
    solid(13.5,1.14,1.75,-1.2,.67,-2.7,green,'atlantic-ecdis-console');
    this._box(g,13.72,.16,1.92,-1.2,1.32,-2.7,cream,.05);
    for(const x of[-5.19,1.61]){
      this._box(g,.16,.33,.31,x,1.55,-2.99,green,.024);
      this._atlanticLabPanel(g,x,2.19,-2.99,3.48,1.42,'ecdis',x<0?'CHART WORKSTATION 01':'CHART WORKSTATION 02');
      this._box(g,2.43,.055,.55,x,1.44,-2.11,'#406168',.03);
      for(let row=0;row<3;row++)this._box(g,2.14,.011,.026,x,1.475,-2.28+row*.12,'#91AFA8',.005);
      this._sphere(g,.14,x+1.62,1.50,-2.1,'#406168',[.74,.46,1.26],10);
    }
    this._box(g,.045,.81,.05,-1.80,.79,-1.787,'#A5C0B0',.005);
    this._sign(g,'ELECTRONIC CHARTS · PASSAGE PLANNING',-1.2,.72,-1.805,10.66,'#48746D','#EDE7CC',.35);
    solid(2.19,1.03,1.33,7.21,.59,-2.54,green,'atlantic-ecdis-teacher-station');
    this._box(g,2.35,.14,1.45,7.21,1.19,-2.54,cream,.04);
    this._sign(g,'TR. DUKE',7.21,.80,-1.854,1.86,'#48746D','#F0E9CF',.29);
    this._box(g,.78,.06,.67,7.11,1.31,-2.52,'#F2ECD8',.018);
    for(let n=0;n<3;n++)this._box(g,.32,.053,.73,7.98,1.28+n*.057,-2.55,n%2?'#BFA574':'#6F9081',.013);
    solid(3.37,.13,1.83,-6.31,1.05,1.46,cream,'atlantic-ecdis-passage-table');
    for(const x of[-7.72,-4.90])this._box(g,.15,.91,1.40,x,.54,1.46,green,.024);
    const chart=this._atlanticLabPanel(g,-6.31,1.14,1.46,2.91,1.35,'ecdis','PASSAGE PLAN');
    chart.rotation.x=-Math.PI/2;chart.position.y=1.174;chart.position.z=1.46;
    // This table's flat chart replaces only its matching frame orientation.
    const tableFrame=g.children.filter(o=>o.name==='atlantic-ecdis-panel-frame').at(-1);tableFrame.rotation.x=-Math.PI/2;tableFrame.position.y=1.105;tableFrame.position.z=1.46;
    this._atlanticChair(g,-1.80,-.04,0);
    solid(1.40,.02,1.44,-1.80,.075,-.04,green,'atlantic-ecdis-chair-footprint').visible=false;
    this._atlanticPlant(g,-8.84,3.78,.82);
    this._box(g,5.35,.015,.075,7.12,.077,1.06,'#E9E5C8',0);
    const pad=this._cyl(g,.92,.92,.013,3.8,.073,2.3,'#D1DBBC',40);pad.name='npc-duke-greeting-pad';
    const legend=this._sign(g,'MEET TR. DUKE',3.8,.083,3.50,3.64,'#B4C7B9','#42685F',.38);legend.rotation.x=-Math.PI/2;
  }

  _atlanticHeadset(parent,x,y,z) {
    const g=new THREE.Group();g.name='atlantic-gmdss-headset';g.position.set(x,y,z);parent.add(g);
    const band=this._mesh(g,this._g('gmdss-headset-band',()=>new THREE.TorusGeometry(.29,.037,7,22,Math.PI)),this._m('#243D53'));band.rotation.z=0;
    for(const side of[-1,1])this._box(g,.12,.22,.15,side*.28,-.01,0,'#365570',.052);
    const boom=this._cyl(g,.018,.018,.32,.31,-.11,.095,'#91A3AD',7);boom.rotation.z=-.5;this._sphere(g,.043,.39,-.25,.095,'#263F55',[1,1.5,1],10);
    this._box(g,.39,.06,.27,0,-.41,-.04,'#60788B',.025);this._cyl(g,.028,.028,.57,0,-.14,-.05,'#7D92A0',9);
    return g;
  }

  _buildAtlanticGmdss(g,room,solid) {
    this._atlanticFloor(g,room,'radio-lab');
    const navy=this._m('#314E69',{roughness:.60}),light=this._m('#B9C7CE',{roughness:.46,metalness:.17}),pale=this._m('#DADFD9',{roughness:.72});
    solid(18.1,4.36,.22,0,2.24,-8.75,'#C4D0D6','atlantic-gmdss-message-wall');
    this._box(g,17.7,.23,.11,0,.96,-8.58,navy,.02);
    this._atlanticLabPanel(g,-3.69,2.95,-8.54,9.96,2.79,'message-board','MARITIME COMMUNICATION · MESSAGE PRACTICE');
    this._atlanticLabPanel(g,6.17,2.87,-8.54,5.16,2.57,'satellite','SATELLITE COMMUNICATIONS');
    solid(12.8,1.16,2,-1,.68,-5.5,navy,'atlantic-gmdss-radio-console');
    this._box(g,13.01,.16,2.18,-1,1.34,-5.5,light,.065);
    for(const [x,kind,title]of[[-5.26,'vhf','VHF RADIO TRAINER'],[-1.01,'dsc','DSC MESSAGE PRACTICE'],[3.24,'satellite','SATCOM TERMINAL']]){
      this._box(g,2.76,.14,.92,x,1.49,-5.65,'#243E57',.045);
      this._atlanticLabPanel(g,x,2.25,-5.77,2.62,1.39,kind,title);
      for(const dx of[-.88,-.49,-.10,.29,.68])this._box(g,.22,.048,.16,x+dx,1.60,-5.04,dx<0?'#7CACA3':'#D2B781',.013);
      this._sign(g,kind==='vhf'?'VHF RADIO':kind==='dsc'?'DSC TRAINING':'SATCOM',x,.78,-4.474,3.50,'#314E69','#E2E8D9',.32);
      this._box(g,.34,.09,.36,x+1.68,1.48,-5.18,'#2B455D',.036);
      const mic=this._cyl(g,.026,.026,.67,x+1.68,1.84,-5.18,'#94A6AF',8);mic.rotation.z=-.17;
      const head=this._sphere(g,.079,x+1.62,2.16,-5.18,'#213C54',[.86,1.52,1],10);head.name='atlantic-gmdss-desk-microphone';
    }
    this._atlanticHeadset(g,-7.01,1.97,-5.54);
    this._atlanticHeadset(g,.77,1.97,-5.44);
    // Handset and curled cable are visible beside the dedicated radio display.
    const handset=new THREE.Group();handset.name='atlantic-gmdss-radio-handset';handset.position.set(-3.54,1.54,-4.95);g.add(handset);
    this._box(handset,.14,.12,.66,0,0,0,'#223D55',.06);for(const z of[-.30,.30])this._box(handset,.25,.17,.23,0,.015,z,'#223D55',.067);
    for(let n=0;n<6;n++){const loop=this._mesh(g,this._g('gmdss-cable-loop',()=>new THREE.TorusGeometry(.052,.011,5,12)),this._m('#263F55'),-3.60+n*.072,1.46,-4.72);loop.rotation.x=Math.PI/2;}
    solid(2.37,3.38,1.58,7.69,1.77,-4.83,navy,'atlantic-gmdss-equipment-rack');
    for(let row=0;row<4;row++){
      const y=.58+row*.72;this._box(g,2.07,.61,.051,7.69,y,-4.016,'#6C8394',.022);
      this._box(g,.91,.25,.028,7.32,y+.035,-3.978,row%2?'#89B5A6':'#A8C6C5',.015);
      for(const x of[8.04,8.37]){const dial=this._cyl(g,.081,.081,.078,x,y-.02,-3.965,'#263E55',12);dial.rotation.x=Math.PI/2;}
      for(let n=0;n<4;n++)this._box(g,.70,.018,.017,7.29,y-.17+n*.038,-3.944,'#344E64',.003);
    }
    this._box(g,2.52,.11,1.72,7.69,3.52,-4.83,light,.035);
    this._cyl(g,.10,.17,.30,7.69,3.71,-4.83,'#668193',12);
    const dome=this._mesh(g,this._g('gmdss-training-radome',()=>new THREE.SphereGeometry(.54,18,10,0,Math.PI*2,0,Math.PI/2)),pale,7.69,3.84,-4.83);dome.name='atlantic-gmdss-satellite-trainer';
    this._sign(g,'TRAINING EQUIPMENT',7.69,4.50,-4.10,3.19,'#314E69','#E8E5CE',.30);
    solid(2.27,1.05,1.35,5.68,.63,-2.59,navy,'atlantic-gmdss-teacher-station');
    this._box(g,2.42,.13,1.52,5.68,1.22,-2.59,light,.035);
    this._sign(g,'TR. BANK',5.68,.84,-1.891,2.02,'#314E69','#EEE9D3',.30);
    this._box(g,1.09,.05,.65,5.64,1.33,-2.52,'#EFE8D6',.015);
    solid(4.40,.14,2.08,-5.46,1.02,4.33,pale,'atlantic-gmdss-message-table');
    for(const x of[-7.35,-3.57])this._box(g,.18,.88,1.70,x,.51,4.33,navy,.024);
    this._box(g,1.44,.05,1.00,-6.15,1.15,4.31,'#F0ECD8',.017);
    for(let n=0;n<5;n++)this._box(g,1.15,.007,.023,-6.15,1.181,3.99+n*.15,'#91A2A3',.003);
    this._atlanticHeadset(g,-4.18,1.58,4.40);
    this._atlanticChair(g,-5.46,6.28,Math.PI);
    solid(1.4,.02,1.5,-5.46,.075,6.28,navy,'atlantic-gmdss-chair-footprint').visible=false;
    this._atlanticPlant(g,8.58,7.55,1.08);
    for(const z of[-.98,1.06])this._box(g,7.70,.015,.070,-5.48,.077,z,'#DCE3D3',0);
    const pad=this._cyl(g,1.02,1.02,.013,2,.073,-.2,'#B4C7C3',40);pad.name='npc-bank-greeting-pad';
    const legend=this._sign(g,'MEET TR. BANK',2,.083,1.19,3.72,'#778598','#F0E9D2',.43);legend.rotation.x=-Math.PI/2;
  }

  _atlanticDisplay(parent,x,y,z,w,h,label,kind) {
    const g=new THREE.Group();g.position.set(x,y,z);g.name=`atlantic-${kind}-display`;parent.add(g);
    this._box(g,.11,.34,.28,0,.11,-.03,'#34535A',.025);
    this._box(g,w+.18,h+.16,.14,0,h/2+.26,0,'#294B56',.04);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=280;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=kind==='chart'?'#9DC8D1':kind==='bridge'?'#C4DFDC':'#183F4B';ctx.fillRect(0,0,512,280);
    if(kind==='bridge'){
      ctx.fillStyle='#6AA2B3';ctx.fillRect(0,111,512,169);ctx.fillStyle='#EBE8C6';ctx.fillRect(0,109,512,5);
      ctx.fillStyle='#254C5D';ctx.beginPath();ctx.moveTo(221,163);ctx.lineTo(291,163);ctx.lineTo(283,178);ctx.lineTo(230,178);ctx.closePath();ctx.fill();
      ctx.fillRect(245,143,22,21);ctx.strokeStyle='#DAEEE2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(255,180);ctx.lineTo(255,245);ctx.stroke();
    }else if(kind==='chart'){
      ctx.fillStyle='#D9DAB2';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(177,0);ctx.lineTo(153,72);ctx.lineTo(203,121);ctx.lineTo(146,191);ctx.lineTo(174,280);ctx.lineTo(0,280);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#DA895B';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(419,226);ctx.lineTo(320,161);ctx.lineTo(347,71);ctx.stroke();
      ctx.strokeStyle='#698F97';ctx.lineWidth=1;
      for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(i*85,0);ctx.lineTo(i*85,280);ctx.moveTo(0,i*48);ctx.lineTo(512,i*48);ctx.stroke();}
    }else if(kind==='radar'){
      ctx.fillStyle='#112D35';ctx.fillRect(0,44,512,236);ctx.strokeStyle='#467F70';ctx.lineWidth=2;
      for(const r of[29,58,87]){ctx.beginPath();ctx.arc(193,165,r,0,Math.PI*2);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(98,165);ctx.lineTo(288,165);ctx.moveTo(193,70);ctx.lineTo(193,260);ctx.stroke();
      ctx.fillStyle='#326250';ctx.beginPath();ctx.moveTo(193,165);ctx.arc(193,165,85,-1.1,-.35);ctx.closePath();ctx.fill();
      ctx.fillStyle='#DBE9B3';for(const [px,py]of[[219,131],[151,207],[244,188]])ctx.fillRect(px,py,6,6);
      ctx.textAlign='left';ctx.font='700 20px Arial';ctx.fillStyle='#A6C6B5';ctx.fillText('RANGE',323,102);ctx.fillText('CONTACTS',323,171);ctx.font='700 31px Arial';ctx.fillStyle='#EDF0D1';ctx.fillText('6 NM',323,134);ctx.fillText('03',323,205);
    }else if(kind==='conning'){
      ctx.fillStyle='#13333E';ctx.fillRect(0,44,512,236);ctx.textAlign='center';ctx.fillStyle='#95BDB8';ctx.font='700 19px Arial';ctx.fillText('HEADING',148,86);ctx.fillText('SPEED',374,86);
      ctx.fillStyle='#E8ECD8';ctx.font='700 53px Arial';ctx.fillText('090°',148,145);ctx.fillText('12.0',374,145);ctx.font='700 17px Arial';ctx.fillText('KNOTS',374,171);
      ctx.strokeStyle='#658D89';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(49,215);ctx.lineTo(463,215);ctx.stroke();
      for(let n=0;n<13;n++){ctx.beginPath();ctx.moveTo(49+n*34.5,207);ctx.lineTo(49+n*34.5,223);ctx.stroke();}
      ctx.fillStyle='#DFB56E';ctx.fillRect(252,199,8,33);ctx.fillStyle='#ACC7B8';ctx.font='700 16px Arial';ctx.fillText('RUDDER   0°   /   SIMULATION',256,255);
    }else if(kind==='engine'||kind==='power'){
      ctx.fillStyle='#173E47';ctx.fillRect(0,44,512,236);ctx.textAlign='left';
      const rows=kind==='engine'?[['RPM','720',.72],['TEMP','64°',.56],['PRESS','6.0',.68]]:[['GEN 1','68%',.68],['GEN 2','62%',.62],['LOAD','65%',.65]];
      for(let n=0;n<3;n++){const [name,value,level]=rows[n],yy=82+n*59;ctx.fillStyle='#BCD7C6';ctx.font='700 20px Arial';ctx.fillText(name,27,yy);ctx.fillStyle='#E9E8CF';ctx.font='700 31px Arial';ctx.fillText(value,326,yy+4);ctx.fillStyle='#355963';ctx.fillRect(28,yy+13,413,12);ctx.fillStyle=n===1?'#D8BB78':'#8BBAA6';ctx.fillRect(28,yy+13,413*level,12);}
      ctx.fillStyle='#ACC8BB';ctx.font='700 15px Arial';ctx.fillText('SIMULATED VALUES · TRAINING',28,267);
    }else if(kind==='office'){
      ctx.fillStyle='#EAE9DB';ctx.fillRect(0,44,512,236);ctx.fillStyle='#2E5360';ctx.fillRect(20,64,124,194);ctx.fillStyle='#D9E3D6';ctx.font='700 15px Arial';ctx.textAlign='left';
      for(const [n,text]of['CADETS','ACADEMICS','MISSIONS','PROGRESS'].entries())ctx.fillText(text,33,96+n*40);
      ctx.fillStyle='#496C6A';ctx.font='700 22px Arial';ctx.fillText('THE AMCOL WAY',169,92);ctx.font='700 15px Arial';ctx.fillText('ACADEMIC OVERVIEW',169,121);
      for(let n=0;n<3;n++){ctx.fillStyle='#CBD8CD';ctx.fillRect(169,147+n*35,306,19);ctx.fillStyle=['#567D79','#9A9971','#73949A'][n];ctx.fillRect(169,147+n*35,202+n*25,19);}
    }else{
      ctx.strokeStyle='#60928F';ctx.lineWidth=2;
      for(let i=0;i<3;i++){ctx.strokeRect(32+i*157,83,130,134);ctx.fillStyle=kind==='engine'?'#DFC48B':'#B0D5CE';ctx.fillRect(49+i*157,153-i*20,96,48+i*20);}
    }
    ctx.fillStyle='#F4F3DC';ctx.fillRect(0,0,512,44);ctx.fillStyle='#264E59';ctx.textAlign='center';ctx.font='700 22px Arial';ctx.fillText(label,256,30,486);
    const texture=this._keep(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
    const material=this._keep(new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
    const screen=this._mesh(g,this._g(`atlantic-display-plane-${w}-${h}`,()=>new THREE.PlaneGeometry(w,h)),material,0,h/2+.26,.081);
    screen.name=`atlantic-${kind}-screen`;screen.castShadow=false;
    return g;
  }

  _buildDorm() {
    const lawn=this._mesh(this.world,this._g('dorm-land',()=>new THREE.PlaneGeometry(210,190)),this._m('#B3C8A0'),0,-.23,0);
    lawn.rotation.x=-Math.PI/2;lawn.castShadow=false;
    this._box(this.world,61,.20,49,0,-.11,0,'#B9CBA8',.05);
    const path=(x,z,w,d)=>this._box(this.world,w,.06,d,x,.025,z,C.path,.02);
    path(-24,16.0,4.4,13);
    path(-1.5,18,52,3.3);
    path(-15,10,3.2,18);
    path(-15,-4.4,3.2,9);
    path(27,2.5,2.8,32);
    path(-3,-1,2.8,37);
    path(13,14.5,28,2.7);
    this._buildDormHall();
    this._buildPTYard();
    this._buildSportsField();
    // Low boundary walls and palms frame a separate residence district.
    for(const side of[-1,1]){
      this._box(this.world,.22,.48,46,side*29.3,.24,0,'#D1D7C2',.025);
      for(let z=-21;z<24;z+=6)this._box(this.world,.34,.88,.35,side*29.3,.44,z,'#E0E3CF',.025);
    }
    this._box(this.world,58.5,.48,.22,0,.24,-23.2,'#D1D7C2',.025);
    this._box(this.world,47,.48,.22,5.5,.24,23.2,'#D1D7C2',.025);
    for(const [x,z,s]of[[-27,-21,.82],[-27,-4,.84],[-27,8,.8],[-5,21,.84],[6,21,.9],[20,21,.85],[27,-21,.82],[-2,-21,.86]])this._tree(x,z,s,true);
    for(const [x,z,rot]of[[-25,11,Math.PI/2],[-8,12,0],[4,17.6,Math.PI],[20,17.6,Math.PI]])this._bench(x,z,rot);
    for(const [x,z]of[[-21,16],[-3,15],[26,16],[-3,-17]])this._lamp(x,z);
    const arrival=new THREE.Group();arrival.position.set(-24,0,21.9);this.world.add(arrival);
    for(const side of[-1,1])this._box(arrival,.29,3.75,.34,side*2.5,1.875,0,C.navy,.035);
    this._box(arrival,5.7,.71,.40,0,3.66,0,C.navy,.045);
    this._sign(arrival,'CADET DORMITORY',0,3.65,.215,5.25,C.navy,C.cream,.57);
    this._sign(this.world,'CAMPUS SHUTTLE',-17,2.56,20.7,4.4,C.cream,C.navy,.60);
    for(const x of[-18.8,-15.2])this._box(this.world,.12,2.7,.12,x,1.35,20.65,'#5D827D',.015);
    this._buildWayfinding(DORM_DESTINATIONS);
    this._buildStaff('dorm');
    this._addStudent('dorm',3,[[-8,17.4],[7,17.4],[7,19.4],[-8,19.4]],{phase:2,speed:1.5});
  }

  /** A walking maritime student who stops to chat when the player comes close. */
  _addStudent(zone,lookIndex,route,{phase=0,speed=1.3}={}) {
    const look=studentLook(lookIndex);
    const avatar=this._buildAvatar(look,true);this.world.add(avatar);
    avatar.position.set(route[0][0],0,route[0][1]);
    this._npcs.push({avatar,route,index:1,phase,speed,zone,student:{id:`student-${zone}-${lookIndex}`,name:look.name,gender:look.gender}});
  }

  _buildDormHall() {
    const b=DORM.hall,g=new THREE.Group();g.position.set(b.x,0,b.z);this.world.add(g);
    this._box(g,b.w,.09,b.d,0,.045,0,'#E5DDC9',.025);
    this._box(g,b.w,.15,b.d,0,-.08,0,'#BDAF93',.035);
    // A cutaway residence lets the player walk through the door to their bed.
    this._box(g,b.w,b.h,.27,0,b.h/2,-b.d/2,C.cream,.025);
    this._box(g,b.w+.15,.23,2.35,0,b.h+.05,-b.d/2+.95,'#6D9190',.03);
    this._collision.push({x1:b.x-b.w/2,x2:b.x+b.w/2,z1:b.z-b.d/2-.14,z2:b.z-b.d/2+.14});
    for(const side of[-1,1]){
      this._box(g,.27,1.7,b.d,side*b.w/2,.85,0,C.cream,.025);
      this._box(g,.36,.13,b.d,side*b.w/2,1.73,0,'#6D9190',.025);
      this._collision.push({x1:b.x+side*b.w/2-.14,x2:b.x+side*b.w/2+.14,z1:b.z-b.d/2,z2:b.z+b.d/2});
      this._box(g,7.1,1.2,.27,side*6.45,.6,b.d/2,C.cream,.025);
      this._collision.push({x1:b.x+side*6.45-3.55,x2:b.x+side*6.45+3.55,z1:b.z+b.d/2-.14,z2:b.z+b.d/2+.14});
      this._box(g,.25,4.6,.25,side*9.65,2.3,b.d/2-.02,'#6D9190',.025);
      this._box(g,2.3,2.5,.16,side*6.6,3.1,-b.d/2+.22,'#8BB6B6',.025);
      this._box(g,.05,2.5,.17,side*6.6,3.1,-b.d/2+.31,C.cream,.006);
    }
    this._box(g,b.w+.1,.56,.37,0,4.47,b.d/2-.02,'#6D9190',.035);
    this._sign(g,'DORMITORY · REST & RESET',0,4.48,b.d/2+.19,13.4,'#6D9190',C.cream,.47);
    this._sign(g,'CADET ROOM',0,3.15,-b.d/2+.17,5.6,C.cream,C.navy,.78);
    for(const side of[-1,1]){
      const x=side*5.9,z=-1.6;
      this._box(g,2.75,.36,4.1,x,.28,z,'#8A9E93',.055);
      this._box(g,2.7,.30,3.9,x,.60,z,'#F3EDD9',.13);
      this._box(g,2.7,.06,2.45,x,.79,z+.60,side<0?'#8CACB4':'#B5C49B',.025);
      this._box(g,2.2,.20,.80,x,.84,z-1.31,C.white,.14);
      this._box(g,2.83,.88,.17,x,.71,z-2.08,'#6D8A80',.03);
      this._collision.push({x1:b.x+x-1.45,x2:b.x+x+1.45,z1:b.z+z-2.22,z2:b.z+z+2.10});
      this._box(g,2.8,1.08,1.30,x,.57,4.65,'#BCA57C',.04);
      this._box(g,2.95,.09,1.4,x,1.14,4.65,'#DAC9A7',.025);
      this._box(g,.66,.10,.90,x-.53,1.23,4.62,'#5F888C',.02);
      this._box(g,.75,.045,.84,x+.48,1.21,4.67,C.cream,.01);
      this._collision.push({x1:b.x+x-1.52,x2:b.x+x+1.52,z1:b.z+3.86,z2:b.z+5.44});
      for(let i=0;i<2;i++){
        this._box(g,1.25,2.9,.95,side*2.1+side*i*1.35,1.49,-5.94,'#97ADA0',.035);
        this._box(g,.045,.30,.05,side*2.1+side*i*1.35+.38,1.56,-5.43,C.navy,.008);
      }
      this._collision.push({x1:Math.min(b.x+side*1.40,b.x+side*4.1),x2:Math.max(b.x+side*1.4,b.x+side*4.1),z1:b.z-6.6,z2:b.z-5.32});
    }
    this._box(g,4.2,.025,3.8,0,.10,1.0,'#BACAC0',.035);
  }

  _buildPTYard() {
    const b=DORM.pt;
    this._box(this.world,b.w,.05,b.d,b.x,.04,b.z,'#ABC0BD',.045);
    for(const x of[-19,-11])for(const z of[-.2,5.5]){
      this._box(this.world,2.0,.05,3.0,x,.10,z,'#477D7A',.05);
      this._box(this.world,1.5,.009,.05,x,.13,z,'#A4C4B4',0);
    }
    const sign=this._sign(this.world,'PT YARD',b.x,2.85,b.z-5.45,5.0,C.cream,C.navy,.64);
    for(const x of[b.x-2.1,b.x+2.1])this._box(this.world,.11,3.0,.11,x,1.5,b.z-5.5,'#517B76',.015);
    for(const x of[-21.8,-8.2]){
      this._cyl(this.world,.14,.25,.60,x,.3,8.1,'#D7AF77',8);
      this._box(this.world,.32,.11,.32,x,.64,8.1,C.cream,.02);
    }
  }

  _groundLine(points,color='#F5F1DE',width=1) {
    const geometry=this._keep(new THREE.BufferGeometry().setFromPoints(points));
    const material=this._keep(new THREE.LineBasicMaterial({color,linewidth:width}));
    const line=new THREE.Line(geometry,material);this.world.add(line);return line;
  }

  _buildSportsField() {
    const t=DORM.track,f=DORM.football;
    const track=this._cyl(this.world,1,1,.055,t.x,.047,t.z,'#C99880',64);track.scale.set(t.rx,1,t.rz);
    const infield=this._cyl(this.world,1,1,.013,t.x,.084,t.z,'#89B087',64);infield.scale.set(t.rx-3,1,t.rz-3);
    for(const inset of[.28,1.24,2.20]){
      const pts=[];for(let i=0;i<=96;i++){const a=i/96*TAU;pts.push(new THREE.Vector3(t.x+Math.sin(a)*(t.rx-inset),.088,t.z+Math.cos(a)*(t.rz-inset)));}
      this._groundLine(pts,'#F8E9D4');
    }
    this._box(this.world,f.w,.013,f.d,f.x,.096,f.z,'#91B38A',0);
    for(let row=0;row<6;row++)if(row%2===0)this._box(this.world,f.w,.003,f.d/6,f.x,.106,f.z-f.d/2+(row+.5)*f.d/6,'#86AA80',0);
    const x1=f.x-f.w/2,x2=f.x+f.w/2,z1=f.z-f.d/2,z2=f.z+f.d/2;
    this._groundLine([[x1,z1],[x2,z1],[x2,z2],[x1,z2],[x1,z1]].map(([x,z])=>new THREE.Vector3(x,.118,z)));
    this._groundLine([new THREE.Vector3(x1,.118,f.z),new THREE.Vector3(x2,.118,f.z)]);
    const center=[];for(let i=0;i<=48;i++){const a=i/48*TAU;center.push(new THREE.Vector3(f.x+Math.sin(a)*2.4,.118,f.z+Math.cos(a)*2.4));}this._groundLine(center);
    for(const side of[-1,1]){
      const z=f.z+side*f.d/2;
      this._groundLine([[f.x-4,z],[f.x-4,z-side*3],[f.x+4,z-side*3],[f.x+4,z]].map(([x,zz])=>new THREE.Vector3(x,.118,zz)));
      for(const x of[f.x-2.5,f.x+2.5]){
        this._cyl(this.world,.08,.08,2.15,x,1.1,z,C.cream,8);
        this._box(this.world,.10,.10,1.3,x,2.15,z+side*.64,C.cream,.02);
        this._cyl(this.world,.055,.055,2.15,x,1.1,z+side*1.30,C.cream,8);
      }
      this._box(this.world,5.2,.13,.13,f.x,2.15,z,C.cream,.025);
      this._box(this.world,5.2,.08,.08,f.x,2.15,z+side*1.3,C.cream,.015);
      for(let x=f.x-2.5;x<=f.x+2.5;x+=.5)this._groundLine([new THREE.Vector3(x,.13,z+side*1.3),new THREE.Vector3(x,2.1,z+side*1.3)],'#D7DDC6');
      for(let y=.5;y<=2.1;y+=.4)this._groundLine([new THREE.Vector3(f.x-2.5,y,z+side*1.3),new THREE.Vector3(f.x+2.5,y,z+side*1.3)],'#D7DDC6');
    }
    this._sphere(this.world,.25,f.x,.37,f.z,C.white,[1,1,1],12);
    this._sign(this.world,'RUNNING TRACK',26.2,2.85,-1,5,C.cream,C.navy,.58).rotation.y=-Math.PI/2;
    this._box(this.world,.12,3,.12,26.2,1.5,-1,'#567E70',.015);
    for(let i=0;i<3;i++)this._box(this.world,.10,.015,3.0,23.7+i*.32,.104,2.6,C.cream,0);
  }

  _campusGate() {
    const g=new THREE.Group();g.position.set(CAMPUS.spawn.x,0,24);this.world.add(g);
    for(const side of[-1,1]){
      this._box(g,.48,4.8,.60,side*3.4,2.4,0,C.navy,.04);
      this._box(g,.69,.22,.84,side*3.4,.13,0,'#C4CDB8',.03);
      this._collision.push({x1:CAMPUS.spawn.x+side*3.4-.3,x2:CAMPUS.spawn.x+side*3.4+.3,z1:23.65,z2:24.35});
    }
    this._box(g,7.7,.52,.74,0,4.73,0,C.navy,.045);
    this._sign(g,'AMCOL',0,4.74,.40,4.35,C.navy,C.cream,.48);
    this._sign(g,'MAIN CAMPUS',0,4.14,.40,3.5,C.cream,C.navy,.46);
  }

  /**
   * The training signal mast inside the main gate (from the campus photo): a white lattice
   * trunk with a ladder, a railed lookout platform, a slim topmast with a yardarm and masthead
   * light, six halyards down to a cleat rail, the Thai flag hoisted, and an ASSEMBLY POINT sign.
   * The ladder side faces the west walk.
   */
  _buildSignalMast() {
    const white = '#F2F2EC', steel = '#C9CDC6', line = '#9AA19A';
    const g = new THREE.Group(); g.name = 'signal-mast'; g.position.set(-37.0, 0, 20.6); g.rotation.y = Math.PI / 2; this.world.add(g);
    this._box(g, 1.5, .10, 1.5, 0, .05, 0, '#CFCFC4', .03);
    // Square trunk with corner posts, bracing bands and ladder rungs on the front face.
    for (const x of [-.27, .27]) for (const z of [-.27, .27]) this._box(g, .07, 6.0, .07, x, 3.05, z, white, .01);
    for (let y = .4; y < 6; y += .55) { this._box(g, .6, .05, .05, 0, y, .27, white, .006); this._box(g, .6, .05, .05, 0, y, -.27, white, .006); this._box(g, .05, .05, .6, .27, y, 0, white, .006); this._box(g, .05, .05, .6, -.27, y, 0, white, .006); }
    this._box(g, .46, 6.0, .46, 0, 3.05, 0, '#E9EAE3', .01);
    for (let y = .3; y < 6; y += .3) this._box(g, .34, .03, .03, 0, y, .32, steel, .004);
    // Lookout platform with railings on both sides of the topmast, and the PA speaker below it.
    this._box(g, 1.65, .12, 1.15, 0, 6.1, 0, white, .02);
    for (const side of [-1, 1]) {
      for (const [x, z] of [[side * .8, -.55], [side * .8, .55], [side * .35, -.55], [side * .35, .55]]) this._box(g, .045, 1.0, .045, x, 6.66, z, white, .006);
      for (const y of [6.62, 7.12]) { this._box(g, .48, .04, .04, side * .575, y, .55, white, .005); this._box(g, .48, .04, .04, side * .575, y, -.55, white, .005); this._box(g, .04, .04, 1.12, side * .8, y, 0, white, .005); }
    }
    this._box(g, .32, .22, .2, .36, 5.75, .3, '#6E7570', .03);
    // Topmast with step rungs, yardarm and masthead light.
    this._cyl(g, .08, .11, 5.4, 0, 8.8, 0, white, 12);
    for (let y = 6.5; y < 10.8; y += .32) this._box(g, .02, .02, .2, .1, y, 0, steel, .003);
    this._box(g, 4.2, .1, .1, 0, 9.9, 0, white, .01);
    this._cyl(g, .08, .08, .3, 0, 11.65, 0, steel, 10);
    this._cyl(g, .095, .095, .05, 0, 11.82, 0, '#B9BDB4', 10);
    // Six halyards from the yardarm to cleats on the rail at the foot of the mast.
    const halyards = [-1.9, -1.35, -.8, .8, 1.35, 1.9];
    for (const x of halyards) this._cyl(g, .008, .008, 8.95, x, 5.42, .45, line, 4).castShadow = false;
    this._box(g, 4.4, .09, .09, 0, .95, .45, white, .02);
    for (const x of [-1.95, 1.95]) this._box(g, .08, .95, .08, x, .47, .45, white, .01);
    for (const x of halyards) this._box(g, .16, .05, .05, x, 1.02, .45, steel, .01);
    // The Thai national flag flying from the outer starboard halyard.
    const flag = new THREE.Group(); flag.position.set(1.9, 9.25, .5); g.add(flag);
    for (const [y, h, color] of [[.47, .1, '#C8102E'], [.37, .1, '#F4F5F0'], [.22, .2, '#2D2A64'], [.07, .1, '#F4F5F0'], [-.03, .1, '#C8102E']]) this._box(flag, .9, h, .015, .45, y, 0, color, 0).castShadow = false;
    // Muster sign beside the mast, as in the photo.
    for (const x of [2.85, 3.55]) this._box(g, .05, 1.5, .05, x, .75, .7, white, .006);
    this._sign(g, 'ASSEMBLY POINT', 3.2, 1.65, .73, 1.2, '#1F5A3A', '#FFFFFF', .62);
    // Keep walkers out of the trunk and rail (local x lies along the world z axis here).
    this._collision.push({ x1: -37.6, x2: -36.3, z1: 18.4, z2: 22.8 });
  }

  _buildLifeboat() {
    // Orange enclosed training craft, mounted on land as in the user's plan.
    // This is a visual learning destination; operating controls are not modeled.
    const station=SAFETY_STATIONS[0];
    const g=new THREE.Group();g.name='lifeboat-training-area';g.position.set(station.modelX,0,station.modelZ);
    g.userData.stationId=station.id;this.world.add(g);
    this._box(g,7.0,.10,12.6,0,.04,0,'#CFD1BE',.10).name='lifeboat-training-pad';
    const craft=new THREE.Group();craft.name='orange-enclosed-lifeboat';craft.userData.stationId=station.id;g.add(craft);
    for(const z of[-3.1,3.1]){
      this._box(craft,4.9,.24,.56,0,.25,z,'#58737A',.06);
      for(const x of[-1.6,1.6])this._box(craft,.34,.94,.45,x,.71,z,'#6B8589',.045);
    }
    const hull=this._sphere(craft,1,0,1.51,0,'#E96D2C',[2.15,.92,5.10],32);hull.name='lifeboat-orange-hull';
    const gunwale=this._sphere(craft,1,0,1.91,0,'#EC7E33',[2.22,.38,5.04],32);gunwale.name='lifeboat-gunwale';
    const canopy=this._sphere(craft,1,0,2.56,-.05,'#F58A37',[1.98,1.13,4.82],32);canopy.name='lifeboat-enclosed-canopy';
    for(const side of[-1,1]){
      this._box(craft,.10,.10,7.60,side*2.12,1.88,0,'#F7E0BD',.035);
      for(const z of[-2.85,-1.25,.4,2.05]){
        const frame=this._box(craft,.13,.75,.93,side*1.89,2.72,z,'#F9C385',.09);
        const glass=this._box(craft,.055,.56,.74,side*1.978,2.72,z,'#386B7B',.07);glass.name='lifeboat-side-window';
      }
      for(const z of[-3.85,3.82])this._box(craft,.10,.24,.55,side*1.59,3.08,z,'#F2F2D8',.04).name='lifeboat-reflector';
      for(const z of[-3.0,0,3.0]){
        const grip=this._mesh(craft,this._g('lifeboat-handhold',()=>new THREE.TorusGeometry(.12,.034,6,12)),this._m('#F5E9CF'),side*2.1,2.08,z);grip.rotation.y=Math.PI/2;
      }
    }
    this._box(craft,1.05,.10,1.53,0,3.65,.10,'#E6752C',.14).name='lifeboat-top-hatch';
    this._box(craft,.62,.075,.085,0,3.77,.10,'#F4DCAF',.03);
    this._box(craft,.045,.78,.045,0,4.02,-2.12,'#F4ECD4',.01);
    this._sphere(craft,.16,0,4.45,-2.12,'#F5C973',[1,.85,1],10);
    this._box(craft,1.0,1.20,.12,0,2.6,4.30,'#DB682D',.12);
    this._box(craft,.52,.39,.045,0,2.87,4.385,'#386B7B',.06);
    this._box(craft,.95,.14,.52,0,1.45,4.70,'#708C8C',.045);
    for(const side of[-1,1])this._box(g,.13,2.65,.13,side*2.48,1.32,5.60,'#5C7E77',.02);
    this._sign(g,'LIFEBOAT · SAFETY',0,2.72,5.68,5.8,'#E87830','#FFF5DC',.66).name='lifeboat-safety-sign';
    this._sign(g,'MINI-GAMES',0,2.12,5.68,4.0,'#FFF5DC','#934A29',.40);
    this._collision.push({x1:station.modelX-2.5,x2:station.modelX+2.5,z1:station.modelZ-5.25,z2:station.modelZ+5.28});
    // Side approach remains outside the craft, with no climbing or launch action.
    for(const z of[-3.4,3.4]){
      this._cyl(g,.09,.25,.70,3.0,.40,z,'#E5823F',10);
      this._box(g,.19,.09,.19,3.0,.63,z,'#FCF1DA',.02);
    }
  }

  _buildTeacherPlaza() {
    const p=TEACHER_PLAZA;
    const g=new THREE.Group();g.name='pacific-teacher-plaza';g.position.set(p.x,0,p.z);this.world.add(g);
    this._box(g,p.w,.03,p.d,0,.058,0,'#DDDDBF',.05);
    // Three separate greeting pads keep staff easy to distinguish on a phone.
    for(const id of p.staffIds){
      const station=NPC_STATIONS.find(item=>item.npcId===id);
      const pad=this._cyl(this.world,1.48,1.48,.028,station.x,.091,station.z,'#F4E7BD',32);
      pad.name=`${station.id}-greeting-pad`;
    }
    this._box(g,9.65,.075,.70,0,.102,-1.82,'#668477',.045);
    const sign=this._sign(g,'MEET YOUR TEACHERS',0,3.85,-2.01,10.7,'#FFF7E0','#315F60',.67);
    sign.name='teacher-meeting-sign';
    for(const x of[-5.05,5.05])this._box(g,.105,3.77,.105,x,1.95,-2.04,'#7A9686',.02);
  }

  _updateCanopies(dt) {
    for(const canopy of this._canopies){
      const b=canopy.bounds,p=this._position;
      const near=p.x>b.x1-3.0&&p.x<b.x2+3.0&&p.z>b.z1-3.0&&p.z<b.z2+3.0;
      const target=near?canopy.fade:canopy.normal;
      canopy.material.opacity+=(target-canopy.material.opacity)*Math.min(1,dt*5);
    }
    if(!this.worldCamera)return;
    const origin=new THREE.Vector3(this._position.x,2.0,this._position.z);
    const direction=this.worldCamera.position.clone().sub(origin),distance=direction.length();
    const ray=new THREE.Ray(origin,direction.normalize()),hit=new THREE.Vector3();
    for(const facade of this._facades||[]){
      const crossing=ray.intersectBox(facade.box,hit);
      const obscures=Boolean(crossing)&&origin.distanceTo(hit)<distance;
      facade.opacity+=((obscures ? 0.16 : 1)-facade.opacity)*Math.min(1,dt*6);
      for(const material of facade.materials){material.opacity=facade.opacity;material.depthWrite=facade.opacity>.95;}
    }
  }

  _tree(x, z, scale = 1, palm = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); this.world.add(g);
    if (palm) {
      const trunk = this._cyl(g, 0.16, 0.26, 4.0, 0.12, 2.0, 0, '#B69A70', 8); trunk.rotation.z = -0.065;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU;
        const leaf = this._sphere(g, 1, Math.sin(a) * 1.08, 4.2, Math.cos(a) * 1.08, i % 2 ? '#6E9D72' : '#5F906D', [0.43, 0.13, 1.7], 8);
        leaf.rotation.y = a; leaf.rotation.x = -0.2;
      }
      this._sphere(g, 0.4, 0.22, 3.94, 0, '#819D61', [1, 0.75, 1], 8);
    } else {
      this._cyl(g, 0.15, 0.24, 2.35, 0, 1.17, 0, '#A38869', 8);
      this._sphere(g, 1.55, 0, 3.4, 0, '#729E78', [1, 1.03, 0.92], 10);
      this._sphere(g, 1.0, -0.87, 2.96, 0.1, '#81AA7E', [1, 1.2, 1], 8);
      this._sphere(g, 0.93, 0.78, 3.15, 0.08, '#8CB486', [1, 1.1, 1], 8);
    }
    this._cyl(g, 0.65, 0.76, 0.1, 0, 0.015, 0, '#94B58E', 14);
  }

  _bench(x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.world.add(g);
    for (let i = 0; i < 3; i++) this._box(g, 2.35, 0.1, 0.17, 0, 0.66, -0.21 + i * 0.21, '#B99673', 0.025);
    for (const side of [-1, 1]) {
      this._box(g, 0.14, 0.67, 0.54, side * 0.85, 0.33, 0, C.navy, 0.02);
      this._box(g, 0.10, 0.85, 0.12, side * 0.85, 0.92, -0.3, C.navy, 0.015);
    }
    this._box(g, 2.38, 0.43, 0.1, 0, 1.09, -0.31, '#B99673', 0.04);
  }

  _lamp(x, z) {
    this._cyl(this.world, 0.065, 0.095, 3.8, x, 1.9, z, C.navy, 8);
    this._cyl(this.world, 0.37, 0.23, 0.14, x, 3.86, z, C.navy, 8);
    this._sphere(this.world, 0.20, x, 3.64, z, '#FFF1C6', [1, 1.25, 1], 10);
  }

  _planter(x, z) {
    this._box(this.world, 1.5, 0.50, 0.95, x, 0.25, z, '#D0BA9A', 0.08);
    for (let i = 0; i < 3; i++) this._sphere(this.world, 0.48, x + (i - 1) * 0.4, 0.61, z, i % 2 ? '#699D78' : '#7DA77C', [1, 0.9, 0.8], 8);
  }

  _station(station) {
    const radius = station.npcId ? .64 : .94;
    const ring = this._mesh(this.world, this._g(`stationring:${radius}`, () => new THREE.TorusGeometry(radius, 0.052, 6, 40)), this._m(station.color), station.x, 0.09, station.z);
    ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    const disc = this._cyl(this.world, radius-.04, radius-.04, 0.018, station.x, 0.065, station.z, this._m(station.color, { transparent: true, opacity: 0.19 }), 32);
    disc.castShadow = false;
    this._stationRings.push({ ring, disc, station });
  }

  setCharacter(config = {}) {
    if(this._failed)return;
    // Saved wardrobe selection stays separate from the automatic dorm outfit.
    this.config=normalizeCharacter({...(this.config||{}),...config});
    this._syncDisplayedCharacter();
    this._updateTrainingGateModels();
    if(this._zone==='campus'){
      const gate=this._gateAt(this._position.x,this._position.z);
      if(gate)this.setPosition(gate.approach);
    }
  }

  _syncDisplayedCharacter() {
    const stored=this.config||normalizeCharacter(this.player?.userData?.appearance||{});
    const display=displayCharacter(stored,this.mode==='world'?this._zone:'campus');
    const key=JSON.stringify(display);if(this.player&&this._displayCharacterKey===key)return;
    const old=this.player;this.player=this._buildAvatar(display);this._displayCharacterKey=key;
    if(old){this.player.rotation.copy(old.rotation);this.scene.remove(old);old.userData.dispose();}
    this.scene.add(this.player);
    if(this.mode==='creator')this.player.position.set(0,.102,0);else this.player.position.copy(this._position);
  }

  getDisplayedCharacter() { return {...this.player?.userData?.appearance}; }

  setMode(mode) {
    if (this._failed) return;
    this.mode = mode === 'world' ? 'world' : 'creator';
    this._movementSpeed = 0;
    if (this.mode === 'creator') this.clearRemotePlayers();
    this._remoteGroup.visible = this.mode === 'world';
    this._cameraInput=0;this._syncDisplayedCharacter();
    this.canvas.style.cursor = '';
    if (this._gesture) {
      this._gesture = null; this.player?.userData.arms.forEach((arm, i) => { arm.rotation.z = (i ? 1 : -1) * 0.09; });
      if (this.player?.userData.gestureThumb) this.player.userData.gestureThumb.visible = false;
    }
    this._keys.clear(); this._touch = { x: 0, z: 0, run: false }; this._path = [];
    this.creator.visible = this.mode === 'creator';
    for(const [zone,data]of Object.entries(this._zones||{}))data.group.visible=this.mode==='world'&&zone===this._zone;
    this.camera = this.mode === 'creator' ? this.creatorCamera : this.worldCamera;
    this.scene.background = this.mode === 'creator' ? null : new THREE.Color('#E1EADB');
    this.scene.fog = this.mode === 'world' ? new THREE.Fog('#E1EADB', 75, 180) : null;
    if (this.mode === 'creator') {
      this.player.position.set(0, 0.102, 0);
      this.player.rotation.y = this._creatorYaw;
    } else {
      this.player.position.copy(this._position);
      this.player.rotation.y = Math.PI;
      this._cameraLook.copy(this._position).y = 1.4;
      this._updateCamera(1);
      this._nearId = undefined;
      this._checkNear();
    }
    this.destinationMarker.visible = false;
    this._resize();
    this._emitPresenceMove();
  }

  setPaused(value) {
    this.paused = Boolean(value);
    if (this.paused) { this._keys.clear(); this._touch = { x: 0, z: 0, run: false };this._cameraInput=0;this._movementSpeed=0; }
    this._emitPresenceMove();
  }

  // x is screen-right; z is screen-down. Values should be in the range -1…1.
  setInput(x, z, run) {
    if (this.paused || this.mode !== 'world' || this._failed || this._disposed) {
      this._touch = { x:0, z:0, run:false }; return;
    }
    this._touch = { x: clamp(Number(x) || 0, -1, 1), z: clamp(Number(z) || 0, -1, 1), run: run === undefined ? this._touch.run : Boolean(run) };
    if (Math.hypot(this._touch.x, this._touch.z) > 0.05) {
      this._path = [];
      if (this.destinationMarker) this.destinationMarker.visible = false;
    }
  }

  /** The mobile run control is independent from the analog stick. */
  setRunning(value) {
    this._touch.run = Boolean(value) && !this.paused && this.mode === 'world' && !this._failed && !this._disposed;
  }

  rotateCamera(direction) {
    const value=Number(direction);if(!Number.isFinite(value)||value===0)return false;
    this._cameraTargetAngle+=Math.sign(value)*Math.PI/4;return true;
  }

  setCameraInput(direction) {
    const value=Number(direction);
    this._cameraInput=!this.paused&&this.mode==='world'&&!this._failed&&!this._disposed&&Number.isFinite(value)?clamp(value,-1,1):0;
  }

  resetCamera() {
    this._cameraInput=0;this._cameraTargetAngle=Math.PI/6;this._cameraDistance=23;
    return !this._failed;
  }

  rotateCharacter(direction) {
    this._creatorYaw += (Number(direction) || 1) * Math.PI / 4;
  }

  setDestination(id) {
    const station = this._stations.find(s => s.id === id);
    if (!station || this._failed) return false;
    return this._routeTo(station.x, station.z);
  }

  getZone() { return this._zone; }
  getStations() { return this._stations.map(station=>({...station})); }

  /** Enter a separate district; callers persist the zone alongside x/z. */
  setZone(zone, position) {
    if(this._failed||this._disposed||!this._zones?.[zone])return false;
    if(zone===this._zone){if(position)this.setPosition(position);return true;}
    this.clearRemotePlayers();
    this._movementSpeed = 0;
    this._keys.clear();this._touch={x:0,z:0,run:false};this._path=[];this._drag=null;this._cameraInput=0;
    this.destinationMarker.visible=false;this.nearArrow.visible=false;
    this._nearId=undefined;this.callbacks.onNear?.(null);
    this._activateZoneData(zone);
    this._syncDisplayedCharacter();this._updateTrainingGateModels();
    this._cameraAngle=Math.PI/6;this._cameraTargetAngle=Math.PI/6;
    this.callbacks.onZoneChange?.(zone);
    this.setPosition(position||this._zoneConfig.spawn);
    this.callbacks.onMove?.(this.getPosition());
    return true;
  }

  resetPosition() { this.setPosition(this._zoneConfig.spawn); }
  getPosition() { return { x: this._position.x, z: this._position.z }; }

  setPosition(position) {
    if (!position || this._failed) return;
    this._movementSpeed = 0;
    const config=this._zoneConfig,bounds=config.bounds;
    const x=Number.isFinite(Number(position.x))?clamp(Number(position.x),bounds.minX+.7,bounds.maxX-.7):config.spawn.x;
    const z=Number.isFinite(Number(position.z))?clamp(Number(position.z),bounds.minZ+.7,bounds.maxZ-.7):config.spawn.z;
    if (!this._blocked(x, z)) this._position.set(x, 0, z);
    else this._position.set(config.spawn.x, 0, config.spawn.z);
    this._position.y=this._groundHeight(this._position.x,this._position.z);
    this._path = [];
    if(this.destinationMarker)this.destinationMarker.visible=false;
    if (this.mode === 'world') {
      this.player.position.copy(this._position);
      this._cameraLook.copy(this._position).y = 1.4;
      this._updateCamera(1); this._checkNear();
    }
    this._emitPresenceMove();
  }

  setQuality(quality) {
    if (this._failed) return;
    this.quality = quality === 'low' ? 'low' : 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.5));
    this.renderer.shadowMap.enabled = this.quality !== 'low';
    this._updateRemotePlayers();
    this._resize();
  }

  _groundHeight(x,z) {
    if(this._zone==='campus'){
      const b=BUILDINGS.find(item=>item.id==='dome');
      const stageZ=b?b.z-(b.d-21)/2:0;
      if(b&&Math.abs(x-b.x)<8.5&&z>stageZ-9.3&&z<stageZ-5.8)return .635;
      if(b&&Math.abs(x-b.x)<2.2&&z>=stageZ-5.8&&z<stageZ-5.0)return .635*(stageZ-5.0-z)/.8;
    }
    return 0;
  }

  _blocked(x, z, radius = 0.42) {
    const bounds=this._zoneConfig.bounds;
    if(x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius)return true;
    return Boolean(this._gateAt(x,z,radius))||this._collision.some(b => x > b.x1 - radius && x < b.x2 + radius && z > b.z1 - radius && z < b.z2 + radius);
  }

  _gateAt(x,z,radius=0) {
    if(this._zone!=='campus')return null;
    return TRAINING_GATES.find(g=>this.config?.outfit!==g.outfit&&x>g.bounds.x1-radius&&x<g.bounds.x2+radius&&z>g.bounds.z1-radius&&z<g.bounds.z2+radius)||null;
  }

  _notifyTrainingGate(gate) {
    this._keys.clear();this._touch={x:0,z:0,run:false};this._path=[];this._cameraInput=0;
    if(this.destinationMarker)this.destinationMarker.visible=false;
    const now=this._time||0;
    if(this._lastGateNotice?.id===gate.id&&now-this._lastGateNotice.time<.8)return;
    this._lastGateNotice={id:gate.id,time:now};
    this.callbacks[gate.callback]?.({stationId:gate.id,requiredOutfit:gate.outfit});
  }

  canEnterStation(id,{notify=false}={}) {
    const gate=TRAINING_GATES.find(g=>g.id===id);
    if(!gate||this.config?.outfit===gate.outfit)return true;
    if(notify)this._notifyTrainingGate(gate);return false;
  }

  requestInteract(id=this._nearId) {
    if(!id||this.paused||this.mode!=='world'||this._failed)return false;
    if(!this.canEnterStation(id,{notify:true}))return false;
    this.callbacks.onInteract?.(id);return true;
  }

  _updateTrainingGateModels() {
    for(const item of this._trainingGateModels||[]){
      const equipped=this.config?.outfit===item.requiredOutfit;
      item.panel.rotation.y=equipped?item.openAngle:0;item.panel.userData.open=equipped;
    }
  }

  _clearLine(a, b) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(dist / 0.32);
    for (let i = 1; i <= steps; i++) if (this._blocked(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps, 0.50)) return false;
    return true;
  }

  _routeTo(x, z) {
    if (this.mode !== 'world') return false;
    const bounds=this._zoneConfig.bounds;
    x=clamp(x,bounds.minX+.7,bounds.maxX-.7);z=clamp(z,bounds.minZ+.7,bounds.maxZ-.7);
    const gate=this._gateAt(x,z,.5);if(gate){this._notifyTrainingGate(gate);return false;}
    let goal = { x, z };
    if (this._blocked(x, z, 0.50)) {
      let found = null;
      for (let r = 0.8; r <= 12 && !found; r += 0.8) {
        for (let i = 0; i < 24; i++) {
          const p = { x: x + Math.sin(i * TAU / 24) * r, z: z + Math.cos(i * TAU / 24) * r };
          if (!this._blocked(p.x, p.z, 0.55)) { found = p; break; }
        }
      }
      if (!found) return false;
      goal = found;
    }
    const start = this.getPosition();
    if (this._clearLine(start, goal)) this._path = [goal];
    else {
      const minX=Math.ceil(bounds.minX),minZ=Math.ceil(bounds.minZ);
      const W=Math.floor(bounds.maxX)-minX+1,H=Math.floor(bounds.maxZ)-minZ+1,total=W*H;
      const id = (gx, gz) => gz * W + gx;
      const world = node => ({ x: node % W + minX, z: Math.floor(node / W) + minZ });
      const snap = point => {
        const cx=clamp(Math.round(point.x-minX),0,W-1),cz=clamp(Math.round(point.z-minZ),0,H-1);
        let best = null, distance = Infinity;
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          const gx=cx+dx,gz=cz+dz,p={x:gx+minX,z:gz+minZ};
          if (gx < 0 || gx >= W || gz < 0 || gz >= H || this._blocked(p.x, p.z, 0.55)) continue;
          const d = Math.hypot(p.x - point.x, p.z - point.z);
          if (d < distance && this._clearLine(point, p)) { distance = d; best = { x: gx, z: gz }; }
        }
        return best;
      };
      const gridStart = snap(start), gridGoal = snap(goal);
      if (!gridStart || !gridGoal) return false;
      const sx = gridStart.x, sz = gridStart.z, ex = gridGoal.x, ez = gridGoal.z;
      const startId = id(sx, sz), endId = id(ex, ez);
      const costs = new Float32Array(total); costs.fill(Infinity); costs[startId] = 0;
      const parent = new Int32Array(total); parent.fill(-1);
      const closed = new Uint8Array(total), open = [startId], inOpen = new Uint8Array(total); inOpen[startId] = 1;
      const heuristic = n => Math.hypot(n % W - ex, Math.floor(n / W) - ez);
      let found = false, iterations = 0;
      while (open.length && iterations++ < total) {
        let bi = 0, bf = Infinity;
        for (let i = 0; i < open.length; i++) { const f = costs[open[i]] + heuristic(open[i]); if (f < bf) { bf = f; bi = i; } }
        const node = open.splice(bi, 1)[0]; inOpen[node] = 0;
        if (node === endId) { found = true; break; }
        if (closed[node]) continue;
        closed[node] = 1;
        const gx = node % W, gz = Math.floor(node / W);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          const nx = gx + dx, nz = gz + dz;
          if (nx < 0 || nx >= W || nz < 0 || nz >= H) continue;
          const next = id(nx, nz);
          if(closed[next]||this._blocked(nx+minX,nz+minZ,.55))continue;
          if(dx&&dz&&(this._blocked(gx+minX+dx,gz+minZ,.55)||this._blocked(gx+minX,gz+minZ+dz,.55)))continue;
          const score = costs[node] + (dx && dz ? 1.4142 : 1);
          if (score < costs[next]) { costs[next] = score; parent[next] = node; if (!inOpen[next]) { open.push(next); inOpen[next] = 1; } }
        }
      }
      if (!found) return false;
      const raw = [goal]; let n = endId;
      while (n !== startId && n !== -1) { raw.push(world(n)); n = parent[n]; }
      raw.push(world(startId));
      raw.reverse();
      const smooth = []; let current = start, index = 0;
      while (index < raw.length) {
        let furthest = index;
        for (let j = index + 1; j < raw.length; j++) { if (this._clearLine(current, raw[j])) furthest = j; else break; }
        smooth.push(raw[furthest]); current = raw[furthest]; index = furthest + 1;
      }
      this._path = smooth;
    }
    this.destinationMarker.position.set(goal.x, 0.08, goal.z);
    this.destinationMarker.visible = true;
    this._keys.clear(); this._touch = { x: 0, z: 0, run: false };
    return true;
  }

  _bindEvents() {
    const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); this._listeners.push(() => target.removeEventListener(type, handler, options)); };
    listen(window, 'keydown', event => {
      if (editable(event.target) || event.ctrlKey || event.metaKey || event.altKey || this.mode !== 'world' || this.paused) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) {
        event.preventDefault(); this._keys.add(key); this._path = []; this.destinationMarker.visible = false;
      }
      if (!event.repeat && key === 'e' && this._nearId) { event.preventDefault(); this.requestInteract(this._nearId); }
      if (!event.repeat && (key === 'q' || key === 'r')) { event.preventDefault(); this.rotateCamera(key === 'q' ? -1 : 1); }
    });
    listen(window, 'keyup', event => this._keys.delete(event.key.toLowerCase()));
    listen(window, 'blur', () => { this._keys.clear(); this._touch = { x: 0, z: 0, run: false };this._cameraInput=0; });
    listen(this.canvas, 'pointerdown', event => {
      if (this.paused) return;
      this._drag = { x: event.clientX, y: event.clientY, lastX: event.clientX, button: event.button, moved: false };
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    listen(this.canvas, 'pointermove', event => {
      if (this.mode === 'creator' && !this._drag && event.pointerType === 'mouse') this.canvas.style.cursor = this._hitsPlayer(event) ? 'pointer' : '';
      if (!this._drag || this.paused) return;
      const dx = event.clientX - this._drag.lastX;
      if (Math.hypot(event.clientX - this._drag.x, event.clientY - this._drag.y) > 7) this._drag.moved = true;
      if (this.mode === 'creator') this._creatorYaw += dx * 0.012;
      else if (this._drag.button === 2) this._cameraTargetAngle -= dx * 0.008;
      this._drag.lastX = event.clientX;
    });
    listen(this.canvas, 'pointerup', event => {
      const drag = this._drag; this._drag = null;
      this.canvas.releasePointerCapture?.(event.pointerId);
      if (drag && !drag.moved && drag.button === 0 && this.mode === 'creator' && !this.paused && this._hitsPlayer(event)) { this.playGesture(); return; }
      if (!drag || drag.moved || drag.button !== 0 || this.mode !== 'world' || this.paused) return;
      const rect = this.canvas.getBoundingClientRect();
      this._pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      this._ray.setFromCamera(this._pointer, this.camera);
      const remotes = [...this._remotePlayers.values()].filter(player => player.actor?.avatar.visible).map(player => player.actor.avatar);
      const targets = [...(this._staff || []).flatMap(staff => [staff.avatar, staff.label, staff.marker]), ...remotes].filter(object => object.visible);
      const staffHit = this._ray.intersectObjects(targets, true).find(hit => {
        for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
        return true;
      });
      if (staffHit) {
        let object = staffHit.object;
        while (object && !object.userData.stationId && !object.userData.remoteKey) object = object.parent;
        if (object?.userData.remoteKey) {
          this.callbacks.onRemoteSelect?.(object.userData.remoteKey);
          return;
        }
        const station = this._stations.find(item => item.id === object?.userData.stationId);
        if (station) {
          const distance = Math.hypot(station.x-this._position.x, station.z-this._position.z);
          if (distance < 3.8) this.requestInteract(station.id);
          else this.setDestination(station.id);
          return;
        }
      }
      const hit = new THREE.Vector3();
      const bounds=this._zoneConfig.bounds;
      if(this._ray.ray.intersectPlane(this._groundPlane,hit)&&hit.x>bounds.minX-1&&hit.x<bounds.maxX+1&&hit.z>bounds.minZ-1&&hit.z<bounds.maxZ+1)this._routeTo(hit.x,hit.z);
    });
    listen(this.canvas, 'pointercancel', () => { this._drag = null; });
    listen(this.canvas, 'contextmenu', event => event.preventDefault());
    listen(this.canvas, 'wheel', event => {
      if (this.mode !== 'world' || this.paused) return;
      event.preventDefault(); this._cameraDistance = clamp(this._cameraDistance + event.deltaY * 0.018, 14, 37);
    }, { passive: false });
    listen(this.canvas, 'webglcontextlost', event => {
      event.preventDefault(); this.paused = true; this._failed = true;
      this.callbacks.onError?.(new Error('The 3D view lost its graphics connection. Reload to reconnect.'));
    });
    if (window.ResizeObserver) { this._observer = new ResizeObserver(() => this._resize()); this._observer.observe(this.canvas); }
    else listen(window, 'resize', () => this._resize());
  }

  _resize() {
    if (this._failed || !this.renderer) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    if (this._width === width && this._height === height) return;
    this._width = width; this._height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.worldCamera.aspect = aspect; this.worldCamera.updateProjectionMatrix();
    const halfH = Math.max(2.52, 2.3 / Math.max(aspect, 0.55));
    Object.assign(this.creatorCamera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    this.creatorCamera.updateProjectionMatrix();
  }

  _checkNear() {
    let closest = null, distance = 3.8;
    for (const station of this._stations) {
      const d = Math.hypot(this._position.x - station.x, this._position.z - station.z);
      if (d < distance) { distance = d; closest = station; }
    }
    // Walking students in this district can be approached for a trivia chat.
    for (const npc of this._npcs) {
      if (!npc.student || npc.zone !== this._zone) continue;
      const p = npc.avatar.position, d = Math.hypot(this._position.x - p.x, this._position.z - p.z);
      if (d < Math.min(distance, STUDENT_TALK_RANGE)) { distance = d; closest = { id: npc.student.id, name: npc.student.name, gender: npc.student.gender, x: p.x, z: p.z, student: true }; }
    }
    const id = closest?.id || null;
    if (id !== this._nearId) { this._nearId = id; this.callbacks.onNear?.(closest ? { ...closest } : null); }
    this.nearArrow.visible = Boolean(closest);
    if (closest) this.nearArrow.position.set(closest.x, 1.65 + Math.sin(this._time * 2.7) * 0.14, closest.z);
  }

  _updateCamera(dt) {
    if(this.mode==='world'&&!this.paused)this._cameraTargetAngle+=(this._cameraInput||0)*Math.PI*.56*Math.min(dt,.1);
    this._cameraAngle=mixAngle(this._cameraAngle,this._cameraTargetAngle,Math.min(1,dt*7));
    const target=this._position.clone();target.y=1.2;
    const portrait=this.worldCamera.aspect<.8;
    const p=TEACHER_PLAZA;
    const inTeacherPlaza=this._zone==='campus'&&Math.abs(target.x-p.x)<p.w/2+1&&target.z>p.z-p.d/2&&target.z<p.z+p.d/2+1.6;
    let distance=this._cameraDistance;
    if(portrait&&inTeacherPlaza){
      // The adjacent teachers fit together on a portrait phone. Keep the cadet
      // within the same view while easing the focus toward the shared plaza.
      target.x+=(p.x-target.x)*.80;
      distance=Math.max(distance,32.5);
    }
    this._cameraLook.lerp(target,Math.min(1,dt*5.5));
    this._effectiveCameraDistance=(this._effectiveCameraDistance??distance)+(distance-(this._effectiveCameraDistance??distance))*Math.min(1,dt*5.5);
    distance=this._effectiveCameraDistance;
    this.worldCamera.position.set(
      this._cameraLook.x+Math.sin(this._cameraAngle)*distance,
      distance*.95+2.5,
      this._cameraLook.z+Math.cos(this._cameraAngle)*distance,
    );
    this.worldCamera.lookAt(this._cameraLook);
  }

  _movePlayer(dt) {
    this._movementSpeed = 0;
    const keys = this._keys;
    const ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + this._touch.x;
    const iz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + this._touch.z;
    let dx = 0, dz = 0, speed = 0;
    if (Math.hypot(ix, iz) > 0.07) {
      const len = Math.max(1, Math.hypot(ix, iz));
      dx = (Math.cos(this._cameraAngle) * ix + Math.sin(this._cameraAngle) * iz) / len;
      dz = (-Math.sin(this._cameraAngle) * ix + Math.cos(this._cameraAngle) * iz) / len;
      speed = keys.has('shift') || this._touch.run ? 7.2 : 4.25;
      this._path = []; this.destinationMarker.visible = false;
    } else if (this._path.length) {
      const p = this._path[0], distance = Math.hypot(p.x - this._position.x, p.z - this._position.z);
      if (distance < 0.18) { this._path.shift(); if (!this._path.length) this.destinationMarker.visible = false; }
      else { dx = (p.x - this._position.x) / distance; dz = (p.z - this._position.z) / distance; speed = Math.min(4.25, distance / dt); }
    }
    if (speed) {
      const mx = dx * speed * dt, mz = dz * speed * dt;
      const oldx = this._position.x, oldz = this._position.z;
      const gate=this._gateAt(oldx+mx,oldz+mz,.42);
      if(gate){this._notifyTrainingGate(gate);this._animateAvatar(this.player,this._time,0);return;}
      if (!this._blocked(oldx + mx, oldz)) this._position.x += mx;
      if (!this._blocked(this._position.x, oldz + mz)) this._position.z += mz;
      const actual = Math.hypot(this._position.x - oldx, this._position.z - oldz) / dt;
      if (actual > 0.01) this.player.rotation.y = mixAngle(this.player.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 13));
      else if (this._path.length) { this._path = []; this.destinationMarker.visible = false; }
      speed = actual;
    }
    this._position.y=this._groundHeight(this._position.x,this._position.z);
    this._movementSpeed = speed;
    this.player.position.copy(this._position);
    this._animateAvatar(this.player, this._time, speed);
    if (this._time - this._lastMove > 0.7) { this._lastMove = this._time; this.callbacks.onMove?.(this.getPosition()); }
    this._checkNear();
  }

  _updateNPCs(dt) {
    for (const npc of this._npcs) {
      if (npc.stationary) {
        this._animateAvatar(npc.avatar, this._time + npc.phase, 0);
        if (npc.station) {
          const dx = this._position.x - npc.avatar.position.x, dz = this._position.z - npc.avatar.position.z;
          const nearby = Math.hypot(dx, dz) < 6.5;
          npc.avatar.rotation.y = mixAngle(npc.avatar.rotation.y, nearby ? Math.atan2(dx, dz) : npc.station.facing, Math.min(1, dt * 3));
          // A gentle greeting helps distinguish staff from the passing cadets.
          npc.avatar.userData.arms[1].rotation.z = nearby ? .68 + Math.sin(this._time * 2.3 + npc.phase) * .08 : .09;
          if (nearby) npc.avatar.userData.arms[1].rotation.x = -.23;
        }
        continue;
      }
      if (npc.student && npc.zone === this._zone) {
        // A student pauses and turns to face the cadet when they come close to chat.
        const px = this._position.x - npc.avatar.position.x, pz = this._position.z - npc.avatar.position.z;
        if (Math.hypot(px, pz) < STUDENT_TALK_RANGE) {
          npc.avatar.rotation.y = mixAngle(npc.avatar.rotation.y, Math.atan2(px, pz), Math.min(1, dt * 6));
          this._animateAvatar(npc.avatar, this._time + npc.phase, 0);
          npc.avatar.userData.arms[1].rotation.z = .68 + Math.sin(this._time * 2.3 + npc.phase) * .08;
          continue;
        }
        npc.avatar.userData.arms[1].rotation.z = .09;
      }
      const target = npc.route[npc.index], pos = npc.avatar.position;
      const dx = target[0] - pos.x, dz = target[1] - pos.z, dist = Math.hypot(dx, dz);
      if (dist < 0.15) npc.index = (npc.index + 1) % npc.route.length;
      else {
        const step = Math.min(dist, dt * npc.speed);
        pos.x += dx / dist * step; pos.z += dz / dist * step;
        npc.avatar.rotation.y = mixAngle(npc.avatar.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5));
      }
      this._animateAvatar(npc.avatar, this._time + npc.phase, npc.speed);
    }
  }

  _frame() {
    if (this._disposed || this._failed) return;
    this._raf = requestAnimationFrame(() => this._frame());
    const dt = Math.max(0.001, Math.min(this._clock.getDelta(), 0.045)); this._time += dt;
    if (this.mode === 'creator') {
      this.player.rotation.y = mixAngle(this.player.rotation.y, this._creatorYaw + Math.sin(this._time * 0.5) * 0.035, Math.min(1, dt * 8));
      this._animateAvatar(this.player, this._time, 0);
      this._applyGesture();
    } else {
      if (!this.paused) { this._movePlayer(dt); this._updateNPCs(dt); this._checkNear(); }
      else this._animateAvatar(this.player, this._time, 0);
      this._applyGesture();
      this._emitPresenceMove();
      this._updateRemotePlayers();
      this._updateCamera(dt);
      this._updateStaffLabels();
      this._updateCanopies(dt);
      if (this.radar) this.radar.rotation.y += dt * 0.4;
      for (const { ring, station } of this._stationRings) {
        const selected = station.id === this._nearId;
        ring.scale.setScalar(selected ? 1.07 + Math.sin(this._time * 3) * 0.04 : 1);
      }
      if (this.nearArrow.visible) this.nearArrow.position.y = 1.65 + Math.sin(this._time * 2.7) * 0.14;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._disposed = true; cancelAnimationFrame(this._raf);
    this._observer?.disconnect();
    for (const off of this._listeners) off();
    this.clearRemotePlayers();
    for (const actor of this._remotePool) this._disposeRemoteActor(actor);
    this._remotePool.length = 0;
    this._remoteGroup?.removeFromParent();
    for (const resource of this._resources) resource.dispose?.();
    this._resources.clear(); this._geometries.clear(); this._materials.clear();
    this.renderer?.dispose();
  }
}

export default SeaWorld;
