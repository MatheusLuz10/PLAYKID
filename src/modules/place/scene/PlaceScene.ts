/**
 * Cena 3D de "Meu Lugar" (three.js puro), no mesmo visual realista do mundo 3D:
 * céu com névoa, sol com sombras suaves, grama ao vento, água com reflexo.
 * - Animação decorativa a no máximo ~30 quadros/s; sem movimento (preferência do
 *   sistema) só desenha quando algo muda → economiza bateria.
 * - Mouse: arrastar gira, roda aproxima, botão direito move. Toque: arrastar gira,
 *   pinça aproxima/move. Teclado: setas (com o foco na cena) e botões da tela.
 * - "Andar pela casa": câmera na altura dos olhos, dentro da casa. Setas/WASD ou os
 *   botões da tela andam e viram; arrastar olha em volta. As paredes seguram o
 *   passo e as passagens internas levam de um cômodo a outro.
 * - Libera toda a memória da GPU ao sair da página (dispose).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animateModel } from '../../world3d/scene/models/animate';
import { waterClock, waterMaterial } from '../../world3d/scene/models/common';
import { buildClouds, buildSky, type Wind } from '../../world3d/scene/terrain';
import { buildHouse, buildPlaceGrass, buildTerrain, GARDEN, HOUSE, ROOMS, type HouseParts } from './house';
import { buildObject, type ObjectModel } from './objects';

export type FocusTarget = 'geral' | keyof typeof ROOMS | 'jardim';
export type RoomCode = keyof typeof ROOMS;

export interface SceneObject {
  code: string;
  model: ObjectModel;
  position: [number, number, number];
  rotation: number;
  scale: number;
  /** Surgiu agora: cresce ao aparecer. */
  isNew?: boolean;
  label: string;
}

export interface Hotspot {
  code: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

interface Options {
  reducedMotion: boolean;
  onSelect: (code: string) => void;
  onHotspots: (spots: Hotspot[]) => void;
  /** Andando pela casa: o cômodo onde a pessoa está. */
  onRoom?: (room: RoomCode) => void;
}

/** Comando de andar: frente (+1) / trás (−1) e virar à direita (+1) / esquerda (−1). */
export interface WalkInput {
  forward: number;
  turn: number;
}

const EYE = 1.35; // altura dos olhos de uma criança
const WALK_SPEED = 1.7; // metros por segundo
const TURN_SPEED = 1.9; // radianos por segundo
const BODY = 0.22; // raio do corpo (para não atravessar paredes)

/** Passagens das paredes internas (a parede em x corta a casa ao meio no sentido da profundidade e vice-versa). */
const PASSAGES = {
  /** parede que separa frente (sala/cozinha) e fundo (quarto/estudos): aberturas no eixo x */
  middleX: [-2.5, 2.5],
  /** parede que separa esquerda e direita: aberturas no eixo z (relativas ao centro) */
  middleZ: [2, -2],
  width: 1.0,
};

const VIEWS: Record<FocusTarget, { pos: [number, number, number]; target: [number, number, number] }> = {
  geral: { pos: [11, 9, 9], target: [0, 1, -4] },
  jardim: { pos: [0, 5, 9], target: [0, 1.4, -4] },
  sala: { pos: [ROOMS.sala.x + 4, 9, ROOMS.sala.z + 7], target: [ROOMS.sala.x, 0.6, ROOMS.sala.z] },
  cozinha: { pos: [ROOMS.cozinha.x + 4, 9, ROOMS.cozinha.z + 7], target: [ROOMS.cozinha.x, 0.6, ROOMS.cozinha.z] },
  quarto: { pos: [ROOMS.quarto.x - 4, 9, ROOMS.quarto.z + 7], target: [ROOMS.quarto.x, 0.6, ROOMS.quarto.z] },
  estudos: { pos: [ROOMS.estudos.x + 4, 9, ROOMS.estudos.z + 7], target: [ROOMS.estudos.x, 0.6, ROOMS.estudos.z] },
};

export class PlaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private house: HouseParts;
  private objects = new Map<string, { group: THREE.Group; spec: SceneObject; born: number; anchorY: number; phase: number }>();
  private wind: Wind = { uniforms: { uTime: { value: 0 } } };
  private clouds: THREE.Group;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  /** Shaders preparados em segundo plano antes do primeiro desenho (a página não trava). */
  private ready = false;
  private lastAnimAt = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private needsRender = true;
  private raf = 0;
  private interior = false;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number } | null = null;
  private resizeObserver: ResizeObserver;
  private downAt: { x: number; y: number } | null = null;
  private clock = new THREE.Clock();
  // andar pela casa
  private walking = false;
  private yaw = 0;
  private pitch = 0;
  private walkPos = new THREE.Vector3();
  private input: WalkInput = { forward: 0, turn: 0 };
  private keys = new Set<string>();
  private look: { x: number; y: number; yaw: number; pitch: number } | null = null;
  private lastWalkAt = 0;
  private room: RoomCode | null = null;
  private indoorLights: THREE.PointLight[] = [];
  /** Forro claro: só aparece com a pessoa dentro (de fora, a casa continua com o telhado). */
  private ceiling: THREE.Mesh;

  constructor(
    private container: HTMLElement,
    private opts: Options,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // o sol não se move: sombras recalculadas só quando os objetos mudam
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    const canvas = this.renderer.domElement;
    canvas.className = 'place-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Cena 3D da sua casa e do seu jardim. Use os botões ou a lista abaixo para explorar.');
    canvas.tabIndex = 0;
    container.appendChild(canvas);

    // Céu, névoa e luz de fim de manhã (as mesmas do mundo 3D)
    this.scene.add(buildSky());
    this.scene.fog = new THREE.Fog(0xd9ecf6, 38, 120);
    this.clouds = buildClouds();
    this.scene.add(this.clouds);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 700);
    this.camera.position.set(...VIEWS.geral.pos);

    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x55683a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    sun.position.set(12, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 17;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    // só a casa e o gramado: o quintal (árvores, bichos, horta, água) fica no Meu Mundo
    this.scene.add(buildTerrain(false));
    this.scene.add(buildPlaceGrass(window.innerWidth < 700 ? 7000 : 14000, this.wind, false));
    this.house = buildHouse();
    this.scene.add(this.house.group);
    this.ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(HOUSE.width, 0.06, HOUSE.depth),
      // um pouco de brilho próprio: a luz que vem de baixo (tom de grama) não o deixa escuro
      new THREE.MeshStandardMaterial({ color: 0xf6f1e7, emissive: 0xe8e0cf, emissiveIntensity: 0.55, roughness: 0.95 }),
    );
    this.ceiling.position.y = HOUSE.wallHeight + 0.03;
    this.ceiling.visible = false;
    this.house.group.add(this.ceiling);
    // luz de teto em cada cômodo: acesa só quando a pessoa está lá dentro (intensidade 0 fora,
    // assim os shaders não precisam ser refeitos ao entrar)
    for (const room of Object.values(ROOMS)) {
      const lamp = new THREE.PointLight(0xffe2b8, 0, 7, 1.6);
      lamp.position.set(room.x, HOUSE.wallHeight - 0.25, room.z);
      this.scene.add(lamp);
      this.indoorLights.push(lamp);
    }

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...VIEWS.geral.target);
    this.controls.enableDamping = !opts.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 45;
    this.controls.maxPolarAngle = Math.PI / 2.15; // não vai para baixo do chão
    this.controls.listenToKeyEvents(canvas); // setas movem a câmera quando a cena tem foco
    this.controls.addEventListener('change', () => this.invalidate());
    this.controls.update();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('blur', this.onBlur);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const start = this.framed('geral');
    this.camera.position.copy(start.to);
    this.controls.update();
    this.loop();
  }

  // ---------- API ----------

  setObjects(list: SceneObject[]) {
    const keep = new Set(list.map((o) => o.code));
    for (const [code, entry] of this.objects) {
      if (!keep.has(code)) {
        this.scene.remove(entry.group);
        disposeTree(entry.group);
        this.objects.delete(code);
      }
    }
    for (const spec of list) {
      if (this.objects.has(spec.code)) continue;
      const group = buildObject(spec.model);
      group.position.set(...spec.position);
      // modelos de jardim (árvores, bichos, água) ficam apoiados no chão
      if (group.userData.grounded) group.position.y = 0;
      group.rotation.y = spec.rotation;
      group.scale.setScalar(spec.scale);
      const anchorY = Math.max(0.4, new THREE.Box3().setFromObject(group).max.y - group.position.y);
      group.scale.setScalar(spec.isNew && !this.opts.reducedMotion ? 0.01 : spec.scale);
      group.userData.code = spec.code;
      group.traverse((o) => {
        o.userData.code = spec.code;
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      if (spec.model === 'picture' && this.interior) group.position.y = Math.min(spec.position[1], 0.45);
      this.scene.add(group);
      this.objects.set(spec.code, { group, spec, born: performance.now(), anchorY, phase: this.objects.size * 1.7 });
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
    if (!this.ready) {
      const done = () => {
        this.ready = true;
        this.invalidate();
        window.setTimeout(() => this.buildReflections(), 800);
      };
      this.renderer.compileAsync(this.scene, this.camera).then(done, done);
    }
  }

  /** Reflexo do céu na água (lago e fonte), gerado depois que a casa aparece. */
  private buildReflections() {
    if (this.envTarget) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const skyScene = new THREE.Scene();
    skyScene.add(buildSky());
    this.envTarget = pmrem.fromScene(skyScene, 0, 0.1, 400, { size: 64 });
    disposeTree(skyScene, true);
    pmrem.dispose();
    const water = waterMaterial();
    water.envMap = this.envTarget.texture;
    water.envMapIntensity = 1.2;
    water.needsUpdate = true;
    this.invalidate();
  }

  /** "Ver por dentro": tira o telhado e baixa as paredes (casa de bonecas). */
  setInterior(on: boolean) {
    this.interior = on;
    this.house.roof.visible = !on;
    const factor = on ? 0.3 : 1;
    for (const w of this.house.walls) {
      // cada bloco vai de y0 a y1: escalado a partir do chão, vai de y0·f a y1·f
      const baseY = (w.userData.baseY ??= w.position.y) as number;
      w.scale.y = factor;
      w.position.y = baseY * factor;
    }
    // objetos de parede (quadro) descem junto com a parede rebaixada
    for (const { group, spec } of this.objects.values()) {
      if (spec.model === 'picture') group.position.y = on ? Math.min(spec.position[1], 0.45) : spec.position[1];
    }
    // janelas e portas somem no modo aberto (ficariam flutuando)
    this.house.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.house.walls.includes(m) && m.parent !== this.house.group && m.parent !== this.house.roof) {
        m.visible = !on;
      }
    });
    this.invalidate();
  }

  /** Em telas estreitas (celular em pé), as vistas amplas se afastam para caber a propriedade inteira. */
  private framed(target: FocusTarget) {
    const v = VIEWS[target];
    const tTo = new THREE.Vector3(...v.target);
    const to = new THREE.Vector3(...v.pos);
    if (target === 'geral' || target === 'jardim') {
      const factor = Math.min(1.8, Math.max(1, 1.35 / Math.max(this.camera.aspect, 0.3)));
      to.sub(tTo).multiplyScalar(factor).add(tTo);
    }
    return { to, tTo };
  }

  focus(target: FocusTarget) {
    if (this.walking) {
      if (target === 'geral' || target === 'jardim') this.setWalk(false);
      else {
        this.walkTo(target);
        return;
      }
    }
    if (target !== 'geral' && target !== 'jardim' && !this.interior) this.setInterior(true);
    const { to, tTo } = this.framed(target);
    if (this.opts.reducedMotion) {
      this.camera.position.copy(to);
      this.controls.target.copy(tTo);
      this.controls.update();
      this.invalidate();
      return;
    }
    this.flight = { from: this.camera.position.clone(), to, tFrom: this.controls.target.clone(), tTo, start: performance.now() };
    this.invalidate();
  }

  zoom(direction: 1 | -1) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * (direction > 0 ? 0.8 : 1.25), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(dir.setLength(len));
    this.controls.update();
  }

  rotate(direction: 1 | -1) {
    if (this.walking) {
      this.nudge(0, -direction);
      return;
    }
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), (direction * Math.PI) / 8);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  // ---------- andar pela casa ----------

  get isWalking() {
    return this.walking;
  }

  /** Entra (ou sai) da casa em primeira pessoa. Entrando, começa na porta, olhando para a sala. */
  setWalk(on: boolean) {
    if (on === this.walking) return;
    this.walking = on;
    this.flight = null;
    this.input = { forward: 0, turn: 0 };
    this.keys.clear();
    this.controls.enabled = !on;
    if (on) {
      if (this.interior) this.setInterior(false); // paredes inteiras e telhado: é uma casa de verdade por dentro
      this.camera.fov = 68;
      this.camera.near = 0.05;
      this.walkPos.set(ROOMS.sala.x, EYE, HOUSE.center.z + HOUSE.depth / 2 - 0.6);
      this.yaw = 0;
      this.pitch = -0.06;
    } else {
      this.camera.fov = 45;
      this.camera.near = 0.1;
      const { to, tTo } = this.framed('geral');
      this.camera.position.copy(to);
      this.controls.target.copy(tTo);
      this.room = null;
    }
    for (const lamp of this.indoorLights) lamp.intensity = on ? 3.2 : 0;
    this.ceiling.visible = on;
    this.camera.updateProjectionMatrix();
    if (on) this.applyWalkCamera();
    else this.controls.update();
    this.invalidate();
  }

  /** Vai direto para um cômodo, olhando para dentro dele. */
  walkTo(room: RoomCode) {
    if (!this.walking) this.setWalk(true);
    const r = ROOMS[room];
    const c = HOUSE.center;
    const sx = Math.sign(r.x - c.x);
    const sz = Math.sign(r.z - c.z);
    this.walkPos.set(r.x - sx * 1.5, EYE, r.z - sz * 1.1);
    const dx = r.x + sx * 1.2 - this.walkPos.x;
    const dz = r.z + sz * 1.0 - this.walkPos.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.08;
    this.applyWalkCamera();
    this.invalidate();
  }

  /** Controle analógico: anda e vira na intensidade pedida (0 a 1) enquanto estiver acionado. */
  setWalkInput(input: WalkInput) {
    // só reinicia o relógio quando começa a andar (o controle manda vários valores por segundo)
    const idle = !this.input.forward && !this.input.turn && this.keys.size === 0;
    this.input = input;
    if (idle) this.lastWalkAt = performance.now();
    this.invalidate();
  }

  /** Um passo (ou um quarto de volta pequeno), para teclado e cliques rápidos. */
  nudge(forward: number, turn: number) {
    if (!this.walking) return;
    this.yaw -= turn * (Math.PI / 8);
    if (forward) this.move(forward * 0.6);
    this.applyWalkCamera();
    this.invalidate();
  }

  private direction() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  private applyWalkCamera() {
    this.camera.position.copy(this.walkPos);
    this.camera.lookAt(this.walkPos.clone().add(this.direction()));
    const c = HOUSE.center;
    const front = this.walkPos.z > c.z;
    const left = this.walkPos.x < c.x;
    const room: RoomCode = front ? (left ? 'sala' : 'cozinha') : left ? 'quarto' : 'estudos';
    if (room !== this.room) {
      this.room = room;
      this.opts.onRoom?.(room);
    }
  }

  /** A posição (x, z) encosta numa parede? As passagens internas deixam passar. */
  private blocked(x: number, z: number) {
    const { width: W, depth: D, thickness: T, center: c } = HOUSE;
    if (x < c.x - W / 2 + T / 2 + BODY || x > c.x + W / 2 - T / 2 - BODY) return true;
    if (z < c.z - D / 2 + T / 2 + BODY || z > c.z + D / 2 - T / 2 - BODY) return true;
    const half = PASSAGES.width / 2 - BODY;
    const wall = T * 0.4 + BODY;
    if (Math.abs(z - c.z) < wall && !PASSAGES.middleX.some((g) => Math.abs(x - (c.x + g)) < half)) return true;
    if (Math.abs(x - c.x) < wall && !PASSAGES.middleZ.some((g) => Math.abs(z - (c.z + g)) < half)) return true;
    return false;
  }

  /** Anda na direção do olhar, deslizando nas paredes e se alinhando à passagem mais próxima. */
  private move(step: number) {
    const c = HOUSE.center;
    const nx = this.walkPos.x - Math.sin(this.yaw) * step;
    const nz = this.walkPos.z - Math.cos(this.yaw) * step;
    const movedX = !this.blocked(nx, this.walkPos.z);
    if (movedX) this.walkPos.x = nx;
    const movedZ = !this.blocked(this.walkPos.x, nz);
    if (movedZ) this.walkPos.z = nz;
    // parou na parede do meio perto de uma passagem: escorrega até ela (fica fácil acertar a porta)
    const pull = Math.abs(step) * 0.8;
    if (!movedZ && Math.abs(nz - c.z) < 0.8) {
      const gap = PASSAGES.middleX.map((g) => c.x + g).find((gx) => Math.abs(this.walkPos.x - gx) < 0.9);
      if (gap !== undefined) this.walkPos.x += THREE.MathUtils.clamp(gap - this.walkPos.x, -pull, pull);
    }
    if (!movedX && Math.abs(nx - c.x) < 0.8) {
      const gap = PASSAGES.middleZ.map((g) => c.z + g).find((gz) => Math.abs(this.walkPos.z - gz) < 0.9);
      if (gap !== undefined) this.walkPos.z += THREE.MathUtils.clamp(gap - this.walkPos.z, -pull, pull);
    }
  }

  private walkFrame(now: number) {
    const dt = Math.min(0.05, (now - this.lastWalkAt) / 1000);
    this.lastWalkAt = now;
    const k = this.keys;
    const forward = THREE.MathUtils.clamp(this.input.forward + (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0), -1, 1);
    const turn = THREE.MathUtils.clamp(this.input.turn + (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), -1, 1);
    if (!forward && !turn) return false;
    this.yaw -= turn * TURN_SPEED * dt;
    if (forward) this.move(forward * WALK_SPEED * dt);
    this.applyWalkCamera();
    return true;
  }

  private static KEYS: Record<string, string> = {
    ArrowUp: 'f',
    KeyW: 'f',
    ArrowDown: 'b',
    KeyS: 'b',
    ArrowLeft: 'l',
    KeyA: 'l',
    ArrowRight: 'r',
    KeyD: 'r',
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const key = PlaceScene.KEYS[e.code];
    if (!this.walking || !key) return;
    e.preventDefault(); // setas não rolam a página enquanto anda
    if (!this.keys.has(key)) this.lastWalkAt = performance.now();
    this.keys.add(key);
    this.invalidate();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const key = PlaceScene.KEYS[e.code];
    if (key) this.keys.delete(key);
  };

  private onBlur = () => this.keys.clear();

  /** Andando: arrastar olha em volta (virar e olhar para cima/baixo). */
  private onPointerMove = (e: PointerEvent) => {
    if (!this.walking || !this.look) return;
    this.yaw = this.look.yaw + (e.clientX - this.look.x) * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.look.pitch + (e.clientY - this.look.y) * 0.004, -0.7, 0.5);
    this.applyWalkCamera();
    this.invalidate();
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('keydown', this.onKeyDown);
    canvas.removeEventListener('keyup', this.onKeyUp);
    canvas.removeEventListener('blur', this.onBlur);
    this.controls.dispose();
    disposeTree(this.scene, true);
    this.envTarget?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // devolve o contexto WebGL já (celulares aceitam poucos)
    canvas.remove();
  }

  // ---------- internos ----------

  private invalidate() {
    this.needsRender = true;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const t = this.clock.getElapsedTime();

    if (this.flight) {
      const k = Math.min(1, (now - this.flight.start) / 700);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, e);
      this.controls.target.lerpVectors(this.flight.tFrom, this.flight.tTo, e);
      if (k >= 1) this.flight = null;
      this.needsRender = true;
    }
    if (this.walking) {
      if (this.walkFrame(now)) this.needsRender = true;
    } else if (this.controls.update()) this.needsRender = true;

    // objetos novos crescem
    for (const { group, spec, born } of this.objects.values()) {
      if (spec.isNew && !this.opts.reducedMotion) {
        const k = Math.min(1, (now - born) / 900);
        const s = spec.scale * (k < 1 ? 1 - Math.pow(1 - k, 3) : 1);
        if (group.scale.x !== s) {
          group.scale.setScalar(Math.max(0.01, s));
          this.renderer.shadowMap.needsUpdate = true;
          this.needsRender = true;
        }
      }
    }
    // vento, água e bichos (desligado com redução de movimento), a ~30 quadros/s
    if (!this.opts.reducedMotion && document.visibilityState === 'visible' && now - this.lastAnimAt >= 33) {
      this.lastAnimAt = now;
      this.wind.uniforms.uTime.value = t;
      waterClock.uniforms.uTime.value = t;
      for (const { group, phase } of this.objects.values()) animateModel(group, t, phase);
      for (const cloud of this.clouds.children) {
        cloud.position.x += cloud.userData.speed * 0.033;
        if (cloud.position.x > 130) cloud.position.x = -130;
      }
      this.needsRender = true;
    }

    if (!this.needsRender || !this.ready) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.camera);
    this.emitHotspots();
  };

  /** Posição na tela de cada objeto → botões acessíveis por cima da cena. */
  private emitHotspots() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    const spots: Hotspot[] = [];
    const { width: W, depth: D, center: c } = HOUSE;
    for (const { group, spec, anchorY } of this.objects.values()) {
      v.setFromMatrixPosition(group.matrixWorld);
      // andando: só os objetos de dentro da casa e por perto (os do jardim ficam atrás das paredes)
      const near =
        !this.walking ||
        (Math.abs(v.x - c.x) < W / 2 && Math.abs(v.z - c.z) < D / 2 && v.distanceTo(this.walkPos) < 5.5);
      v.y += Math.min(anchorY, 4) * (group.scale.x / spec.scale) + 0.15;
      v.project(this.camera);
      const visible = near && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      spots.push({ code: spec.code, label: spec.label, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible });
    }
    this.opts.onHotspots(spots);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
    if (this.walking) {
      this.look = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
      this.renderer.domElement.setPointerCapture?.(e.pointerId);
    }
  };

  /** Toque/clique (sem arrastar) seleciona o objeto sob o ponteiro. */
  private onPointerUp = (e: PointerEvent) => {
    this.look = null;
    if (!this.downAt || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.objects.values()].map((o) => o.group), true);
    const code = hits[0]?.object.userData.code as string | undefined;
    if (code) this.opts.onSelect(code);
  };
}

/** Libera geometrias e materiais. Materiais compartilhados só saem quando a cena inteira sai. */
function disposeTree(root: THREE.Object3D, all = false) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const list = ([] as THREE.Material[]).concat((m.material as THREE.Material | THREE.Material[] | undefined) ?? []);
    for (const x of list) if (all || !x.userData.shared) x.dispose();
  });
}

export { GARDEN, HOUSE, ROOMS };
